from __future__ import annotations

import json
import csv
import re
import zipfile
from datetime import date, datetime, time
from io import BytesIO, StringIO
from typing import Optional
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

from flask import Flask, current_app, jsonify, request, send_file, session
from flask_wtf.csrf import generate_csrf
from werkzeug.security import check_password_hash

from extensions import db
from extensions import limiter
from models import Cohort, KahootResult, KahootRun, ScoreEntry, SessionQuestion, Student, StudentCohortMembership, WorkshopSession
from services.scoring import apply_rubric_payload, compute_leaderboard, compute_rubric_points
from services.students import student_code


DEFAULT_SESSION_NOTES = (
    "Mission: Empower youth with knowledge, character, and critical thinking so they can ethically "
    "use technology as khulafaa on earth.\n\n"
    "Purpose: This is not just career advice. The presenter should connect their skill, path, and "
    "choices to service, responsibility, Islamic boundaries, and practical next steps."
)

DEFAULT_SESSION_SECTIONS = [
    (
        "How Your Skill Serves the Community",
        "Hook: show the real-world community need this skill answers.\n"
        "Value delivery: explain where the skill is used and who benefits.\n"
        "Engagement: ask students to identify one problem this skill could solve.\n"
        "CTA: connect the skill to service and responsibility.",
    ),
    (
        "The Real Cost of Entry",
        "Hook: name the honest effort, sacrifice, or tradeoff behind the path.\n"
        "Value delivery: explain time, money, discipline, school, training, and character requirements.\n"
        "Engagement: ask students what surprised them about the path.\n"
        "CTA: turn ambition into a realistic first step.",
    ),
    (
        "What You'd Do Differently",
        "Hook: share a mistake, delay, or lesson learned.\n"
        "Value delivery: explain what the presenter would repeat, change, or avoid.\n"
        "Engagement: ask students what advice they would give their future self.\n"
        "CTA: frame reflection as part of growth, not embarrassment.",
    ),
    (
        "Growing While Maintaining Islamic Boundaries",
        "Hook: describe a boundary challenge in the field or learning path.\n"
        "Value delivery: explain how to grow while protecting salah, adab, modesty, honesty, and purpose.\n"
        "Engagement: ask students to choose a boundary they need to plan for.\n"
        "CTA: show that excellence and Islamic identity can work together.",
    ),
    (
        "Hands-On Demo",
        "Hook: let students see or try the skill instead of only hearing about it.\n"
        "Value delivery: demonstrate a simple, concrete task.\n"
        "Engagement: give students a short activity, prediction, or decision point.\n"
        "CTA: make the skill feel reachable and practical.",
    ),
    (
        "What This Unlocks",
        "Hook: show the doors this skill can open.\n"
        "Value delivery: connect the session to future learning, careers, projects, and community impact.\n"
        "Engagement: ask students to name one next step they could take this week.\n"
        "CTA: close with encouragement and accountability.",
    ),
]


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
            students_query = students_query.join(StudentCohortMembership).filter(
                StudentCohortMembership.cohort_id == cohort_id
            )

        students = students_query.distinct().order_by(Student.name.asc()).all()
        return jsonify({"students": [_student_payload(student) for student in students]})

    @app.post("/api/students")
    def api_create_student():
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", "")).strip()
        cohort_ids = _parse_cohort_ids(payload)
        kahoot_identifier = str(payload.get("kahoot_identifier", "")).strip() or None

        cohorts = _valid_cohorts(cohort_ids)
        if not name:
            return jsonify({"error": "Student name is required."}), 400
        if not cohorts:
            return jsonify({"error": "At least one valid cohort is required."}), 400

        student = Student(name=name, cohort_id=cohorts[0].id, kahoot_identifier=kahoot_identifier)
        db.session.add(student)
        db.session.flush()
        _sync_student_cohorts(student, [cohort.id for cohort in cohorts])
        _ensure_student_scores_for_cohorts(student, [cohort.id for cohort in cohorts])

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
        cohort_ids = _parse_cohort_ids(payload, fallback=[student.cohort_id] if student.cohort_id else [])
        kahoot_identifier = str(payload.get("kahoot_identifier", "")).strip() or None

        cohorts = _valid_cohorts(cohort_ids)
        if not name:
            return jsonify({"error": "Student name is required."}), 400
        if not cohorts:
            return jsonify({"error": "At least one valid cohort is required."}), 400

        student.name = name
        student.cohort_id = cohorts[0].id
        student.kahoot_identifier = kahoot_identifier
        _sync_student_cohorts(student, [cohort.id for cohort in cohorts])
        _ensure_student_scores_for_cohorts(student, [cohort.id for cohort in cohorts])

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
            notes=str(payload.get("notes", "")).strip() or DEFAULT_SESSION_NOTES,
            status="draft",
            kahoot_status="questions-ready",
        )
        db.session.add(workshop_session)
        db.session.flush()

        students = Student.query.join(StudentCohortMembership).filter(
            StudentCohortMembership.cohort_id == cohort.id
        ).distinct().all()
        for student in students:
            db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=workshop_session.id))

        _create_default_session_sections(workshop_session)

        db.session.commit()
        return jsonify({"session": _session_payload(workshop_session)}), 201

    @app.delete("/api/sessions/<int:session_id>")
    def api_delete_session(session_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        db.session.delete(workshop_session)
        db.session.commit()
        return jsonify({"deleted": True, "session_id": session_id})

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

        kahoot_run_id = _safe_int(payload.get("kahoot_run_id"), default=0, minimum=0, maximum=999999)
        kahoot_run = None
        if kahoot_run_id:
            kahoot_run = db.session.get(KahootRun, kahoot_run_id)
            if not kahoot_run or kahoot_run.workshop_session_id != workshop_session.id:
                return jsonify({"error": "Kahoot section must belong to this session."}), 400

        position = (db.session.query(db.func.max(SessionQuestion.position)).filter_by(workshop_session_id=session_id).scalar() or 0) + 1
        question = SessionQuestion(
            workshop_session_id=workshop_session.id,
            kahoot_run_id=kahoot_run.id if kahoot_run else None,
            position=position,
            prompt=prompt,
            option_a=options[0],
            option_b=options[1],
            option_c=options[2] if len(options) > 2 else None,
            option_d=options[3] if len(options) > 3 else None,
            correct_option=correct_option,
            time_limit_seconds=_safe_int(payload.get("time_limit_seconds"), default=20, minimum=5, maximum=240),
            points=_safe_int(payload.get("points"), default=1, minimum=0, maximum=100),
        )
        db.session.add(question)
        workshop_session.kahoot_status = "questions-ready"
        db.session.commit()

        return jsonify({"question": _question_payload(question)}), 201

    @app.patch("/api/questions/<int:question_id>")
    def api_update_session_question(question_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        question = db.session.get(SessionQuestion, question_id)
        if not question:
            return jsonify({"error": "Question not found."}), 404

        payload = request.get_json(silent=True) or {}
        prompt = str(payload.get("prompt", question.prompt)).strip()
        options = payload.get("options")
        if options is None:
            options = [question.option_a, question.option_b, question.option_c, question.option_d]
        options = [str(option).strip() for option in options if str(option).strip()]
        correct_option = str(payload.get("correct_option", question.correct_option)).strip().upper()

        if not prompt:
            return jsonify({"error": "Question prompt is required."}), 400
        if len(options) < 2 or len(options) > 4:
            return jsonify({"error": "Provide between 2 and 4 answer options."}), 400
        if correct_option not in ["A", "B", "C", "D"][: len(options)]:
            return jsonify({"error": "Correct option must match one of the provided options."}), 400

        kahoot_run_id = payload.get("kahoot_run_id", question.kahoot_run_id)
        parsed_run_id = _safe_int(kahoot_run_id, default=0, minimum=0, maximum=999999) if kahoot_run_id is not None else 0
        kahoot_run = None
        if parsed_run_id:
            kahoot_run = db.session.get(KahootRun, parsed_run_id)
            if not kahoot_run or kahoot_run.workshop_session_id != question.workshop_session_id:
                return jsonify({"error": "Kahoot section must belong to this question's session."}), 400

        question.prompt = prompt
        question.option_a = options[0]
        question.option_b = options[1]
        question.option_c = options[2] if len(options) > 2 else None
        question.option_d = options[3] if len(options) > 3 else None
        question.correct_option = correct_option
        question.time_limit_seconds = _safe_int(payload.get("time_limit_seconds", question.time_limit_seconds), default=question.time_limit_seconds, minimum=5, maximum=240)
        question.points = _safe_int(payload.get("points", question.points), default=question.points, minimum=0, maximum=100)
        question.kahoot_run_id = kahoot_run.id if kahoot_run else None
        question.workshop_session.kahoot_status = "questions-ready"

        db.session.commit()
        return jsonify({"question": _question_payload(question)})

    @app.delete("/api/questions/<int:question_id>")
    def api_delete_session_question(question_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        question = db.session.get(SessionQuestion, question_id)
        if not question:
            return jsonify({"error": "Question not found."}), 404

        session_id = question.workshop_session_id
        db.session.delete(question)
        db.session.flush()

        remaining_questions = SessionQuestion.query.filter_by(workshop_session_id=session_id).order_by(
            SessionQuestion.position.asc(),
            SessionQuestion.id.asc(),
        ).all()
        for index, remaining_question in enumerate(remaining_questions, start=1):
            remaining_question.position = index

        db.session.commit()
        return jsonify({"deleted": True, "question_id": question_id})

    @app.get("/api/sessions/<int:session_id>/kahoot-runs")
    def api_kahoot_runs(session_id: int):
        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        runs = KahootRun.query.filter_by(workshop_session_id=session_id).order_by(KahootRun.position.asc(), KahootRun.id.asc()).all()
        return jsonify({"kahoot_runs": [_kahoot_run_payload(run) for run in runs]})

    @app.post("/api/sessions/<int:session_id>/kahoot-runs")
    def api_create_kahoot_run(session_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        payload = request.get_json(silent=True) or {}
        title = str(payload.get("title", "")).strip()
        if not title:
            return jsonify({"error": "Kahoot section title is required."}), 400

        run = KahootRun(
            workshop_session_id=workshop_session.id,
            position=_next_kahoot_run_position(workshop_session.id),
            title=title,
            section_label=str(payload.get("section_label", "")).strip() or None,
            notes=str(payload.get("notes", "")).strip(),
            status="draft",
        )
        db.session.add(run)
        db.session.commit()
        return jsonify({"kahoot_run": _kahoot_run_payload(run)}), 201

    @app.patch("/api/kahoot-runs/<int:run_id>")
    def api_update_kahoot_run(run_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        run = db.session.get(KahootRun, run_id)
        if not run:
            return jsonify({"error": "Kahoot section not found."}), 404

        payload = request.get_json(silent=True) or {}
        if "title" in payload:
            title = str(payload.get("title", "")).strip()
            if not title:
                return jsonify({"error": "Kahoot section title cannot be empty."}), 400
            run.title = title
        if "section_label" in payload:
            run.section_label = str(payload.get("section_label", "")).strip() or None
        if "kahoot_url" in payload:
            run.kahoot_url = str(payload.get("kahoot_url", "")).strip() or None
        if "report_url" in payload:
            run.report_url = str(payload.get("report_url", "")).strip() or None
        if "notes" in payload:
            run.notes = str(payload.get("notes", "")).strip()
        if "position" in payload:
            run.position = _safe_int(payload.get("position"), default=run.position or 1, minimum=1, maximum=999)
        if "status" in payload:
            status = str(payload.get("status", "")).strip()
            if status not in ["draft", "exported", "hosted", "results-imported", "reviewed", "applied"]:
                return jsonify({"error": "Unsupported Kahoot status."}), 400
            run.status = status
            _stamp_kahoot_run_status(run, status)

        _compact_kahoot_run_positions(run.workshop_session_id)
        _update_session_kahoot_status(run.workshop_session)
        db.session.commit()
        return jsonify({"kahoot_run": _kahoot_run_payload(run)})

    @app.delete("/api/kahoot-runs/<int:run_id>")
    def api_delete_kahoot_run(run_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        run = db.session.get(KahootRun, run_id)
        if not run:
            return jsonify({"error": "Kahoot section not found."}), 404
        if KahootResult.query.filter_by(kahoot_run_id=run.id, applied=True).first():
            return jsonify({"error": "Sections with applied results cannot be deleted."}), 400

        session_id = run.workshop_session_id
        for question in SessionQuestion.query.filter_by(kahoot_run_id=run.id).all():
            db.session.delete(question)
        db.session.delete(run)
        db.session.flush()
        _compact_kahoot_run_positions(session_id)
        db.session.commit()
        return jsonify({"deleted": True, "kahoot_run_id": run_id})

    @app.post("/api/sessions/<int:session_id>/kahoot-runs/reorder")
    def api_reorder_kahoot_runs(session_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        payload = request.get_json(silent=True) or {}
        ordered_ids = payload.get("ordered_ids", [])
        if not isinstance(ordered_ids, list):
            return jsonify({"error": "ordered_ids must be a list."}), 400

        runs = KahootRun.query.filter_by(workshop_session_id=session_id).all()
        runs_by_id = {run.id: run for run in runs}
        ordered_id_set = {
            _safe_int(raw_id, default=0, minimum=0, maximum=999999)
            for raw_id in ordered_ids
        }
        next_position = 1
        for raw_id in ordered_ids:
            run_id = _safe_int(raw_id, default=0, minimum=0, maximum=999999)
            run = runs_by_id.get(run_id)
            if run:
                run.position = next_position
                next_position += 1

        for run in sorted(runs, key=lambda item: (item.position or 999, item.id)):
            if run.id not in ordered_id_set:
                run.position = next_position
                next_position += 1

        db.session.commit()
        ordered_runs = KahootRun.query.filter_by(workshop_session_id=session_id).order_by(KahootRun.position.asc(), KahootRun.id.asc()).all()
        return jsonify({"kahoot_runs": [_kahoot_run_payload(run) for run in ordered_runs]})

    @app.get("/api/kahoot-runs/<int:run_id>/results")
    def api_kahoot_results(run_id: int):
        run = db.session.get(KahootRun, run_id)
        if not run:
            return jsonify({"error": "Kahoot section not found."}), 404

        results = KahootResult.query.filter_by(kahoot_run_id=run.id).order_by(KahootResult.kahoot_points.desc()).all()
        return jsonify({"results": [_kahoot_result_payload(result) for result in results]})

    @app.get("/api/kahoot-runs/<int:run_id>/questions.xlsx")
    def api_export_kahoot_run_questions(run_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        run = db.session.get(KahootRun, run_id)
        if not run:
            return jsonify({"error": "Kahoot section not found."}), 404

        questions = SessionQuestion.query.filter_by(kahoot_run_id=run.id).order_by(
            SessionQuestion.position.asc(),
            SessionQuestion.id.asc(),
        ).all()
        if not questions:
            return jsonify({"error": "Add at least one question before exporting this section."}), 400

        run.status = "exported"
        _stamp_kahoot_run_status(run, "exported")
        _update_session_kahoot_status(run.workshop_session)
        db.session.commit()

        workbook = _kahoot_xlsx_bytes(run.title, questions)
        filename = f"{_safe_filename(run.title)}-questions.xlsx"
        return send_file(
            BytesIO(workbook),
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    @app.get("/api/sessions/<int:session_id>/kahoot-export.zip")
    def api_export_session_kahoot_runs(session_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        workshop_session = db.session.get(WorkshopSession, session_id)
        if not workshop_session:
            return jsonify({"error": "Session not found."}), 404

        runs = KahootRun.query.filter_by(workshop_session_id=session_id).order_by(KahootRun.position.asc(), KahootRun.id.asc()).all()
        exported_count = 0
        output = BytesIO()
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            for run in runs:
                questions = SessionQuestion.query.filter_by(kahoot_run_id=run.id).order_by(
                    SessionQuestion.position.asc(),
                    SessionQuestion.id.asc(),
                ).all()
                if not questions:
                    continue
                filename = f"{run.position:02d}-{_safe_filename(run.title)}.xlsx"
                archive.writestr(filename, _kahoot_xlsx_bytes(run.title, questions))
                run.status = "exported"
                _stamp_kahoot_run_status(run, "exported")
                exported_count += 1

        if exported_count == 0:
            return jsonify({"error": "Add questions to at least one section before exporting."}), 400

        _update_session_kahoot_status(workshop_session)
        db.session.commit()

        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name=f"session-{workshop_session.id}-kahoot-sections.zip",
            mimetype="application/zip",
        )

    @app.post("/api/kahoot-runs/<int:run_id>/results")
    def api_import_kahoot_results(run_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        run = db.session.get(KahootRun, run_id)
        if not run:
            return jsonify({"error": "Kahoot section not found."}), 404

        payload = request.get_json(silent=True) or {}
        rows = payload.get("results", [])
        if not isinstance(rows, list):
            return jsonify({"error": "Results must be a list."}), 400

        _replace_kahoot_results(run, rows)
        db.session.commit()

        results = KahootResult.query.filter_by(kahoot_run_id=run.id).order_by(KahootResult.kahoot_points.desc()).all()
        return jsonify({
            "kahoot_run": _kahoot_run_payload(run),
            "results": [_kahoot_result_payload(result) for result in results],
        })

    @app.post("/api/kahoot-runs/<int:run_id>/results/upload")
    def api_upload_kahoot_results(run_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        run = db.session.get(KahootRun, run_id)
        if not run:
            return jsonify({"error": "Kahoot section not found."}), 404

        uploaded_file = request.files.get("file")
        if not uploaded_file:
            return jsonify({"error": "Upload a Kahoot results file."}), 400

        filename = uploaded_file.filename or ""
        data = uploaded_file.read()
        try:
            rows = _parse_result_file(filename, data)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        _replace_kahoot_results(run, rows)
        db.session.commit()

        results = KahootResult.query.filter_by(kahoot_run_id=run.id).order_by(KahootResult.kahoot_points.desc()).all()
        return jsonify({
            "kahoot_run": _kahoot_run_payload(run),
            "results": [_kahoot_result_payload(result) for result in results],
        })

    @app.patch("/api/kahoot-results/<int:result_id>")
    def api_update_kahoot_result(result_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        result = db.session.get(KahootResult, result_id)
        if not result:
            return jsonify({"error": "Kahoot result not found."}), 404
        if result.applied:
            return jsonify({"error": "Applied results cannot be edited."}), 400

        payload = request.get_json(silent=True) or {}
        if "student_id" in payload:
            student_id = _safe_int(payload.get("student_id"), default=0, minimum=0, maximum=999999)
            student = db.session.get(Student, student_id) if student_id else None
            if student and not _student_belongs_to_cohort(student, result.kahoot_run.workshop_session.cohort_id):
                return jsonify({"error": "Student must belong to the same cohort as the session."}), 400
            result.student_id = student.id if student else None
            result.match_status = "matched" if student else "review"
        if "awarded_points" in payload:
            result.awarded_points = _safe_int(payload.get("awarded_points"), default=result.awarded_points or 0, minimum=0, maximum=20000)

        db.session.commit()
        return jsonify({"result": _kahoot_result_payload(result)})

    @app.post("/api/kahoot-runs/<int:run_id>/apply-results")
    def api_apply_kahoot_results(run_id: int):
        auth_error = _require_admin()
        if auth_error:
            return auth_error

        run = db.session.get(KahootRun, run_id)
        if not run:
            return jsonify({"error": "Kahoot section not found."}), 404

        _ensure_score_entries(run.workshop_session)
        unapplied_results = KahootResult.query.filter_by(kahoot_run_id=run.id, applied=False).all()
        applied_count = 0

        for result in unapplied_results:
            if not result.student_id:
                continue
            entry = ScoreEntry.query.filter_by(
                student_id=result.student_id,
                workshop_session_id=run.workshop_session_id,
            ).first()
            if not entry:
                continue

            entry.present = True
            entry.kahoot_points = int(entry.kahoot_points or 0) + int(result.awarded_points or 0)
            entry.base_points = compute_rubric_points(entry)
            result.applied = True
            applied_count += 1

        run.status = "applied"
        run.applied_at = datetime.utcnow()
        if run.workshop_session.status == "draft":
            run.workshop_session.status = "review"
        _update_session_kahoot_status(run.workshop_session)
        db.session.commit()

        results = KahootResult.query.filter_by(kahoot_run_id=run.id).order_by(KahootResult.kahoot_points.desc()).all()
        return jsonify({
            "applied_count": applied_count,
            "kahoot_run": _kahoot_run_payload(run),
            "results": [_kahoot_result_payload(result) for result in results],
            "session": _session_payload(run.workshop_session),
        })

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
    memberships = sorted(
        student.cohort_memberships,
        key=lambda membership: membership.cohort.name.lower() if membership.cohort else "",
    )
    cohort_ids = [membership.cohort_id for membership in memberships]
    cohort_names = [membership.cohort.name for membership in memberships if membership.cohort]
    primary_cohort_id = student.cohort_id or (cohort_ids[0] if cohort_ids else None)

    return {
        "id": student.id,
        "cohort_id": primary_cohort_id,
        "cohort_ids": cohort_ids,
        "cohort_name": student.cohort.name if student.cohort else (cohort_names[0] if cohort_names else None),
        "cohort_names": cohort_names,
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
        "kahoot_run_id": question.kahoot_run_id,
        "position": question.position,
        "prompt": question.prompt,
        "options": options,
        "correct_option": question.correct_option,
        "time_limit_seconds": question.time_limit_seconds,
        "points": question.points,
        "kahoot_question_id": question.kahoot_question_id,
    }


def _kahoot_run_payload(run: KahootRun) -> dict:
    question_count = SessionQuestion.query.filter_by(kahoot_run_id=run.id).count()
    result_count = KahootResult.query.filter_by(kahoot_run_id=run.id).count()
    matched_count = KahootResult.query.filter_by(kahoot_run_id=run.id, match_status="matched").count()

    return {
        "id": run.id,
        "session_id": run.workshop_session_id,
        "position": run.position,
        "title": run.title,
        "section_label": run.section_label,
        "status": run.status,
        "kahoot_url": run.kahoot_url,
        "report_url": run.report_url,
        "notes": run.notes or "",
        "exported_at": run.exported_at.isoformat() if run.exported_at else None,
        "hosted_at": run.hosted_at.isoformat() if run.hosted_at else None,
        "results_imported_at": run.results_imported_at.isoformat() if run.results_imported_at else None,
        "applied_at": run.applied_at.isoformat() if run.applied_at else None,
        "question_count": question_count,
        "result_count": result_count,
        "matched_count": matched_count,
    }


def _kahoot_result_payload(result: KahootResult) -> dict:
    return {
        "id": result.id,
        "kahoot_run_id": result.kahoot_run_id,
        "student_id": result.student_id,
        "student_code": student_code(result.student_id) if result.student_id else None,
        "student_name": result.student.name if result.student else None,
        "nickname": result.nickname,
        "identifier": result.identifier,
        "correct_count": int(result.correct_count or 0),
        "total_questions": int(result.total_questions or 0),
        "kahoot_points": int(result.kahoot_points or 0),
        "awarded_points": int(result.awarded_points or 0),
        "match_status": result.match_status,
        "applied": bool(result.applied),
    }


def _replace_kahoot_results(run: KahootRun, rows: list[dict]) -> None:
    KahootResult.query.filter_by(kahoot_run_id=run.id).delete()
    for row in rows:
        if not isinstance(row, dict):
            continue

        nickname = str(row.get("nickname") or row.get("name") or row.get("player") or "").strip()
        identifier = str(row.get("identifier") or row.get("player_identifier") or row.get("email") or nickname).strip()
        if not nickname and identifier:
            nickname = identifier
        if not nickname:
            continue

        correct_count = _safe_int(row.get("correct_count") or row.get("correct"), default=0, minimum=0, maximum=999)
        total_questions = _safe_int(row.get("total_questions") or row.get("total"), default=0, minimum=0, maximum=999)
        kahoot_points = _safe_int(row.get("kahoot_points") or row.get("points") or row.get("score"), default=0, minimum=0, maximum=999999)
        matched_student = _match_kahoot_student(run.workshop_session, identifier, nickname)
        awarded_points = _awarded_points_for_result(run, correct_count, total_questions, kahoot_points)

        db.session.add(KahootResult(
            kahoot_run_id=run.id,
            student_id=matched_student.id if matched_student else None,
            nickname=nickname,
            identifier=identifier or None,
            correct_count=correct_count,
            total_questions=total_questions,
            kahoot_points=kahoot_points,
            awarded_points=awarded_points,
            match_status="matched" if matched_student else "review",
            raw_payload=json.dumps(row, ensure_ascii=True),
            applied=False,
        ))

    run.status = "results-imported"
    run.results_imported_at = datetime.utcnow()
    _update_session_kahoot_status(run.workshop_session)


def _kahoot_xlsx_bytes(title: str, questions: list[SessionQuestion]) -> bytes:
    rows = [
        [],
        ["", "Quiz template"],
        ["", "Add questions, at least two answer alternatives, time limit and choose correct answer(s)."],
        ["", "Remember: questions have a limit of 120 characters and answers have a limit of 75 characters."],
        ["", "See an example question below. Replace it with your own questions before importing."],
        ["", "And remember, if you're not using Excel you need to export to .xlsx format before importing to Kahoot."],
        [],
        [
            "",
            "Question - max 120 characters",
            "Answer 1 - max 75 characters",
            "Answer 2 - max 75 characters",
            "Answer 3 - max 75 characters",
            "Answer 4 - max 75 characters",
            "Time limit (sec) - 5, 10, 20, 30, 60, 90, 120, or 240 secs",
            "Correct answer(s) - choose at least one",
        ],
    ]

    for index, question in enumerate(questions, start=1):
        options = [question.option_a, question.option_b, question.option_c or "", question.option_d or ""]
        rows.append([
            str(index),
            question.prompt[:120],
            *(option[:75] for option in options),
            str(_valid_kahoot_time_limit(question.time_limit_seconds)),
            str(["A", "B", "C", "D"].index(question.correct_option) + 1),
        ])

    for index in range(len(questions) + 1, 101):
        rows.append([str(index)])

    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _xlsx_content_types_xml())
        archive.writestr("_rels/.rels", _xlsx_root_rels_xml())
        archive.writestr("xl/workbook.xml", _xlsx_workbook_xml(title))
        archive.writestr("xl/_rels/workbook.xml.rels", _xlsx_workbook_rels_xml())
        archive.writestr("xl/worksheets/sheet1.xml", _xlsx_sheet_xml(rows))
        archive.writestr("docProps/app.xml", _xlsx_app_xml())
        archive.writestr("docProps/core.xml", _xlsx_core_xml())
    return output.getvalue()


def _valid_kahoot_time_limit(value: int) -> int:
    valid_values = [5, 10, 20, 30, 60, 90, 120, 240]
    value = int(value or 20)
    return min(valid_values, key=lambda allowed: abs(allowed - value))


def _xlsx_sheet_xml(rows: list[list[str]]) -> str:
    row_xml = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for column_index, value in enumerate(row, start=1):
            if value == "":
                continue
            reference = f"{_xlsx_column_name(column_index)}{row_index}"
            cells.append(f'<c r="{reference}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>')
        row_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheetData>'
        f'{"".join(row_xml)}'
        '</sheetData></worksheet>'
    )


def _xlsx_column_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def _xlsx_content_types_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        '</Types>'
    )


def _xlsx_root_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )


def _xlsx_workbook_xml(title: str) -> str:
    sheet_name = escape((title or "Kahoot")[:31])
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{sheet_name}" sheetId="1" r:id="rId1"/></sheets>'
        '</workbook>'
    )


def _xlsx_workbook_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '</Relationships>'
    )


def _xlsx_app_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<Application>Amal BIlm Leaderboard</Application></Properties>'
    )


def _xlsx_core_xml() -> str:
    timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        '<dc:creator>Amal BIlm Leaderboard</dc:creator>'
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{timestamp}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{timestamp}</dcterms:modified>'
        '</cp:coreProperties>'
    )


def _parse_result_file(filename: str, data: bytes) -> list[dict]:
    lower_name = filename.lower()
    if lower_name.endswith(".xlsx"):
        return _parse_result_xlsx(data)
    if lower_name.endswith(".csv") or lower_name.endswith(".txt"):
        return _parse_result_csv(data.decode("utf-8-sig", errors="replace"))
    raise ValueError("Upload a .csv or .xlsx Kahoot results file.")


def _parse_result_csv(text: str) -> list[dict]:
    rows = list(csv.reader(StringIO(text)))
    return _result_rows_from_table(rows)


def _parse_result_xlsx(data: bytes) -> list[dict]:
    try:
        archive = zipfile.ZipFile(BytesIO(data))
        shared_strings = _xlsx_shared_strings(archive)
        sheet_name = _first_xlsx_sheet_name(archive)
        sheet = ET.fromstring(archive.read(sheet_name))
    except Exception as exc:
        raise ValueError("Could not read that .xlsx results file.") from exc

    namespace = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rows: list[list[str]] = []
    for row in sheet.findall(".//a:row", namespace):
        values: list[str] = []
        for cell in row.findall("a:c", namespace):
            column_index = _xlsx_column_index(re.sub(r"\d+", "", cell.attrib.get("r", "A")))
            while len(values) < column_index - 1:
                values.append("")
            values.append(_xlsx_cell_value(cell, shared_strings, namespace))
        rows.append(values)
    return _result_rows_from_table(rows)


def _xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    namespace = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    return [
        "".join(text.text or "" for text in item.findall(".//a:t", namespace))
        for item in root.findall("a:si", namespace)
    ]


def _first_xlsx_sheet_name(archive: zipfile.ZipFile) -> str:
    sheet_names = [name for name in archive.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")]
    if not sheet_names:
        raise ValueError("No worksheet found.")
    return sorted(sheet_names)[0]


def _xlsx_cell_value(cell: ET.Element, shared_strings: list[str], namespace: dict[str, str]) -> str:
    if cell.attrib.get("t") == "inlineStr":
        return "".join(text.text or "" for text in cell.findall(".//a:t", namespace)).strip()

    value = cell.find("a:v", namespace)
    if value is None or value.text is None:
        return ""
    raw_value = value.text.strip()
    if cell.attrib.get("t") == "s":
        index = _safe_int(raw_value, default=-1, minimum=-1, maximum=999999)
        return shared_strings[index].strip() if 0 <= index < len(shared_strings) else ""
    return raw_value


def _xlsx_column_index(column_name: str) -> int:
    total = 0
    for character in column_name.upper():
        if not character.isalpha():
            continue
        total = total * 26 + ord(character) - 64
    return max(total, 1)


def _result_rows_from_table(rows: list[list[str]]) -> list[dict]:
    clean_rows = [[str(value or "").strip() for value in row] for row in rows if any(str(value or "").strip() for value in row)]
    if not clean_rows:
        raise ValueError("No result rows were found in that file.")

    header_index = _find_result_header_index(clean_rows)
    headers = [_normalize_result_header(value) for value in clean_rows[header_index]]
    parsed_rows: list[dict] = []
    for row in clean_rows[header_index + 1:]:
        row_by_header = {
            headers[index]: row[index].strip()
            for index in range(min(len(headers), len(row)))
            if headers[index]
        }
        parsed = _result_payload_from_row(row_by_header, row)
        if parsed:
            parsed_rows.append(parsed)

    if not parsed_rows:
        raise ValueError("No usable Kahoot result rows were found.")
    return parsed_rows


def _find_result_header_index(rows: list[list[str]]) -> int:
    for index, row in enumerate(rows[:20]):
        normalized = [_normalize_result_header(value) for value in row]
        has_name = any(header in {"nickname", "identifier", "player", "name"} for header in normalized)
        has_score = any(header in {"score", "points", "kahoot_points"} for header in normalized)
        has_correct = any(header in {"correct", "correct_count"} for header in normalized)
        if has_name and (has_score or has_correct):
            return index
    return 0


def _normalize_result_header(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    if normalized in {"nickname", "player_nickname", "display_name", "player"}:
        return "nickname"
    if normalized in {"student_id", "identifier", "player_identifier", "user_id", "email"}:
        return "identifier"
    if normalized in {"name", "player_name"}:
        return "name"
    if "correct" in normalized:
        return "correct_count"
    if normalized in {"total", "total_questions", "questions"} or ("total" in normalized and "question" in normalized):
        return "total_questions"
    if "score" in normalized:
        return "score"
    if "point" in normalized:
        return "points"
    return normalized


def _result_payload_from_row(row_by_header: dict[str, str], row: list[str]) -> Optional[dict]:
    nickname = row_by_header.get("nickname") or row_by_header.get("name") or (row[0] if row else "")
    identifier = row_by_header.get("identifier") or nickname
    if not nickname and not identifier:
        return None

    correct_count = _first_int(row_by_header, ["correct_count", "correct"])
    total_questions = _first_int(row_by_header, ["total_questions", "total"])
    kahoot_points = _first_int(row_by_header, ["kahoot_points", "points", "score"])

    return {
        "nickname": nickname,
        "identifier": identifier,
        "correct_count": correct_count,
        "total_questions": total_questions,
        "kahoot_points": kahoot_points,
    }


def _first_int(row: dict[str, str], keys: list[str]) -> int:
    for key in keys:
        if key in row:
            return _safe_int(str(row.get(key, "")).replace(",", ""), default=0, minimum=0, maximum=999999)
    return 0


def _safe_filename(value: str) -> str:
    filename = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-")
    return filename[:80] or "kahoot-section"


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
    students = Student.query.join(StudentCohortMembership).filter(
        StudentCohortMembership.cohort_id == workshop_session.cohort_id
    ).distinct().all()
    for student in students:
        if student.id not in existing_student_ids:
            db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=workshop_session.id))


def _create_default_session_sections(workshop_session: WorkshopSession) -> None:
    existing_count = KahootRun.query.filter_by(workshop_session_id=workshop_session.id).count()
    if existing_count:
        return

    for index, (title, notes) in enumerate(DEFAULT_SESSION_SECTIONS, start=1):
        db.session.add(KahootRun(
            workshop_session_id=workshop_session.id,
            position=index,
            title=title,
            section_label=f"{index:02d}",
            notes=notes,
            status="draft",
        ))


def _next_kahoot_run_position(session_id: int) -> int:
    current_max = db.session.query(db.func.max(KahootRun.position)).filter_by(workshop_session_id=session_id).scalar()
    return int(current_max or 0) + 1


def _compact_kahoot_run_positions(session_id: int) -> None:
    runs = KahootRun.query.filter_by(workshop_session_id=session_id).order_by(KahootRun.position.asc(), KahootRun.id.asc()).all()
    for index, run in enumerate(runs, start=1):
        run.position = index


def _parse_cohort_ids(payload: dict, fallback: Optional[list[int]] = None) -> list[int]:
    raw_ids = payload.get("cohort_ids")
    if raw_ids is None:
        raw_ids = fallback if fallback is not None else [payload.get("cohort_id")]
    if not isinstance(raw_ids, list):
        raw_ids = [raw_ids]

    parsed: list[int] = []
    for raw_id in raw_ids:
        cohort_id = _safe_int(raw_id, default=0, minimum=0, maximum=999999)
        if cohort_id and cohort_id not in parsed:
            parsed.append(cohort_id)
    return parsed


def _valid_cohorts(cohort_ids: list[int]) -> list[Cohort]:
    if not cohort_ids:
        return []

    cohorts_by_id = {
        cohort.id: cohort
        for cohort in Cohort.query.filter(Cohort.id.in_(cohort_ids)).all()
    }
    return [cohorts_by_id[cohort_id] for cohort_id in cohort_ids if cohort_id in cohorts_by_id]


def _sync_student_cohorts(student: Student, cohort_ids: list[int]) -> None:
    existing_ids = {membership.cohort_id for membership in student.cohort_memberships}
    desired_ids = set(cohort_ids)

    for membership in list(student.cohort_memberships):
        if membership.cohort_id not in desired_ids:
            db.session.delete(membership)

    for cohort_id in cohort_ids:
        if cohort_id not in existing_ids:
            db.session.add(StudentCohortMembership(student_id=student.id, cohort_id=cohort_id))


def _ensure_student_scores_for_cohorts(student: Student, cohort_ids: list[int]) -> None:
    if not cohort_ids:
        return

    existing_session_ids = {
        row[0]
        for row in db.session.query(ScoreEntry.workshop_session_id).filter_by(student_id=student.id).all()
    }
    sessions = WorkshopSession.query.filter(WorkshopSession.cohort_id.in_(cohort_ids)).all()
    for workshop_session in sessions:
        if workshop_session.id not in existing_session_ids:
            db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=workshop_session.id))


def _student_belongs_to_cohort(student: Student, cohort_id: Optional[int]) -> bool:
    if not cohort_id:
        return False
    return any(membership.cohort_id == cohort_id for membership in student.cohort_memberships)


def _stamp_kahoot_run_status(run: KahootRun, status: str) -> None:
    now = datetime.utcnow()
    if status == "exported" and not run.exported_at:
        run.exported_at = now
    elif status == "hosted" and not run.hosted_at:
        run.hosted_at = now
    elif status == "results-imported" and not run.results_imported_at:
        run.results_imported_at = now
    elif status in ["reviewed", "applied"] and not run.applied_at:
        run.applied_at = now


def _update_session_kahoot_status(workshop_session: WorkshopSession) -> None:
    runs = KahootRun.query.filter_by(workshop_session_id=workshop_session.id).all()
    statuses = {run.status for run in runs}
    if "applied" in statuses or "reviewed" in statuses:
        workshop_session.kahoot_status = "reviewed"
    elif "results-imported" in statuses:
        workshop_session.kahoot_status = "results-imported"
    elif "hosted" in statuses:
        workshop_session.kahoot_status = "hosted"
    elif "exported" in statuses:
        workshop_session.kahoot_status = "exported"
    else:
        workshop_session.kahoot_status = "questions-ready"


def _match_kahoot_student(workshop_session: WorkshopSession, identifier: str, nickname: str) -> Optional[Student]:
    if not workshop_session.cohort_id:
        return None

    candidates = [_normalize_identifier(identifier), _normalize_identifier(nickname)]
    candidates = [candidate for candidate in candidates if candidate]
    if not candidates:
        return None

    students = Student.query.join(StudentCohortMembership).filter(
        StudentCohortMembership.cohort_id == workshop_session.cohort_id
    ).distinct().all()
    for student in students:
        student_identifiers = {
            _normalize_identifier(student.kahoot_identifier or ""),
            _normalize_identifier(student_code(student.id)),
        }
        if any(candidate in student_identifiers for candidate in candidates):
            return student

    return None


def _normalize_identifier(value: str) -> str:
    return str(value or "").strip().lower()


def _awarded_points_for_result(run: KahootRun, correct_count: int, total_questions: int, kahoot_points: int) -> int:
    question_points = [
        int(question.points or 0)
        for question in SessionQuestion.query.filter_by(kahoot_run_id=run.id).all()
    ]
    possible_points = sum(question_points)
    if possible_points and total_questions > 0:
        return round((correct_count / total_questions) * possible_points)

    return min(kahoot_points, 20000)


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
