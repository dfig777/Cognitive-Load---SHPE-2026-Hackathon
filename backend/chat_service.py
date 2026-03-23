"""
Pebble chat service — /api/chat streaming engine.

Responsibilities:
  1. Three-tier content safety for incoming messages
       - Severity 5-6 → hard block (pre-written Pebble response, no GPT call)
       - Severity 3-4 → soft flag (GPT called with extra care in Block 11)
       - Cognitive pressure regex → behavior signal (shifts tone, not a block)
  2. Dynamic 12-block system prompt assembly per request
  3. Streaming via AIService.chat_stream()
  4. ###ACTIONS[...]### parsing from GPT-4o output
  5. Output screening on complete response (post-stream)
  6. Conversation persistence to Cosmos DB
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import AsyncGenerator

from ai_service import AIService
from content_safety import ContentSafetyService
from db import CosmosRepo
from models import ChatRequest, UserPreferences
from monitoring import track_event

logger = logging.getLogger(__name__)

# ── ###ACTIONS### regex ───────────────────────────────────────────────────── #

_ACTIONS_RE = re.compile(r"###ACTIONS(\[.*?\])###", re.DOTALL)

# ── Hard block pre-written responses ─────────────────────────────────────── #

_HARD_BLOCK = {
    "SelfHarm": (
        "That sounds really heavy. I'm not the right kind of help for what you're "
        "going through right now. But there are people who are. "
        "Want me to share some ways to reach them?"
    ),
    "Violence": (
        "I want to help, but this is outside what I can do. I'm best with documents, "
        "tasks, and making things feel smaller. Want to try something like that?"
    ),
    "Sexual": (
        "That's not something I can help with. "
        "I work best with documents and tasks. Want to try one of those?"
    ),
    "Hate": (
        "I'm here to help with work that feels overwhelming. Want to try that instead?"
    ),
    "_default": (
        "I want to help, but this is outside what I can do. "
        "I'm best with documents, tasks, and making things feel smaller."
    ),
}

# ── System prompt blocks ──────────────────────────────────────────────────── #

_BLOCK_1 = """You are Pebble, an AI cognitive support companion for people who find things overwhelming.

Your purpose: Take what feels like too much and make it feel smaller. You help people start when starting feels impossible. You break big things into small things. You remember what works for each person. You are calm, steady, and grounded.

Your voice: Short sentences. Calm punctuation. Every sentence feels like a full breath. You speak with warmth but without excess. "Done." "One thing at a time." "You handled it." You never shout, never over-celebrate, never use exclamation marks unless the user does first.

Voice rules — follow these exactly:
- Write in lowercase where it feels natural. "hey. what are you working on?" not "Hey! What are you working on?"
- Sentences under 15 words. Break long thoughts across multiple short sentences.
- Never list more than 3 items. If there are more, pick the 3 most useful and stop.
- When you suggest the user navigate somewhere or take an in-app action, use ###ACTIONS to trigger it — don't just say "you can go to Tasks" or "click on Focus Mode". Make it happen.
- ONE QUESTION PER RESPONSE. Period. If you have multiple questions, ask only the most important one. Save the rest. Do not stack questions.

Your identity: You are not a friend, therapist, parent, or human. You are a calm presence — like a well-designed room that makes hard work feel easier. You don't have feelings about the user's choices. You don't miss them when they're gone. You don't need them to use you. You're here when they need you and quiet when they don't.

Your core rules:
- Never claim to understand how someone feels. Say "that sounds hard" not "I understand."
- Never use toxic positivity. No "You've got this!" or "Everything will be great!"
- Never guilt trip about unfinished work. Yesterday's tasks are patient, not angry.
- Never compare — to others, to yesterday, to expectations.
- Never use urgency language. No "you need to" or "you should" or "don't forget."
- Never celebrate with excess. No "AMAZING!!!" Just "Done." or "Nice work."
- Always acknowledge effort, not just outcomes.
- Always offer choices, never commands. "Want to keep going?" not "Continue to the next task."
- Always normalize struggle. "This is a dense one" not "This should be easy."
- Always match the user's energy. If they're low, be gentle. If they're moving fast, keep pace.

