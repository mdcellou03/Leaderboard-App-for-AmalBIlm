export interface ApiCohort {
  id: number;
  name: string;
}

export interface ApiStudent {
  id: number;
  code: string;
  name: string;
}

export interface ApiSession {
  id: number;
  cohort_id: number | null;
  cohort_name: string | null;
  date: string;
  start_time: string;
  score_entries: number;
  scored_entries: number;
}

export interface ApiLeaderboardRow {
  id: number;
  code: string;
  name: string;
  total: number;
  attended_sessions: number;
  current_streak: number;
  rank: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchCoreData() {
  const [cohorts, students, sessions, leaderboard] = await Promise.all([
    fetchJson<{ cohorts: ApiCohort[] }>("/api/cohorts"),
    fetchJson<{ students: ApiStudent[] }>("/api/students"),
    fetchJson<{ sessions: ApiSession[] }>("/api/sessions"),
    fetchJson<{ leaderboard: ApiLeaderboardRow[] }>("/api/leaderboard"),
  ]);

  return {
    cohorts: cohorts.cohorts,
    students: students.students,
    sessions: sessions.sessions,
    leaderboard: leaderboard.leaderboard,
  };
}
