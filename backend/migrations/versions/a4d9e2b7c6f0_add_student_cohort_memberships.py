"""add student cohort memberships

Revision ID: a4d9e2b7c6f0
Revises: f2a6c9d3e4b1
Create Date: 2026-07-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a4d9e2b7c6f0"
down_revision = "f2a6c9d3e4b1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "student_cohort_membership",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("cohort_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["cohort_id"], ["cohort.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["student.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "cohort_id", name="uniq_student_cohort_membership"),
    )
    op.execute(
        """
        INSERT INTO student_cohort_membership (student_id, cohort_id)
        SELECT id, cohort_id
        FROM student
        WHERE cohort_id IS NOT NULL
        """
    )


def downgrade():
    op.drop_table("student_cohort_membership")
