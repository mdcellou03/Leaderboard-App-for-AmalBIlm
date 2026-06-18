from __future__ import annotations

from sqlalchemy import inspect, text

from extensions import db


def ensure_database_schema() -> None:
    """Apply tiny SQLite-compatible upgrades for local databases created before migrations."""
    inspector = inspect(db.engine)
    if not inspector.has_table("workshop_session"):
        return

    workshop_columns = {column["name"] for column in inspector.get_columns("workshop_session")}
    if "cohort_id" not in workshop_columns:
        db.session.execute(text("ALTER TABLE workshop_session ADD COLUMN cohort_id INTEGER"))
        db.session.commit()
