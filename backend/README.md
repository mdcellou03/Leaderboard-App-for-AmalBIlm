# Amal B'Ilm Backend

Flask API, database, authentication, migrations, and scoring logic for the
Amal B'Ilm leaderboard app.

Run backend commands from this `backend/` directory.

## Responsibilities

The backend owns:

- Staff login state through Flask sessions.
- CSRF protection for authenticated writes.
- Cohorts, students, sessions, questions, Kahoot sections, Kahoot results, and
  score entries.
- Score calculation and leaderboard totals.
- Database migrations through Flask-Migrate/Alembic.

The backend does not render the React interface. It serves JSON through `/api`.

## Setup With uv

Install dependencies:

```powershell
uv sync
```

Apply database migrations:

```powershell
uv run flask --app app db upgrade
```

Start the API:

```powershell
uv run flask --app app run
```

The API runs at:

```text
http://127.0.0.1:5000
```

If `uv` is not available on PATH, either install it globally or use the local
executable if it exists:

```powershell
..\.venv\Scripts\uv.exe sync
..\.venv\Scripts\uv.exe run flask --app app db upgrade
..\.venv\Scripts\uv.exe run flask --app app run
```

## Environment

The backend loads `.env` from the repository root and from `backend/.env`.

Local development:

```env
SECRET_KEY=replace-with-generated-secret
ADMIN_PASSWORD=your-local-password
DATABASE_URL=
STUDENT_CODE_PREFIX=STU
```

Production:

```env
SECRET_KEY=replace-with-generated-secret
ADMIN_PASSWORD_HASH=pbkdf2:sha256:...
DATABASE_URL=postgresql://user:password@host:5432/database
STUDENT_CODE_PREFIX=STU
```

`SECRET_KEY` signs sessions and CSRF tokens. Keep it stable and private.

`ADMIN_PASSWORD` is a local-only shortcut. The app hashes it at startup outside
production so staff login is easy during development.

`ADMIN_PASSWORD_HASH` is the production-safe option. Werkzeug hashes are salted,
so generating a hash for the same password produces a different string each
time. That is expected.

`DATABASE_URL` is optional locally. If it is empty, SQLite is used under
`backend/instance/`.

## Core Files

```text
app.py                  Flask app factory and extension registration
config.py               Database URL selection
extensions.py           Shared Flask extension instances
models.py               SQLAlchemy tables
routes/api.py           JSON API used by the React frontend
services/scoring.py     Score calculation and leaderboard aggregation
services/students.py    Visible student code helper
migrations/versions/    Database migration files
```

## Main Data Model

- `Cohort`: a term or program grouping.
- `Student`: a participant who may belong to more than one cohort.
- `StudentCohortMembership`: the join table that stores student membership in
  one or more cohorts.
- `WorkshopSession`: a single workshop within a cohort.
- `SessionQuestion`: an engagement question saved under a workshop session.
- `KahootRun`: one Kahoot section inside a workshop session.
- `KahootResult`: one imported/retrieved player row for a Kahoot section.
- `ScoreEntry`: one student's score record for one workshop session.

Questions may be session-level or attached to a specific `KahootRun`.

## Kahoot Result Flow

1. Create a `KahootRun` for the selected workshop session.
2. Attach questions to that run.
3. Export those questions for Kahoot.
4. Staff hosts the Kahoot manually.
5. Import result rows into the run.
6. The backend matches rows to students by saved Kahoot ID or generated student
   code, within the same cohort.
7. Staff fixes unmatched rows through the frontend.
8. Applying results adds awarded Kahoot points to each matched student's
   `ScoreEntry`.

The future Kahoot API adapter should call the same result import/apply routes.
That keeps manual import and automated retrieval consistent.

Saving a Kahoot quiz or report URL only records where staff handled the live
quiz. Automatic result retrieval still needs authenticated Kahoot report/API
access for the account being used.

## API Areas

```text
GET  /api/health

GET  /api/auth/csrf
GET  /api/auth/me
POST /api/auth/login
POST /api/auth/logout

GET  /api/cohorts
POST /api/cohorts

GET    /api/students
POST   /api/students
PATCH  /api/students/<student_id>
DELETE /api/students/<student_id>

GET  /api/sessions
POST /api/sessions

GET /api/sessions/<session_id>/scores
PUT /api/sessions/<session_id>/scores

GET  /api/sessions/<session_id>/questions
POST /api/sessions/<session_id>/questions

GET   /api/sessions/<session_id>/kahoot-runs
POST  /api/sessions/<session_id>/kahoot-runs
PATCH /api/kahoot-runs/<run_id>

GET   /api/kahoot-runs/<run_id>/results
POST  /api/kahoot-runs/<run_id>/results
PATCH /api/kahoot-results/<result_id>
POST  /api/kahoot-runs/<run_id>/apply-results

GET /api/leaderboard
```

Authenticated write routes require staff login and a CSRF token.

## Migration Commands

After changing models:

```powershell
uv run flask --app app db migrate -m "describe the schema change"
uv run flask --app app db upgrade
```

Use clear migration messages. They become part of the project history.
