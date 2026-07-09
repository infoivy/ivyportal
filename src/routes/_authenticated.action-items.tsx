import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ListChecks, AlertTriangle, User, Filter, Plus, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/action-items")({
  head: () => ({ meta: [{ title: "Action Items — ISA Team" }] }),
  component: ActionItemsHub,
});

type CallItem = { id?: string; text?: string; done?: boolean; due?: string | null; due_date?: string | null };
type CallRow = {
  id: string; student_id: string; coach_id: string | null; call_date: string;
  action_items_json: CallItem[] | null;
};
type AdHocRow = {
  id: string; student_id: string; created_by: string; assignee_id: string | null;
  text: string; due_date: string | null; done: boolean; done_at: string | null;
  created_at: string;
};
type Row = {
  key: string;
  source: "call" | "adhoc";
  callId?: string; index?: number; adhocId?: string;
  text: string; done: boolean; due: string | null;
  studentId: string; studentName: string;
  ownerId: string | null; ownerName: string; ownerLabel: string;
  refDate: string;
  canDelete: boolean;
};

type Filt = "all" | "mine" | "overdue" | "open";

function ActionItemsHub() {
  const { user, roles } = useAuth();
  const isStaff =
    roles.includes("admin") || roles.includes("coach") || roles.includes("csm") ||
    roles.includes("closer") || roles.includes("setter");
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [adhoc, setAdhoc] = useState<AdHocRow[]>([]);
  const [students, setStudents] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filt, setFilt] = useState<Filt>("open");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Create form
  const [addOpen, setAddOpen] = useState(false);
  const [newStudent, setNewStudent] = useState("");
  const [newText, setNewText] = useState("");
  const [newDue, setNewDue] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    const [cRes, aRes, sRes, pRes] = await Promise.all([
      supabase.from("student_calls").select("id, student_id, coach_id, call_date, action_items_json").order("call_date", { ascending: false }).limit(2000),
      supabase.from("student_action_items").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("students").select("id, full_name"),
      supabase.from("profiles").select("id, display_name"),
    ]);
    setCalls((cRes.data ?? []) as CallRow[]);
    setAdhoc((aRes.data ?? []) as AdHocRow[]);
    const sm: Record<string, string> = {}; (sRes.data ?? []).forEach((s: { id: string; full_name: string }) => { sm[s.id] = s.full_name; }); setStudents(sm);
    const pm: Record<string, string> = {}; (pRes.data ?? []).forEach((p: { id: string; display_name: string | null }) => { pm[p.id] = p.display_name ?? "Unknown"; }); setProfiles(pm);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const studentList = useMemo(
    () => Object.entries(students).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const c of calls) {
      const items = Array.isArray(c.action_items_json) ? c.action_items_json : [];
      items.forEach((it, i) => {
        out.push({
          key: `call-${c.id}-${i}`,
          source: "call",
          callId: c.id, index: i,
          text: it.text ?? "",
          done: !!it.done,
          due: it.due ?? it.due_date ?? null,
          studentId: c.student_id,
          studentName: students[c.student_id] ?? "Unknown",
          ownerId: c.coach_id,
          ownerName: c.coach_id ? (profiles[c.coach_id] ?? "—") : "Unassigned",
          ownerLabel: "Coach",
          refDate: c.call_date,
          canDelete: false,
        });
      });
    }
    for (const a of adhoc) {
      out.push({
        key: `adhoc-${a.id}`,
        source: "adhoc",
        adhocId: a.id,
        text: a.text,
        done: a.done,
        due: a.due_date,
        studentId: a.student_id,
        studentName: students[a.student_id] ?? "Unknown",
        ownerId: a.created_by,
        ownerName: profiles[a.created_by] ?? "—",
        ownerLabel: "Assigned by",
        refDate: a.created_at.slice(0, 10),
        canDelete: a.created_by === user?.id || roles.includes("admin"),
      });
    }
    return out;
  }, [calls, adhoc, students, profiles, user, roles]);

  const isOverdue = (r: Row) => !r.done && r.due && r.due < today;

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (ownerFilter === "mine" && r.ownerId !== user?.id) return false;
      if (ownerFilter !== "all" && ownerFilter !== "mine" && r.ownerId !== ownerFilter) return false;
      if (filt === "mine" && r.ownerId !== user?.id) return false;
      if (filt === "overdue" && !isOverdue(r)) return false;
      if (filt === "open" && r.done) return false;
      return true;
    }).sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ad = a.due ?? "9999", bd = b.due ?? "9999";
      if (ad !== bd) return ad.localeCompare(bd);
      return b.refDate.localeCompare(a.refDate);
    });
  }, [rows, filt, ownerFilter, user, today]);

  const uniqueOwners = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => { if (r.ownerId) map.set(r.ownerId, r.ownerName); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const counts = useMemo(() => ({
    open: rows.filter(r => !r.done).length,
    mine: rows.filter(r => !r.done && r.ownerId === user?.id).length,
    overdue: rows.filter(r => isOverdue(r)).length,
    all: rows.length,
  }), [rows, user, today]);

  const submitAdhoc = async () => {
    if (!user || !newStudent || !newText.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("student_action_items").insert({
      student_id: newStudent,
      created_by: user.id,
      text: newText.trim(),
      due_date: newDue || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Action item added");
    setNewText(""); setNewDue(""); setAddOpen(false);
    load();
  };

  const toggleAdhoc = async (r: Row) => {
    if (!r.adhocId) return;
    const next = !r.done;
    const { error } = await supabase
      .from("student_action_items")
      .update({ done: next, done_at: next ? new Date().toISOString() : null })
      .eq("id", r.adhocId);
    if (error) return toast.error(error.message);
    setAdhoc(prev => prev.map(a => a.id === r.adhocId ? { ...a, done: next, done_at: next ? new Date().toISOString() : null } : a));
  };

  const deleteAdhoc = async (id: string) => {
    if (!confirm("Delete this action item?")) return;
    const { error } = await supabase.from("student_action_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setAdhoc(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 mb-1">
            <ListChecks className="h-3 w-3" /> Action Items Hub
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Open action items</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Coaches log items in <span className="text-foreground">/calls</span>; staff can add ad-hoc ones here anytime.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="text-[11px] font-mono text-muted-foreground">
            {counts.open} open <span className="mx-1">·</span> <span className="text-rose-400">{counts.overdue} overdue</span>
          </div>
          {isStaff && (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-fuchsia-950 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Add ad-hoc item
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 items-center">
        {(["open", "all", "mine", "overdue"] as Filt[]).map(k => (
          <button
            key={k}
            onClick={() => setFilt(k)}
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm border transition ${
              filt === k
                ? k === "overdue" ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
                : "text-foreground border-[#2a3140] bg-[#1a1f29]"
                : "text-muted-foreground border-[#1f2530] hover:border-[#2a3140]"
            }`}
          >
            {k === "open" ? `Open · ${counts.open}` : k === "mine" ? `Mine · ${counts.mine}` : k === "overdue" ? `Overdue · ${counts.overdue}` : `All · ${counts.all}`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            className="text-[11px] h-7 px-2 rounded-sm border border-[#1f2530] bg-[#0f1116]"
          >
            <option value="all">All owners</option>
            <option value="mine">My items</option>
            {uniqueOwners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
      </div>

      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-hidden">
        <div className="grid grid-cols-[24px_minmax(0,1fr)_140px_120px_90px_28px] gap-2 px-3 py-2 border-b border-[#1f2530] text-[10px] uppercase tracking-widest text-muted-foreground">
          <span />
          <span>Item</span>
          <span>Student</span>
          <span>Owner</span>
          <span className="text-right">Due</span>
          <span />
        </div>
        {loading && <div className="p-8 text-center text-xs text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">Nothing here. Nice.</div>
        )}
        {filtered.map(r => {
          const overdue = isOverdue(r);
          return (
            <div
              key={r.key}
              className="grid grid-cols-[24px_minmax(0,1fr)_140px_120px_90px_28px] gap-2 items-center px-3 py-2.5 border-b border-[#1a1f29] last:border-0 hover:bg-[#14171e]"
              title={r.source === "call" ? "From 1:1 call — student ticks off in portal" : "Ad-hoc — staff or student can tick off"}
            >
              <input
                type="checkbox"
                checked={r.done}
                onChange={() => r.source === "adhoc" && toggleAdhoc(r)}
                disabled={r.source === "call"}
                aria-label={r.done ? "Done" : "Open"}
                className={`h-4 w-4 accent-emerald-500 ${r.source === "call" ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
              />
              <div className="min-w-0">
                <div className={`text-xs flex items-center gap-1.5 ${r.done ? "line-through text-muted-foreground" : ""}`}>
                  {r.source === "adhoc" && <Sparkles className="h-3 w-3 text-fuchsia-400 shrink-0" />}
                  <span className="truncate">{r.text || <span className="italic text-muted-foreground">(no text)</span>}</span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {r.source === "call" ? `from call ${r.refDate}` : `ad-hoc · ${r.refDate}`}
                  {r.done ? " · ticked" : ""}
                </div>
              </div>
              <Link to="/students/$id" params={{ id: r.studentId }} className="text-xs truncate hover:text-emerald-400 flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" /> {r.studentName}
              </Link>
              <span className="text-xs text-muted-foreground truncate" title={r.ownerLabel}>{r.ownerName}</span>
              <span className={`text-[11px] font-mono text-right ${overdue ? "text-rose-400" : r.due ? "text-muted-foreground" : "text-[#2a3140]"}`}>
                {r.due ? (overdue ? <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{r.due}</span> : r.due) : "—"}
              </span>
              <span className="flex justify-end">
                {r.canDelete && r.adhocId && (
                  <button
                    onClick={() => deleteAdhoc(r.adhocId!)}
                    className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Add ad-hoc modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md bg-[#0f1116] border border-[#1f2530] rounded-sm p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold">Add ad-hoc action item</div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Student</label>
              <select
                value={newStudent}
                onChange={e => setNewStudent(e.target.value)}
                className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40"
              >
                <option value="">— Select student —</option>
                {studentList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Action item</label>
              <textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                rows={3}
                placeholder="e.g. Send updated resume by Friday"
                className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-sm resize-none focus:outline-none focus:border-fuchsia-500/40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Due date (optional)</label>
              <input
                type="date"
                value={newDue}
                onChange={e => setNewDue(e.target.value)}
                className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setAddOpen(false)} className="h-8 px-3 rounded-sm border border-[#1f2530] text-xs">Cancel</button>
              <button
                onClick={submitAdhoc}
                disabled={saving || !newStudent || !newText.trim()}
                className="h-8 px-3 rounded-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-fuchsia-950 text-xs font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : "Add item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
