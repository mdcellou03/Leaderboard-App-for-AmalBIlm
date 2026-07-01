import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Trophy, Tv, Users, Calendar,
  ClipboardList, Zap, BarChart2, ChevronDown,
  Search, Plus, Edit3, Lock, ArrowLeft,
  RefreshCw, X, AlignLeft, Check, AlertTriangle,
  Clock, Download, FileText, Link2, ExternalLink,
  ChevronRight, Save, Award, BookOpen, LogOut,
} from "lucide-react";
import { createSessionQuestion, fetchAuthState, fetchCoreData, fetchSessionQuestions, loginAdmin, logoutAdmin, type ApiCohort, type ApiLeaderboardRow, type ApiSession, type ApiSessionQuestion, type ApiStudent } from "./api";

// ============================================================
// TYPES
// ============================================================

type AdminScreen = "dashboard" | "leaderboard" | "students" | "sessions" | "scoring" | "kahoot" | "reports";
type SessionWorkspaceTab = "overview" | "questions" | "score" | "results";
type SessionStatus = "draft" | "ready" | "live" | "review" | "published" | "archived";
type KahootStatus = "questions-ready" | "exported" | "hosted" | "results-imported" | "reviewed";
type GradeStatus = "draft" | "reviewed" | "published";

interface Cohort { id: string; name: string; term: string; status: "active" | "archived"; sessionCount: number; studentCount: number; }
interface Student { id: string; code: string; name: string; cohortId: string; playerId?: string; attendance: number; totalSessions: number; totalPoints: number; rank: number; avatarId: number; badges: string[]; streak: number; joinDate: string; }
interface Session { id: string; cohortId: string; num: number; title: string; date: string; presenter: string; status: SessionStatus; kahootStatus: KahootStatus; notes?: string; questionCount?: number; }
interface SessionGrade { studentId: string; present: boolean; punctual: boolean; deliverable: boolean; kahootPts: number; participation: number; teamwork: number; adab: number; penalty: number; penaltyNote: string; notes?: string; status: GradeStatus; }
interface KahootResult { nickname: string; identifier: string; studentId: string | null; correct: number; total: number; kahootPts: number; appPts: number; matchStatus: "matched" | "unmatched" | "review"; }
interface KahootQuestion { id: string; text: string; timeLimit: number; points: number; }
interface ScreenProps {
  activeCohort: string;
  setActiveCohort: (id: string) => void;
  cohorts: Cohort[];
  students: Student[];
  allStudents: Student[];
  sessions: Session[];
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
  setScreen: (s: AdminScreen) => void;
  onTVMode: () => void;
}

// ============================================================
// MOCK DATA
// ============================================================

const COHORTS: Cohort[] = [
  { id: "c1", name: "Spring 2026",  term: "Spring 2026 Cohort",  status: "active",   sessionCount: 14, studentCount: 8 },
  { id: "c2", name: "Summer 2026",  term: "Summer 2026 Cohort",  status: "active",   sessionCount: 2,  studentCount: 4 },
  { id: "c3", name: "Fall 2026",    term: "Fall 2026 Cohort",    status: "active",   sessionCount: 0,  studentCount: 0 },
  { id: "c0", name: "Fall 2025",    term: "Fall 2025 Cohort",    status: "archived", sessionCount: 12, studentCount: 6 },
];

const BADGE_DEFS: Record<string, { symbol: string; label: string; color: string }> = {
  "top-scorer":         { symbol: "★", label: "Top Scorer",        color: "#B8860B" },
  "perfect-attendance": { symbol: "◆", label: "Full Attendance",   color: "#2E7D32" },
  "adab":               { symbol: "♦", label: "Best Conduct",       color: "#6A1B9A" },
  "streak-5":           { symbol: "▲", label: "5× Streak",         color: "#BF360C" },
  "team-player":        { symbol: "●", label: "Team Player",       color: "#01579B" },
  "deliverable":        { symbol: "■", label: "All Delivered",     color: "#1B5E20" },
};

