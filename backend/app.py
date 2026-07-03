from __future__ import annotations

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from werkzeug.security import generate_password_hash

from config import database_uri
from extensions import csrf, db, limiter, migrate
from services.students import student_code

PACKAGE_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = PACKAGE_DIR
REPO_ROOT = BACKEND_ROOT.parent

load_dotenv(REPO_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env", override=True)


def create_app() -> Flask:
    app = Flask(
        __name__,
        instance_path=str(BACKEND_ROOT / "instance"),
        template_folder="templates",
        static_folder="static",
    )

    is_production = os.environ.get("FLASK_ENV") == "production"
    secret_key = os.environ.get("SECRET_KEY")

    if not secret_key:
        if is_production:
            raise RuntimeError("SECRET_KEY must be set in production.")
        secret_key = secrets.token_hex(32)
        print("WARNING: Using a temporary development SECRET_KEY.")

    development_admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if development_admin_password and is_production:
        raise RuntimeError("ADMIN_PASSWORD is only allowed outside production. Use ADMIN_PASSWORD_HASH instead.")

    admin_password_hash = os.environ.get("ADMIN_PASSWORD_HASH", "")
    if development_admin_password and not is_production:
        admin_password_hash = generate_password_hash(development_admin_password, method="pbkdf2:sha256")
        print("WARNING: Using ADMIN_PASSWORD for local development login.")

    if not admin_password_hash:
        if is_production:
            raise RuntimeError("ADMIN_PASSWORD_HASH must be set in production.")
        print("WARNING: ADMIN_PASSWORD_HASH is not set, so admin login is disabled.")

    os.makedirs(app.instance_path, exist_ok=True)

    app.config.update(
        SECRET_KEY=secret_key,
        ADMIN_PASSWORD_HASH=admin_password_hash,
        SQLALCHEMY_DATABASE_URI=database_uri(app.instance_path),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    db.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)
    migrate.init_app(app, db, directory=str(BACKEND_ROOT / "migrations"))
    app.jinja_env.globals["student_code"] = student_code

    from models import Cohort, KahootResult, KahootRun, ScoreEntry, SessionQuestion, Student, WorkshopSession
    from routes.admin import register_admin_routes
    from routes.api import register_api_routes
    from routes.auth import register_auth_routes
    from routes.public import register_public_routes

    register_auth_routes(app)
    register_api_routes(app)
    register_public_routes(app)
    register_admin_routes(app)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
