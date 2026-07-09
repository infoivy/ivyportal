import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Trash2, CheckCircle2, Clock, Award, Briefcase, MessageSquare, Users, ListChecks,
  Calendar, Trophy, TrendingUp, Flame, BookOpen, PartyPopper, ChevronRight, Lock,
  Sparkles, AlertCircle, PlayCircle,
} from "lucide-react";
import { computeStreak } from "@/lib/streak";
import { setStudentPortalTab, onStudentPortalTab, getStudentPortalTab } from "@/lib/student-portal-bus";

export const Route = createFileRoute("/_authenticated/student-portal")({
  head: () => ({ meta: [{ title: "Student Portal — ISA" }] }),
  component: StudentPortal,
});

type Student = {
  id: string; full_name: string; email: string | null; phase: string; status: string;
  calls_included: number; calls_allotted: number | null; coach_id: string | null;
  first_win_at: string | null; offer_landed_at: string | null;
  testimonial_collected: boolean | null; trustpilot_collected: boolean | null;
};
type Coach = { id: string; display_name: string | null; avatar_url: string | null };
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
type AdhocItem = {
  id: string; student_id: string; text: string; done: boolean;
  due_date: string | null; created_at: string; source_call_id: string | null;
};
type Doc = { slug: string; title: string; category: string };

const empty = {
  applications_submitted: 0, outreach_sent: 0, replies: 0, interviews: 0,
  wins: "", blockers: "", tomorrow_focus: "", summary: "",
};

type Tab = "eod" | "actions" | "coaching" | "milestones";

