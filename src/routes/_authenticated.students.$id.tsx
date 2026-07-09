import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  ArrowLeft, Video, Trash2, Plus, Save, Calendar as CalIcon,
  Phone, FileText, User, Pencil, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Student — ISA" }] }),
  component: StudentDetail,
});

type Phase = "uncategorized" | "onboarding" | "coaching_1on1" | "training" | "graduated" | "paused";
type Status = "active" | "inactive" | "ghosting";
type Student = {
  id: string; user_id: string | null; full_name: string; email: string | null;
  phase: Phase; status: Status; coach_id: string | null;
  join_date: string; calls_included: number; notes: string | null;
};
type Call = {
  id: string; student_id: string; coach_id: string | null; call_date: string;
  fathom_url: string | null; action_items: string | null; coach_notes: string | null;
  created_at: string;
};
type SEod = {
  id: string; student_id: string; report_date: string;
  applications_submitted: number; outreach_sent: number; replies: number; interviews: number;
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};
type Coach = { id: string; display_name: string | null };

const PHASES: Phase[] = ["uncategorized", "onboarding", "coaching_1on1", "training", "graduated", "paused"];
const STATUSES: Status[] = ["active", "inactive", "ghosting"];

function StudentDetail() {
  const { id } = Route.useParams() as { id: string };
  const nav = useNavigate();
  const { roles } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("coach");

  const [student, setStudent] = useState<Student | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [eods, setEods] = useState<SEod[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [editing, setEditing] = useState(false);
  const [callFormOpen, setCallFormOpen] = useState(false);

  const load = async () => {
    const [sRes, cRes, eRes, coachRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", id).maybeSingle(),
      supabase.from("student_calls").select("*").eq("student_id", id).order("call_date", { ascending: false }),
      supabase.from("student_eods").select("*").eq("student_id", id).order("report_date", { ascending: false }),
      supabase.from("user_roles").select("user_id, role").in("role", ["coach", "admin"]),
    ]);
    setStudent((sRes.data as Student) ?? null);
    setCalls((cRes.data ?? []) as Call[]);
    setEods((eRes.data ?? []) as SEod[]);
    const coachIds = Array.from(new Set((coachRes.data ?? []).map(r => r.user_id)));
    if (coachIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", coachIds);
      setCoaches((profs ?? []) as Coach[]);
    }
  };

  useEffect(() => { load(); }, [id]);

  // All hooks MUST be declared before any conditional return (Rules of Hooks).
  const totals = useMemo(() => eods.reduce((a, e) => ({
    apps: a.apps + e.applications_submitted,
    outreach: a.outreach + e.outreach_sent,
    replies: a.replies + e.replies,
    interviews: a.interviews + e.interviews,
  }), { apps: 0, outreach: 0, replies: 0, interviews: 0 }), [eods]);

  if (!student) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const coachName = (uid: string | null) => uid ? (coaches.find(c => c.id === uid)?.display_name ?? uid.slice(0, 8)) : "Unassigned";

  const deleteCall = async (cid: string) => {
    if (!confirm("Delete this call record?")) return;
    const { error } = await supabase.from("student_calls").delete().eq("id", cid);
    if (error) return toast.error(error.message);
    toast.success("Call deleted");
    load();
  };


  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-center justify-between border-b border-[#1f2530] pb-4">
        <button onClick={() => nav({ to: "/students" })} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to students
        </button>
        {canManage && (
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-sm border border-[#1f2530] hover:border-[#2a3140]">
            <Pencil className="h-3 w-3" /> {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {/* Header */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-[#1f2530] bg-[#0f1116] rounded-sm p-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 text-lg font-bold">
              {student.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold">{student.full_name}</h1>
              <div className="text-xs text-muted-foreground">{student.email ?? "no email"} · joined {student.join_date}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {editing ? (
                  <>
                    <select value={student.phase} onChange={e => update({ phase: e.target.value as Phase })} className="text-xs h-7 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f]">
                      {PHASES.map(p => <option key={p} value={p}>{p.replace("_", " ")}</option>)}
                    </select>
                    <select value={student.status} onChange={e => update({ status: e.target.value as Status })} className="text-xs h-7 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f]">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={student.coach_id ?? ""} onChange={e => update({ coach_id: e.target.value || null })} className="text-xs h-7 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f]">
                      <option value="">Unassigned</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.display_name ?? c.id}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <Chip label={student.phase.replace("_", " ")} color="fuchsia" />
                    <Chip label={student.status} color={student.status === "active" ? "emerald" : student.status === "ghosting" ? "rose" : "zinc"} />
                    <Chip label={`Coach: ${coachName(student.coach_id)}`} color="sky" />
                    <Chip label={`${student.calls_included} calls`} color="amber" />
                    {!student.user_id && <Chip label="Portal not linked" color="rose" />}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Progress totals</div>
          <MiniStat label="Applications" value={totals.apps} highlight />
          <MiniStat label="Outreach" value={totals.outreach} />
          <MiniStat label="Replies" value={totals.replies} />
          <MiniStat label="Interviews" value={totals.interviews} />
          <MiniStat label="Calls logged" value={calls.length} />
          <MiniStat label="EODs" value={eods.length} />
        </div>
      </div>

      {/* Notes */}
      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Coach notes</div>
          {canManage && (
            <button onClick={saveNotes} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><Save className="h-3 w-3" /> Save</button>
          )}
        </div>
        <textarea
          disabled={!canManage}
          value={student.notes ?? ""}
          onChange={e => setStudent({ ...student, notes: e.target.value })}
          rows={3}
          placeholder="Progress notes, personality, wins, blockers…"
          className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-emerald-500/40"
        />
      </div>

      {/* Calls */}
      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2530]">
          <div className="text-xs font-semibold flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-sky-400" /> 1-on-1 calls · {calls.length}</div>
          {canManage && (
            <button onClick={() => setCallFormOpen(!callFormOpen)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium">
              <Plus className="h-3 w-3" /> Log call
            </button>
          )}
        </div>
        {callFormOpen && <CallForm studentId={student.id} onCancel={() => setCallFormOpen(false)} onDone={() => { setCallFormOpen(false); load(); }} />}
        <div className="divide-y divide-[#1a1f29]">
          {calls.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No 1-on-1 calls logged yet.</div>}
          {calls.map(c => (
            <div key={c.id} className="p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-mono text-muted-foreground">
                  <CalIcon className="h-3 w-3" />
                  {c.call_date}
                  <span className="text-foreground">· {coachName(c.coach_id)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {c.fathom_url && (
                    <a href={c.fathom_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-[11px]">
                      <Video className="h-3 w-3" /> Fathom <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {canManage && (
                    <button onClick={() => deleteCall(c.id)} className="p-0.5 text-muted-foreground hover:text-rose-400"><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
              {c.action_items && <div className="text-xs"><span className="text-amber-400">Action items:</span> {c.action_items}</div>}
              {c.coach_notes && <div className="text-xs text-muted-foreground italic">{c.coach_notes}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* EOD history */}
      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2530]">
          <div className="text-xs font-semibold flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-emerald-400" /> Student EODs · {eods.length}</div>
          {!student.user_id && <span className="text-[10px] text-muted-foreground">Student hasn't signed in yet</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-[#1a1f29]">
                <th className="text-left p-2">Date</th>
                <th className="text-right p-2">Apps</th>
                <th className="text-right p-2">Outreach</th>
                <th className="text-right p-2">Replies</th>
                <th className="text-right p-2">Interviews</th>
                <th className="text-left p-2">Wins</th>
                <th className="text-left p-2">Blockers</th>
              </tr>
            </thead>
            <tbody>
              {eods.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No EODs yet.</td></tr>}
              {eods.map(e => (
                <tr key={e.id} className="border-b border-[#1a1f29]">
                  <td className="p-2 font-mono text-muted-foreground">{e.report_date}</td>
                  <td className="p-2 text-right font-mono text-emerald-400">{e.applications_submitted}</td>
                  <td className="p-2 text-right font-mono">{e.outreach_sent}</td>
                  <td className="p-2 text-right font-mono">{e.replies}</td>
                  <td className="p-2 text-right font-mono">{e.interviews}</td>
                  <td className="p-2 max-w-[200px] truncate">{e.wins}</td>
                  <td className="p-2 max-w-[200px] truncate text-amber-400/80">{e.blockers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  async function update(patch: Partial<Student>) {
    const { error } = await supabase.from("students").update(patch).eq("id", student!.id);
    if (error) return toast.error(error.message);
    setStudent({ ...student!, ...patch });
    toast.success("Updated");
  }
  async function saveNotes() {
    const { error } = await supabase.from("students").update({ notes: student!.notes }).eq("id", student!.id);
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
  }
}

function CallForm({ studentId, onCancel, onDone }: { studentId: string; onCancel: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    call_date: new Date().toISOString().slice(0, 10),
    fathom_url: "", action_items: "", coach_notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("student_calls").insert({
      student_id: studentId,
      coach_id: user?.id ?? null,
      call_date: form.call_date,
      fathom_url: form.fathom_url.trim() || null,
      action_items: form.action_items.trim() || null,
      coach_notes: form.coach_notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Call logged");
    onDone();
  };

  return (
    <div className="p-3 border-b border-[#1f2530] bg-[#14171e] space-y-2">
      <div className="grid md:grid-cols-2 gap-2">
        <input type="date" value={form.call_date} onChange={e => setForm(f => ({ ...f, call_date: e.target.value }))} className="h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs" />
        <input placeholder="Fathom URL (optional)" value={form.fathom_url} onChange={e => setForm(f => ({ ...f, fathom_url: e.target.value }))} className="h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs" />
      </div>
      <textarea placeholder="Action items…" value={form.action_items} onChange={e => setForm(f => ({ ...f, action_items: e.target.value }))} rows={2} className="w-full p-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs resize-none" />
      <textarea placeholder="Coach notes…" value={form.coach_notes} onChange={e => setForm(f => ({ ...f, coach_notes: e.target.value }))} rows={2} className="w-full p-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs resize-none" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-2 py-1">Cancel</button>
        <button onClick={submit} disabled={saving} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium px-3 py-1 rounded-sm">
          {saving ? "Saving…" : "Save call"}
        </button>
      </div>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: "emerald" | "rose" | "zinc" | "fuchsia" | "sky" | "amber" }) {
  const map = {
    emerald: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    rose: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    zinc: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5",
    fuchsia: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10",
    sky: "text-sky-400 border-sky-500/30 bg-sky-500/10",
    amber: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  } as const;
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${map[color]}`}>{label}</span>;
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1a1f29] last:border-0 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${highlight ? "text-emerald-400 font-semibold" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
