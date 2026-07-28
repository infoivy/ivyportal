import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { TeamWeekSection } from "@/components/team-week";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { AlertCircle, ArrowRight, FileText, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeletons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { VolumeAreaChart } from "@/components/ui/volume-area-chart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { todayLocal } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({ meta: [{ title: "Performance · Ivy Portal" }] }),
  validateSearch: (search: Record<string, unknown>): { member?: string } =>
    typeof search.member === "string" && search.member ? { member: search.member } : {},
  component: PerformanceGate,
});

type RangeDays = 7 | 30 | 90;
type MetricKey = "dials" | "dms_sent" | "calls_booked" | "shows" | "closes";

type ActivityRow = {
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

type ProfileRow = {
  id: string;
  display_name: string | null;
  active: boolean | null;
  created_at: string;
};

type RoleRow = { user_id: string; role: string };

type RosterMember = {
  id: string;
  name: string;
  role: string;
  joinedAt: string;
};

type PerformanceData = {
  activities: ActivityRow[];
  roster: RosterMember[];
  dayList: string[];
  fetchedAt: string;
};

const METRICS: Array<{ value: MetricKey; label: string }> = [
  { value: "calls_booked", label: "Calls booked" },
  { value: "shows", label: "Shows" },
  { value: "closes", label: "Closes" },
  { value: "dials", label: "Dials" },
  { value: "dms_sent", label: "DMs sent" },
];

const REPORTING_ROLES = ["setter", "closer", "coach", "csm"] as const;
const ROLE_PRIORITY = ["closer", "setter", "coach", "csm", "admin"];

function buildDayList(days: number) {
  return Array.from({ length: days }, (_, index) =>
    format(subDays(new Date(), days - index - 1), "yyyy-MM-dd"),
  );
}

type NumericActivityKey = Exclude<keyof ActivityRow, "user_id" | "report_date">;

function sum(rows: ActivityRow[], key: NumericActivityKey): number | null {
  if (!rows.length || rows.some((row) => row[key] == null)) return null;
  return rows.reduce((total, row) => total + Number(row[key]), 0);
}

function formatMetric(value: number | null) {
  return value == null ? "Unavailable" : value.toLocaleString();
}

// Leadership view only (founder-directed 2026-07-28): reps see their own
// numbers on Home, never the whole team's accountability.
function PerformanceGate() {
  const { roles } = useAuth();
  const isLeader = roles.some((r) => ["admin", "founder", "cofounder"].includes(r));
  if (roles.length > 0 && !isLeader) return <Navigate to="/dashboard" replace />;
  return <PerformancePage />;
}

function PerformancePage() {
  const { user, roles } = useAuth();
  const search = Route.useSearch();
  // 7 days is the base view (founder-directed 2026-07-28)
  const [days, setDays] = useState<RangeDays>(7);
  const [metric, setMetric] = useState<MetricKey>("calls_booked");
  const [memberId, setMemberId] = useState(search.member ?? "all");
  const canSubmitEod = roles.some((role) => (REPORTING_ROLES as readonly string[]).includes(role));

  const performanceQ = useQuery({
    queryKey: ["page", "performance", days],
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
    queryFn: async (): Promise<PerformanceData> => {
      const dayList = buildDayList(days);
      const from = dayList[0];
      const to = todayLocal();
      const [activityRes, profileRes, roleRes] = await Promise.all([
        supabase
          .from("eods_activity_real")
          .select(
            "user_id, report_date, dials, dms_sent, convos_started, calls_booked, shows, no_shows, closes",
          )
          .gte("report_date", from)
          .lte("report_date", to)
          .order("report_date", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, display_name, active, created_at")
          .eq("is_demo", false),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", [...REPORTING_ROLES, "founder", "cofounder", "admin"]),
      ]);

      if (activityRes.error)
        throw new Error(`Performance activity failed: ${activityRes.error.message}`);
      if (profileRes.error)
        throw new Error(`Performance profiles failed: ${profileRes.error.message}`);
      if (roleRes.error) throw new Error(`Performance roles failed: ${roleRes.error.message}`);

      const activities = (activityRes.data ?? []) as ActivityRow[];
      const profiles = (profileRes.data ?? []) as ProfileRow[];
      const roleRows = (roleRes.data ?? []) as RoleRow[];
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      const roleMap = new Map<string, string[]>();
      roleRows.forEach((row) =>
        roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), row.role]),
      );
      const exempt = new Set(
        roleRows
          .filter((row) => ["founder", "cofounder"].includes(row.role))
          .map((row) => row.user_id),
      );
      const reportingIds = roleRows
        .filter((row) => (REPORTING_ROLES as readonly string[]).includes(row.role))
        .map((row) => row.user_id);
      const reportingIdSet = new Set(reportingIds);
      const activityIds = activities.map((row) => row.user_id);
      const ids = [...new Set([...reportingIds, ...activityIds])]
        .filter((id) => reportingIdSet.has(id) || !exempt.has(id))
        .filter((id) => profileMap.has(id));

      const roster = ids
        .map((id): RosterMember => {
          const profile = profileMap.get(id);
          const memberRoles = roleMap.get(id) ?? [];
          return {
            id,
            name: profile?.display_name?.trim() || "Unknown team member",
            role:
              ROLE_PRIORITY.find((role) => memberRoles.includes(role)) ??
              memberRoles[0] ??
              "member",
            joinedAt: profile?.created_at?.slice(0, 10) || from,
          };
        })
        .filter((member) => profileMap.get(member.id)?.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name));

      return { activities, roster, dayList, fetchedAt: new Date().toISOString() };
    },
  });

  const selectedRows = useMemo(() => {
    const rows = performanceQ.data?.activities ?? [];
    return memberId === "all" ? rows : rows.filter((row) => row.user_id === memberId);
  }, [memberId, performanceQ.data?.activities]);

  const trend = useMemo(() => {
    const dayList = performanceQ.data?.dayList ?? [];
    return dayList.map((date) => ({
      date,
      label: format(new Date(`${date}T12:00:00`), days <= 7 ? "EEE" : "MMM d"),
      value: sum(
        selectedRows.filter((row) => row.report_date === date),
        metric,
      ),
    }));
  }, [days, metric, performanceQ.data?.dayList, selectedRows]);

  const accountability = useMemo(() => {
    const data = performanceQ.data;
    if (!data) return [];
    return data.roster
      .map((member) => {
        const rows = data.activities.filter((row) => row.user_id === member.id);
        const availableDays = data.dayList.filter((date) => date >= member.joinedAt);
        const submittedDays = new Set(rows.map((row) => row.report_date)).size;
        const midpoint = Math.floor(data.dayList.length / 2);
        const earlierDays = new Set(data.dayList.slice(0, midpoint));
        const recentDays = new Set(data.dayList.slice(midpoint));
        const earlierBooked = sum(
          rows.filter((row) => earlierDays.has(row.report_date)),
          "calls_booked",
        );
        const recentBooked = sum(
          rows.filter((row) => recentDays.has(row.report_date)),
          "calls_booked",
        );
        const trendDirection =
          earlierBooked == null && recentBooked == null
            ? "Unavailable"
            : (recentBooked ?? 0) > (earlierBooked ?? 0)
              ? "Up"
              : (recentBooked ?? 0) < (earlierBooked ?? 0)
                ? "Down"
                : "Flat";
        return {
          ...member,
          submittedDays,
          expectedDays: availableDays.length,
          missingDays: Math.max(0, availableDays.length - submittedDays),
          coverage: availableDays.length
            ? Math.round((submittedDays / availableDays.length) * 100)
            : null,
          booked: sum(rows, "calls_booked"),
          shows: sum(rows, "shows"),
          closes: sum(rows, "closes"),
          trendDirection,
        };
      })
      .sort((a, b) => b.missingDays - a.missingDays || a.name.localeCompare(b.name));
  }, [performanceQ.data]);

  if (performanceQ.isLoading) return <PerformanceLoading />;

  if (performanceQ.isError || !performanceQ.data) {
    return (
      <PageShell className="pb-24 sm:pb-6">
        <div className="card-surface mx-auto mt-14 max-w-xl p-7 text-center">
          <AlertCircle className="mx-auto h-5 w-5 text-destructive" />
          <h1 className="mt-4 text-title font-semibold text-foreground">
            Performance could not load
          </h1>
          <p className="mt-2 text-body text-muted-foreground">
            {performanceQ.error instanceof Error
              ? performanceQ.error.message
              : "The reporting source is temporarily unavailable."}
          </p>
          <Button className="mt-5" onClick={() => performanceQ.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </PageShell>
    );
  }

  const data = performanceQ.data;
  const totalBooked = sum(selectedRows, "calls_booked");
  const totalShows = sum(selectedRows, "shows");
  const totalNoShows = sum(selectedRows, "no_shows");
  const totalCloses = sum(selectedRows, "closes");
  const submitted = new Set(selectedRows.map((row) => `${row.user_id}:${row.report_date}`)).size;
  const expected =
    memberId === "all"
      ? accountability.reduce((total, member) => total + member.expectedDays, 0)
      : (accountability.find((member) => member.id === memberId)?.expectedDays ?? 0);
  const showDenominator =
    totalShows != null && totalNoShows != null ? totalShows + totalNoShows : null;
  const showRate = showDenominator ? Math.round(((totalShows ?? 0) / showDenominator) * 100) : null;
  const closeRate =
    totalShows && totalCloses != null ? Math.round((totalCloses / totalShows) * 100) : null;
  const coverage = expected ? Math.min(100, Math.round((submitted / expected) * 100)) : null;
  const metricLabel = METRICS.find((item) => item.value === metric)?.label ?? "Activity";
  const memberOptions = [
    { value: "all", label: "All team" },
    ...(user?.id && data.roster.some((member) => member.id === user.id)
      ? [{ value: user.id, label: "My activity" }]
      : []),
    ...data.roster
      .filter((member) => member.id !== user?.id)
      .map((member) => ({ value: member.id, label: member.name })),
  ];
  const selectedMemberLabel =
    memberOptions.find((option) => option.value === memberId)?.label ?? "All team";

  return (
    <PageShell wide className="pb-24 sm:pb-7">
      <PageHeader
        title="Performance"
        subtitle={`Submitted EOD activity · ${format(new Date(`${data.dayList[0]}T12:00:00`), "MMM d")} to ${format(new Date(), "MMM d, yyyy")}`}
        actions={
          canSubmitEod ? (
            <Button asChild>
              <Link to="/eods">
                <FileText className="h-4 w-4" /> Open EOD
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="border-y border-border py-3 sm:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md bg-muted px-4 text-left text-body font-semibold text-foreground"
            >
              <span className="flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span className="truncate">Filters</span>
              </span>
              <span className="truncate text-caption font-normal text-muted-foreground">
                {days}D · {metricLabel} · {selectedMemberLabel}
              </span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>Performance filters</SheetTitle>
              <SheetDescription>
                Change the reporting window, activity metric, or team member.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <div className="text-caption font-semibold text-foreground">Reporting range</div>
                <div className="grid grid-cols-3 gap-2" aria-label="Reporting range">
                  {([7, 30, 90] as RangeDays[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDays(value)}
                      aria-pressed={days === value}
                      className={`min-h-12 rounded-md px-4 text-body font-semibold ${days === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
                    >
                      {value}D
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-caption font-semibold text-foreground">Activity metric</div>
                <SelectField
                  className="h-12 text-body"
                  value={metric}
                  onChange={(value) => setMetric(value as MetricKey)}
                  options={METRICS}
                />
              </div>
              <div className="space-y-2">
                <div className="text-caption font-semibold text-foreground">Team member</div>
                <SelectField
                  className="h-12 text-body"
                  value={memberId}
                  onChange={setMemberId}
                  options={memberOptions}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden border-y border-border py-3 sm:flex sm:items-center sm:justify-between">
        <div className="inline-flex rounded-md bg-muted p-1" aria-label="Reporting range">
          {([7, 30, 90] as RangeDays[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              aria-pressed={days === value}
              className={`min-h-10 rounded-md px-4 text-body font-semibold motion-safe:transition-colors ${days === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {value}D
            </button>
          ))}
        </div>
        <div className="w-[240px]">
          <SelectField value={memberId} onChange={setMemberId} options={memberOptions} />
        </div>
      </div>

      <section className="card-surface p-5 sm:p-6" aria-labelledby="performance-summary-title">
        <div className="grid gap-6 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)] md:items-center">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Reporting window
            </p>
            <h2
              id="performance-summary-title"
              className="mt-1 text-title font-semibold text-foreground"
            >
              Performance summary
            </h2>
            <div className="mt-5 text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
              {formatMetric(totalBooked)}
            </div>
            <p className="mt-2 text-caption text-muted-foreground">
              calls booked from submitted EODs
            </p>
          </div>
          <dl className="divide-y divide-border border-y border-border">
            <SummaryRow
              label="Show rate"
              value={showRate == null ? "Unavailable" : `${showRate}%`}
              detail={
                showRate == null
                  ? "No verified show/no-show denominator"
                  : `${formatMetric(totalShows)} shows · ${formatMetric(totalNoShows)} no-shows`
              }
            />
            <SummaryRow
              label="Close rate"
              value={closeRate == null ? "Unavailable" : `${closeRate}%`}
              detail={
                closeRate == null
                  ? "No verified shows denominator"
                  : `${formatMetric(totalCloses)} closes from ${formatMetric(totalShows)} shows`
              }
            />
            <SummaryRow
              label="EOD coverage"
              value={coverage == null ? "Unavailable" : `${coverage}%`}
              detail={
                coverage == null
                  ? "No expected reporting days in this range"
                  : `${submitted} submitted · ${Math.max(0, expected - submitted)} missing`
              }
            />
          </dl>
        </div>
      </section>

      <section className="card-surface p-4 sm:p-6" aria-labelledby="activity-trend-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              One canonical graph
            </p>
            <h2 id="activity-trend-title" className="mt-1 text-title font-semibold text-foreground">
              Activity trend
            </h2>
            <p className="mt-1 text-caption text-muted-foreground">
              {metricLabel} by reporting date.
            </p>
          </div>
          <div className="hidden w-[210px] sm:block">
            <SelectField
              value={metric}
              onChange={(value) => setMetric(value as MetricKey)}
              options={METRICS}
            />
          </div>
        </div>
        <div className="mt-5">
          {trend.some((point) => point.value != null) ? (
            <VolumeAreaChart
              data={trend}
              xKey="label"
              series={[
                {
                  key: "value",
                  label: metricLabel,
                  color: "var(--color-foreground)",
                  strokeWidth: 2,
                },
              ]}
              height={280}
              showDots
            />
          ) : (
            <div className="grid h-[280px] place-items-center rounded-md border border-dashed border-border px-5 text-center text-caption text-muted-foreground">
              No verified {metricLabel.toLowerCase()} data in this range.
            </div>
          )}
        </div>
      </section>

      {/* The founder's per-member week view: day chips + role footers
          (rebuilt after the command-center merge dropped it) */}
      <TeamWeekSection />

      <section className="card-surface overflow-hidden" aria-labelledby="team-accountability-title">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Submission and outcome record
          </p>
          <h2
            id="team-accountability-title"
            className="mt-1 text-title font-semibold text-foreground"
          >
            Team accountability
          </h2>
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-border text-micro uppercase tracking-[0.07em] text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">EOD coverage</th>
                <th className="px-4 py-3 text-right font-semibold">Booked</th>
                <th className="px-4 py-3 text-right font-semibold">Shows</th>
                <th className="px-4 py-3 text-right font-semibold">Closes</th>
                <th className="px-5 py-3 text-right font-semibold">Pace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accountability.map((member) => (
                <tr key={member.id} className="hover:bg-muted/40 motion-safe:transition-colors">
                  <td className="px-5 py-3.5 text-body font-semibold text-foreground">
                    {member.name}
                  </td>
                  <td className="px-4 py-3.5 text-caption capitalize text-muted-foreground">
                    {member.role}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-body font-semibold tabular-nums ${member.coverage != null && member.coverage < 70 ? "text-destructive" : "text-foreground"}`}
                      >
                        {member.coverage == null ? "Unavailable" : `${member.coverage}%`}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {member.submittedDays}/{member.expectedDays}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-body tabular-nums text-foreground">
                    {formatMetric(member.booked)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-body tabular-nums text-foreground">
                    {formatMetric(member.shows)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-body tabular-nums text-foreground">
                    {formatMetric(member.closes)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-caption text-muted-foreground">
                    {member.trendDirection}
                  </td>
                </tr>
              ))}
              {!accountability.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-caption text-muted-foreground"
                  >
                    No reporting team members were found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border xl:hidden">
          {accountability.map((member) => (
            <article key={member.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-body font-semibold text-foreground">{member.name}</h3>
                  <p className="mt-0.5 text-caption capitalize text-muted-foreground">
                    {member.role}
                  </p>
                </div>
                <span
                  className={`text-body font-semibold tabular-nums ${member.coverage != null && member.coverage < 70 ? "text-destructive" : "text-foreground"}`}
                >
                  {member.coverage == null ? "Unavailable" : `${member.coverage}% EOD`}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
                <MobileMetric label="Booked" value={member.booked} />
                <MobileMetric label="Shows" value={member.shows} />
                <MobileMetric label="Closes" value={member.closes} />
              </dl>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 px-1 text-micro text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Source: real-only submitted `eods_activity_real` records. Demo, Revenue, and CRM data are
          not mixed into this workspace.
        </span>
        <span>Updated {format(new Date(data.fetchedAt), "h:mm a")}</span>
      </div>

      {canSubmitEod && (
        <Link
          to="/eods"
          className="inline-flex min-h-12 items-center gap-2 text-body font-semibold text-foreground hover:opacity-70"
        >
          Submit or review my EOD <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </PageShell>
  );
}

function SummaryRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
      <div>
        <dt className="text-body font-medium text-foreground">{label}</dt>
        <p className="mt-0.5 text-caption text-muted-foreground">{detail}</p>
      </div>
      <dd className="text-title font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function MobileMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-body font-semibold tabular-nums text-foreground">
        {formatMetric(value)}
      </dd>
    </div>
  );
}

function PerformanceLoading() {
  return (
    <PageShell wide className="pb-24 sm:pb-7">
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-[420px] max-w-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-md" />
      <Skeleton className="h-[230px] w-full rounded-md" />
      <Skeleton className="h-[380px] w-full rounded-md" />
      <Skeleton className="h-[420px] w-full rounded-md" />
    </PageShell>
  );
}
