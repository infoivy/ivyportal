import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  ArrowLeft, Video, Trash2, Plus, Save, Calendar as CalIcon,
  Phone, FileText, User, Pencil, ExternalLink, CheckCircle2, Circle,
  Star, HeartHandshake, DollarSign, Trophy, Award, MessageSquare, Link2,
  AlertTriangle, MessageCircle, GraduationCap, Activity,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Student — ISA" }] }),
  component: StudentDetail,
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
  first_win_at: string | null; offers_landed_count: number; offer_landed_at: string | null;
  testimonial_collected: boolean; trustpilot_collected: boolean;
  general_notes: string | null;
};
type Call = {
  id: string; student_id: string; coach_id: string | null; call_date: string;
  status: string | null; progress_rating: number | null; duration_min: number | null;
  fathom_url: string | null; coach_notes: string | null;
  action_items: string | null; outcome: string | null;
  created_at: string;
};
type SEod = {
  id: string; student_id: string; report_date: string;
  applications_submitted: number; outreach_sent: number; replies: number; interviews: number;
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};
type CsmNote = { id: string; student_id: string; user_id: string; note: string; tags: string[] | null; created_at: string };
type Installment = { id: string; total_amount: number; currency: string; notes: string | null };
type Payment = { id: string; installment_id: string; sequence: number; amount: number; currency: string; due_date: string; status: string; paid_at: string | null };
type Coach = { id: string; display_name: string | null };

