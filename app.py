from __future__ import annotations
from dotenv import load_dotenv


#We need this in order to check whether a password matches the stored hashed password so that there's no direct password comparison
from werkzeug.security import check_password_hash
#Python’s random generator utils
import secrets
#Needed for session dates, start times, arrival times, and checking the studen'ts lateness.
from datetime import datetime, date, time, timedelta
from functools import wraps
from typing import Dict, List, Tuple

from flask import Flask, render_template, request, redirect, url_for, flash, session
#Lets us define database tables as Python classes
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect
#Imported for the purposes of limiting login attempts
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import os
load_dotenv()
app = Flask(__name__)

#We're creating the rate limiter here
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
)

#Checks whether the app is running in production
IS_PRODUCTION = os.environ.get("FLASK_ENV") == "production"


#This reads the app secret key from env - which is used for sessions and CSRF tokens. 
#Basically, if the app is run in production and there isn't any  secret key exists, we wnat it to crash immediately.

_secret_key = os.environ.get("SECRET_KEY")
if not _secret_key:
    if IS_PRODUCTION:
        raise RuntimeError("PLEASE USE SECRET_KEY for production")
    _secret_key = secrets.token_hex(32)
    print("WARNING: You are using a TEMPORARY development key - please set the secret key")

app.config["SECRET_KEY"] = _secret_key

ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "")

if not ADMIN_PASSWORD_HASH:
    if IS_PRODUCTION:
        raise RuntimeError("ADMIN_PASSWORD_HASH MUST be set in production")
    print("WARNING: ADMIN_PASSWORD_HASH not set, so admin login disabled.")

# Put the SQLite file in Flask's instance folder - if it doesn't already exist, this creates the flask instance folder 
os.makedirs(app.instance_path, exist_ok=True)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(app.instance_path, "leaderboard.db")

print("DB URI:", app.config["SQLALCHEMY_DATABASE_URI"])
print("INSTANCE PATH:", app.instance_path)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)
csrf = CSRFProtect(app)


# DATABASE MODELS

