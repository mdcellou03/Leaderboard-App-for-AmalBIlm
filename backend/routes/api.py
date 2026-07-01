from __future__ import annotations

from datetime import date, time
from typing import Optional

from flask import Flask, current_app, jsonify, request, session
from flask_wtf.csrf import generate_csrf
from werkzeug.security import check_password_hash

from extensions import db
from extensions import limiter
from models import Cohort, ScoreEntry, SessionQuestion, Student, WorkshopSession
from services.scoring import apply_rubric_payload, compute_leaderboard
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

    @app.post("/api/cohorts")
    def api_create_cohort():
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", "")).strip()
        if not name:
            return jsonify({"error": "Cohort name is required."}), 400
        if Cohort.query.filter(db.func.lower(Cohort.name) == name.lower()).first():
            return jsonify({"error": "A cohort with this name already exists."}), 400

        cohort = Cohort(name=name)
        db.session.add(cohort)
        db.session.commit()
        return jsonify({"cohort": _cohort_payload(cohort)}), 201

    @app.get("/api/students")
    def api_students():
        cohort_id = _optional_int_query("cohort_id")
        students_query = Student.query
        if cohort_id is not None:
            students_query = students_query.filter_by(cohort_id=cohort_id)

        students = students_query.order_by(Student.name.asc()).all()
        return jsonify({"students": [_student_payload(student) for student in students]})

    @app.post("/api/students")
    def api_create_student():
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", "")).strip()
        cohort_id = _safe_int(payload.get("cohort_id"), default=0, minimum=0, maximum=999999)
        kahoot_identifier = str(payload.get("kahoot_identifier", "")).strip() or None

        cohort = db.session.get(Cohort, cohort_id)
        if not name:
            return jsonify({"error": "Student name is required."}), 400
        if not cohort:
            return jsonify({"error": "A valid cohort is required."}), 400

        student = Student(name=name, cohort_id=cohort.id, kahoot_identifier=kahoot_identifier)
        db.session.add(student)
        db.session.flush()

        for workshop_session in WorkshopSession.query.filter_by(cohort_id=cohort.id).all():
            db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=workshop_session.id))

        db.session.commit()
        return jsonify({"student": _student_payload(student)}), 201

    @app.patch("/api/students/<int:student_id>")
    def api_update_student(student_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        student = db.session.get(Student, student_id)
        if not student:
            return jsonify({"error": "Student not found."}), 404

        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", student.name)).strip()
        cohort_id = _safe_int(payload.get("cohort_id", student.cohort_id or 0), default=0, minimum=0, maximum=999999)
        kahoot_identifier = str(payload.get("kahoot_identifier", "")).strip() or None

        cohort = db.session.get(Cohort, cohort_id)
        if not name:
            return jsonify({"error": "Student name is required."}), 400
        if not cohort:
            return jsonify({"error": "A valid cohort is required."}), 400

        student.name = name
        student.cohort_id = cohort.id
        student.kahoot_identifier = kahoot_identifier

        for workshop_session in WorkshopSession.query.filter_by(cohort_id=cohort.id).all():
            existing = ScoreEntry.query.filter_by(
                student_id=student.id,
                workshop_session_id=workshop_session.id,
            ).first()
            if not existing:
                db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=workshop_session.id))

        db.session.commit()
        return jsonify({"student": _student_payload(student)})

    @app.delete("/api/students/<int:student_id>")
    def api_delete_student(student_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        student = db.session.get(Student, student_id)
        if not student:
            return jsonify({"error": "Student not found."}), 404

        db.session.delete(student)
        db.session.commit()
        return jsonify({"deleted": True, "student_id": student_id})

    @app.get("/api/sessions")
    def api_sessions():
        sessions = WorkshopSession.query.order_by(
            WorkshopSession.session_date.desc(),
            WorkshopSession.start_time.desc(),
        ).all()
        return jsonify({"sessions": [_session_payload(session) for session in sessions]})

    @app.post("/api/sessions")
    def api_create_session():
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        payload = request.get_json(silent=True) or {}
        cohort_id = _safe_int(payload.get("cohort_id"), default=0, minimum=0, maximum=999999)
        cohort = db.session.get(Cohort, cohort_id)
        if not cohort:
            return jsonify({"error": "A valid cohort is required."}), 400

        session_date = _parse_date(payload.get("date"))
        start_time = _parse_time(payload.get("start_time") or "18:00")
        title = str(payload.get("title", "")).strip()
        if not session_date:
            return jsonify({"error": "Session date is required in YYYY-MM-DD format."}), 400
        if not start_time:
            return jsonify({"error": "Start time is required in HH:MM format."}), 400
        if not title:
            return jsonify({"error": "Session title is required."}), 400

        workshop_session = WorkshopSession(
            cohort_id=cohort.id,
            title=title,
            presenter=str(payload.get("presenter", "")).strip(),
            session_date=session_date,
            start_time=start_time,
            notes=str(payload.get("notes", "")).strip(),
            status="draft",
            kahoot_status="questions-ready",
        )
        db.session.add(workshop_session)
        db.session.flush()

        for student in Student.query.filter_by(cohort_id=cohort.id).all():
            db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=workshop_session.id))

        db.session.commit()
        return jsonify({"session": _session_payload(workshop_session)}), 201

    @app.get("/api/sessions/<int:session_id>/scores")
    def api_session_scores(session_id: int):
        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        _ensure_score_entries(workshop_session)
        db.session.commit()

        entries = ScoreEntry.query.filter_by(workshop_session_id=session_id).join(Student).order_by(Student.name.asc()).all()
        return jsonify({"scores": [_score_payload(entry) for entry in entries]})

    @app.put("/api/sessions/<int:session_id>/scores")
    def api_save_session_scores(session_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        _ensure_score_entries(workshop_session)
        payload = request.get_json(silent=True) or {}
        scores = payload.get("scores", [])
        if not isinstance(scores, list):
            return jsonify({"error": "Scores must be a list."}), 400

        entries = {
            entry.student_id: entry
            for entry in ScoreEntry.query.filter_by(workshop_session_id=session_id).all()
        }
        for score_payload in scores:
            student_id = _safe_int(score_payload.get("student_id"), default=0, minimum=0, maximum=999999)
            entry = entries.get(student_id)
            if entry:
                apply_rubric_payload(entry, score_payload)

        if str(payload.get("status", "")).strip() == "published":
            workshop_session.status = "published"
            for entry in entries.values():
                entry.status = "published"
        elif str(payload.get("status", "")).strip() == "reviewed":
            workshop_session.status = "review"
            for entry in entries.values():
                if entry.status == "draft":
                    entry.status = "reviewed"

        db.session.commit()
        saved_entries = ScoreEntry.query.filter_by(workshop_session_id=session_id).join(Student).order_by(Student.name.asc()).all()
        return jsonify({
            "session": _session_payload(workshop_session),
            "scores": [_score_payload(entry) for entry in saved_entries],
        })

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
        "kahoot_identifier": student.kahoot_identifier,
    }


