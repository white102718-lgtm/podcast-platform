import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMPTZ
from app.db.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow, onupdate=datetime.utcnow)

    recordings: Mapped[list["Recording"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Recording(Base):
    __tablename__ = "recordings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    sample_rate: Mapped[int | None] = mapped_column(Integer)
    channels: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="recordings")
    transcript: Mapped["Transcript | None"] = relationship(back_populates="recording", uselist=False, cascade="all, delete-orphan")


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recording_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("recordings.id", ondelete="CASCADE"))
    full_text: Mapped[str] = mapped_column(Text, nullable=False)
    words: Mapped[list] = mapped_column(JSONB, nullable=False)  # [{word, start_ms, end_ms, confidence}]
    language: Mapped[str | None] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)

    recording: Mapped["Recording"] = relationship(back_populates="transcript")
    edit_sessions: Mapped[list["EditSession"]] = relationship(back_populates="transcript", cascade="all, delete-orphan")


class EditSession(Base):
    __tablename__ = "edit_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transcript_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("transcripts.id", ondelete="CASCADE"))
    edited_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow, onupdate=datetime.utcnow)

    transcript: Mapped["Transcript"] = relationship(back_populates="edit_sessions")
    operations: Mapped[list["EditOperation"]] = relationship(back_populates="session", cascade="all, delete-orphan", order_by="EditOperation.applied_order")
    exports: Mapped[list["Export"]] = relationship(back_populates="edit_session", cascade="all, delete-orphan")


class EditOperation(Base):
    __tablename__ = "edit_operations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    edit_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("edit_sessions.id", ondelete="CASCADE"))
    op_type: Mapped[str] = mapped_column(String(32), nullable=False)  # delete_range | cut_silence | remove_filler
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    applied_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)

    session: Mapped["EditSession"] = relationship(back_populates="operations")


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    edit_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("edit_sessions.id", ondelete="CASCADE"))
    output_path: Mapped[str | None] = mapped_column(Text)
    format: Mapped[str] = mapped_column(String(8), default="mp3")
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|processing|done|error
    loudness_lufs: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)

    edit_session: Mapped["EditSession"] = relationship(back_populates="exports")
