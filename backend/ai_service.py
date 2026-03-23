"""
Azure OpenAI service — wraps the openai async client.
All prompts are engineered for neuro-inclusive, calm, factual output.
"""
from __future__ import annotations

import json
from datetime import date
from typing import AsyncIterator

from openai import AsyncAzureOpenAI

from config import Settings

# Per-call timeouts (seconds). Streaming gets more time since chunks arrive
# incrementally. Non-streaming calls should be fast — fail clearly if they hang.
_TIMEOUT_DEFAULT = 30.0
_TIMEOUT_STREAM  = 60.0

# ── Calm-language system messages ────────────────────────────────────────── #

_DECOMPOSER_SYSTEM = """
You are a warm, executive-function coach who specialises in helping people with ADHD,
autism, dyslexia, and anxiety. Your tone is ALWAYS calm, supportive, and non-judgmental.

Rules:
- Return ONLY valid JSON — no markdown fences, no prose outside the JSON.
- Break the goal into steps, each ≤ 15 minutes.
- For "micro" granularity, break further (≤ 5 min each, more steps is fine).
- The response MUST include a top-level "group_name" field: a 2-4 word clean, descriptive title for this set of tasks (e.g. "Apartment move prep", "CHEM 101 exam study", "Tax return filing"). Capitalize first word only. Never start with "From:" or "Tasks:".
- Each step MUST have:
    task_name        : string       — short, action-verb phrase
    duration_minutes : integer      — realistic estimate
    motivation_nudge : string       — one gentle, encouraging sentence. Warm and calm tone. Capitalize normally. No exclamation marks. No "You can do this!" or "Great job!". Example: "This is the hardest part. Once it's done, the rest flows." or "Just getting it open is enough for now."
    due_date         : string|null  — ISO 8601 date string if a deadline applies, else null
    due_label        : string|null  — friendly label ("Friday", "due today", "next week") if due_date is set, else null
- Schema: { "group_name": "...", "steps": [ { "task_name": "...", "duration_minutes": N, "motivation_nudge": "...", "due_date": "...", "due_label": "..." } ] }

Due date rules:
- The user message will include "Today's date: YYYY-MM-DD". Use this to calculate specific dates.
- If the user mentions a deadline or timeframe, spread tasks across available days realistically.
  Example: "exam on Wednesday" + today is Monday → tasks get Mon/Tue dates, exam task gets Wednesday
- If no deadline is mentioned, set due_date and due_label to null for all steps.
- due_date format: "YYYY-MM-DDT00:00:00Z" (ISO 8601, midnight UTC)
- due_label examples: "today", "tomorrow", "Wednesday", "Friday", "next week", "before week 2"
""".strip()

_SUMMARISE_SYSTEM = """
You are a plain-language specialist. You rewrite text so it is:
- At the reading level requested by the user (simple / standard / detailed).
- Free of jargon, passive voice, and long sentences.
- Calm — never alarming or overwhelming.
Return ONLY the rewritten text with no preamble.
""".strip()

_SIMPLIFY_SENTENCE_SYSTEM = """
You are a clarity editor. Given ONE sentence, explain in ≤ 15 words WHY you would simplify it
and give the simplified version. Return JSON:
{ "reason": "...", "simplified": "..." }
""".strip()

_NUDGE_SYSTEM = """
You are Pebble, a calm cognitive support companion. A user has been on the same task longer than expected.
Write ONE short, supportive, non-pressuring check-in message (≤ 20 words).
Voice rules: Warm, natural, conversational. Capitalize normally. No exclamation marks. No "You've got this". Short sentences.
Examples: "Still here with you. Want to break this into a smaller piece?" | "That one sounds tricky. Want to swap it out for something easier first?" | "I'm here if you want to try a different angle."
Return only the message string, no JSON.
""".strip()


