from __future__ import annotations

from flask import Flask, redirect, render_template, url_for

from services.scoring import compute_leaderboard


def register_public_routes(app: Flask) -> None:
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