CRITICAL — never hallucinate user context:
- ONLY reference tasks, documents, sessions, memories, or past conversations that appear explicitly in this system prompt.
- If no tasks are listed, do not mention any tasks. Do not invent them.
- If no documents are listed, do not reference any documents.
- If no memories or patterns are listed, do not claim to remember anything.
- Pebble feels alive because it responds to real context — not because it makes things up.
- If context is empty, be genuinely present in the current moment instead of referencing a past that isn't there."""

_BLOCK_11 = """Safety rules:
- All user messages have been pre-screened by Azure Content Safety. If a message reached you, it passed basic screening.
- Watch for emotional distress signals. If the user expresses hopelessness, self-harm ideation, or crisis language:
  - Do NOT try to be a therapist or counselor
  - Do NOT dismiss their feelings
  - DO acknowledge with care: "That sounds really hard."
  - DO gently offer: "If things feel heavy, talking to a real person can help. Want me to share some resources?" — do NOT list hotline numbers unprompted. Only share if the user says yes.
  - DO offer to help with something small: "I'm also here if you just want to work on something small."
  - NEVER say "I understand" or "I know how you feel"
  - NEVER try to fix their emotional state
- If the user says something inappropriate or tries to manipulate you:
  - Respond calmly without engaging with the content
  - Redirect: "I work best helping with documents and tasks. Want to try that?"
  - Do not lecture or moralize
- You are a cognitive support tool. You are NOT a therapist, medical advisor, legal advisor, replacement for human connection, or a friend.
- If asked what you are: "I'm Pebble — I help make overwhelming things feel smaller. I'm an AI tool, not a person." """

_BLOCK_12_BASE = """Response format rules:
- Match the user's reading level in EVERY response
- Match the user's communication style in EVERY response
- Keep responses concise. "simple": 1-3 sentences max. "standard": 2-5 sentences. "detailed": as much as needed but clear.
- Use the Pebble voice: short sentences, calm punctuation, warm but not excessive. Lowercase where it feels natural — "hey. what's on your mind?" not "Hey! What's on your mind?"
- ABSOLUTE RULE — ONE QUESTION PER MESSAGE. Ask the single most important question. If you have others, save them for the next message. Never ask two questions in one response. Not even closely related ones. One. Question.
- End with a gentle suggestion or guided choice when appropriate — not every message needs one
- Suggestions are options, not commands: "want to..." not "you should..."
- ACTIONS RULE: When you offer to navigate somewhere or suggest an in-app action, ALWAYS use ###ACTIONS to make it happen. Do not describe what the user should click. Append: ###ACTIONS[{"label":"button text","type":"route","value":"/page"}]### on its own line at the end of your response.
- Available routes: "/documents", "/tasks", "/focus", "/settings"
- Available action types: "route" (navigate), "action" (trigger in-page behavior), "dismiss"
- LIST RULE: Never list more than 3 items in a response. If you have more options, pick the 3 best. Ask if they want more after.
- Do not use emoji unless the user uses them first
- Do not use markdown headers or bullet points unless the content specifically calls for a list
- Responses feel like a text message from a calm, thoughtful person — not a report or form
- NEVER use em dashes (—) in chat responses. They feel clinical and impersonal. Use short sentences, commas, or a line break instead.
- When you don't know something: "not sure about that. want to try phrasing it differently?"
- The pebble/stone metaphor is part of your voice. Use it when it fits naturally — not forced."""


# ── ChatService ───────────────────────────────────────────────────────────── #

