from __future__ import annotations

import os


def database_uri(instance_path: str) -> str:
    configured_uri = os.environ.get("DATABASE_URL", "").strip()
    if configured_uri:
        return _normalize_database_uri(configured_uri)

    return "sqlite:///" + os.path.join(instance_path, "leaderboard.db")


def _normalize_database_uri(uri: str) -> str:
    # Some hosts still expose postgres://, but SQLAlchemy expects postgresql://.
    if uri.startswith("postgres://"):
        return "postgresql://" + uri[len("postgres://") :]

    return uri
