import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  School, Search, Plus, LayoutGrid, Table as TableIcon, Trash2, X,
  ChevronRight, Users, AlertTriangle,
} from "lucide-react";



export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — ISA Team" }] }),
  component: StudentsLayout,
});

type Phase = "uncategorized" | "onboarding" | "coaching_1on1" | "training" | "graduated" | "paused";
type Status = "active" | "inactive" | "ghosting";
type Student = {
  id: string; user_id: string | null; full_name: string; email: string | null;
  phase: Phase; status: Status; coach_id: string | null;
  join_date: string; calls_included: number; notes: string | null;
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

const phaseMeta = (p: Phase) => PHASES.find(x => x.key === p)!;
const statusMeta = (s: Status) => STATUSES.find(x => x.key === s)!;

function StudentsLayout() {
  const { roles } = useAuth();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isDetail = /^\/students\/[^/]+/.test(pathname);
  const canManage = roles.includes("admin") || roles.includes("coach");

  const [students, setStudents] = useState<Student[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [lastCallByStudent, setLastCallByStudent] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<Phase | "all" | "at_risk">("all");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [kanbanBy, setKanbanBy] = useState<"phase" | "coach">("phase");
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    const [sRes, cRes, callRes] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role").in("role", ["coach", "admin"]),
      supabase.from("student_calls").select("student_id, call_date").order("call_date", { ascending: false }).limit(1000),
    ]);
    setStudents((sRes.data ?? []) as Student[]);
    const coachIds = Array.from(new Set((cRes.data ?? []).map(r => r.user_id)));
    if (coachIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", coachIds);
      setCoaches((profs ?? []) as Coach[]);
    }
    const map: Record<string, string> = {};
    (callRes.data ?? []).forEach((c: any) => { if (!map[c.student_id]) map[c.student_id] = c.call_date; });
    setLastCallByStudent(map);
  };

  useEffect(() => { load(); }, []);

  const coachName = (id: string | null) => (id ? coaches.find(c => c.id === id)?.display_name ?? "—" : "Unassigned");

  const daysSince = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const isAtRisk = (s: Student) => {
    if (s.status === "ghosting") return true;
    if (s.phase === "coaching_1on1") {
      const last = lastCallByStudent[s.id];
      if (!last || daysSince(last) > 14) return true;
    }
    return false;
  };

  const filtered = useMemo(() => students.filter(s => {
    const matchesQ = !q || s.full_name.toLowerCase().includes(q.toLowerCase()) || (s.email ?? "").toLowerCase().includes(q.toLowerCase());
    const matchesPhase =
      phaseFilter === "all" ? true :
      phaseFilter === "at_risk" ? isAtRisk(s) :
      s.phase === phaseFilter;
    return matchesQ && matchesPhase;
  }), [students, q, phaseFilter, lastCallByStudent]);

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
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
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
    load();
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
          </div>
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

      {view === "table" ? (
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.5fr_auto] items-center px-4 py-2 border-b border-[#1f2530] text-[10px] uppercase tracking-widest text-muted-foreground gap-2">
            <span>Student</span><span>Phase</span><span>Status</span><span>Coach</span><span>Last 1:1</span><span />
          </div>
          {filtered.length === 0 && <div className="p-8 text-center text-xs text-muted-foreground">No students match your filters.</div>}
          {filtered.map(s => {
            const last = lastCallByStudent[s.id];
            const risky = isAtRisk(s);
            return (
              <div key={s.id} className={`grid grid-cols-[1.4fr_1fr_1fr_1fr_0.5fr_auto] items-center gap-2 px-4 py-3 border-b border-[#1a1f29] last:border-0 hover:bg-[#14171e] transition`}>
                <Link to={"/students/$id" as any} params={{ id: s.id } as any} className="min-w-0 flex items-center gap-2">
                  {risky && <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.full_name}</div>
                    <div className={`text-[10px] truncate flex items-center gap-1 ${s.email ? "text-muted-foreground" : "text-amber-400"}`}>
                      {s.email ?? "⚠ No email — cannot auto-link login"}
                    </div>
                  </div>
                </Link>
                {canManage ? (
                  <select
                    value={s.phase}
                    onChange={e => updateStudent(s.id, { phase: e.target.value as Phase })}
                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border bg-transparent w-fit ${phaseMeta(s.phase).color}`}
                  >
                    {PHASES.map(p => <option key={p.key} value={p.key} className="bg-[#0f1116]">{p.label}</option>)}
                  </select>
                ) : (
                  <span className={`inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border w-fit ${phaseMeta(s.phase).color}`}>{phaseMeta(s.phase).label}</span>
                )}
                {canManage ? (
                  <select
                    value={s.status}
                    onChange={e => updateStudent(s.id, { status: e.target.value as Status })}
                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border bg-transparent w-fit ${statusMeta(s.status).color}`}
                  >
                    {STATUSES.map(x => <option key={x.key} value={x.key} className="bg-[#0f1116]">{x.label}</option>)}
                  </select>
                ) : (
                  <span className={`inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border w-fit ${statusMeta(s.status).color}`}>{statusMeta(s.status).label}</span>
                )}
                {canManage ? (
                  <select
                    value={s.coach_id ?? ""}
                    onChange={e => updateStudent(s.id, { coach_id: e.target.value || null })}
                    className="text-xs h-7 px-2 rounded-sm border border-[#1f2530] bg-transparent w-fit"
                  >
                    <option value="">Unassigned</option>
                    {coaches.map(c => <option key={c.id} value={c.id} className="bg-[#0f1116]">{c.display_name ?? c.id}</option>)}
                  </select>
                ) : (
                  <span className="text-xs text-muted-foreground truncate">{coachName(s.coach_id)}</span>
                )}
                <span className={`text-[10px] font-mono ${last && daysSince(last) > 14 ? "text-rose-400" : "text-muted-foreground"}`}>
                  {last ? `${daysSince(last)}d ago` : "—"}
                </span>
                <div className="flex items-center gap-1 justify-end">
                  <Link to={"/students/$id" as any} params={{ id: s.id } as any} className="text-muted-foreground hover:text-foreground p-1">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  {canManage && roles.includes("admin") && (
                    <button
                      onClick={() => deleteStudent(s.id)}
                      className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400"
                      title="Delete student"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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


      {addOpen && <AddStudentModal onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); load(); }} coaches={coaches} />}
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
    coach_id: "", join_date: new Date().toISOString().slice(0, 10), calls_included: 4, notes: "",
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
          <Field label="Calls included">
            <input type="number" min={0} value={form.calls_included} onChange={e => setForm(f => ({ ...f, calls_included: parseInt(e.target.value) || 0 }))} className={inputCls} />
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