#Defines a database table for students
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)

    #Without delete-orphan, the ScoreEntry might remain in the db without being properly attached to a student
    scores = db.relationship("ScoreEntry", backref="student", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Student {self.name}>"



#Defines a database table for the workshop sessions
class WorkshopSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)

    #This connects WorkshopSession to ScoreEntry (one WorkshopSession can have multuple ScoreEntry records)
    scores = db.relationship("ScoreEntry", backref="workshop_session", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<WorkshopSession {self.session_date.isoformat()} {self.start_time}>"


#Defines a database model called ScoreEntry (a ScoreEntry represents one studetn's score for one workshop sesson)
class ScoreEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    workshop_session_id = db.Column(db.Integer, db.ForeignKey("workshop_session.id"), nullable=False)

    # Attendance and punctuality inputs
    present = db.Column(db.Boolean, default=False)
    arrival_time = db.Column(db.Time, nullable=True)  # only if present

    # 2) Participation inputs
    meaningful_question = db.Column(db.Boolean, default=False)     # +1 (cap 1)
    distracts_others = db.Column(db.Boolean, default=False)        # -1
    connects_ideas = db.Column(db.Boolean, default=False)          # +1
    challenges_assumption = db.Column(db.Boolean, default=False)   # +1
    learning_risk = db.Column(db.Boolean, default=False)           # +1
    answers_question = db.Column(db.Boolean, default=False)        # +1

    # 3) Teamwork
    contributed_dynamic = db.Column(db.Boolean, default=False)     # +1
    included_all = db.Column(db.Boolean, default=False)            # +1
    allocated_tasks = db.Column(db.Boolean, default=False)         # +1
    leadership_or_follow = db.Column(db.Boolean, default=False)    # +1
    helped_fellow_muslim = db.Column(db.Boolean, default=False)             # +1

    # 4) Adab
    includes_others_salaam = db.Column(db.Boolean, default=False)  # +1
    respectful_to_all = db.Column(db.Boolean, default=False)       # +1
    on_phone_unneeded = db.Column(db.Boolean, default=False)       # -1
    interrupts_or_disrespect = db.Column(db.Boolean, default=False)# -1

    # 5) Deliverables
    completed_activity = db.Column(db.Boolean, default=False)      # +1
    expanded_activity = db.Column(db.Boolean, default=False)       # +1

    # Total points for this student in this session (stored)
    base_points = db.Column(db.Integer, default=0)

    notes = db.Column(db.Text, default="")

    #db.UniqueConstraint means that our database will not allow two rows with the same student_id and workshop_session_id
    __table_args__ = (
        db.UniqueConstraint("student_id", "workshop_session_id", name="uniq_student_workshop_session"),
    )

#Tgus creates the database tables
with app.app_context():
    db.create_all()

# -----------------------------
# Scoring Rules (COMMENT FROM AMNA: THESE WERE RULES WE DECIDED ON IN ONE OF OUR ALAMBILM MEETINGS EARLIER - IF THESE WANT TO ME CHANGED, CHANGE HERE, AND YOU WILL ALSO HAVE TO UPDATE THE RULES.HTML FILE.)
# -----------------------------

# Defines a function that entry - a ScoreEntry objec, and sess - a WorkshopSession object and returns an integer score

def compute_base_points(entry: ScoreEntry, sess: WorkshopSession) -> int:
    """
    As we decided, each category starts at 10 points IF the student is present.
    Categories:
      1) Punctuality
      2) Participation
      3) Teamwork
      4) Adab
      5) Deliverables
    """
    #IF the student us absent, their score is automatically 0 

    if not entry.present:
        return 0  

    # If present but no arrival_time, treat as 0 - this is more of a consideration for the admin 
    if not entry.arrival_time:
        return 0

    total = 0

    # ---- 1) Punctuality (start 10) ----

    punctuality = 10
    start_dt = datetime.combine(sess.session_date, sess.start_time)
    arrival_dt = datetime.combine(sess.session_date, entry.arrival_time)


    # On-time has a 5-minute buffer as we decided

    if arrival_dt > (start_dt + timedelta(minutes=5)):
        punctuality -= 5  # late: -5
    total += punctuality

    # ---- 2) Participation (start 10) ----

    participation = 10
    if entry.meaningful_question:
        participation += 1 
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
    teamwork += 1 if entry.helped_fellow_muslim else 0
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

#Defines a function that calculates the leaderboard and returns a list of dictionaries - each one represents one student’s row on the leaderboard.

def compute_leaderboard() -> List[dict]:
    #Getting all students from the database - sorted alphabetically by name
    students = Student.query.order_by(Student.name.asc()).all()
    #Getting all workshop sessions from the database - they are sorted oldest to newest
    sessions = WorkshopSession.query.order_by(WorkshopSession.session_date.asc(), WorkshopSession.start_time.asc()).all()
    #Getting all score entries from the database
    entries = ScoreEntry.query.all()
    entry_map: Dict[Tuple[int, int], ScoreEntry] = {(e.student_id, e.workshop_session_id): e for e in entries}

    results = []
    for s in students:
        attendance = 0
        total = 0

        for sess in sessions:
            e = entry_map.get((s.id, sess.id))
            if not e:
                continue

            total += int(e.base_points or 0)

            if e.present:
                attendance += 1
            else:
                attendance = 0

        results.append({
            "id": s.id,
            "code": f"AB-{s.id:03d}",
            "name": s.name,
            "total": total,
            "attendance": attendance,
        })

    results.sort(key=lambda r: (-r["total"], -r["attendance"], r["name"].lower()))
    for i, r in enumerate(results, start=1):
        r["rank"] = i
    return results


# -----------------------------
# Authentication - please feel free to change completely ~ Amna 
# -----------------------------

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            flash("Please log in to access the admin area.", "error")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


@app.get("/login")
def login():
    if session.get("admin_logged_in"):
        return redirect(url_for("admin"))
    return render_template("login.html")


@app.post("/login")
@limiter.limit("5 per minute")
def login_post():
    password = request.form.get("password", "")

    if ADMIN_PASSWORD_HASH and check_password_hash(ADMIN_PASSWORD_HASH, password):
        session.clear()
        session["admin_logged_in"] = True
        return redirect(url_for("admin"))
    
    flash("Incorrect password.", "error")
    return redirect(url_for("login"))


@app.post("/logout")
def logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("leaderboard"))



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
@login_required
def admin():
    students = Student.query.order_by(Student.name.asc()).all()
    sessions = WorkshopSession.query.order_by(WorkshopSession.session_date.desc(), WorkshopSession.start_time.desc()).all()
    return render_template("admin.html", students=students, sessions=sessions)


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

        st = Student(name=name)
        db.session.add(st)
        db.session.commit()

        # Backfill: create ScoreEntry for all existing sessions
        for sess in WorkshopSession.query.all():
            exists = ScoreEntry.query.filter_by(student_id=st.id, workshop_session_id=sess.id).first()
            if not exists:
                db.session.add(ScoreEntry(student_id=st.id, workshop_session_id=sess.id))
        db.session.commit()

        flash(f"Added student: {name}", "ok")
        print("Added student OK:", name, "count:", Student.query.count())
        return redirect(url_for("admin"))

    except Exception as e:
        db.session.rollback()
        print("ERROR adding student:", repr(e))
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

    if not date_str or not time_str:
        flash("Session date and start time are required.", "error")
        return redirect(url_for("admin"))

    try:
        sess_date = date.fromisoformat(date_str)
        start_t = time.fromisoformat(time_str)
    except ValueError:
        flash("Invalid date or time format.", "error")
        return redirect(url_for("admin"))

    sess = WorkshopSession(session_date=sess_date, start_time=start_t)
    db.session.add(sess)
    db.session.commit()

    # Pre-create entries for all students for easier data entry
    students = Student.query.all()
    for s in students:
        e = ScoreEntry(student_id=s.id, workshop_session_id=sess.id)
        db.session.add(e)
    db.session.commit()

    flash("Session created. Now enter scores.", "ok")
    return redirect(url_for("admin_session", workshop_session_id=sess.id))


