# Amal B'Ilm Backend

Flask API and database layer for the Amal B'Ilm leaderboard app.

Run backend commands from this `backend/` directory. The imports are structured
so this folder is the backend application root.

## Preferred Setup With uv

Install dependencies:

```powershell
uv sync
```

Run database migrations:

```powershell
uv run flask --app leaderboard.app db upgrade
```

Start the backend:

```powershell
uv run flask --app leaderboard.app run
```

The API will be available at:

```text
http://127.0.0.1:5000
```

## Fallback Setup With venv/pip

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
cd backend
flask --app leaderboard.app db upgrade
flask --app leaderboard.app run
```

## Environment

The backend reads environment variables from `.env`. A local `.env` may live in
the repository root or in this `backend/` folder.

For local development, the simplest login setup is:

```env
SECRET_KEY=replace-with-generated-secret
ADMIN_PASSWORD=your-local-password
```

When `ADMIN_PASSWORD` is set outside production, it is used for local login even
if `ADMIN_PASSWORD_HASH` also exists in the environment. This keeps demos simple
without weakening production rules.

For production, do not use `ADMIN_PASSWORD`. Generate and provide a stable hash:

```env
SECRET_KEY=replace-with-generated-secret
ADMIN_PASSWORD_HASH=pbkdf2:sha256:...
DATABASE_URL=postgresql://user:password@host:5432/database
```

`SECRET_KEY` signs Flask sessions and CSRF tokens. Keep it stable and private.

`ADMIN_PASSWORD_HASH` stores a one-way password hash. Werkzeug hashes are
salted, so generating a hash for the same password produces a different string
each time. That is expected; login still works through `check_password_hash`.

## Current API Areas

```text
GET  /api/health
GET  /api/auth/csrf
GET  /api/auth/me
POST /api/auth/login
POST /api/auth/logout
GET  /api/cohorts
GET  /api/students
GET  /api/sessions
GET  /api/leaderboard
```

Upcoming API work should add authenticated write endpoints for students,
sessions, scoring, and Kahoot workflow state.
