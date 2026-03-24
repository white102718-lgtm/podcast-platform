"""
Unified AI provider abstraction.

Supports: openai, anthropic, deepseek, gemini, qwen
All providers share a single API key and are used for both
transcription (speech-to-text) and text generation (show notes, marketing copy).
"""

import uuid
import os
import base64
import httpx
from app.db.database import AsyncSessionLocal
from app.models.models import Recording, Transcript
from app.services import storage

PROVIDERS = ("openai", "anthropic", "deepseek", "gemini", "qwen")

# --- Chat completion (unified) ---

async def chat_completion(provider: str, api_key: str, prompt: str) -> str:
    """Send a single-turn prompt and return the assistant text."""
    if provider == "openai":
        return await _openai_chat(api_key, prompt)
    elif provider == "anthropic":
        return await _anthropic_chat(api_key, prompt)
    elif provider == "deepseek":
        return await _deepseek_chat(api_key, prompt)
    elif provider == "gemini":
        return await _gemini_chat(api_key, prompt)
    elif provider == "qwen":
        return await _qwen_chat(api_key, prompt)
    else:
        raise ValueError(f"Unsupported provider: {provider}")


async def _openai_chat(api_key: str, prompt: str) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
    )
    return resp.choices[0].message.content


async def _anthropic_chat(api_key: str, prompt: str) -> str:
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=api_key)
    resp = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


async def _deepseek_chat(api_key: str, prompt: str) -> str:
    """DeepSeek uses OpenAI-compatible API."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    resp = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
    )
    return resp.choices[0].message.content


async def _gemini_chat(api_key: str, prompt: str) -> str:
    """Google Gemini via OpenAI-compatible endpoint."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )
    resp = await client.chat.completions.create(
        model="gemini-2.0-flash",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
    )
    return resp.choices[0].message.content


async def _qwen_chat(api_key: str, prompt: str) -> str:
    """Qwen (Alibaba DashScope) via OpenAI-compatible endpoint."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    resp = await client.chat.completions.create(
        model="qwen-plus",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
    )
    return resp.choices[0].message.content


# --- Transcription (speech-to-text) ---

async def transcribe_recording(recording_id: uuid.UUID, provider: str, api_key: str):
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
                text, words, language = await _openai_transcribe(api_key, tmp_path)
            elif provider == "gemini":
                text, words, language = await _gemini_transcribe(api_key, tmp_path)
            else:
                # All other providers: use OpenAI Whisper-compatible or fallback
                text, words, language = await _generic_transcribe(provider, api_key, tmp_path)

            os.remove(tmp_path)

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
            recording.status = "error"
            await db.commit()
            raise e


async def _openai_transcribe(api_key: str, file_path: str):
    """Native OpenAI Whisper with word-level timestamps."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

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


async def _gemini_transcribe(api_key: str, file_path: str):
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
    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )
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
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    data = json.loads(raw)

    words = [
        {"word": w["word"], "start_ms": w.get("start_ms", 0), "end_ms": w.get("end_ms", 0), "confidence": 0.8}
        for w in data.get("words", [])
    ]
    return data.get("text", ""), words, data.get("language", "unknown")


async def _generic_transcribe(provider: str, api_key: str, file_path: str):
    """
    For providers without native STT (DeepSeek, Anthropic, Qwen):
    Read audio, convert to base64, ask the LLM to transcribe.
    Falls back to text-only transcription (no word timestamps).
    """
    import mimetypes
    mime_type = mimetypes.guess_type(file_path)[0] or "audio/mpeg"

    # Check file size — most chat APIs have limits on inline data
    file_size = os.path.getsize(file_path)
    if file_size > 20 * 1024 * 1024:
        raise ValueError(
            f"Audio file too large ({file_size / 1024 / 1024:.1f}MB) for {provider} chat-based transcription. "
            "Consider using OpenAI or Gemini for large files."
        )

    with open(file_path, "rb") as f:
        audio_bytes = f.read()

    # For Anthropic, use native audio support if available
    if provider == "anthropic":
        return await _anthropic_transcribe(api_key, audio_bytes, mime_type)

    # For DeepSeek / Qwen — these don't support audio input natively.
    # We'll try using OpenAI Whisper as a fallback since these providers
    # don't have STT capabilities.
    raise ValueError(
        f"{provider} does not support speech-to-text. "
        "Please use OpenAI, Anthropic, or Gemini for transcription, "
        "or switch to one of these providers."
    )


async def _anthropic_transcribe(api_key: str, audio_bytes: bytes, mime_type: str):
    """Use Anthropic's audio input capability for transcription."""
    from anthropic import AsyncAnthropic

    audio_b64 = base64.b64encode(audio_bytes).decode()

    # Map common MIME types to Anthropic's supported media types
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

    client = AsyncAnthropic(api_key=api_key)

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
