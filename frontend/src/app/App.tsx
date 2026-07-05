import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Trophy, Tv, Users, Calendar,
  ClipboardList, Zap, BarChart2, ChevronDown,
  Search, Plus, Edit3, Lock, ArrowLeft,
  RefreshCw, X, AlignLeft, Check, AlertTriangle,
  Clock, Download, FileText, Link2, ExternalLink,
  ChevronRight, Save, Award, BookOpen, LogOut, Trash2,
} from "lucide-react";
import { applyKahootResults, createCohort, createKahootRun, createSession, createSessionQuestion, createStudent, deleteKahootRun, deleteSessionQuestion, deleteStudent, fetchAuthState, fetchCoreData, fetchKahootResults, fetchKahootRuns, fetchLeaderboard, fetchSessionQuestions, fetchSessionScores, importKahootResults, kahootRunExportUrl, loginAdmin, logoutAdmin, reorderKahootRuns, saveSessionScores, sessionKahootExportUrl, updateKahootResult, updateKahootRun, updateSessionQuestion, updateStudent, uploadKahootResults, type ApiCohort, type ApiKahootResult, type ApiKahootRun, type ApiLeaderboardRow, type ApiScoreEntry, type ApiSession, type ApiSessionQuestion, type ApiStudent } from "./api";

// ============================================================
// TYPES
// ============================================================

type AdminScreen = "dashboard" | "leaderboard" | "students" | "sessions" | "scoring" | "kahoot" | "reports";
type SessionWorkspaceTab = "overview" | "questions" | "score" | "results";
type SessionStatus = "draft" | "ready" | "live" | "review" | "published" | "archived";
type KahootStatus = "questions-ready" | "exported" | "hosted" | "results-imported" | "reviewed";
type GradeStatus = "draft" | "reviewed" | "published";

interface Cohort { id: string; name: string; term: string; status: "active" | "archived"; sessionCount: number; studentCount: number; }
interface Student { id: string; code: string; name: string; cohortId: string; cohortIds: string[]; cohortNames: string[]; playerId?: string; attendance: number; totalSessions: number; totalPoints: number; rank: number; avatarId: number; badges: string[]; streak: number; joinDate: string; }
interface Session { id: string; cohortId: string; num: number; title: string; date: string; presenter: string; status: SessionStatus; kahootStatus: KahootStatus; notes?: string; questionCount?: number; }
interface SessionGrade { studentId: string; present: boolean; punctual: boolean; deliverable: boolean; kahootPts: number; participation: number; teamwork: number; adab: number; penalty: number; penaltyNote: string; notes?: string; status: GradeStatus; }
interface ScreenProps {
  activeCohort: string;
  setActiveCohort: (id: string) => void;
  cohorts: Cohort[];
  students: Student[];
  allStudents: Student[];
  sessions: Session[];
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
  workspaceTab: SessionWorkspaceTab;
  setWorkspaceTab: (tab: SessionWorkspaceTab) => void;
  setScreen: (s: AdminScreen) => void;
  onTVMode: () => void;
  refreshData: () => Promise<void>;
}

// ============================================================
// MOCK DATA
// ============================================================

const COHORTS: Cohort[] = [];

const BADGE_DEFS: Record<string, { symbol: string; label: string; color: string }> = {
  "top-scorer":         { symbol: "★", label: "Top Scorer",        color: "#B8860B" },
  "perfect-attendance": { symbol: "◆", label: "Full Attendance",   color: "#2E7D32" },
  "adab":               { symbol: "♦", label: "Best Conduct",       color: "#6A1B9A" },
  "streak-5":           { symbol: "▲", label: "5× Streak",         color: "#BF360C" },
  "team-player":        { symbol: "●", label: "Team Player",       color: "#01579B" },
  "deliverable":        { symbol: "■", label: "All Delivered",     color: "#1B5E20" },
};

const STUDENTS: Student[] = [];

const SESSIONS: Session[] = [];
const UNUSED_SESSION_FIXTURES: Session[] = [
  { id: "ses6",  cohortId: "c1", num: 6,  title: "Goal Setting and Personal Vision",         date: "2026-02-19", presenter: "Ustadh Tariq", status: "published", kahootStatus: "reviewed"          },
  { id: "ses7",  cohortId: "c1", num: 7,  title: "Communication and Active Listening",         date: "2026-02-26", presenter: "Sr. Amina",    status: "published", kahootStatus: "reviewed"          },
  { id: "ses8",  cohortId: "c1", num: 8,  title: "Time Management and Prioritisation",         date: "2026-03-05", presenter: "Br. Hassan",   status: "published", kahootStatus: "reviewed"          },
  { id: "ses9",  cohortId: "c1", num: 9,  title: "Financial Literacy: Budgeting and Giving",   date: "2026-03-19", presenter: "Ustadh Tariq", status: "published", kahootStatus: "reviewed"          },
  { id: "ses10", cohortId: "c1", num: 10, title: "Digital Citizenship and Online Ethics",      date: "2026-03-26", presenter: "Sr. Amina",    status: "published", kahootStatus: "reviewed"          },
  { id: "ses11", cohortId: "c1", num: 11, title: "Leadership and Community Responsibility",    date: "2026-04-09", presenter: "Br. Hassan",   status: "published", kahootStatus: "reviewed"          },
  { id: "ses12", cohortId: "c1", num: 12, title: "Conflict Resolution and Teamwork",           date: "2026-04-24", presenter: "Ustadh Tariq", status: "published", kahootStatus: "reviewed"          },
  { id: "ses13", cohortId: "c1", num: 13, title: "Career Exploration and Personal Brand",      date: "2026-05-15", presenter: "Sr. Amina",    status: "review",    kahootStatus: "results-imported", notes: "Quiz results imported. Grades pending final review." },
  { id: "ses14", cohortId: "c1", num: 14, title: "Program Showcase and Celebration",           date: "2026-05-29", presenter: "Ustadh Tariq", status: "draft",     kahootStatus: "questions-ready",  notes: "Closing session. Quiz questions drafted — export when ready." },
  { id: "sm1",   cohortId: "c2", num: 1,  title: "Introduction and Program Overview",          date: "2026-06-06", presenter: "Sr. Amina",    status: "published", kahootStatus: "reviewed"          },
  { id: "sm2",   cohortId: "c2", num: 2,  title: "Values-Based Decision Making",               date: "2026-06-13", presenter: "Ustadh Tariq", status: "review",    kahootStatus: "results-imported", notes: "Quiz results imported. Grades pending review." },
];

const KAHOOT_QUESTIONS: Array<{ id: string; text: string; timeLimit: number; points: number }> = [];
const UNUSED_KAHOOT_QUESTION_FIXTURES: Array<{ id: string; text: string; timeLimit: number; points: number }> = [
  { id: "kq1", text: "Which of the 5 pillars comes first?",                       timeLimit: 20, points: 1000 },
  { id: "kq2", text: "How many times do Muslims pray daily?",                      timeLimit: 15, points: 2000 },
  { id: "kq3", text: "What is the Arabic word for charity?",                       timeLimit: 20, points: 1000 },
  { id: "kq4", text: "In which month is the Quran said to have been revealed?",   timeLimit: 20, points: 2000 },
  { id: "kq5", text: "What city did the Prophet ﷺ migrate to during the Hijra?", timeLimit: 25, points: 2000 },
];

const ATTENDANCE_TREND: { session: string; rate: number }[] = [
  { session: "S08", rate: 88  },
  { session: "S09", rate: 100 },
  { session: "S10", rate: 75  },
  { session: "S11", rate: 88  },
  { session: "S12", rate: 88  },
  { session: "S13", rate: 88  },
];

const CATEGORY_AVGS: { category: string; pct: number; color: string }[] = [
  { category: "Conduct",       pct: 85, color: "#f59e0b" },
  { category: "Participation", pct: 81, color: "#14b8a6" },
  { category: "Teamwork",      pct: 78, color: "#6366f1" },
  { category: "Deliverables",  pct: 68, color: "#10b981" },
  { category: "Quiz",          pct: 72, color: "#a855f7" },
];

// ============================================================
// UTILITIES
// ============================================================

const calcScore = (g: SessionGrade | undefined): number => {
  if (!g || !g.present) return 0;
  const obj = 20 + (g.punctual ? 10 : 0) + (g.deliverable ? 20 : 0) + (g.kahootPts || 0);
  const sub = (g.participation || 0) * 6 + (g.teamwork || 0) * 4 + (g.adab || 0) * 5;
  return Math.max(0, obj + sub - (g.penalty || 0));
};

const initGrades = (students: Student[]): Record<string, SessionGrade> => {
  const emptyGrade: Omit<SessionGrade, "studentId"> = {
    present: false,
    punctual: false,
    deliverable: false,
    kahootPts: 0,
    participation: 0,
    teamwork: 0,
    adab: 0,
    penalty: 0,
    penaltyNote: "",
    status: "draft",
  };
  const result: Record<string, SessionGrade> = {};
  students.forEach(stu => {
    result[stu.id] = { studentId: stu.id, ...emptyGrade };
  });
  return result;
};

const mapApiScoresToGrades = (scores: ApiScoreEntry[]): Record<string, SessionGrade> => {
  const result: Record<string, SessionGrade> = {};
  scores.forEach(score => {
    const studentId = String(score.student_id);
    result[studentId] = {
      studentId,
      present: score.present,
      punctual: score.punctual,
      deliverable: score.deliverable,
      kahootPts: score.kahoot_points,
      participation: score.participation_score,
      teamwork: score.teamwork_score,
      adab: score.conduct_score,
      penalty: score.penalty_points,
      penaltyNote: "",
      notes: score.notes,
      status: score.status,
    };
  });
  return result;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const mapApiCohorts = (cohorts: ApiCohort[], students: ApiStudent[], sessions: ApiSession[]): Cohort[] => {
  return cohorts.map(cohort => {
    const id = String(cohort.id);
    const sessionCount = sessions.filter(session => session.cohort_id === cohort.id).length;
    const studentCount = students.filter(student => (student.cohort_ids ?? [student.cohort_id]).includes(cohort.id)).length;

    return {
      id,
      name: cohort.name,
      term: `${cohort.name} Cohort`,
      status: "active",
      sessionCount,
      studentCount,
    };
  });
};

const mapApiStudents = (leaderboard: ApiLeaderboardRow[], students: ApiStudent[], activeCohort: string): Student[] => {
  const leaderboardById = new Map(leaderboard.map(row => [row.id, row]));

  return students.map((student, index) => {
    const row = leaderboardById.get(student.id);
    return {
      id: String(student.id),
      code: student.code,
      name: student.name,
      cohortId: String(student.cohort_id ?? activeCohort),
      cohortIds: (student.cohort_ids?.length ? student.cohort_ids : [student.cohort_id]).filter(Boolean).map(String),
      cohortNames: student.cohort_names ?? (student.cohort_name ? [student.cohort_name] : []),
      playerId: student.kahoot_identifier ?? "",
      attendance: row?.attended_sessions ?? 0,
      totalSessions: Math.max(row?.attended_sessions ?? 0, row?.current_streak ?? 0),
      totalPoints: row?.total ?? 0,
      rank: row?.rank ?? index + 1,
      avatarId: index,
      badges: [],
      streak: row?.current_streak ?? 0,
      joinDate: "",
    };
  });
};

const mapApiSessions = (sessions: ApiSession[]): Session[] => {
  return sessions.map((session, index) => ({
    id: String(session.id),
    cohortId: session.cohort_id ? String(session.cohort_id) : "unassigned",
    num: sessions.length - index,
    title: session.title,
    date: session.date,
    presenter: session.presenter || "Unassigned",
    status: session.status,
    kahootStatus: session.kahoot_status,
    notes: session.notes || `${session.scored_entries}/${session.score_entries} score entries completed.`,
    questionCount: session.question_count,
  }));
};

const parseKahootResultText = (text: string) => {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.toLowerCase().startsWith("identifier,") && !line.toLowerCase().startsWith("nickname,"))
    .map(line => line.split(",").map(value => value.trim()))
    .map(parts => {
      const [first, second, third, fourth, fifth] = parts;
      if (parts.length >= 5) {
        return {
          identifier: first,
          nickname: second,
          correct_count: Number(third) || 0,
          total_questions: Number(fourth) || 0,
          kahoot_points: Number(fifth) || 0,
        };
      }

      return {
        identifier: first,
        nickname: first,
        correct_count: Number(second) || 0,
        total_questions: Number(third) || 0,
        kahoot_points: Number(fourth) || 0,
      };
    })
    .filter(row => row.nickname);
};

// ============================================================
// PIXEL AVATARS
// ============================================================

type AvatarRect = [number, number, number, number, string];
const AVATARS: { bg: string; rects: AvatarRect[] }[] = [
  { bg: "#0D3333", rects: [[10,4,12,3,"#C8960C"],[9,7,14,2,"#C8960C"],[11,6,10,1,"#D4A017"],[11,9,10,8,"#D4956A"],[10,17,12,1,"#C8960C"],[9,18,14,10,"#1A7070"],[11,18,10,2,"#D4956A"],[13,20,6,6,"#D4956A"]] },
  { bg: "#0A2A1A", rects: [[7,4,18,16,"#7DAA7D"],[7,4,18,3,"#5A8C5A"],[11,7,10,10,"#D4956A"],[10,17,12,11,"#3A6E3A"],[12,17,8,4,"#D4956A"]] },
  { bg: "#0A1A33", rects: [[10,5,12,2,"#1A3A6E"],[9,7,14,2,"#1A3A6E"],[11,5,10,2,"#C8960C"],[11,9,10,8,"#C4956A"],[9,17,14,11,"#1A3A6E"],[11,18,10,3,"#C4956A"]] },
  { bg: "#2A1A0A", rects: [[7,4,18,16,"#E8DCC8"],[7,4,18,4,"#D4C4A0"],[11,8,10,9,"#8B6540"],[10,17,12,11,"#6B4A2A"],[12,17,8,3,"#8B6540"]] },
  { bg: "#1A1A1A", rects: [[9,5,14,3,"#888888"],[8,8,16,2,"#999999"],[11,10,10,7,"#D4BCA0"],[14,14,4,2,"#FFFFFF"],[10,17,12,1,"#888888"],[8,18,16,10,"#555555"],[11,18,10,2,"#D4BCA0"]] },
  { bg: "#1A0D00", rects: [[10,4,12,3,"#C8960C"],[9,7,14,2,"#B8860B"],[11,9,10,8,"#B07840"],[13,12,2,1,"#222222"],[17,12,2,1,"#222222"],[11,13,10,1,"#888888"],[9,17,14,11,"#2A5A3A"],[11,18,10,2,"#B07840"]] },
  { bg: "#002222", rects: [[11,5,10,3,"#F0F0F0"],[10,8,12,2,"#E8E8E8"],[11,10,10,7,"#3A1A0A"],[10,17,12,11,"#1A5A5A"],[11,17,10,3,"#3A1A0A"]] },
  { bg: "#2A0A10", rects: [[7,4,18,16,"#C87878"],[7,4,18,4,"#B86868"],[11,8,10,9,"#F0D0C0"],[10,17,12,11,"#A05858"],[12,17,8,3,"#F0D0C0"]] },
];

const PixelAvatar = ({ avatarId, size = 40 }: { avatarId: number; size?: number }) => {
  const av = AVATARS[avatarId % AVATARS.length] ?? AVATARS[0];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32"
      style={{ imageRendering: "pixelated", display: "block", flexShrink: 0 }}>
      <rect width={32} height={32} fill={av.bg} />
      {av.rects.map(([x, y, w, h, fill], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />)}
    </svg>
  );
};

// ============================================================
// GEOMETRIC DECORATIONS
// ============================================================

const GeoBackground = () => (
  <svg style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 0, opacity: 0.03 }}>
    <defs>
      <pattern id="islamicGeo" x={0} y={0} width={80} height={80} patternUnits="userSpaceOnUse">
        <polygon points="40,4 47,20 64,20 51,30 56,47 40,37 24,47 29,30 16,20 33,20" fill="none" stroke="#C8960C" strokeWidth={1} />
        <line x1={0} y1={40} x2={80} y2={40} stroke="#C8960C" strokeWidth={0.3} />
        <line x1={40} y1={0} x2={40} y2={80} stroke="#C8960C" strokeWidth={0.3} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#islamicGeo)" />
  </svg>
);

const HeroArch = ({ dark = false }: { dark?: boolean }) => {
  const stroke = dark ? "#C8960C" : "#8B6914";
  const fill   = dark ? "rgba(200,150,12,0.08)" : "rgba(139,105,20,0.06)";
  return (
    <svg viewBox="0 0 320 200" style={{ width: "100%", height: "100%" }}>
      <path d="M20,190 L20,120 Q20,20 160,10 Q300,20 300,120 L300,190 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
      <path d="M40,190 L40,125 Q40,40 160,30 Q280,40 280,125 L280,190 Z" fill="none" stroke={stroke} strokeWidth={0.5} opacity={0.5} />
      <circle cx={160} cy={12} r={4} fill={stroke} opacity={0.7} />
      <line x1={100} y1={190} x2={100} y2={130} stroke={stroke} strokeWidth={0.5} opacity={0.4} />
      <line x1={220} y1={190} x2={220} y2={130} stroke={stroke} strokeWidth={0.5} opacity={0.4} />
    </svg>
  );
};

// ============================================================
// SHARED UI COMPONENTS
// ============================================================

const GeoDivider = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0" }}>
    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    <span style={{ color: "#C8960C", fontSize: 12 }}>◆</span>
    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
  </div>
);

const SESSION_STATUS_CFG: Record<SessionStatus, { bg: string; text: string; label: string }> = {
  "draft":     { bg: "#E5E7EB", text: "#374151", label: "Draft"     },
  "ready":     { bg: "#DBEAFE", text: "#1E3A8A", label: "Ready"     },
  "live":      { bg: "#D1FAE5", text: "#065F46", label: "Live"      },
  "review":    { bg: "#FEF3C7", text: "#92400E", label: "Review"    },
  "published": { bg: "#DCFCE7", text: "#166534", label: "Published" },
  "archived":  { bg: "#F3F4F6", text: "#4B5563", label: "Archived"  },
};

