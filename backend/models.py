from __future__ import annotations

from extensions import db


class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cohort_id = db.Column(db.Integer, db.ForeignKey("cohort.id"), nullable=True)
    name = db.Column(db.String(120), nullable=False, unique=True)

    scores = db.relationship("ScoreEntry", backref="student", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Student {self.name}>"


class Cohort(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)

    students = db.relationship("Student", backref="cohort")
    sessions = db.relationship("WorkshopSession", backref="cohort")

    def __repr__(self) -> str:
        return f"<Cohort {self.name}>"


class WorkshopSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cohort_id = db.Column(db.Integer, db.ForeignKey("cohort.id"), nullable=True)
    session_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)

    scores = db.relationship("ScoreEntry", backref="workshop_session", cascade="all, delete-orphan")
    questions = db.relationship(
        "SessionQuestion",
        backref="workshop_session",
        cascade="all, delete-orphan",
        order_by="SessionQuestion.position",
    )

    def __repr__(self) -> str:
        return f"<WorkshopSession {self.session_date.isoformat()} {self.start_time}>"


class SessionQuestion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    workshop_session_id = db.Column(db.Integer, db.ForeignKey("workshop_session.id"), nullable=False)

    position = db.Column(db.Integer, nullable=False, default=1)
    prompt = db.Column(db.Text, nullable=False)
    option_a = db.Column(db.String(255), nullable=False)
    option_b = db.Column(db.String(255), nullable=False)
    option_c = db.Column(db.String(255), nullable=True)
    option_d = db.Column(db.String(255), nullable=True)
    correct_option = db.Column(db.String(1), nullable=False)
    time_limit_seconds = db.Column(db.Integer, nullable=False, default=20)
    points = db.Column(db.Integer, nullable=False, default=1000)
    kahoot_question_id = db.Column(db.String(120), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("workshop_session_id", "position", name="uniq_session_question_position"),
    )


class ScoreEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    workshop_session_id = db.Column(db.Integer, db.ForeignKey("workshop_session.id"), nullable=False)

    present = db.Column(db.Boolean, default=False)
    arrival_time = db.Column(db.Time, nullable=True)

    meaningful_question = db.Column(db.Boolean, default=False)
    distracts_others = db.Column(db.Boolean, default=False)
    connects_ideas = db.Column(db.Boolean, default=False)
    challenges_assumption = db.Column(db.Boolean, default=False)
    learning_risk = db.Column(db.Boolean, default=False)
    answers_question = db.Column(db.Boolean, default=False)

    contributed_dynamic = db.Column(db.Boolean, default=False)
    included_all = db.Column(db.Boolean, default=False)
    allocated_tasks = db.Column(db.Boolean, default=False)
    leadership_or_follow = db.Column(db.Boolean, default=False)
    helped_fellow_muslim = db.Column(db.Boolean, default=False)

    includes_others_salaam = db.Column(db.Boolean, default=False)
    respectful_to_all = db.Column(db.Boolean, default=False)
    on_phone_unneeded = db.Column(db.Boolean, default=False)
    interrupts_or_disrespect = db.Column(db.Boolean, default=False)

    completed_activity = db.Column(db.Boolean, default=False)
    expanded_activity = db.Column(db.Boolean, default=False)

    base_points = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text, default="")

    __table_args__ = (
        db.UniqueConstraint("student_id", "workshop_session_id", name="uniq_student_workshop_session"),
    )
