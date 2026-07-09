import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ListChecks, AlertTriangle, User, Filter } from "lucide-react";

export const Route = createFileRoute("/_authenticated/action-items")({
  head: () => ({ meta: [{ title: "Action Items — ISA Team" }] }),
  component: ActionItemsHub,
});

type ActionItem = { id?: string; text?: string; done?: boolean; due?: string | null; due_date?: string | null };
type CallRow = {
  id: string; student_id: string; coach_id: string | null; call_date: string;
  action_items_json: ActionItem[] | null;
};
type Row = {
  callId: string; index: number; item: ActionItem;
  studentId: string; studentName: string; coachId: string | null; coachName: string; callDate: string;
};

type Filt = "all" | "mine" | "overdue" | "open";

function ActionItemsHub() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [students, setStudents] = useState<Record<string, string>>({});
  const [coaches, setCoaches] = useState<Record<string, string>>({});
  const [filt, setFilt] = useState<Filt>("open");
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    const [cRes, sRes, rRes] = await Promise.all([
      supabase.from("student_calls").select("id, student_id, coach_id, call_date, action_items_json").order("call_date", { ascending: false }).limit(2000),
      supabase.from("students").select("id, full_name"),
      supabase.from("profiles").select("id, display_name"),
    ]);
    setCalls((cRes.data ?? []) as CallRow[]);
    const sm: Record<string, string> = {}; (sRes.data ?? []).forEach((s: any) => { sm[s.id] = s.full_name; }); setStudents(sm);
    const cm: Record<string, string> = {}; (rRes.data ?? []).forEach((p: any) => { cm[p.id] = p.display_name ?? "Unknown"; }); setCoaches(cm);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const c of calls) {
      const items = Array.isArray(c.action_items_json) ? c.action_items_json : [];
      items.forEach((it, i) => {
        out.push({
          callId: c.id, index: i, item: it,
          studentId: c.student_id,
          studentName: students[c.student_id] ?? "Unknown",
          coachId: c.coach_id,
          coachName: c.coach_id ? (coaches[c.coach_id] ?? "—") : "Unassigned",
          callDate: c.call_date,
        });
      });
    }
    return out;
  }, [calls, students, coaches]);

  const dueOf = (r: Row) => (r.item.due ?? r.item.due_date ?? null);
  const isOverdue = (r: Row) => {
    const d = dueOf(r);
    return !r.item.done && d && d < today;
  };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (coachFilter === "mine" && r.coachId !== user?.id) return false;
      if (coachFilter !== "all" && coachFilter !== "mine" && r.coachId !== coachFilter) return false;
      if (filt === "mine" && r.coachId !== user?.id) return false;
      if (filt === "overdue" && !isOverdue(r)) return false;
      if (filt === "open" && r.item.done) return false;
      return true;
    }).sort((a, b) => {
      if (!!a.item.done !== !!b.item.done) return a.item.done ? 1 : -1;
      const ad = dueOf(a) ?? "9999", bd = dueOf(b) ?? "9999";
      if (ad !== bd) return ad.localeCompare(bd);
      return b.callDate.localeCompare(a.callDate);
    });
  }, [rows, filt, coachFilter, user, today]);

  const toggle = async (r: Row, done: boolean) => {
    // optimistic
    setCalls(prev => prev.map(c => {
      if (c.id !== r.callId) return c;
      const items = Array.isArray(c.action_items_json) ? [...c.action_items_json] : [];
      items[r.index] = { ...items[r.index], done };
      return { ...c, action_items_json: items };
    }));
    // Persist: rewrite the whole json for this call
    const call = calls.find(c => c.id === r.callId);
    if (!call) return;
    const items = Array.isArray(call.action_items_json) ? [...call.action_items_json] : [];
    items[r.index] = { ...items[r.index], done };
    const { error } = await supabase.from("student_calls").update({ action_items_json: items } as any).eq("id", r.callId);
    if (error) { toast.error(error.message); load(); }
  };

  const uniqueCoaches = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(coaches).forEach(([id, name]) => map.set(id, name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [coaches]);

  const counts = useMemo(() => ({
    open: rows.filter(r => !r.item.done).length,
    mine: rows.filter(r => !r.item.done && r.coachId === user?.id).length,
    overdue: rows.filter(r => isOverdue(r)).length,
    all: rows.length,
  }), [rows, user, today]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 mb-1">
            <ListChecks className="h-3 w-3" /> Action Items Hub
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Open action items</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every open item from every 1:1, across all coaches and students.
          </p>
        </div>
        <div className="flex gap-2 items-center text-[11px] font-mono text-muted-foreground">
          <span>{counts.open} open</span>
          <span>·</span>
          <span className="text-rose-400">{counts.overdue} overdue</span>
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
            value={coachFilter}
            onChange={e => setCoachFilter(e.target.value)}
            className="text-[11px] h-7 px-2 rounded-sm border border-[#1f2530] bg-[#0f1116]"
          >
            <option value="all">All coaches</option>
            <option value="mine">My items</option>
            {uniqueCoaches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
      </div>

      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-hidden">
        <div className="grid grid-cols-[24px_minmax(0,1fr)_140px_120px_90px] gap-2 px-3 py-2 border-b border-[#1f2530] text-[10px] uppercase tracking-widest text-muted-foreground">
          <span />
          <span>Item</span>
          <span>Student</span>
          <span>Coach</span>
          <span className="text-right">Due</span>
        </div>
        {loading && <div className="p-8 text-center text-xs text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">Nothing here. Nice.</div>
        )}
        {filtered.map(r => {
          const due = dueOf(r);
          const overdue = isOverdue(r);
          return (
            <label
              key={`${r.callId}-${r.index}`}
              className="grid grid-cols-[24px_minmax(0,1fr)_140px_120px_90px] gap-2 items-center px-3 py-2.5 border-b border-[#1a1f29] last:border-0 hover:bg-[#14171e] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!!r.item.done}
                onChange={e => toggle(r, e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              <div className="min-w-0">
                <div className={`text-xs truncate ${r.item.done ? "line-through text-muted-foreground" : ""}`}>
                  {r.item.text || <span className="italic text-muted-foreground">(no text)</span>}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">from call {r.callDate}</div>
              </div>
              <Link to="/students/$id" params={{ id: r.studentId }} className="text-xs truncate hover:text-emerald-400 flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" /> {r.studentName}
              </Link>
              <span className="text-xs text-muted-foreground truncate">{r.coachName}</span>
              <span className={`text-[11px] font-mono text-right ${overdue ? "text-rose-400" : due ? "text-muted-foreground" : "text-[#2a3140]"}`}>
                {due ? (overdue ? <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{due}</span> : due) : "—"}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
