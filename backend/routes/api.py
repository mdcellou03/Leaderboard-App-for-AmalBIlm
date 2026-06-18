from __future__ import annotations

from typing import Optional

from flask import Flask, jsonify, request

from backend.extensions import db
from backend.models import Cohort, ScoreEntry, Student, WorkshopSession
from backend.services.scoring import compute_leaderboard
from backend.services.students import student_code


def register_api_routes(app: Flask) -> None:
    @app.get("/api/health")
    def api_health():
        return jsonify({"status": "ok"})

    @app.get("/api/cohorts")
    def api_cohorts():
        cohorts = Cohort.query.order_by(Cohort.name.asc()).all()
        return jsonify({"cohorts": [_cohort_payload(cohort) for cohort in cohorts]})

    @app.get("/api/students")
    def api_students():
        students = Student.query.order_by(Student.name.asc()).all()
        return jsonify({"students": [_student_payload(student) for student in students]})

    @app.get("/api/sessions")
    def api_sessions():
        sessions = WorkshopSession.query.order_by(
            WorkshopSession.session_date.desc(),
            WorkshopSession.start_time.desc(),
        ).all()
        return jsonify({"sessions": [_session_payload(session) for session in sessions]})

    @app.get("/api/leaderboard")
    def api_leaderboard():
        cohort_id = _optional_int_query("cohort_id")
        if cohort_id and not db.session.get(Cohort, cohort_id):
            cohort_id = None

        board = compute_leaderboard(cohort_id)
        return jsonify({"leaderboard": board, "cohort_id": cohort_id})


def _cohort_payload(cohort: Cohort) -> dict:
    return {
        "id": cohort.id,
        "name": cohort.name,
    }


def _student_payload(student: Student) -> dict:
    return {
        "id": student.id,
        "code": student_code(student.id),
        "name": student.name,
    }


def _session_payload(session: WorkshopSession) -> dict:
    entries = ScoreEntry.query.filter_by(workshop_session_id=session.id).all()
    scored_count = sum(1 for entry in entries if entry.base_points)

    return {
        "id": session.id,
        "cohort_id": session.cohort_id,
        "cohort_name": session.cohort.name if session.cohort else None,
        "date": session.session_date.isoformat(),
        "start_time": session.start_time.strftime("%H:%M"),
        "score_entries": len(entries),
        "scored_entries": scored_count,
    }


def _optional_int_query(name: str) -> Optional[int]:
    raw = request.args.get(name, "").strip()
    if not raw:
        return None

    try:
        return int(raw)
    except ValueError:
        return None