const STUDENTS: Student[] = [
  { id: "s1",  code: "STU-001", name: "Ibrahim Al-Rashid", cohortId: "c1", playerId: "Ibrahim_AR",   attendance: 12, totalSessions: 13, totalPoints: 2840, rank: 1, avatarId: 0, badges: ["top-scorer","perfect-attendance","streak-5","adab"],  streak: 8,  joinDate: "2026-01-10" },
  { id: "s2",  code: "STU-002", name: "Fatimah Noor",       cohortId: "c1", playerId: "FatimahN",     attendance: 13, totalSessions: 13, totalPoints: 2710, rank: 2, avatarId: 1, badges: ["perfect-attendance","deliverable","adab","team-player"], streak: 13, joinDate: "2026-01-10" },
  { id: "s3",  code: "STU-003", name: "Yusuf Karimi",        cohortId: "c1", playerId: "YusufK",       attendance: 11, totalSessions: 13, totalPoints: 2590, rank: 3, avatarId: 2, badges: ["streak-5","team-player"],                               streak: 5,  joinDate: "2026-01-10" },
  { id: "s4",  code: "STU-004", name: "Maryam Hassan",       cohortId: "c1", playerId: "Maryam_H",    attendance: 12, totalSessions: 13, totalPoints: 2440, rank: 4, avatarId: 3, badges: ["deliverable","adab"],                                    streak: 4,  joinDate: "2026-01-10" },
  { id: "s5",  code: "STU-005", name: "Umar Siddiqui",       cohortId: "c1", playerId: "UmarS",        attendance: 10, totalSessions: 13, totalPoints: 2280, rank: 5, avatarId: 4, badges: ["team-player"],                                           streak: 3,  joinDate: "2026-01-17" },
  { id: "s6",  code: "STU-006", name: "Ali Mahmud",           cohortId: "c1", playerId: "ali_mahmud",  attendance: 11, totalSessions: 13, totalPoints: 2110, rank: 6, avatarId: 5, badges: ["deliverable"],                                           streak: 2,  joinDate: "2026-01-17" },
  { id: "s7",  code: "STU-007", name: "Khadijah Osman",       cohortId: "c1", playerId: undefined,     attendance: 9,  totalSessions: 13, totalPoints: 1980, rank: 7, avatarId: 6, badges: ["adab"],                                                  streak: 1,  joinDate: "2026-01-24" },
  { id: "s8",  code: "STU-008", name: "Zaynab Idris",         cohortId: "c1", playerId: undefined,     attendance: 10, totalSessions: 13, totalPoints: 1780, rank: 8, avatarId: 7, badges: [],                                                        streak: 0,  joinDate: "2026-01-24" },
  { id: "s9",  code: "SM-001", name: "Tariq Osman",    cohortId: "c2", playerId: "TariqO",   attendance: 2, totalSessions: 2, totalPoints: 410, rank: 1, avatarId: 2, badges: [],                    streak: 2, joinDate: "2026-06-05" },
  { id: "s10", code: "SM-002", name: "Hana Malik",      cohortId: "c2", playerId: "HanaMalik", attendance: 1, totalSessions: 2, totalPoints: 195, rank: 2, avatarId: 7, badges: [],                    streak: 0, joinDate: "2026-06-05" },
  { id: "s11", code: "SM-003", name: "Salim Rashid",    cohortId: "c2", playerId: "SalimR",   attendance: 2, totalSessions: 2, totalPoints: 380, rank: 3, avatarId: 4, badges: [],                    streak: 2, joinDate: "2026-06-05" },
  { id: "s12", code: "SM-004", name: "Layla Al-Nour",   cohortId: "c2", playerId: undefined,  attendance: 2, totalSessions: 2, totalPoints: 350, rank: 4, avatarId: 3, badges: [],                    streak: 2, joinDate: "2026-06-12" },
];

