# Amal B'Ilm Leaderboard Frontend

React/Vite frontend for the Amal B'Ilm workshop leaderboard.

The frontend is responsible for the staff-facing dashboard, cohort filtering,
student/session management screens, scoring workspace, Kahoot workflow surface,
reports, and TV display mode. It talks to the Flask backend through `/api`.

## Local Development

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

During local development, Vite proxies `/api` requests to the Flask backend at
`http://127.0.0.1:5000`. Start the backend separately before testing live data.
