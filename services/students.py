from __future__ import annotations

import os

STUDENT_CODE_PREFIX = os.environ.get("STUDENT_CODE_PREFIX", "STU").strip().upper() or "STU"


def student_code(student_id: int) -> str:
    """Stable public ID used to distinguish students and match Kahoot results."""
    return f"{STUDENT_CODE_PREFIX}-{student_id:03d}"
