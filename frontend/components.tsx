
function LeaderboardScreen({ students, sessions, onNav, onTVMode }: ScreenProps) {
  const [cohortFilter, setCohortFilter] = React.useState<string>("all");
  const [timeFilter, setTimeFilter] = React.useState<"alltime" | "session" | "improvers">("alltime");

  const filteredStudents = cohortFilter === "all"
    ? students
    : students.filter(s => s.cohortId === cohortFilter);

  const currentSession = sessions.find(s => s.id === "ses13");

  const ranked = [...filteredStudents].sort((a, b) => b.totalPoints - a.totalPoints).map((s, i) => ({ ...s, rank: i + 1 }));

  const top3 = ranked.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  const getSessionPoints = (studentId: string) => {
    const result = KAHOOT_RESULTS.find(r => r.studentId === studentId && r.sessionId === "ses13");
    return result ? result.score : 0;
  };

  const sessionRanked = [...filteredStudents]
    .map(s => ({ ...s, sessionPoints: getSessionPoints(s.id) }))
    .sort((a, b) => b.sessionPoints - a.sessionPoints)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const improversRanked = [...filteredStudents]
    .map(s => {
      const prev = s.totalPoints - getSessionPoints(s.id);
      const delta = prev > 0 ? ((s.totalPoints - prev) / prev) * 100 : 0;
      return { ...s, delta: Math.round(delta) };
    })
    .sort((a, b) => b.delta - a.delta)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title="Leaderboard">
        <button
          className="px-3 py-1.5 border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => {}}
        >
          Open Public View
        </button>
        <button
          className="px-3 py-1.5 text-sm font-medium"
          style={{ background: "#1A4040", color: "#C4963A" }}
          onClick={onTVMode}
        >
          TV Display
        </button>
      </PageHeader>

      <div className="px-6 pt-4 pb-2 border-b border-border flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium mr-1">Cohort:</span>
          <button
            onClick={() => setCohortFilter("all")}
            className="px-3 py-1 text-xs border transition-colors"
            style={{
              borderColor: cohortFilter === "all" ? "#1A4040" : undefined,
              background: cohortFilter === "all" ? "#1A4040" : undefined,
              color: cohortFilter === "all" ? "#C4963A" : undefined,
            }}
          >
            All
          </button>
          {COHORTS.map(c => (
            <button
              key={c.id}
              onClick={() => setCohortFilter(c.id)}
              className="px-3 py-1 text-xs border border-border transition-colors"
              style={{
                borderColor: cohortFilter === c.id ? "#1A4040" : undefined,
                background: cohortFilter === c.id ? "#1A4040" : undefined,
                color: cohortFilter === c.id ? "#C4963A" : undefined,
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(["alltime", "session", "improvers"] as const).map(tab => {
            const labels = { alltime: "All-Time", session: "This Session", improvers: "Top Improvers" };
            return (
              <button
                key={tab}
                onClick={() => setTimeFilter(tab)}
                className="px-4 py-1.5 text-xs font-medium transition-colors border-b-2"
                style={{
                  borderBottomColor: timeFilter === tab ? "#C4963A" : "transparent",
                  color: timeFilter === tab ? "#C4963A" : undefined,
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {timeFilter === "alltime" && (
          <div className="flex flex-col gap-8">
            {top3.length >= 3 && (
              <div>
                <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wider">Top 3</p>
                <div className="flex items-end justify-center gap-4">
                  {podiumOrder.map((s, idx) => {
                    const isFirst = s.rank === 1;
                    const platformH = isFirst ? "h-16" : "h-10";
                    const avatarSize = isFirst ? 64 : 48;
                    return (
                      <div key={s.id} className="flex flex-col items-center gap-1" style={{ minWidth: 100 }}>
                        <span
                          className="text-xs font-mono font-bold mb-1"
                          style={{ color: s.rank === 1 ? "#C4963A" : s.rank === 2 ? "#9BA3AF" : "#CD7C5A" }}
                        >
                          #{s.rank}
                        </span>
                        <PixelAvatar studentId={s.id} size={avatarSize} />
                        <p className="text-xs font-medium text-center mt-1 leading-tight">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                        <p className="text-sm font-mono font-bold" style={{ color: "#1A4040" }}>{s.totalPoints.toLocaleString()}</p>
                        <div
                          className={`w-full ${platformH} mt-2 flex items-center justify-center`}
                          style={{ background: isFirst ? "#1A4040" : "#2A3A3A" }}
                        >
                          <span className="text-xs font-mono" style={{ color: "#C4963A" }}>{s.rank === 1 ? "1st" : s.rank === 2 ? "2nd" : "3rd"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Full Rankings</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium w-10">Rank</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Student</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Cohort</th>
                    <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Points</th>
                    <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Att.</th>
                    <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Streak</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Badges</th>
                    <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(s => {
                    const cohort = COHORTS.find(c => c.id === s.cohortId);
                    return (
                      <tr key={s.id} className="border-b border-border hover:bg-card transition-colors">
                        <td className="py-2.5 px-2">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: s.rank === 1 ? "#C4963A" : s.rank <= 3 ? "#1A4040" : undefined }}
                          >
                            #{s.rank}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <PixelAvatar studentId={s.id} size={28} />
                            <div>
                              <p className="text-sm font-medium leading-tight">{s.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="text-xs text-muted-foreground">{cohort?.name ?? "—"}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono text-sm font-bold" style={{ color: "#1A4040" }}>{s.totalPoints.toLocaleString()}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono text-xs text-muted-foreground">{s.attendance}/{sessions.length}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono text-xs">{s.streak ?? 0}🔥</span>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex gap-1 flex-wrap">
                            {(s.badges ?? []).slice(0, 3).map(b => (
                              <BadgePill key={b} badgeId={b} compact />
                            ))}
                            {(s.badges ?? []).length > 3 && (
                              <span className="text-xs text-muted-foreground">+{(s.badges ?? []).length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 border border-transparent hover:border-border"
                            onClick={() => onNav("student-detail", { studentId: s.id })}
                          >
                            →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {timeFilter === "session" && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">
              Session Rankings — {currentSession?.title ?? "Latest Session"}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium w-10">Rank</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Student</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Cohort</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Session Pts</th>
                </tr>
              </thead>
              <tbody>
                {sessionRanked.map(s => {
                  const cohort = COHORTS.find(c => c.id === s.cohortId);
                  return (
                    <tr key={s.id} className="border-b border-border hover:bg-card transition-colors">
                      <td className="py-2.5 px-2">
                        <span className="font-mono text-xs font-bold" style={{ color: s.rank <= 3 ? "#C4963A" : undefined }}>
                          #{s.rank}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <PixelAvatar studentId={s.id} size={28} />
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="text-xs text-muted-foreground">{cohort?.name ?? "—"}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className="font-mono text-sm font-bold" style={{ color: "#1A4040" }}>{s.sessionPoints.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {timeFilter === "improvers" && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Top Improvers — % gain this session</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium w-10">Rank</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Student</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Improvement</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Total Pts</th>
                </tr>
              </thead>
              <tbody>
                {improversRanked.map(s => (
                  <tr key={s.id} className="border-b border-border hover:bg-card transition-colors">
                    <td className="py-2.5 px-2">
                      <span className="font-mono text-xs font-bold">#{s.rank}</span>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <PixelAvatar studentId={s.id} size={28} />
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span
                        className="font-mono text-sm font-bold"
                        style={{ color: s.delta > 0 ? "#16a34a" : s.delta < 0 ? "#dc2626" : undefined }}
                      >
                        {s.delta > 0 ? "+" : ""}{s.delta}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="font-mono text-sm">{s.totalPoints.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TVMode({ students, session, intermission, setIntermission, onExit }: { students: Student[]; session: Session | undefined; intermission: boolean; setIntermission: (v: boolean) => void; onExit: () => void; }) {
  const ranked = [...students].sort((a, b) => b.totalPoints - a.totalPoints).map((s, i) => ({ ...s, rank: i + 1 }));
  const top3 = ranked.slice(0, 3);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#081A18",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="geo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <polygon points="40,0 80,20 80,60 40,80 0,60 0,20" fill="none" stroke="#C4963A" strokeWidth="0.8" />
            <polygon points="40,10 70,25 70,55 40,70 10,55 10,25" fill="none" stroke="#C4963A" strokeWidth="0.4" />
            <line x1="40" y1="0" x2="40" y2="80" stroke="#C4963A" strokeWidth="0.3" />
            <line x1="0" y1="40" x2="80" y2="40" stroke="#C4963A" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#geo)" />
      </svg>

      <div
        style={{
          height: "8%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          borderBottom: "1px solid rgba(196,150,58,0.2)",
          flexShrink: 0,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "#C4963A", fontSize: "1.25rem" }}>◆</span>
          <span style={{ fontFamily: "Lora, serif", fontSize: "1.5rem", color: "#E8D5A3", fontWeight: 600, letterSpacing: "0.02em" }}>
            Amal B'Ilm
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {session && (
            <span style={{ fontFamily: "Lora, serif", color: "#A8C5C5", fontSize: "1rem" }}>{session.title}</span>
          )}
          {session && (
            <span
              style={{
                background: "rgba(196,150,58,0.15)",
                border: "1px solid rgba(196,150,58,0.4)",
                color: "#C4963A",
                fontSize: "0.7rem",
                padding: "2px 10px",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {COHORTS.find(c => c.id === session?.cohortId)?.name ?? ""}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          height: "82%",
          display: "grid",
          gridTemplateColumns: "35% 65%",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            borderRight: "1px solid rgba(196,150,58,0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "1.5rem 1rem",
            gap: "1rem",
          }}
        >
          <div style={{ height: "50%", display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
            <HeroArch />
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p style={{ color: "#C4963A", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", marginBottom: "0.5rem" }}>
              Top Students
            </p>
            {top3.map(s => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  height: 70,
                  background: s.rank === 1 ? "rgba(196,150,58,0.12)" : "rgba(255,255,255,0.03)",
                  border: s.rank === 1 ? "1px solid rgba(196,150,58,0.3)" : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: s.rank === 1 ? "#C4963A" : "#5A7A7A",
                    width: 20,
                    flexShrink: 0,
                  }}
                >
                  #{s.rank}
                </span>
                <PixelAvatar studentId={s.id} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: s.rank === 1 ? "#E8D5A3" : "#A8C5C5", fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name}
                  </p>
                  <p style={{ fontFamily: "monospace", color: "#C4963A", fontSize: "1rem", fontWeight: 700 }}>
                    {s.totalPoints.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ overflow: "hidden", display: "flex", flexDirection: "column", padding: "1.5rem 1.5rem" }}>
          <p style={{ color: "#C4963A", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem", flexShrink: 0 }}>
            Full Rankings
          </p>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 0 }}>
            {ranked.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.35rem 0.75rem",
                  background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                  borderLeft: s.rank <= 3 ? "2px solid #C4963A" : "2px solid transparent",
                }}
              >
                <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: s.rank <= 3 ? "#C4963A" : "#3A6A6A", width: 24, flexShrink: 0, fontWeight: 700 }}>
                  {s.rank}
                </span>
                <PixelAvatar studentId={s.id} size={28} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: "#A8C5C5", fontSize: "0.8rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                    {s.name}
                  </span>
                  <span style={{ fontFamily: "monospace", color: "#5A7A7A", fontSize: "0.65rem" }}>{s.code}</span>
                </div>
                <span style={{ fontFamily: "monospace", color: "#E8D5A3", fontSize: "1rem", fontWeight: 700, flexShrink: 0 }}>
                  {s.totalPoints.toLocaleString()}
                </span>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {(s.badges ?? []).slice(0, 2).map(b => (
                    <BadgePill key={b} badgeId={b} compact />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          height: "10%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          background: "rgba(4,14,12,0.8)",
          borderTop: "1px solid rgba(196,150,58,0.15)",
          flexShrink: 0,
          position: "relative",
          zIndex: 2,
        }}
      >
        <span style={{ color: "#5A7A7A", fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>
          Season 3 · Falah 2026
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {[
            { label: "⏸ Intermission", onClick: () => setIntermission(true) },
            { label: "↻ Refresh", onClick: () => window.location.reload() },
            { label: "✕ Exit", onClick: onExit },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              style={{
                background: "#0E2A28",
                border: "1px solid rgba(196,150,58,0.3)",
                color: "#C4963A",
                fontSize: "0.75rem",
                padding: "0.35rem 0.85rem",
                cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 600,
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {intermission && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 110,
            background: "#040E0C",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
          }}
        >
          <div style={{ width: 200, height: 150 }}>
            <HeroArch />
          </div>
          <p style={{ fontFamily: "Lora, serif", fontSize: "3rem", color: "#C4963A", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
            عمل بعلم
          </p>
          <p style={{ fontFamily: "Lora, serif", fontSize: "1.5rem", color: "#E8D5A3", fontWeight: 400 }}>
            Amal B'Ilm
          </p>
          <span
            style={{
              background: "rgba(196,150,58,0.15)",
              border: "1px solid rgba(196,150,58,0.4)",
              color: "#C4963A",
              fontSize: "0.7rem",
              padding: "4px 14px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Break Time
          </span>
          <p style={{ color: "#3A6A6A", fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>
            Session resumes shortly
          </p>
          <button
            onClick={() => setIntermission(false)}
            style={{
              marginTop: "0.5rem",
              background: "#1A4040",
              border: "1px solid rgba(196,150,58,0.5)",
              color: "#C4963A",
              fontSize: "0.85rem",
              padding: "0.6rem 2rem",
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 700,
            }}
          >
            ▶ Resume
          </button>
        </div>
      )}
    </div>
  );
}

function StudentsScreen({ students, sessions, onNav, onTVMode }: ScreenProps) {
  const [cohortFilter, setCohortFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState<Student | null>(null);

  const [formName, setFormName] = React.useState("");
  const [formCode, setFormCode] = React.useState("");
  const [formCohort, setFormCohort] = React.useState(COHORTS[0]?.id ?? "");
  const [formNickname, setFormNickname] = React.useState("");

  const openAdd = () => {
    setEditingStudent(null);
    setFormName("");
    setFormCode("");
    setFormCohort(COHORTS[0]?.id ?? "");
    setFormNickname("");
    setAddOpen(true);
  };

  const openEdit = (s: Student) => {
    setAddOpen(false);
    setEditingStudent(s);
    setFormName(s.name);
    setFormCode(s.code);
    setFormCohort(s.cohortId);
    setFormNickname(s.kahootNickname ?? "");
  };

  const closePanel = () => {
    setAddOpen(false);
    setEditingStudent(null);
  };

  const panelOpen = addOpen || editingStudent !== null;

  const filtered = students.filter(s => {
    const cohortMatch = cohortFilter === "all" || s.cohortId === cohortFilter;
    const q = search.toLowerCase();
    const searchMatch = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    return cohortMatch && searchMatch;
  });

  const nameCounts: Record<string, number> = {};
  students.forEach(s => { nameCounts[s.name] = (nameCounts[s.name] ?? 0) + 1; });

  const ranked = [...students].sort((a, b) => b.totalPoints - a.totalPoints);
  const rankMap: Record<string, number> = {};
  ranked.forEach((s, i) => { rankMap[s.id] = i + 1; });

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title="Students">
        <button
          className="px-3 py-1.5 text-sm font-medium"
          style={{ background: "#1A4040", color: "#C4963A" }}
          onClick={openAdd}
        >
          + Add Student
        </button>
      </PageHeader>

      <div className="px-6 pt-4 pb-3 border-b border-border flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCohortFilter("all")}
            className="px-3 py-1 text-xs border transition-colors"
            style={{
              borderColor: cohortFilter === "all" ? "#1A4040" : undefined,
              background: cohortFilter === "all" ? "#1A4040" : undefined,
              color: cohortFilter === "all" ? "#C4963A" : undefined,
            }}
          >
            All
          </button>
          {COHORTS.map(c => (
            <button
              key={c.id}
              onClick={() => setCohortFilter(c.id)}
              className="px-3 py-1 text-xs border border-border transition-colors"
              style={{
                borderColor: cohortFilter === c.id ? "#1A4040" : undefined,
                background: cohortFilter === c.id ? "#1A4040" : undefined,
                color: cohortFilter === c.id ? "#C4963A" : undefined,
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by name or code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 text-sm border border-border bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-accent"
          style={{ borderRadius: 0 }}
        />
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className={`overflow-y-auto ${panelOpen ? "w-3/5" : "w-full"} transition-all`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card sticky top-0">
                <th className="text-left py-2.5 px-3 text-xs text-muted-foreground font-medium">Code</th>
                <th className="text-left py-2.5 px-3 text-xs text-muted-foreground font-medium">Name</th>
                <th className="text-left py-2.5 px-3 text-xs text-muted-foreground font-medium">Cohort</th>
                <th className="text-left py-2.5 px-3 text-xs text-muted-foreground font-medium">Kahoot Nick</th>
                <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">Att.</th>
                <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">Points</th>
                <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">Rank</th>
                <th className="text-left py-2.5 px-3 text-xs text-muted-foreground font-medium">Badges</th>
                <th className="text-right py-2.5 px-3 text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const cohort = COHORTS.find(c => c.id === s.cohortId);
                const dupName = nameCounts[s.name] > 1;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border hover:bg-card transition-colors"
                    style={{ background: editingStudent?.id === s.id ? "rgba(26,64,64,0.06)" : undefined }}
                  >
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-xs" style={{ color: "#1A4040" }}>{s.code}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <PixelAvatar studentId={s.id} size={28} />
                        <span className="text-sm font-medium">{s.name}</span>
                        {dupName && (
                          <span title="Duplicate name" className="text-yellow-500 text-xs">⚠</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs text-muted-foreground">{cohort?.name ?? "—"}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs text-muted-foreground font-mono">{s.kahootNickname ?? "—"}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-xs text-muted-foreground">{s.attendance}/{sessions.length}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-sm font-bold" style={{ color: "#1A4040" }}>{s.totalPoints.toLocaleString()}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-xs font-bold" style={{ color: "#C4963A" }}>#{rankMap[s.id]}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-1 flex-wrap">
                        {(s.badges ?? []).slice(0, 2).map(b => (
                          <BadgePill key={b} badgeId={b} compact />
                        ))}
                        {(s.badges ?? []).length > 2 && (
                          <span className="text-xs text-muted-foreground">+{(s.badges ?? []).length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        className="text-xs px-2 py-1 border border-border hover:border-accent transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(s)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-muted-foreground">No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {panelOpen && (
          <div
            className="w-2/5 border-l border-border bg-card overflow-y-auto flex flex-col"
            style={{ flexShrink: 0 }}
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ fontFamily: "Lora, serif", color: "#1A4040" }}>
                {addOpen ? "Add Student" : `Edit: ${editingStudent?.name}`}
              </h3>
              <button onClick={closePanel} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Display Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none focus:border-accent"
                  style={{ borderRadius: 0 }}
                  placeholder="e.g. Ahmad Al-Farsi"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Student Code</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={e => setFormCode(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none focus:border-accent font-mono"
                  style={{ borderRadius: 0 }}
                  placeholder="AB-009"
                />
                <p className="text-xs text-muted-foreground">Auto-assigned in production.</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Cohort</label>
                <select
                  value={formCohort}
                  onChange={e => setFormCohort(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none focus:border-accent"
                  style={{ borderRadius: 0 }}
                >
                  {COHORTS.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Kahoot Nickname <span className="font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={formNickname}
                  onChange={e => setFormNickname(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none focus:border-accent"
                  style={{ borderRadius: 0 }}
                  placeholder="e.g. Ahmad123"
                />
              </div>
              <div
                className="px-3 py-3 text-xs text-muted-foreground border border-border"
                style={{ background: "rgba(196,150,58,0.06)", borderRadius: 0 }}
              >
                Student codes are permanent unique identifiers. Use them to distinguish students with the same name.
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  className="px-4 py-2 text-sm font-medium"
                  style={{ background: "#1A4040", color: "#C4963A" }}
                  onClick={closePanel}
                >
                  Save
                </button>
                <button
                  className="px-4 py-2 text-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
                  onClick={closePanel}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionsScreen({ students, sessions, onNav, onTVMode }: ScreenProps) {
  const [cohortFilter, setCohortFilter] = React.useState<string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);

  const [fCohort, setFCohort] = React.useState(COHORTS[0]?.id ?? "");
  const [fNumber, setFNumber] = React.useState("");
  const [fTitle, setFTitle] = React.useState("");
  const [fDate, setFDate] = React.useState("");
  const [fPresenter, setFPresenter] = React.useState("");
  const [fNotes, setFNotes] = React.useState("");
  const [fKahoot, setFKahoot] = React.useState(true);
  const [fDeliverable, setFDeliverable] = React.useState(false);

  const openCreate = () => {
    setFCohort(COHORTS[0]?.id ?? "");
    setFNumber("");
    setFTitle("");
    setFDate("");
    setFPresenter("");
    setFNotes("");
    setFKahoot(true);
    setFDeliverable(false);
    setCreateOpen(true);
  };

  const filtered = sessions.filter(s =>
    cohortFilter === "all" || s.cohortId === cohortFilter
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader title="Sessions">
        <button
          className="px-3 py-1.5 text-sm font-medium"
          style={{ background: "#1A4040", color: "#C4963A" }}
          onClick={openCreate}
        >
          + New Session
        </button>
      </PageHeader>

      <div className="px-6 pt-4 pb-3 border-b border-border flex items-center gap-2">
        <button
          onClick={() => setCohortFilter("all")}
          className="px-3 py-1 text-xs border transition-colors"
          style={{
            borderColor: cohortFilter === "all" ? "#1A4040" : undefined,
            background: cohortFilter === "all" ? "#1A4040" : undefined,
            color: cohortFilter === "all" ? "#C4963A" : undefined,
          }}
        >
          All Cohorts
        </button>
        {COHORTS.map(c => (
          <button
            key={c.id}
            onClick={() => setCohortFilter(c.id)}
            className="px-3 py-1 text-xs border border-border transition-colors"
            style={{
              borderColor: cohortFilter === c.id ? "#1A4040" : undefined,
              background: cohortFilter === c.id ? "#1A4040" : undefined,
              color: cohortFilter === c.id ? "#C4963A" : undefined,
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {createOpen && (
          <div className="mx-6 mt-5 mb-2 border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ fontFamily: "Lora, serif", color: "#1A4040" }}>New Session</h3>
              <button onClick={() => setCreateOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Cohort</label>
                <select
                  value={fCohort}
                  onChange={e => setFCohort(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none"
                  style={{ borderRadius: 0 }}
                >
                  {COHORTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Session #</label>
                <input
                  type="number"
                  value={fNumber}
                  onChange={e => setFNumber(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none font-mono"
                  style={{ borderRadius: 0 }}
                  placeholder="14"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input
                  type="text"
                  value={fTitle}
                  onChange={e => setFTitle(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none"
                  style={{ borderRadius: 0 }}
                  placeholder="e.g. Sincerity in Action"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input
                  type="date"
                  value={fDate}
                  onChange={e => setFDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none"
                  style={{ borderRadius: 0 }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Presenter</label>
                <input
                  type="text"
                  value={fPresenter}
                  onChange={e => setFPresenter(e.target.value)}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none"
                  style={{ borderRadius: 0 }}
                  placeholder="Sheikh / Instructor name"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea
                  value={fNotes}
                  onChange={e => setFNotes(e.target.value)}
                  rows={3}
                  className="px-3 py-2 text-sm border border-border bg-background outline-none resize-none"
                  style={{ borderRadius: 0 }}
                  placeholder="Session notes, topics covered, references…"
                />
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Scoring Defaults</p>
                <div className="flex gap-5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fKahoot}
                      onChange={e => setFKahoot(e.target.checked)}
                      className="accent-accent"
                    />
                    Include Kahoot scoring
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fDeliverable}
                      onChange={e => setFDeliverable(e.target.checked)}
                      className="accent-accent"
                    />
                    Include deliverable
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                className="px-4 py-2 text-sm font-medium"
                style={{ background: "#1A4040", color: "#C4963A" }}
                onClick={() => setCreateOpen(false)}
              >
                Save
              </button>
              <button
                className="px-4 py-2 text-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-2 text-xs text-muted-foreground font-medium w-8">#</th>
                <th className="text-left py-2.5 px-2 text-xs text-muted-foreground font-medium">Title</th>
                <th className="text-left py-2.5 px-2 text-xs text-muted-foreground font-medium">Date</th>
                <th className="text-left py-2.5 px-2 text-xs text-muted-foreground font-medium">Presenter</th>
                <th className="text-left py-2.5 px-2 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-left py-2.5 px-2 text-xs text-muted-foreground font-medium">Kahoot</th>
                <th className="text-right py-2.5 px-2 text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-border hover:bg-card transition-colors">
                  <td className="py-2.5 px-2">
                    <span className="font-mono text-xs text-muted-foreground">{s.number}</span>
                  </td>
                  <td className="py-2.5 px-2">
                    <p className="text-sm font-medium">{s.title}</p>
                    {s.cohortId && (
                      <p className="text-xs text-muted-foreground">{COHORTS.find(c => c.id === s.cohortId)?.name}</p>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="text-xs text-muted-foreground font-mono">{fmtDate(s.date)}</span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="text-xs text-muted-foreground">{s.presenter ?? "—"}</span>
                  </td>
                  <td className="py-2.5 px-2">
                    <SessionStatusBadge status={s.status} />
                  </td>
                  <td className="py-2.5 px-2">
                    <KahoootStatusBadge status={s.kahootStatus} />
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="text-xs px-2.5 py-1 font-medium transition-colors border"
                        style={{ background: "#1A4040", color: "#C4963A", borderColor: "#1A4040" }}
                        onClick={() => onNav("scoring", { sessionId: s.id })}
                      >
                        Score
                      </button>
                      <button
                        className="text-xs px-2 py-1 border border-border text-muted-foreground hover:text-foreground transition-colors"
                        title="View notes"
                        onClick={() => onNav("session-detail", { sessionId: s.id })}
                      >
                        ↗
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">No sessions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
