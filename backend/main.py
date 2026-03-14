"""
NeuroFocus — FastAPI backend
Azure OpenAI + Azure Cosmos DB (NoSQL)
"""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from ai_service import AIService
from blob_service import BlobService
from config import Settings, get_settings
from content_safety import ContentSafetyFlagged, ContentSafetyService
from db import CosmosRepo
from doc_intelligence import MAX_FILE_BYTES, DocIntelligenceService, SUPPORTED_TYPES
from monitoring import configure_monitoring, track_event
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
    UploadResponse,
    UserPreferences,
)


logger = logging.getLogger(__name__)


async def get_user_id(x_user_id: str = Header(default="default-user")) -> str:
    return x_user_id


# ── App factory ──────────────────────────────────────────────────────────── #

def make_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or get_settings()

    # Must run before FastAPI() so the OTel SDK instruments the app from the start
    configure_monitoring(cfg.app_insights_connection_string)

    repo = CosmosRepo(cfg)
    ai = AIService(cfg)
    safety = ContentSafetyService(cfg.content_safety_endpoint, cfg.content_safety_key)
    blob = BlobService(cfg.blob_connection_string, cfg.blob_container_name)
    doc_intel = DocIntelligenceService(cfg.doc_intelligence_endpoint, cfg.doc_intelligence_key)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await repo._ensure_containers()
        await blob.ensure_container()   # create blob container once at startup
        yield
        await ai.close()
        await repo.close()
        await safety.close()
        await blob.close()
        await doc_intel.close()

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

    # ── Content Safety exception handler ─────────────────────────────────── #
    # 200 status intentional — error codes feel alarming in accessibility apps.
    # Frontend checks for {"flagged": true} and uses "category" to show
    # context-appropriate UI (icon, colour, guidance) per flag type.

    @app.exception_handler(ContentSafetyFlagged)
    async def content_safety_handler(request: Request, exc: ContentSafetyFlagged):
        track_event("content_safety_flagged", {
            "category": exc.category,
            "path": request.url.path,
        })
        return JSONResponse(
            status_code=200,
            content={
                "flagged": True,
                "category": exc.category,
                "message": exc.message,
            },
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
        await safety.screen_user_intent(req.goal)
        if req.context:
            await safety.screen_user_intent(req.context)

        try:
            result = await ai.decompose(
                goal=req.goal,
                granularity=req.granularity,
                context=req.context,
            )
            steps = [TaskStep(**s) for s in result.get("steps", [])]
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="We ran into a small hiccup — please try again in a moment.",
            ) from exc

        output_text = " ".join(
            f"{s.task_name} {s.motivation_nudge}" for s in steps
        )
        await safety.screen_output(output_text)

        track_event("task_decomposed", {
            "granularity": req.granularity,
            "step_count": len(steps),
            "user_id": user_id,
        })
        return DecomposeResponse(steps=steps)

    # ── Summarise (streaming SSE) ────────────────────────────────────────── #

    @app.post("/api/summarise", tags=["ai"])
    async def summarise(
        req: SummariseRequest,
        user_id: str = Depends(get_user_id),
    ):
        # Screen as document (not user intent) — paste text may be a contract,
        # article, or textbook and will naturally contain imperative language.
        # Flagged input raises ContentSafetyFlagged before the stream opens,
        # returning a calm 200 JSON response instead of an SSE stream.
        await safety.screen_document(req.text)

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
        await safety.screen_user_intent(req.sentence)

        try:
            result = await ai.explain_simplification(req.sentence)
            response = ExplainResponse(**result)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Could not generate explanation.") from exc

        await safety.screen_output(f"{response.reason} {response.simplified}")
        return response

    # ── Contextual nudge ─────────────────────────────────────────────────── #

    @app.post("/api/nudge", response_model=NudgeResponse, tags=["ai"])
    async def nudge(
        req: NudgeRequest,
        user_id: str = Depends(get_user_id),
    ):
        await safety.screen_user_intent(req.task_name)

        try:
            msg = await ai.contextual_nudge(req.task_name, req.elapsed_minutes)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Could not generate nudge.") from exc

        await safety.screen_output(msg)
        return NudgeResponse(message=msg)

    # ── Document Upload ──────────────────────────────────────────────────── #

    @app.post("/api/upload", response_model=UploadResponse, tags=["documents"])
    async def upload_document(
        request: Request,
        file: UploadFile = File(...),
        user_id: str = Depends(get_user_id),
    ):
        # Pre-check Content-Length header before reading into memory.
        # This is a first gate — the real size check happens after read
        # since the header is client-controlled and not guaranteed.
        content_length = request.headers.get("content-length")
        try:
            cl = int(content_length) if content_length else 0
        except ValueError:
            cl = 0
        if cl > MAX_FILE_BYTES:
            return JSONResponse(
                status_code=200,
                content={
                    "flagged": True,
                    "category": "document_error",
                    "message": (
                        "That file is too large (max 20 MB). "
                        "Try splitting it into smaller sections."
                    ),
                },
            )

        # Validate content type header before reading bytes
        if file.content_type not in SUPPORTED_TYPES:
            return JSONResponse(
                status_code=200,
                content={
                    "flagged": True,
                    "category": "unsupported_file_type",
                    "message": (
                        "We support PDF, Word (.docx), and image files (PNG, JPG, TIFF). "
                        "Could you try converting your document to one of those formats?"
                    ),
                },
            )

        file_bytes = await file.read()

        # Extract text — includes size check, magic byte verification, and
        # empty-text detection. ValueError = calm user error, RuntimeError = 503.
        try:
            extracted_text, page_count = await doc_intel.extract_text(
                file_bytes, file.content_type
            )
        except ValueError as exc:
            return JSONResponse(
                status_code=200,
                content={
                    "flagged": True,
                    "category": "document_error",
                    "message": str(exc),
                },
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        # Screen extracted text as a document (not user intent)
        await safety.screen_document(extracted_text)

        # Upload to Blob Storage for archival — best-effort, never blocks response
        blob_name: str | None = None
        if blob.available:
            try:
                blob_name = await blob.upload(
                    file_bytes,
                    file.filename or "document",
                    file.content_type,
                    user_id=user_id,
                )
            except Exception as exc:
                logger.warning(
                    "upload.blob_skipped",
                    extra={"event": "blob_upload_failed", "error": str(exc)},
                )

        track_event("document_uploaded", {
            "page_count": page_count,
            "content_type": file.content_type,
            "blob_stored": blob_name is not None,
            "user_id": user_id,
        })
        return UploadResponse(
            extracted_text=extracted_text,
            page_count=page_count,
            filename=file.filename or "document",
            blob_name=blob_name,
        )

    # ── Sessions ─────────────────────────────────────────────────────────── #

    @app.post("/api/sessions", response_model=SessionItem, tags=["sessions"])
    async def create_session(
        body: SessionCreate,
        user_id: str = Depends(get_user_id),
    ):
        doc = await repo.create_session(user_id, body.model_dump())
        track_event("session_created", {
            "step_count": len(body.steps),
            "user_id": user_id,
        })
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