const SessionStatusBadge = ({ status }: { status: SessionStatus }) => {
  const c = SESSION_STATUS_CFG[status];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.text}44`, padding: "2px 9px", borderRadius: 9999, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      {status === "published" && <Check size={10} />}
      {status === "live"     && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#166534", display: "inline-block" }} />}
      {status === "review"   && <AlertTriangle size={10} />}
      {c.label}
    </span>
  );
};

const KAHOOT_STATUS_CFG: Record<KahootStatus, { bg: string; text: string; label: string }> = {
  "questions-ready":  { bg: "#DBEAFE", text: "#1E3A8A", label: "Questions Ready"  },
  "exported":         { bg: "#EDE9FE", text: "#5B21B6", label: "Exported"          },
  "hosted":           { bg: "#D1FAE5", text: "#065F46", label: "Hosted"            },
  "results-imported": { bg: "#CCFBF1", text: "#115E59", label: "Results Imported"  },
  "reviewed":         { bg: "#DCFCE7", text: "#166534", label: "Reviewed"          },
};

const KahootStatusBadge = ({ status }: { status: KahootStatus }) => {
  const c = KAHOOT_STATUS_CFG[status];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.text}44`, padding: "2px 9px", borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
};

const GRADE_STATUS_CFG: Record<GradeStatus, { bg: string; text: string; label: string }> = {
  "draft":     { bg: "#E5E7EB", text: "#374151", label: "Draft"     },
  "reviewed":  { bg: "#DBEAFE", text: "#1E3A8A", label: "Reviewed"  },
  "published": { bg: "#DCFCE7", text: "#166534", label: "Published" },
};

