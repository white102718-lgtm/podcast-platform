import uuid
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Header
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import Recording, Project, Transcript
from app.services.whisper import transcribe_recording
from app.services import storage

router = APIRouter(tags=["recordings"])


class RecordingOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    filename: str
    duration_ms: int | None
    status: str

    class Config:
        from_attributes = True


class TranscriptOut(BaseModel):
    id: uuid.UUID
    recording_id: uuid.UUID
    full_text: str
    words: list
    language: str | None

    class Config:
        from_attributes = True


@router.post("/projects/{project_id}/recordings", response_model=RecordingOut, status_code=201)
async def upload_recording(
    project_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Save to /tmp first, then upload to S3
    tmp_dir = f"/tmp/podcast-uploads/{project_id}"
    os.makedirs(tmp_dir, exist_ok=True)
    tmp_path = os.path.join(tmp_dir, file.filename)

    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Detect duration, sample rate, channels
    duration_ms = None
    sample_rate = None
    channels = None
    try:
        from pydub import AudioSegment as _AS
        audio = _AS.from_file(tmp_path)
        duration_ms = len(audio)
        sample_rate = audio.frame_rate
        channels = audio.channels
    except Exception:
        pass

    # Upload to S3
    s3_key = f"recordings/{project_id}/{uuid.uuid4()}/{file.filename}"
    storage.upload_file(tmp_path, s3_key, content_type=file.content_type or "audio/mpeg")
    os.remove(tmp_path)

    recording = Recording(
        project_id=project_id,
        filename=file.filename,
        file_path=s3_key,  # Store S3 key instead of local path
        duration_ms=duration_ms,
        sample_rate=sample_rate,
        channels=channels,
        status="pending",
    )
    db.add(recording)
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
    x_openai_key: str = Header(..., alias="X-OpenAI-Key"),
    db: AsyncSession = Depends(get_db),
):
    recording = await db.get(Recording, recording_id)
    if not recording:
        raise HTTPException(404, "Recording not found")
    if recording.status == "transcribing":
        raise HTTPException(409, "Transcription already in progress")

    recording.status = "transcribing"
    await db.commit()

    background_tasks.add_task(transcribe_recording, recording_id, x_openai_key)
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
