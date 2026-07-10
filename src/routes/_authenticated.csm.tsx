import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  HeartHandshake, Search, StickyNote, Trash2, FileText, Video, MessageSquare,
  PhoneCall, AlertTriangle, Undo2, CheckCircle2, Circle, Clock, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { todayBiz } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/csm")({
  head: () => ({ meta: [{ title: "CSM — ISA Portal" }] }),
  component: CsmPage,
});

type Student = { id: string; full_name: string; email: string | null; phase: string; status: string; coach_id: string | null };
type CsmNote = {
  id: string; student_id: string; user_id: string; note: string; tags: string[] | null; created_at: string;
  student_name?: string; author?: string;
};
type TallyKind = "loom" | "roleplay" | "checkin" | "escalation";
type TallyRow = {
  id: string; user_id: string; kind: TallyKind;
  student_id: string | null; note: string | null; created_at: string;
};
type StudentCall = {
  id: string; student_id: string; call_date: string;
  action_items_json: unknown; next_call_date: string | null;
};
type ActionItem = { text: string; done: boolean };

type StudentEodLite = { student_id: string; report_date: string };
type AdHocItem = {
  id: string; student_id: string; text: string; done: boolean;
  due_date: string | null; created_at: string; created_by: string;
};

const KIND_META: Record<TallyKind, { label: string; icon: typeof Video; color: string; ring: string }> = {
  loom:       { label: "Loom reviewed",     icon: Video,          color: "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border-blue-500/30",         ring: "focus:ring-blue-400/40" },
  roleplay:   { label: "Roleplay reviewed", icon: MessageSquare,  color: "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border-blue-500/30", ring: "focus:ring-blue-400/40" },
  checkin:    { label: "Check-in done",     icon: PhoneCall,      color: "bg-green-500/10 text-green-300 hover:bg-green-500/20 border-green-500/30", ring: "focus:ring-green-400/40" },
  escalation: { label: "Escalation",        icon: AlertTriangle,  color: "bg-red-500/10 text-red-300 hover:bg-red-500/20 border-red-500/30",         ring: "focus:ring-red-400/40" },
};

const isToday = (iso: string) => iso.slice(0, 10) === todayBiz();

