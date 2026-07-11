import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { studentsQuery, coachesQuery, studentCallsAggQuery, studentEodsAggQuery } from "@/lib/queries";
import { toast } from "sonner";
import {
  School, Search, Plus, LayoutGrid, Table as TableIcon, Trash2, X,
  ChevronRight, Users, AlertTriangle, Columns3, Award, MessageSquare, Trophy, Download,
} from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { DateField } from "@/components/ui/date-field";
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";



export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — ISA Team" }] }),
  component: StudentsLayout,
});

type Phase = "uncategorized" | "onboarding" | "coaching_1on1" | "applying" | "offer_won" | "testimonial" | "training" | "graduated" | "paused";
type Status = "active" | "inactive" | "ghosting";
type PaymentState = "paid_in_full" | "installments" | "behind";
type Student = {
  id: string; user_id: string | null; full_name: string; email: string | null;
  phase: Phase; status: Status; coach_id: string | null;
  join_date: string; calls_included: number; notes: string | null;
  student_grade: string | null; whatsapp: string | null; next_action: string | null;
  calls_allotted: number; payment_state: PaymentState | null;
  first_win_at: string | null; offer_landed_at: string | null;
  testimonial_collected: boolean; trustpilot_collected: boolean;
  created_at: string; updated_at: string;
};
type Coach = { id: string; display_name: string | null };

const PHASES: { key: Phase; label: string; color: string }[] = [
  { key: "uncategorized", label: "Uncategorized", color: "text-muted-foreground border-border bg-slate-500/5" },
  { key: "onboarding", label: "Onboarding", color: "text-muted-foreground border-border bg-muted" },
  { key: "coaching_1on1", label: "1:1 Coaching", color: "text-muted-foreground border-border bg-muted" },
  { key: "applying", label: "Applying", color: "text-success-fg border-success/25 bg-success-bg" },
  { key: "offer_won", label: "Offer Won", color: "text-warning-fg border-warning/25 bg-warning-bg" },
  { key: "testimonial", label: "Testimonial", color: "text-success-fg border-success/25 bg-success-bg" },
  { key: "paused", label: "Paused", color: "text-muted-foreground border-border bg-zinc-500/5" },
];
const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: "active", label: "Active", color: "text-success-fg border-success/25 bg-success-bg" },
  { key: "inactive", label: "Inactive", color: "text-muted-foreground border-border bg-zinc-500/5" },
  { key: "ghosting", label: "Ghosting", color: "text-danger-fg border-danger/25 bg-danger-bg" },
];
const PAYMENT_META: Record<PaymentState, { label: string; color: string }> = {
  paid_in_full: { label: "Paid", color: "text-success-fg border-success/25 bg-success-bg" },
  installments: { label: "Installments", color: "text-muted-foreground border-border bg-muted" },
  behind: { label: "Behind", color: "text-danger-fg border-danger/25 bg-danger-bg" },
};

const phaseMeta = (p: Phase) => PHASES.find(x => x.key === p) ?? PHASES[0];
const statusMeta = (s: Status) => STATUSES.find(x => x.key === s)!;

type ColKey = "student" | "grade" | "phase" | "status" | "coach" | "payment" | "calls_remaining" | "last_call" | "last_eod" | "next_action" | "badges";
type ColDef = { key: ColKey; label: string; default: boolean };
const COLUMNS: ColDef[] = [
  { key: "student",         label: "Student",         default: true },
  { key: "grade",           label: "Grade",           default: false },
  { key: "phase",           label: "Phase",           default: true },
  { key: "status",          label: "Status",          default: true },
  { key: "coach",           label: "Coach",           default: true },
  { key: "payment",         label: "Payment",         default: true },
  { key: "calls_remaining", label: "Calls left",      default: true },
  { key: "last_call",       label: "Last 1:1",        default: true },
  { key: "last_eod",        label: "Last EOD",        default: false },
  { key: "next_action",     label: "Next action",     default: false },
  { key: "badges",          label: "Badges",          default: false },
];


