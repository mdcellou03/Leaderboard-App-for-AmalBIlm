from __future__ import annotations

import os
import secrets

from dotenv import load_dotenv
from flask import Flask

from extensions import csrf, db, limiter
from services.database import ensure_database_schema
from services.students import student_code

load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)

    is_production = os.environ.get("FLASK_ENV") == "production"
    secret_key = os.environ.get("SECRET_KEY")

    if not secret_key:
        if is_production:
            raise RuntimeError("SECRET_KEY must be set in production.")
        secret_key = secrets.token_hex(32)
        print("WARNING: Using a temporary development SECRET_KEY.")

    admin_password_hash = os.environ.get("ADMIN_PASSWORD_HASH", "")
    if not admin_password_hash:
        if is_production:
            raise RuntimeError("ADMIN_PASSWORD_HASH must be set in production.")
        print("WARNING: ADMIN_PASSWORD_HASH is not set, so admin login is disabled.")

    os.makedirs(app.instance_path, exist_ok=True)

    app.config.update(
        SECRET_KEY=secret_key,
        ADMIN_PASSWORD_HASH=admin_password_hash,
        SQLALCHEMY_DATABASE_URI="sqlite:///" + os.path.join(app.instance_path, "leaderboard.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    db.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)
    app.jinja_env.globals["student_code"] = student_code

    from models import Cohort, ScoreEntry, Student, WorkshopSession
    from routes.admin import register_admin_routes
    from routes.auth import register_auth_routes
    from routes.public import register_public_routes

    with app.app_context():
        db.create_all()
        ensure_database_schema()

    register_auth_routes(app)
    register_public_routes(app)
    register_admin_routes(app)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
