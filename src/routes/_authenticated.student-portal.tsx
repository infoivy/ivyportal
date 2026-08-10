import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/ui/skeletons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, Award, Briefcase, MessageSquare, Users, ListChecks,
  Calendar, Trophy, TrendingUp, Flame, Home, PartyPopper, ChevronRight, Lock,
  PlayCircle, FileText, Star, ArrowRight, Play } from "lucide-react";
import { computeStreak } from "@/lib/streak";
import { setStudentPortalTab, onStudentPortalTab, getStudentPortalTab, normalizeStudentTab } from "@/lib/student-portal-bus";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateForTables } from "@/lib/query-keys";
import { useServerFn } from "@tanstack/react-start";
import { getStudentLeaderboard } from "@/lib/student-portal.functions";
import { completeStudentOnboarding } from "@/lib/student-onboarding.functions";
import { saveStudentWhatsapp, syncStudentTimezone } from "@/lib/student-timezone.functions";
import { timeIn, timezoneOptions } from "@/components/student-local-time";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";
import { getStudentNextCall } from "@/lib/student-next-call.functions";
import { getMyGraduationReview, reportOfferLanded, submitGraduationReview } from "@/lib/student-review.functions";
import { WALKTHROUGH_VIDEOS, beginPortalWalkthrough, completePortalWalkthrough } from "@/lib/student-walkthrough.functions";
import { friendlyPastDay, humanDue } from "@/lib/dates";
import { signAvatar } from "@/lib/avatars";
import { START_HERE_STEPS, isStartHereComplete } from "@/lib/student-guide-steps";
import { useStudentSandbox } from "@/lib/student-sandbox";
import { ApplicationPending } from "@/components/application-pending";
import {
  DEFAULT_GROUP_CALL_SCHEDULE,
  countStudentDailyEods,
  fromStoredCallsAttended,
  getCurrentWeekStart,
  getStudentWeeklyDraftAction,
  getStudentWeeklyWindow,
  parseGroupCallSchedule,
  toAttendedRecords,
  validateStudentWeeklyEod,
  type GroupCall,
} from "@/lib/student-weekly-eod";

export const Route = createFileRoute("/_authenticated/student-portal")({
  head: () => ({ meta: [{ title: "Student Portal · ISA" }] }),
  component: StudentPortal,
});

