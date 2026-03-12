from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


# ── Preferences ──────────────────────────────────────────────────────────── #

class UserPreferences(BaseModel):
    reading_level: Literal["simple", "standard", "detailed"] = "standard"
    font_choice: Literal["default", "opendyslexic", "atkinson"] = "default"
    bionic_reading: bool = False
    line_height: float = Field(default=1.6, ge=1.0, le=3.0)
    letter_spacing: float = Field(default=0.0, ge=0.0, le=10.0)
    timer_length_minutes: int = Field(default=25, ge=5, le=60)
    focus_mode: bool = False
    granularity: Literal["micro", "normal", "broad"] = "normal"
    color_theme: Literal["calm", "dark", "high-contrast"] = "calm"


# ── Task Decomposer ──────────────────────────────────────────────────────── #

class DecomposeRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=500)
    granularity: Literal["micro", "normal", "broad"] = "normal"
    context: str = Field(default="", max_length=500)


class TaskStep(BaseModel):
    task_name: str
    duration_minutes: int
    motivation_nudge: str


class DecomposeResponse(BaseModel):
    steps: list[TaskStep]


# ── Summarise ────────────────────────────────────────────────────────────── #

class SummariseRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=100_000)
    reading_level: Literal["simple", "standard", "detailed"] = "standard"


# ── Sentence explanation ──────────────────────────────────────────────────── #

class ExplainRequest(BaseModel):
    sentence: str = Field(..., min_length=3, max_length=1000)


class ExplainResponse(BaseModel):
    reason: str
    simplified: str


# ── Nudge ────────────────────────────────────────────────────────────────── #

class NudgeRequest(BaseModel):
    task_name: str
    elapsed_minutes: int = Field(..., ge=0)


class NudgeResponse(BaseModel):
    message: str


# ── Sessions ─────────────────────────────────────────────────────────────── #

class SessionCreate(BaseModel):
    goal: str
    steps: list[TaskStep]


class SessionItem(BaseModel):
    id: str
    goal: str
    steps: list[TaskStep]
    created_at: str