function CsmPage() {
  const { user, roles } = useAuth();
  const canUse = roles.includes("admin") || roles.includes("csm");
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<CsmNote[]>([]);
  const [tally, setTally] = useState<TallyRow[]>([]);
  const [calls, setCalls] = useState<StudentCall[]>([]);
  const [studentEods, setStudentEods] = useState<StudentEodLite[]>([]);
  const [adhoc, setAdhoc] = useState<AdHocItem[]>([]);
  const [newAdhocText, setNewAdhocText] = useState("");
  const [newAdhocDue, setNewAdhocDue] = useState("");
  const [savingAdhoc, setSavingAdhoc] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("progress, check-in");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Quick-tally note field (optional) for each button
  const [quickKind, setQuickKind] = useState<TallyKind | null>(null);
  const [quickNote, setQuickNote] = useState("");
  const [quickStudent, setQuickStudent] = useState("");

  const load = async () => {
    if (!user) return;
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const [studentsRes, notesRes, tallyRes, callsRes, sEodRes, adhocRes] = await Promise.all([
      supabase.from("students").select("id, full_name, email, phase, status, coach_id").order("full_name", { ascending: true }),
      supabase.from("csm_student_notes").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("csm_tally").select("*").eq("user_id", user.id).gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("student_calls").select("id, student_id, call_date, action_items_json, next_call_date").order("call_date", { ascending: false }).limit(600),
      supabase.from("student_eods").select("student_id, report_date").order("report_date", { ascending: false }).limit(1000),
      supabase.from("student_action_items").select("id, student_id, text, done, due_date, created_at, created_by").order("created_at", { ascending: false }).limit(500),
    ]);
    const studentRows = (studentsRes.data ?? []) as Student[];
    setStudents(studentRows);
    if (!studentId && studentRows[0]) setStudentId(studentRows[0].id);

    const noteRows = (notesRes.data ?? []) as CsmNote[];
    const userIds = Array.from(new Set(noteRows.map(n => n.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const names = new Map((profs ?? []).map(p => [p.id, p.display_name ?? "Unknown"]));
    const studentNames = new Map(studentRows.map(s => [s.id, s.full_name]));
    setNotes(noteRows.map(n => ({ ...n, author: names.get(n.user_id) ?? "Unknown", student_name: studentNames.get(n.student_id) ?? "Student" })));

    setTally((tallyRes.data ?? []) as TallyRow[]);
    setCalls((callsRes.data ?? []) as StudentCall[]);
    setStudentEods((sEodRes.data ?? []) as StudentEodLite[]);
    setAdhoc((adhocRes.data ?? []) as AdHocItem[]);
  };

  useEffect(() => { if (canUse) load(); /* eslint-disable-next-line */ }, [canUse, user]);

  const filteredStudents = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return students;
    return students.filter(s => s.full_name.toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q));
  }, [students, query]);

  const selected = students.find(s => s.id === studentId);
  const selectedNotes = notes.filter(n => n.student_id === studentId);

  // Today's tally counts
  const todayCounts = useMemo(() => {
    const c: Record<TallyKind, number> = { loom: 0, roleplay: 0, checkin: 0, escalation: 0 };
    tally.forEach(t => { if (isToday(t.created_at)) c[t.kind]++; });
    return c;
  }, [tally]);

  // Per-student accountability data
  const selectedCalls = useMemo(() => calls.filter(c => c.student_id === studentId), [calls, studentId]);
  const openActionItems = useMemo(() => {
    const items: Array<{ callId: string; index: number; text: string; done: boolean; call_date: string }> = [];
    selectedCalls.forEach(c => {
      const arr = Array.isArray(c.action_items_json) ? (c.action_items_json as ActionItem[]) : [];
      arr.forEach((it, idx) => {
        if (it && typeof it === "object") {
          items.push({ callId: c.id, index: idx, text: it.text ?? "", done: !!it.done, call_date: c.call_date });
        }
      });
    });
    return items;
  }, [selectedCalls]);
  const openCount = openActionItems.filter(i => !i.done).length;
  const lastStudentEod = useMemo(() => studentEods.find(e => e.student_id === studentId)?.report_date ?? null, [studentEods, studentId]);
  const studentLoomsReviewed = useMemo(() => tally.filter(t => t.student_id === studentId && t.kind === "loom"), [tally, studentId]);
  const studentRoleplaysReviewed = useMemo(() => tally.filter(t => t.student_id === studentId && t.kind === "roleplay"), [tally, studentId]);
  const selectedAdhoc = useMemo(
    () => adhoc.filter(a => a.student_id === studentId).sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)),
    [adhoc, studentId],
  );

  const addAdhoc = async () => {
    if (!user || !studentId || !newAdhocText.trim()) return;
    setSavingAdhoc(true);
    const { data, error } = await supabase
      .from("student_action_items")
      .insert({
        student_id: studentId,
        created_by: user.id,
        text: newAdhocText.trim(),
        due_date: newAdhocDue || null,
      })
      .select()
      .single();
    setSavingAdhoc(false);
    if (error) return toast.error(error.message);
    setAdhoc(prev => [data as AdHocItem, ...prev]);
    setNewAdhocText(""); setNewAdhocDue("");
    toast.success("Action item added");
  };

  const toggleAdhoc = async (it: AdHocItem) => {
    const next = !it.done;
    const { error } = await supabase
      .from("student_action_items")
      .update({ done: next, done_at: next ? new Date().toISOString() : null })
      .eq("id", it.id);
    if (error) return toast.error(error.message);
    setAdhoc(prev => prev.map(a => a.id === it.id ? { ...a, done: next } : a));
  };

  const deleteAdhoc = async (id: string) => {
    if (!confirm("Delete this action item?")) return;
    const { error } = await supabase.from("student_action_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAdhoc(prev => prev.filter(a => a.id !== id));
    toast.success("Deleted");
  };

  const addTally = async (kind: TallyKind, opts?: { student_id?: string | null; note?: string | null }) => {
    if (!user) return;
    const payload = {
      user_id: user.id, kind,
      student_id: opts?.student_id ?? null,
      note: opts?.note?.trim() || null,
    };
    const { data, error } = await supabase.from("csm_tally").insert(payload).select().single();
    if (error) return toast.error(error.message);
    setTally(prev => [data as TallyRow, ...prev]);
    toast.success(`+1 ${KIND_META[kind].label}`);
  };

  const undoLast = async (kind: TallyKind) => {
    if (!user) return;
    const last = tally.find(t => t.kind === kind && t.user_id === user.id && isToday(t.created_at));
    if (!last) return toast.error("Nothing to undo");
    const { error } = await supabase.from("csm_tally").delete().eq("id", last.id);
    if (error) return toast.error(error.message);
    setTally(prev => prev.filter(t => t.id !== last.id));
    toast.success("Undone");
  };

  const submitQuick = async () => {
    if (!quickKind) return;
    await addTally(quickKind, { student_id: quickStudent || null, note: quickNote });
    setQuickKind(null); setQuickNote(""); setQuickStudent("");
  };

  const submitCsmEod = async () => {
    if (!user) return;
    const today = todayBiz();
    const payload = {
      user_id: user.id,
      report_date: today,
      looms_reviewed: todayCounts.loom,
      roleplays_reviewed: todayCounts.roleplay,
      student_checkins: todayCounts.checkin,
      escalations_resolved: todayCounts.escalation,
      // zero out sales fields for CSM
      dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0,
      shows: 0, no_shows: 0, calls_taken: 0, closes: 0, deposits: 0,
      cash_collected: 0, deferred_cash: 0, follow_ups_done: 0,
      dials: 0, leads_contacted: 0,
      wins: `CSM day: ${todayCounts.loom} looms, ${todayCounts.roleplay} roleplays, ${todayCounts.checkin} check-ins, ${todayCounts.escalation} escalations`,
    };
    const { error } = await supabase.from("eods").upsert(payload, { onConflict: "user_id,report_date" });
    if (error) return toast.error(error.message);
    toast.success("EOD submitted → Team Reports ✓");
  };

  // NOTE: Action items are owned by the coach → student flow. Coaches set them
  // during 1:1 calls in /calls; the student ticks them off in their portal via
  // the student_toggle_action_item RPC. CSMs and staff view only, never toggle.

  const saveNote = async () => {
    if (!user || !studentId || !note.trim()) return;
    setSaving(true);
    const parsedTags = tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase.from("csm_student_notes").insert({ student_id: studentId, user_id: user.id, note: note.trim(), tags: parsedTags });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNote("");
    toast.success("CSM note saved");
    load();
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("csm_student_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Note deleted");
    load();
  };

  if (!canUse) return <div className="p-6 text-sm text-muted-foreground">CSM access required.</div>;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-amber-400 mb-1">
            <HeartHandshake className="h-3 w-3" /> Client success
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">CSM Workspace</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Tally today's work, chase accountability, log notes.</p>
        </div>
        <button onClick={submitCsmEod} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-green-500 hover:bg-green-400 text-green-950 text-xs font-medium">
          <FileText className="h-3.5 w-3.5" /> Submit to Team Reports
        </button>
      </header>

      {/* Daily tally */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Today's tally</div>
          <div className="text-[10px] text-muted-foreground">Uses today's tally counts</div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {(Object.keys(KIND_META) as TallyKind[]).map(k => {
            const M = KIND_META[k];
            const Icon = M.icon;
            const count = todayCounts[k];
            return (
              <div key={k} className={`relative border rounded-sm overflow-hidden ${M.color.split(" ").filter(c => c.startsWith("border-")).join(" ") || "border-[var(--border)]"}`}>
                <button
                  onClick={() => addTally(k)}
                  className={`w-full text-left p-4 transition ${M.color} ${M.ring} focus:outline-none focus:ring-2`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-4 w-4" />
                    <span className="text-2xl font-bold tabular-nums">{count}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium">{M.label}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">Tap +1 · today</div>
                </button>
                <div className="absolute top-1 right-1 flex gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setQuickKind(k); }}
                    className="p-1 rounded-sm hover:bg-white/10 text-current opacity-70 hover:opacity-100"
                    title="Add with student & note"
                  >
                    <StickyNote className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); undoLast(k); }}
                    className="p-1 rounded-sm hover:bg-white/10 text-current opacity-70 hover:opacity-100"
                    title="Undo last"
                  >
                    <Undo2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-4">
        <aside className="border border-[var(--border)] bg-[var(--card)] rounded-sm overflow-hidden">
          <div className="p-3 border-b border-[var(--border)]">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students…" className="w-full h-8 pl-8 pr-3 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-green-500/40" />
            </div>
          </div>
          <div className="max-h-[720px] overflow-auto divide-y divide-[var(--accent)]">
            {filteredStudents.map(s => (
              <button key={s.id} onClick={() => setStudentId(s.id)} className={`w-full text-left p-3 hover:bg-[var(--muted)] transition ${studentId === s.id ? "bg-amber-500/5 border-l-2 border-amber-400" : ""}`}>
                <div className="text-sm font-medium truncate">{s.full_name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{s.email ?? "no email"}</div>
                <div className="mt-1 flex gap-1">
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-[#2a3140] rounded-sm text-muted-foreground">{s.phase.replace("_", " ")}</span>
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-[#2a3140] rounded-sm text-muted-foreground">{s.status}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-4 min-w-0">
          {/* Accountability panel */}
          {selected && (
            <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm">
              <div className="p-4 border-b border-[var(--border)] flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400 mb-1">Accountability</div>
                  <h2 className="text-lg font-semibold">{selected.full_name}</h2>
                  <p className="text-[11px] text-muted-foreground">{selected.email ?? "no email"}</p>
                </div>
                <Link to={"/students/$id" as unknown as string} params={{ id: selected.id } as { id: string }} className="text-[11px] text-green-400 hover:text-green-300 shrink-0">Open tracker →</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)]">
                <AccountStat label="Open action items" value={openCount} tone={openCount > 0 ? "warn" : "ok"} />
                <AccountStat label="Last student EOD" value={lastStudentEod ?? "—"} tone={lastStudentEod && Date.now() - new Date(lastStudentEod).getTime() < 2 * 86400000 ? "ok" : "warn"} />
                <AccountStat label="Looms reviewed (14d)" value={studentLoomsReviewed.length} />
                <AccountStat label="Roleplays reviewed (14d)" value={studentRoleplaysReviewed.length} />
              </div>

              {/* Action items list — read-only. Only the student ticks these off in their portal. */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Action items from 1:1s</div>
                  <div className="text-[10px] text-muted-foreground italic">Student ticks off in their portal</div>
                </div>
                {openActionItems.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No action items logged from calls yet.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {openActionItems.map(it => (
                      <li key={it.callId + it.index} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0" aria-hidden>
                          {it.done
                            ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                            : <Circle className="h-4 w-4 text-muted-foreground" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${it.done ? "line-through text-muted-foreground" : ""}`}>{it.text || <em className="text-muted-foreground">(no text)</em>}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> from call on {it.call_date}{it.done ? " · ticked by student" : ""}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Ad-hoc action items — CSMs can add these directly */}
              <div className="p-4 border-t border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-blue-400">Ad-hoc action items</div>
                  <div className="text-[10px] text-muted-foreground italic">Assign anytime · outside of calls</div>
                </div>
                {selectedAdhoc.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No ad-hoc items for this student.</div>
                ) : (
                  <ul className="space-y-1.5 mb-3">
                    {selectedAdhoc.map(it => (
                      <li key={it.id} className="flex items-start gap-2">
                        <button
                          onClick={() => toggleAdhoc(it)}
                          className="mt-0.5 shrink-0 cursor-pointer"
                          aria-label={it.done ? "Mark not done" : "Mark done"}
                        >
                          {it.done
                            ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                            : <Circle className="h-4 w-4 text-muted-foreground hover:text-blue-400" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${it.done ? "line-through text-muted-foreground" : ""}`}>{it.text}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {it.due_date ? `due ${it.due_date}` : `added ${it.created_at.slice(0, 10)}`}
                          </div>
                        </div>
                        {(it.created_by === user?.id || roles.includes("admin")) && (
                          <button
                            onClick={() => deleteAdhoc(it.id)}
                            className="p-1 rounded-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-2">
                  <input
                    value={newAdhocText}
                    onChange={e => setNewAdhocText(e.target.value)}
                    placeholder="New action item…"
                    className="h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-blue-500/40"
                  />
                  <input
                    type="date"
                    value={newAdhocDue}
                    onChange={e => setNewAdhocDue(e.target.value)}
                    className="h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-blue-500/40"
                  />
                  <button
                    onClick={addAdhoc}
                    disabled={savingAdhoc || !newAdhocText.trim()}
                    className="h-8 px-3 rounded-sm bg-blue-500 hover:bg-blue-400 text-blue-950 text-xs font-medium disabled:opacity-40"
                  >
                    {savingAdhoc ? "…" : "Add"}
                  </button>
                </div>
              </div>



              {/* Recent loom/roleplay taps */}
              {(studentLoomsReviewed.length + studentRoleplaysReviewed.length) > 0 && (
                <div className="p-4 border-t border-[var(--border)]">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Recent submissions reviewed</div>
                  <div className="space-y-1 text-xs">
                    {[...studentLoomsReviewed, ...studentRoleplaysReviewed]
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .slice(0, 8)
                      .map(t => {
                        const Icon = KIND_META[t.kind].icon;
                        return (
                          <div key={t.id} className="flex items-center gap-2 text-muted-foreground">
                            <Icon className="h-3 w-3" />
                            <span className="capitalize">{t.kind}</span>
                            {t.note && <span className="text-foreground/80">· {t.note}</span>}
                            <span className="ml-auto text-[10px]">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes flow (unchanged) */}
          <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Add CSM note</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Add a student success note, risk signal, follow-up, accountability update…" className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-sm resize-none focus:outline-none focus:border-green-500/40" />
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tags, comma-separated" className="h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-green-500/40" />
              <button onClick={saveNote} disabled={saving || !note.trim() || !studentId} className="h-8 px-3 rounded-sm bg-green-500 hover:bg-green-400 text-green-950 text-xs font-medium disabled:opacity-40">
                {saving ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {selectedNotes.length === 0 && <div className="border border-dashed border-[var(--border)] rounded-sm p-6 text-center text-xs text-muted-foreground">No CSM notes for this student yet.</div>}
            {selectedNotes.map(n => (
              <div key={n.id} className="group border border-[var(--border)] bg-[var(--card)] rounded-sm p-3">
                <div className="flex items-start gap-2">
                  <StickyNote className="h-3.5 w-3.5 text-amber-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{n.note}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center text-[10px] text-muted-foreground">
                      {(n.tags ?? []).map(tag => <span key={tag} className="px-1.5 py-0.5 rounded-sm border border-amber-500/30 text-amber-400 uppercase tracking-wider">#{tag}</span>)}
                      <span className="ml-auto">{n.author} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                      {(n.user_id === user?.id || roles.includes("admin")) && (
                        <button onClick={() => deleteNote(n.id)} className="p-1 rounded-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="Delete note">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Quick-tally modal */}
      {quickKind && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setQuickKind(null)}>
          <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-sm p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">+1 {KIND_META[quickKind].label}</div>
              <button onClick={() => setQuickKind(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Student (optional)</label>
              <select value={quickStudent} onChange={e => setQuickStudent(e.target.value)} className="mt-1 w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-green-500/40">
                <option value="">— none —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note (optional)</label>
              <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} rows={3} className="mt-1 w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-sm resize-none focus:outline-none focus:border-green-500/40" placeholder="What was reviewed / said?" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setQuickKind(null)} className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs">Cancel</button>
              <button onClick={submitQuick} className="h-8 px-3 rounded-sm bg-green-500 hover:bg-green-400 text-green-950 text-xs font-medium">+1 & save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountStat({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" }) {
  const color = tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-green-400" : "text-foreground";
  return (
    <div className="bg-[var(--card)] p-3">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
