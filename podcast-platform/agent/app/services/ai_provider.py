"""
Unified AI provider abstraction.

Supports: openai, anthropic, deepseek, gemini, qwen
All providers share a single API key and are used for both
transcription (speech-to-text) and text generation (show notes, marketing copy).

When base_url is provided (proxy mode), it overrides the default endpoint
for all providers. This enables compatibility with third-party proxy services
like one-api, new-api, etc.
"""

import uuid
import os
import base64
import logging
import httpx
from app.db.database import AsyncSessionLocal
from app.models.models import Recording, Transcript
from app.services import storage

logger = logging.getLogger(__name__)

PROVIDERS = ("openai", "anthropic", "deepseek", "gemini", "qwen")

# Default base URLs per provider (used when no custom base_url is set)
DEFAULT_BASE_URLS = {
    "openai": None,  # OpenAI SDK default
    "anthropic": None,  # Anthropic SDK default
    "deepseek": "https://api.deepseek.com",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
}

DEFAULT_MODELS = {
    "openai": "gpt-4o",
    "anthropic": "claude-sonnet-4-20250514",
    "deepseek": "deepseek-chat",
    "gemini": "gemini-2.0-flash",
    "qwen": "qwen-plus",
}


def _resolve_base_url(provider: str, custom_base_url: str | None) -> str | None:
    """Return the base URL to use: custom if provided, otherwise provider default."""
    if custom_base_url:
        return custom_base_url
    return DEFAULT_BASE_URLS.get(provider)


# --- Chat completion (unified) ---

async def chat_completion(provider: str, api_key: str, prompt: str, base_url: str | None = None) -> str:
    """Send a single-turn prompt and return the assistant text."""
    if provider == "anthropic" and not base_url:
        return await _anthropic_chat(api_key, prompt, base_url)
    # All other providers (including anthropic with proxy) use OpenAI-compatible API
    return await _openai_compatible_chat(provider, api_key, prompt, base_url)


async def _openai_compatible_chat(provider: str, api_key: str, prompt: str, base_url: str | None = None) -> str:
    from openai import AsyncOpenAI
    resolved_url = _resolve_base_url(provider, base_url)
    client = AsyncOpenAI(api_key=api_key, base_url=resolved_url)
    resp = await client.chat.completions.create(
        model=DEFAULT_MODELS[provider],
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
    )
    return resp.choices[0].message.content


async def _anthropic_chat(api_key: str, prompt: str, base_url: str | None = None) -> str:
    from anthropic import AsyncAnthropic
    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    client = AsyncAnthropic(**kwargs)
    resp = await client.messages.create(
        model=DEFAULT_MODELS["anthropic"],
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


# --- Transcription (speech-to-text) ---

async def transcribe_recording(recording_id: uuid.UUID, provider: str, api_key: str, base_url: str | None = None):
    """Download audio from S3, transcribe via the chosen provider, save Transcript."""
    async with AsyncSessionLocal() as db:
        recording = await db.get(Recording, recording_id)
        if not recording:
            return

        try:
            # Download from S3 to /tmp
            tmp_path = f"/tmp/podcast-transcribe/{recording_id}.audio"
            os.makedirs(os.path.dirname(tmp_path), exist_ok=True)
            storage.download_file(recording.file_path, tmp_path)

            if provider == "openai":
                text, words, language = await _openai_transcribe(api_key, tmp_path, base_url)
            elif provider == "gemini":
                text, words, language = await _gemini_transcribe(api_key, tmp_path, base_url)
            else:
                text, words, language = await _generic_transcribe(provider, api_key, tmp_path, base_url)

            transcript = Transcript(
                recording_id=recording_id,
                full_text=text,
                words=words,
                language=language,
            )
            db.add(transcript)
            recording.status = "ready"
            await db.commit()

        except Exception as e:
            error_msg = str(e)
            logger.error("Transcription failed for recording %s (provider=%s): %s", recording_id, provider, error_msg, exc_info=True)
            recording.status = "error"
            recording.error_message = error_msg[:2000]
            await db.commit()
        finally:
            tmp_path = f"/tmp/podcast-transcribe/{recording_id}.audio"
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


async def _openai_transcribe(api_key: str, file_path: str, base_url: str | None = None):
    """Native OpenAI Whisper with word-level timestamps."""
    from openai import AsyncOpenAI
    resolved_url = _resolve_base_url("openai", base_url)
    client = AsyncOpenAI(api_key=api_key, base_url=resolved_url)

    with open(file_path, "rb") as f:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

    words = [
        {
            "word": w.word,
            "start_ms": int(w.start * 1000),
            "end_ms": int(w.end * 1000),
            "confidence": getattr(w, "confidence", 1.0),
        }
        for w in (response.words or [])
    ]
    return response.text, words, response.language


async def _gemini_transcribe(api_key: str, file_path: str, base_url: str | None = None):
    """Use Gemini's audio understanding to transcribe with timestamps."""
    import mimetypes
    mime_type = mimetypes.guess_type(file_path)[0] or "audio/mpeg"

    with open(file_path, "rb") as f:
        audio_data = base64.b64encode(f.read()).decode()

    prompt = (
        "Transcribe this audio precisely. Return a JSON object with:\n"
        '- "text": the full transcript text\n'
        '- "language": detected language code (e.g. "en", "zh")\n'
        '- "words": array of {"word": string, "start_ms": number, "end_ms": number}\n'
        "Estimate word timestamps as accurately as possible. Return ONLY valid JSON, no markdown."
    )

    from openai import AsyncOpenAI
    resolved_url = _resolve_base_url("gemini", base_url)
    client = AsyncOpenAI(api_key=api_key, base_url=resolved_url)
    resp = await client.chat.completions.create(
        model="gemini-2.0-flash",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{audio_data}"}},
            ],
        }],
    )

    import json
    raw = resp.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    data = json.loads(raw)

    words = [
        {"word": w["word"], "start_ms": w.get("start_ms", 0), "end_ms": w.get("end_ms", 0), "confidence": 0.8}
        for w in data.get("words", [])
    ]
    return data.get("text", ""), words, data.get("language", "unknown")


