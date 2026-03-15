import uuid
from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, Header
from app.db.database import get_db
from app.models.models import EditSession

router = APIRouter(tags=["content"])


@router.post("/edit-sessions/{session_id}/show-notes")
async def generate_show_notes(
    session_id: uuid.UUID,
    x_anthropic_key: str = Header(..., alias="X-Anthropic-Key"),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    client = AsyncAnthropic(api_key=x_anthropic_key)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": (
                "Based on the following podcast transcript, generate structured show notes including: "
                "1) A 2-3 sentence summary, 2) Key topics covered, "
                "3) Notable quotes, 4) Resources mentioned.\n\n"
                f"Transcript:\n{session.edited_text}"
            ),
        }],
    )
    return {"show_notes": response.content[0].text}


@router.post("/edit-sessions/{session_id}/marketing-copy")
async def generate_marketing_copy(
    session_id: uuid.UUID,
    x_anthropic_key: str = Header(..., alias="X-Anthropic-Key"),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(EditSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    client = AsyncAnthropic(api_key=x_anthropic_key)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": (
                "Based on the following podcast transcript, generate marketing copy for three platforms:\n"
                "1) 小红书: engaging, emoji-rich, lifestyle tone, ~150 chars\n"
                "2) 微博: punchy, shareable, ~140 chars\n"
                "3) 公众号: professional, detailed intro paragraph\n\n"
                f"Transcript:\n{session.edited_text}"
            ),
        }],
    )
    return {"marketing_copy": response.content[0].text}