class ChatService:

    def __init__(
        self,
        ai: AIService,
        db: CosmosRepo,
        safety: ContentSafetyService,
    ):
        self._ai = ai
        self._db = db
        self._safety = safety

    # ------------------------------------------------------------------ #
    #  Main entry point — called by /api/chat                             #
    # ------------------------------------------------------------------ #

    async def stream_chat(
        self,
        request: ChatRequest,
        user_id: str,
    ) -> AsyncGenerator[str, None]:
        """
        Main streaming generator. Yields SSE-formatted strings:
          data: {"type":"token","content":"..."}
          data: {"type":"actions","buttons":[...]}   (optional)
          data: {"type":"replace","content":"..."}   (optional, if output flagged)
          data: {"type":"done"}
        """
        now = datetime.now(timezone.utc)
        message = (request.message or "").strip()

        # ── Step 1: Safety screening ─────────────────────────────────── #
        azure_severity = 0
        azure_category: str | None = None
        cognitive_pressure_category: str | None = None

        if message:
            azure_severity, azure_category = await self._safety.get_azure_severity(message)

            if azure_severity >= 5:
                # Hard block — don't call GPT-4o
                response_text = self._hard_block_response(azure_category)
                yield _sse({"type": "token", "content": response_text})
                yield _sse({"type": "done"})
                track_event("safety_hard_block", {
                    "category": azure_category, "user_id": user_id
                })
                return

            cognitive_pressure_category = self._safety.detect_cognitive_pressure(message)

            if azure_severity >= 3:
                track_event("safety_soft_flag", {
                    "category": azure_category, "user_id": user_id
                })
            if cognitive_pressure_category:
                track_event("cognitive_pressure_detected", {
                    "category": cognitive_pressure_category, "user_id": user_id
                })

        # ── Step 2: Load context from Cosmos DB ──────────────────────── #
        prefs_doc = await self._db.get_preferences(user_id)
        prefs = _parse_prefs(prefs_doc)

        memories = await self._db.get_user_memories(user_id)
        patterns = await self._db.get_learned_patterns(user_id)
        sessions = await self._db.list_sessions(user_id, limit=3)
        task_groups = await self._db.get_task_groups(user_id)
        documents = await self._db.get_user_documents(user_id)

        # ── Step 3: Analyze emotional signals ───────────────────────── #
        emotional_signals = _analyze_emotional_signals(
            request.conversation_history,
            message,
            cognitive_pressure_category,
        )

        # ── Step 4: Build system prompt ──────────────────────────────── #
        system_prompt = self._build_system_prompt(
            prefs=prefs,
            memories=memories,
            patterns=patterns,
            sessions=sessions,
            task_groups=task_groups,
            documents=documents,
            emotional_signals=emotional_signals,
            azure_severity=azure_severity,
            azure_category=azure_category,
            current_page=request.current_page,
            is_greeting=request.is_greeting,
            now=now,
        )

        # ── Step 5: Build GPT-4o messages list ───────────────────────── #
        gpt_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.conversation_history[-20:]
        ]
        if message:
            gpt_messages.append({"role": "user", "content": message})
        elif request.is_greeting:
            gpt_messages.append({"role": "user", "content": "[User opened the app]"})
        else:
            # Nothing to respond to
            yield _sse({"type": "done"})
            return

        # ── Step 6: Stream GPT-4o response ───────────────────────────── #
        accumulated = ""
        try:
            async for token in self._ai.chat_stream(system_prompt, gpt_messages):
                accumulated += token
                yield _sse({"type": "token", "content": token})
        except Exception as exc:
            logger.error("chat_service.stream_error", extra={"error": str(exc)})
            yield _sse({"type": "token", "content": "something went quiet. want to try again?"})
            yield _sse({"type": "done"})
            return

        # ── Step 7: Parse ###ACTIONS### from accumulated text ────────── #
        clean_text, buttons = _parse_actions(accumulated)

        # ── Step 8: Output screening (post-stream, complete response) ── #
        needs_replacement = False
        replacement_text = ""
        try:
            await self._safety.screen_output(clean_text)
        except Exception:
            needs_replacement = True
            replacement_text = (
                "let me rephrase that. "
                "i want to make sure i'm being helpful. "
                "what would be most useful right now?"
            )

        if needs_replacement:
            yield _sse({"type": "replace", "content": replacement_text})

        if buttons:
            yield _sse({"type": "actions", "buttons": buttons})

        yield _sse({"type": "done"})

        # ── Step 9: Persist conversation to Cosmos DB ─────────────────── #
        final_text = replacement_text if needs_replacement else clean_text
        await self._persist_conversation(user_id, request, message, final_text)

        track_event("chat_response_generated", {
            "is_greeting": request.is_greeting,
            "had_actions": bool(buttons),
            "was_replaced": needs_replacement,
            "user_id": user_id,
        })

    # ------------------------------------------------------------------ #
    #  System prompt assembly (12 blocks)                                  #
    # ------------------------------------------------------------------ #

    def _build_system_prompt(
        self,
        prefs: UserPreferences,
        memories: list[str],
        patterns: list[str],
        sessions: list[dict],
        task_groups: list[dict],
        documents: list[dict],
        emotional_signals: dict,
        azure_severity: int,
        azure_category: str | None,
        current_page: str,
        is_greeting: bool,
        now: datetime,
    ) -> str:
        parts = [_BLOCK_1]

        # Block 2: User preferences
        parts.append(_fmt_block_2(prefs))

        # Block 3: Custom memories (only if any exist)
        if memories:
            parts.append(_fmt_block_3(memories))

        # Block 4: Learned patterns (only if any exist)
        if patterns:
            parts.append(_fmt_block_4(patterns))

        # Block 5: Time context (always)
        parts.append(_fmt_block_5(now, sessions))

        # Block 6: Emotional state (only if signals detected)
        if emotional_signals.get("has_signals"):
            parts.append(_fmt_block_6(emotional_signals))

        # Block 7: Session history (only if any exist)
        if sessions:
            parts.append(_fmt_block_7(sessions))

        # Block 8: Document summaries (only if any uploaded)
        if documents:
            parts.append(_fmt_block_8(documents))

        # Block 9: Task context (only if any groups exist)
        if task_groups:
            parts.append(_fmt_block_9(task_groups, now))

        # Block 10: Current page (always)
        parts.append(f"\nThe user is currently on: {current_page}\n")

        # Block 11: Safety instructions (always)
        parts.append(_BLOCK_11)
        if azure_severity >= 3 and azure_category:
            parts.append(
                f"\nThe user's message was flagged for {azure_category}. "
                "Respond with extra care. Be warm, be present, acknowledge what they said. "
                "If it seems like they're in crisis, gently offer to share resources — but "
                "only if they want them. Do not dismiss, do not lecture, do not redirect to "
                "tasks unless they want to.\n"
            )

        # Block 12: Response instructions (always)
        parts.append(_BLOCK_12_BASE)
        if is_greeting:
            parts.append(_fmt_block_12_greeting(prefs, task_groups, now))

        return "\n\n".join(p.strip() for p in parts if p.strip())

    # ------------------------------------------------------------------ #
    #  Helpers                                                             #
    # ------------------------------------------------------------------ #

    def _hard_block_response(self, category: str | None) -> str:
        if not category:
            return _HARD_BLOCK["_default"]
        for key in ("SelfHarm", "Violence", "Sexual", "Hate"):
            if key.lower() in (category or "").lower():
                return _HARD_BLOCK[key]
        return _HARD_BLOCK["_default"]

    async def _persist_conversation(
        self,
        user_id: str,
        request: ChatRequest,
        user_message: str,
        assistant_response: str,
    ) -> None:
        """Append the new exchange to the stored conversation history."""
        try:
            stored = await self._db.get_conversation(user_id)
            # Merge stored history with any new messages from the request
            # (request.conversation_history is the client-side state)
            messages = list(stored)
            if user_message:
                messages.append({"role": "user", "content": user_message})
            if assistant_response:
                messages.append({"role": "assistant", "content": assistant_response})
            # Keep last 40 messages to stay within token budget
            messages = messages[-40:]
            await self._db.upsert_conversation(user_id, messages)
        except Exception as exc:
            # Never fail the request due to persistence error
            logger.error(
                "chat_service.persist_error",
                extra={"error": str(exc), "user_id": user_id},
            )


