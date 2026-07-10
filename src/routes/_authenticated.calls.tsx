import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Phone, Video, ExternalLink, Search, LayoutGrid, Table as TableIcon,
  Star, ChevronRight, CheckSquare, Square, Plus, X, Calendar, FileText,
} from "lucide-react";
import { signAvatars } from "@/lib/avatars";
import { CALL_NOTE_TEMPLATES } from "@/components/call-note-templates";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({ meta: [{ title: "1-on-1s — ISA" }] }),
  component: CallsPage,
});

type CallStatus = "scheduled" | "completed" | "no_show" | "follow_up" | "cancelled";
type ActionItem = { id: string; text: string; done: boolean; due?: string | null };
type Call = {
  id: string; student_id: string; coach_id: string | null;
  call_date: string; status: CallStatus; outcome: string | null;
  progress_rating: number | null; duration_min: number | null;
  fathom_url: string | null; coach_notes: string | null;
  action_items: string | null; action_items_json: ActionItem[] | null;
  next_step: string | null; next_call_date: string | null;
  created_at: string;
};
type Student = { id: string; full_name: string };
type Coach = { id: string; display_name: string | null; avatar_path: string | null };

const STATUS_META: Record<CallStatus, { label: string; color: string }> = {
  scheduled:  { label: "Scheduled",  color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  completed:  { label: "Completed",  color: "text-green-400 border-green-500/30 bg-green-500/10" },
  follow_up:  { label: "Follow-up",  color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  no_show:    { label: "No-show",    color: "text-red-400 border-red-500/30 bg-red-500/10" },
  cancelled:  { label: "Cancelled",  color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5" },
};
const KANBAN_COLS: CallStatus[] = ["scheduled", "completed", "follow_up", "no_show", "cancelled"];

function CallsPage() {
  const { user, roles } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("coach");

  const [calls, setCalls] = useState<Call[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [coachFilter, setCoachFilter] = useState<string>("all"); // all | mine | <coach_id>
  const [view, setView] = useState<"table" | "kanban">("table");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Call | null>(null);

  const load = async () => {
    const [cRes, sRes, roleRes] = await Promise.all([
      supabase.from("student_calls").select("*").order("call_date", { ascending: false }).limit(500),
      supabase.from("students").select("id, full_name").order("full_name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["coach", "admin"]),
    ]);
    setCalls((cRes.data ?? []) as Call[]);
    setStudents((sRes.data ?? []) as Student[]);
    const coachIds = Array.from(new Set((roleRes.data ?? []).map(r => r.user_id)));
    if (coachIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_path" as any)
        .in("id", coachIds);
      const list = ((profs ?? []) as any[]).map(p => ({
        id: p.id, display_name: p.display_name, avatar_path: p.avatar_path ?? null,
      })) as Coach[];
      setCoaches(list);
      setAvatarUrls(await signAvatars(list.map(c => c.avatar_path)));
    }
  };

  useEffect(() => { load(); }, []);

  const studentName = (id: string) => students.find(s => s.id === id)?.full_name ?? "Unknown";
  const coachName = (id: string | null) => id ? (coaches.find(c => c.id === id)?.display_name ?? id.slice(0, 8)) : "Unassigned";

  const filtered = useMemo(() => calls.filter(c => {
    if (coachFilter === "mine" && c.coach_id !== user?.id) return false;
    if (coachFilter !== "all" && coachFilter !== "mine" && c.coach_id !== coachFilter) return false;
    if (!q) return true;
    const s = studentName(c.student_id).toLowerCase();
    const n = (c.coach_notes ?? "").toLowerCase();
    return s.includes(q.toLowerCase()) || n.includes(q.toLowerCase());
  }), [calls, coachFilter, q, user, students, coaches]);

  const byStatus = useMemo(() => {
    const m = new Map<CallStatus, Call[]>();
    KANBAN_COLS.forEach(s => m.set(s, []));
    filtered.forEach(c => m.get(c.status)?.push(c));
    return m;
  }, [filtered]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter(c => c.status === "completed").length;
    const noShow = filtered.filter(c => c.status === "no_show").length;
    const followUp = filtered.filter(c => c.status === "follow_up").length;
    const openActions = filtered.reduce((n, c) => n + (c.action_items_json?.filter(a => !a.done).length ?? 0), 0);
    const ratings = filtered.map(c => c.progress_rating).filter((r): r is number => !!r);
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
    return { total, completed, noShow, followUp, openActions, avgRating };
  }, [filtered]);


  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-blue-400 mb-1">
            <Phone className="h-3 w-3" /> 1-on-1 tracker
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">1-on-1 Calls</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.total} calls · {stats.completed} done · {stats.followUp} follow-up · {stats.noShow} no-show · avg rating {stats.avgRating} · {stats.openActions} open action items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search student or notes…"
              className="h-8 pl-7 pr-3 rounded-sm border border-[#1f2530] bg-[#0f1116] text-xs w-56 focus:outline-none focus:border-green-500/40"
            />
          </div>
          <div className="flex items-center border border-[#1f2530] bg-[#0f1116] rounded-sm p-0.5">
            <button onClick={() => setView("table")} className={`px-2 py-1 rounded-sm ${view === "table" ? "bg-[#1a1f29]" : "text-muted-foreground"}`}><TableIcon className="h-3.5 w-3.5" /></button>
            <button onClick={() => setView("kanban")} className={`px-2 py-1 rounded-sm ${view === "kanban" ? "bg-[#1a1f29]" : "text-muted-foreground"}`}><LayoutGrid className="h-3.5 w-3.5" /></button>
          </div>
          {canManage && (
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-sm bg-green-500 hover:bg-green-400 text-green-950 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" /> Log call
            </button>
          )}
        </div>
      </header>

      {/* Coach chips */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          onClick={() => setCoachFilter("all")}
          className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm border ${coachFilter === "all" ? "text-foreground border-[#2a3140] bg-[#1a1f29]" : "text-muted-foreground border-[#1f2530]"}`}
        >All coaches · {calls.length}</button>
        <button
          onClick={() => setCoachFilter("mine")}
          className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm border ${coachFilter === "mine" ? "text-blue-400 border-blue-500/30 bg-blue-500/10" : "text-muted-foreground border-[#1f2530]"}`}
        >My calls · {calls.filter(c => c.coach_id === user?.id).length}</button>
        {coaches.map(c => (
          <button
            key={c.id}
            onClick={() => setCoachFilter(c.id)}
            className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider pl-1 pr-2.5 py-0.5 rounded-sm border ${coachFilter === c.id ? "text-sky-400 border-sky-500/30 bg-sky-500/10" : "text-muted-foreground border-[#1f2530]"}`}
          >
            <div className="h-5 w-5 rounded-sm bg-[#1a1f29] overflow-hidden flex items-center justify-center text-[9px] font-semibold shrink-0">
              {c.avatar_path && avatarUrls[c.avatar_path]
                ? <img src={avatarUrls[c.avatar_path]} alt="" className="h-full w-full object-cover" />
                : (c.display_name ?? "?").slice(0, 1).toUpperCase()}
            </div>
            {c.display_name ?? "Unnamed"} · {calls.filter(x => x.coach_id === c.id).length}
          </button>
        ))}
      </div>

      {view === "table" ? (
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-hidden">
          <div className="grid grid-cols-[0.7fr_1.3fr_1fr_0.9fr_0.9fr_0.7fr_auto] items-center px-4 py-2 border-b border-[#1f2530] text-[10px] uppercase tracking-widest text-muted-foreground gap-2">
            <span>Date</span><span>Student</span><span>Coach</span><span title="1–5 stars — how the student is progressing overall">Progress (1–5)</span><span title="Open action items / total">Action items</span><span>Fathom</span><span />
          </div>
          {filtered.length === 0 && <div className="p-8 text-center text-xs text-muted-foreground">No calls match your filters.</div>}
          {filtered.map(c => {
            const openA = c.action_items_json?.filter(a => !a.done).length ?? 0;
            const totalA = c.action_items_json?.length ?? 0;
            return (
              <div key={c.id} className="grid grid-cols-[0.7fr_1.3fr_1fr_0.9fr_0.9fr_0.7fr_auto] items-center gap-2 px-4 py-3 border-b border-[#1a1f29] last:border-0 hover:bg-[#14171e]">
                <span className="text-xs font-mono text-muted-foreground">{c.call_date}</span>
                <Link to={"/students/$id" as any} params={{ id: c.student_id } as any} className="text-sm truncate hover:text-green-400">
                  {studentName(c.student_id)}
                </Link>
                <span className="text-xs text-muted-foreground truncate">{coachName(c.coach_id)}</span>
                <span className="flex items-center gap-0.5 text-xs" title="Progress rating: 1 (stuck) – 5 (crushing it)">
                  {c.progress_rating ? Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-3 w-3 ${i < c.progress_rating! ? "fill-amber-400 text-amber-400" : "text-[#2a3140]"}`} />
                  )) : <span className="text-muted-foreground">—</span>}
                </span>
                <span className={`text-xs font-mono ${openA > 0 ? "text-amber-400" : "text-muted-foreground"}`} title="Open / total action items from this call">
                  {totalA ? `${totalA - openA}/${totalA} done` : "—"}
                </span>
                <span>
                  {c.fathom_url ? (
                    <a href={c.fathom_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-green-400 hover:text-green-300 text-[11px]">
                      <Video className="h-3 w-3" /> Open <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </span>
                <button onClick={() => setEditing(c)} className="text-muted-foreground hover:text-foreground p-1">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {KANBAN_COLS.map(col => {
            const items = byStatus.get(col) ?? [];
            const meta = STATUS_META[col];
            return (
              <div key={col} className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-2 min-h-[200px]">
                <div className={`flex items-center justify-between text-[10px] uppercase tracking-wider px-1 py-1 mb-2 rounded-sm ${meta.color}`}>
                  <span>{meta.label}</span>
                  <span className="font-mono">{items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map(c => {
                    const openA = c.action_items_json?.filter(a => !a.done).length ?? 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setEditing(c)}
                        className="w-full text-left p-2 rounded-sm bg-[#14171e] border border-[#1f2530] hover:border-[#2a3140]"
                      >
                        <div className="text-xs font-medium truncate">{studentName(c.student_id)}</div>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                          <span className="font-mono">{c.call_date}</span>
                          <span className="truncate ml-1">{coachName(c.coach_id).split(" ")[0]}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          {c.progress_rating && <span className="text-amber-400 flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400" />{c.progress_rating}</span>}
                          {openA > 0 && <span className="text-amber-400">{openA} open</span>}
                          {c.fathom_url && <Video className="h-2.5 w-2.5 text-green-400" />}
                        </div>
                      </button>
                    );
                  })}
                  {items.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-3">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <CallModal
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
          students={students}
          coaches={coaches}
          defaultCoachId={user?.id ?? null}
        />
      )}
      {editing && (
        <CallModal
          call={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          students={students}
          coaches={coaches}
          defaultCoachId={editing.coach_id}
        />
      )}
    </div>
  );
}

function CallModal({ call, onClose, onSaved, students, coaches, defaultCoachId }: {
  call?: Call; onClose: () => void; onSaved: () => void;
  students: Student[]; coaches: Coach[]; defaultCoachId: string | null;
}) {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const [form, setForm] = useState({
    student_id: call?.student_id ?? "",
    coach_id: call?.coach_id ?? defaultCoachId ?? "",
    call_date: call?.call_date ?? new Date().toISOString().slice(0, 10),
    status: (call?.status ?? "completed") as CallStatus,
    duration_min: call?.duration_min ?? 30,
    progress_rating: call?.progress_rating ?? 0,
    fathom_url: call?.fathom_url ?? "",
    outcome: call?.outcome ?? "",
    coach_notes: call?.coach_notes ?? "",
    next_step: call?.next_step ?? "",
    next_call_date: call?.next_call_date ?? "",
    items: (call?.action_items_json ?? []) as ActionItem[],
  });
  const [saving, setSaving] = useState(false);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: crypto.randomUUID(), text: "", done: false, due: null }] }));
  const updateItem = (id: string, patch: Partial<ActionItem>) =>
    setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const removeItem = (id: string) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));

  const save = async () => {
    if (!form.student_id) return toast.error("Pick a student");
    // Auto-derive status from date: future = scheduled, otherwise completed.
    // Preserve explicit no_show / cancelled / follow_up if already set on the record.
    const todayIso = new Date().toISOString().slice(0, 10);
    const preserved: CallStatus[] = ["no_show", "cancelled", "follow_up"];
    const derived: CallStatus = form.call_date > todayIso ? "scheduled" : "completed";
    const status: CallStatus = call && preserved.includes(call.status) ? call.status : derived;
    if (status === "completed" && (!form.progress_rating || form.progress_rating < 1)) {
      return toast.error("Set a 1–5 progress rating before saving a completed call.");
    }
    setSaving(true);
    const payload: any = {
      student_id: form.student_id,
      coach_id: form.coach_id || user?.id || null,
      call_date: form.call_date,
      status,
      duration_min: form.duration_min || null,
      progress_rating: form.progress_rating || null,
      fathom_url: form.fathom_url.trim() || null,
      outcome: form.outcome.trim() || null,
      coach_notes: form.coach_notes.trim() || null,
      next_step: form.next_step.trim() || null,
      next_call_date: form.next_call_date || null,
      action_items_json: form.items.filter(i => i.text.trim()),
    };
    const { error } = call
      ? await supabase.from("student_calls").update(payload).eq("id", call.id)
      : await supabase.from("student_calls").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(call ? "Call updated" : "Call logged");
    onSaved();
  };

  const del = async () => {
    if (!call || !confirm("Delete this call record?")) return;
    const { error } = await supabase.from("student_calls").delete().eq("id", call.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#0f1116] border border-[#1f2530] rounded-sm max-w-2xl w-full my-8 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#1f2530] pb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Phone className="h-4 w-4 text-blue-400" /> {call ? "Edit call" : "Log 1-on-1 call"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Student" full>
            <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} className={inputCls}>
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Coach">
            <select value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))} className={inputCls} disabled={!isAdmin && call !== undefined}>
              <option value="">Me</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.display_name ?? c.id}</option>)}
            </select>
          </Field>
          <Field label="Call date">
            <input type="date" value={form.call_date} onChange={e => setForm(f => ({ ...f, call_date: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Duration (min)">
            <input type="number" min={0} value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: parseInt(e.target.value) || 0 }))} className={inputCls} />
          </Field>
          <Field label="Progress rating (1 = stuck, 5 = crushing it)" full>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setForm(f => ({ ...f, progress_rating: f.progress_rating === n ? 0 : n }))}>
                  <Star className={`h-5 w-5 ${n <= form.progress_rating ? "fill-amber-400 text-amber-400" : "text-[#2a3140]"}`} />
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground ml-2">{form.progress_rating ? `${form.progress_rating}/5` : "not rated"}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">How the student is progressing overall — not just this call.</p>
          </Field>
          <Field label="Fathom recording URL" full>
            <input value={form.fathom_url} onChange={e => setForm(f => ({ ...f, fathom_url: e.target.value }))} placeholder="https://fathom.video/…" className={inputCls} />
          </Field>
          <Field label="Outcome / summary" full>
            <input value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} placeholder="One line summary" className={inputCls} />
          </Field>
          <Field label="Coach notes" full>
            <div className="flex items-center gap-1 flex-wrap mb-1">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><FileText className="h-2.5 w-2.5" /> Template:</span>
              {CALL_NOTE_TEMPLATES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, coach_notes: f.coach_notes ? `${f.coach_notes}\n\n${t.body}` : t.body }))}
                  className="text-[10px] px-1.5 py-0.5 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-muted-foreground hover:text-foreground hover:border-[#2a3140]"
                >{t.label}</button>
              ))}
            </div>
            <textarea value={form.coach_notes} onChange={e => setForm(f => ({ ...f, coach_notes: e.target.value }))} rows={6} placeholder="What was covered, personality, blockers…" className={inputCls + " h-auto py-2"} />
          </Field>

          <Field label="Action items" full>
            <div className="space-y-1.5">
              {form.items.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-[#0a0b0f] border border-[#1f2530] rounded-sm px-2 py-1.5">
                  <button type="button" onClick={() => updateItem(item.id, { done: !item.done })} className={item.done ? "text-green-400" : "text-muted-foreground"}>
                    {item.done ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                  <input
                    value={item.text}
                    onChange={e => updateItem(item.id, { text: e.target.value })}
                    placeholder="Action item…"
                    className={`flex-1 bg-transparent text-xs focus:outline-none ${item.done ? "line-through text-muted-foreground" : ""}`}
                  />
                  <input
                    type="date"
                    value={item.due ?? ""}
                    onChange={e => updateItem(item.id, { due: e.target.value || null })}
                    className="text-[10px] bg-transparent border border-[#1f2530] rounded-sm px-1 py-0.5 text-muted-foreground focus:outline-none"
                  />
                  <button type="button" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" /> Add action item
              </button>
            </div>
          </Field>

          <Field label="Next step for the student">
            <input value={form.next_step} onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))} placeholder="e.g. Post 3 reels + book 5 sales calls" className={inputCls} />
          </Field>
          <Field label="Next 1:1 date">
            <input type="date" value={form.next_call_date} onChange={e => setForm(f => ({ ...f, next_call_date: e.target.value }))} className={inputCls} />
          </Field>
        </div>

        <div className="flex justify-between gap-2 pt-3 border-t border-[#1f2530]">
          <div>
            {call && (
              <button onClick={del} className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5">Delete call</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
            <button onClick={save} disabled={saving} className="text-xs bg-green-500 hover:bg-green-400 text-green-950 font-medium px-3 py-1.5 rounded-sm">
              {saving ? "Saving…" : (call ? "Save changes" : "Log call")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-9 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs focus:outline-none focus:border-green-500/40";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
