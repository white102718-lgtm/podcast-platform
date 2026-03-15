import uuid
import os
import numpy as np
from pydub import AudioSegment
from app.db.database import AsyncSessionLocal
from app.models.models import Export, EditSession
from app.services import storage

try:
    import noisereduce as nr
    HAS_NOISEREDUCE = True
except ImportError:
    HAS_NOISEREDUCE = False

try:
    import pyloudnorm as pyln
    HAS_PYLOUDNORM = True
except ImportError:
    HAS_PYLOUDNORM = False


def detect_silences(
    file_path: str,
    min_silence_ms: int = 700,
    silence_thresh_db: float = -40.0,
    keep_padding_ms: int = 150,
) -> list[dict]:
    """
    Return a list of silence regions as {start_ms, end_ms} dicts.
    Regions shorter than min_silence_ms are ignored.
    keep_padding_ms is left on each side so cuts don't feel abrupt.
    """
    from pydub.silence import detect_silence

    audio = AudioSegment.from_file(file_path)
    raw = detect_silence(audio, min_silence_len=min_silence_ms, silence_thresh=silence_thresh_db)
    # raw is list of [start_ms, end_ms] inclusive of the full silent span
    result = []
    for start, end in raw:
        cut_start = start + keep_padding_ms
        cut_end = end - keep_padding_ms
        if cut_end > cut_start:
            result.append({"start_ms": cut_start, "end_ms": cut_end})
    return result


def build_keep_segments(duration_ms: int, operations: list) -> list[tuple[int, int]]:
    cuts = []
    for op in operations:
        if op.op_type in ("delete_range", "cut_silence", "remove_filler"):
            cuts.append((op.payload["start_ms"], op.payload["end_ms"]))

    # merge overlapping cuts
    cuts.sort()
    merged = []
    for start, end in cuts:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append([start, end])

    # invert to keep segments
    keep = []
    cursor = 0
    for cut_start, cut_end in merged:
        if cursor < cut_start:
            keep.append((cursor, cut_start))
        cursor = cut_end
    if cursor < duration_ms:
        keep.append((cursor, duration_ms))

    return keep


def splice_audio(file_path: str, keep_segments: list[tuple[int, int]], crossfade_ms: int = 30) -> AudioSegment:
    audio = AudioSegment.from_file(file_path)
    if not keep_segments:
        return AudioSegment.empty()

    segments = [audio[start:end] for start, end in keep_segments]
    result = segments[0]
    for seg in segments[1:]:
        result = result.append(seg, crossfade=crossfade_ms)
    return result


def reduce_noise(audio: AudioSegment) -> AudioSegment:
    if not HAS_NOISEREDUCE:
        return audio
    samples = np.array(audio.get_array_of_samples()).astype(np.float32)
    # use first 500ms as noise profile
    noise_len = audio.frame_rate // 2
    noise_sample = samples[:noise_len] if len(samples) > noise_len else samples
    reduced = nr.reduce_noise(y=samples, sr=audio.frame_rate, y_noise=noise_sample)
    return audio._spawn(reduced.astype(np.int16).tobytes())


def normalize_loudness(audio: AudioSegment, target_lufs: float = -16.0) -> AudioSegment:
    if not HAS_PYLOUDNORM:
        return audio
    meter = pyln.Meter(audio.frame_rate)
    samples = np.array(audio.get_array_of_samples()).astype(np.float64) / 32768.0
    if audio.channels == 2:
        samples = samples.reshape(-1, 2)
    loudness = meter.integrated_loudness(samples)
    if loudness == float("-inf"):
        return audio
    normalized = pyln.normalize.loudness(samples, loudness, target_lufs)
    if audio.channels == 2:
        normalized = normalized.flatten()
    return audio._spawn((normalized * 32768).astype(np.int16).tobytes())


async def run_export_pipeline(export_id: uuid.UUID):
    async with AsyncSessionLocal() as db:
        export = await db.get(Export, export_id)
        if not export:
            return

        try:
            export.status = "processing"
            await db.commit()

            await db.refresh(export, ["edit_session"])
            session: EditSession = export.edit_session
            await db.refresh(session, ["operations", "transcript"])
            await db.refresh(session.transcript, ["recording"])

            recording = session.transcript.recording
            duration_ms = recording.duration_ms or 0
            keep = build_keep_segments(duration_ms, session.operations)

            # Download source audio from S3 to /tmp
            tmp_dir = f"/tmp/podcast-export/{export_id}"
            os.makedirs(tmp_dir, exist_ok=True)
            tmp_input = os.path.join(tmp_dir, "input.audio")
            storage.download_file(recording.file_path, tmp_input)

            audio = splice_audio(tmp_input, keep)
            audio = reduce_noise(audio)
            audio = normalize_loudness(audio)

            tmp_output = os.path.join(tmp_dir, "output.mp3")
            audio.export(tmp_output, format="mp3", bitrate="192k")

            # Upload result to S3
            s3_key = f"exports/{export_id}.mp3"
            storage.upload_file(tmp_output, s3_key, content_type="audio/mpeg")

            # Clean up /tmp
            os.remove(tmp_input)
            os.remove(tmp_output)
            os.rmdir(tmp_dir)

            export.output_path = s3_key
            export.status = "done"
            await db.commit()

        except Exception as e:
            export.status = "error"
            await db.commit()
            raise e
