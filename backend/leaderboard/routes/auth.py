from __future__ import annotations

from functools import wraps

from flask import Flask, current_app, flash, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash

from ..extensions import limiter


def login_required(view_func):
    @wraps(view_func)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            flash("Please log in to access the admin area.", "error")
            return redirect(url_for("login"))
        return view_func(*args, **kwargs)

    return decorated


def register_auth_routes(app: Flask) -> None:
    @app.get("/login")
    def login():
        if session.get("admin_logged_in"):
            return redirect(url_for("admin"))
        return render_template("login.html")

    @app.post("/login")
    @limiter.limit("5 per minute")
    def login_post():
        password = request.form.get("password", "")
        admin_password_hash = current_app.config.get("ADMIN_PASSWORD_HASH", "")

        if admin_password_hash and check_password_hash(admin_password_hash, password):
            session.clear()
            session["admin_logged_in"] = True
            return redirect(url_for("admin"))

        flash("Incorrect password.", "error")
        return redirect(url_for("login"))

    @app.post("/logout")
    def logout():
        session.pop("admin_logged_in", None)
        return redirect(url_for("leaderboard"))
