import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import Project, Recording

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    title: str
    description: str | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None

    class Config:
        from_attributes = True


class RecordingSummary(BaseModel):
    id: uuid.UUID
    filename: str
    duration_ms: int | None
    status: str

    class Config:
        from_attributes = True


class ProjectDetail(ProjectOut):
    recordings: list[RecordingSummary]


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(title=body.title, description=body.description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    result = await db.execute(
        select(Recording)
        .where(Recording.project_id == project_id)
        .order_by(Recording.created_at.desc())
    )
    recordings = result.scalars().all()
    return {**ProjectOut.model_validate(project).model_dump(), "recordings": recordings}
