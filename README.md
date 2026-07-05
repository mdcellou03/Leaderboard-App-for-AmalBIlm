# Amal B'Ilm Leaderboard App

Full-stack leaderboard and workshop operations app for Amal B'Ilm. Staff use it
to manage cohorts, students, workshop sessions, scoring, Kahoot-assisted quiz
handoffs, result review, and public/TV leaderboard display.

## Project Structure

```text
backend/                 Flask API, database models, migrations, auth, services
backend/app.py           Flask application entry point
backend/models.py        SQLAlchemy database tables
backend/routes/          JSON API route module
backend/services/        Business logic helpers, including scoring
backend/migrations/      Alembic migration history

frontend/                React/Vite staff dashboard and public display
frontend/src/app/App.tsx Main React app and screens
frontend/src/app/api.ts  Typed frontend API client
frontend/src/styles/     Theme and global styles

docs/                    Meeting notes, workshop source material, planning files
```

Run backend commands from `backend/`. Run frontend commands from `frontend/`.

## Current Product Flow

The app is organized around cohorts and workshop sessions.

1. Create or select a cohort.
2. Add students and assign them to one or more cohorts.
3. Set each student's Kahoot ID when known. If no Kahoot ID is available, the
   generated student code can be used as the matching identifier.
4. Create a workshop session for the cohort.
5. Use the Session Workspace during preparation or while the session is running.
6. Review the auto-created workshop sections from the session template.
7. Rename, reorder, collapse, or delete sections as needed for that presenter.
8. Add questions to the relevant section during preparation or live facilitation.
9. Export one section as a Kahoot-format `.xlsx`, or export all populated
   sections as a `.zip`.
10. Host the quiz manually in Kahoot.
11. Upload the Kahoot result export back into the same section, or paste rows as
    a fallback.
12. Review unmatched result rows.
13. Apply reviewed Kahoot points to the session score sheet.
14. Publish reviewed scores when ready.
15. Show the leaderboard through the public view or TV display.

This design keeps the app useful even while the Kahoot integration is still being
finalized. Kahoot handles the live quiz experience; this app owns the program
records, matching, scoring, and leaderboard.

## Kahoot Integration Position

The current implementation does not pretend to start a Kahoot game through an
unsupported endpoint. The working flow is:

- The app stores Kahoot sections under a workshop session.
- New sessions are populated with editable sections based on the workshop
  template.
- Each section can export its assigned questions in Kahoot's spreadsheet shape.
- A full session can export all populated sections as a zip of `.xlsx` files.
- Staff creates and hosts the quiz in Kahoot.
- Staff stores the Kahoot quiz/report link against the section.
- Results are imported back into the app and matched to students.
- Reviewed results are applied to the scoring table.

The result import screen accepts Kahoot `.csv` or `.xlsx` exports. It also keeps
a paste fallback in this format:

```text
identifier,nickname,correct,total,kahoot_points
STU-001,AishaK,4,5,8200
```

The future Kahoot API adapter should feed the same backend result-import endpoint
instead of inventing a separate scoring path. That keeps manual import and API
retrieval consistent.

A saved Kahoot quiz/report link is a reference, not an integration by itself.
Automatic retrieval requires authenticated access to whatever Kahoot report/API
endpoint is available for the account or paid plan. Until that is confirmed, the
manual import path remains the reliable fallback.

## Tech Stack

| Area | Tool |
|---|---|
| Backend | Flask |
| ORM | Flask-SQLAlchemy |
| Migrations | Flask-Migrate / Alembic |
| Local database | SQLite |
| Production database target | PostgreSQL |
| Backend package manager | uv |
| Frontend | React / Vite |
| Frontend package manager | npm |
| Icons | lucide-react |

## Local Setup

Copy `.env.example` to `.env` in the repository root.

For local development, use `ADMIN_PASSWORD`. This is simpler than generating a
hash while building and demoing locally.

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

Production should not use `ADMIN_PASSWORD`. Use `ADMIN_PASSWORD_HASH` instead:

```powershell
python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your-password', method='pbkdf2:sha256'))"
```

Werkzeug password hashes are salted, so the generated hash will be different
each time. That is expected.

## Run The Backend

```powershell
cd backend
uv sync
uv run flask --app app db upgrade
uv run flask --app app run
```

The backend runs at:

```text
http://127.0.0.1:5000
```

If `uv` is not recognized, install it globally or use the local executable if it
exists:

```powershell
cd backend
..\.venv\Scripts\uv.exe sync
..\.venv\Scripts\uv.exe run flask --app app db upgrade
..\.venv\Scripts\uv.exe run flask --app app run
```

## Run The Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend usually runs at:

```text
http://localhost:5173
```

Vite proxies `/api` requests to `http://127.0.0.1:5000`.

Build the frontend:

```powershell
cd frontend
npm run build
```

## Main API Areas

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
PATCH  /api/questions/<question_id>
DELETE /api/questions/<question_id>

GET   /api/sessions/<session_id>/kahoot-runs
POST  /api/sessions/<session_id>/kahoot-runs
POST  /api/sessions/<session_id>/kahoot-runs/reorder
PATCH /api/kahoot-runs/<run_id>
DELETE /api/kahoot-runs/<run_id>
GET   /api/kahoot-runs/<run_id>/questions.xlsx
GET   /api/sessions/<session_id>/kahoot-export.zip

GET   /api/kahoot-runs/<run_id>/results
POST  /api/kahoot-runs/<run_id>/results
POST  /api/kahoot-runs/<run_id>/results/upload
PATCH /api/kahoot-results/<result_id>
POST  /api/kahoot-runs/<run_id>/apply-results

GET /api/leaderboard
GET /api/leaderboard?cohort_id=<cohort_id>
```

Authenticated write endpoints require staff login and CSRF protection.

## Where To Change Core Logic

- Scoring rules live in `backend/services/scoring.py`.
- Student display codes live in `backend/services/students.py`.
- Student-to-cohort membership is many-to-many. A workshop session still belongs
  to one cohort.
- Database shape lives in `backend/models.py`.
- API behavior lives in `backend/routes/api.py`.
- Frontend API calls live in `frontend/src/app/api.ts`.
- Staff UI screens currently live in `frontend/src/app/App.tsx`.

The frontend should eventually be split into smaller screen components, but the
current single-file structure is still workable while the product flow is moving.

## Current Limitations

- Kahoot API retrieval is not connected yet. Manual result import uses the same
  backend path the adapter should call later.
- The frontend screens are still concentrated in `App.tsx`; this should be
  refactored once the workflow stabilizes.
- Production deployment still needs final platform configuration, a managed
  PostgreSQL database, persistent rate-limit storage, and proper secret handling.
- Automated tests should be added around scoring, result matching, and protected
  write endpoints.

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
