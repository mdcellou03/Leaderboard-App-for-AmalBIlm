"""add kahoot run position

Revision ID: c7b2e8d4a9f0
Revises: a4d9e2b7c6f0
Create Date: 2026-07-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c7b2e8d4a9f0"
down_revision = "a4d9e2b7c6f0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("kahoot_run") as batch_op:
        batch_op.add_column(sa.Column("position", sa.Integer(), nullable=False, server_default="1"))

    connection = op.get_bind()
    session_ids = [
        row[0]
        for row in connection.execute(sa.text("SELECT DISTINCT workshop_session_id FROM kahoot_run")).fetchall()
    ]
    for session_id in session_ids:
        run_ids = [
            row[0]
            for row in connection.execute(
                sa.text("SELECT id FROM kahoot_run WHERE workshop_session_id = :session_id ORDER BY id ASC"),
                {"session_id": session_id},
            ).fetchall()
        ]
        for index, run_id in enumerate(run_ids, start=1):
            connection.execute(
                sa.text("UPDATE kahoot_run SET position = :position WHERE id = :run_id"),
                {"position": index, "run_id": run_id},
            )


def downgrade():
    with op.batch_alter_table("kahoot_run") as batch_op:
        batch_op.drop_column("position")