const PHASES: Phase[] = ["uncategorized", "onboarding", "coaching_1on1", "training", "graduated", "paused"];
const STATUSES: Status[] = ["active", "inactive", "ghosting"];
const GRADES = ["A", "B", "C", "D", "At Risk"];
const PAYMENT_STATES: { key: PaymentState; label: string; color: string }[] = [
  { key: "paid_in_full", label: "Paid in full", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { key: "installments", label: "Installments", color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  { key: "behind", label: "Behind", color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
];

type Tab = "timeline" | "calls" | "eods" | "csm" | "installments" | "notes";

function StudentDetail() {
  const { id } = Route.useParams() as { id: string };
  const nav = useNavigate();
  const { roles, user } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("coach");
  const isCsm = roles.includes("csm") || roles.includes("admin");

  const [student, setStudent] = useState<Student | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [eods, setEods] = useState<SEod[]>([]);
  const [csmNotes, setCsmNotes] = useState<CsmNote[]>([]);
  const [csmAuthors, setCsmAuthors] = useState<Record<string, string>>({});
  const [installment, setInstallment] = useState<Installment | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [callFormOpen, setCallFormOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("timeline");

  const load = async () => {
    const [sRes, cRes, eRes, coachRes, csmRes, instRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", id).maybeSingle(),
      supabase.from("student_calls").select("*").eq("student_id", id).order("call_date", { ascending: false }),
      supabase.from("student_eods").select("*").eq("student_id", id).order("report_date", { ascending: false }),
      supabase.from("user_roles").select("user_id, role").in("role", ["coach", "admin"]),
      supabase.from("csm_student_notes").select("*").eq("student_id", id).order("created_at", { ascending: false }),
      supabase.from("installments").select("*").eq("student_id", id).maybeSingle(),
    ]);
    setStudent((sRes.data as Student) ?? null);
    setCalls((cRes.data ?? []) as Call[]);
    setEods((eRes.data ?? []) as SEod[]);
    setCsmNotes((csmRes.data ?? []) as CsmNote[]);
    setInstallment((instRes.data as Installment) ?? null);

    const coachIds = Array.from(new Set((coachRes.data ?? []).map(r => r.user_id)));
    const csmAuthorIds = Array.from(new Set((csmRes.data ?? []).map((n: any) => n.user_id)));
    const allProfIds = Array.from(new Set([...coachIds, ...csmAuthorIds]));
    if (allProfIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", allProfIds);
      setCoaches((profs ?? []).filter((p: any) => coachIds.includes(p.id)) as Coach[]);
      const authors: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { authors[p.id] = p.display_name ?? "Unknown"; });
      setCsmAuthors(authors);
    }
    if (instRes.data) {
      const { data: pRows } = await supabase.from("installment_payments").select("*").eq("installment_id", (instRes.data as any).id).order("sequence");
      setPayments((pRows ?? []) as Payment[]);
    } else {
      setPayments([]);
    }
  };

  useEffect(() => { load(); }, [id]);

  // ---- Derived stats (all hooks BEFORE any early return) ----
  const totals = useMemo(() => eods.reduce((a, e) => ({
    apps: a.apps + e.applications_submitted,
    outreach: a.outreach + e.outreach_sent,
    replies: a.replies + e.replies,
    interviews: a.interviews + e.interviews,
  }), { apps: 0, outreach: 0, replies: 0, interviews: 0 }), [eods]);

  const callsUsed = useMemo(() => calls.filter(c => c.status === "completed").length, [calls]);
  const ratings = useMemo(
    () => calls.filter(c => c.status === "completed" && typeof c.progress_rating === "number")
      .sort((a, b) => a.call_date.localeCompare(b.call_date))
      .map(c => c.progress_rating!) as number[],
    [calls]
  );
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;

  const apps7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return eods.filter(e => new Date(e.report_date).getTime() >= cutoff)
      .reduce((sum, e) => sum + (e.applications_submitted ?? 0), 0);
  }, [eods]);

  const daysSince = (d: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;
  const lastCallDaysAgo = calls.length ? daysSince(calls[0].call_date) : null;
  const lastEodDaysAgo = eods.length ? daysSince(eods[0].report_date) : null;

  const graduationSteps = useMemo(() => student ? [
    { key: "first_win", label: "First win", done: !!student.first_win_at, at: student.first_win_at, icon: Star },
    { key: "offer", label: "Offer landed", done: !!student.offer_landed_at, at: student.offer_landed_at, icon: Trophy },
    { key: "testimonial", label: "Testimonial", done: student.testimonial_collected, at: null, icon: Award },
    { key: "trustpilot", label: "Trustpilot", done: student.trustpilot_collected, at: null, icon: MessageSquare },
  ] : [], [student]);
  const graduationDone = graduationSteps.filter(s => s.done).length;

  if (!student) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const coachName = (uid: string | null) => uid ? (coaches.find(c => c.id === uid)?.display_name ?? uid.slice(0, 8)) : "Unassigned";
  const paymentMeta = PAYMENT_STATES.find(p => p.key === student.payment_state);

  const update = async (patch: Partial<Student>) => {
    setStudent(s => s ? { ...s, ...patch } : s);
    const { error } = await supabase.from("students").update(patch as any).eq("id", student.id);
    if (error) { toast.error(error.message); load(); }
  };

  const toggleGradStep = async (key: string) => {
    if (!canManage) return;
    const now = new Date().toISOString();
    if (key === "first_win") await update({ first_win_at: student.first_win_at ? null : now });
    if (key === "offer") await update({
      offer_landed_at: student.offer_landed_at ? null : now,
      offers_landed_count: student.offer_landed_at ? student.offers_landed_count : Math.max(1, student.offers_landed_count),
    });
    if (key === "testimonial") await update({ testimonial_collected: !student.testimonial_collected });
    if (key === "trustpilot") await update({ trustpilot_collected: !student.trustpilot_collected });
  };

  const deleteCall = async (cid: string) => {
    if (!confirm("Delete this call record?")) return;
    const { error } = await supabase.from("student_calls").delete().eq("id", cid);
    if (error) return toast.error(error.message);
    toast.success("Call deleted");
    load();
  };

  const saveNextAction = async (v: string) => {
    await update({ next_action: v.trim() || null });
  };
  const saveGeneralNotes = async () => {
    const { error } = await supabase.from("students").update({ general_notes: student.general_notes } as any).eq("id", student.id);
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
  };

  const addCsmNote = async (note: string) => {
    if (!note.trim() || !user) return;
    const { error } = await supabase.from("csm_student_notes").insert({ student_id: student.id, user_id: user.id, note: note.trim() } as any);
    if (error) return toast.error(error.message);
    toast.success("Note added");
    load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-center justify-between border-b border-[#1f2530] pb-4">
        <button onClick={() => nav({ to: "/students" })} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to students
        </button>
      </div>

      {/* Header */}
      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-14 w-14 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 text-lg font-bold shrink-0">
            {student.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold">{student.full_name}</h1>
              {student.user_id ? (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">
                  <Link2 className="h-2.5 w-2.5" /> Portal linked
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                  <AlertTriangle className="h-2.5 w-2.5" /> Portal not linked
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{student.email ?? "no email"}</span>
              {student.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-400" /> {student.whatsapp}</span>}
              <span>joined {student.join_date}</span>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 items-center">
              {canManage ? (
                <>
                  <SelectChip value={student.phase} onChange={v => update({ phase: v as Phase })} options={PHASES.map(p => ({ v: p, l: p.replace("_", " ") }))} color="fuchsia" />
                  <SelectChip value={student.status} onChange={v => update({ status: v as Status })} options={STATUSES.map(s => ({ v: s, l: s }))} color={student.status === "active" ? "emerald" : student.status === "ghosting" ? "rose" : "zinc"} />
                  <SelectChip value={student.coach_id ?? ""} onChange={v => update({ coach_id: v || null })} options={[{ v: "", l: "Unassigned" }, ...coaches.map(c => ({ v: c.id, l: c.display_name ?? "?" }))]} color="sky" prefix="Coach: " />
                  <SelectChip
                    value={student.student_grade ?? ""}
                    onChange={v => update({ student_grade: v || null })}
                    options={[{ v: "", l: "No grade" }, ...GRADES.map(g => ({ v: g, l: g }))]}
                    color="amber" prefix="Grade: "
                  />
                  <SelectChip
                    value={student.payment_state ?? ""}
                    onChange={v => update({ payment_state: (v || null) as PaymentState | null })}
                    options={[{ v: "", l: "Unknown" }, ...PAYMENT_STATES.map(p => ({ v: p.key, l: p.label }))]}
                    color={student.payment_state === "behind" ? "rose" : student.payment_state === "paid_in_full" ? "emerald" : "sky"}
                    prefix="Pay: "
                  />
                </>
              ) : (
                <>
                  <Chip label={student.phase.replace("_", " ")} color="fuchsia" />
                  <Chip label={student.status} color={student.status === "active" ? "emerald" : student.status === "ghosting" ? "rose" : "zinc"} />
                  <Chip label={`Coach: ${coachName(student.coach_id)}`} color="sky" />
                  {student.student_grade && <Chip label={`Grade ${student.student_grade}`} color="amber" />}
                  {paymentMeta && <Chip label={paymentMeta.label} color={student.payment_state === "behind" ? "rose" : student.payment_state === "paid_in_full" ? "emerald" : "sky"} />}
                </>
              )}
            </div>

            {/* Next action */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Next action</span>
              <input
                disabled={!canManage}
                defaultValue={student.next_action ?? ""}
                onBlur={e => { if (e.target.value !== (student.next_action ?? "")) saveNextAction(e.target.value); }}
                placeholder="e.g. Follow up on portfolio review by Friday"
                className="flex-1 h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs focus:outline-none focus:border-emerald-500/40 disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatCard
          label="Calls used"
          value={`${callsUsed}/${student.calls_allotted}`}
          sub={`${Math.max(0, student.calls_allotted - callsUsed)} remaining`}
          accent={callsUsed >= student.calls_allotted ? "rose" : "sky"}
          icon={<Phone className="h-3 w-3" />}
        />
        <StatCard
          label="Rating trend"
          value={avgRating ? avgRating.toFixed(1) : "—"}
          sub={ratings.length ? `${ratings.length} rated calls` : "No ratings yet"}
          accent="amber"
          icon={<Star className="h-3 w-3" />}
          sparkline={ratings}
        />
        <StatCard
          label="Applications 7d"
          value={apps7d}
          sub={`${totals.apps} total`}
          accent={apps7d === 0 ? "rose" : "emerald"}
          icon={<Trophy className="h-3 w-3" />}
        />
        <StatCard
          label="Since last 1:1"
          value={lastCallDaysAgo == null ? "—" : `${lastCallDaysAgo}d`}
          sub={calls.length ? `${calls.length} calls total` : "No calls yet"}
          accent={lastCallDaysAgo != null && lastCallDaysAgo > 14 ? "rose" : "sky"}
          icon={<CalIcon className="h-3 w-3" />}
        />
        <StatCard
          label="Since last EOD"
          value={lastEodDaysAgo == null ? "—" : `${lastEodDaysAgo}d`}
          sub={eods.length ? `${eods.length} EODs total` : "None submitted"}
          accent={lastEodDaysAgo != null && lastEodDaysAgo >= 5 ? "rose" : "emerald"}
          icon={<FileText className="h-3 w-3" />}
        />
      </div>

      {/* Graduation checklist */}
      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <GraduationCap className="h-3 w-3 text-amber-400" /> Graduation checklist
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {graduationDone}/4 {graduationDone === 4 && <span className="text-amber-400 ml-1">🏆 Complete</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {graduationSteps.map(step => {
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => toggleGradStep(step.key)}
                disabled={!canManage}
                className={`flex items-center gap-2 p-2.5 rounded-sm border text-left transition ${
                  step.done
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-[#1f2530] bg-[#14171e] text-muted-foreground hover:border-[#2a3140]"
                } ${!canManage ? "cursor-default" : "cursor-pointer"}`}
              >
                {step.done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
                <div className="min-w-0">
                  <div className="text-xs font-medium flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {step.label}
                  </div>
                  {step.at && <div className="text-[9px] font-mono text-muted-foreground">{new Date(step.at).toISOString().slice(0, 10)}</div>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-[#14171e] overflow-hidden">
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${(graduationDone / 4) * 100}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#1f2530] overflow-x-auto">
        <TabBtn active={tab === "calls"} onClick={() => setTab("calls")} icon={<Phone className="h-3 w-3" />}>1:1 timeline ({calls.length})</TabBtn>
        <TabBtn active={tab === "eods"} onClick={() => setTab("eods")} icon={<User className="h-3 w-3" />}>Student EODs ({eods.length})</TabBtn>
        {isCsm && <TabBtn active={tab === "csm"} onClick={() => setTab("csm")} icon={<HeartHandshake className="h-3 w-3" />}>CSM notes ({csmNotes.length})</TabBtn>}
        <TabBtn active={tab === "installments"} onClick={() => setTab("installments")} icon={<DollarSign className="h-3 w-3" />}>Installments {installment ? `(${payments.filter(p => p.status === "paid").length}/${payments.length})` : ""}</TabBtn>
        <TabBtn active={tab === "notes"} onClick={() => setTab("notes")} icon={<FileText className="h-3 w-3" />}>General notes</TabBtn>
      </div>

      {tab === "calls" && (
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
                    {c.status && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">· {c.status}</span>}
                    {c.progress_rating && (
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < c.progress_rating! ? "fill-amber-400 text-amber-400" : "text-[#2a3140]"}`} />
                        ))}
                      </span>
                    )}
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
      )}

      {tab === "eods" && (
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
      )}

      {tab === "csm" && isCsm && (
        <CsmNotesPanel notes={csmNotes} authors={csmAuthors} onAdd={addCsmNote} />
      )}

      {tab === "installments" && (
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4 space-y-3">
          {!installment ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No installment plan for this student.
              <div className="mt-2">
                <Link to="/installments" className="text-emerald-400 hover:text-emerald-300 text-[11px]">Manage on Installments page →</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-emerald-400" /> {installment.currency} {installment.total_amount.toLocaleString()}</div>
                  {installment.notes && <div className="text-[11px] text-muted-foreground mt-0.5">{installment.notes}</div>}
                </div>
                <Link to="/installments" className="text-[11px] text-emerald-400 hover:text-emerald-300">Edit plan →</Link>
              </div>
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-[#1a1f29]"><th className="text-left p-2">#</th><th className="text-left p-2">Due</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Status</th></tr>
                </thead>
                <tbody>
                  {payments.map(p => {
                    const overdue = p.status !== "paid" && new Date(p.due_date) < new Date();
                    return (
                      <tr key={p.id} className="border-b border-[#1a1f29]">
                        <td className="p-2 font-mono text-muted-foreground">{p.sequence}</td>
                        <td className={`p-2 font-mono ${overdue ? "text-rose-400" : "text-muted-foreground"}`}>{p.due_date}</td>
                        <td className="p-2 text-right font-mono">{p.currency} {Number(p.amount).toLocaleString()}</td>
                        <td className={`p-2 uppercase tracking-wider text-[10px] ${p.status === "paid" ? "text-emerald-400" : overdue ? "text-rose-400" : "text-muted-foreground"}`}>{overdue ? "overdue" : p.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> General notes</div>
            {canManage && (
              <button onClick={saveGeneralNotes} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><Save className="h-3 w-3" /> Save</button>
            )}
          </div>
          <textarea
            disabled={!canManage}
            value={student.general_notes ?? ""}
            onChange={e => setStudent({ ...student, general_notes: e.target.value })}
            rows={8}
            placeholder="Anything worth remembering: personality, background, wins, ongoing themes…"
            className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-emerald-500/40"
          />
          <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Legacy coach notes</div>
          <textarea
            disabled={!canManage}
            value={student.notes ?? ""}
            onChange={e => setStudent({ ...student, notes: e.target.value })}
            onBlur={async () => { await supabase.from("students").update({ notes: student.notes }).eq("id", student.id); }}
            rows={3}
            placeholder="Original coach notes field (kept for history)"
            className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-emerald-500/40"
          />
        </div>
      )}
    </div>
  );
}

function CsmNotesPanel({ notes, authors, onAdd }: { notes: CsmNote[]; authors: Record<string, string>; onAdd: (n: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4 space-y-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        <HeartHandshake className="h-3 w-3 text-amber-400" /> CSM notes
      </div>
      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={2}
          placeholder="Loom reviewed, roleplay feedback, check-in outcome…"
          className="flex-1 bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-emerald-500/40"
        />
        <button
          onClick={() => { onAdd(draft); setDraft(""); }}
          disabled={!draft.trim()}
          className="text-xs bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-emerald-950 font-medium px-3 rounded-sm"
        >Add</button>
      </div>
      <div className="space-y-2">
        {notes.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No CSM notes yet.</div>}
        {notes.map(n => (
          <div key={n.id} className="border border-[#1a1f29] bg-[#14171e] rounded-sm p-2.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 font-mono">
              <span>{authors[n.user_id] ?? "Unknown"}</span>
              <span>{new Date(n.created_at).toISOString().slice(0, 10)}</span>
            </div>
            <div className="text-xs whitespace-pre-wrap">{n.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBtn({ children, active, onClick, icon }: { children: React.ReactNode; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 -mb-px transition whitespace-nowrap ${
        active ? "border-emerald-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}{children}
    </button>
  );
}

function StatCard({ label, value, sub, accent, icon, sparkline }: {
  label: string; value: React.ReactNode; sub?: string; accent: "emerald" | "sky" | "rose" | "amber" | "fuchsia";
  icon: React.ReactNode; sparkline?: number[];
}) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-400", sky: "text-sky-400", rose: "text-rose-400", amber: "text-amber-400", fuchsia: "text-fuchsia-400",
  };
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-3">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-xl font-mono font-semibold ${colors[accent]}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} color={colors[accent]} />}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 100, h = 20, max = 5, min = 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`mt-1 w-full h-4 ${color}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SelectChip({ value, onChange, options, color, prefix }: {
  value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[];
  color: "emerald" | "rose" | "zinc" | "fuchsia" | "sky" | "amber"; prefix?: string;
}) {
  const map = {
    emerald: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    rose: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    zinc: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5",
    fuchsia: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10",
    sky: "text-sky-400 border-sky-500/30 bg-sky-500/10",
    amber: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  } as const;
  return (
    <div className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider pl-2 pr-1 py-0.5 rounded-sm border ${map[color]}`}>
      {prefix && <span>{prefix}</span>}
      <select value={value} onChange={e => onChange(e.target.value)} className="bg-transparent text-inherit outline-none pr-1">
        {options.map(o => <option key={o.v} value={o.v} className="bg-[#0f1116] text-foreground normal-case">{o.l}</option>)}
      </select>
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

function CallForm({ studentId, onCancel, onDone }: { studentId: string; onCancel: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    call_date: new Date().toISOString().slice(0, 10),
    status: "completed",
    progress_rating: 3,
    fathom_url: "", action_items: "", coach_notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (form.status === "completed" && (!form.progress_rating || form.progress_rating < 1)) {
      return toast.error("Set a 1–5 rating before saving a completed call.");
    }
    setSaving(true);
    const { error } = await supabase.from("student_calls").insert({
      student_id: studentId,
      coach_id: user?.id ?? null,
      call_date: form.call_date,
      status: form.status as any,
      progress_rating: form.progress_rating || null,
      fathom_url: form.fathom_url.trim() || null,
      action_items: form.action_items.trim() || null,
      coach_notes: form.coach_notes.trim() || null,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Call logged");
    onDone();
  };

  return (
    <div className="p-3 border-b border-[#1f2530] bg-[#14171e] space-y-2">
      <div className="grid md:grid-cols-3 gap-2">
        <input type="date" value={form.call_date} onChange={e => setForm(f => ({ ...f, call_date: e.target.value }))} className="h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs" />
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs">
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="follow_up">Follow-up</option>
          <option value="no_show">No-show</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setForm(f => ({ ...f, progress_rating: n }))} className="p-0.5">
              <Star className={`h-4 w-4 ${n <= form.progress_rating ? "fill-amber-400 text-amber-400" : "text-[#2a3140]"}`} />
            </button>
          ))}
        </div>
      </div>
      <input placeholder="Fathom URL (optional)" value={form.fathom_url} onChange={e => setForm(f => ({ ...f, fathom_url: e.target.value }))} className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs" />
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
