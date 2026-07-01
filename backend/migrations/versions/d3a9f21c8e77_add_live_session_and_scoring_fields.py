"""Add live session and scoring fields

Revision ID: d3a9f21c8e77
Revises: b8d2f34a7c91
Create Date: 2026-07-01
"""

from alembic import op
import sqlalchemy as sa


revision = "d3a9f21c8e77"
down_revision = "b8d2f34a7c91"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("student", recreate="always") as batch_op:
        batch_op.add_column(sa.Column("kahoot_identifier", sa.String(length=120), nullable=True))

    with op.batch_alter_table("workshop_session") as batch_op:
        batch_op.add_column(sa.Column("title", sa.String(length=180), nullable=False, server_default="Workshop Session"))
        batch_op.add_column(sa.Column("presenter", sa.String(length=120), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("status", sa.String(length=40), nullable=False, server_default="draft"))
        batch_op.add_column(sa.Column("kahoot_status", sa.String(length=40), nullable=False, server_default="questions-ready"))

    with op.batch_alter_table("score_entry") as batch_op:
        batch_op.add_column(sa.Column("punctual", sa.Boolean(), nullable=True, server_default=sa.false()))
        batch_op.add_column(sa.Column("deliverable", sa.Boolean(), nullable=True, server_default=sa.false()))
        batch_op.add_column(sa.Column("kahoot_points", sa.Integer(), nullable=True, server_default="0"))
        batch_op.add_column(sa.Column("participation_score", sa.Integer(), nullable=True, server_default="0"))
        batch_op.add_column(sa.Column("teamwork_score", sa.Integer(), nullable=True, server_default="0"))
        batch_op.add_column(sa.Column("conduct_score", sa.Integer(), nullable=True, server_default="0"))
        batch_op.add_column(sa.Column("penalty_points", sa.Integer(), nullable=True, server_default="0"))
        batch_op.add_column(sa.Column("status", sa.String(length=40), nullable=False, server_default="draft"))


def downgrade():
    with op.batch_alter_table("score_entry") as batch_op:
        batch_op.drop_column("status")
        batch_op.drop_column("penalty_points")
        batch_op.drop_column("conduct_score")
        batch_op.drop_column("teamwork_score")
        batch_op.drop_column("participation_score")
        batch_op.drop_column("kahoot_points")
        batch_op.drop_column("deliverable")
        batch_op.drop_column("punctual")

    with op.batch_alter_table("workshop_session") as batch_op:
        batch_op.drop_column("kahoot_status")
        batch_op.drop_column("status")
        batch_op.drop_column("notes")
        batch_op.drop_column("presenter")
        batch_op.drop_column("title")

    with op.batch_alter_table("student", recreate="always") as batch_op:
        batch_op.drop_column("kahoot_identifier")