def _session_payload(session: WorkshopSession) -> dict:
    entries = ScoreEntry.query.filter_by(workshop_session_id=session.id).all()
    scored_count = sum(1 for entry in entries if entry.base_points)
    question_count = SessionQuestion.query.filter_by(workshop_session_id=session.id).count()

    return {
        "id": session.id,
        "cohort_id": session.cohort_id,
        "cohort_name": session.cohort.name if session.cohort else None,
        "title": session.title,
        "presenter": session.presenter,
        "date": session.session_date.isoformat(),
        "start_time": session.start_time.strftime("%H:%M"),
        "notes": session.notes or "",
        "status": session.status,
        "kahoot_status": session.kahoot_status,
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


def _score_payload(entry: ScoreEntry) -> dict:
    return {
        "student_id": entry.student_id,
        "student_code": student_code(entry.student_id),
        "student_name": entry.student.name,
        "present": bool(entry.present),
        "punctual": bool(entry.punctual),
        "deliverable": bool(entry.deliverable),
        "kahoot_points": int(entry.kahoot_points or 0),
        "participation_score": int(entry.participation_score or 0),
        "teamwork_score": int(entry.teamwork_score or 0),
        "conduct_score": int(entry.conduct_score or 0),
        "penalty_points": int(entry.penalty_points or 0),
        "notes": entry.notes or "",
        "status": entry.status,
        "total_points": int(entry.base_points or 0),
    }


def _ensure_score_entries(workshop_session: WorkshopSession) -> None:
    if not workshop_session.cohort_id:
        return

    existing_student_ids = {
        row[0]
        for row in db.session.query(ScoreEntry.student_id).filter_by(workshop_session_id=workshop_session.id).all()
    }
    for student in Student.query.filter_by(cohort_id=workshop_session.cohort_id).all():
        if student.id not in existing_student_ids:
            db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=workshop_session.id))


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


def _parse_date(value) -> Optional[date]:
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _parse_time(value) -> Optional[time]:
    try:
        return time.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _require_admin():
    if not session.get("admin_logged_in"):
        return jsonify({"error": "Admin login required."}), 401

    return None
