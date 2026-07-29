import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useStudentHealth } from "@/lib/use-student-health";
import { BAND_META } from "@/lib/student-health";
import { useEffect, useMemo, useState } from "react";
import { PageSkeleton } from "@/components/ui/skeletons";
import { PlacementsSection } from "@/components/student-placements";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateForTables } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { DateField } from "@/components/ui/date-field";
import { SelectField } from "@/components/ui/select-field";
import { StudentPaymentSetup } from "@/components/student-payment-setup";
import { StudentLocalTime, timezoneOptions } from "@/components/student-local-time";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { humanDue } from "@/lib/dates";
import {
  ArrowLeft, Video, Trash2, ArchiveX, Plus, Save, Calendar as CalIcon,
  Phone, FileText, User, Pencil, ExternalLink, CheckCircle2, Circle,
  Star, HeartHandshake, DollarSign, Trophy, Award, MessageSquare, Link2,
  AlertTriangle, MessageCircle, GraduationCap, Activity, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Student · ISA" }] }),
  validateSearch: (s: Record<string, unknown>): { setup?: string } =>
    typeof s.setup === "string" ? { setup: s.setup } : {},
  component: StudentDetail,
});

type Phase = "uncategorized" | "onboarding" | "coaching_1on1" | "applying" | "offer_won" | "testimonial" | "training" | "graduated" | "paused";
type Status = "active" | "inactive" | "ghosting";
type PaymentState = "paid_in_full" | "installments" | "behind" | "scholarship";
type Student = {
  id: string; user_id: string | null; full_name: string; email: string | null;
  phase: Phase; status: Status; coach_id: string | null;
  join_date: string; calls_included: number; notes: string | null;
  student_grade: string | null; whatsapp: string | null; next_action: string | null;
  eod_exempt: boolean | null;
  calls_allotted: number; payment_state: PaymentState | null;
  first_win_at: string | null; offers_landed_count: number; offer_landed_at: string | null;
  testimonial_collected: boolean; trustpilot_collected: boolean; testimonial_requested?: boolean;
  general_notes: string | null;
  onboarding_completed_at: string | null;
  timezone: string | null;
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
  roleplays: number | null; looms_sent: number | null;
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};
type StudentWeeklyEod = {
  id: string; student_id: string; week_start: string; group_calls_attended: number;
  calls_attended?: { day?: string; name?: string }[] | null; one_on_one_calls?: number | null;
  implementation: string; biggest_win: string | null; biggest_blocker: string | null;
  next_week_commitment: string; submitted_at: string;
};
type CsmNote = { id: string; student_id: string; user_id: string; note: string; tags: string[] | null; created_at: string };
type AdhocItem = { id: string; text: string; done: boolean; due_date: string | null; created_at: string };
type Installment = { id: string; total_amount: number; currency: string; notes: string | null };
type Payment = { id: string; installment_id: string; sequence: number; amount: number; currency: string; due_date: string; status: string; paid_at: string | null };
type Coach = { id: string; display_name: string | null };

const PHASES: Phase[] = ["onboarding", "training", "applying", "offer_won", "paused"];
const STATUSES: Status[] = ["active", "inactive", "ghosting"];
const GRADES = ["A", "B", "C", "D", "At Risk"];
const PAYMENT_STATES: { key: PaymentState; label: string; color: string }[] = [
  { key: "paid_in_full", label: "Paid in full", color: "text-success-fg border-success/25 bg-success-bg" },
  { key: "installments", label: "Installments", color: "text-muted-foreground border-border bg-muted" },
  { key: "behind", label: "Behind", color: "text-danger-fg border-danger/25 bg-danger-bg" },
  { key: "scholarship", label: "Scholarship", color: "text-primary border-primary/25 bg-primary/10" },
];

type Milestone = { id: string; name: string; sort_order: number };
type Tab = "timeline" | "calls" | "eods" | "csm" | "installments" | "notes";

