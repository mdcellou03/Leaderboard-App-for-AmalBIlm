from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, date, time, timedelta
from typing import Optional, Dict, List, Tuple

from flask import Flask, render_template, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy

import os

app = Flask(__name__)
app.config["SECRET_KEY"] = "dev-change-me"  # change in production

# Put the SQLite file in Flask's instance folder (stable location)
os.makedirs(app.instance_path, exist_ok=True)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(app.instance_path, "leaderboard.db")

print("DB URI:", app.config["SQLALCHEMY_DATABASE_URI"])
print("INSTANCE PATH:", app.instance_path)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# -----------------------------
# Database Models
# -----------------------------
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)

    scores = db.relationship("ScoreEntry", backref="student", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Student {self.name}>"


class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)

    scores = db.relationship("ScoreEntry", backref="session", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Session {self.session_date.isoformat()} {self.start_time}>"


class ScoreEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey("session.id"), nullable=False)

    # Presence + punctuality input
    present = db.Column(db.Boolean, default=False)
    arrival_time = db.Column(db.Time, nullable=True)  # only if present

    # 2) Participation (each is cap 1)
    meaningful_question = db.Column(db.Boolean, default=False)     # +1 (cap 1)
    distracts_others = db.Column(db.Boolean, default=False)        # -1
    connects_ideas = db.Column(db.Boolean, default=False)          # +1
    challenges_assumption = db.Column(db.Boolean, default=False)   # +1
    learning_risk = db.Column(db.Boolean, default=False)           # +1
    answers_question = db.Column(db.Boolean, default=False)        # +1

    # 3) Teamwork (each +1)
    contributed_dynamic = db.Column(db.Boolean, default=False)     # +1
    included_all = db.Column(db.Boolean, default=False)            # +1
    allocated_tasks = db.Column(db.Boolean, default=False)         # +1
    leadership_or_follow = db.Column(db.Boolean, default=False)    # +1
    helped_peer = db.Column(db.Boolean, default=False)             # +1

    # 4) Adab (+1/+1/-1/-1)
    includes_others_salaam = db.Column(db.Boolean, default=False)  # +1
    respectful_to_all = db.Column(db.Boolean, default=False)       # +1
    on_phone_unneeded = db.Column(db.Boolean, default=False)       # -1
    interrupts_or_disrespect = db.Column(db.Boolean, default=False)# -1

    # 5) Deliverables (+1/+1)
    completed_activity = db.Column(db.Boolean, default=False)      # +1
    expanded_activity = db.Column(db.Boolean, default=False)       # +1

    # Total points for this student in this session (stored)
    base_points = db.Column(db.Integer, default=0)

    notes = db.Column(db.Text, default="")

    __table_args__ = (
        db.UniqueConstraint("student_id", "session_id", name="uniq_student_session"),
    )

with app.app_context():
    db.create_all()

