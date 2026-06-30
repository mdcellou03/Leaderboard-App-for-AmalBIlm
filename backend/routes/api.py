from __future__ import annotations

from typing import Optional

from flask import Flask, current_app, jsonify, request, session
from flask_wtf.csrf import generate_csrf
from werkzeug.security import check_password_hash

from extensions import db
from extensions import limiter
from models import Cohort, ScoreEntry, SessionQuestion, Student, WorkshopSession
from services.scoring import compute_leaderboard
from services.students import student_code


def register_api_routes(app: Flask) -> None:
    @app.get("/api/health")
    def api_health():
        return jsonify({"status": "ok"})

    @app.get("/api/auth/csrf")
    def api_auth_csrf():
        return jsonify({"csrf_token": generate_csrf()})

    @app.get("/api/auth/me")
    def api_auth_me():
        return jsonify({"authenticated": bool(session.get("admin_logged_in"))})

    @app.post("/api/auth/login")
    @limiter.limit("5 per minute")
    def api_auth_login():
        payload = request.get_json(silent=True) or {}
        password = str(payload.get("password", ""))
        admin_password_hash = current_app.config.get("ADMIN_PASSWORD_HASH", "")

        if not admin_password_hash:
            return jsonify({"authenticated": False, "error": "Admin login is not configured."}), 503

        if check_password_hash(admin_password_hash, password):
            session.clear()
            session["admin_logged_in"] = True
            return jsonify({"authenticated": True})

        return jsonify({"authenticated": False, "error": "Incorrect password."}), 401

    @app.post("/api/auth/logout")
    def api_auth_logout():
        session.pop("admin_logged_in", None)
        return jsonify({"authenticated": False})

    @app.get("/api/cohorts")
    def api_cohorts():
        cohorts = Cohort.query.order_by(Cohort.name.asc()).all()
        return jsonify({"cohorts": [_cohort_payload(cohort) for cohort in cohorts]})

    @app.get("/api/students")
    def api_students():
        cohort_id = _optional_int_query("cohort_id")
        students_query = Student.query
        if cohort_id is not None:
            students_query = students_query.filter_by(cohort_id=cohort_id)

        students = students_query.order_by(Student.name.asc()).all()
        return jsonify({"students": [_student_payload(student) for student in students]})

    @app.get("/api/sessions")
    def api_sessions():
        sessions = WorkshopSession.query.order_by(
            WorkshopSession.session_date.desc(),
            WorkshopSession.start_time.desc(),
        ).all()
        return jsonify({"sessions": [_session_payload(session) for session in sessions]})

    @app.get("/api/sessions/<int:session_id>/questions")
    def api_session_questions(session_id: int):
        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        questions = SessionQuestion.query.filter_by(workshop_session_id=session_id).order_by(
            SessionQuestion.position.asc(),
            SessionQuestion.id.asc(),
        ).all()
        return jsonify({"questions": [_question_payload(question) for question in questions]})

    @app.post("/api/sessions/<int:session_id>/questions")
    def api_create_session_question(session_id: int):
        if not session.get("admin_logged_in"):
            return jsonify({"error": "Admin login required."}), 401

        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        payload = request.get_json(silent=True) or {}
        prompt = str(payload.get("prompt", "")).strip()
        options = [str(option).strip() for option in payload.get("options", []) if str(option).strip()]
        correct_option = str(payload.get("correct_option", "")).strip().upper()

        if not prompt:
            return jsonify({"error": "Question prompt is required."}), 400
        if len(options) < 2 or len(options) > 4:
            return jsonify({"error": "Provide between 2 and 4 answer options."}), 400
        if correct_option not in ["A", "B", "C", "D"][: len(options)]:
            return jsonify({"error": "Correct option must match one of the provided options."}), 400

        position = (db.session.query(db.func.max(SessionQuestion.position)).filter_by(workshop_session_id=session_id).scalar() or 0) + 1
        question = SessionQuestion(
            workshop_session_id=workshop_session.id,
            position=position,
            prompt=prompt,
            option_a=options[0],
            option_b=options[1],
            option_c=options[2] if len(options) > 2 else None,
            option_d=options[3] if len(options) > 3 else None,
            correct_option=correct_option,
            time_limit_seconds=_safe_int(payload.get("time_limit_seconds"), default=20, minimum=5, maximum=240),
            points=_safe_int(payload.get("points"), default=1000, minimum=0, maximum=2000),
        )
        db.session.add(question)
        db.session.commit()

        return jsonify({"question": _question_payload(question)}), 201

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
        "cohort_id": student.cohort_id,
        "cohort_name": student.cohort.name if student.cohort else None,
        "code": student_code(student.id),
        "name": student.name,
    }


def _session_payload(session: WorkshopSession) -> dict:
    entries = ScoreEntry.query.filter_by(workshop_session_id=session.id).all()
    scored_count = sum(1 for entry in entries if entry.base_points)
    question_count = SessionQuestion.query.filter_by(workshop_session_id=session.id).count()

    return {
        "id": session.id,
        "cohort_id": session.cohort_id,
        "cohort_name": session.cohort.name if session.cohort else None,
        "date": session.session_date.isoformat(),
        "start_time": session.start_time.strftime("%H:%M"),
        "score_entries": len(entries),
        "scored_entries": scored_count,
        "question_count": question_count,
    }


def _question_payload(question: SessionQuestion) -> dict:
    options = [question.option_a, question.option_b]
    if question.option_c:
        options.append(question.option_c)
    if question.option_d:
        options.append(question.option_d)

    return {
        "id": question.id,
        "session_id": question.workshop_session_id,
        "position": question.position,
        "prompt": question.prompt,
        "options": options,
        "correct_option": question.correct_option,
        "time_limit_seconds": question.time_limit_seconds,
        "points": question.points,
        "kahoot_question_id": question.kahoot_question_id,
    }


def _optional_int_query(name: str) -> Optional[int]:
    raw = request.args.get(name, "").strip()
    if not raw:
        return None

    try:
        return int(raw)
    except ValueError:
        return None


def _safe_int(value, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    return max(minimum, min(maximum, parsed))
