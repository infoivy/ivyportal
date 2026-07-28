import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, subDays } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeletons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { humanDue, todayLocal } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Home · Ivy Portal" }] }),
  component: HomePage,
});

type EodActivity = {
  user_id: string;
  report_date: string;
  dials: number | null;
  dms_sent: number | null;
  convos_started: number | null;
  calls_booked: number | null;
  shows: number | null;
  no_shows: number | null;
  closes: number | null;
};

type TeamProfile = {
  id: string;
  display_name: string | null;
  setter_type: string | null;
  active: boolean | null;
};

type ActiveStudent = {
  id: string;
  phase: string;
  eod_exempt: boolean | null;
};

type AssignedItem = {
  id: string;
  text: string;
  due_date: string | null;
  created_at: string;
};

type HomeData = {
  activities: EodActivity[];
  profiles: TeamProfile[];
  assignedItems: AssignedItem[];
  expectedFilers: number;
  submittedToday: number;
  missingToday: number;
  atRiskStudents: number | null;
  activeStudents: number | null;
  callsThisWeek: number | null;
  overdueInstallments: number | null;
  dueSoonInstallments: number | null;
  pendingTestimonials: number | null;
  pendingApprovals: number | null;
  fetchedAt: string;
};

type PriorityItem = {
  key: string;
  title: string;
  detail: string;
  url: string;
  icon: typeof AlertCircle;
  urgent?: boolean;
  count?: number;
};

type ActivityMetric = "dials" | "dms_sent" | "convos_started" | "calls_booked" | "shows" | "no_shows" | "closes";

function sum(rows: EodActivity[], key: ActivityMetric): number | null {
  if (!rows.length || rows.some((row) => row[key] == null)) return null;
  return rows.reduce((total, row) => total + Number(row[key]), 0);
}

