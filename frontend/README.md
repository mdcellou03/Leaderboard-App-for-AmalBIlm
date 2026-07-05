# Amal B'Ilm Frontend

React/Vite frontend for the Amal B'Ilm leaderboard app. The frontend provides
the staff workspace, public leaderboard view, and TV display mode. It talks to
the Flask backend through `/api`.

Run frontend commands from this `frontend/` directory.

## Local Development

Install dependencies:

```powershell
npm install
```

Start the dev server:

```powershell
npm run dev
```

Build for production:

```powershell
npm run build
```

During development, Vite proxies `/api` requests to:

```text
http://127.0.0.1:5000
```

Start the backend before testing live data.

## Main Files

```text
src/app/App.tsx       Main React app, screens, page state, and UI flow
src/app/api.ts        Typed API client for the Flask backend
src/styles/           Theme and global styles
vite.config.ts        Vite config and local API proxy
```

`App.tsx` is currently large because the UI was consolidated while the product
flow was still moving. Once the workflow is stable, split it into separate
screen components.

## Screens

- Public access screen: read-only leaderboard plus staff login entry.
- Dashboard: current cohort overview.
- Leaderboard: cohort leaderboard and TV display entry.
- Students: create, edit, delete, assign to one or more cohorts, and assign
  Kahoot IDs.
- Sessions: create sessions and open the session workspace.
- Session Workspace: presenter-focused control room for one selected session.
- Kahoot: section-based Kahoot export, link tracking, result import, matching,
  and score application.
- Reports: summary view for attendance, score, and follow-up signals.
- TV Display: public display view that hides staff controls.

## Kahoot Workflow In The UI

The Kahoot page is scoped to the selected workshop session.

1. Choose the workshop session.
2. Review the session sections that were created from the workshop template.
3. Rename, reorder, collapse, or delete sections so they match the presenter.
4. Add questions directly to the selected section.
5. Export the selected section as a Kahoot-format `.xlsx`, or export all
   populated sections as a `.zip`.
6. Create or host the quiz in Kahoot. The app's section is the local record that
   keeps questions/results tied to the workshop session.
7. Save the Kahoot quiz/report link in the app.
8. Upload Kahoot result `.csv` or `.xlsx` files back into the same section, or
   paste rows as a fallback.
9. Review unmatched rows.
10. Apply matched rows to the session score sheet.

The paste fallback uses this row format:

```text
identifier,nickname,correct,total,kahoot_points
STU-001,AishaK,4,5,8200
```

The future API adapter should fill the same result table instead of bypassing
the review/apply flow. A saved Kahoot/report link is not enough by itself to
retrieve results; the backend will need authenticated access to Kahoot's report
data for the account/plan being used.

## API Client

Use `src/app/api.ts` for backend calls. Do not call `fetch` directly from random
components unless there is a good reason. Keeping API calls in one file makes it
easier to adjust auth, CSRF handling, and response shapes later.

Important API helpers include:

- `fetchCoreData`
- `createCohort`
- `createStudent`
- `createSession`
- `fetchSessionScores`
- `saveSessionScores`
- `fetchSessionQuestions`
- `createSessionQuestion`
- `fetchKahootRuns`
- `createKahootRun`
- `updateKahootRun`
- `deleteKahootRun`
- `reorderKahootRuns`
- `kahootRunExportUrl`
- `sessionKahootExportUrl`
- `fetchKahootResults`
- `importKahootResults`
- `uploadKahootResults`
- `updateKahootResult`
- `applyKahootResults`

## Practical Test Flow

1. Start the backend.
2. Start the frontend.
3. Log in as staff.
4. Create a cohort.
5. Add students, assign one or more cohorts, and set Kahoot IDs.
6. Create a session.
7. Open the session workspace.
8. Open Kahoot and select one of the auto-created sections.
9. Add questions to that section.
10. Export the section XLSX, or export all populated sections as a zip.
11. Upload a sample Kahoot result CSV/XLSX, or paste sample rows.
12. Resolve unmatched rows.
13. Apply scores.
14. Confirm the score sheet and leaderboard update.