function StudentDetail() {
  const { id } = Route.useParams() as { id: string };
  const nav = useNavigate();
  const { roles, user } = useAuth();
  const qc = useQueryClient();
  // CSMs run fulfillment: they approve looms, unlock portals, and keep
  // student state current (founder-directed 2026-07-18; RLS matches).
  const canManage = roles.includes("admin") || roles.includes("coach") || roles.includes("csm");
  const isCsm = roles.includes("csm") || roles.includes("admin");

  const [student, setStudent] = useState<Student | null>(null);
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);
  const { setup } = Route.useSearch();
  useEffect(() => {
    if (setup === "payment" && student && !student.payment_state) setPaymentSetupOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, student?.id]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [eods, setEods] = useState<SEod[]>([]);
  const [weeklyEods, setWeeklyEods] = useState<StudentWeeklyEod[]>([]);
  const [weeklyEodLoadError, setWeeklyEodLoadError] = useState(false);
  const [csmNotes, setCsmNotes] = useState<CsmNote[]>([]);
  const [csmAuthors, setCsmAuthors] = useState<Record<string, string>>({});
  const [installment, setInstallment] = useState<Installment | null>(null);
  const [hasDeal, setHasDeal] = useState(true);
  const [adhocItems, setAdhocItems] = useState<AdhocItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneProgress, setMilestoneProgress] = useState<Set<string>>(new Set());
  const [callFormOpen, setCallFormOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("timeline");
  const { data: healthMap } = useStudentHealth();

  const milestonesQ = useQuery({
    queryKey: ["page", "student", id, "milestones"],
    queryFn: async () => {

      const [mRes, mpRes] = await Promise.all([

        (supabase as any).from("student_milestones").select("id, name, sort_order").order("sort_order"),

        (supabase as any).from("student_milestone_progress").select("milestone_id").eq("student_id", id),
      ]);
      return {
        milestones: (mRes.data ?? []) as Milestone[],
        done: ((mpRes.data ?? []) as any[]).map((r: any) => r.milestone_id) as string[],
      };
    },
  });
  useEffect(() => {
    if (!milestonesQ.data) return;
    setMilestones(milestonesQ.data.milestones);
    setMilestoneProgress(new Set(milestonesQ.data.done));
  }, [milestonesQ.data]);
  const loadMilestones = () => milestonesQ.refetch();

  const toggleMilestone = async (milestoneId: string) => {
    const has = milestoneProgress.has(milestoneId);
    if (has) {

      const { error } = await (supabase as any).from("student_milestone_progress")
        .delete().eq("student_id", id).eq("milestone_id", milestoneId);
      if (error) return toast.error(error.message);
    } else {

      const { error } = await (supabase as any).from("student_milestone_progress")
        .insert({ student_id: id, milestone_id: milestoneId });
      if (error) return toast.error(error.message);
    }
    loadMilestones();
  };

  const fetchPage = async () => {
    const [sRes, cRes, eRes, weeklyRes, coachRes, csmRes, instRes, dealRes, aiRes] = await Promise.all([
      supabase.from("students").select("*").eq("is_demo", false).eq("id", id).maybeSingle(),
      supabase.from("student_calls").select("*, students!inner(is_demo)").eq("students.is_demo", false).eq("student_id", id).is("voided_at", null).order("call_date", { ascending: false }),
      supabase.from("student_eods").select("*, students!inner(is_demo)").eq("students.is_demo", false).eq("student_id", id).order("report_date", { ascending: false }),
      supabase.from("student_weekly_eods").select("*, students!inner(is_demo)").eq("students.is_demo", false).eq("student_id", id).order("week_start", { ascending: false }),
      supabase.from("user_roles").select("user_id, role").in("role", ["coach", "admin"]),
      supabase.from("csm_student_notes").select("*, students!inner(is_demo)").eq("students.is_demo", false).eq("student_id", id).order("created_at", { ascending: false }),
      supabase.from("installments").select("*, students!inner(is_demo)").eq("students.is_demo", false).is("voided_at", null).eq("student_id", id).maybeSingle(),
      supabase.from("deals").select("id").eq("is_demo", false).is("voided_at", null).eq("student_id", id).limit(1),
      supabase.from("student_action_items").select("id, text, done, due_date, created_at, students!inner(is_demo)").eq("is_demo", false).eq("students.is_demo", false).eq("student_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    const coachIds = Array.from(new Set((coachRes.data ?? []).map(r => r.user_id)));
    const csmAuthorIds = Array.from(new Set((csmRes.data ?? []).map((n: any) => n.user_id)));
    const allProfIds = Array.from(new Set([...coachIds, ...csmAuthorIds]));
    let coachList: Coach[] = [];
    const authors: Record<string, string> = {};
    if (allProfIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").eq("is_demo", false).in("id", allProfIds);
      coachList = (profs ?? []).filter((p: any) => coachIds.includes(p.id)) as Coach[];
      (profs ?? []).forEach((p: any) => { authors[p.id] = p.display_name ?? "Unknown"; });
    }
    let payments: Payment[] = [];
    if (instRes.data) {
      const { data: pRows } = await supabase.from("installment_payments").select("*, installments!inner(students!inner(is_demo))").eq("installments.students.is_demo", false).eq("installment_id", (instRes.data as any).id).order("sequence");
      payments = (pRows ?? []) as Payment[];
    }
    return {
      student: (sRes.data as Student) ?? null,
      calls: (cRes.data ?? []) as Call[],
      eods: (eRes.data ?? []) as SEod[],
      weeklyEods: (weeklyRes.data ?? []) as StudentWeeklyEod[],
      weeklyEodLoadError: Boolean(weeklyRes.error),
      csmNotes: (csmRes.data ?? []) as CsmNote[],
      installment: (instRes.data as Installment) ?? null,
      hasDeal: (dealRes.data ?? []).length > 0,
      adhocItems: (aiRes.data ?? []) as AdhocItem[],
      coachList, authors, payments,
    };
  };

  const pageQ = useQuery({ queryKey: ["page", "student", id], queryFn: fetchPage });
  useEffect(() => {
    if (!pageQ.data) return;
    setStudent(pageQ.data.student);
    setCalls(pageQ.data.calls);
    setEods(pageQ.data.eods);
    setWeeklyEods(pageQ.data.weeklyEods);
    setWeeklyEodLoadError(pageQ.data.weeklyEodLoadError);
    setCsmNotes(pageQ.data.csmNotes);
    setInstallment(pageQ.data.installment);
    setHasDeal(pageQ.data.hasDeal);
    setAdhocItems(pageQ.data.adhocItems);
    setCoaches(pageQ.data.coachList);
    setCsmAuthors(pageQ.data.authors);
    setPayments(pageQ.data.payments);
  }, [pageQ.data]);
  const load = () => pageQ.refetch();

  // ---- Derived stats (all hooks BEFORE any early return) ----
  const totals = useMemo(() => eods.reduce((a, e) => ({
    apps: a.apps + e.applications_submitted,
    interviews: a.interviews + e.interviews,
  }), { apps: 0, interviews: 0 }), [eods]);

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
    { key: "testimonial", label: student.testimonial_requested && !student.testimonial_collected ? "Testimonial (requested)" : "Testimonial", done: student.testimonial_collected, at: null, icon: Award },
    { key: "trustpilot", label: "Trustpilot", done: student.trustpilot_collected, at: null, icon: MessageSquare },
  ] : [], [student]);
  const graduationDone = graduationSteps.filter(s => s.done).length;

  // Staff tracker only — students have their own portal and must never see
  // this view of themselves (grades, next actions, pathway internals).
  if (!["admin", "closer", "csm", "coach", "founder", "cofounder"].some(r => roles.includes(r))) {
    return (
      <div className="w-full max-w-none p-4 sm:p-6">
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">Staff access required.</div>
      </div>
    );
  }

  if (!student) return <PageSkeleton />;

  const coachName = (uid: string | null) => uid ? (coaches.find(c => c.id === uid)?.display_name ?? uid.slice(0, 8)) : "Unassigned";
  const paymentMeta = PAYMENT_STATES.find(p => p.key === student.payment_state);

  const update = async (patch: Partial<Student>) => {
    setStudent(s => s ? { ...s, ...patch } : s);
    const { error } = await supabase.from("students").update(patch as any).eq("id", student.id);
    if (error) { toast.error(error.message); load(); return; }
    // The save is instant, but the page hydrates from the react-query cache
    // (60s staleTime) on remount — patch the cache too or navigating away and
    // back shows the old value and the edit looks like it didn't stick.
    qc.setQueryData(["page", "student", id], (old: unknown) => {
      const o = old as { student?: Student } | undefined;
      return o?.student ? { ...o, student: { ...o.student, ...patch } } : old;
    });
    // Coach/phase/status changes must reach the roster, CSM workspace,
    // overview counts, health scores, and bell alike.
    invalidateForTables(qc, ["students"]);
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
    const reason = prompt("Why should this call be removed from active records?")?.trim();
    if (!reason) return;
    if (reason.length < 3) return toast.error("Enter a short correction reason.");
    const { error } = await supabase.rpc("void_student_call", { p_call_id: cid, p_reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Call removed from active records · history preserved");
    invalidateForTables(qc, ["student_calls"]);
    load();
  };

  // Next actions ARE action items (founder-directed 2026-07-22, composer +
  // due date + multi-add 2026-07-26). students.next_action mirrors the most
  // recent one so the roster column and at-risk copy keep working.
  const addNextAction = async (text: string, due: string | null) => {
    if (!user) return;
    const { error } = await supabase.from("student_action_items").insert({
      student_id: student.id, created_by: user.id, text, due_date: due,
    });
    if (error) { toast.error(error.message); return; }
    await update({ next_action: text });
    toast.success(due ? `Action item added · ${humanDue(due)}` : "Action item added");
    invalidateForTables(qc, ["student_action_items"]);
    load();
  };

  const toggleActionItem = async (itemId: string, done: boolean) => {
    const { error } = await supabase.from("student_action_items")
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq("id", itemId);
    if (error) { toast.error(error.message); return; }
    invalidateForTables(qc, ["student_action_items"]);
    load();
  };

  const renameStudent = async (name: string) => {
    const clean = name.trim();
    if (!clean || !student || clean === student.full_name) return;
    const { error } = await supabase.from("students").update({ full_name: clean }).eq("id", student.id);
    if (error) return toast.error(error.message);
    // The database trigger keeps denormalized money labels in sync without
    // granting student-success roles direct write access to finance records.
    toast.success("Name updated");
    invalidateForTables(qc, ["students", "deals", "installments"]);
    load();
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
    <div className="w-full max-w-none p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <button onClick={() => nav({ to: "/students" })} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to students
        </button>
      </div>

      {/* Header */}
      <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-14 w-14 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground text-lg font-semibold shrink-0">
            {student.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold flex items-center gap-2.5">
                <EditableName
                  value={student.full_name}
                  canEdit={canManage || roles.includes("closer")}
                  onSave={renameStudent}
                />
                {(() => {
                  const h = healthMap?.get(student.id);
                  return h ? (
                    <span
                      className={`text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full border ${BAND_META[h.band].chip}`}
                      title={h.reasons.join(" · ") || "All signals healthy"}
                    >
                      {BAND_META[h.band].label} · {h.score}
                    </span>
                  ) : null;
                })()}
              </h1>
              {student.user_id ? (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-success-fg border border-success/25 bg-success-bg px-1.5 py-0.5 rounded-sm">
                  <Link2 className="h-2.5 w-2.5" /> Portal linked
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-warning-fg border border-warning/25 bg-warning-bg px-1.5 py-0.5 rounded-sm">
                  <AlertTriangle className="h-2.5 w-2.5" /> Portal not linked
                </span>
              )}
            </div>
            {paymentSetupOpen && (
              <StudentPaymentSetup
                student={{ id: student.id, full_name: student.full_name, coach_id: student.coach_id }}
                onClose={() => setPaymentSetupOpen(false)}
                onDone={() => { setPaymentSetupOpen(false); load(); }}
              />
            )}
            {/* Keyed off the DEAL, not payment_state: "skip for now" during
                approval left students with no close on record, and setting the
                Pay chip used to bury this entrance forever. */}
            {!hasDeal && student.payment_state !== "scholarship" && (roles.includes("admin") || roles.includes("closer")) && (
              <button
                onClick={() => setPaymentSetupOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-caption font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors"
              >
                {student.payment_state ? "Log the close · no deal on record" : "Log close · set up payment"}
              </button>
            )}
            <div className="text-xs text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{student.email ?? "no email"}</span>
              {student.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-success-fg" /> {student.whatsapp}</span>}
              <span>joined {student.join_date}</span>
              <StudentLocalTime tz={student.timezone} className="text-xs" />
              {canManage && (
                <select
                  value={student.timezone ?? ""}
                  onChange={e => update({ timezone: e.target.value || null })}
                  className="h-6 rounded-sm border border-[var(--border)] bg-[var(--background)] px-1 text-[10px] text-muted-foreground focus:outline-none focus:border-ring max-w-[150px]"
                  title="Student timezone (auto-synced from their browser when they use the portal)"
                >
                  <option value="">tz unknown</option>
                  {timezoneOptions().map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-4 items-center">
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
                  <SelectChip
                    value={student.eod_exempt ? "off" : "on"}
                    onChange={v => update({ eod_exempt: v === "off" } as never)}
                    options={[{ v: "on", l: "tracked" }, { v: "off", l: "off · no alerts" }]}
                    color={student.eod_exempt ? "zinc" : "emerald"}
                    prefix="EODs: "
                  />
                  <SelectChip
                    value={student.calls_allotted > 0 ? "1on1" : "group"}
                    onChange={async v => {
                      await update({ calls_allotted: v === "1on1" ? (student.calls_allotted > 0 ? student.calls_allotted : 10) : 0 });
                      // Group students must never see 1:1 anything — clear the
                      // auto "book your 1:1s" task if they had one.
                      if (v === "group") {
                        await supabase.from("student_action_items").delete()
                          .eq("student_id", student.id).eq("done", false)
                          .ilike("text", "Book your 1:1 coaching calls%");
                      }
                    }}
                    options={[{ v: "1on1", l: "1:1 Pathway" }, { v: "group", l: "Group Expertise" }]}
                    color="sky" prefix="Program: "
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

            {/* Onboarding + loom approval — the two gates a CSM controls */}
            {canManage && (!student.onboarding_completed_at || !["applying", "offer_won", "testimonial", "paused"].includes(student.phase)) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!student.onboarding_completed_at && (
                  <>
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-warning-fg border border-warning/25 bg-warning-bg px-1.5 py-0.5 rounded-sm">
                      <AlertTriangle className="h-2.5 w-2.5" /> Start Here incomplete · portal locked
                    </span>
                    <button
                      onClick={() => update({ onboarding_completed_at: new Date().toISOString() })}
                      className="text-caption font-medium px-2.5 py-1 rounded-md border border-border text-foreground hover:bg-muted motion-safe:transition-colors"
                    >
                      Unlock portal now
                    </button>
                  </>
                )}
                {student.onboarding_completed_at && !["applying", "offer_won", "testimonial", "paused"].includes(student.phase) && (
                  <>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border bg-muted px-1.5 py-0.5 rounded-sm">
                      Loom review stage · 3/day to the review chat
                    </span>
                    <button
                      onClick={() => update({ phase: "applying" })}
                      className="text-caption font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors"
                    >
                      Approve looms → applying (5/day)
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Next actions — composer creates real action items (portal +
                queues), due date optional, add as many as needed */}
            <NextActionsComposer
              canManage={canManage || roles.includes("closer")}
              items={adhocItems}
              onAdd={addNextAction}
              onToggle={toggleActionItem}
            />
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatCard
          label="Calls used"
          value={student.calls_allotted > 0 ? `${callsUsed}/${student.calls_allotted}` : "Group"}
          sub={student.calls_allotted > 0 ? `${Math.max(0, student.calls_allotted - callsUsed)} remaining` : "no 1:1 allotment"}
          accent={student.calls_allotted > 0 && callsUsed >= student.calls_allotted ? "rose" : "sky"}
          icon={<Phone className="h-3 w-3" />}
        />
        <StatCard
          label="Rating trend"
          value={avgRating ? avgRating.toFixed(1) : "–"}
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
          value={lastCallDaysAgo == null ? "–" : `${lastCallDaysAgo}d`}
          sub={calls.length ? `${calls.length} calls total` : "No calls yet"}
          accent={lastCallDaysAgo != null && lastCallDaysAgo > 14 ? "rose" : "sky"}
          icon={<CalIcon className="h-3 w-3" />}
        />
        <StatCard
          label="Since last EOD"
          value={lastEodDaysAgo == null ? "–" : `${lastEodDaysAgo}d`}
          sub={eods.length ? `${eods.length} EODs total` : "None submitted"}
          accent={lastEodDaysAgo != null && lastEodDaysAgo >= 5 ? "rose" : "emerald"}
          icon={<FileText className="h-3 w-3" />}
        />
      </div>

      {/* Placements — the outcome, so it leads */}
      <PlacementsSection studentId={student.id} />

      {/* Graduation checklist */}
      <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <GraduationCap className="h-3 w-3 text-warning-fg" /> Graduation checklist
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {graduationDone}/4 {graduationDone === 4 && <span className="text-warning-fg ml-1">🏆 Complete</span>}
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
                    ? "border-warning/25 bg-warning-bg text-warning-fg"
                    : "border-[var(--border)] bg-[var(--muted)] text-muted-foreground hover:border-ring/50"
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
        <div className="mt-3 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
          <div className="h-full bg-warning motion-safe:transition-[width] duration-500 ease-(--ease-out)" style={{ width: `${(graduationDone / 4) * 100}%` }} />
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Progress milestones</div>
            <div className="text-[11px] font-mono text-muted-foreground">{milestoneProgress.size}/{milestones.length}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {milestones.map(m => {
              const done = milestoneProgress.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => canManage && toggleMilestone(m.id)}
                  disabled={!canManage}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-sm border transition ${
                    done
                      ? "border-success/25 bg-success-bg text-success-fg"
                      : "border-[var(--border)] bg-[var(--muted)] text-muted-foreground"
                  } ${canManage ? "hover:border-success/25 cursor-pointer" : "cursor-default"}`}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {m.name}
                </button>
              );
            })}
          </div>
          <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
            <div className="h-full bg-success motion-safe:transition-[width] duration-500 ease-(--ease-out)" style={{ width: `${(milestoneProgress.size / milestones.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
        <TabBtn active={tab === "timeline"} onClick={() => setTab("timeline")} icon={<Activity className="h-3 w-3" />}>Timeline</TabBtn>
        <TabBtn active={tab === "calls"} onClick={() => setTab("calls")} icon={<Phone className="h-3 w-3" />}>1:1s ({calls.length})</TabBtn>
        <TabBtn active={tab === "eods"} onClick={() => setTab("eods")} icon={<User className="h-3 w-3" />}>Student EODs ({eods.length} daily · {weeklyEods.length} weekly)</TabBtn>
        {isCsm && <TabBtn active={tab === "csm"} onClick={() => setTab("csm")} icon={<HeartHandshake className="h-3 w-3" />}>CSM notes ({csmNotes.length})</TabBtn>}
        <TabBtn active={tab === "installments"} onClick={() => setTab("installments")} icon={<DollarSign className="h-3 w-3" />}>Installments {installment ? `(${payments.filter(p => p.status === "paid").length}/${payments.length})` : ""}</TabBtn>
        <TabBtn active={tab === "notes"} onClick={() => setTab("notes")} icon={<FileText className="h-3 w-3" />}>General notes</TabBtn>
      </div>

      {tab === "timeline" && (
        <TimelineFeed
          student={student}
          calls={calls}
          eods={eods}
          csmNotes={csmNotes}
          csmAuthors={csmAuthors}
          coachName={coachName}
          payments={payments}
        />
      )}

      {tab === "calls" && (
        <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="text-xs font-semibold flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> 1-on-1 calls · {calls.length}</div>
            {canManage && (
              <button onClick={() => setCallFormOpen(!callFormOpen)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                <Plus className="h-3 w-3" /> Log call
              </button>
            )}
          </div>
          {callFormOpen && <CallForm studentId={student.id} onCancel={() => setCallFormOpen(false)} onDone={() => { setCallFormOpen(false); load(); }} />}
          <div className="divide-y divide-[var(--accent)]">
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
                          <Star key={i} className={`h-3 w-3 ${i < c.progress_rating! ? "fill-amber-400 text-warning-fg" : "text-muted-foreground/30"}`} />
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.fathom_url && (
                      <a href={c.fathom_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-success-fg hover:text-success-fg text-[11px]">
                        <Video className="h-3 w-3" /> Fathom <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {canManage && (
                      <button onClick={() => deleteCall(c.id)} className="p-0.5 text-muted-foreground hover:text-danger-fg" title="Remove call from active records"><ArchiveX className="h-3 w-3" /></button>
                    )}
                  </div>
                </div>
                {c.action_items && <div className="text-xs"><span className="text-warning-fg">Action items:</span> {c.action_items}</div>}
                {c.coach_notes && <div className="text-xs text-muted-foreground italic">{c.coach_notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "eods" && (
        <div className="space-y-3">
          <WeeklyStudentEodHistory weeklyEods={weeklyEods} dailyEods={eods} loadError={weeklyEodLoadError} onRetry={load} />
          <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="text-xs font-semibold flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-success-fg" /> Student EODs · {eods.length}</div>
            {!student.user_id && <span className="text-[10px] text-muted-foreground">Student hasn't signed in yet</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-[var(--accent)]">
                  <th className="text-left p-2">Date</th>
                  <th className="text-right p-2">Apps</th>
                  <th className="text-right p-2">Looms</th>
                  <th className="text-right p-2">Roleplays</th>
                  <th className="text-right p-2">Interviews</th>
                  <th className="text-left p-2">Wins</th>
                  <th className="text-left p-2">Blockers</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {eods.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No EODs yet.</td></tr>}
                {eods.map(e => (
                  <tr key={e.id} className="border-b border-[var(--accent)]">
                    <td className="p-2 font-mono text-muted-foreground">{e.report_date}</td>
                    <td className="p-2 text-right font-mono text-success-fg">{e.applications_submitted}</td>
                    <td className="p-2 text-right font-mono">{e.looms_sent ?? 0}</td>
                    <td className="p-2 text-right font-mono">{e.roleplays ?? 0}</td>
                    <td className="p-2 text-right font-mono">{e.interviews}</td>
                    <td className="p-2 max-w-[200px] truncate">{e.wins}</td>
                    <td className="p-2 max-w-[200px] truncate text-warning-fg/80">{e.blockers}</td>
                    <td className="p-2 text-right">
                      {/* Corrections preserve the source row in the archive and
                          remain admin-only. */}
                      {roles.includes("admin") && (
                        <button
                          onClick={async () => {
                            const reason = prompt(`Why is the ${e.report_date} EOD being unlocked?`, "Incorrect submission");
                            if (!reason?.trim()) return;
                            const { error } = await (supabase.rpc as any)("archive_and_unlock_eod", {
                              p_record_type: "student_daily",
                              p_source_id: e.id,
                              p_reason: reason.trim(),
                            });
                            if (error) return toast.error(error.message);
                            toast.success("EOD archived and unlocked");
                            load();
                          }}
                          className="p-1 rounded hover:bg-danger-bg text-muted-foreground hover:text-danger-fg"
                          title="Archive and unlock this EOD"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {tab === "csm" && isCsm && (
        <CsmNotesPanel notes={csmNotes} authors={csmAuthors} onAdd={addCsmNote} />
      )}

      {tab === "installments" && (
        <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4 space-y-3">
          {!installment ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No installment plan for this student.
              <div className="mt-2">
                <Link to="/revenue" search={{ tab: "plans" } as never} className="text-success-fg hover:text-success-fg text-[11px]">Manage on Money in →</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-success-fg" /> {installment.currency} {installment.total_amount.toLocaleString()}</div>
                  {installment.notes && <div className="text-[11px] text-muted-foreground mt-0.5">{installment.notes}</div>}
                </div>
                <Link to="/revenue" search={{ tab: "plans" } as never} className="text-[11px] text-success-fg hover:text-success-fg">Edit plan →</Link>
              </div>
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-[var(--accent)]"><th className="text-left p-2">#</th><th className="text-left p-2">Due</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Status</th></tr>
                </thead>
                <tbody>
                  {payments.map(p => {
                    const overdue = p.status !== "paid" && new Date(p.due_date) < new Date();
                    return (
                      <tr key={p.id} className="border-b border-[var(--accent)]">
                        <td className="p-2 font-mono text-muted-foreground">{p.sequence}</td>
                        <td className={`p-2 font-mono ${overdue ? "text-danger-fg" : "text-muted-foreground"}`}>{p.due_date}</td>
                        <td className="p-2 text-right font-mono">{p.currency} {Number(p.amount).toLocaleString()}</td>
                        <td className={`p-2 uppercase tracking-wider text-[10px] ${p.status === "paid" ? "text-success-fg" : overdue ? "text-danger-fg" : "text-muted-foreground"}`}>{overdue ? "overdue" : p.status}</td>
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
        <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> General notes</div>
            {canManage && (
              <button onClick={saveGeneralNotes} className="text-[10px] text-success-fg hover:text-success-fg flex items-center gap-1"><Save className="h-3 w-3" /> Save</button>
            )}
          </div>
          <textarea
            disabled={!canManage}
            value={student.general_notes ?? ""}
            onChange={e => setStudent({ ...student, general_notes: e.target.value })}
            rows={8}
            placeholder="Anything worth remembering: personality, background, wins, ongoing themes…"
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-ring"
          />
          <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Legacy coach notes</div>
          <textarea
            disabled={!canManage}
            value={student.notes ?? ""}
            onChange={e => setStudent({ ...student, notes: e.target.value })}
            onBlur={async () => { await supabase.from("students").update({ notes: student.notes }).eq("id", student.id); }}
            rows={3}
            placeholder="Original coach notes field (kept for history)"
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-ring"
          />
        </div>
      )}
    </div>
  );
}

function WeeklyStudentEodHistory({
  weeklyEods,
  dailyEods,
  loadError,
  onRetry,
}: {
  weeklyEods: StudentWeeklyEod[];
  dailyEods: SEod[];
  loadError: boolean;
  onRetry: () => unknown;
}) {
  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-danger/25 bg-danger-bg p-4 text-xs text-danger-fg">
        <span>Weekly accountability could not load. It has not been treated as zero.</span>
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-4">Retry</button>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold"><CalIcon className="h-3.5 w-3.5 text-muted-foreground" /> Weekly accountability · {weeklyEods.length}</div>
        <span className="text-[10px] text-muted-foreground">Calls attended are self-reported</span>
      </div>
      <div className="divide-y divide-border">
        {weeklyEods.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No weekly EODs submitted yet.</div>}
        {weeklyEods.map((weekly) => {
          const weekEnd = addStudentDays(weekly.week_start, 6);
          const dailyCount = new Set(dailyEods
            .filter((row) => row.report_date >= weekly.week_start && row.report_date <= weekEnd)
            .map((row) => row.report_date)).size;
          return (
            <article key={weekly.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-medium">{weekly.week_start} to {weekEnd}</div>
                <div className="flex items-center gap-3 text-[11px] tabular-nums">
                  <span className={weekly.group_calls_attended >= 5 ? "text-success-fg" : "text-warning-fg"}>Calls {weekly.group_calls_attended}/7</span>
                  {weekly.one_on_one_calls != null && (
                    <span className={weekly.one_on_one_calls > 0 ? "text-foreground" : "text-warning-fg"}>1:1s {weekly.one_on_one_calls}</span>
                  )}
                  <span className={dailyCount >= 5 ? "text-success-fg" : "text-warning-fg"}>Daily EODs {dailyCount}/7</span>
                </div>
              </div>
              {Array.isArray(weekly.calls_attended) && weekly.calls_attended.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {weekly.calls_attended.filter(c => c && c.day && c.name).map((c) => (
                    <span key={`${weekly.id}-${c.day}`} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{c.day} · {c.name}</span>
                  ))}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <StaffWeeklyReflection label="Implemented or stopped by" value={weekly.implementation} />
                <StaffWeeklyReflection label="Next commitment" value={weekly.next_week_commitment} />
                {weekly.biggest_win && <StaffWeeklyReflection label="Biggest win" value={weekly.biggest_win} />}
                {weekly.biggest_blocker && <StaffWeeklyReflection label="Biggest blocker" value={weekly.biggest_blocker} />}
              </div>
              <div className="text-[10px] text-muted-foreground">Submitted {new Date(weekly.submitted_at).toLocaleString()}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function StaffWeeklyReflection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-xs">{value}</p>
    </div>
  );
}

function addStudentDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function CsmNotesPanel({ notes, authors, onAdd }: { notes: CsmNote[]; authors: Record<string, string>; onAdd: (n: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4 space-y-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        <HeartHandshake className="h-3 w-3 text-warning-fg" /> CSM notes
      </div>
      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={2}
          placeholder="Loom reviewed, roleplay feedback, check-in outcome…"
          className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-ring"
        />
        <button
          onClick={() => { onAdd(draft); setDraft(""); }}
          disabled={!draft.trim()}
          className="text-xs bg-success hover:bg-success disabled:opacity-40 disabled:hover:bg-success text-success-fg font-medium px-3 rounded-sm"
        >Add</button>
      </div>
      <div className="space-y-2">
        {notes.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No CSM notes yet.</div>}
        {notes.map(n => (
          <div key={n.id} className="border border-[var(--accent)] bg-[var(--muted)] rounded-sm p-2.5">
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
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
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
    emerald: "text-success-fg", sky: "text-muted-foreground", rose: "text-danger-fg", amber: "text-warning-fg", fuchsia: "text-muted-foreground",
  };
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-3">
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
    emerald: "text-success-fg border-success/25 bg-success-bg",
    rose: "text-danger-fg border-danger/25 bg-danger-bg",
    zinc: "text-muted-foreground border-border bg-zinc-500/5",
    fuchsia: "text-muted-foreground border-border bg-muted",
    sky: "text-muted-foreground border-border bg-muted",
    amber: "text-warning-fg border-warning/25 bg-warning-bg",
  } as const;
  return (
    <div className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider pl-2 pr-1 py-0.5 rounded-sm border ${map[color]}`}>
      {prefix && <span>{prefix}</span>}
      <SelectField value={value} onChange={onChange} options={options.map(o => ({ value: o.v, label: o.l }))} className="h-7 w-auto border-0 bg-transparent shadow-none" />
    </div>
  );
}

function Chip({ label, color }: { label: string; color: "emerald" | "rose" | "zinc" | "fuchsia" | "sky" | "amber" }) {
  const map = {
    emerald: "text-success-fg border-success/25 bg-success-bg",
    rose: "text-danger-fg border-danger/25 bg-danger-bg",
    zinc: "text-muted-foreground border-border bg-zinc-500/5",
    fuchsia: "text-muted-foreground border-border bg-muted",
    sky: "text-muted-foreground border-border bg-muted",
    amber: "text-warning-fg border-warning/25 bg-warning-bg",
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
    <div className="p-3 border-b border-[var(--border)] bg-[var(--muted)] space-y-2">
      <div className="grid md:grid-cols-3 gap-2">
        <DateField value={form.call_date} onChange={v => setForm(f => ({ ...f, call_date: v }))} clearable={false} />
        <SelectField value={form.status} onChange={(v) => setForm(f => ({ ...f, status: v }))} options={[{ value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "follow_up", label: "Follow-up" }, { value: "no_show", label: "No-show" }, { value: "cancelled", label: "Cancelled" }]} />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setForm(f => ({ ...f, progress_rating: n }))} className="p-0.5">
              <Star className={`h-4 w-4 ${n <= form.progress_rating ? "fill-amber-400 text-warning-fg" : "text-muted-foreground/30"}`} />
            </button>
          ))}
        </div>
      </div>
      <input placeholder="Fathom URL (optional)" value={form.fathom_url} onChange={e => setForm(f => ({ ...f, fathom_url: e.target.value }))} className="w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs" />
      <textarea placeholder="Action items…" value={form.action_items} onChange={e => setForm(f => ({ ...f, action_items: e.target.value }))} rows={2} className="w-full p-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs resize-none" />
      <textarea placeholder="Coach notes…" value={form.coach_notes} onChange={e => setForm(f => ({ ...f, coach_notes: e.target.value }))} rows={2} className="w-full p-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs resize-none" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-2 py-1">Cancel</button>
        <button onClick={submit} disabled={saving} className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 py-1 rounded-sm">
          {saving ? "Saving…" : "Save call"}
        </button>
      </div>
    </div>
  );
}

type PlacementRow = {
  id: string; business_name: string; stage: string; pay_notes: string | null;
  started_at: string | null; created_at: string; updated_at: string;
};

type TimelineEvent = {
  key: string;
  ts: string;
  kind: "call" | "eod" | "csm" | "payment" | "milestone" | "placement";
  title: string;
  detail?: string;
  meta?: string;
};

function TimelineFeed({ student, calls, eods, csmNotes, csmAuthors, coachName, payments }: {
  student: Student;
  calls: Call[];
  eods: SEod[];
  csmNotes: CsmNote[];
  csmAuthors: Record<string, string>;
  coachName: (uid: string | null) => string;
  payments: Payment[];
}) {
  // Shared cache key with PlacementsSection — no extra request when both mount.
  const placementsQ = useQuery({
    queryKey: ["placements", student.id],
    staleTime: 60_000,
    queryFn: async () =>
      ((await supabase.from("student_placements").select("*, students!inner(is_demo)").eq("students.is_demo", false).eq("student_id", student.id).is("voided_at", null).order("created_at", { ascending: false })).data ?? []) as PlacementRow[],
  });
  const events: TimelineEvent[] = [];
  for (const pl of placementsQ.data ?? []) {
    events.push({
      key: `pl-${pl.id}`,
      ts: pl.created_at.slice(0, 10),
      kind: "placement",
      title: `Opportunity added · ${pl.business_name}`,
    });
    if (pl.stage === "placed") {
      events.push({
        key: `pl-${pl.id}-won`,
        ts: (pl.started_at ?? pl.updated_at).slice(0, 10),
        kind: "placement",
        title: `🎉 Placed at ${pl.business_name}`,
        detail: pl.pay_notes ?? undefined,
      });
    }
  }
  calls.forEach(c => events.push({
    key: `c-${c.id}`,
    ts: c.call_date,
    kind: "call",
    title: `1:1 ${c.status ?? ""} with ${coachName(c.coach_id)}`,
    detail: c.coach_notes ?? c.outcome ?? undefined,
    meta: c.progress_rating ? `${c.progress_rating}/5` : undefined,
  }));
  eods.forEach(e => events.push({
    key: `e-${e.id}`,
    ts: e.report_date,
    kind: "eod",
    title: `EOD · ${e.applications_submitted} apps · ${e.interviews} interviews`,
    detail: e.wins || e.blockers || undefined,
  }));
  csmNotes.forEach(n => events.push({
    key: `n-${n.id}`,
    ts: n.created_at.slice(0, 10),
    kind: "csm",
    title: `CSM · ${csmAuthors[n.user_id] ?? "Unknown"}`,
    detail: n.note,
  }));
  payments.filter(p => p.status === "paid" && p.paid_at).forEach(p => events.push({
    key: `p-${p.id}`,
    ts: (p.paid_at ?? "").slice(0, 10),
    kind: "payment",
    title: `Payment ${p.sequence} · ${p.currency} ${Number(p.amount).toLocaleString()}`,
  }));
  if (student.first_win_at) events.push({ key: "m-fw", ts: student.first_win_at.slice(0, 10), kind: "milestone", title: "🌟 First win" });
  if (student.offer_landed_at) events.push({ key: "m-off", ts: student.offer_landed_at.slice(0, 10), kind: "milestone", title: "🏆 Offer landed" });
  events.sort((a, b) => b.ts.localeCompare(a.ts));

  const tones: Record<TimelineEvent["kind"], { icon: any; color: string }> = {
    call:      { icon: Phone,      color: "text-muted-foreground border-border bg-muted" },
    eod:       { icon: FileText,   color: "text-success-fg border-success/25 bg-success-bg" },
    csm:       { icon: HeartHandshake, color: "text-warning-fg border-warning/25 bg-warning-bg" },
    payment:   { icon: DollarSign, color: "text-success-fg border-success/25 bg-success-bg" },
    milestone: { icon: Trophy,     color: "text-warning-fg border-warning/25 bg-warning-bg" },
    placement: { icon: Briefcase,  color: "text-chart-1 border-chart-1/25 bg-chart-1/10" },
  };

  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm">
      <div className="px-4 py-3 border-b border-[var(--border)] text-xs font-semibold flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" /> Activity · {events.length}
      </div>
      {events.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">No activity yet.</div>
      ) : (
        <ol className="divide-y divide-[var(--accent)]">
          {events.map(ev => {
            const t = tones[ev.kind];
            const Icon = t.icon;
            return (
              <li key={ev.key} className="p-3 flex items-start gap-3">
                <div className={`h-7 w-7 rounded-sm border flex items-center justify-center shrink-0 ${t.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium truncate">{ev.title}</div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{ev.ts}{ev.meta ? ` · ${ev.meta}` : ""}</span>
                  </div>
                  {ev.detail && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{ev.detail}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}


/** Click-to-edit student name — saves on blur or Enter, Escape cancels. */
function EditableName({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  if (!canEdit) return <span>{value}</span>;
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Click to rename"
        className="group inline-flex items-center gap-1.5 text-left rounded-sm -mx-1 px-1 hover:bg-muted/60 motion-safe:transition-colors"
      >
        {value}
        <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 motion-safe:transition-opacity" />
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onSave(draft); }}
      onKeyDown={e => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      className="text-xl font-semibold bg-[var(--background)] border border-border rounded-sm px-2 py-0.5 w-[min(320px,80vw)] focus:outline-none focus:border-ring"
    />
  );
}

/**
 * Next actions composer: every entry is a real action item (portal + queues),
 * optional due date, add as many as needed. students.next_action mirrors the
 * latest so the roster column keeps reading.
 */
function NextActionsComposer({ canManage, items, onAdd, onToggle }: {
  canManage: boolean;
  items: AdhocItem[];
  onAdd: (text: string, due: string | null) => Promise<void>;
  onToggle: (id: string, done: boolean) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [due, setDue] = useState<Date | undefined>(undefined);
  const [dueOpen, setDueOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const open = items.filter(i => !i.done);
  const localIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setSaving(true);
    try {
      await onAdd(t, due ? localIso(due) : null);
      setText("");
      setDue(undefined);
      setDueOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Next actions</span>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            placeholder="e.g. Follow up on portfolio review"
            className="flex-1 min-w-[200px] h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs focus:outline-none focus:border-ring"
          />
          <Popover open={dueOpen} onOpenChange={setDueOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`h-8 inline-flex items-center gap-1.5 rounded-sm border px-2.5 text-[11px] motion-safe:transition-colors ${due ? "border-primary/25 bg-primary/10 text-primary" : "border-[var(--border)] text-muted-foreground hover:text-foreground"}`}
              >
                <CalIcon className="h-3 w-3" />
                {due ? humanDue(localIso(due)) : "Due date"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0 bg-[var(--card)] border-[var(--border)]">
              <CalendarPicker
                mode="single"
                selected={due}
                onSelect={(d) => { setDue(d); setDueOpen(false); }}
                disabled={{ before: new Date() }}
              />
              {due && (
                <div className="border-t border-[var(--border)] px-3 py-2 text-right">
                  <button type="button" onClick={() => { setDue(undefined); setDueOpen(false); }} className="text-[10px] text-muted-foreground hover:text-foreground">
                    Clear date
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <button
            onClick={add}
            disabled={saving || !text.trim()}
            className="h-8 rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      )}
      {open.length > 0 && (
        <ul className="space-y-1">
          {open.map(it => (
            <li key={it.id} className="flex items-start gap-2 text-xs">
              <Checkbox
                checked={false}
                disabled={!canManage}
                onCheckedChange={(v) => { if (v === true) onToggle(it.id, true); }}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <span className="flex-1 min-w-0">
                {it.text}
                {it.due_date && (
                  <span className={`ml-2 text-[10px] ${it.due_date < new Date().toISOString().slice(0, 10) ? "text-danger-fg" : "text-muted-foreground"}`}>
                    {humanDue(it.due_date)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