function countOrNull(result: { count: number | null; error: { message: string } | null }) {
  return result.error || result.count == null ? null : result.count;
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  const { user, displayName, roles } = useAuth();
  const roleKey = [...roles].sort().join(":");
  const canSeeCustomers = roles.some((role) => ["admin", "founder", "cofounder", "closer", "coach", "csm"].includes(role));
  const canSeeFinance = roles.some((role) => ["admin", "founder", "cofounder", "closer", "coach"].includes(role));
  const canApprove = roles.some((role) => ["admin", "closer", "csm"].includes(role));

  const homeQ = useQuery({
    queryKey: ["page", "home", user?.id, roleKey],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
    queryFn: async (): Promise<HomeData> => {
      const today = todayLocal();
      const recentFrom = format(subDays(new Date(), 13), "yyyy-MM-dd");
      const studentEodFrom = format(subDays(new Date(), 5), "yyyy-MM-dd");
      const callRiskFrom = format(subDays(new Date(), 14), "yyyy-MM-dd");
      const inThreeDays = format(addDays(new Date(), 3), "yyyy-MM-dd");
      const inSevenDays = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const emptyRows = Promise.resolve({ data: [], count: 0, error: null });
      const emptyCount = Promise.resolve({ data: null, count: null, error: null });

      const [
        activityRes,
        profilesRes,
        reportingRolesRes,
        assignedRes,
        studentsRes,
        callsCountRes,
        recentCallsRes,
        studentEodsRes,
        overdueRes,
        dueSoonRes,
        testimonialRes,
        approvalRes,
      ] = await Promise.all([
        supabase
          .from("eods_activity_real")
          .select("user_id, report_date, dials, dms_sent, convos_started, calls_booked, shows, no_shows, closes")
          .gte("report_date", recentFrom)
          .lte("report_date", today)
          .order("report_date", { ascending: true }),
        supabase.from("profiles").select("id, display_name, setter_type, active").eq("is_demo", false),
        supabase.from("user_roles").select("user_id, role").in("role", ["founder", "cofounder", "setter", "closer", "coach", "csm"]),
        supabase
          .from("student_action_items")
          .select("id, text, due_date, created_at")
          .eq("is_demo", false)
          .eq("assignee_id", user!.id)
          .eq("done", false)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(6),
        canSeeCustomers
          ? supabase.from("students").select("id, phase, eod_exempt").eq("is_demo", false).eq("status", "active")
          : emptyRows,
        canSeeCustomers
          ? supabase.from("student_calls").select("id, students!inner(is_demo)", { count: "exact", head: true }).eq("students.is_demo", false).eq("status", "scheduled").gte("call_date", today).lte("call_date", inSevenDays)
          : emptyCount,
        canSeeCustomers
          ? supabase.from("student_calls").select("student_id, call_date, students!inner(is_demo)").eq("students.is_demo", false).eq("status", "completed").gte("call_date", callRiskFrom)
          : emptyRows,
        canSeeCustomers
          ? supabase.from("student_eods").select("student_id, report_date, students!inner(is_demo)").eq("students.is_demo", false).gte("report_date", studentEodFrom)
          : emptyRows,
        canSeeFinance
          ? supabase.from("installment_payments").select("id, installments!inner(students!inner(is_demo))", { count: "exact", head: true }).eq("installments.students.is_demo", false).eq("status", "upcoming").lt("due_date", today)
          : emptyCount,
        canSeeFinance
          ? supabase.from("installment_payments").select("id, installments!inner(students!inner(is_demo))", { count: "exact", head: true }).eq("installments.students.is_demo", false).eq("status", "upcoming").gte("due_date", today).lte("due_date", inThreeDays)
          : emptyCount,
        canSeeCustomers
          ? supabase.from("students").select("id", { count: "exact", head: true }).eq("is_demo", false).eq("status", "active").eq("testimonial_collected", false).not("first_win_at", "is", null)
          : emptyCount,
        canApprove
          ? supabase.rpc("pending_signups")
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (activityRes.error) throw new Error(`Team activity failed: ${activityRes.error.message}`);
      if (profilesRes.error) throw new Error(`Team profiles failed: ${profilesRes.error.message}`);
      if (reportingRolesRes.error) throw new Error(`EOD policy failed: ${reportingRolesRes.error.message}`);
      if (assignedRes.error) throw new Error(`Assigned work failed: ${assignedRes.error.message}`);

      const activities = (activityRes.data ?? []) as EodActivity[];
      const profiles = (profilesRes.data ?? []) as TeamProfile[];
      const todayRows = activities.filter((row) => row.report_date === today);
      const reportingRows = (reportingRolesRes.data ?? []) as { user_id: string; role: string }[];
      const reportingUsers = new Set(
        reportingRows.filter((row) => ["setter", "closer", "coach", "csm"].includes(row.role)).map((row) => row.user_id),
      );
      const activeUsers = new Set(profiles.filter((profile) => profile.active !== false).map((profile) => profile.id));
      const expectedUsers = new Set(
        [...reportingUsers].filter((id) => activeUsers.has(id)),
      );
      const submittedUsers = new Set(todayRows.map((row) => row.user_id).filter((id) => expectedUsers.has(id)));

      let activeStudents: number | null = null;
      let atRiskStudents: number | null = null;
      if (!studentsRes.error && !recentCallsRes.error && !studentEodsRes.error) {
        const students = (studentsRes.data ?? []) as ActiveStudent[];
        const recentlyCalled = new Set((recentCallsRes.data ?? []).map((row) => row.student_id));
        const recentlyReported = new Set((studentEodsRes.data ?? []).map((row) => row.student_id));
        activeStudents = students.length;
        atRiskStudents = students.filter((student) => (
          ["onboarding", "coaching_1on1", "applying"].includes(student.phase) &&
          ((!student.eod_exempt && !recentlyReported.has(student.id)) ||
            (student.phase === "coaching_1on1" && !recentlyCalled.has(student.id)))
        )).length;
      }

      return {
        activities,
        profiles,
        assignedItems: (assignedRes.data ?? []) as AssignedItem[],
        expectedFilers: expectedUsers.size,
        submittedToday: submittedUsers.size,
        missingToday: Math.max(0, expectedUsers.size - submittedUsers.size),
        atRiskStudents,
        activeStudents,
        callsThisWeek: countOrNull(callsCountRes),
        overdueInstallments: countOrNull(overdueRes),
        dueSoonInstallments: countOrNull(dueSoonRes),
        pendingTestimonials: countOrNull(testimonialRes),
        pendingApprovals: approvalRes.error || approvalRes.data == null ? null : approvalRes.data.length,
        fetchedAt: new Date().toISOString(),
      };
    },
  });

  const priorities = useMemo<PriorityItem[]>(() => {
    const data = homeQ.data;
    if (!data) return [];
    const items: PriorityItem[] = [];
    const today = todayLocal();
    const ownToday = data.activities.some((row) => row.user_id === user?.id && row.report_date === today);
    const hasOperatingRole = roles.some((role) => ["setter", "closer", "coach", "csm"].includes(role));
    const isLeader = roles.some((role) => ["admin", "founder", "cofounder"].includes(role));

    if (hasOperatingRole && !ownToday) {
      items.push({
        key: "eod",
        title: "Submit today’s EOD",
        detail: "Your activity is not in today’s team record yet.",
        url: "/eods",
        icon: FileText,
        urgent: true,
      });
    }

    data.assignedItems.slice(0, 3).forEach((item) => {
      const overdue = Boolean(item.due_date && item.due_date < today);
      items.push({
        key: `item-${item.id}`,
        title: item.text,
        detail: item.due_date ? `${overdue ? "Overdue" : "Due"} ${humanDue(item.due_date)}` : "Assigned action item",
        url: "/action-items",
        icon: ListChecks,
        urgent: overdue,
      });
    });

    if (canApprove && data.pendingApprovals != null && data.pendingApprovals > 0) {
      items.push({
        key: "approvals",
        title: "Review access requests",
        detail: `${data.pendingApprovals} pending team or student ${data.pendingApprovals === 1 ? "request" : "requests"}.`,
        url: "/students/requests",
        icon: ShieldCheck,
        count: data.pendingApprovals,
      });
    }

    if (canSeeCustomers && data.atRiskStudents != null && data.atRiskStudents > 0) {
      items.push({
        key: "student-risk",
        title: "Review students needing attention",
        detail: `${data.atRiskStudents} active ${data.atRiskStudents === 1 ? "student has" : "students have"} a missing EOD or coaching touchpoint.`,
        url: "/student-success",
        icon: GraduationCap,
        urgent: true,
        count: data.atRiskStudents,
      });
    }

    if (canSeeFinance && data.overdueInstallments != null && data.overdueInstallments > 0) {
      items.push({
        key: "payments",
        title: "Resolve overdue installments",
        detail: `${data.overdueInstallments} ${data.overdueInstallments === 1 ? "payment is" : "payments are"} past due.`,
        url: "/installments",
        icon: AlertCircle,
        urgent: true,
        count: data.overdueInstallments,
      });
    }

    if (isLeader && data.missingToday > 0) {
      items.push({
        key: "team-eod",
        title: "Follow up on missing team EODs",
        detail: `${data.missingToday} expected team ${data.missingToday === 1 ? "reporter has" : "reporters have"} not submitted today.`,
        url: "/performance",
        icon: Users,
        count: data.missingToday,
      });
    }

    if (!items.length) {
      items.push({
        key: "clear",
        title: "No urgent exceptions",
        detail: "Open your role workspace to continue today’s operating queue.",
        url: "/work",
        icon: CheckCircle2,
      });
    }

    return items.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 6);
  }, [canApprove, canSeeCustomers, canSeeFinance, homeQ.data, roles, user?.id]);

  if (homeQ.isLoading) return <HomeLoading />;

  if (homeQ.isError || !homeQ.data) {
    return (
      <PageShell className="pb-24 sm:pb-6">
        <div className="card-surface mx-auto mt-14 max-w-xl p-7 text-center">
          <AlertCircle className="mx-auto h-5 w-5 text-destructive" />
          <h1 className="mt-4 text-title font-semibold text-foreground">Home could not load</h1>
          <p className="mt-2 text-body text-muted-foreground">
            {homeQ.error instanceof Error ? homeQ.error.message : "The operational summary is temporarily unavailable."}
          </p>
          <Button className="mt-5" onClick={() => homeQ.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </PageShell>
    );
  }

  const data = homeQ.data;
  const now = new Date();
  const firstName = (displayName || user?.email?.split("@")[0] || "there").trim().split(/\s+/)[0];
  const today = todayLocal();
  const ownTodayRows = data.activities.filter((row) => row.user_id === user?.id && row.report_date === today);
  const todayRows = data.activities.filter((row) => row.report_date === today);
  const previousRows = data.activities.filter((row) => row.report_date !== today);
  const previousDays = new Set(previousRows.map((row) => row.report_date)).size;
  const todayBooked = sum(todayRows, "calls_booked");
  const previousBooked = sum(previousRows, "calls_booked");
  const recentBookedAverage = previousDays && previousBooked != null ? previousBooked / previousDays : previousDays ? null : 0;
  const ownProfile = data.profiles.find((profile) => profile.id === user?.id);
  const ownDials = sum(ownTodayRows, "dials");
  const ownDms = sum(ownTodayRows, "dms_sent");
  const ownBooked = sum(ownTodayRows, "calls_booked");
  const target = setterTarget(ownProfile?.setter_type, ownDials, ownDms, ownBooked);
  const activitySignal = buildActivitySignal(todayBooked, recentBookedAverage, previousDays);

  return (
    <PageShell className="pb-24 sm:pb-7">
      <header className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-caption font-medium text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
          <h1 className="mt-1 text-display text-foreground">{greetingForHour(now.getHours())}, {firstName}</h1>
          <p className="mt-2 max-w-2xl text-body text-muted-foreground">
            Start with exceptions, then move into the work queue for your role.
          </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/work">
            Open Work <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <main className="space-y-5">
          <section className="card-surface overflow-hidden" aria-labelledby="next-actions-title">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div>
                <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">Command queue</p>
                <h2 id="next-actions-title" className="mt-1 text-title font-semibold text-foreground">Next actions</h2>
              </div>
              <span className="text-caption tabular-nums text-muted-foreground">{priorities.length} visible</span>
            </div>
            <div className="divide-y divide-border">
              {priorities.map((item) => (
                <Link
                  key={item.key}
                  to={item.url as never}
                  preload="intent"
                  className="group grid min-h-[76px] grid-cols-[36px_minmax(0,1fr)_auto_24px] items-center gap-3 px-4 py-3.5 hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-safe:transition-colors sm:px-5"
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-md ${item.urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold text-foreground">{item.title}</span>
                    <span className="mt-0.5 block text-caption leading-5 text-muted-foreground">{item.detail}</span>
                  </span>
                  {item.count != null && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-semibold tabular-nums text-foreground">{item.count}</span>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section className="card-surface p-5 sm:p-6" aria-labelledby="team-pulse-title">
            <div className="grid gap-6 sm:grid-cols-[minmax(190px,0.75fr)_minmax(0,1.25fr)] sm:items-center">
              <div>
                <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">Today</p>
                <h2 id="team-pulse-title" className="mt-1 text-title font-semibold text-foreground">Team pulse</h2>
                <div className="mt-5 flex items-end gap-2">
                  <span className="text-[42px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">{data.submittedToday}</span>
                  <span className="pb-1 text-body text-muted-foreground">of {data.expectedFilers || data.submittedToday} EODs</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-label="Team EOD completion">
                  <div
                    className="h-full rounded-full bg-foreground motion-safe:transition-[width]"
                    style={{ width: `${Math.min(100, Math.round((data.submittedToday / Math.max(1, data.expectedFilers || data.submittedToday)) * 100))}%` }}
                  />
                </div>
              </div>
              <dl className="divide-y divide-border border-y border-border">
                <PulseRow label="Calls scheduled, next 7 days" value={data.callsThisWeek} />
                <PulseRow label="Active students needing attention" value={data.atRiskStudents} urgent={data.atRiskStudents != null && data.atRiskStudents > 0} />
                {canSeeFinance && <PulseRow label="Overdue installments" value={data.overdueInstallments} urgent={data.overdueInstallments != null && data.overdueInstallments > 0} />}
                {canApprove && <PulseRow label="Pending access requests" value={data.pendingApprovals} />}
              </dl>
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="card-surface p-5" aria-labelledby="your-day-title">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ClipboardCheck className="h-4 w-4" />
              <p className="text-micro font-semibold uppercase tracking-[0.1em]">Personal</p>
            </div>
            <h2 id="your-day-title" className="mt-2 text-title font-semibold text-foreground">Your day</h2>
            {roles.includes("setter") ? (
              <>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                    {target.progress == null ? "Unavailable" : `${target.progress}%`}
                  </p>
                    <p className="mt-2 text-caption text-muted-foreground">{target.label}</p>
                  </div>
                  <span className="text-caption text-muted-foreground">{ownTodayRows.length ? "Reported" : "Pending EOD"}</span>
                </div>
                {target.progress != null && (
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground" style={{ width: `${target.progress}%` }} />
                  </div>
                )}
                <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                  <MiniMetric label="Dials" value={ownDials} />
                  <MiniMetric label="DMs" value={ownDms} />
                  <MiniMetric label="Booked" value={ownBooked} />
                </dl>
              </>
            ) : (
              <dl className="mt-5 divide-y divide-border border-y border-border">
                <PulseRow label="EOD status" value={ownTodayRows.length ? "Submitted" : "Not submitted"} />
                <PulseRow label="Assigned items" value={data.assignedItems.length} urgent={data.assignedItems.length > 0} />
                {canSeeCustomers && <PulseRow label="Calls scheduled" value={data.callsThisWeek} />}
              </dl>
            )}
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link to={roles.some((role) => ["setter", "closer", "coach", "csm"].includes(role)) ? "/eods" : "/work"}>
                {roles.some((role) => ["setter", "closer", "coach", "csm"].includes(role)) ? "Open EOD" : "Open Work"}
              </Link>
            </Button>
          </section>

          <section className="card-surface p-5" aria-labelledby="signal-title">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <p className="text-micro font-semibold uppercase tracking-[0.1em]">One useful signal</p>
            </div>
            <h2 id="signal-title" className="sr-only">Activity signal</h2>
            <p className="mt-4 text-[16px] font-medium leading-6 text-foreground">{activitySignal.title}</p>
            <p className="mt-2 text-caption leading-5 text-muted-foreground">{activitySignal.detail}</p>
            <Link to={"/performance" as never} className="mt-4 inline-flex min-h-10 items-center gap-2 text-body font-semibold text-foreground hover:opacity-70">
              Open Performance <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <p className="px-1 text-micro text-muted-foreground">
            Updated {format(new Date(data.fetchedAt), "h:mm a")}. Activity comes from submitted EOD records.
          </p>
        </aside>
      </div>
    </PageShell>
  );
}

function setterTarget(
  setterType: string | null | undefined,
  dials: number | null,
  dms: number | null,
  booked: number | null,
) {
  const required = setterType === "phone"
    ? [dials, booked]
    : setterType === "dm"
      ? [dms, booked]
      : setterType === "full_cycle"
        ? [dials, dms, booked]
        : [booked];
  if (required.some((value) => value == null)) {
    return { progress: null, label: "Waiting for a complete submitted EOD." };
  }

  const safeDials = dials ?? 0;
  const safeDms = dms ?? 0;
  const safeBooked = booked ?? 0;
  const ratios = setterType === "phone"
    ? [safeDials / 100, safeBooked / 3]
    : setterType === "dm"
      ? [safeDms / 125, safeBooked / 3]
      : setterType === "full_cycle"
        ? [safeDials / 100, safeDms / 50, safeBooked / 3]
        : [safeBooked / 3];
  const progress = Math.min(100, Math.max(0, Math.round((ratios.reduce((total, ratio) => total + Math.min(1, ratio), 0) / ratios.length) * 100)));
  const label = setterType === "phone"
    ? `${safeDials}/100 dials · ${safeBooked}/3 sets`
    : setterType === "dm"
      ? `${safeDms}/125 DMs · ${safeBooked}/3 sets`
      : setterType === "full_cycle"
        ? `${safeDials}/100 dials · ${safeDms}/50 DMs · ${safeBooked}/3 sets`
        : `${safeBooked}/3 sets`;
  return { progress, label };
}

function buildActivitySignal(todayBooked: number | null, recentAverage: number | null, previousDays: number) {
  if (todayBooked == null || recentAverage == null) {
    return {
      title: "Booking pace is unavailable.",
      detail: "One or more submitted EOD records is missing a verified calls-booked value.",
    };
  }
  if (!previousDays) {
    return todayBooked > 0
      ? { title: `${todayBooked} ${todayBooked === 1 ? "call" : "calls"} booked today.`, detail: "More reporting history is needed before a reliable pace comparison is available." }
      : { title: "No bookings are reported yet today.", detail: "The signal updates automatically as team EODs are submitted." };
  }
  const delta = todayBooked - recentAverage;
  if (Math.abs(delta) < 0.5) {
    return { title: "Bookings are tracking near the recent daily pace.", detail: `${todayBooked} today compared with a ${recentAverage.toFixed(1)} call daily average over the visible reporting history.` };
  }
  if (delta > 0) {
    return { title: `Booking pace is ${Math.abs(delta).toFixed(1)} above the recent daily average.`, detail: `${todayBooked} calls are reported today compared with a ${recentAverage.toFixed(1)} daily average.` };
  }
  return { title: `Booking pace is ${Math.abs(delta).toFixed(1)} below the recent daily average.`, detail: `${todayBooked} calls are reported today compared with a ${recentAverage.toFixed(1)} daily average. Review the Work queue before treating this as a trend.` };
}

function PulseRow({ label, value, urgent = false }: { label: string; value: number | string | null; urgent?: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3">
      <dt className="text-caption leading-5 text-muted-foreground">{label}</dt>
      <dd className={`shrink-0 text-body font-semibold tabular-nums ${urgent ? "text-destructive" : "text-foreground"}`}>
        {value == null ? "Unavailable" : value}
      </dd>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-body font-semibold tabular-nums text-foreground">
        {value == null ? "Unavailable" : value.toLocaleString()}
      </dd>
    </div>
  );
}

function HomeLoading() {
  return (
    <PageShell className="pb-24 sm:pb-7">
      <div className="space-y-3 pt-3">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-[440px] max-w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <div className="space-y-5">
          <Skeleton className="h-[390px] w-full rounded-md" />
          <Skeleton className="h-[230px] w-full rounded-md" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-[300px] w-full rounded-md" />
          <Skeleton className="h-[210px] w-full rounded-md" />
        </div>
      </div>
    </PageShell>
  );
}
