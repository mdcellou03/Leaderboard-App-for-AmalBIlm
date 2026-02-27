# AmalBIlm-Leaderboard-App

This leaderboard app is designed for the AmalBIlm Program, it's features include the ability to 

- Add students
- Create a workshop session 
- Record objective scoring per student per session (done with checkboxes for ease of evaluator)
- Compute points using the rules visible on the app
- Displays the leaderboard with accumulated totals across sessions


## Tech Stack

The tech stack consists of Python, Flask for the web server and routing, and Flask-SQLAlchemy and SQLite for the database.  


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


## Project Structure

