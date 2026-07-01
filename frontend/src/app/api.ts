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
  kahoot_identifier: string | null;
}

export interface ApiSession {
  id: number;
  cohort_id: number | null;
  cohort_name: string | null;
  title: string;
  presenter: string;
  date: string;
  start_time: string;
  notes: string;
  status: "draft" | "ready" | "live" | "review" | "published" | "archived";
  kahoot_status: "questions-ready" | "exported" | "hosted" | "results-imported" | "reviewed";
  score_entries: number;
  scored_entries: number;
  question_count: number;
}

export interface ApiScoreEntry {
  student_id: number;
  student_code: string;
  student_name: string;
  present: boolean;
  punctual: boolean;
  deliverable: boolean;
  kahoot_points: number;
  participation_score: number;
  teamwork_score: number;
  conduct_score: number;
  penalty_points: number;
  notes: string;
  status: "draft" | "reviewed" | "published";
  total_points: number;
}

export interface ApiSessionQuestion {
  id: number;
  session_id: number;
  position: number;
  prompt: string;
  options: string[];
  correct_option: "A" | "B" | "C" | "D";
  time_limit_seconds: number;
  points: number;
  kahoot_question_id: string | null;
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

async function putJson<T>(url: string, body?: unknown): Promise<T> {
  const token = await getCsrfToken();

  return fetchJson<T>(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function patchJson<T>(url: string, body?: unknown): Promise<T> {
  const token = await getCsrfToken();

  return fetchJson<T>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function deleteJson<T>(url: string): Promise<T> {
  const token = await getCsrfToken();

  return fetchJson<T>(url, {
    method: "DELETE",
    headers: {
      "X-CSRFToken": token,
    },
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
  const [cohorts, students, sessions] = await Promise.all([
    fetchJson<{ cohorts: ApiCohort[] }>("/api/cohorts"),
    fetchJson<{ students: ApiStudent[] }>("/api/students"),
    fetchJson<{ sessions: ApiSession[] }>("/api/sessions"),
  ]);

  return {
    cohorts: cohorts.cohorts,
    students: students.students,
    sessions: sessions.sessions,
  };
}

export async function fetchLeaderboard(cohortId?: string): Promise<ApiLeaderboardRow[]> {
  const query = cohortId ? `?cohort_id=${encodeURIComponent(cohortId)}` : "";
  const data = await fetchJson<{ leaderboard: ApiLeaderboardRow[] }>(`/api/leaderboard${query}`);
  return data.leaderboard;
}

export async function createCohort(name: string): Promise<ApiCohort> {
  const data = await postJson<{ cohort: ApiCohort }>("/api/cohorts", { name });
  return data.cohort;
}

export async function createStudent(payload: {
  name: string;
  cohort_id: number;
  kahoot_identifier?: string;
}): Promise<ApiStudent> {
  const data = await postJson<{ student: ApiStudent }>("/api/students", payload);
  return data.student;
}

export async function updateStudent(
  studentId: number,
  payload: {
    name: string;
    cohort_id: number;
    kahoot_identifier?: string;
  },
): Promise<ApiStudent> {
  const data = await patchJson<{ student: ApiStudent }>(`/api/students/${studentId}`, payload);
  return data.student;
}

export async function deleteStudent(studentId: number): Promise<void> {
  await deleteJson<{ deleted: boolean; student_id: number }>(`/api/students/${studentId}`);
}

export async function createSession(payload: {
  cohort_id: number;
  title: string;
  presenter: string;
  date: string;
  start_time: string;
  notes?: string;
}): Promise<ApiSession> {
  const data = await postJson<{ session: ApiSession }>("/api/sessions", payload);
  return data.session;
}

export async function fetchSessionScores(sessionId: number): Promise<ApiScoreEntry[]> {
  const data = await fetchJson<{ scores: ApiScoreEntry[] }>(`/api/sessions/${sessionId}/scores`);
  return data.scores;
}

export async function saveSessionScores(
  sessionId: number,
  payload: {
    status?: "draft" | "reviewed" | "published";
    scores: Array<{
      student_id: number;
      present: boolean;
      punctual: boolean;
      deliverable: boolean;
      kahoot_points: number;
      participation_score: number;
      teamwork_score: number;
      conduct_score: number;
      penalty_points: number;
      notes?: string;
      status?: "draft" | "reviewed" | "published";
    }>;
  },
): Promise<{ session: ApiSession; scores: ApiScoreEntry[] }> {
  return putJson<{ session: ApiSession; scores: ApiScoreEntry[] }>(`/api/sessions/${sessionId}/scores`, payload);
}

export async function fetchSessionQuestions(sessionId: number): Promise<ApiSessionQuestion[]> {
  const data = await fetchJson<{ questions: ApiSessionQuestion[] }>(`/api/sessions/${sessionId}/questions`);
  return data.questions;
}

export async function createSessionQuestion(
  sessionId: number,
  payload: {
    prompt: string;
    options: string[];
    correct_option: "A" | "B" | "C" | "D";
    time_limit_seconds: number;
    points: number;
  },
): Promise<ApiSessionQuestion> {
  const data = await postJson<{ question: ApiSessionQuestion }>(`/api/sessions/${sessionId}/questions`, payload);
  return data.question;
}