const GradeStatusBadge = ({ status }: { status: GradeStatus }) => {
  const c = GRADE_STATUS_CFG[status];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.text}44`, padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
      {c.label}
    </span>
  );
};

const BadgePill = ({ badgeId }: { badgeId: string }) => {
  const def = BADGE_DEFS[badgeId];
  if (!def) return null;
  return (
    <span style={{ background: def.color + "22", color: def.color, border: `1px solid ${def.color}44`, padding: "1px 7px", borderRadius: 9999, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
      {def.symbol} {def.label}
    </span>
  );
};

const StatCard = ({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) => (
  <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", borderLeft: accent ? `3px solid ${accent}` : "1px solid var(--border)" }}>
    <p style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</p>
    <p style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{value}</p>
    {sub && <p style={{ color: "var(--muted-foreground)", fontSize: 11, marginTop: 4 }}>{sub}</p>}
  </div>
);

const PageHeader = ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
    <div>
      <h1 style={{ fontFamily: "Lora, Georgia, serif", fontSize: "1.6rem", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{title}</h1>
      {description && <p style={{ color: "var(--muted-foreground)", fontSize: 13, marginTop: 2 }}>{description}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

// ============================================================
// TABLE STYLE CONSTANTS
// ============================================================

const TH: React.CSSProperties = { padding: "9px 12px", textAlign: "left", color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "9px 12px", color: "var(--foreground)", fontSize: 13, borderBottom: "1px solid var(--border)", verticalAlign: "middle" };
const TD_C: React.CSSProperties = { ...TD, textAlign: "center" };
const NUM_INPUT: React.CSSProperties = { width: 52, padding: "4px 6px", fontSize: 13, textAlign: "center", background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 5, fontFamily: "monospace" };

// ============================================================
// ADMIN SIDEBAR
// ============================================================

const NAV_GROUPS = [
  { label: "Overview",  items: [{ id: "dashboard"   as AdminScreen, icon: LayoutDashboard, label: "Dashboard"  }] },
  { label: "Program",   items: [{ id: "leaderboard" as AdminScreen, icon: Trophy,          label: "Leaderboard"}] },
  { label: "Manage",    items: [{ id: "students"    as AdminScreen, icon: Users,           label: "Students"   }, { id: "sessions" as AdminScreen, icon: Calendar, label: "Sessions" }, { id: "scoring" as AdminScreen, icon: ClipboardList, label: "Session" }] },
  { label: "Tools",     items: [{ id: "kahoot"      as AdminScreen, icon: Zap,             label: "Kahoot"     }, { id: "reports" as AdminScreen, icon: BarChart2, label: "Reports"  }] },
];

const AdminSidebar = ({ currentScreen, setScreen, activeCohort, setActiveCohort, cohorts, onTVMode, onLogout }: {
  currentScreen: AdminScreen;
  setScreen: (s: AdminScreen) => void;
  activeCohort: string;
  setActiveCohort: (id: string) => void;
  cohorts: Cohort[];
  onTVMode: () => void;
  onLogout: () => void;
}) => {
  const cohort = cohorts.find(c => c.id === activeCohort);
  return (
    <div style={{ width: 200, minWidth: 200, background: "#0F2020", display: "flex", flexDirection: "column", height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 50, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#C8960C", fontSize: 15, fontWeight: 700 }}>◆</span>
          <span style={{ fontFamily: "Lora, Georgia, serif", color: "#F0E6C8", fontSize: 14, fontWeight: 700 }}>Amal B&apos;Ilm</span>
        </div>
        <p style={{ color: "#4A6A5A", fontSize: 10, marginTop: 3, marginLeft: 23, fontFamily: "monospace", letterSpacing: "0.05em" }}>
          {cohort?.name ?? "—"}
        </p>
      </div>

      {/* Cohort switcher */}
      <div style={{ padding: "4px 12px 10px" }}>
        <select
          value={activeCohort}
          onChange={e => setActiveCohort(e.target.value)}
          style={{ width: "100%", background: "#1A3030", color: "#A8C8B0", border: "1px solid #2A4040", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}
        >
          {cohorts.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.status === "archived" ? " (archived)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ height: 1, background: "#1A3A3A", margin: "4px 0" }} />

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 4 }}>
            <p style={{ color: "#2A5A4A", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", padding: "6px 16px 2px" }}>{group.label}</p>
            {group.items.map(item => {
              const active = currentScreen === item.id;
              return (
                <button key={item.id} onClick={() => setScreen(item.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 16px", background: active ? "#1A4040" : "transparent", borderLeft: active ? "2px solid #C8960C" : "2px solid transparent", color: active ? "#F0E6C8" : "#4A7A6A", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", textAlign: "left", transition: "background 0.12s" }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#142E2E"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                  <item.icon size={14} style={{ opacity: active ? 1 : 0.7 }} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* TV button */}
      <div style={{ padding: "10px 12px 20px" }}>
        <div style={{ height: 1, background: "#1A3A3A", marginBottom: 10 }} />
        <button onClick={onTVMode}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "8px", background: "transparent", border: "1px solid #C8960C44", color: "#C8960C", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Tv size={14} /> TV Display
        </button>
        <button onClick={onLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "8px", marginTop: 8, background: "transparent", border: "1px solid #2A4040", color: "#8FB0A0", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );
};

// ============================================================
// TV MODE
// ============================================================

const TVMode = ({ students, session, intermission, setIntermission, onExit }: {
  students: Student[];
  session: Session | undefined;
  intermission: boolean;
  setIntermission: (v: boolean) => void;
  onExit: () => void;
}) => {
  const sorted = [...students].sort((a, b) => b.totalPoints - a.totalPoints);
  const leader = sorted[0];

  if (intermission) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#081A18", color: "#F0E6C8", display: "grid", placeItems: "center", textAlign: "center", padding: 32 }}>
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.18em", color: "#C8960C" }}>Intermission</p>
          <h1 style={{ margin: 0, fontFamily: "Lora, serif", fontSize: "clamp(2.5rem, 8vw, 6rem)" }}>We will resume shortly</h1>
          <p style={{ margin: "16px 0 0", color: "#8FB0A0", fontSize: "clamp(1rem, 2vw, 1.4rem)" }}>{session ? `Session ${session.num}: ${session.title}` : "Leaderboard display"}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 28 }}>
            <button onClick={() => setIntermission(false)} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#C8960C", color: "#081A18", fontWeight: 800, cursor: "pointer" }}>Resume Leaderboard</button>
            <button onClick={onExit} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #24423A", background: "transparent", color: "#F0E6C8", fontWeight: 700, cursor: "pointer" }}>Exit TV Display</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#081A18", color: "#F0E6C8", display: "flex", flexDirection: "column", padding: "28px 36px", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #24423A", paddingBottom: 18 }}>
        <div>
          <p style={{ margin: "0 0 6px", color: "#C8960C", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.16em" }}>Amal B'Ilm Leaderboard</p>
          <h1 style={{ margin: 0, fontFamily: "Lora, serif", fontSize: "clamp(2rem, 4vw, 4rem)" }}>{session ? `Session ${session.num}: ${session.title}` : "Current Cohort"}</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setIntermission(true)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #24423A", background: "transparent", color: "#F0E6C8", cursor: "pointer", fontWeight: 700 }}>Intermission</button>
          <button onClick={onExit} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#24423A", color: "#F0E6C8", cursor: "pointer", fontWeight: 700 }}>Exit</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 34%) 1fr", gap: 24, minHeight: 0, flex: 1 }}>
        <section style={{ border: "1px solid #24423A", borderRadius: 18, background: "#0D2620", padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
          <p style={{ margin: 0, color: "#8FB0A0", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em" }}>Current Leader</p>
          {leader ? (
            <>
              <PixelAvatar avatarId={leader.avatarId} size={96} />
              <div>
                <h2 style={{ margin: "0 0 8px", fontFamily: "Lora, serif", fontSize: "clamp(2rem, 4vw, 4rem)" }}>{leader.name}</h2>
                <p style={{ margin: 0, fontFamily: "monospace", color: "#8FB0A0", fontSize: 16 }}>{leader.code}</p>
              </div>
              <strong style={{ fontFamily: "monospace", color: "#C8960C", fontSize: "clamp(2rem, 5vw, 5rem)" }}>{leader.totalPoints.toLocaleString()} pts</strong>
            </>
          ) : (
            <p style={{ color: "#8FB0A0", fontSize: 18 }}>No students added yet.</p>
          )}
        </section>

        <section style={{ border: "1px solid #24423A", borderRadius: 18, background: "#0B211D", overflow: "hidden", minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 160px 140px", gap: 12, padding: "14px 18px", borderBottom: "1px solid #24423A", color: "#8FB0A0", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            <span>Rank</span><span>Student</span><span>Points</span><span>Streak</span>
          </div>
          <div style={{ overflow: "auto", maxHeight: "100%" }}>
            {sorted.map((student, index) => (
              <div key={student.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr 160px 140px", gap: 12, alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #12312B", background: index < 3 ? "#102C25" : "transparent" }}>
                <strong style={{ color: index === 0 ? "#C8960C" : "#8FB0A0", fontFamily: "monospace", fontSize: 22 }}>#{index + 1}</strong>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <PixelAvatar avatarId={student.avatarId} size={42} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div>
                    <div style={{ fontFamily: "monospace", color: "#8FB0A0", fontSize: 12 }}>{student.code}</div>
                  </div>
                </div>
                <strong style={{ color: "#F0E6C8", fontFamily: "monospace", fontSize: 20 }}>{student.totalPoints.toLocaleString()}</strong>
                <span style={{ color: student.streak > 0 ? "#8FB0A0" : "#3A5A4A", fontFamily: "monospace", fontWeight: 800 }}>{student.streak > 0 ? `+${student.streak}` : "-"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const LegacyTVMode = ({ students, session, intermission, setIntermission, onExit }: {
  students: Student[];
  session: Session | undefined;
  intermission: boolean;
  setIntermission: (v: boolean) => void;
  onExit: () => void;
}) => {
  const sorted = [...students].sort((a, b) => b.totalPoints - a.totalPoints);
  const top3 = sorted.slice(0, 3);
  const RANK_COLORS = ["#C8960C", "#9A9A9A", "#8B4513"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#081A18", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Pattern background */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.09 }}>
        <defs>
          <pattern id="tvGeo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <polygon points="40,8 46,28 66,28 50,40 56,60 40,48 24,60 30,40 14,28 34,28" fill="none" stroke="#C8960C" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tvGeo)" />
      </svg>

      {/* Top bar */}
      <div style={{ height: "8vh", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", borderBottom: "1px solid #1A3A30", position: "relative", zIndex: 1, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: "#C8960C", fontSize: 18 }}>◆</span>
          <span style={{ fontFamily: "Lora, serif", fontSize: "1.4rem", color: "#F0E6C8", fontWeight: 700 }}>Amal B&apos;Ilm</span>
          <span style={{ color: "#3A5A4A", fontSize: 13, marginLeft: 8, fontFamily: "monospace" }}>
            {session ? `S${session.num} · ${session.title}` : "Season 3"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setIntermission(true)} style={{ padding: "6px 14px", border: "1px solid #1A3A30", background: "transparent", color: "#F0E6C8", cursor: "pointer", fontSize: 12, borderRadius: 6 }}>⏸ Intermission</button>
          <button onClick={onExit} style={{ padding: "6px 14px", border: "none", background: "#1A3A30", color: "#F0E6C8", cursor: "pointer", fontSize: 12, borderRadius: 6, display: "flex", alignItems: "center", gap: 5 }}><X size={13} /> Exit</button>
        </div>
      </div>

      {/* Main body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "35% 65%", position: "relative", zIndex: 1, overflow: "hidden" }}>
        {/* Left — arch + top 3 */}
        <div style={{ borderRight: "1px solid #1A3A30", display: "flex", flexDirection: "column", padding: "20px 18px" }}>
          <div style={{ height: "38%", opacity: 0.85 }}><HeroArch dark={true} /></div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {top3.map((stu, i) => (
              <div key={stu.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0D2620", border: `1px solid ${i === 0 ? "#C8960C44" : "#1A3A30"}`, borderRadius: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: RANK_COLORS[i], width: 26 }}>#{i + 1}</span>
                <PixelAvatar avatarId={stu.avatarId} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#F0E6C8", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stu.name}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#3A5A4A" }}>{stu.code}</div>
                </div>
                <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 16, color: RANK_COLORS[i] }}>{stu.totalPoints.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — full ranking */}
        <div style={{ overflow: "hidden", padding: "16px 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["#", "Student", "Points", "Streak"].map(h => (
                  <th key={h} style={{ padding: "6px 12px", textAlign: "left", color: "#3A5A4A", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #1A3A30" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((stu, i) => {
                const rc = i < 3 ? RANK_COLORS[i] : "#3A5A4A";
                const streakText = stu.streak > 0 ? `+${stu.streak}` : "-";
                return (
                  <tr key={stu.id} style={{ borderBottom: "1px solid #0D2620", background: i < 3 ? "#0D2620" : "transparent" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: rc, fontFamily: "monospace", fontSize: 14 }}>#{i + 1}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PixelAvatar avatarId={stu.avatarId} size={28} />
                        <div>
                          <div style={{ color: "#F0E6C8", fontSize: 13, fontWeight: 600 }}>{stu.name}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#3A5A4A" }}>{stu.code}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: i < 3 ? rc : "#F0E6C8", fontSize: 15 }}>{stu.totalPoints.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", color: stu.streak > 0 ? "#8FB0A0" : "#3A5A4A", fontSize: 13, fontWeight: 700 }}>{streakText}</td>
                  </tr>
                );
                return (
                  <tr key={stu.id} style={{ borderBottom: "1px solid #0D2620", background: i < 3 ? "#0D2620" : "transparent" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: rc, fontFamily: "monospace", fontSize: 14 }}>#{i + 1}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PixelAvatar avatarId={stu.avatarId} size={28} />
                        <div>
                          <div style={{ color: "#F0E6C8", fontSize: 13, fontWeight: 600 }}>{stu.name}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#3A5A4A" }}>{stu.code}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: i < 3 ? rc : "#F0E6C8", fontSize: 15 }}>{stu.totalPoints.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", color: "#4ade80", fontSize: 13 }}>{stu.streak > 0 ? `▲${stu.streak}` : "—"}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {stu.badges.slice(0, 2).map(b => { const d = BADGE_DEFS[b]; return d ? <span key={b} style={{ color: d.color, fontSize: 12 }}>{d.symbol}</span> : null; })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ height: "10vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 28, borderTop: "1px solid #1A3A30", position: "relative", zIndex: 1, flexShrink: 0 }}>
        <span style={{ color: "#3A5A4A", fontSize: 13 }}>{students.length} participants</span>
        <span style={{ color: "#1A3A30" }}>·</span>
        <span style={{ color: "#3A5A4A", fontSize: 13 }}>Leader: <strong style={{ color: "#C8960C" }}>{sorted[0]?.name ?? "—"}</strong></span>
        <span style={{ color: "#1A3A30" }}>·</span>
        <span style={{ color: "#3A5A4A", fontSize: 13, fontFamily: "monospace" }}>{sorted[0]?.totalPoints.toLocaleString() ?? 0} pts</span>
      </div>

      {/* Intermission overlay */}
      {intermission && (
        <div style={{ position: "absolute", inset: 0, zIndex: 110, background: "#040E0C", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 240, height: 180 }}><HeroArch dark={true} /></div>
          <div style={{ fontFamily: "Lora, serif", fontSize: "3rem", color: "#C8960C", marginTop: 8 }}>عمل بعلم</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: "1.5rem", color: "#F0E6C8", marginTop: 4 }}>Amal B&apos;Ilm</div>
          <div style={{ marginTop: 12, padding: "6px 20px", borderRadius: 20, background: "#1A3A30", color: "#C8960C", fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>Break Time</div>
          <p style={{ color: "#3A5A4A", fontSize: 13, marginTop: 12 }}>Session resumes shortly</p>
          <button onClick={() => setIntermission(false)} style={{ marginTop: 28, padding: "12px 32px", border: "none", background: "#C8960C", color: "#040E0C", cursor: "pointer", fontWeight: 700, fontSize: 15, borderRadius: 8 }}>▶ Resume</button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// DASHBOARD
// ============================================================

const DashboardScreen = ({ activeCohort, setActiveCohort, cohorts, students, sessions, setScreen, setSelectedSessionId, setWorkspaceTab, refreshData }: ScreenProps) => {
  const [cohortName, setCohortName] = useState("");
  const [cohortError, setCohortError] = useState("");
  const [showCohortForm, setShowCohortForm] = useState(false);
  const cohort = cohorts.find(c => c.id === activeCohort);
  const completed   = sessions.filter(s => s.status === "published" || s.status === "review" || s.status === "live");
  const upcoming    = sessions.find(s => s.status === "draft" || s.status === "ready");
  const recent      = [...completed].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const needsReview = sessions.filter(s => s.status === "review");
  const topStudents = [...students].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3);
  const avgScore = students.length ? Math.round(students.reduce((s, x) => s + x.totalPoints, 0) / students.length) : 0;
  const avgAtt   = students.length ? Math.round(students.reduce((s, x) => s + (x.attendance / Math.max(x.totalSessions, 1)) * 100, 0) / students.length) : 0;

  const submitCohort = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCohortError("");
    try {
      const createdCohort = await createCohort(cohortName);
      setCohortName("");
      setShowCohortForm(false);
      await refreshData();
      setActiveCohort(String(createdCohort.id));
    } catch (error) {
      console.warn("Could not create cohort.", error);
      setCohortError("Could not create cohort. Use a unique cohort name.");
    }
  };

  if (cohorts.length === 0) {
    return (
      <div>
        <PageHeader title="Set Up Program" description="Create the first cohort before adding students, sessions, questions, or scores." />
        <form onSubmit={submitCohort} style={{ maxWidth: 520, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cohort Name</label>
          <input value={cohortName} onChange={event => setCohortName(event.target.value)} placeholder="Example: Summer 2026 Youth Cohort" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", background: "var(--background)", color: "var(--foreground)", fontSize: 14 }} />
          {cohortError && <div style={{ padding: "9px 10px", borderRadius: 7, background: "#FEE2E2", color: "#7F1D1D", fontSize: 12 }}>{cohortError}</div>}
          <button type="submit" disabled={!cohortName.trim()} style={{ padding: "10px 14px", border: "none", borderRadius: 8, background: cohortName.trim() ? "var(--primary)" : "var(--muted)", color: cohortName.trim() ? "var(--primary-foreground)" : "var(--muted-foreground)", fontWeight: 700, cursor: cohortName.trim() ? "pointer" : "not-allowed" }}>
            Create Cohort
          </button>
          <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 12, lineHeight: 1.5 }}>
            Data flow: cohort first, then students and sessions are attached to that cohort. Scores and questions attach to sessions.
          </p>
        </form>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={cohort ? `${cohort.name} - cohort workspace` : undefined}
        action={
          <button
            onClick={() => setShowCohortForm(value => !value)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}
          >
            <Plus size={14} /> New Cohort
          </button>
        }
      />

      {showCohortForm && (
        <form onSubmit={submitCohort} style={{ marginBottom: 18, maxWidth: 620, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "start" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Cohort name</label>
            <input value={cohortName} onChange={event => setCohortName(event.target.value)} placeholder="Example: Fall 2026 Youth Workshop" style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px", background: "var(--background)", color: "var(--foreground)", fontSize: 13, boxSizing: "border-box" }} />
            {cohortError && <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 7, background: "#FEE2E2", color: "#7F1D1D", fontSize: 12 }}>{cohortError}</div>}
          </div>
          <button type="submit" disabled={!cohortName.trim()} style={{ marginTop: 21, padding: "9px 14px", border: "none", borderRadius: 8, background: cohortName.trim() ? "var(--primary)" : "var(--muted)", color: cohortName.trim() ? "var(--primary-foreground)" : "var(--muted-foreground)", fontWeight: 700, cursor: cohortName.trim() ? "pointer" : "not-allowed" }}>Create</button>
          <button type="button" onClick={() => { setShowCohortForm(false); setCohortError(""); setCohortName(""); }} style={{ marginTop: 21, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>Cancel</button>
        </form>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard label="Students"           value={students.length}                           accent="#C8960C" />
        <StatCard label="Sessions"           value={`${completed.length} / ${sessions.length}`} sub="completed / total" accent="#2A7A5A" />
        <StatCard label="Avg Total Score"    value={avgScore.toLocaleString()}                  sub="pts per student" accent="#4A6EA8" />
        <StatCard label="Avg Attendance"     value={`${avgAtt}%`}                              sub="across all sessions" accent="#7A4AB8" />
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Recent sessions */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
            <h2 style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>Recent Sessions</h2>
            {recent.length === 0 ? <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>No completed sessions yet.</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Title", "Date", "Presenter", "Status"].map(h => (
                      <th key={h} style={{ ...TH, fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map(ses => (
                    <tr key={ses.id} style={{ cursor: "pointer" }} onClick={() => { setSelectedSessionId(ses.id); setWorkspaceTab("overview"); setScreen("scoring"); }}>
                      <td style={{ ...TD, fontWeight: 500, fontSize: 12 }}>{ses.title}</td>
                      <td style={{ ...TD, color: "var(--muted-foreground)", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(ses.date)}</td>
                      <td style={{ ...TD, color: "var(--muted-foreground)", fontSize: 12 }}>{ses.presenter}</td>
                      <td style={TD}><SessionStatusBadge status={ses.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Needs attention */}
          {needsReview.length > 0 && (
            <div style={{ background: "var(--card)", border: "1px solid #78350F66", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={15} color="#92400E" />
                <h2 style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 600, color: "#92400E", margin: 0 }}>Pending Review</h2>
              </div>
              {needsReview.map(ses => (
                <div key={ses.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => { setSelectedSessionId(ses.id); setWorkspaceTab("overview"); setScreen("scoring"); }}>
                  <div>
                    <p style={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500, margin: 0 }}>S{ses.num}: {ses.title}</p>
                    {ses.notes && <p style={{ color: "var(--muted-foreground)", fontSize: 11, margin: "2px 0 0" }}>{ses.notes}</p>}
                  </div>
                  <ChevronRight size={14} color="var(--muted-foreground)" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Upcoming */}
          {upcoming && (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
              <h2 style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px" }}>Upcoming Session</h2>
              <div style={{ background: "#0F2A1A", borderRadius: 8, padding: 12 }}>
                <p style={{ color: "#C8960C", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>S{upcoming.num}</p>
                <p style={{ color: "#F0E6C8", fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>{upcoming.title}</p>
                <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                  <span style={{ color: "#5A8A6A", fontSize: 11 }}><Calendar size={10} style={{ display: "inline", marginRight: 3 }} />{fmtDate(upcoming.date)}</span>
                  <span style={{ color: "#5A8A6A", fontSize: 11 }}>{upcoming.presenter}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}><SessionStatusBadge status={upcoming.status} /></div>
                {upcoming.notes && <p style={{ color: "#4A6A5A", fontSize: 11, marginTop: 8, fontStyle: "italic" }}>{upcoming.notes}</p>}
                <button
                  onClick={() => { setSelectedSessionId(upcoming.id); setWorkspaceTab("overview"); setScreen("scoring"); }}
                  style={{ width: "100%", marginTop: 12, padding: 8, borderRadius: 7, border: "1px solid rgba(248,235,199,0.18)", background: "rgba(248,235,199,0.08)", color: "#F8EBC7", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  Open Session Workspace <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Top performers */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
            <h2 style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>Top Performers</h2>
            {topStudents.map((stu, i) => (
              <div key={stu.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < topStudents.length - 1 ? "1px solid var(--border)" : undefined }}>
                <span style={{ color: i === 0 ? "#C8960C" : i === 1 ? "#9A9A9A" : "#8B4513", fontSize: 12, fontWeight: 700, width: 18, textAlign: "center", fontFamily: "monospace" }}>{i + 1}</span>
                <PixelAvatar avatarId={stu.avatarId} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stu.name}</p>
                  <p style={{ color: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace", margin: 0 }}>{stu.code}</p>
                </div>
                <span style={{ color: "#C8960C", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{stu.totalPoints.toLocaleString()}</span>
              </div>
            ))}
            <button onClick={() => setScreen("leaderboard")} style={{ width: "100%", marginTop: 10, padding: 7, background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--muted-foreground)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              View Full Leaderboard <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// LEADERBOARD
// ============================================================

const LeaderboardScreen = (props: ScreenProps) => {
  const [filterCohort, setFilterCohort] = useState(props.activeCohort);
  const [timeFilter, setTimeFilter] = useState<"session" | "alltime" | "improvers">("session");
  const [sessionScores, setSessionScores] = useState<ApiScoreEntry[]>([]);
  const [sessionScoreStatus, setSessionScoreStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const students = props.allStudents.filter(s => s.cohortIds.includes(filterCohort));
  const sorted   = [...students].sort((a, b) => b.totalPoints - a.totalPoints);
  const cohortSessions = props.sessions.filter(session => session.cohortId === filterCohort);
  const selectedSession = cohortSessions.find(session => session.id === props.selectedSessionId) ?? cohortSessions[0] ?? props.sessions[0];
  const sessionRows = [...sessionScores].sort((a, b) => b.total_points - a.total_points || a.student_name.localeCompare(b.student_name));
  const top3 = sorted.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const podiumRanks = [2, 1, 3];
  const RANK_COLORS = ["#9A9A9A", "#C8960C", "#8B4513"];
  const DELTAS      = [340, 280, 210, 190, 155, 90, -10, -50];

  const improvers = [...students].map((s, i) => ({ ...s, delta: DELTAS[i] ?? 0 })).sort((a, b) => b.delta - a.delta);

  useEffect(() => {
    if (!selectedSession) {
      setSessionScores([]);
      setSessionScoreStatus("idle");
      return;
    }

    const sessionId = Number(selectedSession.id);
    if (!Number.isFinite(sessionId)) {
      setSessionScores([]);
      setSessionScoreStatus("idle");
      return;
    }

    let cancelled = false;
    setSessionScoreStatus("loading");

    fetchSessionScores(sessionId)
      .then(scores => {
        if (cancelled) return;
        setSessionScores(scores);
        setSessionScoreStatus("ready");
      })
      .catch(error => {
        if (cancelled) return;
        console.warn("Could not load session leaderboard.", error);
        setSessionScores([]);
        setSessionScoreStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSession?.id]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", fontSize: 13, fontWeight: active ? 600 : 400, background: "transparent", border: "none",
    borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
    color: active ? "var(--primary)" : "var(--muted-foreground)", cursor: "pointer", marginBottom: -1,
  });

  return (
    <div>
      <PageHeader title="Leaderboard"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <ExternalLink size={13} /> Public View
            </button>
            <button onClick={props.onTVMode} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <Tv size={13} /> TV Display
            </button>
          </div>
        }
      />

      {/* Cohort pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {props.cohorts.map(c => (
          <button key={c.id} onClick={() => setFilterCohort(c.id)}
            style={{ padding: "6px 14px", borderRadius: 20, border: filterCohort === c.id ? "none" : "1px solid var(--border)", background: filterCohort === c.id ? "var(--primary)" : "var(--card)", color: filterCohort === c.id ? "var(--primary-foreground)" : "var(--foreground)", cursor: "pointer", fontSize: 13, fontWeight: filterCohort === c.id ? 600 : 400 }}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Tab filter */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        <button style={btnStyle(timeFilter === "session")}   onClick={() => setTimeFilter("session")}>This Session</button>
        <button style={btnStyle(timeFilter === "alltime")}   onClick={() => setTimeFilter("alltime")}>All-Time</button>
        <button style={btnStyle(timeFilter === "improvers")} onClick={() => setTimeFilter("improvers")}>Top Improvers</button>
      </div>

      {timeFilter === "alltime" && (
        <>
          {/* Podium */}
          {top3.length >= 2 && (
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 28, marginBottom: 36, padding: "16px 0" }}>
              {podiumOrder.map((stu, idx) => {
                if (!stu) return null;
                const rank  = podiumRanks[idx];
                const color = RANK_COLORS[rank - 1];
                const big   = idx === 1;
                return (
                  <div key={stu.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <PixelAvatar avatarId={stu.avatarId} size={big ? 72 : 52} />
                    <div style={{ fontSize: big ? 14 : 12, fontWeight: 600, color: "var(--foreground)", textAlign: "center", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stu.name}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)" }}>{stu.code}</div>
                    <div style={{ fontFamily: "monospace", fontSize: big ? 20 : 16, fontWeight: 700, color }}>{stu.totalPoints.toLocaleString()}</div>
                    <div style={{ background: color, color: "#fff", borderRadius: "8px 8px 0 0", width: big ? 90 : 72, height: big ? 120 : 80, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10, fontWeight: 800, fontSize: 20 }}>
                      #{rank}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full table */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["Rank", "Student", "Cohort", "Points", "Attendance", "Streak"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {sorted.map((stu, i) => {
                  const rank  = i + 1;
                  const color = rank <= 3 ? RANK_COLORS[rank - 1] : "var(--muted-foreground)";
                  const coh = props.cohorts.find(c => c.id === stu.cohortId);
                  const cohortLabel = stu.cohortNames.length ? stu.cohortNames.join(", ") : stu.cohortIds.join(", ");
                  const streakText = stu.streak > 0 ? `+${stu.streak}` : "-";
                  return (
                    <tr key={stu.id}>
                      <td style={{ ...TD, fontWeight: 700, color, fontFamily: "monospace" }}>#{rank}</td>
                      <td style={TD}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <PixelAvatar avatarId={stu.avatarId} size={30} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{stu.name}</div>
                            <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{stu.code}</div>
                          </div>
                        </div>
                      </td>
                      <td style={TD}><span style={{ padding: "2px 8px", background: "var(--secondary)", borderRadius: 4, fontSize: 11 }}>{cohortLabel}</span></td>
                      <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700 }}>{stu.totalPoints.toLocaleString()}</td>
                      <td style={{ ...TD, color: "var(--muted-foreground)" }}>{stu.attendance}/{stu.totalSessions}</td>
                      <td style={{ ...TD, color: stu.streak > 0 ? "#166534" : "var(--muted-foreground)", fontWeight: stu.streak > 0 ? 700 : 500 }}>{streakText}</td>
                    </tr>
                  );
                  return (
                    <tr key={stu.id}>
                      <td style={{ ...TD, fontWeight: 700, color, fontFamily: "monospace" }}>#{rank}</td>
                      <td style={TD}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <PixelAvatar avatarId={stu.avatarId} size={30} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{stu.name}</div>
                            <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{stu.code}</div>
                          </div>
                        </div>
                      </td>
                      <td style={TD}><span style={{ padding: "2px 8px", background: "var(--secondary)", borderRadius: 4, fontSize: 11 }}>{coh?.name ?? stu.cohortId}</span></td>
                      <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700 }}>{stu.totalPoints.toLocaleString()}</td>
                      <td style={{ ...TD, color: "var(--muted-foreground)" }}>{stu.attendance}/{stu.totalSessions}</td>
                      <td style={{ ...TD, color: stu.streak > 0 ? "#4ade80" : "var(--muted-foreground)" }}>{stu.streak > 0 ? `▲${stu.streak}` : "—"}</td>
                      <td style={TD}><div style={{ display: "flex", gap: 4 }}>{stu.badges.slice(0, 2).map(b => { const d = BADGE_DEFS[b]; return d ? <span key={b} title={d.label} style={{ color: d.color, fontSize: 13 }}>{d.symbol}</span> : null; })}</div></td>
                      <td style={TD}><ChevronRight size={15} color="var(--muted-foreground)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {timeFilter === "session" && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--secondary)", fontSize: 12, color: "var(--muted-foreground)" }}>
            {selectedSession ? `Session ${selectedSession.num} - ${selectedSession.title}` : "No session selected"}
          </div>
          {sessionScoreStatus === "loading" && <div style={{ padding: 18, color: "var(--muted-foreground)", fontSize: 13 }}>Loading session scores...</div>}
          {sessionScoreStatus === "error" && <div style={{ padding: 18, color: "#7F1D1D", background: "#FEE2E2", fontSize: 13 }}>Could not load scores for this session.</div>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Rank", "Student", "Attendance", "Quiz Points", "Session Score"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {sessionRows.map((row, i) => (
                  <tr key={row.student_id}>
                    <td style={{ ...TD, fontWeight: 700, color: i < 3 ? RANK_COLORS[i] : "var(--muted-foreground)", fontFamily: "monospace" }}>#{i + 1}</td>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PixelAvatar avatarId={i} size={28} />
                        <div><div style={{ fontWeight: 600 }}>{row.student_name}</div><div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{row.student_code}</div></div>
                      </div>
                    </td>
                    <td style={{ ...TD, color: row.present ? "#166534" : "var(--muted-foreground)", fontWeight: row.present ? 700 : 500 }}>{row.present ? "Present" : "Not marked"}</td>
                    <td style={{ ...TD, fontFamily: "monospace", color: "var(--muted-foreground)" }}>{row.kahoot_points.toLocaleString()}</td>
                    <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700 }}>{row.total_points.toLocaleString()}</td>
                  </tr>
              ))}
              {sessionScoreStatus === "ready" && sessionRows.length === 0 && (
                <tr><td colSpan={5} style={{ ...TD, textAlign: "center", padding: 24, color: "var(--muted-foreground)" }}>No scores saved for this session yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {timeFilter === "improvers" && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Rank", "Student", "Points Gained", "Total"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {improvers.map((stu, i) => (
                <tr key={stu.id}>
                  <td style={{ ...TD, fontWeight: 700, color: i < 3 ? RANK_COLORS[i] : "var(--muted-foreground)", fontFamily: "monospace" }}>#{i + 1}</td>
                  <td style={TD}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PixelAvatar avatarId={stu.avatarId} size={28} />
                      <div><div style={{ fontWeight: 600 }}>{stu.name}</div><div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{stu.code}</div></div>
                    </div>
                  </td>
                  <td style={TD}><span style={{ fontFamily: "monospace", fontWeight: 700, color: stu.delta >= 0 ? "#4ade80" : "#f87171", fontSize: 15 }}>{stu.delta >= 0 ? "+" : ""}{stu.delta}</span></td>
                  <td style={{ ...TD, fontFamily: "monospace", fontWeight: 600 }}>{stu.totalPoints.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================
// STUDENTS
// ============================================================

const StudentsScreen = (props: ScreenProps) => {
  const [filterCohort, setFilterCohort] = useState(props.activeCohort || "all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cohortIds: props.activeCohort ? [props.activeCohort] : [], playerId: "" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (props.activeCohort) setFilterCohort(props.activeCohort);
  }, [props.activeCohort]);

  const filtered = props.allStudents.filter(s =>
    (filterCohort === "all" || s.cohortIds.includes(filterCohort)) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
  );

  const nameCounts: Record<string, number> = {};
  props.allStudents.forEach(s => { nameCounts[s.name] = (nameCounts[s.name] || 0) + 1; });

  const panelOpen = addOpen || editingId !== null;
  const editingStu = editingId ? props.allStudents.find(s => s.id === editingId) : null;

  const openEdit = (s: Student) => {
    setEditingId(s.id);
    setAddOpen(false);
    setFormError("");
    setForm({ name: s.name, cohortIds: s.cohortIds.length ? s.cohortIds : [s.cohortId], playerId: s.playerId ?? "" });
  };
  const openAdd  = () => { setAddOpen(true); setEditingId(null); setFormError(""); setForm({ name: "", cohortIds: props.activeCohort ? [props.activeCohort] : props.cohorts[0]?.id ? [props.cohorts[0].id] : [], playerId: "" }); };
  const close    = () => { setAddOpen(false); setEditingId(null); setFormError(""); };

  const submitStudent = async () => {
    setFormError("");
    try {
      const payload = {
        name: form.name,
        cohort_id: Number(form.cohortIds[0]),
        cohort_ids: form.cohortIds.map(Number),
        kahoot_identifier: form.playerId.trim() || undefined,
      };

      if (editingId) {
        await updateStudent(Number(editingId), payload);
      } else {
        await createStudent(payload);
      }

      close();
      await props.refreshData();
    } catch (error) {
      console.warn("Could not save student.", error);
      setFormError("Could not save student. Check the name and cohort.");
    }
  };

  const removeStudent = async () => {
    if (!editingStu) return;

    const confirmed = window.confirm(`Delete ${editingStu.name}? This removes the student and their saved scores from this app.`);
    if (!confirmed) return;

    setFormError("");
    try {
      await deleteStudent(Number(editingStu.id));
      close();
      await props.refreshData();
    } catch (error) {
      console.warn("Could not delete student.", error);
      setFormError("Could not delete student. Try again before making other changes.");
    }
  };

  const inputSt: React.CSSProperties = { width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)", color: "var(--foreground)", fontSize: 13, boxSizing: "border-box" };
  const labelSt: React.CSSProperties = { display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div>
      <PageHeader title="Students"
        action={<button onClick={openAdd} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Plus size={13} /> Add Student</button>}
      />

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: "all", name: "All Cohorts" }, ...props.cohorts].map(c => (
            <button key={c.id} onClick={() => setFilterCohort(c.id)}
              style={{ padding: "5px 13px", borderRadius: 20, border: filterCohort === c.id ? "none" : "1px solid var(--border)", background: filterCohort === c.id ? "var(--primary)" : "var(--card)", color: filterCohort === c.id ? "var(--primary-foreground)" : "var(--foreground)", cursor: "pointer", fontSize: 12, fontWeight: filterCohort === c.id ? 600 : 400 }}>
              {c.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", background: "var(--card)", flex: 1, maxWidth: 280 }}>
          <Search size={13} color="var(--muted-foreground)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code…"
            style={{ border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, width: "100%" }} />
          {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}><X size={13} color="var(--muted-foreground)" /></button>}
        </div>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{filtered.length} student{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: panelOpen ? "60% 40%" : "1fr", gap: 20, alignItems: "start" }}>
        {/* Table */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>{["Code", "Name", "Cohort", "Kahoot Match", "Attendance", "Points", "Rank", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(stu => {
                const cohortLabel = stu.cohortNames.length ? stu.cohortNames.join(", ") : stu.cohortIds.join(", ");
                const dup = nameCounts[stu.name] > 1;
                return (
                  <tr key={stu.id} style={{ background: editingId === stu.id ? "var(--secondary)" : "transparent" }}>
                    <td style={{ ...TD, fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)" }}>{stu.code}</td>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <PixelAvatar avatarId={stu.avatarId} size={26} />
                        <span style={{ fontWeight: 600 }}>{stu.name}</span>
                        {dup && <AlertTriangle size={12} color="#f59e0b" title="Duplicate name — use code to distinguish" />}
                      </div>
                    </td>
                    <td style={TD}><span style={{ padding: "2px 7px", background: "var(--secondary)", borderRadius: 4, fontSize: 11 }}>{cohortLabel}</span></td>
                    <td style={{ ...TD, fontFamily: "monospace", fontSize: 11, color: stu.playerId ? "var(--foreground)" : "var(--muted-foreground)" }}>{stu.playerId || <span style={{ fontStyle: "italic", fontFamily: "inherit" }}>Not set</span>}</td>
                    <td style={{ ...TD, color: "var(--muted-foreground)" }}>{stu.attendance}/{stu.totalSessions}</td>
                    <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700 }}>{stu.totalPoints.toLocaleString()}</td>
                    <td style={{ ...TD, color: "var(--muted-foreground)" }}>#{stu.rank}</td>
                    <td style={TD}><button onClick={() => openEdit(stu)} style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><Edit3 size={11} /> Edit</button></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: "var(--muted-foreground)", padding: 24 }}>No students found.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Add/Edit panel */}
        {panelOpen && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 20, position: "sticky", top: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)", fontFamily: "Lora, serif" }}>{addOpen ? "Add Student" : `Edit: ${editingStu?.name ?? ""}`}</h3>
              <button onClick={close} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}><X size={15} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelSt}>Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Student name" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>
                  Student Code {!addOpen && <span style={{ color: "#f59e0b", fontStyle: "normal", textTransform: "none", letterSpacing: 0 }}>⚠ permanent</span>}
                </label>
                <input value={editingStu?.code ?? "Generated after save"} disabled
                  style={{ ...inputSt, fontFamily: "monospace", background: "var(--muted)", cursor: "not-allowed" }} />
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>Permanent internal ID. If Kahoot match is blank, this code becomes the matching fallback.</p>
              </div>
              <div>
                <label style={labelSt}>Cohorts</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--background)" }}>
                  {props.cohorts.map(c => {
                    const checked = form.cohortIds.includes(c.id);
                    return (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => setForm(f => {
                            const nextIds = event.target.checked
                              ? [...f.cohortIds, c.id]
                              : f.cohortIds.filter(id => id !== c.id);
                            return { ...f, cohortIds: nextIds };
                          })}
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>Students can belong to more than one cohort. Sessions still belong to one cohort.</p>
              </div>
              <div>
                <label style={labelSt}>Kahoot Match <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--muted-foreground)", fontWeight: 400 }}>(optional)</span></label>
                <input value={form.playerId} onChange={e => setForm(f => ({ ...f, playerId: e.target.value }))} placeholder="Leave blank to use generated student code" style={inputSt} />
              </div>
            </div>
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "var(--secondary)", fontSize: 11, color: "var(--muted-foreground)", display: "flex", gap: 7, alignItems: "flex-start" }}>
              <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              Kahoot matching should use the generated student code or a deliberate Kahoot identifier. Names alone are not reliable enough for result matching.
            </div>
            {formError && <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 7, background: "#FEE2E2", color: "#7F1D1D", fontSize: 12 }}>{formError}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {editingId && (
                <button onClick={removeStudent} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #991B1B33", background: "#FEE2E2", color: "#7F1D1D", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <Trash2 size={13} /> Delete
                </button>
              )}
              <button onClick={submitStudent} disabled={!form.name.trim() || form.cohortIds.length === 0} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: form.name.trim() && form.cohortIds.length > 0 ? "var(--primary)" : "var(--muted)", color: form.name.trim() && form.cohortIds.length > 0 ? "var(--primary-foreground)" : "var(--muted-foreground)", cursor: form.name.trim() && form.cohortIds.length > 0 ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Save size={13} /> {addOpen ? "Add Student" : "Save Changes"}
              </button>
              <button onClick={close} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// SESSIONS
// ============================================================

const SessionsScreen = (props: ScreenProps) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [viewNotes, setViewNotes] = useState<string | null>(null);
  const [form, setForm] = useState({ cohortId: props.activeCohort, title: "", date: "", startTime: "18:00", presenter: "", notes: "" });
  const [formError, setFormError] = useState("");
  const sorted = [...props.sessions].sort((a, b) => b.num - a.num);

  const submitSession = async () => {
    setFormError("");
    try {
      const createdSession = await createSession({
        cohort_id: Number(form.cohortId),
        title: form.title,
        presenter: form.presenter,
        date: form.date,
        start_time: form.startTime,
        notes: form.notes,
      });
      setCreateOpen(false);
      setForm({ cohortId: props.activeCohort || props.cohorts[0]?.id || "", title: "", date: "", startTime: "18:00", presenter: "", notes: "" });
      await props.refreshData();
      props.setSelectedSessionId(String(createdSession.id));
      props.setWorkspaceTab("overview");
      props.setScreen("scoring");
    } catch (error) {
      console.warn("Could not create session.", error);
      setFormError("Could not create session. Check cohort, title, date, and start time.");
    }
  };

  const inputSt: React.CSSProperties = { width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)", color: "var(--foreground)", fontSize: 13, boxSizing: "border-box" };
  const labelSt: React.CSSProperties = { display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div>
      <PageHeader title="Sessions"
        action={<button onClick={() => setCreateOpen(o => !o)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Plus size={13} /> New Session</button>}
      />

      {/* Create form */}
      {createOpen && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>Create New Session</h3>
            <button onClick={() => setCreateOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}><X size={15} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
            <div><label style={labelSt}>Cohort</label>
              <select value={form.cohortId} onChange={e => setForm(f => ({ ...f, cohortId: e.target.value }))} style={inputSt}>
                  {props.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label style={labelSt}>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputSt} /></div>
            <div><label style={labelSt}>Start Time</label><input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={inputSt} /></div>
            <div style={{ gridColumn: "span 2" }}><label style={labelSt}>Title</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Session title" style={inputSt} /></div>
            <div><label style={labelSt}>Presenter</label><input value={form.presenter} onChange={e => setForm(f => ({ ...f, presenter: e.target.value }))} placeholder="Name" style={inputSt} /></div>
            <div style={{ gridColumn: "span 3" }}><label style={labelSt}>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional session notes…" rows={2} style={{ ...inputSt, resize: "vertical" }} /></div>
          </div>
          {formError && <div style={{ marginBottom: 12, padding: "9px 10px", borderRadius: 7, background: "#FEE2E2", color: "#7F1D1D", fontSize: 12 }}>{formError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submitSession} disabled={!form.cohortId || !form.title.trim() || !form.date || !form.startTime} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: form.cohortId && form.title.trim() && form.date && form.startTime ? "var(--primary)" : "var(--muted)", color: form.cohortId && form.title.trim() && form.date && form.startTime ? "var(--primary-foreground)" : "var(--muted-foreground)", cursor: form.cohortId && form.title.trim() && form.date && form.startTime ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Save size={13} /> Create Session</button>
            <button onClick={() => setCreateOpen(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["#", "Title", "Date", "Presenter", "Status", "Actions"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {sorted.map(ses => (
              <React.Fragment key={ses.id}>
                <tr>
                  <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, color: "var(--muted-foreground)" }}>{ses.num}</td>
                  <td style={TD}>
                    <div style={{ fontWeight: 600 }}>{ses.title}</div>
                    {ses.notes && <div style={{ fontSize: 11, color: "var(--muted-foreground)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ses.notes}</div>}
                  </td>
                  <td style={{ ...TD, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{fmtDate(ses.date)}</td>
                  <td style={TD}>{ses.presenter}</td>
                  <td style={TD}><SessionStatusBadge status={ses.status} /></td>
                  <td style={TD}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { props.setSelectedSessionId(ses.id); props.setWorkspaceTab("overview"); props.setScreen("scoring"); }}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <ClipboardList size={11} /> Open Workspace
                      </button>
                      {ses.notes && (
                        <button onClick={() => setViewNotes(viewNotes === ses.id ? null : ses.id)}
                          style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          <FileText size={11} /> Notes
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {viewNotes === ses.id && ses.notes && (
                  <tr>
                    <td colSpan={7} style={{ ...TD, background: "var(--secondary)", fontSize: 12, color: "var(--muted-foreground)", fontStyle: "italic" }}>
                      {ses.notes}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {sorted.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign: "center", color: "var(--muted-foreground)", padding: 24 }}>No sessions. Create your first above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// SCORING
// ============================================================

const ScoringScreen = ({ students, sessions, selectedSessionId, setSelectedSessionId, refreshData }: ScreenProps) => {
  const [grades, setGrades] = useState<Record<string, SessionGrade>>(() => initGrades(students));
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [sessionStatus, setSessionStatus] = useState<GradeStatus>("draft");
  const [showDefaults, setShowDefaults] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [scoresLoading, setScoresLoading] = useState(false);

  const cohortSessions = [...sessions].sort((a, b) => a.num - b.num);
  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? sessions[0];

  useEffect(() => {
    if (!selectedSession) {
      setGrades({});
      return;
    }

    const numericSessionId = Number(selectedSession.id);
    if (!Number.isFinite(numericSessionId)) {
      setGrades(initGrades(students));
      return;
    }

    let cancelled = false;
    setScoresLoading(true);
    setSaveError("");

    fetchSessionScores(numericSessionId)
      .then(scores => {
        if (cancelled) return;
        setGrades(mapApiScoresToGrades(scores));
        setSessionStatus(scores.some(score => score.status === "published") ? "published" : scores.some(score => score.status === "reviewed") ? "reviewed" : "draft");
      })
      .catch(error => {
        if (cancelled) return;
        console.warn("Could not load scores.", error);
        setGrades(initGrades(students));
        setSaveError("Could not load saved scores for this session.");
      })
      .finally(() => {
        if (!cancelled) setScoresLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSession?.id, students]);

  const setGrade = (id: string, patch: Partial<SessionGrade>) =>
    setGrades(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const saveScores = async (status: GradeStatus = sessionStatus) => {
    if (!selectedSession) return;

    const numericSessionId = Number(selectedSession.id);
    if (!Number.isFinite(numericSessionId)) {
      setSaveError("Scores can only be saved after this session exists in the backend.");
      return;
    }

    setSaveError("");
    const scores = students.map(student => {
      const grade = grades[student.id] ?? initGrades([student])[student.id];
      return {
        student_id: Number(student.id),
        present: grade.present,
        punctual: grade.punctual,
        deliverable: grade.deliverable,
        kahoot_points: grade.kahootPts,
        participation_score: grade.participation,
        teamwork_score: grade.teamwork,
        conduct_score: grade.adab,
        penalty_points: grade.penalty,
        notes: grade.notes ?? "",
        status,
      };
    });

    try {
      const result = await saveSessionScores(numericSessionId, { status, scores });
      setGrades(mapApiScoresToGrades(result.scores));
      setSessionStatus(status);
      await refreshData();
    } catch (error) {
      console.warn("Could not save scores.", error);
      setSaveError("Could not save scores. Check the backend server and try again.");
    }
  };

  const submitForReview = () => {
    setGrades(prev => { const n = { ...prev }; for (const k in n) n[k] = { ...n[k], status: "reviewed" }; return n; });
    void saveScores("reviewed");
  };
  const lockSession = () => {
    setGrades(prev => { const n = { ...prev }; for (const k in n) n[k] = { ...n[k], status: "published" }; return n; });
    void saveScores("published");
  };
  const cycleStatus = (id: string) => {
    if (sessionStatus === "published") return;
    const cur = grades[id]?.status ?? "draft";
    setGrade(id, { status: cur === "draft" ? "reviewed" : cur === "reviewed" ? "published" : "draft" }); // cycle: draft → reviewed → published
  };

  const presentCount = students.filter(s => grades[s.id]?.present).length;
  const avgScore = students.length ? Math.round(students.map(s => calcScore(grades[s.id])).reduce((a, b) => a + b, 0) / students.length) : 0;
  const gradedCount = students.filter(s => (grades[s.id]?.status ?? "draft") !== "draft").length;

  const scoreColor = (n: number) => n >= 200 ? "#166534" : n >= 150 ? "#92400E" : n < 80 ? "var(--muted-foreground)" : "var(--foreground)";

  const TH2: React.CSSProperties = { padding: "7px 10px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "var(--foreground)", borderRight: "1px solid var(--border)", whiteSpace: "nowrap" };
  const TD2: React.CSSProperties = { padding: "6px 10px", textAlign: "center", verticalAlign: "middle", borderRight: "1px solid var(--border)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader title="Session Scoring" description="Grade students for a selected session" />

      {/* Session selector + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
          style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 12px", fontSize: 13 }}>
          {cohortSessions.map(s => <option key={s.id} value={s.id}>Session {s.num} — {s.title}</option>)}
        </select>
        {selectedSession && <SessionStatusBadge status={selectedSession.status} />}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowDefaults(v => !v)}
            style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>
          {showDefaults ? "Hide Defaults" : "Quick Fill"}
          </button>
          <button onClick={() => void saveScores("draft")} style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600 }}>
            Save Draft
          </button>
          {sessionStatus === "draft"    && <button onClick={submitForReview} style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, background: "var(--primary)", color: "var(--primary-foreground)", border: "none", cursor: "pointer", fontWeight: 600 }}>Mark as Reviewed</button>}
          {sessionStatus === "reviewed" && <button onClick={lockSession} style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, background: "#14532D", color: "#DCFCE7", border: "none", cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={12} />Publish Grades</button>}
          {sessionStatus === "published" && <span style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, background: "#DCFCE7", color: "#14532D", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={12} />Grades Published</span>}
        </div>
      </div>

      {/* Session info bar */}
      {selectedSession && (
        <div style={{ display: "flex", gap: 20, alignItems: "center", padding: "10px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--muted-foreground)", flexWrap: "wrap" }}>
          <span><strong style={{ color: "var(--foreground)" }}>Date:</strong> {fmtDate(selectedSession.date)}</span>
          <span><strong style={{ color: "var(--foreground)" }}>Presenter:</strong> {selectedSession.presenter}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><strong style={{ color: "var(--foreground)" }}>Quiz:</strong><KahootStatusBadge status={selectedSession.kahootStatus} /></span>
          {selectedSession.notes && <span style={{ fontStyle: "italic" }}>{selectedSession.notes.slice(0, 80)}{selectedSession.notes.length > 80 ? "…" : ""}</span>}
        </div>
      )}

      {scoresLoading && <div style={{ padding: "10px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted-foreground)", fontSize: 13 }}>Loading saved scores...</div>}
      {saveError && <div style={{ padding: "10px 14px", background: "#FEE2E2", borderRadius: 8, color: "#7F1D1D", fontSize: 13 }}>{saveError}</div>}

      {/* Quick fill */}
      {showDefaults && (
        <div style={{ padding: "14px 16px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px" }}>Quick Fill Defaults</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Mark All Present",    fn: () => setGrades(p => { const n = { ...p }; for (const k in n) n[k] = { ...n[k], present: true };       return n; }) },
              { label: "Set All Punctual",    fn: () => setGrades(p => { const n = { ...p }; for (const k in n) n[k] = { ...n[k], punctual: true };      return n; }) },
              { label: "Apply 7 / 7 / 7",    fn: () => setGrades(p => { const n = { ...p }; for (const k in n) n[k] = { ...n[k], participation: 7, teamwork: 7, adab: 7 }; return n; }) },
              { label: "Clear All Scores",    fn: () => setGrades(initGrades(students)) },
            ].map(b => (
              <button key={b.label} onClick={b.fn}
                style={{ padding: "5px 12px", fontSize: 12, borderRadius: 6, background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scoring table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 960, borderCollapse: "collapse", width: "100%", fontSize: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
          <thead>
            <tr style={{ background: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
              <th colSpan={2} style={TH2}>Student</th>
              <th colSpan={4} style={{ ...TH2, background: "rgba(52,211,153,0.07)" }}>Objective</th>
              <th colSpan={3} style={{ ...TH2, background: "rgba(99,102,241,0.07)" }}>Subjective</th>
              <th style={{ ...TH2, background: "rgba(239,68,68,0.07)" }}>Pen</th>
              <th style={TH2}>Total</th>
              <th style={TH2}>Status</th>
              <th style={TH2}></th>
            </tr>
            <tr style={{ background: "var(--secondary)", borderBottom: "2px solid var(--border)" }}>
              {["#", "Name", "Present", "Punc.", "Deliv.", "Quiz", "Part.", "Team.", "Conduct", "Penalty", "Total", "Status", "⋮"].map(h => (
                <th key={h} style={{ ...TH2, fontSize: 10, color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((stu, idx) => {
              const g = grades[stu.id];
              const score = calcScore(g);
              const notesOpen = expandedNotes[stu.id];
              return (
                <React.Fragment key={stu.id}>
                  <tr style={{ borderBottom: notesOpen ? "none" : "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                    <td style={{ ...TD2, fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{String(idx + 1).padStart(2, "0")}</td>
                    <td style={{ ...TD2, textAlign: "left", minWidth: 160 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <PixelAvatar avatarId={stu.avatarId} size={24} />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--foreground)", fontSize: 12 }}>{stu.name}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{stu.code}</div>
                        </div>
                      </div>
                    </td>
                    <td style={TD2}>
                      <input type="checkbox" checked={!!g?.present} onChange={e => setGrade(stu.id, { present: e.target.checked, punctual: e.target.checked ? (g?.punctual ?? false) : false })} disabled={sessionStatus === "published"} style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--primary)" }} />
                    </td>
                    <td style={TD2}>
                      <input type="checkbox" checked={!!g?.punctual} onChange={e => setGrade(stu.id, { punctual: e.target.checked })} disabled={!g?.present || sessionStatus === "published"} style={{ width: 15, height: 15, cursor: !g?.present ? "not-allowed" : "pointer", opacity: g?.present ? 1 : 0.3, accentColor: "var(--primary)" }} />
                    </td>
                    <td style={TD2}>
                      <input type="checkbox" checked={!!g?.deliverable} onChange={e => setGrade(stu.id, { deliverable: e.target.checked })} disabled={!g?.present || sessionStatus === "published"} style={{ width: 15, height: 15, cursor: !g?.present ? "not-allowed" : "pointer", opacity: g?.present ? 1 : 0.3, accentColor: "var(--primary)" }} />
                    </td>
                <td style={TD2}><input type="number" min={0} max={20000} value={g?.kahootPts ?? ""} placeholder="0" onChange={e => setGrade(stu.id, { kahootPts: +e.target.value })} disabled={!g?.present || sessionStatus === "published"} style={{ ...NUM_INPUT, opacity: g?.present ? 1 : 0.35 }} /></td>
                    <td style={TD2}><input type="number" min={0} max={10} value={g?.participation ?? ""} placeholder="0" onChange={e => setGrade(stu.id, { participation: +e.target.value })} disabled={!g?.present || sessionStatus === "published"} style={{ ...NUM_INPUT, opacity: g?.present ? 1 : 0.35 }} /></td>
                    <td style={TD2}><input type="number" min={0} max={10} value={g?.teamwork ?? ""} placeholder="0" onChange={e => setGrade(stu.id, { teamwork: +e.target.value })} disabled={!g?.present || sessionStatus === "published"} style={{ ...NUM_INPUT, opacity: g?.present ? 1 : 0.35 }} /></td>
                    <td style={TD2}><input type="number" min={0} max={10} value={g?.adab ?? ""} placeholder="0" onChange={e => setGrade(stu.id, { adab: +e.target.value })} disabled={!g?.present || sessionStatus === "published"} style={{ ...NUM_INPUT, opacity: g?.present ? 1 : 0.35 }} /></td>
                    <td style={TD2}><input type="number" min={0} value={g?.penalty ?? ""} placeholder="0" onChange={e => setGrade(stu.id, { penalty: +e.target.value })} disabled={sessionStatus === "published"} style={NUM_INPUT} /></td>
                    <td style={TD2}><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: scoreColor(score) }}>{score}</span></td>
                    <td style={TD2}><span onClick={() => cycleStatus(stu.id)}><GradeStatusBadge status={g?.status ?? "draft"} /></span></td>
                    <td style={TD2}>
                      <button onClick={() => setExpandedNotes(p => ({ ...p, [stu.id]: !p[stu.id] }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "2px 5px" }}>⋮</button>
                    </td>
                  </tr>
                  {notesOpen && (
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={13} style={{ padding: "6px 12px 10px 48px" }}>
                        <textarea rows={2} placeholder={`Notes for ${stu.name}…`} value={g?.notes ?? ""} onChange={e => setGrade(stu.id, { notes: e.target.value })} disabled={sessionStatus === "published"}
                          style={{ width: "100%", maxWidth: 560, fontSize: 12, padding: "6px 10px", background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 6, resize: "vertical", fontFamily: "inherit" }} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 24, padding: "10px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--muted-foreground)", flexWrap: "wrap" }}>
        <span><strong style={{ color: "var(--foreground)" }}>{gradedCount}</strong> graded</span>
        <span><strong style={{ color: "var(--foreground)" }}>{presentCount}</strong> present</span>
        <span>Avg score: <strong style={{ color: "var(--foreground)", fontFamily: "monospace" }}>{avgScore}</strong> pts</span>
        <span style={{ color: "var(--muted-foreground)" }}>Max: <strong style={{ fontFamily: "monospace" }}>250</strong> pts</span>
      </div>
    </div>
  );
};

const SessionWorkspaceScreen = (props: ScreenProps) => {
  const { activeCohort, cohorts, students, sessions, selectedSessionId, setSelectedSessionId, setScreen, onTVMode } = props;
  const tab = props.workspaceTab;
  const setTab = props.setWorkspaceTab;
  const [questions, setQuestions] = useState<ApiSessionQuestion[]>([]);
  const [kahootRuns, setKahootRuns] = useState<ApiKahootRun[]>([]);
  const [questionRunId, setQuestionRunId] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [questionsStatus, setQuestionsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [questionError, setQuestionError] = useState("");
  const [questionForm, setQuestionForm] = useState({
    prompt: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A" as "A" | "B" | "C" | "D",
    timeLimit: 20,
    points: 1000,
  });

  const cohort = cohorts.find(c => c.id === activeCohort);
  const cohortSessions = [...sessions].sort((a, b) => a.num - b.num);
  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? sessions[0];
  const sessionLabel = selectedSession ? `Session ${selectedSession.num} — ${selectedSession.title}` : "No session selected";
  const pendingReview = selectedSession?.status === "review" || selectedSession?.kahootStatus === "results-imported";
  const visibleQuestionCount = questionsStatus === "ready" ? questions.length : selectedSession?.questionCount ?? 0;

  useEffect(() => {
    if (!selectedSession) return;

    const numericSessionId = Number(selectedSession.id);
    if (!Number.isFinite(numericSessionId)) {
      setQuestions([]);
      setQuestionsStatus("ready");
      return;
    }

    let cancelled = false;
    setQuestionsStatus("loading");
    setQuestionError("");

    Promise.all([
      fetchSessionQuestions(numericSessionId),
      fetchKahootRuns(numericSessionId),
    ])
      .then(([nextQuestions, nextRuns]) => {
        if (cancelled) return;
        setQuestions(nextQuestions);
        setKahootRuns(nextRuns);
        setQuestionRunId(prev => nextRuns.some(run => String(run.id) === prev) ? prev : "");
        setQuestionsStatus("ready");
      })
      .catch(error => {
        if (cancelled) return;
        console.warn("Could not load session questions.", error);
        setQuestions([]);
        setKahootRuns([]);
        setQuestionsStatus("error");
        setQuestionError("Could not load saved questions for this session.");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSession?.id]);

  const updateQuestionField = <Field extends keyof typeof questionForm>(field: Field, value: (typeof questionForm)[Field]) => {
    setQuestionForm(prev => ({ ...prev, [field]: value }));
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionForm({
      prompt: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctOption: "A",
      timeLimit: 20,
      points: 1000,
    });
  };

  const editQuestion = (question: ApiSessionQuestion) => {
    setEditingQuestionId(question.id);
    setQuestionRunId(question.kahoot_run_id ? String(question.kahoot_run_id) : "");
    setQuestionForm({
      prompt: question.prompt,
      optionA: question.options[0] ?? "",
      optionB: question.options[1] ?? "",
      optionC: question.options[2] ?? "",
      optionD: question.options[3] ?? "",
      correctOption: question.correct_option,
      timeLimit: question.time_limit_seconds,
      points: question.points,
    });
  };

  const submitQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSession) return;

    const numericSessionId = Number(selectedSession.id);
    if (!Number.isFinite(numericSessionId)) {
      setQuestionError("Questions can only be saved after this session exists in the backend.");
      return;
    }

    const options = [questionForm.optionA, questionForm.optionB, questionForm.optionC, questionForm.optionD]
      .map(option => option.trim())
      .filter(Boolean);

    setQuestionError("");

    try {
      const payload = {
        prompt: questionForm.prompt.trim(),
        options,
        correct_option: questionForm.correctOption,
        time_limit_seconds: questionForm.timeLimit,
        points: questionForm.points,
        kahoot_run_id: questionRunId ? Number(questionRunId) : null,
      };

      if (editingQuestionId) {
        const updatedQuestion = await updateSessionQuestion(editingQuestionId, payload);
        setQuestions(prev => prev.map(question => question.id === updatedQuestion.id ? updatedQuestion : question));
      } else {
        const createdQuestion = await createSessionQuestion(numericSessionId, payload);
        setQuestions(prev => [...prev, createdQuestion]);
      }

      setQuestionsStatus("ready");
      resetQuestionForm();
    } catch (error) {
      console.warn("Could not save question.", error);
      setQuestionError("Could not save this question. Check the prompt, options, and correct answer.");
    }
  };

  const removeQuestion = async (question: ApiSessionQuestion) => {
    const confirmed = window.confirm(`Delete question ${question.position}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteSessionQuestion(question.id);
      setQuestions(prev => prev.filter(item => item.id !== question.id).map((item, index) => ({ ...item, position: index + 1 })));
      if (editingQuestionId === question.id) resetQuestionForm();
    } catch (error) {
      console.warn("Could not delete question.", error);
      setQuestionError("Could not delete this question.");
    }
  };
  const availableCorrectOptions = ["A", "B", questionForm.optionC.trim() ? "C" : "", questionForm.optionD.trim() ? "D" : ""].filter(Boolean) as Array<"A" | "B" | "C" | "D">;

  const tabButton = (id: SessionWorkspaceTab, label: string): React.CSSProperties => ({
    padding: "8px 14px",
    border: "1px solid var(--border)",
    borderRadius: 999,
    background: tab === id ? "var(--primary)" : "var(--card)",
    color: tab === id ? "var(--primary-foreground)" : "var(--foreground)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  });

  const actionCard = (
    title: string,
    description: string,
    icon: React.ReactNode,
    action: React.ReactNode,
    accent = "#C8960C",
  ) => (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accent}1F`, color: accent, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <h3 style={{ margin: "0 0 4px", fontFamily: "Lora, serif", fontSize: 15, color: "var(--foreground)" }}>{title}</h3>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--muted-foreground)" }}>{description}</p>
        </div>
      </div>
      {action}
    </div>
  );

  if (!selectedSession) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PageHeader title="Session Workspace" description={`${cohort?.name ?? "Selected cohort"} has no sessions yet.`} />
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
          <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 13 }}>Create a session first. Once it exists, this workspace becomes the presenter control room for questions, live Kahoot, scoring, results, and TV display.</p>
          <button onClick={() => setScreen("sessions")} style={{ marginTop: 14, padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, cursor: "pointer" }}>
            Go to Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Session Workspace"
        description={`${cohort?.name ?? "Selected cohort"} · live presenter controls for ${sessionLabel}`}
        action={<button onClick={onTVMode} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}><Tv size={14} /> TV Display</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) auto", gap: 12, alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
            style={{ minWidth: 280, background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 12px", fontSize: 13 }}>
            {cohortSessions.map(s => <option key={s.id} value={s.id}>Session {s.num} — {s.title}</option>)}
          </select>
          <SessionStatusBadge status={selectedSession.status} />
          <KahootStatusBadge status={selectedSession.kahootStatus} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button style={tabButton("overview", "Overview")} onClick={() => setTab("overview")}>Overview</button>
          <button style={tabButton("questions", "Questions")} onClick={() => setTab("questions")}>Questions</button>
          <button style={tabButton("score", "Score")} onClick={() => setTab("score")}>Score</button>
          <button style={tabButton("results", "Results")} onClick={() => setTab("results")}>Results</button>
        </div>
      </div>

      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <StatCard label="Students" value={students.length} sub="in selected cohort" accent="#C8960C" />
            <StatCard label="Session Date" value={fmtDate(selectedSession.date)} sub={selectedSession.presenter} accent="#2A7A5A" />
            <StatCard label="Questions" value={visibleQuestionCount} sub={KAHOOT_STATUS_CFG[selectedSession.kahootStatus].label} accent="#6366f1" />
            <StatCard label="Score Review" value={pendingReview ? "Needs Review" : "Ready"} sub="before publishing scores" accent={pendingReview ? "#F59E0B" : "#2A7A5A"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            {actionCard(
              "Prepare engagement questions",
              "Use this while the presenter is moving through the lesson. Questions stay tied to this session and can be exported for the Kahoot handoff.",
              <Zap size={17} />,
              <button onClick={() => setTab("questions")} style={{ padding: "8px 12px", border: "none", borderRadius: 8, background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, cursor: "pointer" }}>Open Questions</button>,
              "#C8960C",
            )}
            {actionCard(
              "Run the live quiz",
              "Open Kahoot from this session, host the quiz manually, show the join PIN, then return here when the quiz is complete.",
              <ExternalLink size={17} />,
              <button onClick={() => setScreen("kahoot")} style={{ padding: "8px 12px", border: "none", borderRadius: 8, background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, cursor: "pointer" }}>Open Kahoot Tools</button>,
              "#6366f1",
            )}
            {actionCard(
              "Score attendance and conduct",
              "Record attendance, punctuality, deliverables, participation, teamwork, conduct, and penalties without leaving the session context.",
              <ClipboardList size={17} />,
              <button onClick={() => setTab("score")} style={{ padding: "8px 12px", border: "none", borderRadius: 8, background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, cursor: "pointer" }}>Open Score Sheet</button>,
              "#2A7A5A",
            )}
            {actionCard(
              "Retrieve and review results",
              "After Kahoot ends, retrieve or import the results, match them to saved Kahoot IDs, review exceptions, then apply quiz points.",
              <RefreshCw size={17} />,
              <button onClick={() => setTab("results")} style={{ padding: "8px 12px", border: "none", borderRadius: 8, background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, cursor: "pointer" }}>Review Results</button>,
              "#10B981",
            )}
          </div>
        </>
      )}

      {tab === "questions" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 18 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 6px", fontFamily: "Lora, serif", color: "var(--foreground)" }}>Session Questions</h3>
                <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
                  Add short engagement questions as the presenter moves through the workshop. These are saved to the selected session and exported from Kahoot Tools when ready.
                </p>
              </div>
              <button onClick={() => setScreen("kahoot")} style={{ padding: "9px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "transparent", color: "var(--foreground)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}><Zap size={14} /> Kahoot Tools</button>
            </div>

            {questionsStatus === "loading" && (
              <div style={{ padding: 14, borderRadius: 8, background: "var(--secondary)", color: "var(--muted-foreground)", fontSize: 13 }}>Loading saved questions...</div>
            )}

            {questionsStatus === "error" && (
              <div style={{ padding: 14, borderRadius: 8, background: "#FEF3C7", color: "#78350F", fontSize: 13 }}>{questionError}</div>
            )}

            {questionsStatus !== "loading" && questions.length === 0 && (
              <div style={{ padding: 18, borderRadius: 8, background: "var(--secondary)", border: "1px dashed var(--border)", color: "var(--muted-foreground)", fontSize: 13 }}>
                No questions saved yet for this session. Add the first one from the form on the right.
              </div>
            )}

            {questions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {questions.map(question => (
                  <div key={question.id} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: 13, background: "var(--background)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: "0 0 8px", color: "var(--foreground)", fontWeight: 700, fontSize: 13 }}>
                          {question.position}. {question.prompt}
                        </p>
                        {question.kahoot_run_id && (
                          <div style={{ marginBottom: 8, display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "#E0F2FE", color: "#075985", border: "1px solid #07598533", fontSize: 11, fontWeight: 700 }}>
                            {kahootRuns.find(run => run.id === question.kahoot_run_id)?.title ?? "Kahoot section"}
                          </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                          {question.options.map((option, index) => {
                            const label = ["A", "B", "C", "D"][index];
                            const correct = label === question.correct_option;
                            return (
                              <div key={`${question.id}-${label}`} style={{ padding: "6px 8px", borderRadius: 6, background: correct ? "#14532D22" : "var(--secondary)", color: correct ? "#14532D" : "var(--muted-foreground)", fontSize: 12, fontWeight: correct ? 700 : 500 }}>
                                {label}. {option}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 11, color: "var(--muted-foreground)", flexShrink: 0 }}>
                        <div>{question.time_limit_seconds}s</div>
                        <div>{question.points} pts</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button type="button" onClick={() => editQuestion(question)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                            Edit
                          </button>
                          <button type="button" onClick={() => removeQuestion(question)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #991B1B55", background: "#FEE2E2", color: "#7F1D1D", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={submitQuestion} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <h3 style={{ margin: 0, fontFamily: "Lora, serif", color: "var(--foreground)", fontSize: 16 }}>{editingQuestionId ? "Edit Question" : "Add Question"}</h3>
              {editingQuestionId && (
                <button type="button" onClick={resetQuestionForm} style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", borderRadius: 7, padding: "5px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                  Cancel Edit
                </button>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Kahoot section</label>
              <select value={questionRunId} onChange={event => setQuestionRunId(event.target.value)} style={{ marginTop: 5, width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }}>
                <option value="">Session-level question</option>
                {kahootRuns.map(run => <option key={run.id} value={run.id}>{run.title}</option>)}
              </select>
              <p style={{ margin: "5px 0 0", color: "var(--muted-foreground)", fontSize: 11, lineHeight: 1.4 }}>
                Create Kahoot sections from the Kahoot page when a session needs multiple short quizzes.
              </p>
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Prompt</label>
            <textarea rows={3} value={questionForm.prompt} onChange={event => updateQuestionField("prompt", event.target.value)} placeholder="Type the question the presenter wants to ask..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--background)", color: "var(--foreground)", resize: "vertical", fontFamily: "inherit" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {([
                ["optionA", "A", "Required"],
                ["optionB", "B", "Required"],
                ["optionC", "C", "Optional"],
                ["optionD", "D", "Optional"],
              ] as const).map(([field, label, placeholder]) => (
                <div key={field}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>{label}</label>
                  <input value={questionForm[field]} onChange={event => updateQuestionField(field, event.target.value)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>Correct</label>
                <select value={questionForm.correctOption} onChange={event => updateQuestionField("correctOption", event.target.value as "A" | "B" | "C" | "D")} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }}>
                  {availableCorrectOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>Seconds</label>
                <input type="number" min={5} max={240} value={questionForm.timeLimit} onChange={event => updateQuestionField("timeLimit", Number(event.target.value))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>Points</label>
                <input type="number" min={0} max={2000} value={questionForm.points} onChange={event => updateQuestionField("points", Number(event.target.value))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
              </div>
            </div>

            {questionError && <div style={{ padding: "9px 10px", borderRadius: 7, background: "#FEE2E2", color: "#7F1D1D", fontSize: 12 }}>{questionError}</div>}

            <button type="submit" style={{ padding: "10px 14px", border: "none", borderRadius: 8, background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Plus size={14} /> {editingQuestionId ? "Save Changes" : "Save Question"}
            </button>
          </form>
        </div>
      )}

      {tab === "score" && <ScoringScreen {...props} />}

      {tab === "results" && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
          <h3 style={{ margin: "0 0 6px", fontFamily: "Lora, serif", color: "var(--foreground)" }}>Results Review</h3>
          <p style={{ margin: "0 0 16px", color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
            The intended production flow is results-first: fetch or import Kahoot report data for this session, match rows by saved Kahoot ID, flag unmatched names, and only then apply scores to the leaderboard.
          </p>
          <button onClick={() => setScreen("kahoot")} style={{ padding: "9px 14px", border: "none", borderRadius: 8, background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}><RefreshCw size={14} /> Open Kahoot Results</button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// KAHOOT
// ============================================================

const KahootScreen = ({ sessions, students, selectedSessionId, setSelectedSessionId, setWorkspaceTab, setScreen, refreshData }: ScreenProps) => {
  const [tab, setTab]         = useState<"questions" | "setup" | "live" | "results">("questions");
  const [gameState, setGameState]       = useState<"idle" | "live" | "ended">("idle");
  const [gamePin, setGamePin]           = useState("");
  const [manualAssign, setManualAssign] = useState<Record<string, string>>({});
  const [sessionQuestions, setSessionQuestions] = useState<ApiSessionQuestion[]>([]);
  const [kahootRuns, setKahootRuns] = useState<ApiKahootRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [kahootResults, setKahootResults] = useState<ApiKahootResult[]>([]);
  const [newRunTitle, setNewRunTitle] = useState("");
  const [newRunLabel, setNewRunLabel] = useState("");
  const [linkForm, setLinkForm] = useState({ kahootUrl: "", reportUrl: "" });
  const [importText, setImportText] = useState("");
  const [kahootMessage, setKahootMessage] = useState("");
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState("");
  const [collapsedRunIds, setCollapsedRunIds] = useState<Set<string>>(new Set());
  const [draggedRunId, setDraggedRunId] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState({
    prompt: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A" as "A" | "B" | "C" | "D",
    timeLimit: 20,
    points: 1000,
  });

  const cohortSessions  = [...sessions].sort((a, b) => a.num - b.num);
  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? sessions[0];
  const orderedRuns = [...kahootRuns].sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.id - b.id);
  const selectedRun = orderedRuns.find(run => String(run.id) === selectedRunId) ?? orderedRuns[0];
  const selectedRunQuestions = selectedRun
    ? sessionQuestions.filter(question => question.kahoot_run_id === selectedRun.id)
    : sessionQuestions.filter(question => !question.kahoot_run_id);
  const hasAnyExportableQuestions = orderedRuns.some(run =>
    sessionQuestions.some(question => question.kahoot_run_id === run.id)
  );
  const curStatus       = selectedSession?.kahootStatus ?? "questions-ready";

  const STEPS: { key: KahootStatus; label: string }[] = [
    { key: "questions-ready",   label: "Questions" },
    { key: "exported",          label: "Export"  },
    { key: "hosted",            label: "Host in Kahoot"  },
    { key: "results-imported",  label: "Import Results"    },
    { key: "reviewed",          label: "Apply Scores"  },
  ];
  const curStepIdx  = STEPS.findIndex(s => s.key === curStatus);
  const importedResults = kahootResults.map(result => ({
    id: result.id,
    nickname: result.nickname,
    identifier: result.identifier ?? "",
    studentId: result.student_id ? String(result.student_id) : null,
    correct: result.correct_count,
    total: result.total_questions,
    kahootPts: result.kahoot_points,
    appPts: result.awarded_points,
    matchStatus: result.match_status,
    applied: result.applied,
  }));
  const hasResults  = importedResults.length > 0;
  const unmatched   = importedResults.filter(r => r.matchStatus !== "matched");
  const availableCorrectOptions = ["A", "B", questionForm.optionC.trim() ? "C" : "", questionForm.optionD.trim() ? "D" : ""].filter(Boolean) as Array<"A" | "B" | "C" | "D">;

  const updateQuestionField = <Field extends keyof typeof questionForm>(field: Field, value: (typeof questionForm)[Field]) => {
    setQuestionForm(prev => ({ ...prev, [field]: value }));
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionForm({
      prompt: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctOption: "A",
      timeLimit: 20,
      points: 1000,
    });
  };

  const editQuestion = (question: ApiSessionQuestion) => {
    setEditingQuestionId(question.id);
    setSelectedRunId(question.kahoot_run_id ? String(question.kahoot_run_id) : "");
    setQuestionForm({
      prompt: question.prompt,
      optionA: question.options[0] ?? "",
      optionB: question.options[1] ?? "",
      optionC: question.options[2] ?? "",
      optionD: question.options[3] ?? "",
      correctOption: question.correct_option,
      timeLimit: question.time_limit_seconds,
      points: question.points,
    });
  };

  const saveQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSession) return;

    const sessionId = Number(selectedSession.id);
    if (!Number.isFinite(sessionId)) {
      setKahootMessage("Create the session before saving questions.");
      return;
    }

    const options = [questionForm.optionA, questionForm.optionB, questionForm.optionC, questionForm.optionD]
      .map(option => option.trim())
      .filter(Boolean);
    const kahootRunId = selectedRun ? selectedRun.id : null;
    const payload = {
      prompt: questionForm.prompt.trim(),
      options,
      correct_option: questionForm.correctOption,
      time_limit_seconds: questionForm.timeLimit,
      points: questionForm.points,
      kahoot_run_id: kahootRunId,
    };

    try {
      if (editingQuestionId) {
        const updatedQuestion = await updateSessionQuestion(editingQuestionId, payload);
        setSessionQuestions(prev => prev.map(question => question.id === updatedQuestion.id ? updatedQuestion : question));
        setKahootMessage("Question updated.");
      } else {
        const createdQuestion = await createSessionQuestion(sessionId, payload);
        setSessionQuestions(prev => [...prev, createdQuestion]);
        setKahootMessage(selectedRun ? `Question added to ${selectedRun.title}.` : "Session-level question added.");
      }
      resetQuestionForm();
      await refreshData();
    } catch (error) {
      console.warn("Could not save Kahoot question.", error);
      setKahootMessage("Could not save this question. Check the prompt, answers, and correct option.");
    }
  };

  const removeQuestion = async (question: ApiSessionQuestion) => {
    const confirmed = window.confirm(`Delete question ${question.position}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteSessionQuestion(question.id);
      setSessionQuestions(prev => prev.filter(item => item.id !== question.id).map((item, index) => ({ ...item, position: index + 1 })));
      if (editingQuestionId === question.id) resetQuestionForm();
      setKahootMessage("Question deleted.");
      await refreshData();
    } catch (error) {
      console.warn("Could not delete Kahoot question.", error);
      setKahootMessage("Could not delete this question.");
    }
  };

  useEffect(() => {
    if (!selectedSession) {
      setSessionQuestions([]);
      return;
    }

    const sessionId = Number(selectedSession.id);
    if (!Number.isFinite(sessionId)) {
      setSessionQuestions([]);
      return;
    }

    let cancelled = false;
    setQuestionsLoading(true);
    setQuestionsError("");

    Promise.all([
      fetchSessionQuestions(sessionId),
      fetchKahootRuns(sessionId),
    ])
      .then(async ([questions, runs]) => {
        if (cancelled) return;
        setSessionQuestions(questions);
        setKahootRuns(runs);
        const nextRun = runs.find(run => String(run.id) === selectedRunId) ?? runs[0];
        setSelectedRunId(nextRun ? String(nextRun.id) : "");
        setLinkForm({ kahootUrl: nextRun?.kahoot_url ?? "", reportUrl: nextRun?.report_url ?? "" });
        setKahootResults(nextRun ? await fetchKahootResults(nextRun.id) : []);
      })
      .catch(error => {
        if (cancelled) return;
        console.warn("Could not load Kahoot session questions.", error);
        setSessionQuestions([]);
        setKahootRuns([]);
        setKahootResults([]);
        setQuestionsError("Could not load saved questions for this session.");
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSession?.id, selectedRunId]);

  useEffect(() => {
    if (!selectedRun) return;
    setLinkForm({ kahootUrl: selectedRun.kahoot_url ?? "", reportUrl: selectedRun.report_url ?? "" });
    fetchKahootResults(selectedRun.id)
      .then(setKahootResults)
      .catch(error => {
        console.warn("Could not load Kahoot results.", error);
        setKahootResults([]);
      });
  }, [selectedRun?.id]);

  const createRun = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSession || !newRunTitle.trim()) return;

    try {
      const run = await createKahootRun(Number(selectedSession.id), {
        title: newRunTitle.trim(),
        section_label: newRunLabel.trim(),
      });
      setKahootRuns(prev => [...prev, run].sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.id - b.id));
      setSelectedRunId(String(run.id));
      setNewRunTitle("");
      setNewRunLabel("");
      setKahootMessage("Section created. Add questions on this page, then export it to Kahoot.");
    } catch (error) {
      console.warn("Could not create Kahoot section.", error);
      setKahootMessage("Could not create the Kahoot section.");
    }
  };

  const saveRunLinks = async (status?: ApiKahootRun["status"]) => {
    if (!selectedRun) return;

    try {
      const run = await updateKahootRun(selectedRun.id, {
        kahoot_url: linkForm.kahootUrl,
        report_url: linkForm.reportUrl,
        status,
      });
      setKahootRuns(prev => prev.map(item => item.id === run.id ? run : item));
      setKahootMessage(status ? `Kahoot section marked ${status}.` : "Kahoot links saved.");
      await refreshData();
    } catch (error) {
      console.warn("Could not save Kahoot section.", error);
      setKahootMessage("Could not save the Kahoot section.");
    }
  };

  const renameRun = async (run: ApiKahootRun) => {
    const nextTitle = window.prompt("Section name", run.title)?.trim();
    if (!nextTitle || nextTitle === run.title) return;

    try {
      const updated = await updateKahootRun(run.id, { title: nextTitle });
      setKahootRuns(prev => prev.map(item => item.id === updated.id ? updated : item));
      setKahootMessage("Section renamed.");
    } catch (error) {
      console.warn("Could not rename section.", error);
      setKahootMessage("Could not rename that section.");
    }
  };

  const removeRun = async (run: ApiKahootRun) => {
    const confirmed = window.confirm(`Delete "${run.title}" and its draft questions? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteKahootRun(run.id);
      setKahootRuns(prev => prev.filter(item => item.id !== run.id).map((item, index) => ({ ...item, position: index + 1 })));
      setSessionQuestions(prev => prev.filter(question => question.kahoot_run_id !== run.id));
      if (String(run.id) === selectedRunId) setSelectedRunId("");
      setKahootMessage("Section deleted.");
      await refreshData();
    } catch (error) {
      console.warn("Could not delete section.", error);
      setKahootMessage("Could not delete that section. Sections with applied results are protected.");
    }
  };

  const toggleRunCollapsed = (runId: number) => {
    setCollapsedRunIds(prev => {
      const next = new Set(prev);
      const key = String(runId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const reorderRuns = async (sourceId: string, targetId: string) => {
    if (!selectedSession || !sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = orderedRuns.findIndex(run => String(run.id) === sourceId);
    const targetIndex = orderedRuns.findIndex(run => String(run.id) === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextRuns = [...orderedRuns];
    const [movedRun] = nextRuns.splice(sourceIndex, 1);
    nextRuns.splice(targetIndex, 0, movedRun);
    const positionedRuns = nextRuns.map((run, index) => ({ ...run, position: index + 1 }));
    setKahootRuns(positionedRuns);

    try {
      const updatedRuns = await reorderKahootRuns(Number(selectedSession.id), positionedRuns.map(run => run.id));
      setKahootRuns(updatedRuns);
    } catch (error) {
      console.warn("Could not reorder sections.", error);
      setKahootMessage("Could not save the new section order.");
    }
  };

  const downloadUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const markRunsExported = (runIds: number[]) => {
    const now = new Date().toISOString();
    setKahootRuns(prev => prev.map(run =>
      runIds.includes(run.id)
        ? { ...run, status: "exported", exported_at: run.exported_at ?? now }
        : run
    ));
  };

  const exportRunQuestions = (run: ApiKahootRun) => {
    const questionCount = sessionQuestions.filter(question => question.kahoot_run_id === run.id).length;
    if (!questionCount) {
      setKahootMessage("Add at least one question before exporting this section.");
      return;
    }

    downloadUrl(kahootRunExportUrl(run.id));
    markRunsExported([run.id]);
    setKahootMessage(`${run.title} exported as a Kahoot spreadsheet.`);
  };

  const exportAllRunQuestions = () => {
    if (!selectedSession) return;

    const runIds = orderedRuns
      .filter(run => sessionQuestions.some(question => question.kahoot_run_id === run.id))
      .map(run => run.id);
    if (!runIds.length) {
      setKahootMessage("Add questions to at least one section before exporting.");
      return;
    }

    downloadUrl(sessionKahootExportUrl(Number(selectedSession.id)));
    markRunsExported(runIds);
    setKahootMessage(`${runIds.length} section${runIds.length === 1 ? "" : "s"} exported as Kahoot spreadsheets.`);
  };

  const importResults = async () => {
    if (!selectedRun) return;
    const parsedRows = parseKahootResultText(importText);
    if (!parsedRows.length) {
      setKahootMessage("Paste at least one result row before importing.");
      return;
    }

    try {
      const response = await importKahootResults(selectedRun.id, parsedRows);
      setKahootResults(response.results);
      setKahootRuns(prev => prev.map(item => item.id === response.kahoot_run.id ? response.kahoot_run : item));
      setImportText("");
      setKahootMessage(`${response.results.length} result rows imported.`);
      await refreshData();
    } catch (error) {
      console.warn("Could not import Kahoot results.", error);
      setKahootMessage("Could not import those results. Check the row format.");
    }
  };

  const uploadResultsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRun) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const response = await uploadKahootResults(selectedRun.id, file);
      setKahootResults(response.results);
      setKahootRuns(prev => prev.map(item => item.id === response.kahoot_run.id ? response.kahoot_run : item));
      setKahootMessage(`${response.results.length} result rows imported from ${file.name}.`);
      await refreshData();
    } catch (error) {
      console.warn("Could not upload Kahoot results.", error);
      setKahootMessage("Could not import that file. Use a Kahoot .csv or .xlsx result export.");
    }
  };

  const saveResultMatch = async (resultId: number, studentId: string) => {
    try {
      const updated = await updateKahootResult(resultId, { student_id: studentId ? Number(studentId) : null });
      setKahootResults(prev => prev.map(item => item.id === updated.id ? updated : item));
      setManualAssign(prev => {
        const next = { ...prev };
        delete next[String(resultId)];
        return next;
      });
    } catch (error) {
      console.warn("Could not update Kahoot match.", error);
      setKahootMessage("Could not update that match.");
    }
  };

  const applyImportedResults = async () => {
    if (!selectedRun) return;
    if (unmatched.length > 0) {
      setKahootMessage("Resolve unmatched rows before applying scores.");
      return;
    }

    try {
      const response = await applyKahootResults(selectedRun.id);
      setKahootResults(response.results);
      setKahootRuns(prev => prev.map(item => item.id === response.kahoot_run.id ? response.kahoot_run : item));
      setKahootMessage(`${response.applied_count} result rows applied to the score sheet.`);
      await refreshData();
    } catch (error) {
      console.warn("Could not apply Kahoot results.", error);
      setKahootMessage("Could not apply results to the score sheet.");
    }
  };

  const T = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", fontSize: 13, fontWeight: active ? 600 : 400, background: "transparent",
    border: "none", borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
    color: active ? "var(--primary)" : "var(--muted-foreground)", cursor: "pointer", marginBottom: -1,
  });

  const BtnPrimary: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8,
    border: "none", background: "var(--primary)", color: "var(--primary-foreground)",
    fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%",
  };
  const BtnSecondary: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 7,
    border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)",
    fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%",
  };
  const BtnDisabled: React.CSSProperties = { ...BtnPrimary, background: "var(--muted)", color: "var(--muted-foreground)", cursor: "not-allowed", opacity: 0.65 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        title="Kahoot"
        description="Export this session's questions for Kahoot, host manually, then bring results back into this session"
        action={
          <button onClick={() => { setWorkspaceTab("overview"); setScreen("scoring"); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
            <ArrowLeft size={14} /> Back to Session
          </button>
        }
      />

      {/* Session selector + current status */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
          style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 12px", fontSize: 13 }}>
          {cohortSessions.map(s => <option key={s.id} value={s.id}>Session {s.num} — {s.title}</option>)}
        </select>
        <select value={selectedRun?.id ? String(selectedRun.id) : ""} onChange={e => setSelectedRunId(e.target.value)}
          style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 12px", fontSize: 13 }}>
          <option value="">No Kahoot section yet</option>
          {orderedRuns.map(run => <option key={run.id} value={run.id}>{run.position}. {run.title}</option>)}
        </select>
        <KahootStatusBadge status={curStatus} />
      </div>

      {/* Workflow stepper — numbered circles */}
      {kahootMessage && (
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#FEF3C7", border: "1px solid #92400E33", color: "#78350F", fontSize: 13 }}>
          {kahootMessage}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 20px" }}>
        {STEPS.map((step, idx) => {
          const active = idx === curStepIdx;
          const done   = idx < curStepIdx;
          return (
            <React.Fragment key={step.key}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 100 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: active ? "var(--primary)" : done ? "#14532D" : "var(--muted)",
                  border: `2px solid ${active ? "var(--primary)" : done ? "#14532D" : "var(--border)"}`,
                  fontSize: 11, fontWeight: 700,
                  color: active ? "var(--primary-foreground)" : done ? "#DCFCE7" : "var(--muted-foreground)",
                  flexShrink: 0,
                }}>
                  {done ? "✓" : idx + 1}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? "var(--foreground)" : "var(--muted-foreground)", textAlign: "center", whiteSpace: "nowrap" }}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: idx < curStepIdx ? "#14532D" : "var(--border)", margin: "0 4px 16px" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Integration reality card */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#92400E", flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
              Kahoot hosting stays manual
            </span>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 10 }}>
              Export questions from here, start the quiz in Kahoot, then retrieve or import results for matching.
            </span>
          </div>
        </div>
        <button onClick={() => setTab("setup")} style={{ padding: "5px 13px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", cursor: "pointer", flexShrink: 0 }}>
          Prepare Export
        </button>
      </div>

      {/* Tabs */}
      <form onSubmit={createRun} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr) auto", gap: 10, alignItems: "end", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>New session section</label>
          <input value={newRunTitle} onChange={event => setNewRunTitle(event.target.value)} placeholder="Reflection check, demo recap, closing quiz..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Presenter note</label>
          <input value={newRunLabel} onChange={event => setNewRunLabel(event.target.value)} placeholder="Optional presenter note" style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
        </div>
        <button type="submit" disabled={!newRunTitle.trim()} style={newRunTitle.trim() ? { ...BtnPrimary, width: "auto" } : { ...BtnDisabled, width: "auto" }}>
          <Plus size={14} /> Create
        </button>
      </form>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>Session Sections</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
              These are the live workshop checkpoints. Drag to reorder, collapse what you do not need, then export one section or all sections for Kahoot.
            </p>
          </div>
          <button
            type="button"
            onClick={exportAllRunQuestions}
            disabled={!selectedSession || !hasAnyExportableQuestions}
            style={selectedSession && hasAnyExportableQuestions ? { ...BtnSecondary, width: "auto" } : { ...BtnDisabled, width: "auto" }}
          >
            <Download size={13} /> Export All Sections
          </button>
        </div>
        {orderedRuns.length === 0 ? (
          <div style={{ padding: 16, border: "1px dashed var(--border)", borderRadius: 8, color: "var(--muted-foreground)", fontSize: 13 }}>
            No sections exist yet. Create a session section above, or create a new workshop session to auto-load the workshop template sections.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 }}>
            {orderedRuns.map(run => {
              const questionCount = sessionQuestions.filter(question => question.kahoot_run_id === run.id).length;
              const isActive = selectedRun?.id === run.id;
              const isCollapsed = collapsedRunIds.has(String(run.id));
              const canExport = questionCount > 0;

              return (
                <div
                  key={run.id}
                  draggable
                  onDragStart={() => setDraggedRunId(String(run.id))}
                  onDragOver={event => event.preventDefault()}
                  onDrop={() => {
                    reorderRuns(draggedRunId, String(run.id));
                    setDraggedRunId("");
                  }}
                  onClick={() => {
                    setSelectedRunId(String(run.id));
                    resetQuestionForm();
                  }}
                  style={{
                    border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                    borderLeft: `4px solid ${isActive ? "var(--primary)" : "#C8960C"}`,
                    borderRadius: 9,
                    background: isActive ? "rgba(15,58,50,0.05)" : "var(--background)",
                    padding: 12,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "var(--primary)", minWidth: 26 }}>
                      {run.position}.
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--foreground)", lineHeight: 1.35 }}>{run.title}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>
                        {questionCount} question{questionCount === 1 ? "" : "s"} | {run.status.replace("-", " ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        toggleRunCollapsed(run.id);
                      }}
                      style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted-foreground)", borderRadius: 6, padding: 4, cursor: "pointer" }}
                      aria-label={isCollapsed ? "Expand section" : "Collapse section"}
                    >
                      <ChevronDown size={13} style={{ transform: isCollapsed ? "rotate(-90deg)" : "none" }} />
                    </button>
                  </div>

                  {!isCollapsed && (
                    <>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        {run.notes || run.section_label || "No presenter note saved."}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            renameRun(run);
                          }}
                          style={{ ...BtnSecondary, width: "100%", padding: "7px 9px", justifyContent: "center" }}
                        >
                          <Edit3 size={12} /> Rename
                        </button>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            if (canExport) exportRunQuestions(run);
                          }}
                          disabled={!canExport}
                          style={canExport ? { ...BtnSecondary, width: "100%", padding: "7px 9px", justifyContent: "center" } : { ...BtnDisabled, width: "100%", padding: "7px 9px", justifyContent: "center" }}
                        >
                          <Download size={12} /> Export
                        </button>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            if (run.kahoot_url) downloadUrl(run.kahoot_url);
                            else setTab("setup");
                          }}
                          style={{ ...BtnSecondary, width: "100%", padding: "7px 9px", justifyContent: "center" }}
                        >
                          <ExternalLink size={12} /> {run.kahoot_url ? "Open" : "Add Link"}
                        </button>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            removeRun(run);
                          }}
                          style={{ border: "1px solid #991B1B55", background: "#FEE2E2", color: "#7F1D1D", borderRadius: 7, padding: "7px 9px", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        <button style={T(tab === "questions")} onClick={() => setTab("questions")}>Questions</button>
        <button style={T(tab === "setup")}     onClick={() => setTab("setup")}>Kahoot Setup</button>
        <button style={T(tab === "live")}      onClick={() => setTab("live")}>Live Game</button>
        <button style={T(tab === "results")}   onClick={() => setTab("results")}>Results</button>
      </div>

      {/* ── QUESTIONS ── */}
      {tab === "questions" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", margin: 0 }}>
                {selectedRun ? `${selectedRunQuestions.length} questions in ${selectedRun.title}` : `${sessionQuestions.length} session questions`}
              </p>
              <button
                onClick={() => selectedRun && exportRunQuestions(selectedRun)}
                disabled={!selectedRun || !selectedRunQuestions.length}
                style={!selectedRun || !selectedRunQuestions.length ? { ...BtnDisabled, width: "auto", padding: "5px 12px" } : { ...BtnPrimary, width: "auto", padding: "5px 12px" }}
              >
                <Download size={12} /> Export Section XLSX
              </button>
            </div>
            {questionsLoading && <div style={{ padding: 14, borderRadius: 8, background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)", fontSize: 13 }}>Loading session questions...</div>}
            {questionsError && <div style={{ padding: 14, borderRadius: 8, background: "#FEF3C7", color: "#78350F", fontSize: 13 }}>{questionsError}</div>}
            {!questionsLoading && selectedRunQuestions.length === 0 && (
              <div style={{ padding: 18, borderRadius: 8, background: "var(--card)", border: "1px dashed var(--border)", color: "var(--muted-foreground)", fontSize: 13 }}>
                No questions are assigned to this section yet. Add the first question using the form on the right, then export this same section.
              </div>
            )}
            {selectedRunQuestions.map((q, i) => (
              <div key={q.id} style={{ padding: "11px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted-foreground)", width: 18, paddingTop: 1, flexShrink: 0 }}>{i + 1}.</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.45 }}>{q.prompt}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: "#14b8a622", color: "#14b8a6", fontWeight: 600 }}>{q.points} pts</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: "var(--muted)", color: "var(--muted-foreground)" }}>{q.time_limit_seconds}s</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: "var(--muted)", color: "var(--muted-foreground)" }}>Correct: {q.correct_option}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => editQuestion(q)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => removeQuestion(q)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #991B1B55", background: "#FEE2E2", color: "#7F1D1D", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar: roster + identity reminder */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, position: "sticky", top: 24 }}>
            <form onSubmit={saveQuestion} style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{editingQuestionId ? "Edit Question" : "Add Question"}</p>
                {editingQuestionId && (
                  <button type="button" onClick={resetQuestionForm} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    Cancel
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.45 }}>
                {selectedRun ? `Saved into: ${selectedRun.title}` : "Create or select a Kahoot section first."}
              </p>
              <textarea rows={3} value={questionForm.prompt} onChange={event => updateQuestionField("prompt", event.target.value)} placeholder="Question prompt..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--background)", color: "var(--foreground)", resize: "vertical", fontFamily: "inherit" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  ["optionA", "A", "Required"],
                  ["optionB", "B", "Required"],
                  ["optionC", "C", "Optional"],
                  ["optionD", "D", "Optional"],
                ] as const).map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>{label}</label>
                    <input value={questionForm[field]} onChange={event => updateQuestionField(field, event.target.value)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>Correct</label>
                  <select value={questionForm.correctOption} onChange={event => updateQuestionField("correctOption", event.target.value as "A" | "B" | "C" | "D")} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }}>
                    {availableCorrectOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>Sec</label>
                  <input type="number" min={5} max={240} value={questionForm.timeLimit} onChange={event => updateQuestionField("timeLimit", Number(event.target.value))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>Pts</label>
                  <input type="number" min={0} max={2000} value={questionForm.points} onChange={event => updateQuestionField("points", Number(event.target.value))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
                </div>
              </div>
              <button type="submit" disabled={!selectedRun || !questionForm.prompt.trim() || !questionForm.optionA.trim() || !questionForm.optionB.trim()} style={!selectedRun || !questionForm.prompt.trim() || !questionForm.optionA.trim() || !questionForm.optionB.trim() ? BtnDisabled : BtnPrimary}>
                <Plus size={14} /> {editingQuestionId ? "Save Question" : "Add To Section"}
              </button>
            </form>

            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Student Identifiers</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6, margin: "0 0 12px" }}>
              Students enter their saved <strong style={{ color: "var(--foreground)" }}>Kahoot ID</strong> as their display name. Results are matched by that identifier.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {students.filter(s => s.cohortId).slice(0, 8).map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <PixelAvatar avatarId={s.avatarId} size={20} />
                  <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--foreground)" }}>{s.name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)", flexShrink: 0 }}>{s.playerId || s.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KAHOOT SETUP ── */}
      {tab === "setup" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Primary: API sync */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", margin: 0 }}>Export Session Questions</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
                Download a Kahoot spreadsheet for the selected section, or download every section as a zip.
              </p>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => selectedRun && exportRunQuestions(selectedRun)}
                style={selectedRun && selectedRunQuestions.length ? BtnPrimary : BtnDisabled}
                disabled={!selectedRun || !selectedRunQuestions.length}
              >
                <Download size={15} /> Download Section XLSX
              </button>
              <button
                onClick={exportAllRunQuestions}
                style={selectedSession && hasAnyExportableQuestions ? BtnSecondary : BtnDisabled}
                disabled={!selectedSession || !hasAnyExportableQuestions}
              >
                <Download size={15} /> Download All Sections ZIP
              </button>
              {(!selectedRun || !selectedRunQuestions.length) && (
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                  Create a Kahoot section and assign questions to it before exporting.
                </p>
              )}
              <button onClick={() => saveRunLinks("exported")} disabled={!selectedRun} style={selectedRun ? BtnSecondary : BtnDisabled}>
                <Check size={14} /> Mark Exported
              </button>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                The export is tied to Session {selectedSession?.num ?? ""}. If you create multiple Kahoots during one workshop, each exported file still belongs to this session record.
              </p>
            </div>
          </div>

          {/* Secondary: manual fallback */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", margin: 0 }}>Kahoot Import Steps</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
                Host setup happens in Kahoot. Our app keeps the session linkage and matching IDs.
              </p>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={linkForm.kahootUrl} onChange={event => setLinkForm(prev => ({ ...prev, kahootUrl: event.target.value }))} placeholder="Kahoot quiz or host link" style={{ border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
              <input value={linkForm.reportUrl} onChange={event => setLinkForm(prev => ({ ...prev, reportUrl: event.target.value }))} placeholder="Kahoot report/results link" style={{ border: "1px solid var(--border)", borderRadius: 7, padding: "8px 9px", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }} />
              <button onClick={() => saveRunLinks()} disabled={!selectedRun} style={selectedRun ? BtnPrimary : BtnDisabled}>
                <Save size={13} /> Save Kahoot Links
              </button>
              <button onClick={() => window.open("https://create.kahoot.it/creator", "_blank", "noopener,noreferrer")} style={BtnSecondary}>
                <ExternalLink size={13} /> Open Kahoot Creator
              </button>
              <div style={{ padding: "10px 12px", background: "var(--secondary)", borderRadius: 7, fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.65 }}>
                In Kahoot: create the quiz manually, import the exported question file if your Kahoot plan supports it, save the quiz or report link with this session, then run it live from Kahoot.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE GAME ── */}
      {tab === "live" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          {/* PIN display / entry */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", margin: 0 }}>Game PIN</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
                Start the game on kahoot.com, then enter the PIN shown on your screen.
              </p>
            </div>
            <div style={{ padding: "20px 18px" }}>
              {gameState === "idle" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={gamePin}
                      onChange={e => setGamePin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="Enter game PIN"
                      style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--background)", color: "var(--foreground)", fontSize: 16, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.12em" }}
                    />
                    <button
                      onClick={() => { if (gamePin.length >= 4) setGameState("live"); }}
                      disabled={gamePin.length < 4}
                      style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: gamePin.length >= 4 ? "var(--primary)" : "var(--muted)", color: gamePin.length >= 4 ? "var(--primary-foreground)" : "var(--muted-foreground)", fontWeight: 600, fontSize: 13, cursor: gamePin.length >= 4 ? "pointer" : "not-allowed" }}>
                      Go Live
                    </button>
                  </div>
                  <button onClick={() => window.open(selectedRun?.kahoot_url || "https://kahoot.com", "_blank", "noopener,noreferrer")} style={BtnSecondary}>
                    <ExternalLink size={13} /> Open Kahoot Host Page
                  </button>
                  <button onClick={() => saveRunLinks("hosted")} disabled={!selectedRun} style={selectedRun ? BtnSecondary : BtnDisabled}>
                    <Check size={13} /> Mark Hosted
                  </button>
                </div>
              )}

              {gameState === "live" && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 4px" }}>Game PIN</p>
                  <div style={{ fontFamily: "monospace", fontSize: "3.5rem", fontWeight: 900, color: "var(--primary)", letterSpacing: "0.12em", lineHeight: 1.1 }}>{gamePin}</div>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "8px 0 14px" }}>kahoot.it</p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={() => setGameState("ended")}
                      style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", fontSize: 12, cursor: "pointer" }}>
                      End Game
                    </button>
                    <button style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      <RefreshCw size={12} style={{ display: "inline", marginRight: 5 }} />Refresh
                    </button>
                  </div>
                </div>
              )}

              {gameState === "ended" && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
                  <p style={{ fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>Game ended</p>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Go to the Results tab to bring scores back into this session.</p>
                  <button onClick={() => { setGameState("idle"); setGamePin(""); }}
                    style={{ marginTop: 12, padding: "5px 12px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Host instructions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Student Instructions</p>
              <p style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.6, margin: "0 0 8px" }}>
                Tell students: <strong>go to kahoot.it, enter the PIN, and use their saved Kahoot ID as the display name.</strong>
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, margin: 0 }}>
                If a student does not have a Kahoot ID yet, use their generated student code for today and record that value on the Students page before importing results.
              </p>
            </div>

            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Registered Players</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {students.slice(0, 6).map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", fontWeight: 600, width: 56, flexShrink: 0 }}>{s.playerId || s.code}</span>
                    <span style={{ fontSize: 12, color: "var(--foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.playerId ? "#166534" : "#6B7280", flexShrink: 0 }} title={s.playerId ? "Player ID configured" : "No player ID"} />
                  </div>
                ))}
                {students.length > 6 && <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "4px 0 0" }}>+{students.length - 6} more</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {tab === "results" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Primary + secondary actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: 0 }}>Retrieve Kahoot Results</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>When Kahoot API access is confirmed, this same section will use the saved report link or report ID to retrieve results automatically.</p>
              <button style={BtnDisabled} disabled>
                <RefreshCw size={14} /> API Retrieval Not Configured
              </button>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>For now, upload the Kahoot result export. The matching and apply logic is already the same backend path the future API adapter should call.</p>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: 0 }}>Import Results</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>Upload Kahoot's result export, or paste rows as a fallback: identifier,nickname,correct,total,kahoot_points</p>
              <label style={selectedRun ? { ...BtnPrimary, justifyContent: "center" } : { ...BtnDisabled, justifyContent: "center" }}>
                <input type="file" accept=".csv,.xlsx" onChange={uploadResultsFile} disabled={!selectedRun} style={{ display: "none" }} />
                <FileText size={13} /> Upload Result File
              </label>
              <textarea value={importText} onChange={event => setImportText(event.target.value)} rows={5} placeholder={"AishaK,AishaK,4,5,8200\nSTU-002,FatimaN,5,5,9400"} style={{ border: "1px solid var(--border)", borderRadius: 7, padding: 10, background: "var(--background)", color: "var(--foreground)", fontFamily: "monospace", fontSize: 12, resize: "vertical" }} />
              <button onClick={importResults} disabled={!selectedRun || !importText.trim()} style={selectedRun && importText.trim() ? BtnSecondary : BtnDisabled}>
                <FileText size={13} /> Import Results
              </button>
            </div>
          </div>

          {/* Results table — shown when results exist */}
          {hasResults && (
            <>
              {/* Summary bar */}
              <div style={{ display: "flex", gap: 20, padding: "9px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--muted-foreground)", flexWrap: "wrap", alignItems: "center" }}>
                <span><strong style={{ color: "var(--foreground)" }}>Session {selectedSession?.num}</strong></span>
                <span>{importedResults.length} participants</span>
                <span>{selectedRunQuestions.length} questions</span>
                <span>{importedResults.filter(r => r.matchStatus === "matched").length} matched</span>
                {unmatched.length > 0 && <span style={{ color: "#92400E", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> {unmatched.length} unmatched</span>}
              </div>

              {/* Results table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <thead>
                    <tr style={{ background: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                      {["Player Name", "Player ID", "Matched Student", "Correct", "Quiz Points", "Score Awarded", ""].map(h => <th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {importedResults.map((r, i) => {
                      const stu       = r.studentId ? students.find(s => s.id === r.studentId) : null;
                      const isUnmatched = r.matchStatus !== "matched";
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", background: isUnmatched ? "rgba(234,179,8,0.04)" : i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)" }}>
                          <td style={{ ...TD, fontFamily: "monospace", fontWeight: 600 }}>{r.nickname}</td>
                          <td style={{ ...TD, fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)" }}>{r.identifier || "—"}</td>
                          <td style={TD}>
                            {stu
                              ? <div style={{ display: "flex", alignItems: "center", gap: 7 }}><PixelAvatar avatarId={stu.avatarId} size={20} /><span style={{ fontWeight: 500 }}>{stu.name}</span></div>
                              : <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ color: "#f59e0b", fontSize: 11 }}>Unmatched</span>
                                  <select value={manualAssign[String(r.id)] ?? ""} onChange={e => setManualAssign(p => ({ ...p, [String(r.id)]: e.target.value }))}
                                    style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 8px", fontSize: 11 }}>
                                    <option value="">Assign to student…</option>
                                    {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                  </select>
                                  {manualAssign[String(r.id)] && (
                                    <button onClick={() => saveResultMatch(r.id, manualAssign[String(r.id)])} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer" }}>
                                      Save
                                    </button>
                                  )}
                                </div>
                            }
                          </td>
                          <td style={{ ...TD, fontFamily: "monospace" }}>{r.correct}/{r.total}</td>
                          <td style={{ ...TD, fontFamily: "monospace", fontWeight: 600 }}>{r.kahootPts.toLocaleString()}</td>
                          <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, color: r.appPts > 0 ? "var(--primary)" : "var(--muted-foreground)" }}>{r.appPts > 0 ? r.appPts : "—"}</td>
                          <td style={TD}>
                            {r.matchStatus === "matched"
                              ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "#DCFCE7", color: "#14532D", fontWeight: 700 }}>✓</span>
                              : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "#FEF3C7", color: "#92400E", fontWeight: 700 }}>Review</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Apply CTA */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: "0 0 2px" }}>Apply Reviewed Scores to Leaderboard</p>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
                    Scores are added to each matched student&apos;s session grade. Resolve unmatched entries before applying.
                  </p>
                </div>
                <button onClick={applyImportedResults} disabled={unmatched.length > 0 || importedResults.length === 0} style={{ ...(unmatched.length > 0 || importedResults.length === 0 ? BtnDisabled : BtnPrimary), width: "auto", padding: "10px 20px", flexShrink: 0 }}>
                  <Check size={14} /> Apply Scores
                </button>
              </div>
            </>
          )}

          {!hasResults && (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 4px" }}>No results yet</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Host the game in Kahoot, then retrieve or import results to see them here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// REPORTS
// ============================================================

const ReportsScreen = ({ activeCohort, cohorts, students, sessions }: ScreenProps) => {
  const cohort = cohorts.find(c => c.id === activeCohort);
  const completed  = sessions.filter(s => s.status === "published" || s.status === "archived");
  const attPct     = Math.round(ATTENDANCE_TREND.reduce((a, d) => a + d.rate, 0) / (ATTENDANCE_TREND.length || 1));
  const withId  = students.filter(s => s.playerId);
  const withoutId = students.filter(s => !s.playerId);
  const kahootPct = students.length ? Math.round((withId.length / students.length) * 100) : 0;
  const avgScore   = students.length ? Math.round(students.reduce((a, s) => a + s.totalPoints, 0) / students.length) : 0;
  const maxBar     = Math.max(...ATTENDANCE_TREND.map(d => d.rate), 1);

  const topImprovers = [...students]
    .sort((a, b) => b.streak - a.streak || b.totalPoints - a.totalPoints)
    .slice(0, 4);

  const needsFollowup = students.filter(s => (s.attendance / Math.max(s.totalSessions, 1)) < 0.8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader title="Reports" description={`${cohort?.name ?? activeCohort} · ${cohort?.term ?? ""}`} />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard label="Avg Attendance"       value={`${attPct}%`}          accent="#14b8a6" />
        <StatCard label="Sessions Completed"   value={completed.length}       accent="#6366f1" />
        <StatCard label="Avg Total Score"      value={`${avgScore.toLocaleString()} pts`} accent="#C8960C" />
        <StatCard label="Quiz Coverage"         value={`${kahootPct}%`}       sub="students with player ID set" accent="#a855f7" />
      </div>

      {/* Attendance trend */}
      <div style={{ padding: "18px 22px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
        <h3 style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 16px" }}>Attendance Trend — Last 6 Sessions</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 110 }}>
          {ATTENDANCE_TREND.map(d => {
            const barH = Math.round((d.rate / maxBar) * 80);
            const color = d.rate >= 90 ? "#10b981" : d.rate >= 75 ? "#14b8a6" : "#f59e0b";
            return (
              <div key={d.session} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "monospace" }}>{d.rate}%</span>
                <div style={{ width: "100%", maxWidth: 40, height: barH, borderRadius: "3px 3px 0 0", background: color, minHeight: 4 }} />
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", textAlign: "center" }}>{d.session}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category breakdown */}
      <div style={{ padding: "18px 22px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
        <h3 style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 16px" }}>Average Score by Category</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CATEGORY_AVGS.map(cat => (
            <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 120, fontSize: 12, color: "var(--foreground)", fontWeight: 500, flexShrink: 0 }}>{cat.category}</span>
              <div style={{ flex: 1, height: 13, background: "var(--muted)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${cat.pct}%`, height: "100%", background: cat.color, borderRadius: 6, transition: "width 0.5s" }} />
              </div>
              <span style={{ width: 40, fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: cat.color, textAlign: "right", flexShrink: 0 }}>{cat.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top improvers + follow-up side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ padding: "18px 22px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
          <h3 style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 14px" }}>Current Standouts</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{["#", "Student", "Attendance", "Points"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {topImprovers.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, color: "var(--muted-foreground)" }}>#{i + 1}</td>
                  <td style={TD}><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{s.code}</div></td>
                  <td style={{ ...TD, fontFamily: "monospace" }}>{s.attendance}/{s.totalSessions}</td>
                  <td style={TD}><span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>{s.totalPoints.toLocaleString()}</span></td>
                </tr>
              ))}
              {topImprovers.length === 0 && (
                <tr><td colSpan={4} style={{ ...TD, textAlign: "center", color: "var(--muted-foreground)", padding: 22 }}>No students added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "18px 22px", background: "var(--card)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
            <AlertTriangle size={14} color="#f59e0b" />
            <h3 style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Needs Follow-up</h3>
          </div>
          {needsFollowup.length === 0 ? (
            <p style={{ color: "var(--muted-foreground)", fontSize: 12 }}>All students have attendance ≥ 80%.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["Name", "Code", "Att.", "Action"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {needsFollowup.map((s, i) => {
                  const pct = Math.round((s.attendance / Math.max(s.totalSessions, 1)) * 100);
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                      <td style={{ ...TD, fontWeight: 600 }}>{s.name}</td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{s.code}</td>
                      <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, color: "#f59e0b" }}>{pct}%</td>
                      <td style={TD}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: "#FEF3C7", color: "#92400E", fontWeight: 700 }}>{pct < 70 ? "Attendance review" : "Check-in"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Kahoot participation */}
      <div style={{ padding: "18px 22px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
        <h3 style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 14px" }}>Quiz Participation</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 10 }}>
              <span style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>{withId.length}</span> of <strong>{students.length}</strong> students have a player identifier configured.
            </p>
            {withoutId.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--foreground)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Player ID not set:</p>
                {withoutId.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
                    <PixelAvatar avatarId={s.avatarId} size={20} />
                    {s.name} <span style={{ fontFamily: "monospace", fontSize: 10 }}>({s.code})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: "13px 16px", background: "var(--secondary)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3 }}>Avg Correct Answers (last quiz)</div>
              <div style={{ fontSize: 22, fontFamily: "monospace", fontWeight: 700, color: "var(--foreground)" }}>3.4 / 5</div>
            </div>
            <div style={{ padding: "13px 16px", background: "var(--secondary)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3 }}>Top Quiz Scorer</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{withId[0]?.name ?? "—"}</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)" }}>{withId[0]?.playerId ?? "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// APP ROOT
// ============================================================

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const result = await loginAdmin(password);
      if (result.authenticated) {
        setPassword("");
        onLogin();
        return;
      }

      setError("Incorrect password.");
    } catch (err) {
      setError(err instanceof Error && err.message.includes("503")
        ? "Admin login is not configured. Check ADMIN_PASSWORD_HASH in the backend environment."
        : "Incorrect password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", position: "relative", display: "grid", placeItems: "center", padding: 24 }}>
      <GeoBackground />
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 410, position: "relative", zIndex: 10, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, boxShadow: "0 24px 80px rgba(15,32,32,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
          <span style={{ color: "#C8960C", fontSize: 15, fontWeight: 700 }}>◆</span>
          <span style={{ fontFamily: "Lora, Georgia, serif", color: "var(--foreground)", fontSize: 18, fontWeight: 700 }}>Amal B&apos;Ilm</span>
        </div>
        <h1 style={{ fontFamily: "Lora, Georgia, serif", fontSize: 26, margin: "14px 0 4px", color: "var(--foreground)" }}>Staff Login</h1>
        <p style={{ margin: "0 0 22px", color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
          Sign in to manage cohorts, sessions, scores, and the leaderboard display.
        </p>

        <label style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Admin Password
        </label>
        <div style={{ position: "relative" }}>
          <Lock size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            style={{ width: "100%", padding: "11px 12px 11px 36px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--background)", color: "var(--foreground)", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid #991B1B33", borderRadius: 8, background: "#FEE2E2", color: "#7F1D1D", fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !password.trim()}
          style={{ width: "100%", marginTop: 18, padding: "11px 14px", border: "none", borderRadius: 8, background: submitting || !password.trim() ? "var(--muted)" : "#0F3A32", color: submitting || !password.trim() ? "var(--muted-foreground)" : "#F8EBC7", fontWeight: 700, cursor: submitting || !password.trim() ? "not-allowed" : "pointer" }}
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
};

const PublicAccessScreen = ({
  activeCohort,
  setActiveCohort,
  cohorts,
  students,
  onStaffLogin,
  onTVMode,
}: {
  activeCohort: string;
  setActiveCohort: (id: string) => void;
  cohorts: Cohort[];
  students: Student[];
  onStaffLogin: () => void;
  onTVMode: () => void;
}) => {
  const sorted = [...students].sort((a, b) => b.totalPoints - a.totalPoints);
  const cohort = cohorts.find(c => c.id === activeCohort);

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", position: "relative", padding: "28px 32px" }}>
      <GeoBackground />
      <div style={{ position: "relative", zIndex: 10, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <span style={{ color: "#C8960C", fontSize: 15, fontWeight: 700 }}>◆</span>
              <span style={{ fontFamily: "Lora, Georgia, serif", color: "var(--foreground)", fontSize: 18, fontWeight: 700 }}>Amal B&apos;Ilm</span>
            </div>
            <h1 style={{ fontFamily: "Lora, Georgia, serif", fontSize: 34, margin: 0, color: "var(--foreground)" }}>Leaderboard</h1>
            <p style={{ margin: "6px 0 0", color: "var(--muted-foreground)", fontSize: 14 }}>{cohort?.name ?? "No cohort selected"}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {cohorts.length > 0 && (
              <select value={activeCohort} onChange={event => setActiveCohort(event.target.value)} style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}>
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <button onClick={onTVMode} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}><Tv size={14} /> TV Display</button>
            <button onClick={onStaffLogin} style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", fontWeight: 700 }}>Staff Login</button>
          </div>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>{["Rank", "Student", "Attendance", "Points"].map(label => <th key={label} style={TH}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {sorted.map(student => (
                <tr key={student.id}>
                  <td style={{ ...TD, fontWeight: 800, color: student.rank <= 3 ? "#92400E" : "var(--muted-foreground)" }}>#{student.rank}</td>
                  <td style={TD}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <PixelAvatar avatarId={student.avatarId} size={32} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{student.name}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)" }}>{student.code}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...TD, color: "var(--muted-foreground)" }}>{student.attendance}/{student.totalSessions}</td>
                  <td style={{ ...TD, fontFamily: "monospace", fontWeight: 800 }}>{student.totalPoints.toLocaleString()}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...TD, textAlign: "center", padding: 28, color: "var(--muted-foreground)" }}>No leaderboard data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [screen, setScreen] = useState<AdminScreen>("dashboard");
  const [activeCohort, setActiveCohort] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<SessionWorkspaceTab>("overview");
  const [tvMode, setTvMode] = useState(false);
  const [intermission, setIntermission] = useState(false);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [apiStatus, setApiStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [showLogin, setShowLogin] = useState(false);

  const refreshData = useCallback(async () => {
    const data = await fetchCoreData();
    const nextCohorts = mapApiCohorts(data.cohorts, data.students, data.sessions);
    const nextActiveCohort = nextCohorts.some(cohort => cohort.id === activeCohort)
      ? activeCohort
      : nextCohorts[0]?.id ?? "";
    const nextLeaderboard = await fetchLeaderboard(nextActiveCohort);
    const nextStudents = mapApiStudents(nextLeaderboard, data.students, nextActiveCohort);
    const nextSessions = mapApiSessions(data.sessions);
    const nextSelectedSession = nextSessions.some(workshopSession => workshopSession.id === selectedSessionId)
      ? selectedSessionId
      : nextSessions.find(workshopSession => workshopSession.cohortId === nextActiveCohort)?.id ?? nextSessions[0]?.id ?? "";

    setCohorts(nextCohorts);
    setActiveCohort(nextActiveCohort);
    setAllStudents(nextStudents);
    setAllSessions(nextSessions);
    setSelectedSessionId(nextSelectedSession);
    setApiStatus("ready");
  }, [activeCohort, selectedSessionId]);

  useEffect(() => {
    let cancelled = false;

    fetchAuthState()
      .then(result => {
        if (!cancelled) setAuthStatus(result.authenticated ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!cancelled) setAuthStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authStatus === "checking") return;

    let cancelled = false;

    refreshData()
      .then(() => {
        if (cancelled) return;
      })
      .catch(error => {
        console.warn("Backend API unavailable.", error);
        if (!cancelled) setApiStatus("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, refreshData]);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      setTvMode(false);
      setIntermission(false);
      setShowLogin(false);
      setAuthStatus("unauthenticated");
    }
  };

  const students = useMemo(() => allStudents.filter(s => s.cohortIds.includes(activeCohort)), [activeCohort, allStudents]);
  const sessions  = useMemo(() => allSessions.filter(s => s.cohortId === activeCohort), [activeCohort, allSessions]);
  const selectedSession = allSessions.find(s => s.id === selectedSessionId);

  const screenProps: ScreenProps = {
    activeCohort,
    setActiveCohort,
    cohorts,
    students,
    allStudents,
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    workspaceTab,
    setWorkspaceTab,
    setScreen,
    onTVMode: () => setTvMode(true),
    refreshData,
  };

  if (authStatus === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted-foreground)", fontSize: 13 }}>
        Checking session...
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    if (showLogin) {
      return <LoginScreen onLogin={() => { setShowLogin(false); setAuthStatus("authenticated"); }} />;
    }

    return (
      <>
        {tvMode && (
          <TVMode
            students={students}
            session={selectedSession}
            intermission={intermission}
            setIntermission={setIntermission}
            onExit={() => { setTvMode(false); setIntermission(false); }}
          />
        )}
        <PublicAccessScreen
          activeCohort={activeCohort}
          setActiveCohort={setActiveCohort}
          cohorts={cohorts}
          students={students}
          onStaffLogin={() => setShowLogin(true)}
          onTVMode={() => setTvMode(true)}
        />
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex" }}>
      <GeoBackground />
      {tvMode && (
        <TVMode
          students={students}
          session={selectedSession}
          intermission={intermission}
          setIntermission={setIntermission}
          onExit={() => { setTvMode(false); setIntermission(false); }}
        />
      )}
      <AdminSidebar
        currentScreen={screen}
        setScreen={setScreen}
        activeCohort={activeCohort}
        setActiveCohort={setActiveCohort}
        cohorts={cohorts}
        onTVMode={() => setTvMode(true)}
        onLogout={handleLogout}
      />
      <main style={{ marginLeft: 200, flex: 1, minWidth: 0, padding: "28px 32px 48px", position: "relative", zIndex: 10 }}>
        {apiStatus === "fallback" && (
          <div style={{ marginBottom: 14, padding: "10px 14px", border: "1px solid #92400E44", borderRadius: 8, background: "#FEF3C7", color: "#78350F", fontSize: 13 }}>
            Backend API unavailable. Start the Flask server, then refresh this page.
          </div>
        )}
        {screen === "dashboard"   && <DashboardScreen   {...screenProps} />}
        {screen === "leaderboard" && <LeaderboardScreen {...screenProps} />}
        {screen === "students"    && <StudentsScreen    {...screenProps} />}
        {screen === "sessions"    && <SessionsScreen    {...screenProps} />}
        {screen === "scoring"     && <SessionWorkspaceScreen {...screenProps} />}
        {screen === "kahoot"      && <KahootScreen     {...screenProps} />}
        {screen === "reports"     && <ReportsScreen     {...screenProps} />}
      </main>
    </div>
  );
}