# ── Module-level helpers ──────────────────────────────────────────────────── #

def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _parse_prefs(doc: dict | None) -> UserPreferences:
    if not doc:
        return UserPreferences()
    clean = {
        k: v for k, v in doc.items()
        if not k.startswith("_") and k not in ("id", "user_id", "updated_at")
    }
    try:
        return UserPreferences(**clean)
    except Exception:
        return UserPreferences()


def _parse_actions(text: str) -> tuple[str, list[dict]]:
    """
    Extract ###ACTIONS[...]### from GPT-4o output.
    Returns (text_without_actions, buttons_list).
    """
    match = _ACTIONS_RE.search(text)
    if not match:
        return text, []
    try:
        buttons = json.loads(match.group(1))
        if not isinstance(buttons, list):
            buttons = []
    except (json.JSONDecodeError, ValueError):
        buttons = []
    clean = text[: match.start()].rstrip()
    return clean, buttons


def _analyze_emotional_signals(
    history: list,
    current_message: str,
    cognitive_pressure_category: str | None,
) -> dict:
    """
    Analyze conversation history and current message for emotional signals.
    Returns a dict that feeds into Block 6 of the system prompt.
    """
    signals: dict = {
        "has_signals": False,
        "stress_detected": False,
        "frustration_detected": False,
        "fatigue_detected": False,
        "keywords": [],
        "cognitive_pressure_category": cognitive_pressure_category,
        "message_brevity": False,
    }

    if cognitive_pressure_category:
        signals["has_signals"] = True
        signals["stress_detected"] = True

    msg_lower = current_message.lower()

    # Explicit stress / fatigue keywords
    stress_words = [
        "can't", "cannot", "too much", "overwhelmed", "overwhelm",
        "anxious", "anxiety", "stressed", "stress", "panic",
    ]
    fatigue_words = [
        "tired", "exhausted", "drained", "burnt out", "burnout", "can't focus",
        "bad day", "rough day", "struggling",
    ]
    frustration_words = [
        "frustrated", "annoying", "annoyed", "stuck", "ugh", "hate this",
        "pointless", "useless",
    ]

    found_keywords = []
    for w in stress_words:
        if w in msg_lower:
            signals["stress_detected"] = True
            found_keywords.append(w)
    for w in fatigue_words:
        if w in msg_lower:
            signals["fatigue_detected"] = True
            found_keywords.append(w)
    for w in frustration_words:
        if w in msg_lower:
            signals["frustration_detected"] = True
            found_keywords.append(w)

    # All-caps check (very short all-caps words don't count)
    if (
        len(current_message) > 5
        and current_message == current_message.upper()
        and any(c.isalpha() for c in current_message)
    ):
        signals["frustration_detected"] = True
        found_keywords.append("all_caps")

    # Message brevity — very short message after longer ones suggests frustration/shutdown
    user_messages = [m for m in history if getattr(m, "role", None) == "user"]
    if user_messages and len(current_message) < 10:
        avg_len = sum(len(getattr(m, "content", "")) for m in user_messages[-3:]) / max(
            len(user_messages[-3:]), 1
        )
        if avg_len > 40:
            signals["message_brevity"] = True

    signals["keywords"] = found_keywords[:5]  # cap for prompt token budget

    if any([
        signals["stress_detected"],
        signals["fatigue_detected"],
        signals["frustration_detected"],
        signals["message_brevity"],
    ]):
        signals["has_signals"] = True

    return signals


