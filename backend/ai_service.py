"""
Azure OpenAI service — wraps the openai async client.
All prompts are engineered for neuro-inclusive, calm, factual output.
"""
from __future__ import annotations

import json
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
- Each step MUST have:
    task_name        : string  — short, action-verb phrase
    duration_minutes : integer — realistic estimate
    motivation_nudge : string  — one gentle, encouraging sentence (no exclamation marks)
- Schema: { "steps": [ { "task_name": "...", "duration_minutes": N, "motivation_nudge": "..." } ] }
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
You are a gentle productivity coach. A user has been on the same task longer than expected.
Write ONE short, supportive, non-pressuring message (≤ 20 words) to check in.
Do NOT use exclamation marks. Return only the message string, no JSON.
""".strip()


class AIService:
    def __init__(self, settings: Settings):
        self._client = AsyncAzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
        )
        self._model = settings.azure_openai_deployment_gpt4o

    # ------------------------------------------------------------------ #
    #  Task Decomposer                                                     #
    # ------------------------------------------------------------------ #

    async def decompose(
        self,
        goal: str,
        granularity: str = "normal",   # "micro" | "normal" | "broad"
        context: str = "",
    ) -> dict:
        user_msg = f"Goal: {goal}"
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
        return resp.choices[0].message.content.strip()

    async def close(self) -> None:
        """Release the underlying HTTP connection pool."""
        await self._client.close()
