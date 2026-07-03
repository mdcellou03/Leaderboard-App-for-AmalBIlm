"""add kahoot runs and results

Revision ID: f2a6c9d3e4b1
Revises: d3a9f21c8e77
Create Date: 2026-07-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f2a6c9d3e4b1"
down_revision = "d3a9f21c8e77"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "kahoot_run",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workshop_session_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("section_label", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("kahoot_url", sa.String(length=500), nullable=True),
        sa.Column("report_url", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("exported_at", sa.DateTime(), nullable=True),
        sa.Column("hosted_at", sa.DateTime(), nullable=True),
        sa.Column("results_imported_at", sa.DateTime(), nullable=True),
        sa.Column("applied_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["workshop_session_id"], ["workshop_session.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "kahoot_result",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kahoot_run_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("nickname", sa.String(length=180), nullable=False),
        sa.Column("identifier", sa.String(length=180), nullable=True),
        sa.Column("correct_count", sa.Integer(), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("kahoot_points", sa.Integer(), nullable=False),
        sa.Column("awarded_points", sa.Integer(), nullable=False),
        sa.Column("match_status", sa.String(length=40), nullable=False),
        sa.Column("raw_payload", sa.Text(), nullable=True),
        sa.Column("applied", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["kahoot_run_id"], ["kahoot_run.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["student.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("session_question", schema=None) as batch_op:
        batch_op.add_column(sa.Column("kahoot_run_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_session_question_kahoot_run_id",
            "kahoot_run",
            ["kahoot_run_id"],
            ["id"],
        )


def downgrade():
    with op.batch_alter_table("session_question", schema=None) as batch_op:
        batch_op.drop_constraint("fk_session_question_kahoot_run_id", type_="foreignkey")
        batch_op.drop_column("kahoot_run_id")

    op.drop_table("kahoot_result")
    op.drop_table("kahoot_run")