function StudentsLayout() {
  const { roles } = useAuth();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isDetail = /^\/students\/[^/]+/.test(pathname);
  const canManage = roles.includes("admin") || roles.includes("coach");

  const qc = useQueryClient();
  const { data: students = [], isLoading: studentsLoading } = useQuery(studentsQuery()) as { data: Student[]; isLoading: boolean };
  const { data: coaches = [] } = useQuery(coachesQuery()) as { data: Coach[] };
  const { data: callAgg } = useQuery(studentCallsAggQuery());
  const { data: eodAgg } = useQuery(studentEodsAggQuery());
  const lastCallByStudent = callAgg?.lastCall ?? {};
  const lastEodByStudent = eodAgg?.lastEod ?? {};
  const callsUsedByStudent = callAgg?.callsUsed ?? {};
  const apps7dByStudent = eodAgg?.apps7d ?? {};

  const [qRaw, setQ] = useState("");
  const q = useDebouncedValue(qRaw, 250);
  const [phaseFilter, setPhaseFilter] = useState<Phase | "all" | "at_risk">("all");
  const [view, setView] = useState<"table" | "kanban" | "graduation">("table");
  const [kanbanBy, setKanbanBy] = useState<"phase" | "coach">("phase");
  const [addOpen, setAddOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    try {
      const saved = localStorage.getItem("students.visibleCols");
      if (saved) return new Set(JSON.parse(saved) as ColKey[]);
    } catch {}
    return new Set(COLUMNS.filter(c => c.default).map(c => c.key));
  });
  const toggleCol = (k: ColKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      next.add("student");
      try { localStorage.setItem("students.visibleCols", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["students", "all"] });
    qc.invalidateQueries({ queryKey: ["student_calls", "agg"] });
    qc.invalidateQueries({ queryKey: ["student_eods", "agg"] });
  };


  const coachName = (id: string | null) => (id ? coaches.find(c => c.id === id)?.display_name ?? "—" : "Unassigned");

  const daysSince = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const atRiskInfo = (s: Student): { risky: boolean; reasons: string[] } => {
    const reasons: string[] = [];
    // Past coaching (offer won, testimonial) or dormant — not in the risk pool.
    if (!["onboarding", "coaching_1on1", "applying"].includes(s.phase)) return { risky: false, reasons };
    if (s.status === "ghosting") reasons.push("Ghosting");
    const lastEod = lastEodByStudent[s.id];
    const eodDays = lastEod ? daysSince(lastEod) : null;
    if (eodDays == null && s.phase !== "onboarding") {
      reasons.push("No EOD ever");
    } else if (eodDays != null && eodDays >= 5) {
      reasons.push(`No EOD ${eodDays}d`);
    }
    if (s.phase === "coaching_1on1") {
      const last = lastCallByStudent[s.id];
      const d = last ? daysSince(last) : null;
      if (d == null) reasons.push("No 1:1 yet");
      else if (d > 14) reasons.push(`No 1:1 ${d}d`);
    }
    const apps = apps7dByStudent[s.id] ?? 0;
    if (s.phase !== "onboarding" && apps === 0 && lastEod && daysSince(lastEod) < 7) {
      reasons.push("Low apps");
    }
    return { risky: reasons.length > 0, reasons };
  };
  // Precompute once per data change — atRiskInfo is called in filters and rows
  const riskByStudent = useMemo(() => {
    const m = new Map<string, { risky: boolean; reasons: string[] }>();
    students.forEach(s => m.set(s.id, atRiskInfo(s)));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, lastEodByStudent, lastCallByStudent, apps7dByStudent]);
  const isAtRisk = (s: Student) => riskByStudent.get(s.id)?.risky ?? false;

  const filtered = useMemo(() => students.filter(s => {
    const matchesQ = !q || s.full_name.toLowerCase().includes(q.toLowerCase()) || (s.email ?? "").toLowerCase().includes(q.toLowerCase());
    const matchesPhase =
      phaseFilter === "all" ? true :
      phaseFilter === "at_risk" ? isAtRisk(s) :
      s.phase === phaseFilter;
    return matchesQ && matchesPhase;
  }), [students, q, phaseFilter, lastCallByStudent, lastEodByStudent, apps7dByStudent]);

  const byPhase = useMemo(() => {
    const map = new Map<Phase, Student[]>();
    PHASES.forEach(p => map.set(p.key, []));
    filtered.forEach(s => map.get(s.phase)!.push(s));
    return map;
  }, [filtered]);

  const byCoach = useMemo(() => {
    const map = new Map<string, Student[]>();
    map.set("__unassigned__", []);
    coaches.forEach(c => map.set(c.id, []));
    filtered.forEach(s => {
      const k = s.coach_id ?? "__unassigned__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    });
    return map;
  }, [filtered, coaches]);

  const atRiskCount = students.filter(isAtRisk).length;


  // Under a detail path, hide the list UI and just render <Outlet />
  if (isDetail) return <Outlet />;

  const updateStudent = async (id: string, patch: Partial<Student>) => {
    const { error } = await supabase.from("students").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.setQueryData<Student[]>(["students", "all"], prev => (prev ?? []).map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const onDropToPhase = async (studentId: string, phase: Phase) => {
    await updateStudent(studentId, { phase });
    toast.success(`Moved to ${phaseMeta(phase).label}`);
  };

  const onDropToCoach = async (studentId: string, coachId: string | null) => {
    await updateStudent(studentId, { coach_id: coachId });
    toast.success(`Assigned to ${coachId ? coachName(coachId) : "Unassigned"}`);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Delete this student and all their data?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student deleted");
    invalidateAll();
  };



  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-5 mb-1">
        <div>
          <h1 className="text-display text-foreground">Students</h1>
          <p className="text-body text-muted-foreground mt-1">
            {filtered.length} shown · {students.length} total · {students.filter(s => s.phase === "coaching_1on1").length} in 1:1
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              value={qRaw}
              onChange={e => setQ(e.target.value)}
              placeholder="Search name or email…"
              className="h-8 pl-7 pr-3 rounded-sm border border-[var(--border)] bg-[var(--card)] text-xs w-56 focus:outline-none focus:border-ring"
            />
          </div>
          <div className="flex items-center border border-[var(--border)] bg-[var(--card)] rounded-sm p-0.5">
            <button onClick={() => setView("table")} className={`px-2 py-1 rounded-sm transition ${view === "table" ? "bg-[var(--accent)] text-foreground" : "text-muted-foreground"}`} title="Table">
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView("kanban")} className={`px-2 py-1 rounded-sm transition ${view === "kanban" ? "bg-[var(--accent)] text-foreground" : "text-muted-foreground"}`} title="Kanban">
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView("graduation")} className={`px-2 py-1 rounded-sm transition ${view === "graduation" ? "bg-[var(--accent)] text-warning-fg" : "text-muted-foreground"}`} title="Graduation pipeline">
              <Trophy className="h-3.5 w-3.5" />
            </button>
          </div>
          {view === "table" && (
            <div className="relative">
              <button onClick={() => setColsOpen(o => !o)} className="flex items-center gap-1 h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--card)] text-xs text-muted-foreground hover:text-foreground" title="Column visibility">
                <Columns3 className="h-3.5 w-3.5" />
              </button>
              {colsOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-52 border border-[var(--border)] bg-[var(--card)] rounded-sm shadow-lg p-2" onMouseLeave={() => setColsOpen(false)}>
                  <div className="text-[12px] text-muted-foreground px-1 pb-1.5 border-b border-[var(--border)]">Columns</div>
                  {COLUMNS.filter(c => c.key !== "student").map(c => (
                    <label key={c.key} className="flex items-center gap-2 px-1 py-1.5 text-xs hover:bg-[var(--muted)] rounded-sm cursor-pointer">
                      <Checkbox checked={visibleCols.has(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => exportToCsv("students.csv", filtered.map(s => ({
              name: s.full_name, email: s.email ?? "", status: s.status, phase: s.phase,
              join_date: s.join_date ?? "", coach: s.coach_id ?? "",
              testimonial: s.testimonial_collected ? "yes" : "no",
            })))}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-sm border border-[var(--border)] text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>

          {canManage && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Add student
            </button>
          )}
        </div>
      </header>

      {/* Phase filter chips */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          onClick={() => setPhaseFilter("all")}
          className={`text-[13px] font-medium px-3 py-1.5 rounded-md motion-safe:transition-colors ${
            phaseFilter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All · {students.length}
        </button>
        {PHASES.map(p => (
          <button
            key={p.key}
            onClick={() => setPhaseFilter(p.key)}
            className={`text-[13px] font-medium px-3 py-1.5 rounded-md motion-safe:transition-colors ${
              phaseFilter === p.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label} · {students.filter(s => s.phase === p.key).length}
          </button>
        ))}
        <button
          onClick={() => setPhaseFilter("at_risk")}
          className={`flex items-center gap-1 text-[13px] font-medium px-3 py-1.5 rounded-md motion-safe:transition-colors ${
            phaseFilter === "at_risk" ? "bg-danger-bg text-danger-fg dark:text-danger-fg" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> At risk · {atRiskCount}
        </button>

        {view === "kanban" && (
          <div className="ml-auto inline-flex rounded-lg bg-muted p-[3px]">
            <button onClick={() => setKanbanBy("phase")} className={`text-[13px] font-medium px-3 py-1.5 rounded-[8px] motion-safe:transition-colors ${kanbanBy === "phase" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>By phase</button>
            <button onClick={() => setKanbanBy("coach")} className={`flex items-center gap-1 text-[13px] font-medium px-3 py-1.5 rounded-[8px] motion-safe:transition-colors ${kanbanBy === "coach" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Users className="h-3.5 w-3.5" /> By coach
            </button>
          </div>
        )}
      </div>

      {view === "graduation" ? (
        <GraduationKanban students={filtered} />
      ) : view === "table" ? (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="text-[11px] text-muted-foreground bg-card sticky top-0">
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2 font-normal">Student</th>
                {visibleCols.has("grade") && <th className="text-left px-2 py-2 font-normal">Grade</th>}
                {visibleCols.has("phase") && <th className="text-left px-2 py-2 font-normal">Phase</th>}
                {visibleCols.has("status") && <th className="text-left px-2 py-2 font-normal">Status</th>}
                {visibleCols.has("coach") && <th className="text-left px-2 py-2 font-normal">Coach</th>}
                {visibleCols.has("payment") && <th className="text-left px-2 py-2 font-normal">Pay</th>}
                {visibleCols.has("calls_remaining") && <th className="text-right px-2 py-2 font-normal">Calls left</th>}
                {visibleCols.has("last_call") && <th className="text-right px-2 py-2 font-normal">Last 1:1</th>}
                {visibleCols.has("last_eod") && <th className="text-right px-2 py-2 font-normal">Last EOD</th>}
                {visibleCols.has("next_action") && <th className="text-left px-2 py-2 font-normal">Next action</th>}
                {visibleCols.has("badges") && <th className="text-left px-2 py-2 font-normal">Badges</th>}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="p-8 text-center text-xs text-muted-foreground">No students match your filters.</td></tr>
              )}
              {filtered.map(s => {
                const last = lastCallByStudent[s.id];
                const lastEod = lastEodByStudent[s.id];
                const used = callsUsedByStudent[s.id] ?? 0;
                const remaining = Math.max(0, s.calls_allotted - used);
                const info = riskByStudent.get(s.id) ?? { risky: false, reasons: [] };
                const showReasons = phaseFilter === "at_risk";
                return (
                  <tr key={s.id} className="border-b border-[var(--accent)] last:border-0 hover:bg-[var(--muted)] transition">
                    <td className="px-4 py-3 min-w-[220px]">
                      <Link to={"/students/$id" as any} params={{ id: s.id } as any} className="flex items-center gap-2 min-w-0">
                        {info.risky && <AlertTriangle className="h-3 w-3 text-danger-fg shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.full_name}</div>
                          <div className={`text-[10px] truncate flex items-center gap-1 ${s.email ? "text-muted-foreground" : "text-warning-fg"}`}>
                            {s.email ?? "⚠ No email — cannot auto-link login"}
                          </div>
                          {showReasons && info.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {info.reasons.map(r => (
                                <span key={r} className="text-[11px] bg-danger-bg text-danger-fg dark:text-danger-fg px-1.5 py-0.5 rounded-md">{r}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    {visibleCols.has("grade") && (
                      <td className="px-2 py-3">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${s.student_grade ? "bg-warning-bg text-warning-fg" : "bg-muted text-muted-foreground"}`}>
                          {s.student_grade ?? "—"}
                        </span>
                      </td>
                    )}
                    {visibleCols.has("phase") && (
                      <td className="px-2 py-3">
                        {canManage ? (
                          <SelectField value={s.phase} onChange={v => updateStudent(s.id, { phase: v as Phase })} options={PHASES.map(p => ({ value: p.key, label: p.label }))} className={`w-auto text-[12px] ${phaseMeta(s.phase).color}`} />
                        ) : (
                          <span className={`inline-flex items-center text-[12px] px-2 py-0.5 rounded-md border ${phaseMeta(s.phase).color}`}>{phaseMeta(s.phase).label}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("status") && (
                      <td className="px-2 py-3">
                        {canManage ? (
                          <SelectField value={s.status} onChange={v => updateStudent(s.id, { status: v as Status })} options={STATUSES.map(x => ({ value: x.key, label: x.label }))} className={`w-auto text-[12px] ${statusMeta(s.status).color}`} />
                        ) : (
                          <span className={`inline-flex items-center text-[12px] px-2 py-0.5 rounded-md border ${statusMeta(s.status).color}`}>{statusMeta(s.status).label}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("coach") && (
                      <td className="px-2 py-3">
                        {canManage ? (
                          <SelectField value={s.coach_id ?? ""} onChange={v => updateStudent(s.id, { coach_id: v || null })} options={coaches.map(c => ({ value: c.id, label: c.display_name ?? c.id }))} allowEmpty emptyLabel="Unassigned" placeholder="Unassigned" className="h-7 max-w-[140px]" />
                        ) : (
                          <span className="text-xs text-muted-foreground truncate">{coachName(s.coach_id)}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("payment") && (
                      <td className="px-2 py-3">
                        {s.payment_state ? (
                          <span className={`text-[12px] px-2 py-0.5 rounded-md border ${PAYMENT_META[s.payment_state].color}`}>{PAYMENT_META[s.payment_state].label}</span>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </td>
                    )}
                    {visibleCols.has("calls_remaining") && (
                      <td className={`px-2 py-3 text-right text-xs ${remaining === 0 ? "text-danger-fg" : "text-foreground"}`}>
                        {remaining}<span className="text-muted-foreground">/{s.calls_allotted}</span>
                      </td>
                    )}
                    {visibleCols.has("last_call") && (
                      <td className={`px-2 py-3 text-right text-[10px] ${last && daysSince(last) > 14 ? "text-danger-fg" : "text-muted-foreground"}`}>
                        {last ? `${daysSince(last)}d` : "—"}
                      </td>
                    )}
                    {visibleCols.has("last_eod") && (
                      <td className={`px-2 py-3 text-right text-[10px] ${lastEod && daysSince(lastEod) >= 5 ? "text-danger-fg" : "text-muted-foreground"}`}>
                        {lastEod ? `${daysSince(lastEod)}d` : "—"}
                      </td>
                    )}
                    {visibleCols.has("next_action") && (
                      <td className="px-2 py-3 min-w-[180px]">
                        {canManage ? (
                          <input
                            defaultValue={s.next_action ?? ""}
                            onBlur={e => { if (e.target.value !== (s.next_action ?? "")) updateStudent(s.id, { next_action: e.target.value.trim() || null }); }}
                            placeholder="—"
                            className="w-full h-7 px-2 rounded-sm border border-transparent hover:border-[var(--border)] focus:border-ring bg-transparent text-xs focus:outline-none"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{s.next_action ?? "—"}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("badges") && (
                      <td className="px-2 py-3">
                        <div className="flex gap-1">
                          <span title="Testimonial" className={s.testimonial_collected ? "text-warning-fg" : "text-[#2a3140]"}><Award className="h-3.5 w-3.5" /></span>
                          <span title="Trustpilot" className={s.trustpilot_collected ? "text-success-fg" : "text-[#2a3140]"}><MessageSquare className="h-3.5 w-3.5" /></span>
                        </div>
                      </td>
                    )}
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link to={"/students/$id" as any} params={{ id: s.id } as any} className="text-muted-foreground hover:text-foreground p-1">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                        {canManage && roles.includes("admin") && (
                          <button onClick={() => deleteStudent(s.id)} className="p-1 rounded hover:bg-danger-bg text-muted-foreground hover:text-danger-fg" title="Delete student">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : kanbanBy === "phase" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {PHASES.map(p => (
            <div
              key={p.key}
              onDragOver={e => { if (canManage) e.preventDefault(); }}
              onDrop={e => { const id = e.dataTransfer.getData("text/plain"); if (id && canManage) onDropToPhase(id, p.key); }}
              className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-2 min-h-[200px]"
            >
              <div className={`flex items-center justify-between text-[12px] font-medium px-2 py-1.5 mb-2 rounded-lg ${p.color}`}>
                <span>{p.label}</span>
                <span className="">{byPhase.get(p.key)!.length}</span>
              </div>
              <div className="space-y-1.5">
                {byPhase.get(p.key)!.map(s => (
                  <StudentCard key={s.id} s={s} canDrag={canManage} coachName={coachName(s.coach_id)} atRisk={isAtRisk(s)} />
                ))}
                {byPhase.get(p.key)!.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-3">Drop here</div>}
              </div>
            </div>
          ))}
        </div>

      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {["__unassigned__", ...coaches.map(c => c.id)].map(cid => (
            <div
              key={cid}
              onDragOver={e => { if (canManage) e.preventDefault(); }}
              onDrop={e => { const id = e.dataTransfer.getData("text/plain"); if (id && canManage) onDropToCoach(id, cid === "__unassigned__" ? null : cid); }}
              className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-2 min-h-[200px]"
            >
              <div className="flex items-center justify-between text-[12px] font-medium px-2 py-1.5 mb-2 rounded-lg text-primary bg-primary/10">
                <span className="truncate">{cid === "__unassigned__" ? "Unassigned" : coachName(cid)}</span>
                <span className="">{byCoach.get(cid)?.length ?? 0}</span>
              </div>
              <div className="space-y-1.5">
                {(byCoach.get(cid) ?? []).map(s => (
                  <StudentCard key={s.id} s={s} canDrag={canManage} coachName={phaseMeta(s.phase).label} atRisk={isAtRisk(s)} />
                ))}
                {(byCoach.get(cid)?.length ?? 0) === 0 && <div className="text-[10px] text-muted-foreground text-center py-3">Drop here</div>}
              </div>
            </div>
          ))}
        </div>
      )}


      {addOpen && <AddStudentModal onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); invalidateAll(); }} coaches={coaches} />}
    </div>
  );
}

function GraduationKanban({ students }: { students: Student[] }) {
  const stages = [
    { key: "first_win", label: "1. First win pending", color: "text-muted-foreground border-border bg-slate-500/5",
      match: (s: Student) => !s.first_win_at },
    { key: "offer", label: "2. Offer landing", color: "text-muted-foreground border-border bg-muted",
      match: (s: Student) => !!s.first_win_at && !s.offer_landed_at },
    { key: "testimonial", label: "3. Testimonial pending", color: "text-muted-foreground border-border bg-muted",
      match: (s: Student) => !!s.offer_landed_at && !s.testimonial_collected },
    { key: "trustpilot", label: "4. Trustpilot pending", color: "text-warning-fg border-warning/25 bg-warning-bg",
      match: (s: Student) => !!s.testimonial_collected && !s.trustpilot_collected },
    { key: "complete", label: "🏆 Complete", color: "text-success-fg border-success/25 bg-success-bg",
      match: (s: Student) => !!s.testimonial_collected && !!s.trustpilot_collected },
  ];
  const active = students.filter(s => s.status === "active" || (!!s.testimonial_collected && !!s.trustpilot_collected));
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {stages.map(st => {
        const inStage = active.filter(s => st.match(s));
        return (
          <div key={st.key} className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-2 min-h-[200px]">
            <div className={`flex items-center justify-between text-[12px] font-medium px-2 py-1.5 mb-2 rounded-lg border ${st.color}`}>
              <span className="truncate">{st.label}</span>
              <span className="">{inStage.length}</span>
            </div>
            <div className="space-y-1.5">
              {inStage.map(s => (
                <Link key={s.id} to={"/students/$id" as any} params={{ id: s.id } as any}
                  className="block p-2 rounded-sm bg-[var(--muted)] border border-[var(--border)] hover:border-[#2a3140]">
                  <div className="text-xs font-medium truncate">{s.full_name}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {s.first_win_at && <span title="First win" className="text-warning-fg text-[10px]">★</span>}
                    {s.offer_landed_at && <span title="Offer landed" className="text-muted-foreground"><Trophy className="h-3 w-3" /></span>}
                    {s.testimonial_collected && <span title="Testimonial"><Award className="h-3 w-3 text-muted-foreground" /></span>}
                    {s.trustpilot_collected && <span title="Trustpilot"><MessageSquare className="h-3 w-3 text-success-fg" /></span>}
                  </div>
                </Link>
              ))}
              {inStage.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-3">Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentCard({ s, canDrag, coachName, atRisk }: { s: Student; canDrag: boolean; coachName: string; atRisk: boolean }) {
  return (
    <Link
      to={"/students/$id" as any}
      params={{ id: s.id } as any}
      draggable={canDrag}
      onDragStart={e => e.dataTransfer.setData("text/plain", s.id)}
      className={`block p-2 rounded-sm bg-[var(--muted)] border transition cursor-pointer ${atRisk ? "border-danger/25 hover:border-danger/25" : "border-[var(--border)] hover:border-[#2a3140]"}`}
    >
      <div className="flex items-center gap-1.5">
        {atRisk && <AlertTriangle className="h-3 w-3 text-danger-fg shrink-0" />}
        <div className="text-xs font-medium truncate flex-1">{s.full_name}</div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[11px] px-1.5 py-0.5 rounded-md border ${statusMeta(s.status).color}`}>{statusMeta(s.status).label}</span>
        <span className="text-[9px] text-muted-foreground truncate ml-1">{coachName.slice(0, 14)}</span>
      </div>
    </Link>
  );
}



type Closer = { id: string; display_name: string | null };
type Setter = { id: string; display_name: string | null };
type ScheduleRow = { id: string; amount: string; due_date: string; payment_method: string };

function AddStudentModal({ onClose, onCreated, coaches }: { onClose: () => void; onCreated: () => void; coaches: Coach[] }) {
  const { user } = useAuth();
  const [closers, setClosers] = useState<Closer[]>([]);
  const [setters, setSetters] = useState<Setter[]>([]);

  // Basics
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [coachId, setCoachId] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");

  // Package
  const [pkg, setPkg] = useState<"one_on_one" | "group_only">("one_on_one");

  // Payment
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [payMode, setPayMode] = useState<"pif" | "installments" | "none">("pif");
  const [closerId, setCloserId] = useState<string>("");
  const [setterId, setSetterId] = useState<string>("");
  const [dealDate, setDealDate] = useState(new Date().toISOString().slice(0, 10));

  // Installments detail (even-split mode)
  const [scheduleMode, setScheduleMode] = useState<"even" | "custom">("even");
  const [depositAmount, setDepositAmount] = useState<string>("0");
  const [numInstallments, setNumInstallments] = useState<string>("3");
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10);
  });
  const [frequency, setFrequency] = useState<"monthly" | "biweekly" | "weekly">("monthly");

  // Installments detail (custom mode)
  const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };
  const [customRows, setCustomRows] = useState<ScheduleRow[]>(() => [
    { id: crypto.randomUUID(), amount: "", due_date: nextMonth(), payment_method: "" },
  ]);
  const addCustomRow = () => setCustomRows(rs => [...rs, { id: crypto.randomUUID(), amount: "", due_date: nextMonth(), payment_method: "" }]);
  const removeCustomRow = (id: string) => setCustomRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs);
  const updateCustomRow = (id: string, patch: Partial<ScheduleRow>) => setCustomRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));

  const [saving, setSaving] = useState(false);

  // Fetch closers (closer or admin) and setters (setter or admin)
  useEffect(() => {
    (async () => {
      const { data: roleRows } = await supabase.from("user_roles").select("user_id, role").in("role", ["closer", "admin", "setter"]);
      const closerIds = Array.from(new Set((roleRows ?? []).filter((r: any) => r.role === "closer" || r.role === "admin").map((r: any) => r.user_id)));
      const setterIds = Array.from(new Set((roleRows ?? []).filter((r: any) => r.role === "setter" || r.role === "admin").map((r: any) => r.user_id)));
      const allIds = Array.from(new Set([...closerIds, ...setterIds]));
      if (!allIds.length) return;
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", allIds);
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p as Setter]));
      setClosers(closerIds.map(id => byId.get(id) ?? { id, display_name: null }));
      setSetters(setterIds.map(id => byId.get(id) ?? { id, display_name: null }));
      if (user?.id && closerIds.includes(user.id)) setCloserId(user.id);
      else if (closerIds.length === 1) setCloserId(closerIds[0]);
    })();
  }, [user?.id]);

  const tv = Number(totalAmount) || 0;
  const dep = Number(depositAmount) || 0;
  const n = Math.max(1, Math.min(24, Number(numInstallments) || 0));
  const remaining = Math.max(0, tv - dep);
  const perInstallment = payMode === "installments" && n > 0 ? remaining / n : 0;
  const customTotal = customRows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const customDelta = tv - dep - customTotal;

  const submit = async () => {
    if (!fullName.trim()) return toast.error("Name required");
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return toast.error("Valid email required");
    if (payMode !== "none") {
      if (tv <= 0) return toast.error("Total amount must be > 0");
      if (!closerId) return toast.error("Pick who closed this deal");
      if (payMode === "installments") {
        if (dep > tv) return toast.error("Deposit cannot exceed total");
        if (scheduleMode === "even" && n < 1) return toast.error("At least 1 installment");
        if (scheduleMode === "custom") {
          const cleanRows = customRows.filter(r => Number(r.amount) > 0);
          if (cleanRows.length === 0) return toast.error("Add at least one payment row");
          if (cleanRows.some(r => !r.due_date)) return toast.error("Each payment row needs a due date");
        }
      }
    }

    setSaving(true);
    try {
      const paymentState: PaymentState | null =
        payMode === "pif" ? "paid_in_full" : payMode === "installments" ? "installments" : null;
      const callsAllotted = pkg === "one_on_one" ? 10 : 0;

      const { data: newStu, error: stuErr } = await supabase.from("students").insert({
        full_name: fullName.trim(),
        email: emailNorm,
        phase: "onboarding" as Phase,
        status: "active" as Status,
        coach_id: coachId || null,
        join_date: joinDate,
        calls_included: callsAllotted,
        calls_allotted: callsAllotted,
        whatsapp: whatsapp.trim() || null,
        notes: notes.trim() || null,
        payment_state: paymentState,
        source: source || null,
      } as any).select("id").single();
      if (stuErr) throw new Error("Student: " + stuErr.message);
      const studentId = newStu.id;

      // Deal
      if (payMode !== "none") {
        const cashUpfront = payMode === "pif" ? tv : dep;
        const paymentType = payMode === "pif" ? "pif" : dep > 0 ? "deposit" : "split";
        const { error: dealErr } = await supabase.from("deals").insert({
          student_id: studentId,
          student_name: fullName.trim(),
          closer_id: closerId,
          setter_id: setterId || null,
          program_type: pkg === "one_on_one" ? "1:1 Pathway" : "Group Coaching",
          total_value: tv,
          cash_collected_upfront: cashUpfront,
          payment_type: paymentType as any,
          deal_date: dealDate,
          created_by: user?.id ?? null,
          source: source || null,
        } as any);
        if (dealErr) throw new Error("Deal: " + dealErr.message);
      }

      // Installments plan + payments
      if (payMode === "installments") {
        const cleanCustom = customRows.filter(r => Number(r.amount) > 0);
        const planTotal = scheduleMode === "custom"
          ? cleanCustom.reduce((a, r) => a + Number(r.amount), 0)
          : remaining;

        if (planTotal > 0) {
          const { data: plan, error: planErr } = await supabase.from("installments").insert({
            student_id: studentId,
            student_name: fullName.trim(),
            closer_id: closerId,
            setter_id: setterId || null,
            coach_id: coachId || null,
            total_amount: planTotal,
            currency: "USD",
            created_by: user?.id ?? null,
          } as any).select("id").single();
          if (planErr) throw new Error("Installment plan: " + planErr.message);

          let rows: any[] = [];
          if (scheduleMode === "even" && n > 0) {
            const start = new Date(firstDueDate + "T00:00:00");
            rows = Array.from({ length: n }, (_, i) => {
              const due = new Date(start);
              if (frequency === "monthly") due.setMonth(start.getMonth() + i);
              else if (frequency === "biweekly") due.setDate(start.getDate() + i * 14);
              else due.setDate(start.getDate() + i * 7);
              return {
                installment_id: plan.id,
                sequence: i + 1,
                amount: perInstallment,
                currency: "USD",
                due_date: due.toISOString().slice(0, 10),
                status: "upcoming" as const,
              };
            });
          } else {
            rows = cleanCustom
              .slice()
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .map((r, i) => ({
                installment_id: plan.id,
                sequence: i + 1,
                amount: Number(r.amount),
                currency: "USD",
                due_date: r.due_date,
                status: "upcoming" as const,
                payment_method: r.payment_method.trim() || null,
              }));
          }
          if (rows.length) {
            const { error: payErr } = await supabase.from("installment_payments").insert(rows);
            if (payErr) throw new Error("Installment schedule: " + payErr.message);
          }
        }
      }

      toast.success("Student added → Students · deal & installments created");
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex p-4 overflow-y-auto" onClick={onClose}>
      <div className="m-auto bg-[var(--card)] border border-[var(--border)] rounded-sm max-w-2xl w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Add student</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Creates the student, logs the deal, and sets up their installment plan in one go.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* Section 1: Basics */}
        <Section title="1 · Student details">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" full>
              <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Email (required)">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="student@email.com" />
            </Field>
            <Field label="WhatsApp (optional)">
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className={inputCls} placeholder="+44…" />
            </Field>
            <Field label="Join date">
              <DateField value={joinDate} onChange={setJoinDate} clearable={false} />
            </Field>
            <Field label="Assigned coach">
              <SelectField value={coachId} onChange={(v) => setCoachId(v)} options={coaches.map((c) => ({ value: c.id, label: c.display_name ?? c.id }))} allowEmpty emptyLabel="Unassigned" placeholder="Unassigned" />
            </Field>
            <Field label="Lead source (optional)">
              <SelectField value={source} onChange={(v) => setSource(v)} options={[{ value: "Reel", label: "Reel" }, { value: "DM Outreach", label: "DM Outreach" }, { value: "Referral", label: "Referral" }, { value: "Cold Outreach", label: "Cold Outreach" }, { value: "Other", label: "Other" }]} allowEmpty emptyLabel="Unknown" placeholder="Unknown" />
            </Field>
          </div>
        </Section>

        {/* Section 2: Package */}
        <Section title="2 · Package">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPkg("one_on_one")}
              className={`text-left p-3 rounded-sm border transition ${pkg === "one_on_one" ? "border-border bg-muted" : "border-[var(--border)] hover:border-[#2a3140]"}`}
            >
              <div className="text-xs font-medium">1:1 Pathway</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Up to 10 coaching calls (2/week × 5 weeks) + group access</div>
            </button>
            <button
              type="button"
              onClick={() => setPkg("group_only")}
              className={`text-left p-3 rounded-sm border transition ${pkg === "group_only" ? "border-border bg-muted" : "border-[var(--border)] hover:border-[#2a3140]"}`}
            >
              <div className="text-xs font-medium">Group Coaching Only</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Group calls only, no 1:1s</div>
            </button>
          </div>
        </Section>

        {/* Section 3: Payment */}
        <Section title="3 · Payment">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["pif", "installments", "none"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setPayMode(m)}
                className={`p-2 rounded-sm border text-xs transition ${payMode === m ? "border-success/25 bg-success-bg text-success-fg" : "border-[var(--border)] text-muted-foreground hover:border-[#2a3140]"}`}
              >
                {m === "pif" ? "Paid in full" : m === "installments" ? "Installments" : "Skip for now"}
              </button>
            ))}
          </div>

          {payMode !== "none" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total amount ($)">
                <input type="number" min="0" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className={inputCls} placeholder="e.g. 5000" />
              </Field>
              <Field label="Deal date">
                <DateField value={dealDate} onChange={setDealDate} clearable={false} />
              </Field>
              <Field label="Closer (who sold this)">
                <SelectField value={closerId} onChange={(v) => setCloserId(v)} options={closers.map((c) => ({ value: c.id, label: c.display_name ?? c.id.slice(0, 8) }))} placeholder="— Select closer —" />
              </Field>
              <Field label="Setter (who booked the call)">
                <SelectField value={setterId} onChange={(v) => setSetterId(v)} options={setters.map((s) => ({ value: s.id, label: s.display_name ?? s.id.slice(0, 8) }))} allowEmpty emptyLabel="— None / unknown —" placeholder="— None / unknown —" />
              </Field>

              {payMode === "installments" && (
                <>
                  <Field label="Deposit / cash upfront ($)" full>
                    <input type="number" min="0" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className={inputCls} />
                  </Field>

                  <div className="col-span-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleMode("even")}
                      className={`flex-1 p-2 rounded-sm border text-xs transition ${scheduleMode === "even" ? "border-border bg-muted text-muted-foreground" : "border-[var(--border)] text-muted-foreground hover:border-[#2a3140]"}`}
                    >Split evenly</button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode("custom")}
                      className={`flex-1 p-2 rounded-sm border text-xs transition ${scheduleMode === "custom" ? "border-border bg-muted text-muted-foreground" : "border-[var(--border)] text-muted-foreground hover:border-[#2a3140]"}`}
                    >Custom schedule</button>
                  </div>

                  {scheduleMode === "even" && (
                    <>
                      <Field label="Number of installments" full={false}>
                        <input type="number" min="1" max="24" value={numInstallments} onChange={e => setNumInstallments(e.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Frequency">
                        <SelectField value={frequency} onChange={(v) => setFrequency(v as any)} options={[{ value: "monthly", label: "Monthly" }, { value: "biweekly", label: "Every 2 weeks" }, { value: "weekly", label: "Weekly" }]} />
                      </Field>
                      <Field label="First payment due" full>
                        <DateField value={firstDueDate} onChange={setFirstDueDate} clearable={false} />
                      </Field>
                      <div className="col-span-2 text-[11px] text-muted-foreground bg-[var(--background)] border border-[var(--border)] rounded-sm p-2">
                        {n} × ${perInstallment.toFixed(2)} = ${(n * perInstallment).toFixed(2)} remaining
                        {dep > 0 && <> · ${dep.toFixed(2)} upfront</>}
                        <> · total ${tv.toFixed(2)}</>
                      </div>
                    </>
                  )}

                  {scheduleMode === "custom" && (
                    <div className="col-span-2 space-y-2">
                      <div className="text-[13px] text-muted-foreground flex items-center justify-between">
                        <span>Scheduled payments</span>
                        <button type="button" onClick={addCustomRow} className="text-[10px] text-success-fg hover:text-success-fg">+ Add payment</button>
                      </div>
                      {customRows.map((r, i) => (
                        <div key={r.id} className="grid grid-cols-[24px_1fr_1.1fr_1fr_28px] gap-2 items-center">
                          <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                          <input type="number" min="0" step="0.01" value={r.amount} onChange={e => updateCustomRow(r.id, { amount: e.target.value })} placeholder="Amount" className={inputCls} />
                          <DateField value={r.due_date} onChange={v => updateCustomRow(r.id, { due_date: v })} clearable={false} />
                          <input value={r.payment_method} onChange={e => updateCustomRow(r.id, { payment_method: e.target.value })} placeholder="Method (optional)" className={inputCls} />
                          <button type="button" onClick={() => removeCustomRow(r.id)} disabled={customRows.length === 1} className="text-muted-foreground hover:text-danger-fg disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                      <div className={`text-[11px] rounded-sm p-2 border ${Math.abs(customDelta) < 0.01 ? "text-success-fg border-success/25 bg-success-bg" : "text-warning-fg border-warning/25 bg-warning-bg"}`}>
                        Scheduled ${customTotal.toFixed(2)}{dep > 0 ? ` + $${dep.toFixed(2)} upfront` : ""} = ${(customTotal + dep).toFixed(2)} of ${tv.toFixed(2)}
                        {Math.abs(customDelta) >= 0.01 && (
                          <span className="ml-1">· {customDelta > 0 ? `$${customDelta.toFixed(2)} unallocated` : `$${Math.abs(customDelta).toFixed(2)} over total`}</span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Section>

        <Field label="Internal notes (optional)" full>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
          <button onClick={submit} disabled={saving} className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 py-1.5 rounded-sm">
            {saving ? "Saving…" : "Add student"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-9 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs focus:outline-none focus:border-ring";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <label className="text-[13px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 pt-3 border-t border-[var(--border)] first:border-0 first:pt-0">
      <div className="text-[13px] font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
