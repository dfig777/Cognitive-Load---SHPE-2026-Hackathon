"""
NeuroFocus — FastAPI backend
Azure OpenAI + Azure Cosmos DB (NoSQL) + Azure AD
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from ai_service import AIService
from auth import get_user_id
from config import Settings, get_settings
from db import CosmosRepo
from models import (
    DecomposeRequest,
    DecomposeResponse,
    ExplainRequest,
    ExplainResponse,
    NudgeRequest,
    NudgeResponse,
    SessionCreate,
    SessionItem,
    SummariseRequest,
    TaskStep,
    UserPreferences,
)


# ── App factory ──────────────────────────────────────────────────────────── #

def make_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or get_settings()
    repo = CosmosRepo(cfg)
    ai = AIService(cfg)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await repo._ensure_containers()
        yield
        await repo.close()

    app = FastAPI(
        title="NeuroFocus API",
        description="Neuro-inclusive AI assistant — Azure OpenAI + Cosmos DB",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Health ──────────────────────────────────────────────────────────── #

    @app.get("/health", tags=["meta"])
    async def health():
        return {"status": "ok", "service": "neurofocus"}

    # ── Preferences ─────────────────────────────────────────────────────── #

    @app.get("/api/preferences", response_model=UserPreferences, tags=["preferences"])
    async def get_preferences(user_id: str = Depends(get_user_id)):
        doc = await repo.get_preferences(user_id)
        if doc is None:
            return UserPreferences()          # sensible defaults on first login
        # Strip Cosmos system fields before returning
        clean = {k: v for k, v in doc.items() if not k.startswith("_") and k not in ("id", "user_id", "updated_at")}
        return UserPreferences(**clean)

    @app.put("/api/preferences", response_model=UserPreferences, tags=["preferences"])
    async def update_preferences(
        prefs: UserPreferences,
        user_id: str = Depends(get_user_id),
    ):
        await repo.upsert_preferences(user_id, prefs.model_dump())
        return prefs

    # ── Task Decomposer ──────────────────────────────────────────────────── #

    @app.post("/api/decompose", response_model=DecomposeResponse, tags=["ai"])
    async def decompose(
        req: DecomposeRequest,
        user_id: str = Depends(get_user_id),
    ):
        try:
            result = await ai.decompose(
                goal=req.goal,
                granularity=req.granularity,
                context=req.context,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="We ran into a small hiccup — please try again in a moment.",
            ) from exc

        steps = [TaskStep(**s) for s in result.get("steps", [])]
        return DecomposeResponse(steps=steps)

    # ── Summarise (streaming SSE) ────────────────────────────────────────── #

    @app.post("/api/summarise", tags=["ai"])
    async def summarise(
        req: SummariseRequest,
        user_id: str = Depends(get_user_id),
    ):
        async def event_stream():
            try:
                async for chunk in ai.summarise_stream(req.text, req.reading_level):
                    # Server-Sent Events format
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            except Exception:
                yield f"data: {json.dumps({'error': 'Something went quiet — please try again.'})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ── Sentence explanation ─────────────────────────────────────────────── #

    @app.post("/api/explain", response_model=ExplainResponse, tags=["ai"])
    async def explain(
        req: ExplainRequest,
        user_id: str = Depends(get_user_id),
    ):
        try:
            result = await ai.explain_simplification(req.sentence)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Could not generate explanation.") from exc
        return ExplainResponse(**result)

    # ── Contextual nudge ─────────────────────────────────────────────────── #

    @app.post("/api/nudge", response_model=NudgeResponse, tags=["ai"])
    async def nudge(
        req: NudgeRequest,
        user_id: str = Depends(get_user_id),
    ):
        try:
            msg = await ai.contextual_nudge(req.task_name, req.elapsed_minutes)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Could not generate nudge.") from exc
        return NudgeResponse(message=msg)

    # ── Sessions ─────────────────────────────────────────────────────────── #

    @app.post("/api/sessions", response_model=SessionItem, tags=["sessions"])
    async def create_session(
        body: SessionCreate,
        user_id: str = Depends(get_user_id),
    ):
        doc = await repo.create_session(user_id, body.model_dump())
        return SessionItem(
            id=doc["id"],
            goal=doc["goal"],
            steps=[TaskStep(**s) for s in doc["steps"]],
            created_at=doc["created_at"],
        )

    @app.get("/api/sessions", response_model=list[SessionItem], tags=["sessions"])
    async def list_sessions(user_id: str = Depends(get_user_id)):
        docs = await repo.list_sessions(user_id)
        return [
            SessionItem(
                id=d["id"],
                goal=d["goal"],
                steps=[TaskStep(**s) for s in d["steps"]],
                created_at=d["created_at"],
            )
            for d in docs
        ]

    return app


app = make_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