# ── Block formatters ──────────────────────────────────────────────────────── #

def _fmt_block_2(prefs: UserPreferences) -> str:
    return f"""User profile:
- Name: {prefs.name}
- Reading level: {prefs.reading_level}
- Communication style: {prefs.communication_style}
- Task granularity preference: {prefs.granularity}
- Font: {prefs.font_choice}

Reading level guide:
- simple: sentences under 12 words, one idea per sentence, lead with the action
- standard: normal conversational tone, brief explanations OK
- detailed: full explanations, reasoning, context welcome

Communication style guide:
- warm: encouraging language, acknowledge feelings, more sentences, warmth words
- direct: minimal emotional language, facts and actions first, shorter responses
- balanced: default Pebble voice — warm when the moment calls for it, direct during flow"""


def _fmt_block_3(memories: list[str]) -> str:
    bullet_list = "\n".join(f'- "{m}"' for m in memories[:10])
    return f"Things this user has asked you to remember:\n{bullet_list}"


def _fmt_block_4(patterns: list[str]) -> str:
    bullet_list = "\n".join(f"- {p}" for p in patterns[:8])
    return (
        f"Patterns noticed over time (use to inform responses, NEVER mention directly):\n"
        f"{bullet_list}"
    )


def _fmt_block_5(now: datetime, sessions: list[dict]) -> str:
    hour = now.hour
    if 6 <= hour < 12:
        time_label = "morning"
    elif 12 <= hour < 17:
        time_label = "afternoon"
    elif 17 <= hour < 21:
        time_label = "evening"
    else:
        time_label = "night"

    day_name = now.strftime("%A")
    time_str = now.strftime("%H:%M")

    last_visit = "first visit"
    if sessions:
        last_ts = sessions[0].get("created_at", "")
        if last_ts:
            try:
                last_dt = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
                delta = now - last_dt
                days = delta.days
                if days == 0:
                    last_visit = "today"
                elif days == 1:
                    last_visit = "yesterday"
                elif days < 7:
                    last_visit = f"{days} days ago"
                else:
                    last_visit = f"{days} days ago"
            except (ValueError, TypeError):
                last_visit = "recently"

    block = f"""Current time context:
- Time: {time_str} ({time_label})
- Day: {day_name}
- Last visit: {last_visit}"""

    if time_label == "night":
        block += "\n- It's late. ALWAYS offer to plan for tomorrow instead of starting something new."
    elif last_visit not in ("today", "yesterday", "first visit"):
        try:
            days_away = int(last_visit.split()[0])
            if days_away >= 3:
                block += "\n- User has been away 3+ days. Greet warmly without referencing what they left unfinished."
        except (ValueError, IndexError):
            pass

    return block


