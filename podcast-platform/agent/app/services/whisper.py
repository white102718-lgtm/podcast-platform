import uuid
import os
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import AsyncSessionLocal
from app.models.models import Recording, Transcript
from app.services import storage


async def transcribe_recording(recording_id: uuid.UUID, openai_api_key: str):
    client = AsyncOpenAI(api_key=openai_api_key)

    async with AsyncSessionLocal() as db:
        recording = await db.get(Recording, recording_id)
        if not recording:
            return

        try:
            # Download from S3 to /tmp
            tmp_path = f"/tmp/podcast-transcribe/{recording_id}.audio"
            os.makedirs(os.path.dirname(tmp_path), exist_ok=True)
            storage.download_file(recording.file_path, tmp_path)

            with open(tmp_path, "rb") as audio_file:
                response = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                )

            os.remove(tmp_path)

            words = [
                {
                    "word": w.word,
                    "start_ms": int(w.start * 1000),
                    "end_ms": int(w.end * 1000),
                    "confidence": getattr(w, "confidence", 1.0),
                }
                for w in (response.words or [])
            ]

            transcript = Transcript(
                recording_id=recording_id,
                full_text=response.text,
                words=words,
                language=response.language,
            )
            db.add(transcript)
            recording.status = "ready"
            await db.commit()

        except Exception as e:
            recording.status = "error"
            await db.commit()
            raise e
