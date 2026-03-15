import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import EditSession, EditOperation, Transcript, Export
from app.services.audio_pipeline import run_export_pipeline
from app.services import storage

router = APIRouter(tags=["editing"])


class SessionOut(BaseModel):
    id: uuid.UUID
    transcript_id: uuid.UUID
    edited_text: str

    class Config:
        from_attributes = True


class OperationOut(BaseModel):
    id: uuid.UUID
    op_type: str
    payload: dict
    applied_order: int

    class Config:
        from_attributes = True


class SessionDetail(SessionOut):
    operations: list[OperationOut]


class TextPatch(BaseModel):
    edited_text: str


class OperationCreate(BaseModel):
    op_type: str
    payload: dict


class ExportOut(BaseModel):
    id: uuid.UUID
    status: str
    output_path: str | None
    loudness_lufs: float | None

    class Config:
        from_attributes = True


@router.post("/transcripts/{transcript_id}/sessions", response_model=SessionOut, status_code=201)
async def create_session(transcript_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    transcript = await db.get(Transcript, transcript_id)
    if not transcript:
        raise HTTPException(404, "Transcript not found")
    session = EditSession(transcript_id=transcript_id, edited_text=transcript.full_text)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/edit-sessions/{session_id}", response_model=SessionDetail)
async def get_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    await db.refresh(session, ["operations"])
    return session


@router.patch("/edit-sessions/{session_id}/text", response_model=SessionOut)
async def save_text(session_id: uuid.UUID, body: TextPatch, db: AsyncSession = Depends(get_db)):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.edited_text = body.edited_text
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/edit-sessions/{session_id}/operations", response_model=OperationOut, status_code=201)
async def add_operation(session_id: uuid.UUID, body: OperationCreate, db: AsyncSession = Depends(get_db)):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    result = await db.execute(
        select(func.coalesce(func.max(EditOperation.applied_order), 0))
        .where(EditOperation.edit_session_id == session_id)
    )
    max_order = result.scalar()

    op = EditOperation(
        edit_session_id=session_id,
        op_type=body.op_type,
        payload=body.payload,
        applied_order=max_order + 1,
    )
    db.add(op)
    await db.commit()
    await db.refresh(op)
    return op


@router.delete("/edit-sessions/{session_id}/operations/{op_id}", status_code=204)
async def delete_operation(session_id: uuid.UUID, op_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    op = await db.get(EditOperation, op_id)
    if not op or op.edit_session_id != session_id:
        raise HTTPException(404, "Operation not found")
    await db.delete(op)
    await db.commit()


@router.get("/edit-sessions/{session_id}/preview")
async def preview_cuts(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    await db.refresh(session, ["operations", "transcript"])
    await db.refresh(session.transcript, ["recording"])

    duration_ms = session.transcript.recording.duration_ms or 0
    from app.services.audio_pipeline import build_keep_segments
    keep = build_keep_segments(duration_ms, session.operations)
    return {"keep_segments": keep, "total_duration_ms": sum(e - s for s, e in keep)}


@router.post("/edit-sessions/{session_id}/export", response_model=ExportOut, status_code=202)
async def start_export(
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    export = Export(edit_session_id=session_id, status="pending")
    db.add(export)
    await db.commit()
    await db.refresh(export)

    background_tasks.add_task(run_export_pipeline, export.id)
    return export


@router.get("/exports/{export_id}", response_model=ExportOut)
async def get_export(export_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    export = await db.get(Export, export_id)
    if not export:
        raise HTTPException(404, "Export not found")
    return export


@router.get("/exports/{export_id}/download")
async def download_export(export_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    export = await db.get(Export, export_id)
    if not export or export.status != "done":
        raise HTTPException(404, "Export not ready")

    # Return presigned URL redirect
    presigned_url = storage.get_presigned_url(export.output_path, expires=3600)
    return RedirectResponse(url=presigned_url)