async def _generic_transcribe(provider: str, api_key: str, file_path: str, base_url: str | None = None):
    """
    For providers without native STT (DeepSeek, Anthropic, Qwen):
    Read audio, convert to base64, ask the LLM to transcribe.
    Falls back to text-only transcription (no word timestamps).
    """
    import mimetypes
    mime_type = mimetypes.guess_type(file_path)[0] or "audio/mpeg"

    file_size = os.path.getsize(file_path)
    if file_size > 20 * 1024 * 1024:
        raise ValueError(
            f"Audio file too large ({file_size / 1024 / 1024:.1f}MB) for {provider} chat-based transcription. "
            "Consider using OpenAI or Gemini for large files."
        )

    with open(file_path, "rb") as f:
        audio_bytes = f.read()

    if provider == "anthropic":
        return await _anthropic_transcribe(api_key, audio_bytes, mime_type, base_url)

    raise ValueError(
        f"{provider} does not support speech-to-text. "
        "Please use OpenAI, Anthropic, or Gemini for transcription, "
        "or switch to one of these providers."
    )


async def _anthropic_transcribe(api_key: str, audio_bytes: bytes, mime_type: str, base_url: str | None = None):
    """Use Anthropic's audio input capability for transcription."""
    from anthropic import AsyncAnthropic

    audio_b64 = base64.b64encode(audio_bytes).decode()

    media_type_map = {
        "audio/mpeg": "audio/mpeg",
        "audio/mp3": "audio/mpeg",
        "audio/wav": "audio/wav",
        "audio/x-wav": "audio/wav",
        "audio/mp4": "audio/mp4",
        "audio/m4a": "audio/mp4",
        "audio/webm": "audio/webm",
    }
    media_type = media_type_map.get(mime_type, "audio/mpeg")

    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    client = AsyncAnthropic(**kwargs)

    prompt = (
        "Transcribe this audio precisely. Return a JSON object with:\n"
        '- "text": the full transcript text\n'
        '- "language": detected language code (e.g. "en", "zh")\n'
        '- "words": array of {"word": string, "start_ms": number, "end_ms": number}\n'
        "Estimate word timestamps as accurately as possible. Return ONLY valid JSON, no markdown."
    )

    resp = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": prompt,
                },
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": audio_b64,
                    },
                },
            ],
        }],
    )

    import json
    raw = resp.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    data = json.loads(raw)

    words = [
        {"word": w["word"], "start_ms": w.get("start_ms", 0), "end_ms": w.get("end_ms", 0), "confidence": 0.7}
        for w in data.get("words", [])
    ]
    return data.get("text", ""), words, data.get("language", "unknown")
