export interface ApiCohort {
  id: number;
  name: string;
}

export interface ApiStudent {
  id: number;
  cohort_id: number | null;
  cohort_name: string | null;
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

export interface AuthState {
  authenticated: boolean;
}

let csrfToken: string | null = null;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const data = await fetchJson<{ csrf_token: string }>("/api/auth/csrf");
  csrfToken = data.csrf_token;
  return csrfToken;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const token = await getCsrfToken();

  return fetchJson<T>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function fetchAuthState(): Promise<AuthState> {
  return fetchJson<AuthState>("/api/auth/me");
}

export async function loginAdmin(password: string): Promise<AuthState> {
  const result = await postJson<AuthState>("/api/auth/login", { password });
  csrfToken = null;
  return result;
}

export async function logoutAdmin(): Promise<AuthState> {
  const result = await postJson<AuthState>("/api/auth/logout");
  csrfToken = null;
  return result;
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
