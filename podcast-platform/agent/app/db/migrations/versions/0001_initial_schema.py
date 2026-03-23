"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

TIMESTAMPTZ = sa.TIMESTAMP(timezone=True)

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("created_at", TIMESTAMPTZ, server_default=sa.text("now()")),
        sa.Column("updated_at", TIMESTAMPTZ, server_default=sa.text("now()")),
    )

    op.create_table(
        "recordings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.Text, nullable=False),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("sample_rate", sa.Integer),
        sa.Column("channels", sa.Integer),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("created_at", TIMESTAMPTZ, server_default=sa.text("now()")),
    )

    op.create_table(
        "transcripts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recording_id", UUID(as_uuid=True), sa.ForeignKey("recordings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_text", sa.Text, nullable=False),
        sa.Column("words", JSONB, nullable=False),
        sa.Column("language", sa.String(16)),
        sa.Column("created_at", TIMESTAMPTZ, server_default=sa.text("now()")),
    )

    op.create_table(
        "edit_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("transcript_id", UUID(as_uuid=True), sa.ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("edited_text", sa.Text, nullable=False),
        sa.Column("created_at", TIMESTAMPTZ, server_default=sa.text("now()")),
        sa.Column("updated_at", TIMESTAMPTZ, server_default=sa.text("now()")),
    )

    op.create_table(
        "edit_operations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("edit_session_id", UUID(as_uuid=True), sa.ForeignKey("edit_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("op_type", sa.String(32), nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("applied_order", sa.Integer, nullable=False),
        sa.Column("created_at", TIMESTAMPTZ, server_default=sa.text("now()")),
    )

    op.create_table(
        "exports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("edit_session_id", UUID(as_uuid=True), sa.ForeignKey("edit_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("output_path", sa.Text),
        sa.Column("format", sa.String(8), server_default="mp3"),
        sa.Column("status", sa.String(16), server_default="pending"),
        sa.Column("loudness_lufs", sa.Float),
        sa.Column("created_at", TIMESTAMPTZ, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("exports")
    op.drop_table("edit_operations")
    op.drop_table("edit_sessions")
    op.drop_table("transcripts")
    op.drop_table("recordings")
    op.drop_table("projects")
