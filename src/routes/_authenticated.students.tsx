import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { studentsQuery, coachesQuery, studentCallsAggQuery, studentEodsAggQuery } from "@/lib/queries";
import { toast } from "sonner";
import {
  School, Search, Plus, LayoutGrid, Table as TableIcon, Trash2, X,
  ChevronRight, Users, AlertTriangle, Columns3, Award, MessageSquare, Trophy,
} from "lucide-react";



export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — ISA Team" }] }),
  component: StudentsLayout,
});

type Phase = "uncategorized" | "onboarding" | "coaching_1on1" | "training" | "graduated" | "paused";
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
  { key: "uncategorized", label: "Uncategorized", color: "text-slate-400 border-slate-500/30 bg-slate-500/5" },
  { key: "onboarding", label: "Onboarding", color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  { key: "coaching_1on1", label: "1:1 Coaching", color: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10" },
  { key: "training", label: "Training", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { key: "graduated", label: "Graduated", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { key: "paused", label: "Paused", color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5" },
];
const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: "active", label: "Active", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { key: "inactive", label: "Inactive", color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5" },
  { key: "ghosting", label: "Ghosting", color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
];
const PAYMENT_META: Record<PaymentState, { label: string; color: string }> = {
  paid_in_full: { label: "Paid", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  installments: { label: "Installments", color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  behind: { label: "Behind", color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
};

const phaseMeta = (p: Phase) => PHASES.find(x => x.key === p)!;
const statusMeta = (s: Status) => STATUSES.find(x => x.key === s)!;

type ColKey = "student" | "grade" | "phase" | "status" | "coach" | "payment" | "calls_remaining" | "last_call" | "last_eod" | "next_action" | "badges";
type ColDef = { key: ColKey; label: string; default: boolean };
const COLUMNS: ColDef[] = [
  { key: "student",         label: "Student",         default: true },
  { key: "grade",           label: "Grade",           default: true },
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
    if (s.status === "ghosting") reasons.push("Ghosting");
    const lastEod = lastEodByStudent[s.id];
    const eodDays = lastEod ? daysSince(lastEod) : null;
    if (eodDays == null && s.phase !== "onboarding" && s.phase !== "graduated" && s.phase !== "paused") {
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
    if (s.phase !== "onboarding" && s.phase !== "graduated" && s.phase !== "paused" && apps === 0 && lastEod && daysSince(lastEod) < 7) {
      reasons.push("Low apps");
    }
    return { risky: reasons.length > 0, reasons };
  };
  const isAtRisk = (s: Student) => atRiskInfo(s).risky;

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
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 mb-1">
            <School className="h-3 w-3" /> Student Tracker
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length} shown · {students.length} total · {students.filter(s => s.phase === "coaching_1on1").length} in 1:1
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search name or email…"
              className="h-8 pl-7 pr-3 rounded-sm border border-[#1f2530] bg-[#0f1116] text-xs w-56 focus:outline-none focus:border-emerald-500/40"
            />
          </div>
          <div className="flex items-center border border-[#1f2530] bg-[#0f1116] rounded-sm p-0.5">
            <button onClick={() => setView("table")} className={`px-2 py-1 rounded-sm transition ${view === "table" ? "bg-[#1a1f29] text-foreground" : "text-muted-foreground"}`} title="Table">
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView("kanban")} className={`px-2 py-1 rounded-sm transition ${view === "kanban" ? "bg-[#1a1f29] text-foreground" : "text-muted-foreground"}`} title="Kanban">
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView("graduation")} className={`px-2 py-1 rounded-sm transition ${view === "graduation" ? "bg-[#1a1f29] text-amber-400" : "text-muted-foreground"}`} title="Graduation pipeline">
              <Trophy className="h-3.5 w-3.5" />
            </button>
          </div>
          {view === "table" && (
            <div className="relative">
              <button onClick={() => setColsOpen(o => !o)} className="flex items-center gap-1 h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0f1116] text-xs text-muted-foreground hover:text-foreground" title="Column visibility">
                <Columns3 className="h-3.5 w-3.5" />
              </button>
              {colsOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-52 border border-[#1f2530] bg-[#0f1116] rounded-sm shadow-lg p-2" onMouseLeave={() => setColsOpen(false)}>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-1 pb-1.5 border-b border-[#1f2530]">Columns</div>
                  {COLUMNS.filter(c => c.key !== "student").map(c => (
                    <label key={c.key} className="flex items-center gap-2 px-1 py-1.5 text-xs hover:bg-[#14171e] rounded-sm cursor-pointer">
                      <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} className="accent-emerald-500" />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {canManage && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-medium"
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
          className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm border transition ${
            phaseFilter === "all" ? "text-foreground border-[#2a3140] bg-[#1a1f29]" : "text-muted-foreground border-[#1f2530]"
          }`}
        >
          All · {students.length}
        </button>
        {PHASES.map(p => (
          <button
            key={p.key}
            onClick={() => setPhaseFilter(p.key)}
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm border transition ${
              phaseFilter === p.key ? p.color : "text-muted-foreground border-[#1f2530] hover:border-[#2a3140]"
            }`}
          >
            {p.label} · {students.filter(s => s.phase === p.key).length}
          </button>
        ))}
        <button
          onClick={() => setPhaseFilter("at_risk")}
          className={`flex items-center gap-1 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm border transition ${
            phaseFilter === "at_risk" ? "text-rose-400 border-rose-500/30 bg-rose-500/10" : "text-muted-foreground border-[#1f2530] hover:border-rose-500/30"
          }`}
        >
          <AlertTriangle className="h-3 w-3" /> At risk · {atRiskCount}
        </button>

        {view === "kanban" && (
          <div className="ml-auto flex items-center border border-[#1f2530] bg-[#0f1116] rounded-sm p-0.5">
            <button onClick={() => setKanbanBy("phase")} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm ${kanbanBy === "phase" ? "bg-[#1a1f29] text-foreground" : "text-muted-foreground"}`}>By phase</button>
            <button onClick={() => setKanbanBy("coach")} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm flex items-center gap-1 ${kanbanBy === "coach" ? "bg-[#1a1f29] text-foreground" : "text-muted-foreground"}`}>
              <Users className="h-3 w-3" /> By coach
            </button>
          </div>
        )}
      </div>

      {view === "graduation" ? (
        <GraduationKanban students={filtered} />
      ) : view === "table" ? (
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0f1116] sticky top-0">
              <tr className="border-b border-[#1f2530]">
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
                const info = atRiskInfo(s);
                const showReasons = phaseFilter === "at_risk";
                return (
                  <tr key={s.id} className="border-b border-[#1a1f29] last:border-0 hover:bg-[#14171e] transition">
                    <td className="px-4 py-3 min-w-[220px]">
                      <Link to={"/students/$id" as any} params={{ id: s.id } as any} className="flex items-center gap-2 min-w-0">
                        {info.risky && <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.full_name}</div>
                          <div className={`text-[10px] truncate flex items-center gap-1 ${s.email ? "text-muted-foreground" : "text-amber-400"}`}>
                            {s.email ?? "⚠ No email — cannot auto-link login"}
                          </div>
                          {showReasons && info.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {info.reasons.map(r => (
                                <span key={r} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-rose-500/30 bg-rose-500/10 text-rose-400">{r}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    {visibleCols.has("grade") && (
                      <td className="px-2 py-3">
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${s.student_grade ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[#1f2530] text-muted-foreground"}`}>
                          {s.student_grade ?? "—"}
                        </span>
                      </td>
                    )}
                    {visibleCols.has("phase") && (
                      <td className="px-2 py-3">
                        {canManage ? (
                          <select value={s.phase} onChange={e => updateStudent(s.id, { phase: e.target.value as Phase })} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border bg-transparent ${phaseMeta(s.phase).color}`}>
                            {PHASES.map(p => <option key={p.key} value={p.key} className="bg-[#0f1116]">{p.label}</option>)}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${phaseMeta(s.phase).color}`}>{phaseMeta(s.phase).label}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("status") && (
                      <td className="px-2 py-3">
                        {canManage ? (
                          <select value={s.status} onChange={e => updateStudent(s.id, { status: e.target.value as Status })} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border bg-transparent ${statusMeta(s.status).color}`}>
                            {STATUSES.map(x => <option key={x.key} value={x.key} className="bg-[#0f1116]">{x.label}</option>)}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${statusMeta(s.status).color}`}>{statusMeta(s.status).label}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("coach") && (
                      <td className="px-2 py-3">
                        {canManage ? (
                          <select value={s.coach_id ?? ""} onChange={e => updateStudent(s.id, { coach_id: e.target.value || null })} className="text-xs h-7 px-2 rounded-sm border border-[#1f2530] bg-transparent max-w-[140px]">
                            <option value="">Unassigned</option>
                            {coaches.map(c => <option key={c.id} value={c.id} className="bg-[#0f1116]">{c.display_name ?? c.id}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground truncate">{coachName(s.coach_id)}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("payment") && (
                      <td className="px-2 py-3">
                        {s.payment_state ? (
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${PAYMENT_META[s.payment_state].color}`}>{PAYMENT_META[s.payment_state].label}</span>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </td>
                    )}
                    {visibleCols.has("calls_remaining") && (
                      <td className={`px-2 py-3 text-right font-mono text-xs ${remaining === 0 ? "text-rose-400" : "text-foreground"}`}>
                        {remaining}<span className="text-muted-foreground">/{s.calls_allotted}</span>
                      </td>
                    )}
                    {visibleCols.has("last_call") && (
                      <td className={`px-2 py-3 text-right text-[10px] font-mono ${last && daysSince(last) > 14 ? "text-rose-400" : "text-muted-foreground"}`}>
                        {last ? `${daysSince(last)}d` : "—"}
                      </td>
                    )}
                    {visibleCols.has("last_eod") && (
                      <td className={`px-2 py-3 text-right text-[10px] font-mono ${lastEod && daysSince(lastEod) >= 5 ? "text-rose-400" : "text-muted-foreground"}`}>
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
                            className="w-full h-7 px-2 rounded-sm border border-transparent hover:border-[#1f2530] focus:border-emerald-500/40 bg-transparent text-xs focus:outline-none"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{s.next_action ?? "—"}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("badges") && (
                      <td className="px-2 py-3">
                        <div className="flex gap-1">
                          <span title="Testimonial" className={s.testimonial_collected ? "text-amber-400" : "text-[#2a3140]"}><Award className="h-3.5 w-3.5" /></span>
                          <span title="Trustpilot" className={s.trustpilot_collected ? "text-emerald-400" : "text-[#2a3140]"}><MessageSquare className="h-3.5 w-3.5" /></span>
                        </div>
                      </td>
                    )}
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link to={"/students/$id" as any} params={{ id: s.id } as any} className="text-muted-foreground hover:text-foreground p-1">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                        {canManage && roles.includes("admin") && (
                          <button onClick={() => deleteStudent(s.id)} className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400" title="Delete student">
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
              className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-2 min-h-[200px]"
            >
              <div className={`flex items-center justify-between text-[10px] uppercase tracking-wider px-1 py-1 mb-2 rounded-sm ${p.color}`}>
                <span>{p.label}</span>
                <span className="font-mono">{byPhase.get(p.key)!.length}</span>
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
              className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-2 min-h-[200px]"
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider px-1 py-1 mb-2 rounded-sm text-sky-400 border-sky-500/30 bg-sky-500/10 border">
                <span className="truncate">{cid === "__unassigned__" ? "Unassigned" : coachName(cid)}</span>
                <span className="font-mono">{byCoach.get(cid)?.length ?? 0}</span>
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
    { key: "first_win", label: "1. First win pending", color: "text-slate-300 border-slate-500/30 bg-slate-500/5",
      match: (s: Student) => !s.first_win_at },
    { key: "offer", label: "2. Offer landing", color: "text-sky-400 border-sky-500/30 bg-sky-500/10",
      match: (s: Student) => !!s.first_win_at && !s.offer_landed_at },
    { key: "testimonial", label: "3. Testimonial pending", color: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10",
      match: (s: Student) => !!s.offer_landed_at && !s.testimonial_collected },
    { key: "trustpilot", label: "4. Trustpilot pending", color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      match: (s: Student) => !!s.testimonial_collected && !s.trustpilot_collected },
    { key: "complete", label: "🏆 Complete", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
      match: (s: Student) => !!s.testimonial_collected && !!s.trustpilot_collected },
  ];
  const active = students.filter(s => s.status === "active" || (!!s.testimonial_collected && !!s.trustpilot_collected));
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {stages.map(st => {
        const inStage = active.filter(s => st.match(s));
        return (
          <div key={st.key} className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-2 min-h-[200px]">
            <div className={`flex items-center justify-between text-[10px] uppercase tracking-wider px-1 py-1 mb-2 rounded-sm border ${st.color}`}>
              <span className="truncate">{st.label}</span>
              <span className="font-mono">{inStage.length}</span>
            </div>
            <div className="space-y-1.5">
              {inStage.map(s => (
                <Link key={s.id} to={"/students/$id" as any} params={{ id: s.id } as any}
                  className="block p-2 rounded-sm bg-[#14171e] border border-[#1f2530] hover:border-[#2a3140]">
                  <div className="text-xs font-medium truncate">{s.full_name}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {s.first_win_at && <span title="First win" className="text-amber-400 text-[10px]">★</span>}
                    {s.offer_landed_at && <span title="Offer landed" className="text-sky-400"><Trophy className="h-3 w-3" /></span>}
                    {s.testimonial_collected && <span title="Testimonial"><Award className="h-3 w-3 text-fuchsia-400" /></span>}
                    {s.trustpilot_collected && <span title="Trustpilot"><MessageSquare className="h-3 w-3 text-emerald-400" /></span>}
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
      className={`block p-2 rounded-sm bg-[#14171e] border transition cursor-pointer ${atRisk ? "border-rose-500/30 hover:border-rose-500/60" : "border-[#1f2530] hover:border-[#2a3140]"}`}
    >
      <div className="flex items-center gap-1.5">
        {atRisk && <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />}
        <div className="text-xs font-medium truncate flex-1">{s.full_name}</div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${statusMeta(s.status).color}`}>{statusMeta(s.status).label}</span>
        <span className="text-[9px] text-muted-foreground truncate ml-1">{coachName.slice(0, 14)}</span>
      </div>
    </Link>
  );
}



function AddStudentModal({ onClose, onCreated, coaches }: { onClose: () => void; onCreated: () => void; coaches: Coach[] }) {
  const [form, setForm] = useState({
    full_name: "", email: "", phase: "onboarding" as Phase, status: "active" as Status,
    coach_id: "", join_date: new Date().toISOString().slice(0, 10), calls_included: 10, notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.full_name.trim()) return toast.error("Name required");
    const email = form.email.trim().toLowerCase();
    if (!email) return toast.error("Email is required — it's how the student's login links to this record.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email address.");
    setSaving(true);
    const { error } = await supabase.from("students").insert({
      full_name: form.full_name.trim(),
      email,
      phase: form.phase,
      status: form.status,
      coach_id: form.coach_id || null,
      join_date: form.join_date,
      calls_included: form.calls_included,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Student added");
    onCreated();
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f1116] border border-[#1f2530] rounded-sm max-w-lg w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add student</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" full>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Email (required)" full>
            <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="Needed to auto-link their login" />
          </Field>
          <Field label="Phase">
            <select value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value as Phase }))} className={inputCls}>
              {PHASES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))} className={inputCls}>
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Assigned coach">
            <select value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))} className={inputCls}>
              <option value="">Unassigned</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.display_name ?? c.id}</option>)}
            </select>
          </Field>
          <Field label="Calls included (max 10)">
            <input type="number" min={0} max={10} value={form.calls_included} onChange={e => setForm(f => ({ ...f, calls_included: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)) }))} className={inputCls} />
          </Field>
          <Field label="Join date">
            <input type="date" value={form.join_date} onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Notes" full>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#1f2530]">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
          <button onClick={submit} disabled={saving} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium px-3 py-1.5 rounded-sm">
            {saving ? "Saving…" : "Add student"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-9 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs focus:outline-none focus:border-emerald-500/40";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