class AIService:
    def __init__(self, settings: Settings):
        self._client = AsyncAzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
        )
        # Use AZURE_OPENAI_DEPLOYMENT from .env if set, otherwise fall back to
        # AZURE_OPENAI_DEPLOYMENT_GPT4O (legacy field name)
        self._model = settings.azure_openai_deployment or settings.azure_openai_deployment_gpt4o

    # ------------------------------------------------------------------ #
    #  Task Decomposer                                                     #
    # ------------------------------------------------------------------ #

    async def decompose(
        self,
        goal: str,
        granularity: str = "normal",   # "micro" | "normal" | "broad"
        context: str = "",
    ) -> dict:
        today = date.today().isoformat()
        user_msg = f"Today's date: {today}\nGoal: {goal}"
        if context:
            user_msg += f"\nContext: {context}"
        if granularity == "micro":
            user_msg += "\nGranularity: micro (≤5 min steps, as many as needed)"
        elif granularity == "broad":
            user_msg += "\nGranularity: broad (up to 30 min steps, keep it short)"

        resp = await self._client.chat.completions.create(
            model=self._model,
            temperature=0.2,       # low temp → consistent, factual output
            response_format={"type": "json_object"},
            timeout=_TIMEOUT_DEFAULT,
            messages=[
                {"role": "system", "content": _DECOMPOSER_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
        )
        return json.loads(resp.choices[0].message.content)

    # ------------------------------------------------------------------ #
    #  Summarise / Refactor (streaming)                                    #
    # ------------------------------------------------------------------ #

    async def summarise_stream(
        self,
        text: str,
        reading_level: str = "standard",   # "simple" | "standard" | "detailed"
    ) -> AsyncIterator[str]:
        user_msg = (
            f"Reading level requested: {reading_level}\n\n"
            f"Text to rewrite:\n{text}"
        )
        stream = await self._client.chat.completions.create(
            model=self._model,
            temperature=0.3,
            stream=True,
            timeout=_TIMEOUT_STREAM,
            messages=[
                {"role": "system", "content": _SUMMARISE_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    # ------------------------------------------------------------------ #
    #  Sentence explanation (hover tooltip)                                #
    # ------------------------------------------------------------------ #

    async def explain_simplification(self, sentence: str) -> dict:
        resp = await self._client.chat.completions.create(
            model=self._model,
            temperature=0.1,
            response_format={"type": "json_object"},
            timeout=_TIMEOUT_DEFAULT,
            messages=[
                {"role": "system", "content": _SIMPLIFY_SENTENCE_SYSTEM},
                {"role": "user", "content": sentence},
            ],
        )
        return json.loads(resp.choices[0].message.content)

    # ------------------------------------------------------------------ #
    #  Contextual nudge                                                    #
    # ------------------------------------------------------------------ #

    async def contextual_nudge(self, task_name: str, elapsed_minutes: int) -> str:
        user_msg = (
            f"Task: \"{task_name}\"\n"
            f"The user has been on this task for {elapsed_minutes} minutes "
            f"(longer than planned)."
        )
        resp = await self._client.chat.completions.create(
            model=self._model,
            temperature=0.5,
            timeout=_TIMEOUT_DEFAULT,
            messages=[
                {"role": "system", "content": _NUDGE_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
        )
        msg = resp.choices[0].message.content.strip()
        # GPT sometimes wraps the response in quotes (imitating example format) — strip them
        if len(msg) >= 2 and msg[0] == '"' and msg[-1] == '"':
            msg = msg[1:-1]
        return msg

    # ------------------------------------------------------------------ #
    #  Companion Chat (streaming)                                          #
    # ------------------------------------------------------------------ #

    async def chat_stream(
        self,
        system_prompt: str,
        messages: list[dict],
    ) -> AsyncIterator[str]:
        """
        Stream tokens for /api/chat. Takes a pre-assembled system_prompt
        (built by ChatService) and the conversation messages list.
        """
        stream = await self._client.chat.completions.create(
            model=self._model,
            temperature=0.7,
            stream=True,
            timeout=_TIMEOUT_STREAM,
            messages=[{"role": "system", "content": system_prompt}] + messages,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    # ------------------------------------------------------------------ #
    #  Document summary (for Block 8 context)                             #
    # ------------------------------------------------------------------ #

    async def summarise_document(self, extracted_text: str) -> str:
        """
        Generate a ~100-word summary of an uploaded document.
        Stored in Cosmos DB so it can be injected into every chat system prompt
        without re-sending the full extracted text each time.
        """
        resp = await self._client.chat.completions.create(
            model=self._model,
            temperature=0.2,
            timeout=_TIMEOUT_DEFAULT,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Summarize this document in 2-3 sentences (under 100 words). "
                        "Mention: what type of document it is, the main topic, and any key "
                        "deadlines or action items if present. Be factual and concise. "
                        "Return only the summary text, no preamble."
                    ),
                },
                {"role": "user", "content": extracted_text[:8_000]},
            ],
        )
        return resp.choices[0].message.content.strip()

    async def close(self) -> None:
        """Release the underlying HTTP connection pool."""
        await self._client.close()