# -----------------------------
# Scoring Rules (edit here)
# -----------------------------
def compute_base_points(entry: ScoreEntry, sess: Session) -> int:
    """
    New rules:
    Each category starts at 10 points IF the student is present.
    Categories:
      1) Punctuality
      2) Participation
      3) Teamwork
      4) Adab
      5) Deliverables
    """
    if not entry.present:
        return 0  # absent = 0 (adjust if you want a different policy)

    # If present but no arrival_time, treat as 0 (or you can treat as late)
    if not entry.arrival_time:
        return 0

    total = 0

    # ---- 1) Punctuality (start 10) ----
    punctuality = 10
    start_dt = datetime.combine(sess.session_date, sess.start_time)
    arrival_dt = datetime.combine(sess.session_date, entry.arrival_time)

    # On-time has a 5-minute buffer (arrival <= start + 5 min)
    if arrival_dt > (start_dt + timedelta(minutes=5)):
        punctuality -= 5  # late: -5
    total += punctuality

    # ---- 2) Participation (start 10) ----
    participation = 10
    if entry.meaningful_question:
        participation += 1  # cap 1
    if entry.distracts_others:
        participation -= 1
    if entry.connects_ideas:
        participation += 1
    if entry.challenges_assumption:
        participation += 1
    if entry.learning_risk:
        participation += 1
    if entry.answers_question:
        participation += 1
    total += participation

    # ---- 3) Teamwork (start 10) ----
    teamwork = 10
    teamwork += 1 if entry.contributed_dynamic else 0
    teamwork += 1 if entry.included_all else 0
    teamwork += 1 if entry.allocated_tasks else 0
    teamwork += 1 if entry.leadership_or_follow else 0
    teamwork += 1 if entry.helped_peer else 0
    total += teamwork

    # ---- 4) Adab (start 10) ----
    adab = 10
    adab += 1 if entry.includes_others_salaam else 0
    adab += 1 if entry.respectful_to_all else 0
    adab -= 1 if entry.on_phone_unneeded else 0
    adab -= 1 if entry.interrupts_or_disrespect else 0
    total += adab

    # ---- 5) Deliverables (start 10) ----
    deliverables = 10
    deliverables += 1 if entry.completed_activity else 0
    deliverables += 1 if entry.expanded_activity else 0
    total += deliverables

    return total


def compute_leaderboard() -> List[dict]:
    """Compute totals (sum of base_points) and a simple attendance streak."""
    students = Student.query.order_by(Student.name.asc()).all()
    sessions = Session.query.order_by(Session.session_date.asc(), Session.start_time.asc()).all()

    entries = ScoreEntry.query.all()
    entry_map: Dict[Tuple[int, int], ScoreEntry] = {(e.student_id, e.session_id): e for e in entries}

    results = []
    for s in students:
        attendance = 0
        total = 0

        for sess in sessions:
            e = entry_map.get((s.id, sess.id))
            if not e:
                continue

            # Total points are just the stored base points for that session
            total += int(e.base_points or 0)

            # Streak: consecutive sessions where present == True
            if e.present:
                attendance += 1
            else:
                attendance = 0

        results.append({
            "id": s.id,
            "name": s.name,
            "total": total,
            "attendance": attendance,
        })

    results.sort(key=lambda r: (-r["total"], -r["attendance"], r["name"].lower()))
    for i, r in enumerate(results, start=1):
        r["rank"] = i
    return results


# -----------------------------
# Routes
# -----------------------------



@app.get("/")
def home():
    return redirect(url_for("leaderboard"))


@app.get("/leaderboard")
def leaderboard():
    board = compute_leaderboard()
    top3 = board[:3]
    rest = board[3:]
    return render_template("leaderboard.html", top3=top3, rest=rest)


@app.get("/rules")
def rules():
    return render_template("rules.html")


@app.get("/admin")
def admin():
    students = Student.query.order_by(Student.name.asc()).all()
    sessions = Session.query.order_by(Session.session_date.desc(), Session.start_time.desc()).all()
    return render_template("admin.html", students=students, sessions=sessions)


@app.post("/admin/add-student")
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

        st = Student(name=name)
        db.session.add(st)
        db.session.commit()

        # Backfill: create ScoreEntry for all existing sessions
        for sess in Session.query.all():
            exists = ScoreEntry.query.filter_by(student_id=st.id, session_id=sess.id).first()
            if not exists:
                db.session.add(ScoreEntry(student_id=st.id, session_id=sess.id))
        db.session.commit()

        flash(f"Added student: {name}", "ok")
        print("Added student OK:", name, "count:", Student.query.count())
        return redirect(url_for("admin"))

    except Exception as e:
        db.session.rollback()
        print("ERROR adding student:", repr(e))
        flash(f"Error adding student: {e}", "error")
        return redirect(url_for("admin"))