type Student = {
  id: string; full_name: string; email: string | null; phase: string; status: string;
  calls_included: number; calls_allotted: number | null; coach_id: string | null;
  first_win_at: string | null; offer_landed_at: string | null;
  testimonial_collected: boolean | null; trustpilot_collected: boolean | null;
  onboarding_completed_at: string | null;
  timezone: string | null; join_date: string | null; whatsapp: string | null;
  walkthrough_started_at: string | null; walkthrough_done_at: string | null;
};
type Coach = { id: string; display_name: string | null; avatar_url: string | null };
type SEod = {
  id: string; student_id: string; report_date: string;
  applications_submitted: number; outreach_sent: number; replies: number; interviews: number;
  roleplays: number; looms_sent: number;
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};
type StudentWeeklyEod = {
  id: string;
  student_id: string;
  week_start: string;
  group_calls_attended: number;
  calls_attended: unknown;
  one_on_one_calls: number | null;
  implementation: string;
  biggest_win: string | null;
  biggest_blocker: string | null;
  next_week_commitment: string;
  submitted_at: string;
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

const empty = {
  applications_submitted: 0, outreach_sent: 0, replies: 0, interviews: 0,
  roleplays: 0, looms_sent: 0,
  wins: "", blockers: "", tomorrow_focus: "", summary: "",
};

const emptyWeekly = {
  callsAttended: [] as string[],
  oneOnOneCalls: 0 as number,
  implementation: "",
  biggestWin: "",
  biggestBlocker: "",
  nextWeekCommitment: "",
};

// Placements and the phase journey were cut from the student view
// (founder-directed 2026-07-25); the redesign (founder-directed 2026-08-11)
// collapsed six tabs into three: home (log + calls + to-dos), progress
// (numbers, coaching, milestones, history), board (leaderboard). Legacy tab
// keys are mapped by normalizeStudentTab.
type Tab = "start" | "home" | "progress" | "board";

// The student's LOCAL day — same rule as team EODs. toISOString() is UTC and
// files evening submissions onto tomorrow for western timezones, which then
// get overwritten by tomorrow's real log.
const localFmt = new Intl.DateTimeFormat("en-CA");
const todayStr = () => localFmt.format(new Date());
const daysAgoStr = (n: number) => localFmt.format(new Date(Date.now() - n * 86400000));

export function StudentPortal() {
  const { user, displayName } = useAuth();
  // Staff sandbox (founder-asked 2026-08-09): render this exact page for a
  // chosen student, reads real data, but every write below simulates locally.
  const sandbox = useStudentSandbox();
  const qc = useQueryClient();
  const today = todayStr();
  const weeklyWindow = useMemo(() => getStudentWeeklyWindow(today), [today]);
  const currentWeekStart = useMemo(() => getCurrentWeekStart(today), [today]);
  const [tab, setTab] = useState<Tab>(() => normalizeStudentTab(getStudentPortalTab()) as Tab);
  useEffect(() => { setStudentPortalTab(tab); }, [tab]);
  useEffect(() => { const off = onStudentPortalTab(t => setTab(normalizeStudentTab(t) as Tab)); return () => { off(); }; }, []);
  // Daily log notes (wins/blockers/tomorrow) hide behind one quiet link; they
  // auto-show whenever they already hold text (draft or submitted log).
  const [notesOpen, setNotesOpen] = useState(false);
  // Submitted weekly EOD collapses to one quiet line; this expands it.
  const [weeklyOpen, setWeeklyOpen] = useState(false);

  const [student, setStudent] = useState<Student | null>(null);
  const [callSchedule, setCallSchedule] = useState<GroupCall[]>(DEFAULT_GROUP_CALL_SCHEDULE);
  const [unlocking, setUnlocking] = useState(false);
  const [guideDone, setGuideDone] = useState<Set<string>>(new Set());
  const [coach, setCoach] = useState<Coach | null>(null);
  const [eods, setEods] = useState<SEod[]>([]);
  const [weeklyEods, setWeeklyEods] = useState<StudentWeeklyEod[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [adhocItems, setAdhocItems] = useState<AdhocItem[]>([]);
  const [form, setForm] = useState(empty);
  const [weeklyForm, setWeeklyForm] = useState(emptyWeekly);
  const [currentTicks, setCurrentTicks] = useState<string[]>([]);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [showWeeklyForm, setShowWeeklyForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [weeklyLoadError, setWeeklyLoadError] = useState(false);
  const [weeklyDraftHydrated, setWeeklyDraftHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const weeklyRef = useRef<HTMLDivElement>(null);

  // No draft autosave in the sandbox — a staff member poking around must not
  // leave localStorage drafts behind for anyone.
  const draftKey = student && !sandbox ? `student-eod-draft:${student.id}:${today}` : null;
  const weeklyDraftKey = student && !sandbox ? `student-weekly-eod-draft:${student.id}:${weeklyWindow.weekStart}` : null;

  const load = useCallback(async () => {
    if (!user && !sandbox) return;
    setWeeklyDraftHydrated(false);
    const studentQuery = supabase.from("students")
      .select("id, full_name, email, phase, status, calls_included, calls_allotted, coach_id, first_win_at, offer_landed_at, testimonial_collected, trustpilot_collected, onboarding_completed_at, timezone, join_date, whatsapp, walkthrough_started_at, walkthrough_done_at");
    const { data: s } = await (sandbox
      ? studentQuery.eq("id", sandbox.studentId).maybeSingle()
      : studentQuery.eq("user_id", user!.id).maybeSingle());
    setStudent((s as Student) ?? null);
    if (!s) { setLoading(false); return; }
    const st = s as Student;

    const [{ data: e }, weeklyRes, { data: c }, { data: ah }, coachRes, guideRes, orgRes, attendRes] = await Promise.all([
      supabase.from("student_eods").select("*").eq("student_id", st.id).order("report_date", { ascending: false }).limit(60),
      supabase.from("student_weekly_eods").select("*").eq("student_id", st.id).order("week_start", { ascending: false }).limit(16),
      supabase.from("student_calls").select("id, call_date, status, progress_rating, next_call_date, action_items_json").eq("student_id", st.id).is("voided_at", null).order("call_date", { ascending: false }),
      supabase.from("student_action_items").select("id, student_id, text, done, due_date, created_at, source_call_id").eq("student_id", st.id).order("created_at", { ascending: false }),
      st.coach_id ? supabase.from("profiles").select("id, display_name, avatar_url, avatar_path").eq("id", st.coach_id).maybeSingle() : Promise.resolve({ data: null }),
      (supabase as any).from("student_guide_steps").select("step_key").eq("student_id", st.id),
      supabase.from("org_settings").select("group_call_schedule").limit(1).maybeSingle(),
      supabase.from("student_call_attendance").select("week_start, day").eq("student_id", st.id)
        .in("week_start", Array.from(new Set([currentWeekStart, weeklyWindow.weekStart]))),
    ]);
    setGuideDone(new Set(((guideRes.data ?? []) as { step_key: string }[]).map(r => r.step_key)));
    setCallSchedule(parseGroupCallSchedule(orgRes.data?.group_call_schedule));
    setEods((e ?? []) as SEod[]);
    const loadedWeekly = (weeklyRes.data ?? []) as StudentWeeklyEod[];
    setWeeklyLoadError(Boolean(weeklyRes.error));
    setWeeklyEods(loadedWeekly);
    setCalls((c ?? []) as Call[]);
    setAdhocItems((ah ?? []) as AdhocItem[]);
    // Avatars live in storage under avatar_path; sign it for display (the
    // legacy avatar_url column is empty for everyone current).
    const coachRow = coachRes.data as (Coach & { avatar_path?: string | null }) | null;
    if (coachRow) {
      const signed = coachRow.avatar_path ? await signAvatar(coachRow.avatar_path) : null;
      setCoach({ id: coachRow.id, display_name: coachRow.display_name, avatar_url: signed ?? coachRow.avatar_url });
    } else {
      setCoach(null);
    }

    const t = (e ?? []).find((r: any) => r.report_date === today);
    if (t) {
      setExistingId(t.id);
      setForm({
        applications_submitted: t.applications_submitted, outreach_sent: t.outreach_sent,
        replies: t.replies, interviews: t.interviews,
        roleplays: t.roleplays ?? 0, looms_sent: t.looms_sent ?? 0,
        wins: t.wins ?? "", blockers: t.blockers ?? "",
        tomorrow_focus: t.tomorrow_focus ?? "", summary: t.summary ?? "",
      });
      setShowForm(false);
    } else {
      setExistingId(null);
      // Try to restore draft (never in the sandbox: drafts belong to the student)
      if (sandbox) setForm(empty);
      else try {
        const raw = localStorage.getItem(`student-eod-draft:${st.id}:${today}`);
        if (raw) setForm({ ...empty, ...JSON.parse(raw) });
        else setForm(empty);
      } catch { setForm(empty); }
      setShowForm(false);
    }

    // Live attendance ticks: current week feeds the tiles; the submission
    // window's ticks pre-fill the weekly form.
    const attendRows = (attendRes.data ?? []) as { week_start: string; day: string }[];
    setCurrentTicks(attendRows.filter(r => r.week_start === currentWeekStart).map(r => r.day));
    const windowTicks = attendRows.filter(r => r.week_start === weeklyWindow.weekStart).map(r => r.day);

    const weekly = loadedWeekly.find((row) => row.week_start === weeklyWindow.weekStart);
    if (weekly) {
      setWeeklyForm({
        callsAttended: fromStoredCallsAttended(weekly.calls_attended),
        oneOnOneCalls: weekly.one_on_one_calls ?? 0,
        implementation: weekly.implementation,
        biggestWin: weekly.biggest_win ?? "",
        biggestBlocker: weekly.biggest_blocker ?? "",
        nextWeekCommitment: weekly.next_week_commitment,
      });
      setShowWeeklyForm(false);
    } else {
      if (sandbox) setWeeklyForm({ ...emptyWeekly, callsAttended: windowTicks });
      else try {
        const raw = localStorage.getItem(`student-weekly-eod-draft:${st.id}:${weeklyWindow.weekStart}`);
        const draft = raw ? { ...emptyWeekly, ...JSON.parse(raw) } : emptyWeekly;
        // Attendance lives in the DB (ticked all week, any device) — it wins
        // over whatever a stale local draft says.
        setWeeklyForm({ ...draft, callsAttended: windowTicks });
      } catch { setWeeklyForm({ ...emptyWeekly, callsAttended: windowTicks }); }
      setShowWeeklyForm(true);
    }
    setWeeklyDraftHydrated(true);
    setLoading(false);
  }, [user, sandbox, today, weeklyWindow.weekStart, currentWeekStart]);
  useEffect(() => { void load(); }, [load]);

  // One tick = one row; works from any device all week. The weekly submit
  // then snapshots whatever is ticked.
  const toggleAttendance = async (weekStart: string, day: string, on: boolean) => {
    if (!student) return;
    const call = callSchedule.find(c => c.day === day);
    if (!call) return;
    if (weekStart === currentWeekStart) {
      setCurrentTicks(prev => on ? Array.from(new Set([...prev, day])) : prev.filter(d => d !== day));
    }
    if (weekStart === weeklyWindow.weekStart) {
      setWeeklyForm(prev => ({
        ...prev,
        callsAttended: on ? Array.from(new Set([...prev.callsAttended, day])) : prev.callsAttended.filter(d => d !== day),
      }));
    }
    if (sandbox) return; // sandbox: the tick shows, nothing is recorded
    const { error } = on
      ? await supabase.from("student_call_attendance").upsert(
          { student_id: student.id, week_start: weekStart, day, name: call.name },
          { onConflict: "student_id,week_start,day" },
        )
      : await supabase.from("student_call_attendance").delete()
          .eq("student_id", student.id).eq("week_start", weekStart).eq("day", day);
    if (error) {
      toast.error(error.message);
      if (weekStart === currentWeekStart) {
        setCurrentTicks(prev => on ? prev.filter(d => d !== day) : Array.from(new Set([...prev, day])));
      }
      if (weekStart === weeklyWindow.weekStart) {
        setWeeklyForm(prev => ({
          ...prev,
          callsAttended: on ? prev.callsAttended.filter(d => d !== day) : Array.from(new Set([...prev.callsAttended, day])),
        }));
      }
    }
  };

  // Autosave draft
  useEffect(() => {
    if (!draftKey || existingId) return;
    const isEmpty = form.applications_submitted === 0 && form.outreach_sent === 0 && form.replies === 0 && form.interviews === 0 && form.roleplays === 0 && form.looms_sent === 0 && !form.wins && !form.blockers && !form.tomorrow_focus && !form.summary;
    if (isEmpty) { try { localStorage.removeItem(draftKey); } catch {} return; }
    try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch {}
  }, [form, draftKey, existingId]);

  useEffect(() => {
    if (!weeklyDraftKey) return;
    const action = getStudentWeeklyDraftAction({
      hydrated: weeklyDraftHydrated,
      hasSubmission: weeklyEods.some((row) => row.week_start === weeklyWindow.weekStart),
      form: weeklyForm,
    });
    if (action === "skip") return;
    try {
      if (action === "remove") localStorage.removeItem(weeklyDraftKey);
      else localStorage.setItem(weeklyDraftKey, JSON.stringify(weeklyForm));
    } catch {}
  }, [weeklyForm, weeklyDraftKey, weeklyDraftHydrated, weeklyEods, weeklyWindow.weekStart]);

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
    looms: sumOf(last7, "looms_sent"),
    roleplays: sumOf(last7, "roleplays"),
    interviews: sumOf(last7, "interviews"),
  };
  const totalsPrev = {
    apps: sumOf(prev7, "applications_submitted"),
    looms: sumOf(prev7, "looms_sent"),
    roleplays: sumOf(prev7, "roleplays"),
    interviews: sumOf(prev7, "interviews"),
  };
  const weeklySubmission = weeklyEods.find((row) => row.week_start === weeklyWindow.weekStart) ?? null;
  const weeklyDailyCount = countStudentDailyEods(eods.map((row) => row.report_date), weeklyWindow);
  // A week that ended before the student even unlocked their portal is not
  // "overdue" — their first weekly EOD opens on their first Sunday.
  const weeklyFirstWeek = !!student?.onboarding_completed_at
    && weeklyWindow.weekEnd < student.onboarding_completed_at.slice(0, 10);

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

  // Program type drives the whole view: group students have no coach, no 1:1s.
  const isOneOnOne = ((student?.calls_allotted ?? student?.calls_included) ?? 0) > 0;
  // Until every Start Here step is done the portal is Start Here and nothing
  // else — a student who just paid has no use for placements/EODs/action items.
  const locked = !!student && !student.onboarding_completed_at;
  // Post-unlock walkthrough (founder 2026-07-25): the unlocked portal stays
  // visible but soft-locked until the pathway's walkthrough Loom is marked
  // watched. Group students gate only once their video exists.
  const walkthroughVideo = student
    ? WALKTHROUGH_VIDEOS[isOneOnOne ? "one_on_one" : "group"]
    : null;
  const softLocked = !!student && !locked && !!walkthroughVideo && !student.walkthrough_done_at;
  useEffect(() => {
    if (locked && tab !== "start") setTab("start");
  }, [locked, tab]);
  // Once onboarding is done, Start Here is gone entirely (founder-directed
  // 2026-07-25).
  useEffect(() => {
    if (student && !locked && tab === "start") setTab("home");
  }, [student, locked, tab]);
  // Loom approved ≈ moved past training/coaching into applying
  const loomApproved = ["applying", "offer_won", "testimonial"].includes(student?.phase ?? "");

  const submit = async () => {
    if (!student) return;
    if (sandbox) {
      // Simulate the submit: the recap, streak, and confetti all behave as
      // they would for the student, but no row is written.
      const wasNew = !existingId;
      const fakeId = existingId ?? `sandbox-${today}`;
      setEods(prev => {
        const rest = prev.filter(e => e.report_date !== today);
        return [{ id: fakeId, student_id: student.id, report_date: today, ...form } as SEod, ...rest];
      });
      setExistingId(fakeId);
      setShowForm(false);
      toast.success(wasNew ? "EOD submitted · sandbox, nothing saved" : "EOD updated · sandbox, nothing saved");
      if (wasNew) {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2500);
      }
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("student_eods").upsert({
      student_id: student.id, report_date: today, ...form,
    }, { onConflict: "student_id,report_date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    const wasNew = !existingId;
    toast.success(existingId ? "EOD updated" : "EOD submitted");
    // The leaderboard, CSM hub, and staff risk tiles read the same EODs —
    // refresh them the moment the log lands.
    invalidateForTables(qc, ["student_eods"]);
    if (draftKey) try { localStorage.removeItem(draftKey); } catch {}
    if (wasNew) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 2500);
    }
    await load();
  };

  const submitWeeklyEod = async () => {
    if (!student || weeklyLoadError) return;
    const validationError = validateStudentWeeklyEod(
      { ...weeklyForm, oneOnOneCalls: isOneOnOne ? weeklyForm.oneOnOneCalls : null },
      callSchedule,
    );
    if (validationError) return toast.error(validationError);
    if (sandbox) {
      const attended = toAttendedRecords(weeklyForm.callsAttended, callSchedule);
      setWeeklyEods(prev => {
        const rest = prev.filter(w => w.week_start !== weeklyWindow.weekStart);
        return [{
          id: `sandbox-${weeklyWindow.weekStart}`, student_id: student.id,
          week_start: weeklyWindow.weekStart, calls_attended: attended,
          group_calls_attended: attended.length,
          one_on_one_calls: isOneOnOne ? weeklyForm.oneOnOneCalls : null,
          implementation: weeklyForm.implementation.trim(),
          biggest_win: weeklyForm.biggestWin.trim() || null,
          biggest_blocker: weeklyForm.biggestBlocker.trim() || null,
          next_week_commitment: weeklyForm.nextWeekCommitment.trim(),
          submitted_at: new Date().toISOString(),
        } as StudentWeeklyEod, ...rest];
      });
      setShowWeeklyForm(false);
      toast.success("Weekly EOD submitted · sandbox, nothing saved");
      return;
    }
    setSavingWeekly(true);
    const attended = toAttendedRecords(weeklyForm.callsAttended, callSchedule);
    const { error } = await supabase.from("student_weekly_eods").upsert({
      student_id: student.id,
      week_start: weeklyWindow.weekStart,
      calls_attended: attended,
      group_calls_attended: attended.length,
      one_on_one_calls: isOneOnOne ? weeklyForm.oneOnOneCalls : null,
      implementation: weeklyForm.implementation.trim(),
      biggest_win: weeklyForm.biggestWin.trim() || null,
      biggest_blocker: weeklyForm.biggestBlocker.trim() || null,
      next_week_commitment: weeklyForm.nextWeekCommitment.trim(),
    }, { onConflict: "student_id,week_start" });
    setSavingWeekly(false);
    if (error) return toast.error(error.message);
    if (weeklyDraftKey) try { localStorage.removeItem(weeklyDraftKey); } catch {}
    toast.success(weeklySubmission ? "Weekly EOD updated" : "Weekly EOD submitted");
    invalidateForTables(qc, ["student_weekly_eods"]);
    await load();
  };

  const completeOnboardingFn = useServerFn(completeStudentOnboarding);
  const syncTzFn = useServerFn(syncStudentTimezone);
  const saveWhatsappFn = useServerFn(saveStudentWhatsapp);
  const nextCallFn = useServerFn(getStudentNextCall);
  // The live booking from the coaches' connected calendars beats the
  // hand-logged next_call_date when it exists.
  const calendarCallQ = useQuery({
    queryKey: ["student-next-call", student?.id],
    // The server fn resolves the CALLER's booking; in the sandbox that would
    // be the staff member's own calendar, so it stays off and the page falls
    // back to the hand-logged next call date.
    enabled: !sandbox && !!student && !!student.onboarding_completed_at && (student.calls_allotted ?? 0) > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => (await nextCallFn()).event,
  });
  const calendarNextCall = calendarCallQ.data ?? null;
  const toggleGuideStep = async (key: string, done: boolean) => {
    if (!student) return;
    const next = new Set(guideDone);
    if (done) next.add(key); else next.delete(key);
    setGuideDone(next);
    if (sandbox) {
      // Simulate the unlock moment without touching the student's real
      // progress: no rows, no completeStudentOnboarding, no team pings.
      if (locked && done && isStartHereComplete(next)) {
        setStudent(s => (s ? { ...s, onboarding_completed_at: new Date().toISOString() } : s));
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2500);
        toast.success("That's onboarding done · sandbox, nothing saved");
      }
      return;
    }
    const q = done
      ? (supabase as any).from("student_guide_steps").insert({ student_id: student.id, step_key: key })
      : (supabase as any).from("student_guide_steps").delete().eq("student_id", student.id).eq("step_key", key);
    const { error } = await q;
    if (error) {
      toast.error(error.message);
      setGuideDone(prev => { const n = new Set(prev); if (done) n.delete(key); else n.add(key); return n; });
      return;
    }
    // Last required step just ticked → unlock the rest of the portal.
    if (locked && done && isStartHereComplete(next) && !unlocking) {
      setUnlocking(true);
      try {
        await completeOnboardingFn();
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2500);
        toast.success("That's onboarding done. Your full portal is unlocked. 🎉");
        qc.invalidateQueries({ queryKey: ["student-portal-locked"] });
        await load();
      } catch (e) {
        toast.error(String((e as Error).message ?? e));
      } finally {
        setUnlocking(false);
      }
    }
  };

  const toggleItem = async (callId: string, index: number, done: boolean) => {
    if (callId.startsWith("adhoc:")) {
      const id = callId.slice("adhoc:".length);
      setAdhocItems(prev => prev.map(a => a.id === id ? { ...a, done } : a));
      if (sandbox) return;
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
    if (sandbox) return;
    const { error } = await supabase.rpc("student_toggle_action_item", { _call_id: callId, _index: index, _done: done });
    if (error) { toast.error(error.message); load(); }
  };

  if (loading) return <PageSkeleton />;

  if (!student) {
    if (sandbox) {
      return (
        <div className="p-8 max-w-xl mx-auto">
          <div className="card-surface p-8 text-center">
            <p className="text-sm font-medium text-foreground">This student could not be loaded</p>
            <p className="text-[13px] text-muted-foreground mt-2">
              The record may be archived, or your role can't read it.
            </p>
          </div>
        </div>
      );
    }
    // Not linked yet: collect phone + timezone, then "Application pending."
    // (founder-directed 2026-07-28). Approval copies the details into the
    // student record and this page opens on its own.
    return <ApplicationPending email={user?.email ?? ""} onRecheck={load} />;
  }

  const bump = (k: keyof typeof empty, d: number) =>
    setForm(f => ({ ...f, [k]: Math.max(0, (typeof f[k] === "number" ? (f[k] as number) : 0) + d) }));

  // In the sandbox the greeting belongs to the student being viewed, not to
  // the staff member's own display name.
  const first = (sandbox ? student.full_name : displayName ?? student.full_name).split(" ")[0];
  const brandNew = eods.length === 0;
  const hasNotes = !!(form.wins || form.blockers || form.tomorrow_focus);

  // Soft lock (founder-directed 2026-07-23, WhatsApp added 2026-07-26):
  // every student confirms their own timezone AND WhatsApp before anything
  // else — staff plan and reach out around both. Asks only for what's
  // missing; existing students who confirmed their timezone see just the
  // WhatsApp field on their next visit.
  if (!student.timezone || !student.whatsapp) {
    return (
      <>
      {/* Sandbox context: this gate IS what the student currently sees —
          say so, and let staff jump past it to the rest of the portal. */}
      {sandbox && (
        <div className="mx-4 sm:mx-6 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-2">
          <span className="text-[12px] text-foreground">
            This is really where {first} is: the portal asks for {!student.timezone && !student.whatsapp ? "their timezone and WhatsApp" : !student.whatsapp ? "their WhatsApp number" : "their timezone"} before anything else opens.
          </span>
          <button
            onClick={() => setStudent(s => (s ? {
              ...s,
              timezone: s.timezone ?? (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "Asia/Riyadh"; } })(),
              whatsapp: s.whatsapp ?? "+10000000000",
            } : s))}
            className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors"
          >
            Skip ahead · see the rest
          </button>
        </div>
      )}
      <DetailsGate
        first={first}
        needTimezone={!student.timezone}
        needWhatsapp={!student.whatsapp}
        onConfirm={async (tz, whatsapp) => {
          if (!sandbox) {
            if (tz) await syncTzFn({ data: { timezone: tz } });
            if (whatsapp) await saveWhatsappFn({ data: { whatsapp } });
          }
          setStudent(s => (s ? { ...s, timezone: tz ?? s.timezone, whatsapp: whatsapp ?? s.whatsapp } : s));
          toast.success(sandbox ? "Saved · sandbox, nothing saved" : "Saved · welcome in");
        }}
      />
      </>
    );
  }

  // Offer landed: the grind is over. The portal becomes a graduation page —
  // celebration plus the two asks that remain (testimonial, Trustpilot).
  if (["offer_won", "testimonial", "graduated"].includes(student.phase)) {
    return (
      <div className="w-full max-w-none p-4 sm:p-6 space-y-5 relative">
        <section className="card-surface p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <span dir="rtl">السلام عليكم ورحمة الله وبركاته</span>, {first}
          </h1>
          <p className="text-sm text-foreground mt-2 font-medium">You landed your offer. Alhamdulillah.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {student.offer_landed_at ? `Offer landed ${friendlyPastDay(student.offer_landed_at)}` : "Offer landed"}
            {student.join_date && student.offer_landed_at && (() => {
              const days = Math.max(1, Math.round((new Date(student.offer_landed_at).getTime() - new Date(student.join_date).getTime()) / 86400000));
              return ` · ${days} days from joining`;
            })()}
          </p>
        </section>

        <GraduationPlacement studentId={student.id} />

        <div className="grid sm:grid-cols-2 gap-3">
          <div className={`border rounded-sm p-5 ${student.testimonial_collected ? "border-success/25 bg-success-bg" : "border-[var(--border)] bg-[var(--card)]"}`}>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-3 ${student.testimonial_collected ? "bg-success text-success-fg" : "border border-[var(--border)] text-muted-foreground"}`}>
              {student.testimonial_collected ? <CheckCircle2 className="h-5 w-5" /> : <PlayCircle className="h-4 w-4" />}
            </div>
            <div className="text-sm font-semibold">Testimonial video</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {student.testimonial_collected
                ? "Received. Thank you for telling your story."
                : "Record a short video about your journey: where you started, what changed, the offer you landed. Your CSM will collect it."}
            </p>
          </div>
          <div className={`border rounded-sm p-5 ${student.trustpilot_collected ? "border-success/25 bg-success-bg" : "border-[var(--border)] bg-[var(--card)]"}`}>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-3 ${student.trustpilot_collected ? "bg-success text-success-fg" : "border border-[var(--border)] text-muted-foreground"}`}>
              {student.trustpilot_collected ? <CheckCircle2 className="h-5 w-5" /> : <Star className="h-4 w-4" />}
            </div>
            <div className="text-sm font-semibold">Trustpilot review</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {student.trustpilot_collected
                ? "Posted. It helps the next student find us."
                : "Leave an honest review of the program on Trustpilot. Two minutes, means everything."}
            </p>
          </div>
        </div>

        <GraduationReviewCard first={first} />

        <p className="text-[11px] text-muted-foreground text-center">
          No more daily EODs. You earned that. Your CSM stays one message away.
        </p>
      </div>
    );
  }

  // Fresh student: Start Here is the whole portal until every step is done.
  if (locked) {
    return (
      <div className="w-full max-w-none px-5 sm:px-8 lg:px-12 pt-10 sm:pt-16 pb-24 sm:pb-32 relative">
        {confetti && <ConfettiBurst />}
        <div dir="rtl" className="text-[14px] text-muted-foreground/80">السلام عليكم ورحمة الله وبركاته</div>
        <h1 className="mt-4 text-[34px] sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.1]">
          Welcome, <span className="text-primary">{first}</span>.
          <br />
          Here is how to begin.
        </h1>
        <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
          Five steps into Ivy Sales Academy. Take them in order, and the moment the last one is done your full portal opens: daily logs, action items, and the leaderboard.
        </p>
        <div className="mt-16 sm:mt-24">
          <StartHereGuide done={guideDone} locked unlocking={unlocking} onToggle={toggleGuideStep} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 space-y-4 relative">
      {confetti && <ConfettiBurst />}

      {/* Post-unlock walkthrough: the whole portal is scrollable below, but
          soft-locked until this is marked watched — he narrates, they follow. */}
      {softLocked && walkthroughVideo && (
        <WalkthroughGate
          video={walkthroughVideo}
          startedAt={student.walkthrough_started_at}
          onDone={async () => {
            setConfetti(true);
            setTimeout(() => setConfetti(false), 2500);
            if (sandbox) setStudent(s => (s ? { ...s, walkthrough_done_at: new Date().toISOString() } : s));
            else await load();
          }}
        />
      )}

      <div className={softLocked ? "space-y-4 pointer-events-none select-none opacity-55" : "space-y-4"} aria-hidden={softLocked || undefined}>

      {/* Greeting — small and calm; the log card below is the hero
          (founder-directed redesign 2026-08-11: radical simplicity) */}
      <section className="px-1 pt-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div dir="rtl" className="text-[13px] text-muted-foreground/80">السلام عليكم ورحمة الله وبركاته</div>
            <h1 className="mt-1.5 text-[26px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-[1.1]">
              Welcome, <span className="text-primary">{first}</span>.
            </h1>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <RankChip onClick={() => setTab("board")} />
            {streak > 0 && (
              <div className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border border-warning/25 bg-warning-bg text-warning-fg" title={`${streak}-day streak`}>
                <Flame className="h-3.5 w-3.5" /> {streak}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Three big buttons. That is the whole portal. */}
      <nav className="grid grid-cols-3 gap-2" role="tablist" aria-label="Portal sections">
        <BigTab active={tab === "home"} onClick={() => setTab("home")} icon={<Home className="h-4 w-4" />} label="Home" />
        <BigTab active={tab === "progress"} onClick={() => setTab("progress")} icon={<TrendingUp className="h-4 w-4" />} label="Progress" />
        <BigTab active={tab === "board"} onClick={() => setTab("board")} icon={<Trophy className="h-4 w-4" />} label="Board" />
      </nav>

      {tab === "home" && (
        <div className="space-y-4">
          {/* TODAY'S LOG — the one thing that matters, at the very top */}
          <section ref={formRef} className="card-soft p-5 sm:p-6">
            {existingId && !showForm ? (
              <SubmittedRecap
                form={form}
                streak={streak}
                loomApproved={loomApproved}
                onEdit={() => setShowForm(true)}
              />
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Today's log</div>
                  <h2 className="mt-1 text-[20px] font-semibold tracking-tight">{existingId ? "Update today's log" : "How did today go?"}</h2>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{today}{!existingId && " · saves as you type"}</p>
                </div>

                {/* Two modes (founder-set 2026-07-18): until the CSMs approve
                    your looms · 3 roleplays + 3 looms into the Inner Circle
                    Loom Review chat; once approved · 5 loom applications a
                    day. Never both loom fields at once. */}
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="text-[12px] text-muted-foreground mb-2.5">
                    {loomApproved
                      ? "Your targets today"
                      : "Your targets today · send looms to the Inner Circle Loom Review chat, not to offers"}
                  </div>
                  <div className="grid gap-3 grid-cols-2">
                    {loomApproved ? (
                      <>
                        <TargetBar label="Loom applications" value={form.applications_submitted} target={5} />
                        <TargetBar label="Roleplays" value={form.roleplays} target={3} />
                      </>
                    ) : (
                      <>
                        <TargetBar label="Roleplays" value={form.roleplays} target={3} />
                        <TargetBar label="Looms for review" value={form.looms_sent} target={3} />
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Counter label="Roleplays" value={form.roleplays} onBump={d => bump("roleplays", d)} />
                  {loomApproved ? (
                    <Counter label="Loom applications" value={form.applications_submitted} onBump={d => bump("applications_submitted", d)} />
                  ) : (
                    <Counter label="Looms for review" value={form.looms_sent} onBump={d => bump("looms_sent", d)} />
                  )}
                  <Counter label="Interviews" value={form.interviews} onBump={d => bump("interviews", d)} />
                </div>

                {notesOpen || hasNotes ? (
                  <div className="space-y-3">
                    <TextField label="Wins" value={form.wins} onChange={v => setForm(f => ({ ...f, wins: v }))} />
                    <TextField label="Blockers" value={form.blockers} onChange={v => setForm(f => ({ ...f, blockers: v }))} />
                    <TextField label="Tomorrow's focus" value={form.tomorrow_focus} onChange={v => setForm(f => ({ ...f, tomorrow_focus: v }))} />
                  </div>
                ) : (
                  <button
                    onClick={() => setNotesOpen(true)}
                    className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    + Add a note (optional)
                  </button>
                )}

                <button
                  onClick={submit}
                  disabled={saving}
                  className="pressable w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-14 rounded-xl text-[15px] disabled:opacity-50"
                >
                  {saving ? "Saving…" : existingId ? "Update my log" : "Submit my log"}
                </button>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-border/60">
              <WeekDots eodDates={eods.map(e => e.report_date)} today={today} hasToday={!!existingId} />
            </div>
          </section>

          {/* This week's calls — tick each right after attending. On Sunday
              the weekly EOD card below takes over the same week. */}
          {!weeklyWindow.dueToday && (
            <WeekCallTiles
              schedule={callSchedule}
              ticks={currentTicks}
              onToggle={(day, on) => toggleAttendance(currentWeekStart, day, on)}
            />
          )}

          {/* Weekly EOD: quiet once it's in, a card only while it needs you */}
          <div ref={weeklyRef}>
            {weeklyLoadError ? (
              <div className="flex items-center justify-between gap-3 card-soft border border-danger/25 bg-danger-bg p-4 text-xs text-danger-fg">
                <span>Weekly accountability could not load. Nothing has been recorded as zero.</span>
                <button type="button" onClick={() => load()} className="font-medium underline underline-offset-4">Retry</button>
              </div>
            ) : weeklySubmission && !weeklyOpen && !showWeeklyForm ? (
              <button
                type="button"
                onClick={() => setWeeklyOpen(true)}
                className="pressable w-full flex items-center justify-between gap-3 card-soft px-5 py-4 text-left"
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-success-fg">
                  <CheckCircle2 className="h-4 w-4" /> Weekly EOD is in
                </span>
                <span className="text-[12px] text-muted-foreground">View</span>
              </button>
            ) : !weeklySubmission && weeklyFirstWeek ? null : (
              <WeeklyAccountabilityCard
                window={weeklyWindow}
                submission={weeklySubmission}
                dailyEods={weeklyDailyCount}
                schedule={callSchedule}
                oneOnOne={isOneOnOne}
                callsUsed={callsUsed}
                callsAllotted={callsAllotted}
                firstWeek={weeklyFirstWeek}
                form={weeklyForm}
                showForm={showWeeklyForm}
                saving={savingWeekly}
                onChange={setWeeklyForm}
                onToggleCall={(day, on) => toggleAttendance(weeklyWindow.weekStart, day, on)}
                onEdit={() => setShowWeeklyForm(true)}
                onCollapse={() => setShowWeeklyForm(false)}
                onSubmit={submitWeeklyEod}
              />
            )}
          </div>

          {/* To do — everything the coach and CSMs have asked of them */}
          {actionItems.length > 0 && (
            <section className="card-soft p-5">
              <div className="flex items-center justify-between gap-3 mb-2 px-1">
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <ListChecks className="h-4 w-4 text-warning-fg" /> To do
                </div>
                <div className="flex items-center gap-1.5">
                  {overdue.length > 0 && (
                    <span className="text-micro px-2 py-0.5 rounded-full bg-danger-bg text-danger-fg">{overdue.length} overdue</span>
                  )}
                  {dueToday.length > 0 && (
                    <span className="text-micro px-2 py-0.5 rounded-full bg-warning-bg text-warning-fg">{dueToday.length} due today</span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {[...overdue, ...dueToday, ...upcoming].map(a => (
                  <ActionRow key={`o-${a.callId}-${a.index}`} a={a} today={today} onToggle={toggleItem} />
                ))}
                {actionItems.filter(a => a.item.done).map(a => (
                  <ActionRow key={`d-${a.callId}-${a.index}`} a={a} today={today} onToggle={toggleItem} />
                ))}
              </div>
            </section>
          )}

          {/* The moment it happens, they tell us (founder-directed 2026-07-25) */}
          {!student.offer_landed_at && (
            <OfferLandedForm onReported={async () => {
              setConfetti(true);
              setTimeout(() => setConfetti(false), 2500);
              if (sandbox) setStudent(s => (s ? { ...s, offer_landed_at: new Date().toISOString() } : s));
              else await load();
            }} />
          )}
        </div>
      )}

      {tab === "progress" && (
        <div className="space-y-4">
          {/* This week's numbers */}
          <section className="card-soft p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">This week</div>
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard label="Loom apps · 7d" value={totals7.apps} prev={totalsPrev.apps} series={spark("applications_submitted")} accent brandNew={brandNew} icon={<Briefcase className="h-3 w-3" />} />
              <StatCard label="Looms · 7d" value={totals7.looms} prev={totalsPrev.looms} series={spark("looms_sent")} brandNew={brandNew} icon={<Users className="h-3 w-3" />} />
              <StatCard label="Roleplays · 7d" value={totals7.roleplays} prev={totalsPrev.roleplays} series={spark("roleplays")} brandNew={brandNew} icon={<MessageSquare className="h-3 w-3" />} />
              <StatCard label="Interviews · 7d" value={totals7.interviews} prev={totalsPrev.interviews} series={spark("interviews")} accent brandNew={brandNew} icon={<Award className="h-3 w-3" />} />
            </div>
          </section>

          {/* Who's in your corner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isOneOnOne ? (
              <>
                <div className="card-soft p-4 flex items-center gap-3">
                  {coach ? (
                    <>
                      {coach.avatar_url ? (
                        <img src={coach.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold">
                          {(coach.display_name ?? "C").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-muted-foreground">Your coach</div>
                        <div className="text-sm font-medium truncate">{coach.display_name ?? "Coach"}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-11 w-11 rounded-full border border-dashed border-border text-muted-foreground flex items-center justify-center">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-muted-foreground">Your coach</div>
                        <div className="text-xs text-muted-foreground">Will be assigned soon</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="card-soft p-4 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-success-bg text-success-fg flex items-center justify-center">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-muted-foreground">Next 1:1</div>
                    {calendarNextCall ? (
                      <div className="text-sm font-medium">
                        {new Date(calendarNextCall.start).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {calendarNextCall.with && <span className="text-muted-foreground text-[11px] ml-2">w/ {calendarNextCall.with}</span>}
                        {calendarNextCall.meet_link && (
                          <a href={calendarNextCall.meet_link} target="_blank" rel="noopener" className="text-[11px] text-primary hover:underline ml-2">Join →</a>
                        )}
                      </div>
                    ) : nextCallDate ? (
                      <div className="text-sm font-medium">
                        {nextCallDate}
                        <span className="text-muted-foreground text-[11px] ml-2">
                          {nextCallInDays === 0 ? "today" : nextCallInDays === 1 ? "tomorrow" : `in ${nextCallInDays}d`}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Not scheduled · book your next call</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="card-soft p-4 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-success-bg text-success-fg flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-muted-foreground">Group coaching</div>
                    <div className="text-sm font-medium">{callSchedule.length} calls a week</div>
                    <div className="text-[10px] text-muted-foreground">Attend them all · take notes, ask smart questions</div>
                  </div>
                </div>
                <div className="card-soft p-4 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-muted-foreground">Your success team</div>
                    <div className="text-sm font-medium">CSM check-ins</div>
                    <div className="text-[10px] text-muted-foreground">Loom feedback, action items, and regular calls to keep you moving</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* My coaching — 1:1 students only */}
          {isOneOnOne && (
            <section className="card-soft p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Coaching calls</div>
                  <div className="text-[11px] text-muted-foreground">{callsUsed}/{callsAllotted} used</div>
                </div>
                <div className="h-2 rounded-full bg-[var(--accent)] overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${callsAllotted ? Math.min(100, (callsUsed / callsAllotted) * 100) : 0}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>{Math.max(0, callsAllotted - callsUsed)} remaining</span>
                  <span>{nextCallDate ? `Next · ${nextCallDate}` : "No call scheduled"}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Progress rating trend</div>
                  <div className="text-[11px] text-muted-foreground">Latest {ratings.at(-1)?.rating ?? "–"}/5</div>
                </div>
                {ratings.length < 2 ? (
                  <div className="text-[11px] text-muted-foreground py-6 text-center">Trend shows once you have 2+ rated calls.</div>
                ) : (
                  <RatingChart data={ratings} />
                )}
              </div>

              {lastCallItems && lastCallItems.items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Last call action items</div>
                    <div className="text-[10px] text-muted-foreground">{lastCallItems.date}</div>
                  </div>
                  <div className="divide-y divide-border/50">
                    {lastCallItems.items.map((it, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 text-xs">
                        {it.done ? <CheckCircle2 className="h-3.5 w-3.5 text-success-fg mt-0.5" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />}
                        <span className={it.done ? "line-through text-muted-foreground" : ""}>{it.text || <span className="italic">(no text)</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-1">Your 1:1 history</div>
                <div className="divide-y divide-border/50">
                  {completedCalls.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">No completed calls yet.</div>}
                  {completedCalls.map(c => (
                    <div key={c.id} className="grid grid-cols-[100px_1fr_auto] items-center gap-3 py-2 text-xs">
                      <span className="text-muted-foreground">{c.call_date}</span>
                      <span className="text-muted-foreground">Completed</span>
                      <span>{c.progress_rating ? `${c.progress_rating}/5` : "–"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Milestones */}
          <section className="card-soft p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-1">Milestones</div>
            <div className="text-xs text-muted-foreground mb-3">The finish line. Your coach unlocks these as you hit them.</div>
            {/* Founder 2026-07-25: the first REAL win is the signed offer — an
                interview is just a possibility. One social-proof milestone, then
                graduation. */}
            <div className="grid grid-cols-1 gap-3">
              <MilestoneCard
                done={!!student.offer_landed_at}
                label="First win · offer landed"
                detail={student.offer_landed_at ? `Unlocked ${friendlyPastDay(student.offer_landed_at)}` : "Sign your first setter offer. Everything before this is practice."}
              />
              <MilestoneCard
                done={!!student.testimonial_collected && !!student.trustpilot_collected}
                label="Testimonial & Trustpilot"
                detail={
                  student.testimonial_collected && student.trustpilot_collected
                    ? "Both in. Future students will find us because of you."
                    : student.testimonial_collected
                      ? "Testimonial in · Trustpilot review still open"
                      : student.trustpilot_collected
                        ? "Trustpilot in · testimonial still open"
                        : "Share your story and leave a Trustpilot review"
                }
              />
              <MilestoneCard
                done={student.testimonial_collected === true}
                label="Graduated from The Ivy Sales Academy"
                detail={student.testimonial_collected ? "Done. Go be great." : "Offer signed · share your story with the team"}
              />
            </div>
          </section>

          {/* Past logs */}
          <section className="card-soft overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/60 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Past logs</div>
            <div className="divide-y divide-border/40">
              {eods.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No logs yet. Your first one starts your streak. 🔥</div>}
              {eods.map(e => (
                <div key={e.id} className="grid grid-cols-[84px_1fr] items-center gap-3 px-5 py-2.5 text-xs">
                  <span className="text-muted-foreground">{e.report_date}</span>
                  <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span>Apps <span className="text-success-fg">{e.applications_submitted}</span></span>
                    <span>Looms <span className="text-foreground">{e.looms_sent ?? 0}</span></span>
                    <span>RP <span className="text-foreground">{e.roleplays ?? 0}</span></span>
                    <span>Int <span className="text-foreground">{e.interviews}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "board" && <LeaderboardPanel />}
      </div>
    </div>
  );
}

/**
 * Live attendance tiles for the running week: one tile per call, tap it the
 * day you attend. Rows are stored per tick, so it works across devices and
 * Sunday's weekly EOD pre-fills itself from them.
 */
function WeekCallTiles({ schedule, ticks, onToggle }: {
  schedule: GroupCall[];
  ticks: string[];
  onToggle: (day: string, on: boolean) => void;
}) {
  return (
    <section className="card-soft p-5 space-y-3" aria-labelledby="week-calls-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">This week</div>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 id="week-calls-title" className="text-[16px] font-semibold tracking-tight">This week's calls</h2>
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">{ticks.length}/{schedule.length} attended</span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {schedule.map((call) => {
          const on = ticks.includes(call.day);
          return (
            <button
              key={call.day}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(call.day, !on)}
              className={`pressable flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left motion-safe:transition-colors ${
                on ? "border-success/25 bg-success-bg" : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${on ? "bg-success text-success-fg" : "border border-border text-transparent"}`}>
                <CheckCircle2 className="h-3 w-3" />
              </span>
              <span className="min-w-0 text-xs">
                <span className="text-muted-foreground tabular-nums">{call.day}</span>{" "}
                <span className={on ? "font-medium text-foreground" : "text-foreground"}>{call.name}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">Tick each call right after you attend it · Sunday's weekly EOD fills itself from these.</p>
    </section>
  );
}

function WeeklyAccountabilityCard({
  window: reviewWindow,
  submission,
  dailyEods,
  schedule,
  oneOnOne,
  callsUsed,
  callsAllotted,
  firstWeek,
  form,
  showForm,
  saving,
  onChange,
  onToggleCall,
  onEdit,
  onCollapse,
  onSubmit,
}: {
  window: ReturnType<typeof getStudentWeeklyWindow>;
  submission: StudentWeeklyEod | null;
  dailyEods: number;
  schedule: GroupCall[];
  oneOnOne: boolean;
  callsUsed: number;
  callsAllotted: number;
  firstWeek: boolean;
  form: typeof emptyWeekly;
  showForm: boolean;
  saving: boolean;
  onChange: React.Dispatch<React.SetStateAction<typeof emptyWeekly>>;
  onToggleCall: (day: string, on: boolean) => void;
  onEdit: () => void;
  onCollapse: () => void;
  onSubmit: () => void;
}) {
  // The student's first week isn't "overdue" — the live call tiles above
  // already cover this week; nothing to show here until Sunday.
  if (firstWeek && !submission) return null;

  const pending = !submission;
  const status = submission ? "Submitted" : reviewWindow.dueToday ? "Due today" : "Overdue";
  const statusClass = submission
    ? "border-success/25 bg-success-bg text-success-fg"
    : reviewWindow.dueToday
      ? "border-warning/25 bg-warning-bg text-warning-fg"
      : "border-danger/25 bg-danger-bg text-danger-fg";
  // Highlighted while it needs attention; quiet once it's in.
  const cardClass = pending
    ? reviewWindow.dueToday ? "border-warning/40" : "border-danger/40"
    : "border-border";
  const storedAttended = submission && Array.isArray(submission.calls_attended)
    ? (submission.calls_attended as { day?: string; name?: string }[]).filter(c => c && c.day && c.name)
    : [];

  return (
    <section className={`rounded-xl border bg-card p-5 space-y-4 ${cardClass}`} aria-labelledby="weekly-eod-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">End of week</div>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 id="weekly-eod-title" className="text-[16px] font-semibold tracking-tight">Weekly EOD</h2>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {reviewWindow.weekStart} to {reviewWindow.weekEnd} · daily EODs {dailyEods}/7
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass}`}>{status}</span>
      </div>

      {submission && !showForm ? (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Group calls attended · {submission.group_calls_attended}/{schedule.length}
            </div>
            {storedAttended.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {storedAttended.map((c) => (
                  <span key={c.day} className="rounded-full bg-muted px-2 py-1 text-[10px] text-foreground">{c.day} · {c.name}</span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Count only (logged before per-call tracking).</p>
            )}
          </div>
          {oneOnOne && submission.one_on_one_calls != null && (
            <div className="text-xs text-foreground">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">1:1 calls this week</span>{" "}
              <span className="tabular-nums font-semibold">{submission.one_on_one_calls}</span>
              <span className="text-muted-foreground"> · {callsUsed}/{callsAllotted} used overall</span>
            </div>
          )}
          <WeeklyReflection label="What I implemented or what stopped me" value={submission.implementation} />
          {submission.biggest_win && <WeeklyReflection label="Biggest win" value={submission.biggest_win} />}
          {submission.biggest_blocker && <WeeklyReflection label="Biggest blocker" value={submission.biggest_blocker} />}
          <WeeklyReflection label="Next week's commitment" value={submission.next_week_commitment} />
          <button type="button" onClick={onEdit} className="text-[11px] font-medium text-primary hover:underline">Edit weekly EOD</button>
        </div>
      ) : (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-[11px] font-medium">Which group calls did you attend this week?</label>
              <span className="text-[11px] tabular-nums text-muted-foreground">{form.callsAttended.length}/{schedule.length}</span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {schedule.map((call) => {
                const checked = form.callsAttended.includes(call.day);
                return (
                  <label
                    key={call.day}
                    className={`flex items-center gap-2.5 rounded-sm border px-3 py-2 cursor-pointer select-none motion-safe:transition-colors ${
                      checked ? "border-primary/25 bg-primary/10" : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => onToggleCall(call.day, v === true)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-xs">
                      <span className="text-muted-foreground tabular-nums">{call.day}</span>{" "}
                      <span className={checked ? "font-medium text-foreground" : "text-foreground"}>{call.name}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {oneOnOne && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-[11px] font-medium">How many 1:1 coaching calls did you have this week?</label>
                <span className="text-[11px] tabular-nums text-muted-foreground">{callsUsed}/{callsAllotted} used overall</span>
              </div>
              <Counter
                label="1:1 calls"
                value={form.oneOnOneCalls}
                onBump={(d) => onChange((current) => ({ ...current, oneOnOneCalls: Math.max(0, Math.min(20, current.oneOnOneCalls + d)) }))}
              />
              {form.oneOnOneCalls === 0 && callsUsed < callsAllotted && (
                <p className="mt-1.5 text-[10px] text-warning-fg">
                  None this week? You still have {Math.max(0, callsAllotted - callsUsed)} calls to use. Book the next one, don't sit on them.
                </p>
              )}
            </div>
          )}

          <TextField
            label="What did you implement from the calls, or what stopped you? *"
            value={form.implementation}
            onChange={(value) => onChange((current) => ({ ...current, implementation: value }))}
            rows={3}
          />
          <TextField label="Biggest win" value={form.biggestWin} onChange={(value) => onChange((current) => ({ ...current, biggestWin: value }))} />
          <TextField label="Biggest blocker" value={form.biggestBlocker} onChange={(value) => onChange((current) => ({ ...current, biggestBlocker: value }))} />
          <TextField
            label="One concrete commitment for next week *"
            value={form.nextWeekCommitment}
            onChange={(value) => onChange((current) => ({ ...current, nextWeekCommitment: value }))}
            rows={2}
          />

          <div className="flex gap-2">
            <button type="button" onClick={onSubmit} disabled={saving} className="h-9 flex-1 rounded-sm bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Saving…" : submission ? "Update weekly EOD" : "Submit weekly EOD"}
            </button>
            {submission && <button type="button" onClick={onCollapse} className="h-9 rounded-sm border border-border px-3 text-xs text-muted-foreground hover:text-foreground">Cancel</button>}
          </div>
          <p className="text-[10px] text-muted-foreground">Attendance is self-reported · call names come from the weekly Skool schedule. Daily EOD count is calculated from your saved logs.</p>
        </div>
      )}
    </section>
  );
}

function WeeklyReflection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{value}</p>
    </div>
  );
}

/**
 * One-time soft lock: the student confirms their timezone and WhatsApp
 * before the portal opens. Asks only for what's missing. Timezone is
 * pre-filled from the browser with a live clock preview; WhatsApp requires
 * a country code.
 */
function DetailsGate({ first, needTimezone, needWhatsapp, onConfirm }: {
  first: string;
  needTimezone: boolean;
  needWhatsapp: boolean;
  onConfirm: (tz: string | null, whatsapp: string | null) => Promise<void>;
}) {
  const browserTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""; } catch { return ""; }
  }, []);
  const options = useMemo(() => timezoneOptions(), []);
  const [tz, setTz] = useState(browserTz && options.includes(browserTz) ? browserTz : "");
  const [whatsapp, setWhatsapp] = useState<string | undefined>(undefined);
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const idInt = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(idInt);
  }, []);
  const preview = needTimezone && tz ? timeIn(tz, now) : null;
  const whatsappOk = !!whatsapp && isValidPhoneNumber(whatsapp);
  const ready = (!needTimezone || !!tz) && (!needWhatsapp || whatsappOk);

  const confirm = async () => {
    if (!ready) return;
    setSaving(true);
    try { await onConfirm(needTimezone ? tz : null, needWhatsapp ? (whatsapp ?? "") : null); }
    catch (e) { toast.error(String((e as Error).message ?? e)); }
    finally { setSaving(false); }
  };

  const intro = needTimezone && needWhatsapp
    ? "Two quick things before your portal opens: confirm your timezone and drop your WhatsApp number. Your coach and success team run on both."
    : needWhatsapp
      ? "One quick thing before your portal opens: your WhatsApp number. It's how your coach and success team actually reach you."
      : "One quick thing before your portal opens: confirm your timezone. Your coach and success team use it to reach you at sane hours.";

  return (
    <div className="w-full max-w-none p-4 sm:p-6 space-y-5">
      <section className="card-surface p-6">
        <div className="text-[10px] text-muted-foreground mb-1">Student portal</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span dir="rtl">السلام عليكم ورحمة الله وبركاته</span>, {first} <span className="inline-block">👋</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-2">{intro}</p>

        <div className="mt-5 space-y-3">
          {needTimezone && (
            <>
              <div className="space-y-1.5">
                <label className="text-[12px] text-muted-foreground">Your timezone</label>
                <TimezoneCombobox value={tz} onChange={setTz} />
              </div>
              {preview && (
                <div className="rounded-sm border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Your current time should be</span>
                  <span className="text-sm font-semibold tabular-nums">{preview}</span>
                </div>
              )}
            </>
          )}

          {needWhatsapp && (
            <div className="space-y-1.5">
              <label className="text-[12px] text-muted-foreground">Your WhatsApp number</label>
              <div onBlur={() => setTouchedPhone(true)}>
                <PhoneInput value={whatsapp} onChange={setWhatsapp} placeholder="7700 900123" />
              </div>
              {touchedPhone && !!whatsapp && !whatsappOk && (
                <p className="text-[11px] text-danger-fg">That doesn't look like a valid number for the selected country.</p>
              )}
              <p className="text-[10px] text-muted-foreground">Pick your country, type the rest. This is where loom feedback and check-ins reach you.</p>
            </div>
          )}

          <button
            onClick={confirm}
            disabled={!ready || saving}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-10 rounded-sm text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "All set · open my portal"}
          </button>
          {needTimezone && (
            <p className="text-[10px] text-muted-foreground text-center">
              Wrong clock preview? Pick a different city until it matches yours.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * The casual "few words from you" ask on the graduation page — separate from
 * Trustpilot, written right here, lands in the team's Testimonials pipeline.
 */
function GraduationReviewCard({ first }: { first: string }) {
  const sandbox = useStudentSandbox();
  const submitFn = useServerFn(submitGraduationReview);
  const getFn = useServerFn(getMyGraduationReview);
  const q = useQuery({
    queryKey: ["graduation-review"],
    staleTime: 60_000,
    // The server fn answers for the CALLER; a staff viewer has no review.
    enabled: !sandbox,
    queryFn: async () => (await getFn()).text,
  });
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (q.data != null) setText(q.data); }, [q.data]);
  const submitted = q.data != null && !editing;

  const send = async () => {
    if (sandbox) {
      toast.success("Got it · sandbox, nothing saved");
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await submitFn({ data: { text } });
      toast.success("Got it. Thank you, seriously.");
      setEditing(false);
      await q.refetch();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card-surface p-5 space-y-3">
      <div>
        <div className="text-sm font-semibold">One more thing, {first}…</div>
        <p className="text-[12px] text-muted-foreground mt-1">
          While it's fresh: how was it, in your own words? Where you started, what actually made the difference, where you are now. No script, no pressure. A few honest sentences is perfect.
        </p>
      </div>
      {submitted ? (
        <div className="space-y-2">
          <blockquote className="rounded-sm border border-success/25 bg-success-bg px-3 py-2.5 text-xs whitespace-pre-wrap">{q.data}</blockquote>
          <button onClick={() => setEditing(true)} className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4">
            Edit your words
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            placeholder="I came in with… and now…"
            className="w-full rounded-sm border border-[var(--border)] bg-[var(--background)] p-2.5 text-sm focus:outline-none focus:border-ring resize-y"
          />
          <div className="flex items-center justify-end gap-2">
            {editing && <button onClick={() => { setEditing(false); setText(q.data ?? ""); }} className="h-8 rounded-sm border border-border px-3 text-xs text-muted-foreground hover:text-foreground">Cancel</button>}
            <button
              onClick={send}
              disabled={saving || text.trim().length < 10}
              className="h-8 rounded-sm bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send it"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Post-unlock walkthrough gate: the founder's Loom, embedded in full, pinned
 * above a scrollable-but-dimmed portal. Mark-done is server-verified against
 * the video's runtime (an iframe can't report playback, but elapsed time
 * catches "watched a 12-minute video in 40 seconds").
 */
/**
 * Loom presented like a course platform (founder-referenced 2026-07-28):
 * big rounded thumbnail, centered play circle, badge chip. Clicking swaps in
 * the autoplaying embed. Thumbnail comes from Loom's CDN; if it 404s the
 * facade falls back to a dark panel so it never looks broken.
 */
function LoomFacade({ embedUrl, title, badge, onPlay }: {
  embedUrl: string;
  title: string;
  badge?: string;
  onPlay?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [thumbOk, setThumbOk] = useState(true);
  const loomId = /loom\.com\/(?:embed|share)\/([a-f0-9]{16,})/i.exec(embedUrl)?.[1] ?? null;

  if (playing) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-card">
        <iframe
          src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=true`}
          title={title}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setPlaying(true); onPlay?.(); }}
      className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-card text-left"
      aria-label={`Play: ${title}`}
    >
      {loomId && thumbOk && (
        <img
          src={`https://cdn.loom.com/sessions/thumbnails/${loomId}-00001.jpg`}
          alt=""
          onError={() => setThumbOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span className="absolute inset-0 bg-black/25 group-hover:bg-black/15 motion-safe:transition-colors" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="h-16 w-16 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg group-hover:scale-105 motion-safe:transition-transform">
          <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
        </span>
      </span>
      {badge && (
        <span className="absolute left-3 bottom-3 text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-1 rounded-md bg-black/70 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function WalkthroughGate({ video, startedAt, onDone }: {
  video: { share: string; embed: string };
  startedAt: string | null;
  onDone: () => Promise<void>;
}) {
  const sandbox = useStudentSandbox();
  const beginFn = useServerFn(beginPortalWalkthrough);
  const completeFn = useServerFn(completePortalWalkthrough);
  const [saving, setSaving] = useState(false);
  const began = useRef(false);
  useEffect(() => {
    if (began.current || startedAt || sandbox) return;
    began.current = true;
    void beginFn().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

  const markDone = async () => {
    if (sandbox) {
      toast.success("Portal unlocked · sandbox, nothing saved");
      await onDone();
      return;
    }
    setSaving(true);
    try {
      await completeFn();
      toast.success("Portal unlocked. Now you know exactly how to run it.");
      await onDone();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card-surface p-5 space-y-3 border-primary/25">
      <div>
        <div className="text-sm font-semibold">Watch this first · how to run your portal</div>
        <p className="text-[12px] text-muted-foreground mt-1">
          Your portal is unlocked. Before you touch anything, watch this walkthrough in full — scroll along as it plays; everything below opens the moment you mark it done.
        </p>
      </div>
      {/* Facade only — the watch floor arms on mount (begin), because the
          server skips the dwell check when started_at is null. */}
      <LoomFacade embedUrl={video.embed} title="Portal walkthrough" badge="Walkthrough" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Watched it all? Say the word.</span>
        <button
          onClick={markDone}
          disabled={saving}
          className="h-9 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Checking…" : "I watched it in full · unlock my portal"}
        </button>
      </div>
    </section>
  );
}

/**
 * Students declare their own first offer (founder-directed 2026-07-25):
 * company, role type, OTE. Lights the milestone instantly; the team gets
 * pinged to verify and move them to Offer Won.
 */
function OfferLandedForm({ onReported }: { onReported: () => Promise<void> }) {
  const sandbox = useStudentSandbox();
  const reportFn = useServerFn(reportOfferLanded);
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [roleType, setRoleType] = useState("");
  const [ote, setOte] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (sandbox) {
      toast.success("LET'S GO · sandbox, the team was NOT pinged");
      await onReported();
      return;
    }
    setSaving(true);
    try {
      await reportFn({ data: { company, roleType, ote } });
      toast.success("LET'S GO. The team has been told. 🎉");
      await onReported();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 space-y-3">
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full flex items-center justify-between gap-3 text-left">
          <div>
            <div className="text-sm font-semibold">🎉 Landed your first offer?</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tell us the moment it happens. We'll take it from there.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      ) : (
        <>
          <div className="text-sm font-semibold">🎉 Tell us about the offer</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Company name</label>
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. Northpeak Solar"
                className="w-full h-9 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Role type</label>
              <select
                value={roleType}
                onChange={e => setRoleType(e.target.value)}
                className="w-full h-9 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring"
              >
                <option value="" disabled>Pick one…</option>
                <option value="closing">Closing</option>
                <option value="dm_setting">DM setting</option>
                <option value="phone_setting">Phone setting</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] text-muted-foreground">OTE · on-target earnings</label>
              <input
                value={ote}
                onChange={e => setOte(e.target.value)}
                placeholder='e.g. "$3,000/mo" or "$800 base + $50/show"'
                className="w-full h-9 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)} className="h-8 rounded-sm border border-border px-3 text-xs text-muted-foreground hover:text-foreground">Not yet</button>
            <button
              onClick={submit}
              disabled={saving || company.trim().length < 2 || !roleType || !ote.trim()}
              className="h-8 rounded-sm bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Sending…" : "I landed it 🎉"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The landed placement, shown on the graduation page. */
function GraduationPlacement({ studentId }: { studentId: string }) {
  const q = useQuery({
    queryKey: ["graduation-placement", studentId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_placements")
        .select("business_name, role_title, started_at")
        .eq("student_id", studentId)
        .is("voided_at", null)
        .eq("stage", "placed")
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });
  if (!q.data) return null;
  return (
    <section className="card-surface p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-success-bg text-success-fg flex items-center justify-center shrink-0">
        <Briefcase className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{q.data.role_title} · {q.data.business_name}</div>
        {q.data.started_at && <div className="text-[11px] text-muted-foreground">Started {friendlyPastDay(q.data.started_at)}</div>}
      </div>
    </section>
  );
}

/* ---------- Start Here ---------- */

function StartHereGuide({ done, locked = false, unlocking = false, onToggle }: {
  done: Set<string>;
  locked?: boolean;
  unlocking?: boolean;
  onToggle: (key: string, done: boolean) => void;
}) {
  const steps = START_HERE_STEPS;
  const doneCount = steps.filter(s => done.has(s.key)).length;
  const nextIdx = steps.findIndex(s => !done.has(s.key));
  // Sequential (founder-directed 2026-07-28): a step opens only when
  // everything before it is done. Done steps stay done and never re-lock.
  const isRowLocked = (i: number) => !done.has(steps[i].key) && nextIdx !== -1 && i > nextIdx;

  const featuredIdx = steps.findIndex(s => s.embedUrl);
  const featured = featuredIdx === -1 ? null : steps[featuredIdx];
  const featuredChecked = featured ? done.has(featured.key) : false;
  const featuredLocked = featured ? isRowLocked(featuredIdx) : false;

  return (
    <div>
      {/* Featured video — the reference's "Begin here" split */}
      {featured && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] gap-8 lg:gap-12 items-center">
          <LoomFacade
            embedUrl={featured.embedUrl!}
            title={featured.title}
            badge={`Step ${String(featuredIdx + 1).padStart(2, "0")}`}
          />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Step {String(featuredIdx + 1).padStart(2, "0")} of {String(steps.length).padStart(2, "0")} · Watch in full
            </div>
            <h3 className="mt-3 text-[24px] sm:text-[30px] font-semibold tracking-tight leading-[1.15]">{featured.title}</h3>
            <p className="mt-3 text-[15px] sm:text-base text-muted-foreground leading-relaxed">{featured.body}</p>
            <div className="mt-6 flex flex-wrap items-center gap-5">
              {featuredChecked ? (
                <>
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-success-fg">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Watched · done
                  </span>
                  <button
                    onClick={() => onToggle(featured.key, false)}
                    disabled={unlocking}
                    className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Undo
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onToggle(featured.key, true)}
                    disabled={unlocking || featuredLocked}
                    className="inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    I watched it in full <ArrowRight className="h-4 w-4" />
                  </button>
                  <a
                    href={featured.embedUrl!.replace("/embed/", "/share/")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Open in Loom
                  </a>
                </>
              )}
            </div>
            {featuredLocked && !featuredChecked && (
              <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Finish the steps before this one first.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Journey */}
      <div className={featured ? "mt-16 sm:mt-28 border-t border-border pt-10 sm:pt-14" : ""}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Start here</div>
            <h2 className="mt-2.5 text-[28px] sm:text-[38px] font-semibold tracking-tight leading-[1.12]">
              {locked ? "Five steps to unlock your portal" : "Your onboarding, all done"}
            </h2>
            <p className="mt-2.5 text-[15px] text-muted-foreground max-w-xl">
              Take them in order. The last tick opens your full portal.
            </p>
          </div>
          <div className="text-right shrink-0 pb-1">
            <span className={`text-[11px] font-semibold uppercase tracking-[0.16em] tabular-nums ${doneCount === steps.length ? "text-success-fg" : "text-muted-foreground"}`}>
              {doneCount} of {steps.length} done
            </span>
            <div className="h-1 w-28 rounded-full bg-muted overflow-hidden mt-1.5 ml-auto">
              <div className="h-full rounded-full bg-primary motion-safe:transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
          </div>
        </div>
        {unlocking && <div className="mt-3 text-[12px] text-muted-foreground">Unlocking your portal…</div>}

        <div className="mt-8 sm:mt-10 border-t border-border divide-y divide-border">
          {steps.map((s, i) => {
            const checked = done.has(s.key);
            const isNext = i === nextIdx;
            const rowLocked = isRowLocked(i);
            return (
              <div key={s.key} className="py-7 sm:py-10 grid gap-x-8 gap-y-3 sm:grid-cols-[96px_minmax(0,1fr)_auto] items-start">
                <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] tabular-nums pt-1 ${checked ? "text-success-fg" : isNext ? "text-primary" : "text-muted-foreground"}`}>
                  Step {String(i + 1).padStart(2, "0")}
                </div>
                <div className={`min-w-0 ${rowLocked ? "opacity-60" : ""}`}>
                  <div className="text-[16px] sm:text-[17px] font-semibold text-foreground">{s.title}</div>
                  <p className="mt-2 text-[13px] sm:text-sm text-muted-foreground leading-relaxed max-w-[560px]">{s.body}</p>
                  {s.embedUrl && (
                    <p className="text-[12px] text-muted-foreground mt-2">Featured above. Watch it there, then mark it done.</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-3.5">
                    {s.link && !rowLocked && (
                      <Link to={s.link.to} className="text-[12px] font-medium text-primary hover:underline">{s.link.label} →</Link>
                    )}
                    {checked ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={unlocking || rowLocked}
                        onClick={() => onToggle(s.key, false)}
                        className="h-9"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Done
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={unlocking || rowLocked}
                        onClick={() => onToggle(s.key, true)}
                        className="h-9"
                      >
                        Mark done
                      </Button>
                    )}
                  </div>
                </div>
                <div className="justify-self-start sm:justify-self-end pt-1">
                  {checked ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-success-fg">
                      <CheckCircle2 className="h-3 w-3" /> Done
                    </span>
                  ) : isNext ? (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Up next</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {locked && (
          <p className="text-[12px] text-muted-foreground flex items-center gap-1.5 border-t border-border pt-6">
            <Lock className="h-3 w-3" /> Your daily logs, action items, and the leaderboard appear here the moment your last step is ticked.
          </p>
        )}
      </div>
    </div>
  );
}

/** Hero rank chip — the cheapest motivation lever there is. */
function RankChip({ onClick }: { onClick: () => void }) {
  const sandbox = useStudentSandbox();
  const leaderboardFn = useServerFn(getStudentLeaderboard);
  const q = useQuery({
    queryKey: ["student-leaderboard", sandbox?.studentId ?? "self"],
    queryFn: () => leaderboardFn({ data: sandbox ? { viewAsStudentId: sandbox.studentId } : undefined }),
    staleTime: 5 * 60_000,
  });
  const you = q.data?.you;
  if (!you || !q.data || q.data.totalStudents < 2) return null;
  const top3 = you.rank <= 3;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border motion-safe:transition-colors ${top3 ? "border-success/25 bg-success-bg text-success-fg" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
      title="Leaderboard · rolling last 7 days"
    >
      <Trophy className="h-3.5 w-3.5" />
      #{you.rank} of {q.data.totalStudents} · last 7d
    </button>
  );
}

/* ---------- Leaderboard ---------- */

function LeaderboardPanel() {
  const sandbox = useStudentSandbox();
  const leaderboardFn = useServerFn(getStudentLeaderboard);
  const q = useQuery({
    queryKey: ["student-leaderboard", sandbox?.studentId ?? "self"],
    queryFn: () => leaderboardFn({ data: sandbox ? { viewAsStudentId: sandbox.studentId } : undefined }),
    staleTime: 5 * 60_000,
  });
  if (q.isLoading) return <div className="text-xs text-muted-foreground py-8 text-center">Loading leaderboard…</div>;
  const data = q.data;
  if (!data || data.rows.length === 0) {
    return <div className="text-xs text-muted-foreground py-8 text-center">No activity yet this week · first log tops the board.</div>;
  }
  return (
    <div className="space-y-3">
      {data.you && (
        <div className="card-soft px-5 py-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[14px]">
            You're <span className="font-semibold text-foreground">#{data.you.rank}</span> of {data.totalStudents} this week
          </span>
          <span className="text-[12px] text-muted-foreground">Log today's numbers to climb</span>
        </div>
      )}
      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[44px_1fr_auto_auto_auto] gap-2 px-5 py-2.5 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>#</span><span>Student</span><span className="text-right">Apps</span><span className="text-right">Looms</span><span className="text-right">Int.</span>
        </div>
        {data.rows.map((r) => (
          <div
            key={r.rank}
            className={`grid grid-cols-[44px_1fr_auto_auto_auto] gap-2 px-5 py-3.5 text-[13px] items-center border-b border-border/40 last:border-0 ${r.isYou ? "bg-primary/5" : ""}`}
          >
            <span className={`font-semibold tabular-nums ${r.rank === 1 ? "text-warning-fg text-[17px]" : r.rank <= 3 ? "text-foreground text-[17px]" : "text-muted-foreground"}`}>
              {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
            </span>
            <span className={`truncate ${r.isYou ? "font-semibold text-foreground" : ""}`}>{r.name}{r.isYou ? " (you)" : ""}</span>
            <span className="text-right tabular-nums text-success-fg font-medium">{r.apps7}</span>
            <span className="text-right tabular-nums">{r.looms7}</span>
            <span className="text-right tabular-nums">{r.interviews7}</span>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground text-center px-4">
        Last 7 days across every active student. Interviews and applications move you most; looms keep you on the board while you're in training.
      </div>
    </div>
  );
}

/* ---------- sub-components ---------- */

/** One of the three big portal buttons (redesign 2026-08-11). */
function BigTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`pressable flex items-center justify-center gap-2 h-12 sm:h-14 rounded-xl text-[13px] sm:text-[14px] font-semibold motion-safe:transition-colors ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "card-soft text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}{label}
    </button>
  );
}

function StatCard({ label, value, prev, series, accent, brandNew, icon }: { label: string; value: number; prev: number; series: number[]; accent?: boolean; brandNew?: boolean; icon: React.ReactNode }) {
  const delta = prev === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - prev) / prev) * 100);
  const up = delta > 0;
  return (
    <div className={`border border-[var(--border)] rounded-sm p-3 ${accent ? "bg-success-bg" : "bg-[var(--card)]"}`}>
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground mb-1">{icon}{label}</div>
      {brandNew ? (
        <div className="text-[10px] text-muted-foreground py-1 italic">Your first log starts here.</div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div className={`text-xl font-semibold ${accent ? "text-success-fg" : "text-foreground"}`}>{value}</div>
            <Sparkline data={series} color={accent ? "#34d399" : "#a78bfa"} />
          </div>
          {prev > 0 || value > 0 ? (
            <div className={`text-[10px] mt-1 ${up ? "text-success-fg" : delta < 0 ? "text-danger-fg" : "text-muted-foreground"}`}>
              {up ? "↑" : delta < 0 ? "↓" : "→"} {Math.abs(delta)}% vs prev 7d
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground mt-1">–</div>
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

function SubmittedRecap({ form, streak, loomApproved, onEdit }: { form: typeof empty; streak: number; loomApproved: boolean; onEdit: () => void }) {
  return (
    <div className="border border-success/25 bg-success-bg rounded-lg p-6 text-center space-y-4">
      <div className="flex justify-center">
        <div className="h-12 w-12 rounded-full bg-success text-success-fg flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success-fg">Daily log · submitted</div>
        <div className="mt-1.5 text-[22px] font-semibold tracking-tight text-foreground">Done for today.</div>
        <div className="text-[12px] text-muted-foreground mt-1">See you tomorrow.</div>
      </div>
      <div className="flex justify-center gap-6 text-xs flex-wrap">
        {loomApproved ? (
          <span><span className="text-success-fg text-lg font-semibold">{form.applications_submitted}</span> <span className="text-muted-foreground">apps</span></span>
        ) : (
          <span><span className="text-success-fg text-lg font-semibold">{form.looms_sent}</span> <span className="text-muted-foreground">looms</span></span>
        )}
        <span><span className="text-foreground text-lg font-semibold">{form.roleplays}</span> <span className="text-muted-foreground">roleplays</span></span>
        <span><span className="text-success-fg text-lg font-semibold">{form.interviews}</span> <span className="text-muted-foreground">int.</span></span>
      </div>
      {streak > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-warning/25 bg-warning-bg text-warning-fg">
            <Flame className="h-3.5 w-3.5" /> {streak}-day streak
          </div>
        </div>
      )}
      <button onClick={onEdit} className="text-[11px] text-muted-foreground hover:text-foreground underline">Edit today's log</button>
    </div>
  );
}

function ActionRow({ a, today, onToggle }: { a: { kind?: "call" | "adhoc"; callId: string; callDate: string; index: number; item: ActionItem }; today: string; onToggle: (id: string, i: number, done: boolean) => void }) {
  const isOverdue = !a.item.done && a.item.due_date && a.item.due_date < today;
  const isAdhoc = a.kind === "adhoc";
  return (
    <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 motion-safe:transition-colors">
      <Checkbox
        checked={!!a.item.done}
        onCheckedChange={(v) => onToggle(a.callId, a.index, v === true)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className={`text-xs ${a.item.done ? "line-through text-muted-foreground" : isOverdue ? "text-danger-fg" : "text-foreground"}`}>
          {a.item.text || <span className="italic text-muted-foreground">(no text)</span>}
        </div>
        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground items-center flex-wrap">
          {isAdhoc ? (
            <span className="px-1.5 py-0.5 rounded-sm border border-border bg-muted text-muted-foreground">
              Coach added
            </span>
          ) : (
            <span>from call {a.callDate}</span>
          )}
          {a.item.due_date && (
            <span className={isOverdue ? "text-danger-fg" : ""}>
              · {humanDue(a.item.due_date)}
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

function MilestoneCard({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <div className={`relative overflow-hidden border rounded-sm p-5 ${done ? "border-success/25 bg-success-bg" : "border-[var(--border)] bg-[var(--background)]"}`}>
      {done && <PartyPopper className="absolute -right-2 -top-2 h-16 w-16 text-success-fg/10" />}
      <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-3 ${done ? "bg-success text-success-fg" : "border border-[var(--border)] text-muted-foreground"}`}>
        {done ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
      </div>
      <div className={`text-sm font-semibold ${done ? "text-success-fg" : "text-foreground"}`}>{label}</div>
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
        return <line key={r} x1={pad} y1={y} x2={w - pad} y2={y} stroke="var(--border)" strokeWidth="1" />;
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
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[11px] text-muted-foreground mb-2 text-center">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => onBump(-1)} aria-label={`One less ${label}`} className="pressable h-12 w-12 shrink-0 rounded-xl border border-border hover:bg-muted text-xl leading-none">−</button>
        <div className="flex-1 text-center text-[26px] font-semibold tabular-nums">{value}</div>
        <button onClick={() => onBump(1)} aria-label={`One more ${label}`} className="pressable h-12 w-12 shrink-0 rounded-xl border border-border hover:bg-muted text-xl leading-none">+</button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-ring" />
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

function TargetBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const hit = value >= target;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={hit ? "text-success-fg font-semibold" : "text-foreground"}>{value} / {target}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${hit ? "bg-success" : "bg-warning"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WeekDots({ eodDates, today, hasToday }: { eodDates: string[]; today: string; hasToday: boolean }) {
  const logged = new Set(eodDates);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { key: new Intl.DateTimeFormat("en-CA").format(d), letter: "SMTWTFS"[d.getDay()] };
  });
  const count = days.filter(d => logged.has(d.key) || (d.key === today && hasToday)).length;
  return (
    <div className="mt-4 flex items-center gap-3 flex-wrap">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">This week</span>
      <div className="flex items-center gap-1.5">
        {days.map(d => {
          const isToday = d.key === today;
          const done = logged.has(d.key) || (isToday && hasToday);
          return (
            <div key={d.key} className="flex flex-col items-center gap-1" title={`${d.key}${done ? " · logged" : isToday ? " · pending" : " · missed"}`}>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  done ? "bg-success" : isToday ? "bg-warning today-dot-pulse" : "bg-danger/50"
                } ${isToday ? "ring-2 ring-warning/30" : ""} ${isToday && done ? "ring-success/30" : ""}`}
              />
              <span className={`text-[9px] leading-none ${isToday ? "text-foreground font-semibold" : "text-muted-foreground/60"}`}>{d.letter}</span>
            </div>
          );
        })}
      </div>
      <span className={`text-[11px] tabular-nums ${count >= 7 ? "text-success-fg font-semibold" : "text-muted-foreground"}`}>{count}/7 logged</span>
    </div>
  );
}
