# Amal B'Ilm Leaderboard App

Full-stack workshop leaderboard for Amal B'Ilm. The product is built for staff
to manage cohorts, students, sessions, scoring, Kahoot-assisted engagement, and
TV-friendly leaderboard displays during youth workshop programming.

## Product Shape

The app has two source projects:

```text
backend/                 Flask API, database models, migrations, auth, services
backend/app.py           Flask application entry point
backend/routes/          Backend route modules
backend/services/        Backend business logic helpers
backend/migrations/      Alembic migration history
frontend/                React/Vite staff dashboard and TV display UI
frontend/src/app/        React screens, app state, and API client helpers
frontend/src/styles/     Frontend theme and global styles
Docs/                    Local planning notes and meeting artifacts
```

The repository root is the workspace. Backend commands run from `backend/`.
Frontend commands run from `frontend/`.

## Current Capabilities

- Staff login protects the React admin workspace.
- Backend auth uses Flask sessions, CSRF tokens, `SECRET_KEY`, and either
  `ADMIN_PASSWORD_HASH` for production or `ADMIN_PASSWORD` for local development.
- Backend exposes API endpoints for auth, cohorts, students, sessions, and
  leaderboard reads.
- React frontend includes dashboard, leaderboard, students, sessions, scoring,
  Kahoot workflow, reports, and TV display screens.
- Local data uses SQLite by default. Production should use PostgreSQL through
  `DATABASE_URL`.

## Local Backend Setup

Copy `.env.example` to `.env` in the repository root.

For local development, use the simpler password option:

```env
SECRET_KEY=replace-with-a-generated-secret
ADMIN_PASSWORD=your-local-password
DATABASE_URL=
STUDENT_CODE_PREFIX=STU
```

Generate a `SECRET_KEY`:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Production should not use `ADMIN_PASSWORD`. Generate and set
`ADMIN_PASSWORD_HASH` instead:

```powershell
python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your-password', method='pbkdf2:sha256'))"
```

Preferred backend workflow with `uv`:

```powershell
cd backend
uv sync
uv run flask --app app db upgrade
uv run flask --app app run
```

If PowerShell says `uv` is not recognized, uv is not installed globally or is
not on PATH. From this repository, you can use the local executable instead:

```powershell
cd backend
..\.venv\Scripts\uv.exe sync
..\.venv\Scripts\uv.exe run flask --app app db upgrade
..\.venv\Scripts\uv.exe run flask --app app run
```

Fallback backend workflow with `venv` and `pip`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
cd backend
flask --app app db upgrade
flask --app app run
```

The backend runs at:

```text
http://127.0.0.1:5000
```

## Local Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

The frontend usually runs at:

```text
http://localhost:5173
```

During development, Vite proxies `/api` requests to
`http://127.0.0.1:5000`.

Build the frontend:

```powershell
npm run build
```

## API Surface

Current API endpoints:

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
GET  /api/leaderboard?cohort_id=1
```

Upcoming API work should add authenticated write endpoints for students,
sessions, scoring, and Kahoot workflow state.

## Kahoot Direction

The intended session workflow is not bulk quiz upload. Presenters may send a few
short engagement questions during the workshop, launch Kahoot from the session
workspace, and retrieve results after the activity.

The app should be designed around a Kahoot adapter:

- Preferred path: official/commercial Kahoot access creates/updates the quiz,
  returns a launch URL, and provides result retrieval.
- Fallback path: the app prepares questions/results for manual import/export if
  the official API does not support the desired automation.

Do not couple core scoring to an unofficial browser automation approach. The
leaderboard should remain usable even if Kahoot integration is unavailable.

## Next Build Priorities

1. Add cohort ownership to students so filtering is database-accurate.
2. Add authenticated CRUD APIs for students and connect the Students screen.
3. Add authenticated CRUD APIs for sessions and connect the Sessions screen.
4. Add scoring persistence, review, and publish workflow.
5. Define the Kahoot adapter contract and implement the best available provider.
6. Add deployment configuration, production database setup, and tests.

## Tech Stack

| Area | Tool |
|---|---|
| Backend | Flask |
| ORM | Flask-SQLAlchemy |
| Migrations | Flask-Migrate / Alembic |
| Local database | SQLite |
| Production database target | PostgreSQL |
| Frontend | React / Vite |
| Styling | Project CSS theme and component styles |
| Production server target | gunicorn or platform-managed Python runtime |

## License

MIT License

Copyright (c) 2026 Amna Adnan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
