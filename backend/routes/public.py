from __future__ import annotations

from typing import Optional

from flask import Flask, redirect, render_template, request, url_for

from backend.extensions import db
from backend.models import Cohort
from backend.services.scoring import compute_leaderboard


def register_public_routes(app: Flask) -> None:
    @app.get("/")
    def home():
        return redirect(url_for("leaderboard"))

    @app.get("/leaderboard")
    def leaderboard():
        selected_cohort_id = _selected_cohort_id()
        cohorts = Cohort.query.order_by(Cohort.name.asc()).all()
        valid_cohort_ids = {cohort.id for cohort in cohorts}
        if selected_cohort_id not in valid_cohort_ids:
            selected_cohort_id = None

        selected_cohort = db.session.get(Cohort, selected_cohort_id) if selected_cohort_id else None
        board = compute_leaderboard(selected_cohort_id)
        top3 = board[:3]
        rest = board[3:]
        return render_template(
            "leaderboard.html",
            top3=top3,
            rest=rest,
            cohorts=cohorts,
            selected_cohort=selected_cohort,
            selected_cohort_id=selected_cohort_id,
        )

    @app.get("/rules")
    def rules():
        return render_template("rules.html")


def _selected_cohort_id() -> Optional[int]:
    raw = request.args.get("cohort_id", "").strip()
    if not raw:
        return None

    try:
        return int(raw)
    except ValueError:
        return None
