import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trash2, CheckCircle2, Clock, Award, Briefcase, MessageSquare, Users, ListChecks, Calendar, Trophy, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student-portal")({
  head: () => ({ meta: [{ title: "Student Portal — ISA" }] }),
  component: StudentPortal,
});

type Student = {
  id: string; full_name: string; email: string | null; phase: string; status: string;
  calls_included: number; calls_allotted: number | null;
  first_win_at: string | null; offer_landed_at: string | null;
  testimonial_collected: boolean | null; trustpilot_collected: boolean | null;
};
type SEod = {
  id: string; student_id: string; report_date: string;
  applications_submitted: number; outreach_sent: number; replies: number; interviews: number;
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};
type ActionItem = { text?: string; done?: boolean; due_date?: string | null };
type Call = {
  id: string; call_date: string; status: string; progress_rating: number | null;
  next_call_date: string | null; action_items_json: ActionItem[] | null;
};

const empty = {
  applications_submitted: 0, outreach_sent: 0, replies: 0, interviews: 0,
  wins: "", blockers: "", tomorrow_focus: "", summary: "",
};

type Tab = "eod" | "actions" | "coaching" | "milestones";

function StudentPortal() {
  const { user, displayName } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<Tab>("eod");
  const [student, setStudent] = useState<Student | null>(null);
  const [eods, setEods] = useState<SEod[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [form, setForm] = useState(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: s } = await supabase.from("students")
      .select("id, full_name, email, phase, status, calls_included, calls_allotted, first_win_at, offer_landed_at, testimonial_collected, trustpilot_collected")
      .eq("user_id", user.id).maybeSingle();
    setStudent((s as Student) ?? null);
    if (!s) { setLoading(false); return; }
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from("student_eods").select("*").eq("student_id", (s as Student).id).order("report_date", { ascending: false }).limit(30),
      supabase.from("student_calls").select("id, call_date, status, progress_rating, next_call_date, action_items_json").eq("student_id", (s as Student).id).order("call_date", { ascending: false }),
    ]);
    setEods((e ?? []) as SEod[]);
    setCalls((c ?? []) as Call[]);
    const t = (e ?? []).find((r: any) => r.report_date === today);
    if (t) {
      setExistingId(t.id);
      setForm({
        applications_submitted: t.applications_submitted, outreach_sent: t.outreach_sent,
        replies: t.replies, interviews: t.interviews,
        wins: t.wins ?? "", blockers: t.blockers ?? "",
        tomorrow_focus: t.tomorrow_focus ?? "", summary: t.summary ?? "",
      });
    } else {
      setExistingId(null);
      setForm(empty);
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

  const actionItems = useMemo(() => {
    const out: { callId: string; callDate: string; index: number; item: ActionItem }[] = [];
    for (const c of calls) {
      const items = Array.isArray(c.action_items_json) ? c.action_items_json : [];
      items.forEach((it, i) => out.push({ callId: c.id, callDate: c.call_date, index: i, item: it }));
    }
    return out.sort((a, b) => {
      if (!!a.item.done !== !!b.item.done) return a.item.done ? 1 : -1;
      const ad = a.item.due_date ?? "9999", bd = b.item.due_date ?? "9999";
      return ad.localeCompare(bd);
    });
  }, [calls]);

  const completedCalls = useMemo(() => calls.filter(c => c.status === "completed"), [calls]);
  const callsAllotted = student?.calls_allotted ?? student?.calls_included ?? 0;
  const callsUsed = completedCalls.length;
  const nextCall = useMemo(() => {
    const upcoming = calls.filter(c => c.next_call_date && c.next_call_date >= today).map(c => c.next_call_date!);
    const scheduled = calls.filter(c => c.status === "scheduled" && c.call_date >= today).map(c => c.call_date);
    const all = [...upcoming, ...scheduled].sort();
    return all[0] ?? null;
  }, [calls, today]);

  const ratings = useMemo(
    () => completedCalls.filter(c => c.progress_rating != null).sort((a, b) => a.call_date.localeCompare(b.call_date)).map(c => ({ date: c.call_date, rating: c.progress_rating! })),
    [completedCalls]
  );

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

  const toggleItem = async (callId: string, index: number, done: boolean) => {
    // optimistic
    setCalls(prev => prev.map(c => {
      if (c.id !== callId) return c;
      const items = Array.isArray(c.action_items_json) ? [...c.action_items_json] : [];
      items[index] = { ...items[index], done };
      return { ...c, action_items_json: items };
    }));
    const { error } = await supabase.rpc("student_toggle_action_item", { _call_id: callId, _index: index, _done: done });
    if (error) { toast.error(error.message); load(); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!student) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm p-8 text-center">
          <div className="text-amber-400 text-sm font-medium mb-2">Your account isn't linked to a student profile yet</div>
          <p className="text-xs text-muted-foreground">
            Contact your coach so they can add you (email: <span className="font-mono text-foreground">{user?.email}</span>). Once linked, this page becomes your daily hub.
          </p>
        </div>
      </div>
    );
  }

  const bump = (k: keyof typeof empty, d: number) =>
    setForm(f => ({ ...f, [k]: Math.max(0, (typeof f[k] === "number" ? (f[k] as number) : 0) + d) }));

  const openItems = actionItems.filter(a => !a.item.done).length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 mb-1">Student portal</div>
          <h1 className="text-2xl font-semibold tracking-tight">{displayName ?? student.full_name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {student.phase.replace("_", " ")} · {student.status} · {callsUsed}/{callsAllotted} calls used
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border ${existingId ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-amber-500/30 bg-amber-500/5 text-amber-400"}`}>
          {existingId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {existingId ? "Today logged" : "Today pending"}
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-[#1f2530] -mb-px">
        <TabButton active={tab === "eod"} onClick={() => setTab("eod")} icon={<Briefcase className="h-3.5 w-3.5" />} label="My EOD" />
        <TabButton active={tab === "actions"} onClick={() => setTab("actions")} icon={<ListChecks className="h-3.5 w-3.5" />} label={`Action items${openItems ? ` (${openItems})` : ""}`} />
        <TabButton active={tab === "coaching"} onClick={() => setTab("coaching")} icon={<Calendar className="h-3.5 w-3.5" />} label="My coaching" />
        <TabButton active={tab === "milestones"} onClick={() => setTab("milestones")} icon={<Trophy className="h-3.5 w-3.5" />} label="Milestones" />
      </nav>

      {tab === "eod" && (
        <div className="space-y-5">
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
      )}

      {tab === "actions" && (
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
          <div className="px-4 py-3 border-b border-[#1f2530] flex items-center justify-between">
            <div className="text-xs font-semibold">Action items from your 1:1s</div>
            <div className="text-[11px] text-muted-foreground">{openItems} open · {actionItems.length - openItems} done</div>
          </div>
          <div className="divide-y divide-[#1a1f29]">
            {actionItems.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Your coach hasn't set any action items yet.</div>}
            {actionItems.map(a => {
              const overdue = !a.item.done && a.item.due_date && a.item.due_date < today;
              return (
                <label key={`${a.callId}-${a.index}`} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[#141821]">
                  <input
                    type="checkbox"
                    checked={!!a.item.done}
                    onChange={e => toggleItem(a.callId, a.index, e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs ${a.item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {a.item.text || <span className="italic text-muted-foreground">(no text)</span>}
                    </div>
                    <div className="flex gap-2 mt-1 text-[10px] font-mono text-muted-foreground">
                      <span>from call {a.callDate}</span>
                      {a.item.due_date && (
                        <span className={overdue ? "text-rose-400" : ""}>
                          · due {a.item.due_date}{overdue ? " (overdue)" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {tab === "coaching" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Calls used" value={callsUsed} icon={<Calendar className="h-3 w-3" />} />
            <Kpi label="Calls remaining" value={Math.max(0, callsAllotted - callsUsed)} icon={<Calendar className="h-3 w-3" />} accent />
            <div className="border border-[#1f2530] rounded-sm p-3 bg-[#0f1116]">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1"><Calendar className="h-3 w-3" />Next call</div>
              <div className="text-sm font-mono font-semibold">{nextCall ?? "—"}</div>
            </div>
            <div className="border border-[#1f2530] rounded-sm p-3 bg-[#0f1116]">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1"><TrendingUp className="h-3 w-3" />Latest rating</div>
              <div className="text-sm font-mono font-semibold">{ratings.at(-1)?.rating ?? "—"}<span className="text-muted-foreground text-xs">/5</span></div>
            </div>
          </div>

          <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-5">
            <div className="text-xs font-semibold mb-3">Progress rating trend</div>
            {ratings.length < 2 ? (
              <div className="text-[11px] text-muted-foreground py-8 text-center">Trend shows once you have 2+ rated calls.</div>
            ) : (
              <RatingChart data={ratings} />
            )}
          </div>

          <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
            <div className="px-4 py-3 border-b border-[#1f2530] text-xs font-semibold">Your 1:1 history</div>
            <div className="divide-y divide-[#1a1f29]">
              {completedCalls.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No completed calls yet.</div>}
              {completedCalls.map(c => (
                <div key={c.id} className="grid grid-cols-[100px_1fr_auto] items-center gap-3 p-3 text-xs">
                  <span className="font-mono text-muted-foreground">{c.call_date}</span>
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-mono">{c.progress_rating ? `${c.progress_rating}/5` : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "milestones" && (
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-6 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Graduation checklist</h2>
            <p className="text-[11px] text-muted-foreground">The finish line. Your coach marks these as you hit them.</p>
          </div>
          <div className="space-y-2 pt-2">
            <Milestone done={!!student.first_win_at} label="First win" detail={student.first_win_at ? `Achieved ${student.first_win_at.slice(0, 10)}` : "Coming up"} />
            <Milestone done={!!student.offer_landed_at} label="Offer landed" detail={student.offer_landed_at ? `Achieved ${student.offer_landed_at.slice(0, 10)}` : "Coming up"} />
            <Milestone done={!!student.testimonial_collected} label="Testimonial collected" />
            <Milestone done={!!student.trustpilot_collected} label="Trustpilot review" />
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 -mb-px ${active ? "border-fuchsia-400 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {icon}{label}
    </button>
  );
}

function Milestone({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-sm border ${done ? "border-emerald-500/30 bg-emerald-500/5" : "border-[#1f2530] bg-[#0a0b0f]"}`}>
      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${done ? "bg-emerald-500 text-emerald-950" : "border border-[#1f2530] text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1">
        <div className={`text-sm ${done ? "text-emerald-300" : "text-foreground"}`}>{label}</div>
        {detail && <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}

function RatingChart({ data }: { data: { date: string; rating: number }[] }) {
  const w = 600, h = 140, pad = 24;
  const xs = data.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1));
  const ys = data.map(d => h - pad - ((d.rating - 1) / 4) * (h - pad * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
      {[1, 2, 3, 4, 5].map(r => {
        const y = h - pad - ((r - 1) / 4) * (h - pad * 2);
        return <line key={r} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#1f2530" strokeWidth="1" />;
      })}
      <path d={path} fill="none" stroke="#d946ef" strokeWidth="2" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="3" fill="#d946ef" />)}
      {[1, 5].map(r => {
        const y = h - pad - ((r - 1) / 4) * (h - pad * 2);
        return <text key={r} x={4} y={y + 3} fontSize="9" fill="#6b7280">{r}</text>;
      })}
    </svg>
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