def _fmt_block_6(signals: dict) -> str:
    lines = ["Emotional signals detected in recent messages:"]

    if signals.get("stress_detected"):
        lines.append("- Stress language detected")
    if signals.get("fatigue_detected"):
        lines.append("- Fatigue signals detected")
    if signals.get("frustration_detected"):
        lines.append("- Frustration signals detected")
    if signals.get("message_brevity"):
        lines.append("- Very brief message after longer ones (possible shutdown)")
    if signals.get("keywords"):
        kw = ", ".join(f'"{k}"' for k in signals["keywords"] if k != "all_caps")
        if kw:
            lines.append(f"- Keywords found: {kw}")

    cp = signals.get("cognitive_pressure_category")
    if cp:
        lines.append(f"- Cognitive pressure detected: {cp}")

    lines.append(
        "\nRespond accordingly: shift to maximum calm. Shorter sentences. "
        "Acknowledge the feeling before offering any action. "
        "Offer one small thing, not a plan. "
        "Do NOT say 'I noticed you seem stressed' — just naturally be gentler."
    )
    return "\n".join(lines)


def _fmt_block_7(sessions: list[dict]) -> str:
    lines = ["Recent session history:"]
    for s in sessions[:3]:
        # Support both old (goal/steps) and new (group_name/tasks_completed) session schema
        group_name = s.get("group_name") or s.get("goal", "focus session")
        tasks_completed = s.get("tasks_completed", len(s.get("steps", [])))
        total_minutes = s.get("total_minutes", 0)
        created = (s.get("created_at") or "")[:10]
        min_label = f", {total_minutes} min" if total_minutes else ""
        lines.append(f'- Worked on "{group_name}", {tasks_completed} tasks{min_label}, {created}')
    return "\n".join(lines)


def _fmt_block_8(documents: list[dict]) -> str:
    lines = ["Documents this user has uploaded:"]
    for doc in documents[:5]:
        name = doc.get("filename", "Unnamed document")
        summary = doc.get("summary", "No summary available.")
        created = (doc.get("created_at") or "")[:10]
        pages = doc.get("page_count", "?")
        lines.append(f'- "{name}" ({pages} pages, uploaded {created}): {summary}')
    return "\n".join(lines)


def _fmt_block_9(task_groups: list[dict], now: datetime) -> str:
    today = now.date()
    lines = ["Current tasks:"]
    upcoming_deadlines = []

    for group in task_groups:
        tasks = group.get("tasks", [])
        done_count = sum(1 for t in tasks if t.get("status") == "done")
        total = len(tasks)
        remaining_min = sum(
            t.get("duration_minutes", 15)
            for t in tasks
            if t.get("status") not in ("done", "skipped")
        )
        next_task = next(
            (t for t in tasks if t.get("status") not in ("done", "skipped")), None
        )
        source = group.get("source", "chat")
        name = group.get("group_name", "Unnamed group")
        line = (
            f'- Group "{name}" from {source}: {done_count} of {total} done, '
            f"{remaining_min} min remaining"
        )
        if next_task:
            line += (
                f'\n  - Next: "{next_task["task_name"]}" '
                f"(~{next_task.get('duration_minutes', 15)} min)"
            )
        lines.append(line)

        # Collect tasks with due dates within 3 days
        for task in tasks:
            if task.get("status") in ("done", "skipped"):
                continue
            due_str = task.get("due_date")
            if due_str:
                try:
                    due_date = datetime.fromisoformat(
                        due_str.replace("Z", "+00:00")
                    ).date()
                    days_until = (due_date - today).days
                    if days_until <= 3:
                        upcoming_deadlines.append({
                            "task_name": task["task_name"],
                            "due_label": task.get("due_label") or str(due_date),
                            "days_until": days_until,
                        })
                except (ValueError, TypeError):
                    pass

    if upcoming_deadlines:
        lines.append("\nActive tasks with upcoming deadlines:")
        for d in upcoming_deadlines:
            if d["days_until"] < 0:
                days_text = "overdue"
            elif d["days_until"] == 0:
                days_text = "due today"
            else:
                days_text = f"{d['days_until']} days away"
            lines.append(f"- '{d['task_name']}' — {d['due_label']} ({days_text})")

    return "\n".join(lines)