const SESSIONS: Session[] = [
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

const KAHOOT_QUESTIONS: KahootQuestion[] = [
  { id: "kq1", text: "Which of the 5 pillars comes first?",                       timeLimit: 20, points: 1000 },
  { id: "kq2", text: "How many times do Muslims pray daily?",                      timeLimit: 15, points: 2000 },
  { id: "kq3", text: "What is the Arabic word for charity?",                       timeLimit: 20, points: 1000 },
  { id: "kq4", text: "In which month is the Quran said to have been revealed?",   timeLimit: 20, points: 2000 },
  { id: "kq5", text: "What city did the Prophet ﷺ migrate to during the Hijra?", timeLimit: 25, points: 2000 },
];

const KAHOOT_RESULTS: KahootResult[] = [
  { nickname: "Ibrahim_AR",  identifier: "STU-001", studentId: "s1",  correct: 4, total: 5, kahootPts: 8520, appPts: 43, matchStatus: "matched"   },
  { nickname: "FatimahN",    identifier: "STU-002", studentId: "s2",  correct: 5, total: 5, kahootPts: 9800, appPts: 50, matchStatus: "matched"   },
  { nickname: "YusufK",      identifier: "STU-003", studentId: "s3",  correct: 3, total: 5, kahootPts: 6150, appPts: 31, matchStatus: "matched"   },
  { nickname: "MARYAM_ALT",  identifier: "",       studentId: null,  correct: 4, total: 5, kahootPts: 7800, appPts: 0,  matchStatus: "review"    },
  { nickname: "UmarS",       identifier: "STU-005", studentId: "s5",  correct: 3, total: 5, kahootPts: 5900, appPts: 30, matchStatus: "matched"   },
  { nickname: "ali_mahmud",  identifier: "STU-006", studentId: "s6",  correct: 2, total: 5, kahootPts: 4100, appPts: 21, matchStatus: "matched"   },
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
  const defaults: Omit<SessionGrade, "studentId">[] = [
    { present: true,  punctual: true,  deliverable: true,  kahootPts: 43, participation: 9,  teamwork: 8,  adab: 9,  penalty: 0, penaltyNote: "", status: "draft" },
    { present: true,  punctual: true,  deliverable: true,  kahootPts: 50, participation: 10, teamwork: 9,  adab: 10, penalty: 0, penaltyNote: "", status: "draft" },
    { present: true,  punctual: false, deliverable: true,  kahootPts: 31, participation: 8,  teamwork: 8,  adab: 8,  penalty: 0, penaltyNote: "", status: "draft" },
    { present: true,  punctual: true,  deliverable: false, kahootPts: 0,  participation: 7,  teamwork: 7,  adab: 8,  penalty: 0, penaltyNote: "", status: "draft" },
    { present: true,  punctual: true,  deliverable: true,  kahootPts: 30, participation: 7,  teamwork: 8,  adab: 7,  penalty: 0, penaltyNote: "", status: "draft" },
    { present: true,  punctual: false, deliverable: true,  kahootPts: 21, participation: 6,  teamwork: 7,  adab: 7,  penalty: 5, penaltyNote: "Late phone use", status: "draft" },
    { present: false, punctual: false, deliverable: false, kahootPts: 0,  participation: 0,  teamwork: 0,  adab: 0,  penalty: 0, penaltyNote: "", status: "draft" },
    { present: true,  punctual: true,  deliverable: false, kahootPts: 0,  participation: 5,  teamwork: 6,  adab: 7,  penalty: 0, penaltyNote: "", status: "draft" },
  ];
  const result: Record<string, SessionGrade> = {};
  students.forEach((stu, i) => {
    const d = defaults[i] ?? defaults[defaults.length - 1];
    result[stu.id] = { studentId: stu.id, ...d };
  });
  return result;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const mapApiCohorts = (cohorts: ApiCohort[], students: ApiStudent[], sessions: ApiSession[]): Cohort[] => {
  if (!cohorts.length) return COHORTS;

  return cohorts.map(cohort => {
    const id = String(cohort.id);
    const sessionCount = sessions.filter(session => session.cohort_id === cohort.id).length;
    const studentCount = students.filter(student => student.cohort_id === cohort.id).length;

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
  if (!leaderboard.length) return STUDENTS;

  const studentsById = new Map(students.map(student => [student.id, student]));

  return leaderboard.map((row, index) => ({
    id: String(row.id),
    code: row.code,
    name: row.name,
    cohortId: String(studentsById.get(row.id)?.cohort_id ?? activeCohort),
    playerId: row.code,
    attendance: row.attended_sessions,
    totalSessions: Math.max(row.attended_sessions, row.current_streak),
    totalPoints: row.total,
    rank: row.rank,
    avatarId: index,
    badges: [],
    streak: row.current_streak,
    joinDate: "",
  }));
};

const mapApiSessions = (sessions: ApiSession[]): Session[] => {
  if (!sessions.length) return SESSIONS;

  return sessions.map((session, index) => ({
    id: String(session.id),
    cohortId: session.cohort_id ? String(session.cohort_id) : "unassigned",
    num: sessions.length - index,
    title: session.cohort_name ? `${session.cohort_name} Session` : "Workshop Session",
    date: session.date,
    presenter: "TBD",
    status: session.scored_entries > 0 ? "review" : "draft",
    kahootStatus: "questions-ready",
    notes: `${session.scored_entries}/${session.score_entries} score entries completed.`,
    questionCount: session.question_count,
  }));
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
  "draft":     { bg: "#37415122", text: "#9CA3AF", label: "Draft"     },
  "ready":     { bg: "#1E3A5F22", text: "#60A5FA", label: "Ready"     },
  "live":      { bg: "#065F4622", text: "#34D399", label: "Live"      },
  "review":    { bg: "#78350F22", text: "#FCD34D", label: "Review"    },
  "published": { bg: "#14532D22", text: "#86EFAC", label: "Published" },
  "archived":  { bg: "#1F293722", text: "#4B5563", label: "Archived"  },
};

const SessionStatusBadge = ({ status }: { status: SessionStatus }) => {
  const c = SESSION_STATUS_CFG[status];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.text}44`, padding: "2px 9px", borderRadius: 9999, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      {status === "published" && <Check size={10} />}
      {status === "live"     && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", display: "inline-block" }} />}
      {status === "review"   && <AlertTriangle size={10} />}
      {c.label}
    </span>
  );
};

const KAHOOT_STATUS_CFG: Record<KahootStatus, { bg: string; text: string; label: string }> = {
  "questions-ready":  { bg: "#1E3A5F22", text: "#60A5FA", label: "Questions Ready"  },
  "exported":         { bg: "#3B1F6B22", text: "#C084FC", label: "Exported"          },
  "hosted":           { bg: "#065F4622", text: "#34D399", label: "Hosted"            },
  "results-imported": { bg: "#1C3A2E22", text: "#6EE7B7", label: "Results Imported"  },
  "reviewed":         { bg: "#14532D22", text: "#86EFAC", label: "Reviewed"          },
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
  "draft":     { bg: "#37415122", text: "#9CA3AF", label: "Draft"     },
  "reviewed":  { bg: "#1E3A5F22", text: "#60A5FA", label: "Reviewed"  },
  "published": { bg: "#14532D22", text: "#86EFAC", label: "Published" },
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
                {["#", "Student", "Points", "Streak", "Badges"].map(h => (
                  <th key={h} style={{ padding: "6px 12px", textAlign: "left", color: "#3A5A4A", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #1A3A30" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((stu, i) => {
                const rc = i < 3 ? RANK_COLORS[i] : "#3A5A4A";
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

const DashboardScreen = ({ activeCohort, cohorts, students, sessions, setScreen, setSelectedSessionId }: ScreenProps) => {
  const cohort = cohorts.find(c => c.id === activeCohort);
  const completed   = sessions.filter(s => s.status === "published" || s.status === "review" || s.status === "live");
  const upcoming    = sessions.find(s => s.status === "draft" || s.status === "ready");
  const recent      = [...completed].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const needsReview = sessions.filter(s => s.status === "review");
  const topStudents = [...students].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3);
  const avgScore = students.length ? Math.round(students.reduce((s, x) => s + x.totalPoints, 0) / students.length) : 0;
  const avgAtt   = students.length ? Math.round(students.reduce((s, x) => s + (x.attendance / Math.max(x.totalSessions, 1)) * 100, 0) / students.length) : 0;

  return (
    <div>
      <PageHeader title="Dashboard" description={cohort ? `${cohort.name} · ${cohort.term}` : undefined} />

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
                    <tr key={ses.id} style={{ cursor: "pointer" }} onClick={() => { setSelectedSessionId(ses.id); setScreen("scoring"); }}>
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
                <AlertTriangle size={15} color="#FCD34D" />
                <h2 style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 600, color: "#FCD34D", margin: 0 }}>Pending Review</h2>
              </div>
              {needsReview.map(ses => (
                <div key={ses.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => { setSelectedSessionId(ses.id); setScreen("scoring"); }}>
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
                  onClick={() => { setSelectedSessionId(upcoming.id); setScreen("scoring"); }}
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
  const [timeFilter, setTimeFilter] = useState<"alltime" | "session" | "improvers">("alltime");
  const students = props.allStudents.filter(s => s.cohortId === filterCohort);
  const sorted   = [...students].sort((a, b) => b.totalPoints - a.totalPoints);
  const top3 = sorted.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const podiumRanks = [2, 1, 3];
  const RANK_COLORS = ["#9A9A9A", "#C8960C", "#8B4513"];
  const DELTAS      = [340, 280, 210, 190, 155, 90, -10, -50];

  const improvers = [...students].map((s, i) => ({ ...s, delta: DELTAS[i] ?? 0 })).sort((a, b) => b.delta - a.delta);

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
        <button style={btnStyle(timeFilter === "alltime")}   onClick={() => setTimeFilter("alltime")}>All-Time</button>
        <button style={btnStyle(timeFilter === "session")}   onClick={() => setTimeFilter("session")}>This Session</button>
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
              <thead><tr>{["Rank", "Student", "Cohort", "Points", "Attendance", "Streak", "Badges", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {sorted.map((stu, i) => {
                  const rank  = i + 1;
                  const color = rank <= 3 ? RANK_COLORS[rank - 1] : "var(--muted-foreground)";
                  const coh   = props.cohorts.find(c => c.id === stu.cohortId);
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
            Session 13 — Knowledge & Community · Kahoot scores
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Rank", "Student", "Quiz Points", "Score"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {KAHOOT_RESULTS.filter(r => r.studentId).map((r, i) => {
                const stu = STUDENTS.find(s => s.id === r.studentId);
                if (!stu) return null;
                return (
                  <tr key={r.nickname}>
                    <td style={{ ...TD, fontWeight: 700, color: i < 3 ? RANK_COLORS[i] : "var(--muted-foreground)", fontFamily: "monospace" }}>#{i + 1}</td>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PixelAvatar avatarId={stu.avatarId} size={28} />
                        <div><div style={{ fontWeight: 600 }}>{stu.name}</div><div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{stu.code}</div></div>
                      </div>
                    </td>
                    <td style={{ ...TD, fontFamily: "monospace", color: "var(--muted-foreground)" }}>{r.kahootPts.toLocaleString()}</td>
                    <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700 }}>{stu?.totalPoints.toLocaleString() ?? "—"}</td>
                  </tr>
                );
              })}
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
  const [filterCohort, setFilterCohort] = useState("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", cohortId: "c1", playerId: "" });

  const filtered = props.allStudents.filter(s =>
    (filterCohort === "all" || s.cohortId === filterCohort) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
  );

  const nameCounts: Record<string, number> = {};
  props.allStudents.forEach(s => { nameCounts[s.name] = (nameCounts[s.name] || 0) + 1; });

  const panelOpen = addOpen || editingId !== null;
  const editingStu = editingId ? props.allStudents.find(s => s.id === editingId) : null;

  const openEdit = (s: Student) => {
    setEditingId(s.id);
    setAddOpen(false);
    setForm({ name: s.name, code: s.code, cohortId: s.cohortId, playerId: s.playerId ?? "" });
  };
  const openAdd  = () => { setAddOpen(true); setEditingId(null); setForm({ name: "", code: "", cohortId: "c1", playerId: "" }); };
  const close    = () => { setAddOpen(false); setEditingId(null); };

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
              <tr>{["Code", "Name", "Cohort", "Player ID", "Attendance", "Points", "Rank", "Badges", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(stu => {
                const coh = props.cohorts.find(c => c.id === stu.cohortId);
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
                    <td style={TD}><span style={{ padding: "2px 7px", background: "var(--secondary)", borderRadius: 4, fontSize: 11 }}>{coh?.name ?? stu.cohortId}</span></td>
                    <td style={{ ...TD, fontFamily: "monospace", fontSize: 11, color: stu.playerId ? "var(--foreground)" : "var(--muted-foreground)" }}>{stu.playerId || <span style={{ fontStyle: "italic", fontFamily: "inherit" }}>Not set</span>}</td>
                    <td style={{ ...TD, color: "var(--muted-foreground)" }}>{stu.attendance}/{stu.totalSessions}</td>
                    <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700 }}>{stu.totalPoints.toLocaleString()}</td>
                    <td style={{ ...TD, color: "var(--muted-foreground)" }}>#{stu.rank}</td>
                    <td style={TD}><div style={{ display: "flex", gap: 3 }}>{stu.badges.slice(0, 2).map(b => { const d = BADGE_DEFS[b]; return d ? <span key={b} title={d.label} style={{ color: d.color, fontSize: 12 }}>{d.symbol}</span> : null; })}</div></td>
                    <td style={TD}><button onClick={() => openEdit(stu)} style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><Edit3 size={11} /> Edit</button></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ ...TD, textAlign: "center", color: "var(--muted-foreground)", padding: 24 }}>No students found.</td></tr>}
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
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. STU-009" disabled={!addOpen}
                  style={{ ...inputSt, fontFamily: "monospace", background: addOpen ? "var(--background)" : "var(--muted)", cursor: addOpen ? undefined : "not-allowed" }} />
                {!addOpen && <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>Codes link all grade history and cannot be changed after creation.</p>}
              </div>
              <div>
                <label style={labelSt}>Cohort</label>
                <select value={form.cohortId} onChange={e => setForm(f => ({ ...f, cohortId: e.target.value }))} style={{ ...inputSt }}>
                  {props.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Player Identifier <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--muted-foreground)", fontWeight: 400 }}>(optional — used for quiz matching)</span></label>
                <input value={form.playerId} onChange={e => setForm(f => ({ ...f, playerId: e.target.value }))} placeholder="e.g. STU-001 or custom handle" style={inputSt} />
              </div>
            </div>
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "var(--secondary)", fontSize: 11, color: "var(--muted-foreground)", display: "flex", gap: 7, alignItems: "flex-start" }}>
              <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              Student codes are permanent unique identifiers. If two students share a name, the code distinguishes them across all records.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
  const [form, setForm] = useState({ cohortId: props.activeCohort, num: "", title: "", date: "", presenter: "", notes: "", includeKahoot: true, includeDeliverable: true });
  const sorted = [...props.sessions].sort((a, b) => b.num - a.num);

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
            <div><label style={labelSt}>Session #</label><input type="number" value={form.num} onChange={e => setForm(f => ({ ...f, num: e.target.value }))} placeholder="e.g. 14" style={inputSt} /></div>
            <div><label style={labelSt}>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputSt} /></div>
            <div style={{ gridColumn: "span 2" }}><label style={labelSt}>Title</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Session title" style={inputSt} /></div>
            <div><label style={labelSt}>Presenter</label><input value={form.presenter} onChange={e => setForm(f => ({ ...f, presenter: e.target.value }))} placeholder="Name" style={inputSt} /></div>
            <div style={{ gridColumn: "span 3" }}><label style={labelSt}>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional session notes…" rows={2} style={{ ...inputSt, resize: "vertical" }} /></div>
          </div>
          <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.includeKahoot} onChange={e => setForm(f => ({ ...f, includeKahoot: e.target.checked }))} /> Include Kahoot scoring
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.includeDeliverable} onChange={e => setForm(f => ({ ...f, includeDeliverable: e.target.checked }))} /> Include deliverable
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Save size={13} /> Create Session</button>
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
                      <button onClick={() => { props.setSelectedSessionId(ses.id); props.setScreen("scoring"); }}
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

const ScoringScreen = ({ students, sessions, selectedSessionId, setSelectedSessionId }: ScreenProps) => {
  const [grades, setGrades] = useState<Record<string, SessionGrade>>(() => initGrades(students));
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [sessionStatus, setSessionStatus] = useState<GradeStatus>("draft");
  const [showDefaults, setShowDefaults] = useState(false);

  const cohortSessions = [...sessions].sort((a, b) => a.num - b.num);
  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? sessions[0];

  const setGrade = (id: string, patch: Partial<SessionGrade>) =>
    setGrades(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const submitForReview = () => {
    setGrades(prev => { const n = { ...prev }; for (const k in n) n[k] = { ...n[k], status: "reviewed" }; return n; });
    setSessionStatus("reviewed");
  };
  const lockSession = () => {
    setGrades(prev => { const n = { ...prev }; for (const k in n) n[k] = { ...n[k], status: "published" }; return n; });
    setSessionStatus("published");
  };
  const cycleStatus = (id: string) => {
    if (sessionStatus === "published") return;
    const cur = grades[id]?.status ?? "draft";
    setGrade(id, { status: cur === "draft" ? "reviewed" : cur === "reviewed" ? "published" : "draft" }); // cycle: draft → reviewed → published
  };

  const presentCount = students.filter(s => grades[s.id]?.present).length;
  const avgScore = students.length ? Math.round(students.map(s => calcScore(grades[s.id])).reduce((a, b) => a + b, 0) / students.length) : 0;
  const gradedCount = students.filter(s => (grades[s.id]?.status ?? "draft") !== "draft").length;

  const scoreColor = (n: number) => n >= 200 ? "#34D399" : n >= 150 ? "#FCD34D" : n < 80 ? "var(--muted-foreground)" : "var(--foreground)";

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
          {sessionStatus === "draft"    && <button onClick={submitForReview} style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, background: "var(--primary)", color: "var(--primary-foreground)", border: "none", cursor: "pointer", fontWeight: 600 }}>Mark as Reviewed</button>}
          {sessionStatus === "reviewed" && <button onClick={lockSession} style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, background: "#14532D", color: "#86EFAC", border: "none", cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={12} />Publish Grades</button>}
          {sessionStatus === "published" && <span style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, background: "#14532D22", color: "#86EFAC", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={12} />Grades Published</span>}
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
                    <td style={TD2}><input type="number" min={0} max={50} value={g?.kahootPts ?? ""} placeholder="0" onChange={e => setGrade(stu.id, { kahootPts: +e.target.value })} disabled={!g?.present || sessionStatus === "published"} style={{ ...NUM_INPUT, opacity: g?.present ? 1 : 0.35 }} /></td>
                    <td style={TD2}><input type="number" min={1} max={10} value={g?.participation ?? ""} placeholder="—" onChange={e => setGrade(stu.id, { participation: +e.target.value })} disabled={!g?.present || sessionStatus === "published"} style={{ ...NUM_INPUT, opacity: g?.present ? 1 : 0.35 }} /></td>
                    <td style={TD2}><input type="number" min={1} max={10} value={g?.teamwork ?? ""} placeholder="—" onChange={e => setGrade(stu.id, { teamwork: +e.target.value })} disabled={!g?.present || sessionStatus === "published"} style={{ ...NUM_INPUT, opacity: g?.present ? 1 : 0.35 }} /></td>
                    <td style={TD2}><input type="number" min={1} max={10} value={g?.adab ?? ""} placeholder="—" onChange={e => setGrade(stu.id, { adab: +e.target.value })} disabled={!g?.present || sessionStatus === "published"} style={{ ...NUM_INPUT, opacity: g?.present ? 1 : 0.35 }} /></td>
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
  const [tab, setTab] = useState<SessionWorkspaceTab>("overview");
  const [questions, setQuestions] = useState<ApiSessionQuestion[]>([]);
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

    fetchSessionQuestions(numericSessionId)
      .then(nextQuestions => {
        if (cancelled) return;
        setQuestions(nextQuestions);
        setQuestionsStatus("ready");
      })
      .catch(error => {
        if (cancelled) return;
        console.warn("Could not load session questions.", error);
        setQuestions([]);
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
      const createdQuestion = await createSessionQuestion(numericSessionId, {
        prompt: questionForm.prompt.trim(),
        options,
        correct_option: questionForm.correctOption,
        time_limit_seconds: questionForm.timeLimit,
        points: questionForm.points,
      });

      setQuestions(prev => [...prev, createdQuestion]);
      setQuestionsStatus("ready");
      setQuestionForm(prev => ({
        ...prev,
        prompt: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctOption: "A",
      }));
    } catch (error) {
      console.warn("Could not save question.", error);
      setQuestionError("Could not save this question. Check the prompt, options, and correct answer.");
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
            <StatCard label="Review" value={pendingReview ? "Needed" : "Clear"} sub="before publishing scores" accent={pendingReview ? "#F59E0B" : "#10B981"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            {actionCard(
              "Prepare or send engagement questions",
              "Use this while the presenter is moving through the lesson. Questions stay tied to this session and can later be pushed to Kahoot through the API adapter.",
              <Zap size={17} />,
              <button onClick={() => setTab("questions")} style={{ padding: "8px 12px", border: "none", borderRadius: 8, background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, cursor: "pointer" }}>Open Questions</button>,
              "#C8960C",
            )}
            {actionCard(
              "Run the live quiz",
              "Launch Kahoot from the selected session, show the join link or PIN, then return here when the quiz is complete.",
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
              "Sync and review results",
              "After Kahoot ends, pull results into this session, match them to student IDs, review exceptions, then apply the quiz points.",
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
                  Add short engagement questions as the presenter moves through the workshop. These are saved to the selected session first; Kahoot sync can later push this same source data outward.
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={submitQuestion} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
            <h3 style={{ margin: 0, fontFamily: "Lora, serif", color: "var(--foreground)", fontSize: 16 }}>Add Question</h3>
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
              <Plus size={14} /> Save Question
            </button>
          </form>
        </div>
      )}

      {tab === "score" && <ScoringScreen {...props} />}

      {tab === "results" && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
          <h3 style={{ margin: "0 0 6px", fontFamily: "Lora, serif", color: "var(--foreground)" }}>Results Review</h3>
          <p style={{ margin: "0 0 16px", color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
            The intended production flow is API-first: fetch Kahoot report data for this session, match rows by student code, flag unmatched names, and only then apply scores to the leaderboard.
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

const KahootScreen = ({ sessions, students, selectedSessionId, setSelectedSessionId }: ScreenProps) => {
  const [tab, setTab]         = useState<"questions" | "setup" | "live" | "results">("questions");
  const [apiConnected, setApiConnected] = useState(false);
  const [gameState, setGameState]       = useState<"idle" | "live" | "ended">("idle");
  const [gamePin, setGamePin]           = useState("");
  const [manualAssign, setManualAssign] = useState<Record<string, string>>({});

  const cohortSessions  = [...sessions].sort((a, b) => a.num - b.num);
  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? sessions[0];
  const curStatus       = selectedSession?.kahootStatus ?? "questions-ready";

  const STEPS: { key: KahootStatus; label: string }[] = [
    { key: "questions-ready",   label: "Draft Questions" },
    { key: "exported",          label: "Prepare Kahoot"  },
    { key: "hosted",            label: "Host Live Game"  },
    { key: "results-imported",  label: "Sync Results"    },
    { key: "reviewed",          label: "Review & Apply"  },
  ];
  const curStepIdx  = STEPS.findIndex(s => s.key === curStatus);
  const hasResults  = curStatus === "results-imported" || curStatus === "reviewed";
  const unmatched   = KAHOOT_RESULTS.filter(r => r.matchStatus === "review");

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
      <PageHeader title="Kahoot" description="Draft questions, run the live quiz, and sync results to student scores" />

      {/* Session selector + current status */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
          style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 12px", fontSize: 13 }}>
          {cohortSessions.map(s => <option key={s.id} value={s.id}>Session {s.num} — {s.title}</option>)}
        </select>
        <KahootStatusBadge status={curStatus} />
      </div>

      {/* Workflow stepper — numbered circles */}
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
                  color: active ? "var(--primary-foreground)" : done ? "#86EFAC" : "var(--muted-foreground)",
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

      {/* Connection card */}
      <div style={{ background: "var(--card)", border: `1px solid ${apiConnected ? "#14532D55" : "var(--border)"}`, borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: apiConnected ? "#34D399" : "#6B7280", flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
              {apiConnected ? "Kahoot API connected" : "Kahoot API not connected"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 10 }}>
              {apiConnected ? "Organisation: Amal B’Ilm · account configured" : "Manual fallback available for all steps"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {!apiConnected && (
            <button onClick={() => setApiConnected(true)}
              style={{ padding: "5px 13px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", cursor: "pointer" }}>
              Connect Kahoot API
            </button>
          )}
          {apiConnected && (
            <>
              <button style={{ padding: "5px 11px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>Test</button>
              <button onClick={() => setApiConnected(false)}
                style={{ padding: "5px 11px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>Disconnect</button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        <button style={T(tab === "questions")} onClick={() => setTab("questions")}>Questions</button>
        <button style={T(tab === "setup")}     onClick={() => setTab("setup")}>Kahoot Setup</button>
        <button style={T(tab === "live")}      onClick={() => setTab("live")}>Live Game</button>
        <button style={T(tab === "results")}   onClick={() => setTab("results")}>Results</button>
      </div>

      {/* ── QUESTIONS ── */}
      {tab === "questions" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", margin: 0 }}>
                {KAHOOT_QUESTIONS.length} questions drafted
              </p>
              <button style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Plus size={12} /> Add
              </button>
            </div>
            {KAHOOT_QUESTIONS.map((q, i) => (
              <div key={q.id} style={{ padding: "11px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted-foreground)", width: 18, paddingTop: 1, flexShrink: 0 }}>{i + 1}.</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.45 }}>{q.text}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: "#14b8a622", color: "#14b8a6", fontWeight: 600 }}>{q.points} pts</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: "var(--muted)", color: "var(--muted-foreground)" }}>{q.timeLimit}s</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ padding: "3px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}><Edit3 size={11} /></button>
                  <button style={{ padding: "3px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}><X size={11} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar: roster + identity reminder */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, position: "sticky", top: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Student Identifiers</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6, margin: "0 0 12px" }}>
              Students enter their <strong style={{ color: "var(--foreground)" }}>Student ID</strong> as their display name in Kahoot. Results are matched by identifier.
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
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", margin: 0 }}>Sync to Kahoot</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
                Create or update a quiz on your Kahoot account directly from this app.
              </p>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={apiConnected ? BtnPrimary : BtnDisabled} disabled={!apiConnected}>
                <Zap size={15} /> Sync Questions to Kahoot
              </button>
              {!apiConnected && (
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                  Kahoot API not connected. Connect above to enable direct sync.
                </p>
              )}
              {apiConnected && (
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                  Will create a new Kahoot quiz with the drafted questions. You can also update an existing quiz by ID.
                </p>
              )}
              {curStatus === "exported" && (
                <div style={{ padding: "8px 10px", background: "#14532D22", borderRadius: 6, fontSize: 11, color: "#86EFAC", display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={11} /> Last synced 14 May 2026 at 14:32
                </div>
              )}
            </div>
          </div>

          {/* Secondary: manual fallback */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", margin: 0 }}>Manual Setup</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
                Export questions as a spreadsheet and import them into Kahoot manually.
              </p>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={BtnSecondary}>
                <Download size={13} /> Export Questions (.xlsx)
              </button>
              <div style={{ padding: "10px 12px", background: "var(--secondary)", borderRadius: 7, fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.65 }}>
                In Kahoot: create a new quiz → Add question → Import → Import spreadsheet → upload the file.
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
                  {apiConnected && (
                    <button style={BtnSecondary}>
                      <RefreshCw size={13} /> Fetch PIN from Kahoot API
                    </button>
                  )}
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
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Go to the Results tab to sync scores.</p>
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
                Tell students: <strong>go to kahoot.it, enter the PIN, and use your Student ID as your display name.</strong>
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, margin: 0 }}>
                Example: if their code is STU-003, they enter <code style={{ background: "var(--muted)", padding: "1px 5px", borderRadius: 4 }}>STU-003</code> as their Kahoot name. This links their game results to their record automatically.
              </p>
            </div>

            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Registered Players</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {students.slice(0, 6).map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", fontWeight: 600, width: 56, flexShrink: 0 }}>{s.playerId || s.code}</span>
                    <span style={{ fontSize: 12, color: "var(--foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.playerId ? "#34D399" : "#6B7280", flexShrink: 0 }} title={s.playerId ? "Player ID configured" : "No player ID"} />
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
              <p style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: 0 }}>Sync from Kahoot</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>Pull results directly from the Kahoot Reports API.</p>
              <button style={apiConnected ? BtnPrimary : BtnDisabled} disabled={!apiConnected}>
                <RefreshCw size={14} /> Sync Results from Kahoot
              </button>
              {!apiConnected && <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>Kahoot API not connected.</p>}
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: 0 }}>Import Results File</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>Upload a results spreadsheet exported from Kahoot.</p>
              <button style={BtnSecondary}>
                <FileText size={13} /> Choose File to Import
              </button>
            </div>
          </div>

          {/* Results table — shown when results exist */}
          {hasResults && (
            <>
              {/* Summary bar */}
              <div style={{ display: "flex", gap: 20, padding: "9px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--muted-foreground)", flexWrap: "wrap", alignItems: "center" }}>
                <span><strong style={{ color: "var(--foreground)" }}>Session {selectedSession?.num}</strong></span>
                <span>{KAHOOT_RESULTS.length} participants</span>
                <span>{KAHOOT_QUESTIONS.length} questions</span>
                <span>{KAHOOT_RESULTS.filter(r => r.matchStatus === "matched").length} matched</span>
                {unmatched.length > 0 && <span style={{ color: "#FCD34D", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> {unmatched.length} unmatched</span>}
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
                    {KAHOOT_RESULTS.map((r, i) => {
                      const stu       = r.studentId ? STUDENTS.find(s => s.id === r.studentId) : null;
                      const isUnmatched = r.matchStatus === "review";
                      return (
                        <tr key={r.nickname} style={{ borderBottom: "1px solid var(--border)", background: isUnmatched ? "rgba(234,179,8,0.04)" : i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)" }}>
                          <td style={{ ...TD, fontFamily: "monospace", fontWeight: 600 }}>{r.nickname}</td>
                          <td style={{ ...TD, fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)" }}>{r.identifier || "—"}</td>
                          <td style={TD}>
                            {stu
                              ? <div style={{ display: "flex", alignItems: "center", gap: 7 }}><PixelAvatar avatarId={stu.avatarId} size={20} /><span style={{ fontWeight: 500 }}>{stu.name}</span></div>
                              : <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ color: "#f59e0b", fontSize: 11 }}>Unmatched</span>
                                  <select value={manualAssign[r.nickname] ?? ""} onChange={e => setManualAssign(p => ({ ...p, [r.nickname]: e.target.value }))}
                                    style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 8px", fontSize: 11 }}>
                                    <option value="">Assign to student…</option>
                                    {STUDENTS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                  </select>
                                </div>
                            }
                          </td>
                          <td style={{ ...TD, fontFamily: "monospace" }}>{r.correct}/{r.total}</td>
                          <td style={{ ...TD, fontFamily: "monospace", fontWeight: 600 }}>{r.kahootPts.toLocaleString()}</td>
                          <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, color: r.appPts > 0 ? "var(--primary)" : "var(--muted-foreground)" }}>{r.appPts > 0 ? r.appPts : "—"}</td>
                          <td style={TD}>
                            {r.matchStatus === "matched"
                              ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "#14532D22", color: "#86EFAC", fontWeight: 600 }}>✓</span>
                              : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "#78350F22", color: "#FCD34D", fontWeight: 600 }}>Review</span>}
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
                    Scores are added to each matched student&apos;s session grade. Unmatched entries are skipped unless manually assigned.
                  </p>
                </div>
                <button style={{ ...BtnPrimary, width: "auto", padding: "10px 20px", flexShrink: 0 }}>
                  <Check size={14} /> Apply Scores
                </button>
              </div>
            </>
          )}

          {!hasResults && (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 4px" }}>No results yet</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Host the game in Kahoot, then sync or import results to see them here.</p>
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

  const topImprovers = [
    { name: "Yusuf Karimi",   code: "STU-003", sessions: 11, delta: 340 },
    { name: "Fatimah Noor",   code: "STU-002", sessions: 13, delta: 280 },
    { name: "Ibrahim Al-Rashid", code: "STU-001", sessions: 12, delta: 210 },
    { name: "Maryam Hassan",  code: "STU-004", sessions: 12, delta: 190 },
  ];

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
          <h3 style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 14px" }}>Top Improvers</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{["#", "Student", "Sessions", "+Pts"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {topImprovers.map((s, i) => (
                <tr key={s.code} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, color: "var(--muted-foreground)" }}>#{i + 1}</td>
                  <td style={TD}><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>{s.code}</div></td>
                  <td style={{ ...TD, fontFamily: "monospace" }}>{s.sessions}</td>
                  <td style={TD}><span style={{ fontFamily: "monospace", fontWeight: 700, color: "#10b981" }}>+{s.delta}</span></td>
                </tr>
              ))}
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
                      <td style={TD}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: "#78350F22", color: "#FCD34D", fontWeight: 600 }}>{pct < 70 ? "Attendance review" : "Check-in"}</span></td>
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

export default function App() {
  const [screen, setScreen] = useState<AdminScreen>("dashboard");
  const [activeCohort, setActiveCohort] = useState("c1");
  const [selectedSessionId, setSelectedSessionId] = useState("ses13");
  const [tvMode, setTvMode] = useState(false);
  const [intermission, setIntermission] = useState(false);
  const [cohorts, setCohorts] = useState<Cohort[]>(COHORTS);
  const [allStudents, setAllStudents] = useState<Student[]>(STUDENTS);
  const [allSessions, setAllSessions] = useState<Session[]>(SESSIONS);
  const [apiStatus, setApiStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");

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
    if (authStatus !== "authenticated") return;

    let cancelled = false;

    fetchCoreData()
      .then(data => {
        if (cancelled) return;

        const nextCohorts = mapApiCohorts(data.cohorts, data.students, data.sessions);
        const nextActiveCohort = nextCohorts[0]?.id ?? activeCohort;
        const nextStudents = mapApiStudents(data.leaderboard, data.students, nextActiveCohort);
        const nextSessions = mapApiSessions(data.sessions);

        setCohorts(nextCohorts);
        setActiveCohort(nextActiveCohort);
        setAllStudents(nextStudents);
        setAllSessions(nextSessions);
        setSelectedSessionId(nextSessions[0]?.id ?? selectedSessionId);
        setApiStatus("ready");
      })
      .catch(error => {
        console.warn("Using mock data because the backend API is unavailable.", error);
        if (!cancelled) setApiStatus("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      setTvMode(false);
      setIntermission(false);
      setAuthStatus("unauthenticated");
    }
  };

  const students = useMemo(() => allStudents.filter(s => s.cohortId === activeCohort), [activeCohort, allStudents]);
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
    setScreen,
    onTVMode: () => setTvMode(true),
  };

  if (authStatus === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--muted-foreground)", fontSize: 13 }}>
        Checking session...
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return <LoginScreen onLogin={() => setAuthStatus("authenticated")} />;
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
            Backend API unavailable. Showing bundled demo data.
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
