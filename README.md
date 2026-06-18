# AmalBIlm Leaderboard App

This app supports the AmalBIlm workshop program by tracking students, cohorts, workshop sessions, scoring, and leaderboard results.

Current backend features:

- Add students
- Add cohorts such as `Spring 2026`
- Create workshop sessions and assign them to cohorts
- Record objective scoring per student per session
- Compute points using the app's scoring rules
- Display a cohort-filterable leaderboard
- Expose JSON API endpoints for the upcoming React frontend

## Project Structure

```text
backend/              Flask backend, API, database models, migrations, and legacy Jinja pages
backend/routes/       URL handlers for auth, admin pages, public pages, and API endpoints
backend/services/     Business logic such as scoring and student ID generation
backend/templates/    Legacy Flask/Jinja HTML pages kept while React is introduced
backend/static/       Legacy CSS/assets for the Jinja pages
backend/migrations/   Alembic database migrations
instance/             Local runtime data, including the SQLite database
```

The next major step is adding a `frontend/` React app that consumes the backend API.

## Frontend Setup

The React frontend lives in `frontend/`.

Install frontend dependencies:

```bash
cd frontend
npm install
```

Run the React development server:

```bash
npm run dev
```

During development, Vite proxies `/api` requests to the Flask backend at `http://127.0.0.1:5000`.

Build the production frontend:

```bash
npm run build
```

## Backend Setup

1. Create and activate a virtual environment.

2. Install backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

3. Copy `.env.example` to `.env`, then fill in:

```env
SECRET_KEY=
ADMIN_PASSWORD_HASH=
DATABASE_URL=
STUDENT_CODE_PREFIX=STU
```

Generate a `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Generate an admin password hash:

```bash
python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('yourpassword', method='pbkdf2:sha256'))"
```

4. Create or update the database schema:

```bash
flask --app backend.app db upgrade
```

5. Run the backend:

```bash
flask --app backend.app run
```

The local database file lives at `instance/leaderboard.db` and is created by the migration command.

## Database

Local development uses SQLite by default.

Production should use a managed PostgreSQL database by setting `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

Schema changes are tracked with Flask-Migrate/Alembic:

```bash
flask --app backend.app db migrate -m "Describe the schema change"
flask --app backend.app db upgrade
```

## API Endpoints

Initial read endpoints for the React frontend:

```text
GET /api/health
GET /api/cohorts
GET /api/students
GET /api/sessions
GET /api/leaderboard
GET /api/leaderboard?cohort_id=1
```

## Tech Stack

| Area | Tool |
|---|---|
| Backend language | Python 3 |
| Backend framework | Flask |
| Database ORM | Flask-SQLAlchemy |
| Migrations | Flask-Migrate / Alembic |
| Local database | SQLite |
| Production database target | PostgreSQL |
| Frontend today | Legacy Flask/Jinja templates |
| Frontend target | React consuming Flask JSON APIs |
| Production server | gunicorn |

## Objective Scoring Rules

Each student starts with 10 points for each category when marked present.

### 1. Punctuality

- On time with a 5-minute buffer: no penalty
- Late by more than 5 minutes: -5

### 2. Participation

- Asked meaningful questions: +1
- Distracted others: -1
- Made a connection across ideas: +1
- Challenged an assumption constructively: +1
- Tried something new or took a learning risk: +1
- Answered a question: +1

### 3. Teamwork

- Contributed to team dynamic: +1
- Made sure all team members were included: +1
- Allocated tasks to members: +1
- Demonstrated leadership and/or followed the lead well: +1
- Helped a peer unprompted: +1

### 4. Adab

- Includes others, spreads salaam, reaches out if someone is alone: +1
- Treats classmates, instructors, and volunteers with respect: +1
- Uses phone/electronics when not required: -1
- Interrupts, speaks over others, or uses disrespectful communication: -1

### 5. Deliverables

- Completed the activity: +1
- Expanded beyond workshop content: +1

## Author

Amna Adnan

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