const PHASES: { key: string; label: string }[] = [
  { key: "onboarding", label: "Onboarding" },
  { key: "coaching_1on1", label: "1:1 Coaching" },
  { key: "training", label: "Training" },
  { key: "graduated", label: "Graduated" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function StudentPortal() {
  const { user, displayName } = useAuth();
  const today = todayStr();
  const [tab, setTab] = useState<Tab>(() => (getStudentPortalTab() as Tab) || "eod");
  useEffect(() => { setStudentPortalTab(tab); }, [tab]);
  useEffect(() => { const off = onStudentPortalTab(t => setTab(t as Tab)); return () => { off(); }; }, []);

  const [student, setStudent] = useState<Student | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [eods, setEods] = useState<SEod[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [adhocItems, setAdhocItems] = useState<AdhocItem[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [form, setForm] = useState(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const draftKey = student ? `student-eod-draft:${student.id}:${today}` : null;

  const load = async () => {
    if (!user) return;
    const { data: s } = await supabase.from("students")
      .select("id, full_name, email, phase, status, calls_included, calls_allotted, coach_id, first_win_at, offer_landed_at, testimonial_collected, trustpilot_collected")
      .eq("user_id", user.id).maybeSingle();
    setStudent((s as Student) ?? null);
    if (!s) { setLoading(false); return; }
    const st = s as Student;

    const [{ data: e }, { data: c }, { data: ah }, coachRes, docsRes] = await Promise.all([
      supabase.from("student_eods").select("*").eq("student_id", st.id).order("report_date", { ascending: false }).limit(60),
      supabase.from("student_calls").select("id, call_date, status, progress_rating, next_call_date, action_items_json").eq("student_id", st.id).order("call_date", { ascending: false }),
      supabase.from("student_action_items").select("id, student_id, text, done, due_date, created_at, source_call_id").eq("student_id", st.id).order("created_at", { ascending: false }),
      st.coach_id ? supabase.from("profiles").select("id, display_name, avatar_url").eq("id", st.coach_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("docs").select("slug, title, category").contains("role_visibility", ["student"]).order("pinned", { ascending: false }).order("sort_order").limit(8),
    ]);
    setEods((e ?? []) as SEod[]);
    setCalls((c ?? []) as Call[]);
    setAdhocItems((ah ?? []) as AdhocItem[]);
    setCoach((coachRes.data as Coach) ?? null);
    setDocs((docsRes.data ?? []) as Doc[]);

    const t = (e ?? []).find((r: any) => r.report_date === today);
    if (t) {
      setExistingId(t.id);
      setForm({
        applications_submitted: t.applications_submitted, outreach_sent: t.outreach_sent,
        replies: t.replies, interviews: t.interviews,
        wins: t.wins ?? "", blockers: t.blockers ?? "",
        tomorrow_focus: t.tomorrow_focus ?? "", summary: t.summary ?? "",
      });
      setShowForm(false);
    } else {
      setExistingId(null);
      // Try to restore draft
      try {
        const raw = localStorage.getItem(`student-eod-draft:${st.id}:${today}`);
        if (raw) setForm({ ...empty, ...JSON.parse(raw) });
        else setForm(empty);
      } catch { setForm(empty); }
      setShowForm(false);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  // Autosave draft
  useEffect(() => {
    if (!draftKey || existingId) return;
    const isEmpty = form.applications_submitted === 0 && form.outreach_sent === 0 && form.replies === 0 && form.interviews === 0 && !form.wins && !form.blockers && !form.tomorrow_focus && !form.summary;
    if (isEmpty) { try { localStorage.removeItem(draftKey); } catch {} return; }
    try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch {}
  }, [form, draftKey, existingId]);

  const streak = useMemo(() => computeStreak(eods.map(e => e.report_date)), [eods]);

  // Last 7 & prior 7 day windows
  const last7 = useMemo(() => {
    const start = daysAgoStr(6);
    return eods.filter(e => e.report_date >= start && e.report_date <= today);
  }, [eods, today]);
  const prev7 = useMemo(() => {
    const start = daysAgoStr(13), end = daysAgoStr(7);
    return eods.filter(e => e.report_date >= start && e.report_date <= end);
  }, [eods]);

  const sumOf = (arr: SEod[], k: keyof SEod) => arr.reduce((a, e) => a + ((e[k] as number) || 0), 0);
  const totals7 = {
    apps: sumOf(last7, "applications_submitted"),
    outreach: sumOf(last7, "outreach_sent"),
    replies: sumOf(last7, "replies"),
    interviews: sumOf(last7, "interviews"),
  };
  const totalsPrev = {
    apps: sumOf(prev7, "applications_submitted"),
    outreach: sumOf(prev7, "outreach_sent"),
    replies: sumOf(prev7, "replies"),
    interviews: sumOf(prev7, "interviews"),
  };

  // Weekly recap on Mondays
  const isMonday = new Date().getDay() === 1;

  // Sparkline series (7 days, oldest → newest)
  const spark = (k: keyof SEod) => {
    const arr: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = daysAgoStr(i);
      const row = eods.find(e => e.report_date === day);
      arr.push(row ? (row[k] as number) || 0 : 0);
    }
    return arr;
  };

  const actionItems = useMemo(() => {
    const out: {
      kind: "call" | "adhoc";
      callId: string; callDate: string; index: number;
      adhocId?: string;
      item: ActionItem;
    }[] = [];
    for (const c of calls) {
      const items = Array.isArray(c.action_items_json) ? c.action_items_json : [];
      items.forEach((it, i) => out.push({ kind: "call", callId: c.id, callDate: c.call_date, index: i, item: it }));
    }
    for (const ah of adhocItems) {
      if (ah.source_call_id) continue; // avoid duplicating call-derived items surfaced as adhoc
      out.push({
        kind: "adhoc",
        callId: `adhoc:${ah.id}`,
        callDate: ah.created_at.slice(0, 10),
        index: 0,
        adhocId: ah.id,
        item: { text: ah.text, done: ah.done, due_date: ah.due_date ?? null },
      });
    }
    return out.sort((a, b) => {
      if (!!a.item.done !== !!b.item.done) return a.item.done ? 1 : -1;
      const ad = a.item.due_date ?? "9999", bd = b.item.due_date ?? "9999";
      return ad.localeCompare(bd);
    });
  }, [calls, adhocItems]);

  const openItems = actionItems.filter(a => !a.item.done);
  const dueToday = openItems.filter(a => a.item.due_date === today);
  const overdue = openItems.filter(a => a.item.due_date && a.item.due_date < today);
  const upcoming = openItems.filter(a => !a.item.due_date || a.item.due_date > today);

  const completedCalls = useMemo(() => calls.filter(c => c.status === "completed"), [calls]);
  const callsAllotted = student?.calls_allotted ?? student?.calls_included ?? 0;
  const callsUsed = completedCalls.length;
  const nextCallDate = useMemo(() => {
    const upc = calls.filter(c => c.next_call_date && c.next_call_date >= today).map(c => c.next_call_date!);
    const sch = calls.filter(c => c.status === "scheduled" && c.call_date >= today).map(c => c.call_date);
    return [...upc, ...sch].sort()[0] ?? null;
  }, [calls, today]);
  const nextCallInDays = nextCallDate ? Math.ceil((new Date(nextCallDate).getTime() - new Date(today).getTime()) / 86400000) : null;
  const lastCallItems = useMemo(() => {
    const last = completedCalls[0];
    if (!last) return null;
    const items = Array.isArray(last.action_items_json) ? last.action_items_json : [];
    return { date: last.call_date, items };
  }, [completedCalls]);

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
    const wasNew = !existingId;
    toast.success(existingId ? "EOD updated" : "EOD submitted");
    if (draftKey) try { localStorage.removeItem(draftKey); } catch {}
    if (wasNew) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 2500);
    }
    await load();
  };

  const deleteEod = async (id: string) => {
    if (!confirm("Delete this EOD?")) return;
    const { error } = await supabase.from("student_eods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const toggleItem = async (callId: string, index: number, done: boolean) => {
    if (callId.startsWith("adhoc:")) {
      const id = callId.slice("adhoc:".length);
      setAdhocItems(prev => prev.map(a => a.id === id ? { ...a, done } : a));
      const { error } = await supabase
        .from("student_action_items")
        .update({ done, done_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) { toast.error(error.message); load(); }
      return;
    }
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

  const first = (displayName ?? student.full_name).split(" ")[0];
  const brandNew = eods.length === 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5 relative">
      {confetti && <ConfettiBurst />}

      {/* HERO */}
      <section className="border border-[#1f2530] rounded-sm bg-gradient-to-br from-[#141821] via-[#0f1116] to-[#0f1116] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 mb-1">Student portal</div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Salaam, {first} <span className="inline-block">👋</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {student.phase.replace("_", " ")} · {student.status}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border border-orange-500/30 bg-orange-500/5 text-orange-400">
                <Flame className="h-3.5 w-3.5" />
                {streak}-day streak
              </div>
            )}
            <button
              onClick={() => {
                if (existingId) { setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }
                else { setTab("eod"); setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }
              }}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border transition ${existingId ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10"}`}
            >
              {existingId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {existingId ? "Today logged — edit" : "Submit today's log"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
          {/* Coach card */}
          <div className="border border-[#1f2530] rounded-sm bg-[#0a0b0f] p-3 flex items-center gap-3">
            {coach ? (
              <>
                {coach.avatar_url ? (
                  <img src={coach.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border border-[#1f2530]" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-fuchsia-500/20 text-fuchsia-300 flex items-center justify-center text-xs font-semibold">
                    {(coach.display_name ?? "C").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Your coach</div>
                  <div className="text-sm font-medium truncate">{coach.display_name ?? "Coach"}</div>
                </div>
              </>
            ) : (
              <>
                <div className="h-10 w-10 rounded-full border border-dashed border-[#2b3240] text-muted-foreground flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Your coach</div>
                  <div className="text-xs text-muted-foreground">Will be assigned soon</div>
                </div>
              </>
            )}
          </div>
          {/* Next call */}
          <div className="border border-[#1f2530] rounded-sm bg-[#0a0b0f] p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Next 1:1</div>
              {nextCallDate ? (
                <div className="text-sm font-medium">
                  {nextCallDate}
                  <span className="text-muted-foreground text-[11px] ml-2 font-mono">
                    {nextCallInDays === 0 ? "today" : nextCallInDays === 1 ? "tomorrow" : `in ${nextCallInDays}d`}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Not scheduled yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Journey stepper */}
        <div className="mt-5 pt-5 border-t border-[#1f2530]">
          <JourneyStepper current={student.phase} />
        </div>
      </section>

      {/* TABS */}
      <nav className="flex flex-wrap gap-1 border-b border-[#1f2530] -mb-px">
        <TabButton active={tab === "eod"} onClick={() => setTab("eod")} icon={<Briefcase className="h-3.5 w-3.5" />} label="My EOD" />
        <TabButton active={tab === "actions"} onClick={() => setTab("actions")} icon={<ListChecks className="h-3.5 w-3.5" />} label="Action items" badge={openItems.length} urgent={overdue.length > 0 || dueToday.length > 0} />
        <TabButton active={tab === "coaching"} onClick={() => setTab("coaching")} icon={<Calendar className="h-3.5 w-3.5" />} label="My coaching" />
        <TabButton active={tab === "milestones"} onClick={() => setTab("milestones")} icon={<Trophy className="h-3.5 w-3.5" />} label="Milestones" />
      </nav>

      {tab === "eod" && (
        <div className="space-y-5">
          {/* KPI cards last 7 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Apps · 7d" value={totals7.apps} prev={totalsPrev.apps} series={spark("applications_submitted")} accent brandNew={brandNew} icon={<Briefcase className="h-3 w-3" />} />
            <StatCard label="Outreach · 7d" value={totals7.outreach} prev={totalsPrev.outreach} series={spark("outreach_sent")} brandNew={brandNew} icon={<Users className="h-3 w-3" />} />
            <StatCard label="Replies · 7d" value={totals7.replies} prev={totalsPrev.replies} series={spark("replies")} brandNew={brandNew} icon={<MessageSquare className="h-3 w-3" />} />
            <StatCard label="Interviews · 7d" value={totals7.interviews} prev={totalsPrev.interviews} series={spark("interviews")} accent brandNew={brandNew} icon={<Award className="h-3 w-3" />} />
          </div>

          {/* Weekly recap (Mondays) */}
          {isMonday && (totalsPrev.apps || totalsPrev.outreach || totalsPrev.replies || totalsPrev.interviews) > 0 && (
            <WeeklyRecap prev={totalsPrev} evenPrior={{ apps: 0, outreach: 0, replies: 0, interviews: 0 }} totals={totals7} />
          )}

          {/* Form / Recap */}
          <div ref={formRef}>
            {existingId && !showForm ? (
              <SubmittedRecap
                form={form}
                streak={streak}
                onEdit={() => setShowForm(true)}
              />
            ) : (
              <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">{existingId ? "Update today's log" : "Submit today's log"}</h2>
                    <p className="text-[11px] text-muted-foreground">{today}{!existingId && " · autosaves as you type"}</p>
                  </div>
                  {existingId && (
                    <button onClick={() => setShowForm(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Collapse</button>
                  )}
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
            )}
          </div>

          {/* Resources for you */}
          {docs.length > 0 && (
            <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
              <div className="px-4 py-3 border-b border-[#1f2530] flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-fuchsia-400" />
                <div className="text-xs font-semibold">Resources for you</div>
              </div>
              <div className="divide-y divide-[#1a1f29]">
                {docs.map(d => (
                  <Link key={d.slug} to="/knowledge/$slug" params={{ slug: d.slug }} className="flex items-center gap-3 p-3 hover:bg-[#141821] group">
                    <div className="h-7 w-7 rounded-sm bg-[#0a0b0f] border border-[#1f2530] flex items-center justify-center">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground group-hover:text-fuchsia-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{d.title}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{d.category.replace("_", " ")}</div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
                <Link to="/training" className="flex items-center gap-3 p-3 hover:bg-[#141821] group">
                  <div className="h-7 w-7 rounded-sm bg-[#0a0b0f] border border-[#1f2530] flex items-center justify-center">
                    <PlayCircle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-fuchsia-400" />
                  </div>
                  <div className="flex-1 text-xs font-medium">Training videos</div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </div>
            </div>
          )}

          {/* Past EODs */}
          <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
            <div className="px-4 py-3 border-b border-[#1f2530] text-xs font-semibold">Past EODs</div>
            <div className="divide-y divide-[#1a1f29]">
              {eods.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No EODs yet. Your first log starts your streak. 🔥</div>}
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
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Due today" value={dueToday.length} tone={dueToday.length ? "amber" : "neutral"} />
            <MiniStat label="Overdue" value={overdue.length} tone={overdue.length ? "rose" : "neutral"} />
            <MiniStat label="Upcoming" value={upcoming.length} tone="neutral" />
          </div>

          {dueToday.length > 0 && (
            <ActionSection title="Due today" icon={<AlertCircle className="h-3.5 w-3.5 text-amber-400" />}>
              {dueToday.map(a => <ActionRow key={`${a.callId}-${a.index}`} a={a} today={today} onToggle={toggleItem} />)}
            </ActionSection>
          )}
          {overdue.length > 0 && (
            <ActionSection title="Overdue" icon={<AlertCircle className="h-3.5 w-3.5 text-rose-400" />} tone="rose">
              {overdue.map(a => <ActionRow key={`${a.callId}-${a.index}`} a={a} today={today} onToggle={toggleItem} />)}
            </ActionSection>
          )}
          <ActionSection title={overdue.length + dueToday.length ? "Later" : "All items"} icon={<ListChecks className="h-3.5 w-3.5 text-muted-foreground" />}>
            {upcoming.length === 0 && actionItems.filter(a => a.item.done).length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">Your coach hasn't set any action items yet.</div>
            )}
            {upcoming.map(a => <ActionRow key={`${a.callId}-${a.index}`} a={a} today={today} onToggle={toggleItem} />)}
            {actionItems.filter(a => a.item.done).map(a => <ActionRow key={`${a.callId}-${a.index}`} a={a} today={today} onToggle={toggleItem} />)}
          </ActionSection>
        </div>
      )}

      {tab === "coaching" && (
        <div className="space-y-5">
          {/* Calls bar */}
          <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">Coaching calls</div>
              <div className="text-[11px] font-mono text-muted-foreground">{callsUsed}/{callsAllotted} used</div>
            </div>
            <div className="h-2 rounded-sm bg-[#1a1f29] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500"
                style={{ width: `${callsAllotted ? Math.min(100, (callsUsed / callsAllotted) * 100) : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
              <span>{Math.max(0, callsAllotted - callsUsed)} remaining</span>
              <span>{nextCallDate ? `Next · ${nextCallDate}` : "No call scheduled"}</span>
            </div>
          </div>

          {/* Trend */}
          <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold">Progress rating trend</div>
              <div className="text-[11px] font-mono text-muted-foreground">Latest {ratings.at(-1)?.rating ?? "—"}/5</div>
            </div>
            {ratings.length < 2 ? (
              <div className="text-[11px] text-muted-foreground py-8 text-center">Trend shows once you have 2+ rated calls.</div>
            ) : (
              <RatingChart data={ratings} />
            )}
          </div>

          {/* Last call action items */}
          {lastCallItems && lastCallItems.items.length > 0 && (
            <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
              <div className="px-4 py-3 border-b border-[#1f2530] flex items-center justify-between">
                <div className="text-xs font-semibold">Last call action items</div>
                <div className="text-[10px] font-mono text-muted-foreground">{lastCallItems.date}</div>
              </div>
              <div className="divide-y divide-[#1a1f29]">
                {lastCallItems.items.map((it, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 text-xs">
                    {it.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />}
                    <span className={it.done ? "line-through text-muted-foreground" : ""}>{it.text || <span className="italic">(no text)</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
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
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">The finish line. Your coach unlocks these as you hit them.</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MilestoneCard done={!!student.first_win_at} label="First win" detail={student.first_win_at ? `Unlocked ${student.first_win_at.slice(0, 10)}` : "Land your first interview or big response"} />
            <MilestoneCard done={!!student.offer_landed_at} label="Offer landed" detail={student.offer_landed_at ? `Unlocked ${student.offer_landed_at.slice(0, 10)}` : "Sign your first offer"} />
            <MilestoneCard done={!!student.testimonial_collected} label="Testimonial" detail={student.testimonial_collected ? "Shared with us" : "Share your story with future students"} />
            <MilestoneCard done={!!student.trustpilot_collected} label="Trustpilot review" detail={student.trustpilot_collected ? "Live on Trustpilot" : "Help others find us"} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- sub-components ---------- */

function TabButton({ active, onClick, icon, label, badge, urgent }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number; urgent?: boolean }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 -mb-px ${active ? "border-fuchsia-400 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {icon}{label}
      {badge != null && badge > 0 && (
        <span className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full ${urgent ? "bg-rose-500/20 text-rose-400" : "bg-[#1a1f29] text-muted-foreground"}`}>{badge}</span>
      )}
    </button>
  );
}

function JourneyStepper({ current }: { current: string }) {
  const currentIndex = PHASES.findIndex(p => p.key === current);
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {PHASES.map((p, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={p.key} className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[11px] ${active ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" : done ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-[#1f2530] text-muted-foreground"}`}>
              <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-mono ${active ? "bg-fuchsia-500 text-fuchsia-950" : done ? "bg-emerald-500 text-emerald-950" : "border border-[#2b3240]"}`}>
                {done ? <CheckCircle2 className="h-2.5 w-2.5" /> : i + 1}
              </div>
              {p.label}
            </div>
            {i < PHASES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, prev, series, accent, brandNew, icon }: { label: string; value: number; prev: number; series: number[]; accent?: boolean; brandNew?: boolean; icon: React.ReactNode }) {
  const delta = prev === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - prev) / prev) * 100);
  const up = delta > 0;
  return (
    <div className={`border border-[#1f2530] rounded-sm p-3 ${accent ? "bg-emerald-500/5" : "bg-[#0f1116]"}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
      {brandNew ? (
        <div className="text-[10px] text-muted-foreground py-1 italic">Your first log starts here.</div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div className={`text-xl font-mono font-semibold ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</div>
            <Sparkline data={series} color={accent ? "#34d399" : "#a78bfa"} />
          </div>
          {prev > 0 || value > 0 ? (
            <div className={`text-[10px] font-mono mt-1 ${up ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
              {up ? "↑" : delta < 0 ? "↓" : "→"} {Math.abs(delta)}% vs prev 7d
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground mt-1">—</div>
          )}
        </>
      )}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 56, h = 20;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => `${i * step},${h - (v / max) * (h - 2) - 1}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WeeklyRecap({ prev, totals }: { prev: any; evenPrior: any; totals: any }) {
  const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? "+∞" : "0") : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`);
  return (
    <div className="border border-fuchsia-500/30 bg-fuchsia-500/5 rounded-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
        <div className="text-xs font-semibold text-fuchsia-300">Weekly recap</div>
      </div>
      <div className="text-xs text-foreground">
        Last week: <span className="font-mono font-semibold text-emerald-400">{prev.apps}</span> applications, <span className="font-mono font-semibold">{prev.replies}</span> replies, <span className="font-mono font-semibold">{prev.interviews}</span> interviews.
      </div>
      <div className="text-[11px] text-muted-foreground font-mono mt-1">
        Apps {pct(totals.apps, prev.apps)} · Replies {pct(totals.replies, prev.replies)} · Interviews {pct(totals.interviews, prev.interviews)} vs this week so far
      </div>
    </div>
  );
}

function SubmittedRecap({ form, streak, onEdit }: { form: typeof empty; streak: number; onEdit: () => void }) {
  return (
    <div className="border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent rounded-sm p-6 text-center space-y-4">
      <div className="flex justify-center">
        <div className="h-12 w-12 rounded-full bg-emerald-500 text-emerald-950 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold text-emerald-300">Submitted ✓</div>
        <div className="text-[11px] text-muted-foreground mt-1">See you tomorrow.</div>
      </div>
      <div className="flex justify-center gap-6 text-xs font-mono flex-wrap">
        <span><span className="text-emerald-400 text-lg font-semibold">{form.applications_submitted}</span> <span className="text-muted-foreground">apps</span></span>
        <span><span className="text-foreground text-lg font-semibold">{form.outreach_sent}</span> <span className="text-muted-foreground">outreach</span></span>
        <span><span className="text-foreground text-lg font-semibold">{form.replies}</span> <span className="text-muted-foreground">replies</span></span>
        <span><span className="text-emerald-400 text-lg font-semibold">{form.interviews}</span> <span className="text-muted-foreground">int.</span></span>
      </div>
      {streak > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400">
            <Flame className="h-3.5 w-3.5" /> {streak}-day streak
          </div>
        </div>
      )}
      <button onClick={onEdit} className="text-[11px] text-muted-foreground hover:text-foreground underline">Edit today's log</button>
    </div>
  );
}

function ActionSection({ title, icon, children, tone }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: "rose" }) {
  return (
    <div className={`border rounded-sm ${tone === "rose" ? "border-rose-500/30 bg-rose-500/5" : "border-[#1f2530] bg-[#0f1116]"}`}>
      <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${tone === "rose" ? "border-rose-500/20" : "border-[#1f2530]"}`}>
        {icon}<div className="text-xs font-semibold">{title}</div>
      </div>
      <div className="divide-y divide-[#1a1f29]">{children}</div>
    </div>
  );
}

function ActionRow({ a, today, onToggle }: { a: { kind?: "call" | "adhoc"; callId: string; callDate: string; index: number; item: ActionItem }; today: string; onToggle: (id: string, i: number, done: boolean) => void }) {
  const isOverdue = !a.item.done && a.item.due_date && a.item.due_date < today;
  const isAdhoc = a.kind === "adhoc";
  return (
    <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[#141821]">
      <input
        type="checkbox"
        checked={!!a.item.done}
        onChange={e => onToggle(a.callId, a.index, e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-emerald-500"
      />
      <div className="flex-1 min-w-0">
        <div className={`text-xs ${a.item.done ? "line-through text-muted-foreground" : isOverdue ? "text-rose-300" : "text-foreground"}`}>
          {a.item.text || <span className="italic text-muted-foreground">(no text)</span>}
        </div>
        <div className="flex gap-2 mt-1 text-[10px] font-mono text-muted-foreground items-center flex-wrap">
          {isAdhoc ? (
            <span className="px-1.5 py-0.5 rounded-sm border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 uppercase tracking-wider">
              Coach added
            </span>
          ) : (
            <span>from call {a.callDate}</span>
          )}
          {a.item.due_date && (
            <span className={isOverdue ? "text-rose-400" : ""}>
              · due {a.item.due_date}{isOverdue ? " (overdue)" : ""}
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "amber" | "rose" | "neutral" }) {
  const cls = tone === "amber" ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
    : tone === "rose" ? "border-rose-500/30 bg-rose-500/5 text-rose-400"
    : "border-[#1f2530] bg-[#0f1116] text-foreground";
  return (
    <div className={`border rounded-sm p-3 ${cls}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-80 mb-1">{label}</div>
      <div className="text-xl font-mono font-semibold">{value}</div>
    </div>
  );
}

function MilestoneCard({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <div className={`relative overflow-hidden border rounded-sm p-5 ${done ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent" : "border-[#1f2530] bg-[#0a0b0f]"}`}>
      {done && <PartyPopper className="absolute -right-2 -top-2 h-16 w-16 text-emerald-500/10" />}
      <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-3 ${done ? "bg-emerald-500 text-emerald-950" : "border border-[#1f2530] text-muted-foreground"}`}>
        {done ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
      </div>
      <div className={`text-sm font-semibold ${done ? "text-emerald-300" : "text-foreground"}`}>{label}</div>
      {detail && <div className="text-[11px] text-muted-foreground mt-1">{detail}</div>}
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

/* Simple CSS-driven confetti burst. No dep required. */
function ConfettiBurst() {
  const pieces = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1.4 + Math.random() * 0.9,
    color: ["#34d399", "#d946ef", "#fbbf24", "#60a5fa", "#f472b6"][i % 5],
    rotate: Math.random() * 360,
    size: 6 + Math.random() * 6,
  })), []);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map(p => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-20px",
            width: p.size, height: p.size,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
            borderRadius: 2,
          }}
        />
      ))}
      <style>{`@keyframes confetti-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }`}</style>
    </div>
  );
}
