import uuid
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.models.models import EditSession
from app.services.ai_provider import chat_completion

router = APIRouter(tags=["content"])


@router.post("/edit-sessions/{session_id}/show-notes")
async def generate_show_notes(
    session_id: uuid.UUID,
    x_ai_provider: str = Header(..., alias="X-AI-Provider"),
    x_ai_key: str = Header(..., alias="X-AI-Key"),
    x_ai_base_url: str | None = Header(None, alias="X-AI-Base-URL"),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    prompt = (
        "Based on the following podcast transcript, generate structured show notes including: "
        "1) A 2-3 sentence summary, 2) Key topics covered, "
        "3) Notable quotes, 4) Resources mentioned.\n\n"
        f"Transcript:\n{session.edited_text}"
    )
    text = await chat_completion(x_ai_provider, x_ai_key, prompt, x_ai_base_url)
    return {"show_notes": text}


@router.post("/edit-sessions/{session_id}/marketing-copy")
async def generate_marketing_copy(
    session_id: uuid.UUID,
    x_ai_provider: str = Header(..., alias="X-AI-Provider"),
    x_ai_key: str = Header(..., alias="X-AI-Key"),
    x_ai_base_url: str | None = Header(None, alias="X-AI-Base-URL"),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    prompt = (
        "Based on the following podcast transcript, generate marketing copy for three platforms:\n"
        "1) 小红书: engaging, emoji-rich, lifestyle tone, ~150 chars\n"
        "2) 微博: punchy, shareable, ~140 chars\n"
        "3) 公众号: professional, detailed intro paragraph\n\n"
        f"Transcript:\n{session.edited_text}"
    )
    text = await chat_completion(x_ai_provider, x_ai_key, prompt, x_ai_base_url)
    return {"marketing_copy": text}