@app.post("/admin/add-session")
def add_session():
    if Student.query.count() == 0:
        flash("Add students first (no students found).", "error")
        return redirect(url_for("admin"))
    
    date_str = request.form.get("session_date")
    time_str = request.form.get("start_time")

    if not date_str or not time_str:
        flash("Session date and start time are required.", "error")
        return redirect(url_for("admin"))

    sess_date = date.fromisoformat(date_str)
    start_t = time.fromisoformat(time_str)

    sess = Session(session_date=sess_date, start_time=start_t)
    db.session.add(sess)
    db.session.commit()

    # Pre-create entries for all students for easier data entry
    students = Student.query.all()
    for s in students:
        e = ScoreEntry(student_id=s.id, session_id=sess.id)
        db.session.add(e)
    db.session.commit()

    flash("Session created. Now enter scores.", "ok")
    return redirect(url_for("admin_session", session_id=sess.id))


@app.get("/admin/session/<int:session_id>")
def admin_session(session_id: int):
    sess = Session.query.get_or_404(session_id)
    students = Student.query.order_by(Student.name.asc()).all()
    entries = ScoreEntry.query.filter_by(session_id=session_id).all()
    entry_by_student = {e.student_id: e for e in entries}
    return render_template(
        "admin_session.html",
        sess=sess,
        students=students,
        entry_by_student=entry_by_student,
    )


def _int_field(name: str, default: int = 0) -> int:
    raw = request.form.get(name, "")
    try:
        v = int(raw)
        return max(0, v)
    except ValueError:
        return default


def _bool_field(name: str) -> bool:
    return request.form.get(name) == "on"


@app.post("/admin/session/<int:session_id>/save")
def save_session(session_id: int):
    sess = Session.query.get_or_404(session_id)
    students = Student.query.all()

    for s in students:
        e: ScoreEntry = ScoreEntry.query.filter_by(session_id=session_id, student_id=s.id).first()
        if not e:
            e = ScoreEntry(session_id=session_id, student_id=s.id)
            db.session.add(e)

        prefix = f"s{s.id}_"

        e.present = _bool_field(prefix + "present")

        arrival = request.form.get(prefix + "arrival_time", "").strip()
        e.arrival_time = time.fromisoformat(arrival) if (arrival and e.present) else None

        # Participation
        e.meaningful_question = _bool_field(prefix + "meaningful_question")
        e.distracts_others = _bool_field(prefix + "distracts_others")
        e.connects_ideas = _bool_field(prefix + "connects_ideas")
        e.challenges_assumption = _bool_field(prefix + "challenges_assumption")
        e.learning_risk = _bool_field(prefix + "learning_risk")
        e.answers_question = _bool_field(prefix + "answers_question")

        # Teamwork
        e.contributed_dynamic = _bool_field(prefix + "contributed_dynamic")
        e.included_all = _bool_field(prefix + "included_all")
        e.allocated_tasks = _bool_field(prefix + "allocated_tasks")
        e.leadership_or_follow = _bool_field(prefix + "leadership_or_follow")
        e.helped_peer = _bool_field(prefix + "helped_peer")

        # Adab
        e.includes_others_salaam = _bool_field(prefix + "includes_others_salaam")
        e.respectful_to_all = _bool_field(prefix + "respectful_to_all")
        e.on_phone_unneeded = _bool_field(prefix + "on_phone_unneeded")
        e.interrupts_or_disrespect = _bool_field(prefix + "interrupts_or_disrespect")

        # Deliverables
        e.completed_activity = _bool_field(prefix + "completed_activity")
        e.expanded_activity = _bool_field(prefix + "expanded_activity")

        e.notes = (request.form.get(prefix + "notes") or "").strip()

        # Compute and store points
        e.base_points = compute_base_points(e, sess)

    db.session.commit()
    flash("Session saved.", "ok")
    return redirect(url_for("admin_session", session_id=session_id))


if __name__ == "__main__":
    app.run(debug=True)