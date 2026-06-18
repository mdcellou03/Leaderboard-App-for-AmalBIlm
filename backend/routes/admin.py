from __future__ import annotations

from datetime import date, time
from typing import Optional

from flask import Flask, flash, redirect, render_template, request, url_for

from backend.extensions import db
from backend.models import Cohort, ScoreEntry, Student, WorkshopSession
from backend.routes.auth import login_required
from backend.services.scoring import compute_base_points


def register_admin_routes(app: Flask) -> None:
    @app.get("/admin")
    @login_required
    def admin():
        cohorts = Cohort.query.order_by(Cohort.name.asc()).all()
        students = Student.query.order_by(Student.name.asc()).all()
        sessions = WorkshopSession.query.order_by(
            WorkshopSession.session_date.desc(),
            WorkshopSession.start_time.desc(),
        ).all()
        return render_template("admin.html", cohorts=cohorts, students=students, sessions=sessions)

    @app.post("/admin/add-cohort")
    @login_required
    def add_cohort():
        name = (request.form.get("name") or "").strip()
        if not name:
            flash("Cohort name is required.", "error")
            return redirect(url_for("admin"))

        existing = Cohort.query.filter_by(name=name).first()
        if existing:
            flash("That cohort already exists.", "error")
            return redirect(url_for("admin"))

        db.session.add(Cohort(name=name))
        db.session.commit()
        flash(f"Added cohort: {name}", "ok")
        return redirect(url_for("admin"))

    @app.post("/admin/add-student")
    @login_required
    def add_student():
        name = (request.form.get("name") or "").strip()
        if not name:
            flash("Student name is required.", "error")
            return redirect(url_for("admin"))

        try:
            existing = Student.query.filter_by(name=name).first()
            if existing:
                flash("That student already exists.", "error")
                return redirect(url_for("admin"))

            student = Student(name=name)
            db.session.add(student)
            db.session.commit()

            for sess in WorkshopSession.query.all():
                exists = ScoreEntry.query.filter_by(
                    student_id=student.id,
                    workshop_session_id=sess.id,
                ).first()
                if not exists:
                    db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=sess.id))
            db.session.commit()

            flash(f"Added student: {name}", "ok")
            return redirect(url_for("admin"))

        except Exception:
            db.session.rollback()
            flash("Something went wrong while adding the student.", "error")
            return redirect(url_for("admin"))

    @app.post("/admin/add-session")
    @login_required
    def add_session():
        if Student.query.count() == 0:
            flash("Add students first (no students found).", "error")
            return redirect(url_for("admin"))

        date_str = request.form.get("session_date")
        time_str = request.form.get("start_time")
        cohort_id = _optional_int_field("cohort_id")

        if not date_str or not time_str:
            flash("Session date and start time are required.", "error")
            return redirect(url_for("admin"))

        try:
            session_date = date.fromisoformat(date_str)
            start_time = time.fromisoformat(time_str)
        except ValueError:
            flash("Invalid date or time format.", "error")
            return redirect(url_for("admin"))

        if cohort_id and not db.session.get(Cohort, cohort_id):
            flash("Selected cohort does not exist.", "error")
            return redirect(url_for("admin"))

        workshop_session = WorkshopSession(
            cohort_id=cohort_id,
            session_date=session_date,
            start_time=start_time,
        )
        db.session.add(workshop_session)
        db.session.commit()

        for student in Student.query.all():
            db.session.add(ScoreEntry(student_id=student.id, workshop_session_id=workshop_session.id))
        db.session.commit()

        flash("Session created. Now enter scores.", "ok")
        return redirect(url_for("admin_session", workshop_session_id=workshop_session.id))

    @app.get("/admin/session/<int:workshop_session_id>")
    @login_required
    def admin_session(workshop_session_id: int):
        workshop_session = WorkshopSession.query.get_or_404(workshop_session_id)
        students = Student.query.order_by(Student.name.asc()).all()
        entries = ScoreEntry.query.filter_by(workshop_session_id=workshop_session_id).all()
        entry_by_student = {entry.student_id: entry for entry in entries}
        return render_template(
            "admin_session.html",
            sess=workshop_session,
            students=students,
            entry_by_student=entry_by_student,
        )

    @app.post("/admin/session/<int:workshop_session_id>/save")
    @login_required
    def save_session(workshop_session_id: int):
        workshop_session = WorkshopSession.query.get_or_404(workshop_session_id)
        students = Student.query.all()

        for student in students:
            entry = ScoreEntry.query.filter_by(
                workshop_session_id=workshop_session_id,
                student_id=student.id,
            ).first()
            if not entry:
                entry = ScoreEntry(workshop_session_id=workshop_session_id, student_id=student.id)
                db.session.add(entry)

            prefix = f"s{student.id}_"

            entry.present = _bool_field(prefix + "present")
            arrival = request.form.get(prefix + "arrival_time", "").strip()

            try:
                entry.arrival_time = time.fromisoformat(arrival) if (arrival and entry.present) else None
            except ValueError:
                flash(f"Invalid arrival time for {student.name}.", "error")
                return redirect(url_for("admin_session", workshop_session_id=workshop_session_id))

            entry.meaningful_question = _bool_field(prefix + "meaningful_question")
            entry.distracts_others = _bool_field(prefix + "distracts_others")
            entry.connects_ideas = _bool_field(prefix + "connects_ideas")
            entry.challenges_assumption = _bool_field(prefix + "challenges_assumption")
            entry.learning_risk = _bool_field(prefix + "learning_risk")
            entry.answers_question = _bool_field(prefix + "answers_question")

            entry.contributed_dynamic = _bool_field(prefix + "contributed_dynamic")
            entry.included_all = _bool_field(prefix + "included_all")
            entry.allocated_tasks = _bool_field(prefix + "allocated_tasks")
            entry.leadership_or_follow = _bool_field(prefix + "leadership_or_follow")
            entry.helped_fellow_muslim = _bool_field(prefix + "helped_fellow_muslim")

            entry.includes_others_salaam = _bool_field(prefix + "includes_others_salaam")
            entry.respectful_to_all = _bool_field(prefix + "respectful_to_all")
            entry.on_phone_unneeded = _bool_field(prefix + "on_phone_unneeded")
            entry.interrupts_or_disrespect = _bool_field(prefix + "interrupts_or_disrespect")

            entry.completed_activity = _bool_field(prefix + "completed_activity")
            entry.expanded_activity = _bool_field(prefix + "expanded_activity")

            entry.notes = (request.form.get(prefix + "notes") or "").strip()
            entry.base_points = compute_base_points(entry, workshop_session)

        db.session.commit()
        flash("Session saved.", "ok")
        return redirect(url_for("admin_session", workshop_session_id=workshop_session_id))


def _bool_field(name: str) -> bool:
    return request.form.get(name) == "on"


def _optional_int_field(name: str) -> Optional[int]:
    raw = request.form.get(name, "").strip()
    if not raw:
        return None

    try:
        return int(raw)
    except ValueError:
        return None