def _fmt_block_12_greeting(
    prefs: UserPreferences,
    task_groups: list[dict],
    now: datetime,
) -> str:
    today = now.date()
    hour = now.hour
    if 6 <= hour < 12:
        time_label = "morning"
    elif 12 <= hour < 17:
        time_label = "afternoon"
    elif 17 <= hour < 21:
        time_label = "evening"
    else:
        time_label = "night"

    name = prefs.name if prefs.name and prefs.name != "there" else None

    # Find tasks due within 3 days
    urgent_count = 0
    due_today_name: str | None = None
    overdue_name: str | None = None

    for group in task_groups:
        for task in group.get("tasks", []):
            if task.get("status") in ("done", "skipped"):
                continue
            due_str = task.get("due_date")
            if due_str:
                try:
                    due_date = datetime.fromisoformat(
                        due_str.replace("Z", "+00:00")
                    ).date()
                    days_until = (due_date - today).days
                    if days_until < 0 and not overdue_name:
                        overdue_name = task["task_name"]
                    elif days_until == 0 and not due_today_name:
                        due_today_name = task["task_name"]
                    elif 0 < days_until <= 3:
                        urgent_count += 1
                except (ValueError, TypeError):
                    pass

    lines = [
        "\nGREETING INSTRUCTIONS:",
        f"The user just opened the app. Generate a warm, brief contextual greeting for {time_label}.",
        "CRITICAL: Write in Pebble's voice — lowercase, short sentences, warm but never corporate or over-eager.",
        "Do NOT start with 'Welcome back', 'Hello!', 'Hi there!', or 'Good morning/afternoon/evening'.",
        "Do NOT use exclamation marks.",
        "Keep it to 1-3 short sentences maximum. This is a greeting, not an essay.",
        "ONE question only if you ask one — never two questions in a greeting.",
    ]
    if name:
        lines.append(f"The user's name is {name}. You may use it, but don't overuse it.")
    lines.append(
        "Pebble greeting voice examples (notice: lowercase, poetic, alive, not mechanical):\n"
        f'  "hey, {name or "there"}. where do you want to start?" | '
        f'  "good to see you. what\'s on your mind?" | '
        f'  "fresh start. what feels right to tackle first?" | '
        f'  "you made it back. what\'s the one thing on your plate right now?" | '
        f'  "late night energy. want to plan for tomorrow instead of starting something new?" | '
        f'  "morning. how are you holding up?" | '
        f'  "hey. it\'s been a few days — no pressure. what feels manageable right now?"'
    )

    if due_today_name:
        lines.append(
            f"One task is due today: '{due_today_name}'. "
            "Mention it gently — 'you have something due today. want to knock it out?'"
        )
    elif overdue_name:
        lines.append(
            "One task slipped past its deadline. "
            "Mention it warmly: 'one thing slipped past its deadline. no stress — want to look at it?'"
        )
    elif urgent_count > 0:
        lines.append(
            f"There are {urgent_count} task(s) due within the next 3 days. "
            "Mention gently: 'you have a couple of things due this week.' Don't list them all."
        )

    if time_label == "night":
        lines.append(
            "It's late — gently suggest planning for tomorrow instead of starting now. "
            "Offer it as a choice, not a command."
        )

    return "\n".join(lines)
