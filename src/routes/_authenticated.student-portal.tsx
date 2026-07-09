import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trash2, CheckCircle2, Clock, Award, Briefcase, MessageSquare, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student-portal")({
  head: () => ({ meta: [{ title: "My EODs — ISA" }] }),
  component: StudentPortal,
});

type Student = { id: string; full_name: string; email: string | null; phase: string; status: string; calls_included: number };
type SEod = {
  id: string; student_id: string; report_date: string;
  applications_submitted: number; outreach_sent: number; replies: number; interviews: number;
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};

const empty = {
  applications_submitted: 0, outreach_sent: 0, replies: 0, interviews: 0,
  wins: "", blockers: "", tomorrow_focus: "", summary: "",
};

function StudentPortal() {
  const { user, displayName } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [student, setStudent] = useState<Student | null>(null);
  const [eods, setEods] = useState<SEod[]>([]);
  const [form, setForm] = useState(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: s } = await supabase.from("students").select("id, full_name, email, phase, status, calls_included").eq("user_id", user.id).maybeSingle();
    setStudent((s as Student) ?? null);
    if (!s) { setLoading(false); return; }
    const { data: e } = await supabase.from("student_eods").select("*").eq("student_id", s.id).order("report_date", { ascending: false }).limit(30);
    setEods((e ?? []) as SEod[]);
    const t = (e ?? []).find((r: any) => r.report_date === today);
    if (t) {
      setExistingId(t.id);
      setForm({
        applications_submitted: t.applications_submitted, outreach_sent: t.outreach_sent,
        replies: t.replies, interviews: t.interviews,
        wins: t.wins ?? "", blockers: t.blockers ?? "",
        tomorrow_focus: t.tomorrow_focus ?? "", summary: t.summary ?? "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const totals = useMemo(() => eods.reduce((a, e) => ({
    apps: a.apps + e.applications_submitted,
    outreach: a.outreach + e.outreach_sent,
    replies: a.replies + e.replies,
    interviews: a.interviews + e.interviews,
  }), { apps: 0, outreach: 0, replies: 0, interviews: 0 }), [eods]);

  const submit = async () => {
    if (!student) return;
    setSaving(true);
    const { error } = await supabase.from("student_eods").upsert({
      student_id: student.id, report_date: today, ...form,
    }, { onConflict: "student_id,report_date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existingId ? "EOD updated" : "EOD submitted");
    load();
  };

  const deleteEod = async (id: string) => {
    if (!confirm("Delete this EOD?")) return;
    const { error } = await supabase.from("student_eods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!student) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm p-8 text-center">
          <div className="text-amber-400 text-sm font-medium mb-2">Your account isn't linked to a student profile yet</div>
          <p className="text-xs text-muted-foreground">
            Contact your coach so they can add you (email: <span className="font-mono text-foreground">{user?.email}</span>). Once linked, this page becomes your daily EOD hub.
          </p>
        </div>
      </div>
    );
  }

  const bump = (k: keyof typeof empty, d: number) =>
    setForm(f => ({ ...f, [k]: Math.max(0, (typeof f[k] === "number" ? (f[k] as number) : 0) + d) }));

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 mb-1">Student portal</div>
          <h1 className="text-2xl font-semibold tracking-tight">{displayName ?? student.full_name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {student.phase.replace("_", " ")} · {student.status} · {student.calls_included} 1:1 calls included
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border ${existingId ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-amber-500/30 bg-amber-500/5 text-amber-400"}`}>
          {existingId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {existingId ? "Today logged" : "Today pending"}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Total apps" value={totals.apps} icon={<Briefcase className="h-3 w-3" />} accent />
        <Kpi label="Outreach" value={totals.outreach} icon={<Users className="h-3 w-3" />} />
        <Kpi label="Replies" value={totals.replies} icon={<MessageSquare className="h-3 w-3" />} />
        <Kpi label="Interviews" value={totals.interviews} icon={<Award className="h-3 w-3" />} accent />
      </div>

      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">{existingId ? "Update today's log" : "Submit today's log"}</h2>
          <p className="text-[11px] text-muted-foreground">{today}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Counter label="Applications" value={form.applications_submitted} onBump={d => bump("applications_submitted", d)} />
          <Counter label="Outreach sent" value={form.outreach_sent} onBump={d => bump("outreach_sent", d)} />
          <Counter label="Replies" value={form.replies} onBump={d => bump("replies", d)} />
          <Counter label="Interviews" value={form.interviews} onBump={d => bump("interviews", d)} />
        </div>

        <TextField label="Wins" value={form.wins} onChange={v => setForm(f => ({ ...f, wins: v }))} />
        <TextField label="Blockers" value={form.blockers} onChange={v => setForm(f => ({ ...f, blockers: v }))} />
        <TextField label="Tomorrow's focus" value={form.tomorrow_focus} onChange={v => setForm(f => ({ ...f, tomorrow_focus: v }))} />
        <TextField label="Summary" value={form.summary} onChange={v => setForm(f => ({ ...f, summary: v }))} rows={3} />

        <button onClick={submit} disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium h-9 rounded-sm text-sm">
          {saving ? "Saving…" : existingId ? "Update EOD" : "Submit EOD"}
        </button>
      </div>

      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
        <div className="px-4 py-3 border-b border-[#1f2530] text-xs font-semibold">Past EODs</div>
        <div className="divide-y divide-[#1a1f29]">
          {eods.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No EODs yet.</div>}
          {eods.map(e => (
            <div key={e.id} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 p-3 text-xs">
              <span className="font-mono text-muted-foreground">{e.report_date}</span>
              <div className="flex gap-3 text-[11px] text-muted-foreground font-mono flex-wrap">
                <span>Apps <span className="text-emerald-400">{e.applications_submitted}</span></span>
                <span>Out <span className="text-foreground">{e.outreach_sent}</span></span>
                <span>Repl <span className="text-foreground">{e.replies}</span></span>
                <span>Int <span className="text-foreground">{e.interviews}</span></span>
              </div>
              <button onClick={() => deleteEod(e.id)} className="p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`border border-[#1f2530] rounded-sm p-3 ${accent ? "bg-emerald-500/5" : "bg-[#0f1116]"}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-xl font-mono font-semibold ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Counter({ label, value, onBump }: { label: string; value: number; onBump: (d: number) => void }) {
  return (
    <div className="border border-[#1f2530] rounded-sm bg-[#0a0b0f] p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-1">
        <button onClick={() => onBump(-1)} className="h-8 w-8 rounded-sm border border-[#1f2530] hover:bg-[#1a1f29] text-lg leading-none">−</button>
        <div className="flex-1 text-center text-lg font-mono font-semibold">{value}</div>
        <button onClick={() => onBump(1)} className="h-8 w-8 rounded-sm border border-[#1f2530] hover:bg-[#1a1f29] text-lg leading-none">+</button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-emerald-500/40" />
    </div>
  );
}
