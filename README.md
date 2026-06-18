# AmalBIlm-Leaderboard-App

This leaderboard app is designed for the AmalBIlm Program, it's features include the ability to 

- Add students
- Create a workshop session and edit it
- Record objective scoring per student per session (done with checkboxes for the ease of the evaluator)
- Compute points using the rules visible on the app
- Display the leaderboard with accumulated totals across sessions


## Setup

1. Clone the repo 

2. Create and activate a virtual environment

3. Install dependencies

4. Create a `.env` file from the template (this is the file called `.env.example`):

   Then fill in both values:
   - **SECRET_KEY** — feel free to run this and paste the output:``` python3 -c "import secrets; print(secrets.token_hex(32))"```
   - **ADMIN_PASSWORD_HASH** — First CHOOSE a password, then run this (MAKE SURE YOU ARE REPLACING `yourpassword`) and paste the output ``` python3 -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('yourpassword', method='pbkdf2:sha256'))"```

5. Create or update the database schema:

```bash
flask --app app db upgrade
```

6. Run the app``` python app.py```

   Please note that the local database file (`instance/leaderboard.db`) is created by the migration command.

## Database

By default, local development uses SQLite at `instance/leaderboard.db`.

For production, set `DATABASE_URL` in the environment. A managed PostgreSQL database is recommended for deployment:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

Schema changes are tracked with Flask-Migrate/Alembic:

```bash
flask --app app db migrate -m "Describe the schema change"
flask --app app db upgrade
```

> **Note:** The admin area at `/admin` is password-protected. Click "Admin" in the navbar and enter the password you set in `.env`.


## Tech Stack

| | |
|---|---|
| Language | Python 3.9 |
| Web framework | Flask 3.0.3 |
| Database ORM | Flask-SQLAlchemy 3.1.1 |
| Database | SQLite (`instance/leaderboard.db`) |
| CSS | Bootstrap 5.3.3 |
| Production server | gunicorn 22.0.0 |

## Objective Scoring Rules

There are five categories, and each student starts each category with **10 points** (only when the student is marked **Present**).

### 1) Punctuality (start 10)
- On-time (5-minute buffer): no penalty
- Late (> 5 minutes): **-5**

### 2) Participation (start 10)
- Asks meaningful questions (cap 1): **+1**
- Distracts others: **-1**
- Makes a connection across ideas: **+1**
- Challenges an assumption constructively: **+1**
- Tried something new / took a learning risk: **+1**
- Answers a question: **+1**

### 3) Teamwork (start 10)
- Contributed to team dynamic: **+1**
- Made sure all members were included: **+1**
- Allocated tasks to members: **+1**
- Demonstrated leadership and/or followed the lead well: **+1**
- Helped a peer unprompted: **+1**

### 4) Adab (start 10)
- Includes others / spreads salaam / reaches out if someone is alone: **+1**
- Treats classmates/instructor/volunteers with respect: **+1**
- On phone/electronics when not required: **-1**
- Interrupts / speaks over others / disrespectful communication style: **-1**

### 5) Deliverables (start 10)
- Completion of activity: **+1**
- Expanded beyond workshop content: **+1**

**Total session score** = sum of all category totals.


## Author

Amna Adnan

## License 

MIT License

Copyright (c) 2026 Amna Adnan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.



