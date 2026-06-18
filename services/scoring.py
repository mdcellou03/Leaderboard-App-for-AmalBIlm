from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from models import ScoreEntry, Student, WorkshopSession
from services.students import student_code


def compute_base_points(entry: ScoreEntry, workshop_session: WorkshopSession) -> int:
    if not entry.present:
        return 0

    if not entry.arrival_time:
        return 0

    total = 0

    punctuality = 10
    start_dt = datetime.combine(workshop_session.session_date, workshop_session.start_time)
    arrival_dt = datetime.combine(workshop_session.session_date, entry.arrival_time)

    if arrival_dt > (start_dt + timedelta(minutes=5)):
        punctuality -= 5
    total += punctuality

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

    teamwork = 10
    teamwork += 1 if entry.contributed_dynamic else 0
    teamwork += 1 if entry.included_all else 0
    teamwork += 1 if entry.allocated_tasks else 0
    teamwork += 1 if entry.leadership_or_follow else 0
    teamwork += 1 if entry.helped_fellow_muslim else 0
    total += teamwork

    adab = 10
    adab += 1 if entry.includes_others_salaam else 0
    adab += 1 if entry.respectful_to_all else 0
    adab -= 1 if entry.on_phone_unneeded else 0
    adab -= 1 if entry.interrupts_or_disrespect else 0
    total += adab

    deliverables = 10
    deliverables += 1 if entry.completed_activity else 0
    deliverables += 1 if entry.expanded_activity else 0
    total += deliverables

    return total


def compute_leaderboard(cohort_id: Optional[int] = None) -> List[dict]:
    students = Student.query.order_by(Student.name.asc()).all()
    sessions_query = WorkshopSession.query
    if cohort_id is not None:
        sessions_query = sessions_query.filter_by(cohort_id=cohort_id)

    sessions = sessions_query.order_by(
        WorkshopSession.session_date.asc(),
        WorkshopSession.start_time.asc(),
    ).all()
    entries = ScoreEntry.query.all()
    entry_map: Dict[Tuple[int, int], ScoreEntry] = {
        (entry.student_id, entry.workshop_session_id): entry for entry in entries
    }

    results = []
    for student in students:
        attended_sessions = 0
        current_streak = 0
        total = 0

        for workshop_session in sessions:
            entry = entry_map.get((student.id, workshop_session.id))
            if not entry:
                continue

            total += int(entry.base_points or 0)

            if entry.present:
                attended_sessions += 1
                current_streak += 1
            else:
                current_streak = 0

        results.append(
            {
                "id": student.id,
                "code": student_code(student.id),
                "name": student.name,
                "total": total,
                "attended_sessions": attended_sessions,
                "current_streak": current_streak,
            }
        )

    results.sort(key=lambda row: (-row["total"], -row["current_streak"], row["name"].lower()))
    for rank, row in enumerate(results, start=1):
        row["rank"] = rank

    return results
