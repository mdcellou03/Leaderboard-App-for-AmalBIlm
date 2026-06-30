"""Add student cohort membership

Revision ID: 6c4e3f0a2f1d
Revises: 97b807bfce22
Create Date: 2026-06-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "6c4e3f0a2f1d"
down_revision = "97b807bfce22"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("student") as batch_op:
        batch_op.add_column(sa.Column("cohort_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_student_cohort_id", "cohort", ["cohort_id"], ["id"])


def downgrade():
    with op.batch_alter_table("student") as batch_op:
        batch_op.drop_constraint("fk_student_cohort_id", type_="foreignkey")
        batch_op.drop_column("cohort_id")
