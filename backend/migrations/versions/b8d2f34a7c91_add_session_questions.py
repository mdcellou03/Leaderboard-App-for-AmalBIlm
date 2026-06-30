"""Add session questions

Revision ID: b8d2f34a7c91
Revises: 6c4e3f0a2f1d
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa


revision = "b8d2f34a7c91"
down_revision = "6c4e3f0a2f1d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "session_question",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workshop_session_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("option_a", sa.String(length=255), nullable=False),
        sa.Column("option_b", sa.String(length=255), nullable=False),
        sa.Column("option_c", sa.String(length=255), nullable=True),
        sa.Column("option_d", sa.String(length=255), nullable=True),
        sa.Column("correct_option", sa.String(length=1), nullable=False),
        sa.Column("time_limit_seconds", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("kahoot_question_id", sa.String(length=120), nullable=True),
        sa.ForeignKeyConstraint(["workshop_session_id"], ["workshop_session.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workshop_session_id", "position", name="uniq_session_question_position"),
    )


def downgrade():
    op.drop_table("session_question")
