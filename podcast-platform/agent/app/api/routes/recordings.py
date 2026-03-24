import uuid
import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from botocore.exceptions import ClientError
from app.db.database import get_db
from app.models.models import Recording, Project, Transcript
from app.services.ai_provider import transcribe_recording
from app.services import storage

router = APIRouter(tags=["recordings"])


class RecordingOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    filename: str
    duration_ms: int | None
    status: str
    error_message: str | None = None

    class Config:
        from_attributes = True


class InitiateUploadRequest(BaseModel):
    filename: str
    content_type: str
    file_size: int | None = None
    duration_ms: int | None = None
    sample_rate: int | None = None
    channels: int | None = None


class InitiateUploadResponse(BaseModel):
    recording: RecordingOut
    upload_url: str


class TranscriptOut(BaseModel):
    id: uuid.UUID
    recording_id: uuid.UUID
    full_text: str
    words: list
    language: str | None

    class Config:
        from_attributes = True


@router.post("/projects/{project_id}/recordings/initiate", response_model=InitiateUploadResponse, status_code=201)
async def initiate_upload(
    project_id: uuid.UUID,
    body: InitiateUploadRequest,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB
    if body.file_size is not None and body.file_size > MAX_FILE_SIZE:
        raise HTTPException(413, f"File too large ({body.file_size / 1024 / 1024:.1f}MB). Max 200MB.")

    s3_key = f"recordings/{project_id}/{uuid.uuid4()}/{body.filename}"

    recording = Recording(
        project_id=project_id,
        filename=body.filename,
        file_path=s3_key,
        duration_ms=body.duration_ms,
        sample_rate=body.sample_rate,
        channels=body.channels,
        status="uploading",
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)

    upload_url = storage.generate_presigned_put_url(s3_key, body.content_type)

    return InitiateUploadResponse(recording=RecordingOut.model_validate(recording), upload_url=upload_url)


@router.post("/recordings/{recording_id}/confirm-upload", response_model=RecordingOut)
async def confirm_upload(
    recording_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    recording = await db.get(Recording, recording_id)
    if not recording:
        raise HTTPException(404, "Recording not found")
    if recording.status != "uploading":
        raise HTTPException(409, f"Recording status is '{recording.status}', expected 'uploading'")

    # Verify the object actually landed in S3
    try:
        storage.head_object(recording.file_path)
    except ClientError:
        raise HTTPException(400, "File not found in storage. Upload may have failed.")

    recording.status = "pending"
    await db.commit()
    await db.refresh(recording)
    return recording


@router.get("/recordings/{recording_id}", response_model=RecordingOut)
async def get_recording(recording_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    recording = await db.get(Recording, recording_id)
    if not recording:
        raise HTTPException(404, "Recording not found")
    return recording


@router.post("/recordings/{recording_id}/transcribe", status_code=202)
async def start_transcription(
    recording_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    x_ai_provider: str = Header(..., alias="X-AI-Provider"),
    x_ai_key: str = Header(..., alias="X-AI-Key"),
    db: AsyncSession = Depends(get_db),
):
    recording = await db.get(Recording, recording_id)
    if not recording:
        raise HTTPException(404, "Recording not found")
    if recording.status == "transcribing":
        raise HTTPException(409, "Transcription already in progress")
    if recording.status == "uploading":
        raise HTTPException(409, "Upload still in progress")

    recording.status = "transcribing"
    recording.error_message = None
    await db.commit()

    background_tasks.add_task(transcribe_recording, recording_id, x_ai_provider, x_ai_key)
    return {"message": "Transcription started", "recording_id": recording_id}


@router.get("/recordings/{recording_id}/transcript", response_model=TranscriptOut)
async def get_transcript(recording_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transcript).where(Transcript.recording_id == recording_id)
    )
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(404, "Transcript not ready yet")
    return transcript


@router.get("/recordings/{recording_id}/audio")
async def serve_audio(recording_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    recording = await db.get(Recording, recording_id)
    if not recording:
        raise HTTPException(404, "Recording not found")

    # Return presigned URL redirect
    presigned_url = storage.get_presigned_url(recording.file_path, expires=3600)
    return RedirectResponse(url=presigned_url)


@router.get("/recordings/{recording_id}/silences")
async def detect_silences(
    recording_id: uuid.UUID,
    min_silence_ms: int = 700,
    silence_thresh_db: float = -40.0,
    keep_padding_ms: int = 150,
    db: AsyncSession = Depends(get_db),
):
    recording = await db.get(Recording, recording_id)
    if not recording:
        raise HTTPException(404, "Recording not found")

    # Download from S3 to /tmp for processing
    tmp_path = f"/tmp/podcast-silence/{recording_id}.audio"
    storage.download_file(recording.file_path, tmp_path)

    from app.services.audio_pipeline import detect_silences as _detect
    silences = _detect(
        tmp_path,
        min_silence_ms=min_silence_ms,
        silence_thresh_db=silence_thresh_db,
        keep_padding_ms=keep_padding_ms,
    )

    os.remove(tmp_path)
    return {"silences": silences, "count": len(silences)}


@router.post("/projects/{project_id}/recordings/upload", response_model=RecordingOut, status_code=201)
async def proxy_upload(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    duration_ms: int | None = Form(None),
    sample_rate: int | None = Form(None),
    channels: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload audio through the backend (avoids R2 CORS issues)."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    MAX_FILE_SIZE = 200 * 1024 * 1024
    content_type = file.content_type or "audio/mpeg"
    s3_key = f"recordings/{project_id}/{uuid.uuid4()}/{file.filename}"

    # Stream to a temp file, then upload to S3
    tmp_dir = f"/tmp/podcast-upload/{uuid.uuid4()}"
    os.makedirs(tmp_dir, exist_ok=True)
    tmp_path = os.path.join(tmp_dir, file.filename or "upload.audio")

    try:
        size = 0
        with open(tmp_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(413, f"File too large (>{MAX_FILE_SIZE // 1024 // 1024}MB)")
                f.write(chunk)

        storage.upload_file(tmp_path, s3_key, content_type=content_type)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        if os.path.exists(tmp_dir):
            os.rmdir(tmp_dir)

    recording = Recording(
        project_id=project_id,
        filename=file.filename or "upload.audio",
        file_path=s3_key,
        duration_ms=duration_ms,
        sample_rate=sample_rate,
        channels=channels,
        status="pending",
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)
    return recording