@app.get("/admin/session/<int:workshop_session_id>")
@login_required
def admin_session(workshop_session_id: int):
    sess = WorkshopSession.query.get_or_404(workshop_session_id)
    students = Student.query.order_by(Student.name.asc()).all()
    entries = ScoreEntry.query.filter_by(workshop_session_id=workshop_session_id).all()
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


@app.post("/admin/session/<int:workshop_session_id>/save")
@login_required
def save_session(workshop_session_id: int):
    sess = WorkshopSession.query.get_or_404(workshop_session_id)
    students = Student.query.all()

    for s in students:
        e: ScoreEntry = ScoreEntry.query.filter_by(workshop_session_id=workshop_session_id, student_id=s.id).first()
        if not e:
            e = ScoreEntry(workshop_session_id=workshop_session_id, student_id=s.id)
            db.session.add(e)

        prefix = f"s{s.id}_"

        e.present = _bool_field(prefix + "present")

        arrival = request.form.get(prefix + "arrival_time", "").strip()

        try:
            e.arrival_time = time.fromisoformat(arrival) if (arrival and e.present) else None
        except ValueError:
            flash(f"Invalid arrival time for {s.name}.", "error")
            return redirect(url_for("admin_session", workshop_session_id=workshop_session_id))

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
        e.helped_fellow_muslim = _bool_field(prefix + "helped_fellow_muslim")

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
    return redirect(url_for("admin_session", workshop_session_id=workshop_session_id))


if __name__ == "__main__":
    #This starts the Flask development server
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
