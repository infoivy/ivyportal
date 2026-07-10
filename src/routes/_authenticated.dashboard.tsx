import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Users, UserPlus, Eye, Zap, MessageSquare, Heart, MessagesSquare,
  Link2, FileText, Target, Globe, ArrowRightLeft, Calendar as CalIcon,
  Settings, CheckCircle2, AlertTriangle, DollarSign, Phone, Star, ChevronDown,
  ListChecks, Flame, TrendingUp, TrendingDown, Minus, Sunrise,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, LabelList, Cell,
} from "recharts";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import { money, startOfWeekMon, endOfWeekSun, isoDay, type Deal } from "@/lib/revenue";
import { RangePicker, type DateRange, rangeFor, daysBetween } from "@/components/range-picker";
import { StatDrilldown, type MetricKey } from "@/components/stat-drilldown";
import { DashboardSettingsSheet } from "@/components/dashboard-settings-sheet";
import { useDashboardPrefs } from "@/lib/dashboard-prefs";
import { VolumeAreaChart, VolumeLegend } from "@/components/ui/volume-area-chart";
import { OnboardingPanel } from "@/components/onboarding-panel";
import { DeltaChip } from "@/components/ui/delta-chip";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ISA Team" }] }),
  component: Dashboard,
});

type EodRow = {
  id: string;
  user_id: string;
  report_date: string;
  dms_sent: number;
  convos_started: number;
  calls_booked: number;
  calls_scheduled: number;
  shows: number;
  no_shows: number; closes: number;
};
type Profile = { id: string; display_name: string | null };

function currentQuarterLabel(d = new Date()) {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
] as const;
type RangeKey = typeof RANGES[number]["key"];

const DEFAULT_GOALS = { dms: 20000, convos: 3000, calls: 500, shows: 350, showRate: 75, viral: 3 };
type QuarterGoals = typeof DEFAULT_GOALS;

type OpsCounts = {
  atRisk: number;
  installmentsDueSoon: number;
  installmentsOverdue: number;
  callsThisWeek: number;
  eodsMissingToday: number;
  testimonialsPending: number;
  openActionItems: number;
};

function Dashboard() {
  const { user, displayName, roles } = useAuth();
  const navigate = useNavigate();
  const isFounder = roles.includes("admin") && !roles.includes("setter") && !roles.includes("closer") && !roles.includes("coach") && !roles.includes("csm");
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeFor("30d"));
  const [compare, setCompare] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<MetricKey | null>(null);
  const [eods, setEods] = useState<EodRow[]>([]);
  const [prevEods, setPrevEods] = useState<EodRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [ops, setOps] = useState<OpsCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const { prefs, save: savePrefs } = useDashboardPrefs(user?.id);
  const [igReminderDismissed, setIgReminderDismissed] = useState(false);
  const [igLoggedThisMonth, setIgLoggedThisMonth] = useState(true);
  const [eodsTodayCount, setEodsTodayCount] = useState(0);
  const [cashMtd, setCashMtd] = useState(0);
  const [nextDue, setNextDue] = useState<{ date: string; amount: number; currency: string; studentName: string } | null>(null);
  const [goals, setGoals] = useState<QuarterGoals>(DEFAULT_GOALS);
  const goalsQ = useQuery({
    queryKey: ["page", "dashboard", "goals"],
    queryFn: async () => (await supabase.from("founder_settings").select("quarterly_goals").maybeSingle()).data,
  });
  useEffect(() => {
    const g = (goalsQ.data as { quarterly_goals?: Partial<QuarterGoals> } | null)?.quarterly_goals;
    if (g) setGoals({ ...DEFAULT_GOALS, ...g });
  }, [goalsQ.data]);

  const days = daysBetween(dateRange);

  const fetchDashboard = async () => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const from = format(dateRange.from, "yyyy-MM-dd");
    const to = format(dateRange.to, "yyyy-MM-dd");
    const prevFrom = format(subDays(dateRange.from, days), "yyyy-MM-dd");
    const prevTo = format(subDays(dateRange.from, 1), "yyyy-MM-dd");
    const in3 = format(new Date(now.getTime() + 3 * 86400000), "yyyy-MM-dd");
    const in7 = format(new Date(now.getTime() + 7 * 86400000), "yyyy-MM-dd");
    const eodRisk = format(subDays(now, 5), "yyyy-MM-dd");
    const callRisk = format(subDays(now, 14), "yyyy-MM-dd");

    {
      const [cur, prev, profs, students, callsThisWeek, callsRecent, eodsRecent, todayEods, installmentsDue, installmentsLate, testimonials, actionCalls] = await Promise.all([
        supabase.from("eods").select("id, user_id, report_date, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows, closes").gte("report_date", from).lte("report_date", to).order("report_date", { ascending: true }),
        compare
          ? supabase.from("eods").select("id, user_id, report_date, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows, closes").gte("report_date", prevFrom).lte("report_date", prevTo)
          : Promise.resolve({ data: [] as EodRow[] }),
        supabase.from("profiles").select("id, display_name"),
        supabase.from("students").select("id, status, phase").eq("status", "active"),
        supabase.from("student_calls").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("call_date", today).lte("call_date", in7),
        supabase.from("student_calls").select("student_id, call_date").eq("status", "completed").gte("call_date", callRisk),
        supabase.from("student_eods").select("student_id, report_date").gte("report_date", eodRisk),
        supabase.from("eods").select("user_id").eq("report_date", today),
        supabase.from("installment_payments").select("id", { count: "exact", head: true }).eq("status", "upcoming").gte("due_date", today).lte("due_date", in3),
        supabase.from("installment_payments").select("id", { count: "exact", head: true }).eq("status", "upcoming").lt("due_date", today),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active").eq("testimonial_collected", false).not("first_win_at", "is", null),
        supabase.from("student_calls").select("action_items_json").not("action_items_json", "is", null).limit(2000),
      ]);
      const eodRows = (cur.data as EodRow[]) ?? [];
      const prevRows = (prev.data as EodRow[]) ?? [];
      const pmap: Record<string, Profile> = {};
      (profs.data as Profile[] | null)?.forEach((p) => { pmap[p.id] = p; });

      const eodByStudent = new Set((eodsRecent.data as { student_id: string }[] | null ?? []).map(r => r.student_id));
      const callByStudent = new Set((callsRecent.data as { student_id: string }[] | null ?? []).map(r => r.student_id));
      const activeStudents = (students.data as { id: string; status: string; phase: string }[] | null) ?? [];
      // At-risk only while in the active journey; missed-1:1 only applies in coaching.
      const atRisk = activeStudents.filter(s =>
        ["onboarding", "coaching_1on1", "applying"].includes(s.phase) &&
        (!eodByStudent.has(s.id) || (s.phase === "coaching_1on1" && !callByStudent.has(s.id)))
      ).length;

      const eodsToday = (todayEods.data as any[])?.length ?? 0;
      const filedToday = new Set(((todayEods.data as { user_id: string }[] | null) ?? []).map(r => r.user_id));
      const recentFilers = new Set(eodRows.map(r => r.user_id));
      const eodsMissingToday = Array.from(recentFilers).filter(u => !filedToday.has(u)).length;

      let openActionItems = 0;
      ((actionCalls.data as any[]) ?? []).forEach(r => {
        const items = Array.isArray(r.action_items_json) ? r.action_items_json : [];
        openActionItems += items.filter((it: any) => !it?.done).length;
      });

      const ops: OpsCounts = {
        atRisk,
        installmentsDueSoon: installmentsDue.count ?? 0,
        installmentsOverdue: installmentsLate.count ?? 0,
        callsThisWeek: callsThisWeek.count ?? 0,
        eodsMissingToday,
        testimonialsPending: testimonials.count ?? 0,
        openActionItems,
      };
      return { eodRows, prevRows, pmap, ops, eodsToday };
    }
  };

  const mainQ = useQuery({
    queryKey: ["page", "dashboard", format(dateRange.from, "yyyy-MM-dd"), format(dateRange.to, "yyyy-MM-dd"), compare],
    queryFn: fetchDashboard,
    placeholderData: (prev) => prev, // keep last data visible while a new range loads
  });
  useEffect(() => {
    if (!mainQ.data) return;
    setEods(mainQ.data.eodRows);
    setPrevEods(mainQ.data.prevRows);
    setProfiles(mainQ.data.pmap);
    setOps(mainQ.data.ops);
    setEodsTodayCount(mainQ.data.eodsToday);
    setLoading(false);
  }, [mainQ.data]);

  const cashQ = useQuery({
    queryKey: ["page", "dashboard", "cash-mtd"],
    queryFn: async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const monthStart = `${y}-${m}-01`;
      const today = now.toISOString().slice(0, 10);
      const [dealsRes, instRes] = await Promise.all([
        supabase.from("deals").select("cash_collected_upfront").gte("deal_date", monthStart).lte("deal_date", today),
        supabase.from("installment_payments").select("amount, currency, due_date, installments!inner(students(full_name))").eq("status", "upcoming").gte("due_date", today).order("due_date", { ascending: true }).limit(1),
      ]);
      return { deals: dealsRes.data ?? [], firstDue: (instRes.data ?? [])[0] as any };
    },
  });
  useEffect(() => {
    if (!cashQ.data) return;
    const total = (cashQ.data.deals as any[]).reduce((s, d) => s + (Number(d.cash_collected_upfront) || 0), 0);
    setCashMtd(total);
    const first = cashQ.data.firstDue;
    if (first) setNextDue({ date: first.due_date, amount: first.amount, currency: first.currency, studentName: first.installments?.students?.full_name ?? "Unknown" });
  }, [cashQ.data]);

  // E20: Check if IG snapshot logged this month (only for founder/admin)
  const igQ = useQuery({
    queryKey: ["page", "dashboard", "ig-logged", new Date().toISOString().slice(0, 7)],
    enabled: roles.includes("founder") || roles.includes("admin"),
    queryFn: async () => {
      const thisMonth = new Date().toISOString().slice(0, 7);
      const { count } = await supabase.from("ig_monthly_snapshots").select("id", { count: "exact", head: true }).eq("month", `${thisMonth}-01`);
      return (count ?? 0) > 0;
    },
  });
  useEffect(() => { if (igQ.data != null) setIgLoggedThisMonth(igQ.data); }, [igQ.data]);

  const totals = useMemo(() => sumRows(eods), [eods]);
  const prevTotals = useMemo(() => sumRows(prevEods), [prevEods]);
  const trend = useMemo(() => {
    const curr = buildTrend(eods, days);
    if (!compare || prevEods.length === 0) return curr;
    const prev = buildTrend(prevEods, days, days); // same shape, shifted one window back
    return curr.map((row, i) => ({
      ...row,
      prev_dms: prev[i]?.dms ?? 0,
      prev_convos: prev[i]?.convos ?? 0,
      prev_booked: prev[i]?.booked ?? 0,
    }));
  }, [eods, prevEods, compare, days]);
  const hasPrev = compare && prevEods.length > 0;

  const showRate = totals.shows + totals.no_shows > 0
    ? Math.round((totals.shows / (totals.shows + totals.no_shows)) * 100) : 0;

  const activeSetters = new Set(eods.map((e) => e.user_id)).size;
  const totalEods = eods.length;

  const topSetters = useMemo(() => {
    const byUser: Record<string, { user_id: string; calls: number; dms: number; convos: number; shows: number }> = {};
    for (const r of eods) {
      const b = byUser[r.user_id] ?? (byUser[r.user_id] = { user_id: r.user_id, calls: 0, dms: 0, convos: 0, shows: 0 });
      b.calls += r.calls_booked;
      b.dms += r.dms_sent;
      b.convos += r.convos_started;
      b.shows += r.shows;
    }
    return Object.values(byUser).sort((a, b) => b.calls - a.calls).slice(0, 8);
  }, [eods]);

  const stagePct = (value: number, prev: number) => (prev > 0 ? Math.round((value / prev) * 1000) / 10 : null);
  const formatBreakdown = [
    { label: "DMs → Convos", value: totals.convos_started, pct: stagePct(totals.convos_started, totals.dms_sent), color: "var(--chart-1)" },
    { label: "Convos → Booked", value: totals.calls_booked, pct: stagePct(totals.calls_booked, totals.convos_started), color: "var(--chart-3)" },
    { label: "Booked → Shows", value: totals.shows, pct: stagePct(totals.shows, totals.calls_booked), color: "var(--chart-5)" },
    { label: "Booked → Closed", value: totals.closes, pct: stagePct(totals.closes, totals.calls_booked), color: "var(--chart-4)" },
  ];

  const rangeLabel =
    dateRange.preset === "7d" ? "Last 7 days"
    : dateRange.preset === "30d" ? "Last 30 days"
    : dateRange.preset === "90d" ? `Last 90 days · ${currentQuarterLabel()}`
    : `${format(dateRange.from, "MMM d")} → ${format(dateRange.to, "MMM d, yyyy")}`;
  const goalsLabel = `${currentQuarterLabel()} Goals`;

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5"><div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-display text-foreground">
              {displayName ?? "Team"}
            </h1>
            <p className="text-body text-muted-foreground mt-1">
              {rangeLabel} · {roles.length ? roles.join(", ") : "member"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RangePicker value={dateRange} onChange={setDateRange} />
            <button
              onClick={() => setCompare((c) => !c)}
              className={`inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md motion-safe:transition-colors ${
                compare
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title={`Compare against the previous ${days} days`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Compare
            </button>
            {compare && <span className="text-caption text-muted-foreground">vs previous {days}d</span>}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-md bg-muted text-muted-foreground hover:text-foreground motion-safe:transition-colors"
              title="Dashboard settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Start Here — one checklist per business role held */}
        <OnboardingPanel compact />

        {/* IG monthly log reminder */}
        {roles.includes("founder") && !igLoggedThisMonth && !igReminderDismissed && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-muted text-[13px] text-foreground">
            <span>No IG analytics logged this month — keep your growth data up to date.</span>
            <div className="flex items-center gap-2 shrink-0">
              <a href="/content?tab=instagram" className="font-medium text-primary hover:underline">Log now →</a>
              <button onClick={() => setIgReminderDismissed(true)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
          </div>
        )}

        {/* Cash MTD hero — admin/founder only */}
        {(roles.includes("admin") || roles.includes("founder")) && (
          <div className="card-surface px-6 py-5 flex items-end justify-between">
            <div>
              <div className="text-[12px] text-muted-foreground mb-3">Cash collected this month</div>
              <div className="text-[36px] font-medium tabular-nums text-foreground tracking-[-0.025em] leading-none">
                {cashMtd > 0 ? money(cashMtd) : "—"}
              </div>
            </div>
            <Link to="/revenue" className="text-[13px] text-primary hover:text-primary/80 mb-1 shrink-0">View revenue →</Link>
          </div>
        )}

        {/* KPI Row — 4 primary metrics + secondary inline */}
        {prefs.showKpis && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="DMs Sent"   value={totals.dms_sent}    onClick={() => setDrilldown("dms_sent")}    delta={compare ? { value: totals.dms_sent - prevTotals.dms_sent, format: "count" } : null} />
              <Kpi label="Booked"     value={totals.calls_booked} onClick={() => setDrilldown("calls_booked")} delta={compare ? { value: totals.calls_booked - prevTotals.calls_booked, format: "count" } : null} />
              <Kpi label="Shows"      value={totals.shows}        onClick={() => setDrilldown("shows")}       delta={compare ? { value: totals.shows - prevTotals.shows, format: "count" } : null} />
              <Kpi label="Show Rate"  value={showRate} suffix="%" delta={compare ? { value: showRate - prevShowRateOf(prevTotals), format: "pct" } : null} />
            </div>
            {/* Secondary stats — compact inline row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 px-1">
              <SecondaryKpi label="Convos" value={totals.convos_started} onClick={() => setDrilldown("convos_started")} delta={compare ? totals.convos_started - prevTotals.convos_started : null} />
              <SecondaryKpi label="No-Shows" value={totals.no_shows} onClick={() => setDrilldown("no_shows")} />
              <SecondaryKpi label="Scheduled" value={totals.calls_scheduled} onClick={() => setDrilldown("calls_scheduled")} />
              <SecondaryKpi label="Active setters" value={activeSetters} />
              <SecondaryKpi label="EODs filed" value={totalEods} onClick={() => navigate({ to: "/eods" })} />
            </div>
          </>
        )}

        {/* Ops strip */}
        {prefs.showOps && (
          <div className="card-surface px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground/60 shrink-0">Today</span>
            <OpsChip to="/students" search={{ view: "atRisk" } as any} danger={!!ops && ops.atRisk > 0} count={ops?.atRisk} label="at-risk" />
            <OpsChip to="/installments" danger={!!ops && ops.installmentsOverdue > 0} count={ops?.installmentsOverdue} label="overdue" />
            <OpsChip to="/installments" warn={!!ops && ops.installmentsDueSoon > 0} count={ops?.installmentsDueSoon} label="due soon" />
            <OpsChip to="/calls" count={ops?.callsThisWeek} label="calls/wk" />
            {!isFounder && <OpsChip to="/eods" warn={!!ops && ops.eodsMissingToday > 0} count={ops?.eodsMissingToday} label="EODs missing" />}
            <OpsChip to="/students" warn={!!ops && ops.testimonialsPending > 0} count={ops?.testimonialsPending} label="testimonials" />
            <OpsChip to="/action-items" warn={!!ops && ops.openActionItems > 0} count={ops?.openActionItems} label="actions open" />
            {nextDue && (roles.includes("admin") || roles.includes("closer")) && (
              <>
                <span className="hidden sm:block h-3.5 w-px bg-border shrink-0" />
                <Link to="/installments" className="text-[12px] text-muted-foreground hover:text-foreground ml-auto">
                  Next due <span className="font-medium text-foreground">{nextDue.currency} {Number(nextDue.amount).toLocaleString()}</span>
                  {nextDue.studentName && <span className="opacity-60"> · {nextDue.studentName}</span>}
                </Link>
              </>
            )}
          </div>
        )}

        {prefs.showMyDay && <MyDayBlock roles={roles} />}


        {prefs.showInstallmentReminders && <InstallmentReminders />}

        {/* Row 2: Growth + Format + Transformation */}
        {(prefs.showGrowth || prefs.showFunnel || hasPrev) && (
          <div className={`grid gap-3 ${hasPrev ? "lg:grid-cols-[1.2fr_1fr_1fr]" : "lg:grid-cols-[1.5fr_1fr]"}`}>
            {prefs.showGrowth && (
              <Panel>
                <div className="mb-2">
                  <div className="text-[15px] font-semibold text-foreground">Volume trend</div>
                  <div className="text-xs text-muted-foreground mt-0.5">DMs, convos &amp; booked · {rangeLabel}</div>
                </div>
                {loading ? <div className="h-[240px]"><Skeleton /></div> : (
                  <>
                    <VolumeAreaChart
                      data={trend}
                      series={[
                        ...(hasPrev ? [
                          { key: "prev_dms",    label: "DMs (prev)",    color: "var(--color-muted-foreground)", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
                          { key: "prev_convos", label: "Convos (prev)", color: "var(--chart-1)", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
                          { key: "prev_booked", label: "Booked (prev)", color: "var(--chart-2)", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
                        ] : []),
                        { key: "dms",    label: "DMs",    color: "var(--color-muted-foreground)" },
                        { key: "convos", label: "Convos", color: "var(--chart-1)" },
                        { key: "booked", label: "Booked", color: "var(--chart-2)", strokeWidth: 2 },
                      ]}
                    />
                    <div className="flex items-center justify-between">
                      <VolumeLegend series={[
                        { key: "dms",    label: "DMs",    color: "var(--color-muted-foreground)" },
                        { key: "convos", label: "Convos", color: "var(--chart-1)" },
                        { key: "booked", label: "Booked", color: "var(--chart-2)" },
                      ]} />
                      {hasPrev && <span className="text-micro text-muted-foreground">faded = previous {days}d</span>}
                    </div>
                  </>
                )}
              </Panel>
            )}


            {prefs.showFunnel && (
              <Panel>
                <PanelHead title="Funnel Performance" subtitle="Volume by stage" />
                <div className="h-[220px] mt-1">
                  {loading ? <Skeleton /> : (
                    <ResponsiveContainer>
                      <BarChart data={formatBreakdown} layout="vertical" margin={{ top: 5, right: 56, left: 20, bottom: 5 }}>
                        <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={104} />
                        <Tooltip
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 11 }}
                          cursor={{ fill: "var(--muted)" }}
                          formatter={(value: number, _name, entry) => {
                            const pct = (entry?.payload as { pct?: number | null })?.pct;
                            return [`${value.toLocaleString()}${pct != null ? ` · ${pct}% conversion` : ""}`, ""];
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                          {formatBreakdown.map((f, i) => <Cell key={i} fill={f.color} />)}
                          <LabelList
                            dataKey="value"
                            position="right"
                            content={(props: any) => {
                              const { x, y, width, height, index } = props;
                              const row = formatBreakdown[index as number];
                              if (!row) return null;
                              return (
                                <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dominantBaseline="middle" fontSize={10} fill="var(--color-muted-foreground)" className="num">
                                  {row.value.toLocaleString()}{row.pct != null ? ` · ${row.pct}%` : ""}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Panel>
            )}

            {hasPrev && (
              <Panel accent="emerald">
                <div className="flex items-center gap-2 mb-3">
                  <div className="grid h-6 w-6 place-items-center rounded-sm bg-success-bg border border-success/25">
                    <Zap className="h-3 w-3 text-success-fg" />
                  </div>
                  <h3 className="text-sm font-semibold">Period Deltas</h3>
                  <span className="ml-auto text-[10px] text-muted-foreground">vs previous {days}d</span>
                </div>
                <div className="space-y-2.5">
                  <Transform label="DMs Sent"     prev={prevTotals.dms_sent}       curr={totals.dms_sent} />
                  <Transform label="Convos"       prev={prevTotals.convos_started} curr={totals.convos_started} />
                  <Transform label="Booked"       prev={prevTotals.calls_booked}   curr={totals.calls_booked} />
                  <Transform label="Shows"        prev={prevTotals.shows}          curr={totals.shows} />
                  <Transform label="Show Rate"    prev={prevShowRateOf(prevTotals)} curr={showRate} suffix="%" />
                </div>
              </Panel>
            )}
          </div>
        )}

        {(prefs.showCashLeaderboard || prefs.showTopSetters || prefs.showWeeklyLeaderboard) && (
          <UnifiedLeaderboard profiles={profiles} eods={eods} canSeeCash={roles.includes("admin") || roles.includes("founder") || roles.includes("closer")} />
        )}

        {/* Row 3: Goals + Team Comp (top setters merged into UnifiedLeaderboard above) */}
        {((prefs.showGoals && (roles.includes("admin") || roles.includes("founder"))) || prefs.showTeamComp) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {prefs.showGoals && (roles.includes("admin") || roles.includes("founder")) && (
              <Panel>
                <div className="flex items-center gap-2 mb-3">
                  <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-primary/10">
                    <Target className="h-3 w-3 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">{goalsLabel}</h3>
                </div>
                <div className="space-y-3">
                  <Goal label="DMs Sent"     value={totals.dms_sent}       target={goals.dms}     color="var(--color-primary)" />
                  <Goal label="Convos"       value={totals.convos_started} target={goals.convos}  color="var(--color-primary)" />
                  <Goal label="Calls Booked" value={totals.calls_booked}   target={goals.calls}   color="var(--color-primary)" />
                  <Goal label="Shows"        value={totals.shows}          target={goals.shows}   color="var(--color-primary)" warn={totals.shows < goals.shows * 0.5 && days >= 30} />
                  <Goal label="Show Rate"    value={showRate}              target={goals.showRate} suffix="%" color="var(--color-primary)" />
                </div>
              </Panel>
            )}

            {prefs.showTeamComp && (
              <Panel>
                <div className="flex items-center gap-2 mb-3">
                  <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-primary/10">
                    <Globe className="h-3 w-3 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">Team Composition</h3>
                </div>
                <div className="space-y-2">
                  <AudienceRow label="Active this period" value={activeSetters} total={Math.max(activeSetters, 1)} color="var(--color-primary)" />
                  <AudienceRow label="EODs / setter"      value={activeSetters > 0 ? Math.round(totalEods / activeSetters) : 0} total={days} color="var(--color-primary)" suffix={` / ${days}`} />
                  <AudienceRow label="Avg calls / setter" value={activeSetters > 0 ? Math.round(totals.calls_booked / activeSetters) : 0} total={goals.calls / Math.max(activeSetters, 1)} color="var(--color-primary)" />
                </div>
              </Panel>
            )}
          </div>
        )}



        {/* Quick actions */}
        {prefs.showQuickActions && (
          <div className="grid gap-2 sm:grid-cols-4">
            <QuickAction to="/eods"     icon={FileText}   label="Submit EOD" />
            <QuickAction to="/sales" search={{ tab: "trends" }} icon={Target} label="Sales Trends" />
            <QuickAction to="/training" icon={Zap}        label="Training" />
            <QuickAction to="/policies/crm-hygiene" icon={MessageSquare} label="CRM Hygiene" />
          </div>
        )}
      </div>
    </div>

      <StatDrilldown
        open={drilldown !== null}
        onOpenChange={(v) => !v && setDrilldown(null)}
        metric={drilldown}
        eods={eods}
        profiles={profiles}
        rangeLabel={rangeLabel}
        prevEods={compare ? prevEods : []}
        prevLabel={`previous ${days}d`}
      />
      <DashboardSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={prefs}
        onChange={savePrefs}
      />
    </div>
  );
}

/* helpers */
function sumRows(rows: EodRow[]) {
  return rows.reduce((a, r) => ({
    dms_sent: a.dms_sent + r.dms_sent,
    convos_started: a.convos_started + r.convos_started,
    calls_booked: a.calls_booked + r.calls_booked,
    calls_scheduled: a.calls_scheduled + r.calls_scheduled,
    shows: a.shows + r.shows,
    no_shows: a.no_shows + r.no_shows,
    closes: a.closes + (r.closes || 0),
  }), { dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0, shows: 0, no_shows: 0, closes: 0 });
}
function pctDelta(prev: number, curr: number): number | null {
  if (!prev) return curr > 0 ? 100 : null;
  return ((curr - prev) / prev) * 100;
}
function prevShowRateOf(t: ReturnType<typeof sumRows>) {
  return t.shows + t.no_shows > 0 ? Math.round((t.shows / (t.shows + t.no_shows)) * 100) : 0;
}
function buildTrend(rows: EodRow[], days: number, shiftBack = 0) {
  const map: Record<string, { dms: number; convos: number; booked: number }> = {};
  const out: { key: string; label: string; dms: number; convos: number; booked: number }[] = [];
  const today = new Date();
  const step = days <= 7 ? 1 : days <= 30 ? 1 : 3;
  for (let i = days - 1; i >= 0; i -= step) {
    const d = subDays(today, i + shiftBack);
    const key = format(d, "yyyy-MM-dd");
    map[key] = { dms: 0, convos: 0, booked: 0 };
    out.push({ key, label: format(d, days <= 7 ? "EEE" : "MMM d"), dms: 0, convos: 0, booked: 0 });
  }
  for (const r of rows) {
    const b = map[r.report_date];
    if (!b) continue;
    b.dms += r.dms_sent;
    b.convos += r.convos_started;
    b.booked += r.calls_booked;
  }
  return out.map((o) => ({ ...o, ...map[o.key] }));
}

/* subcomponents */
function Panel({ children, accent }: { children: React.ReactNode; accent?: "emerald" }) {
  return (
    <div className={`card-surface p-3.5 ${accent === "emerald" ? "ring-1 ring-primary/30" : ""}`}>
      {children}
    </div>
  );
}
function PanelHead({ title, subtitle, legend }: { title: string; subtitle?: string; legend?: { color: string; label: string }[] }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-1">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold truncate">{title}</h3>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {legend && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          {legend.map(l => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
function Kpi({ label, value, suffix, onClick, delta }: {
  label: string; value: number; suffix?: string;
  onClick?: () => void;
  delta?: { value: number; format?: "money" | "count" | "pct"; positiveIsGood?: boolean } | null;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
      className={`card-surface px-5 py-4 ${clickable ? "cursor-pointer motion-safe:hover:brightness-110 motion-safe:transition-all" : ""}`}
    >
      <div className="text-[12px] text-muted-foreground mb-3">{label}</div>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <div className="text-[32px] font-medium tabular-nums text-foreground tracking-[-0.025em] leading-none">
          {value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : value.toLocaleString()}{suffix}
        </div>
        {delta != null && (
          <DeltaChip value={delta.value} format={delta.format ?? "count"} positiveIsGood={delta.positiveIsGood ?? true} />
        )}
      </div>
    </div>
  );
}

const OPS_TONE: Record<string, { dot: string; value: string }> = {
  rose:   { dot: "bg-danger",    value: "text-danger-fg" },
  amber:  { dot: "bg-warning",  value: "text-warning-fg" },
  sky:    { dot: "bg-primary",    value: "text-foreground" },
  muted:  { dot: "bg-muted-foreground/40", value: "text-foreground" },
};

function OpsCard({
  to, search, tone, icon: Icon, label, value,
}: {
  to: string; search?: Record<string, unknown>;
  tone: keyof typeof OPS_TONE;
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | undefined;
}) {
  const t = OPS_TONE[tone];
  return (
    <Link
      to={to as any}
      search={search as any}
      className="card-surface p-4 block motion-safe:transition-transform motion-safe:hover:-translate-y-px"
    >
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${t.dot}`} />
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-[24px] font-semibold tabular-nums mt-2 tracking-[-0.01em] ${t.value}`}>
        {value == null ? <span className="text-muted-foreground text-sm">—</span> : value.toLocaleString()}
      </div>
    </Link>
  );
}

function Transform({ label, prev, curr, suffix }: { label: string; prev: number; curr: number; suffix?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground text-[11px]">{prev.toLocaleString()}{suffix}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium text-success-fg">{curr.toLocaleString()}{suffix}</span>
      </div>
    </div>
  );
}
function Goal({ label, value, target, suffix, color, warn }: { label: string; value: number; target: number; suffix?: string; color: string; warn?: boolean }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="inline-flex items-center gap-1.5">
          {label}
          {warn ? <AlertTriangle className="h-3 w-3 text-danger-fg" /> : pct >= 100 ? <CheckCircle2 className="h-3 w-3 text-success-fg" /> : null}
        </span>
        <span className="tabular-nums text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{value.toLocaleString()}{suffix}</span> / {target.toLocaleString()}{suffix}
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: warn ? "#ef4444" : color }} />
      </div>
    </div>
  );
}
function AudienceRow({ label, value, total, color, suffix }: { label: string; value: number; total: number; color: string; suffix?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-[11px] font-semibold text-foreground">{value.toLocaleString()}{suffix ?? ""}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
function QuickAction({ to, search, icon: Icon, label }: { to: string; search?: Record<string, string>; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} search={search} className="rounded-md border border-border bg-card p-3 hover:bg-muted/50 motion-safe:transition-colors flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
function Skeleton() {
  return <div className="h-full w-full rounded bg-white/5 animate-pulse" />;
}

type ReminderRow = {
  id: string;
  amount: number;
  currency: string;
  due_date: string;
  days: number;
  student_id: string | null;
  student_name: string;
  coach_name: string | null;
};

function InstallmentReminders() {
  const { user, roles } = useAuth();
  const [rows, setRows] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = roles.includes("admin");
  const isCoach = roles.includes("coach");
  const canSee = isAdmin || isCoach;

  useEffect(() => {
    if (!user || !canSee) { setLoading(false); return; }
    let alive = true;
    (async () => {
      const today = new Date();
      const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
      const to = in3.toISOString().slice(0, 10);
      let q = supabase
        .from("installment_payments")
        .select("id, amount, currency, due_date, installments!inner(coach_id, student_id, students(id, full_name))")
        .eq("status", "upcoming")
        .lte("due_date", to)
        .order("due_date", { ascending: true })
        .limit(25);
      if (!isAdmin && isCoach) q = q.eq("installments.coach_id", user.id);
      const { data } = await q;
      if (!alive) return;
      const coachIds = Array.from(new Set((data ?? []).map((r: any) => r.installments?.coach_id).filter(Boolean)));
      const coachMap = new Map<string, string>();
      if (coachIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", coachIds);
        (profs ?? []).forEach(p => coachMap.set(p.id, p.display_name ?? ""));
      }
      const now = new Date(new Date().toISOString().slice(0, 10));
      const mapped: ReminderRow[] = (data ?? []).map((r: any) => {
        const student = r.installments?.students;
        const days = Math.round((new Date(r.due_date).getTime() - now.getTime()) / 86400000);
        return {
          id: r.id,
          amount: r.amount,
          currency: r.currency,
          due_date: r.due_date,
          days,
          student_id: student?.id ?? null,
          student_name: student?.full_name ?? "Unknown",
          coach_name: r.installments?.coach_id ? (coachMap.get(r.installments.coach_id) || null) : null,
        };
      });
      setRows(mapped);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id, isAdmin, isCoach, canSee]);

  if (!canSee) return null;

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Installment reminders</span>
          <span className="text-[10px] text-muted-foreground">next 3 days + overdue</span>
        </div>
        <Link to="/installments" className="text-[10px] text-muted-foreground hover:text-foreground">Open →</Link>
      </div>
      {loading ? (
        <div className="p-4"><Skeleton /></div>
      ) : rows.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nothing due in the next 3 days 🎉</div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map(r => {
            const tone = r.days < 0 ? "text-danger-fg" : r.days === 0 ? "text-warning-fg" : r.days === 1 ? "text-warning-fg" : "text-muted-foreground";
            const label = r.days < 0 ? `Overdue ${Math.abs(r.days)}d` : r.days === 0 ? "Due today" : r.days === 1 ? "Due tomorrow" : `Due in ${r.days}d`;
            const inner = (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{r.student_name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {r.currency} {Number(r.amount).toLocaleString()} · {r.due_date}{r.coach_name ? ` · Coach: ${r.coach_name}` : ""}
                  </div>
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${tone}`}>{label}</span>
              </>
            );
            return r.student_id ? (
              <Link key={r.id} to="/students/$id" params={{ id: r.student_id }} className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition">
                {inner}
              </Link>
            ) : (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- My Day (role-aware landing block) ---------------- */
function MyDayBlock({ roles }: { roles: string[] }) {
  const { user } = useAuth();
  const [state, setState] = useState<{ loading: boolean; parts: { label: string; value: string; tone: string; to?: string }[] }>({ loading: true, parts: [] });

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const eodRisk = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const staleCall = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    (async () => {
      const parts: { label: string; value: string; tone: string; to?: string }[] = [];

      if (roles.includes("admin") && !roles.includes("coach") && !roles.includes("csm") && !roles.includes("setter") && !roles.includes("closer")) {
        // Founders/admins: skip the My Day block entirely
        setState({ loading: false, parts: [] });
        return;
      }

      if (roles.includes("coach")) {
        const [todaysCalls, myActionCalls, myStudents] = await Promise.all([
          supabase.from("student_calls").select("id, call_date").eq("coach_id", user.id).eq("status", "scheduled").eq("call_date", today),
          supabase.from("student_calls").select("action_items_json").eq("coach_id", user.id).not("action_items_json", "is", null).limit(500),
          supabase.from("students").select("id").eq("coach_id", user.id).eq("status", "active"),
        ]);
        let overdue = 0;
        ((myActionCalls.data as any[]) ?? []).forEach(c => {
          (c.action_items_json as any[] ?? []).forEach(it => {
            const due = it?.due ?? it?.due_date;
            if (!it?.done && due && due < today) overdue++;
          });
        });
        parts.push({ label: "1:1s today", value: String(todaysCalls.data?.length ?? 0), tone: "sky", to: "/calls" });
        parts.push({ label: "Overdue action items", value: String(overdue), tone: overdue > 0 ? "rose" : "muted", to: "/action-items" });
        parts.push({ label: "Active students", value: String(myStudents.data?.length ?? 0), tone: "emerald", to: "/students" });
      } else if (roles.includes("csm")) {
        // Students with no touch in 7d
        const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const [notes, students] = await Promise.all([
          supabase.from("csm_student_notes").select("student_id, created_at").gte("created_at", cutoff),
          supabase.from("students").select("id, full_name").eq("status", "active"),
        ]);
        const touched = new Set((notes.data ?? []).map((n: any) => n.student_id));
        const cold = (students.data ?? []).filter((s: any) => !touched.has(s.id)).length;
        parts.push({ label: "Cold >7d", value: String(cold), tone: cold > 0 ? "amber" : "emerald", to: "/csm" });
      } else if (roles.includes("setter") || roles.includes("closer")) {
        const eodRow = await supabase.from("eods").select("dms_sent, convos_started, calls_booked, shows").eq("user_id", user.id).eq("report_date", today).maybeSingle();
        parts.push({ label: "Today EOD", value: eodRow.data ? "Submitted" : "Pending", tone: eodRow.data ? "emerald" : "amber", to: "/eods" });
        const booked = (eodRow.data as any)?.calls_booked ?? 0;
        const goal = Math.round(DEFAULT_GOALS.calls / 90);
        parts.push({ label: "Booked today", value: `${booked}/${goal}`, tone: booked >= goal ? "emerald" : "amber" });
      }

      if (parts.length === 0) parts.push({ label: "Welcome", value: "No role blocks", tone: "muted" });
      setState({ loading: false, parts });
    })();
  }, [user, roles]);

  return (
    <div>
      <div className="text-[13px] text-muted-foreground mb-2 flex items-center gap-2">
        <Sunrise className="h-3.5 w-3.5 text-muted-foreground" /> <span>My day</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {state.parts.map((p, i) => {
          const toneValue: Record<string, string> = {
            rose: "text-danger-fg",
            amber: "text-warning-fg",
            emerald: "text-primary",
            sky: "text-primary",
            muted: "text-foreground",
          };
          const inner = (
            <div className="card-surface p-3">
              <div className="text-[12px] text-muted-foreground">{p.label}</div>
              <div className={`text-[18px] font-semibold mt-1 tabular-nums ${toneValue[p.tone] ?? "text-foreground"}`}>{p.value}</div>
            </div>
          );
          return p.to
            ? <Link key={i} to={p.to as any}>{inner}</Link>
            : <div key={i}>{inner}</div>;
        })}
      </div>
    </div>
  );
}

function SecondaryKpi({ label, value, suffix, onClick, delta }: { label: string; value: number; suffix?: string; onClick?: () => void; delta?: number | null }) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <button onClick={onClick} className="text-left group">
      <span className="text-[13px] tabular-nums font-medium text-foreground group-hover:text-primary motion-safe:transition-colors">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString()}{suffix}
      </span>
      {delta != null && delta !== 0 && (
        <span className={`ml-1 text-[11px] ${up ? "text-success-fg" : "text-danger-fg"}`}>{up ? "+" : ""}{delta}</span>
      )}
      <span className="ml-1.5 text-[12px] text-muted-foreground">{label}</span>
    </button>
  );
}

function OpsChip({ to, search, danger, warn, count, label }: {
  to: string; search?: Record<string, unknown>;
  danger?: boolean; warn?: boolean;
  count: number | undefined; label: string;
}) {
  const cls = danger ? "text-danger-fg" : warn ? "text-warning-fg" : "text-muted-foreground";
  return (
    <Link to={to as any} search={search as any}>
      <span className={`inline-flex items-baseline gap-1 ${cls} motion-safe:transition-colors hover:text-foreground`}>
        <span className="text-[14px] font-semibold tabular-nums">{count ?? 0}</span>
        <span className="text-[12px] opacity-70">{label}</span>
      </span>
    </Link>
  );
}

/* ---------------- Unified leaderboard (Cash / Booked toggle) ---------------- */
function UnifiedLeaderboard({ profiles, eods, canSeeCash }: { profiles: Record<string, Profile>; eods: EodRow[]; canSeeCash: boolean }) {
  const [mode, setMode] = useState<"cash" | "booked">("booked");
  const [cashRows, setCashRows] = useState<{ uid: string; name: string; value: number; sub: string }[]>([]);
  const [cashLoading, setCashLoading] = useState(false);

  const start = startOfWeekMon(new Date());
  const end = endOfWeekSun(new Date());
  const startISO = isoDay(start);
  const endISO = isoDay(end);

  useEffect(() => {
    if (mode !== "cash") return;
    let alive = true;
    setCashLoading(true);
    (async () => {
      try {
        const [dealsRes, eodsRes] = await Promise.all([
          supabase.from("deals").select("closer_id, cash_collected_upfront, deal_date")
            .gte("deal_date", startISO).lte("deal_date", endISO),
          supabase.from("eods").select("user_id, cash_collected, report_date")
            .gte("report_date", startISO).lte("report_date", endISO),
        ]);
        const totals = new Map<string, { cash: number; closes: number }>();
        for (const d of (dealsRes.data ?? []) as Pick<Deal, "closer_id" | "cash_collected_upfront">[]) {
          const c = totals.get(d.closer_id) ?? { cash: 0, closes: 0 };
          c.cash += Number(d.cash_collected_upfront) || 0;
          c.closes += 1;
          totals.set(d.closer_id, c);
        }
        for (const e of (eodsRes.data ?? []) as { user_id: string; cash_collected: number | null }[]) {
          const c = totals.get(e.user_id) ?? { cash: 0, closes: 0 };
          c.cash += Number(e.cash_collected) || 0;
          totals.set(e.user_id, c);
        }
        const out = Array.from(totals.entries())
          .map(([uid, v]) => ({ uid, name: profiles[uid]?.display_name ?? "Unknown", value: v.cash, sub: `${v.closes} close${v.closes === 1 ? "" : "s"}` }))
          .sort((a, b) => b.value - a.value);
        if (alive) setCashRows(out);
      } catch (e) {
        console.error("UnifiedLeaderboard cash load failed", e);
        if (alive) setCashRows([]);
      } finally {
        if (alive) setCashLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [mode, startISO, endISO, profiles]);

  const bookedRows = useMemo(() => {
    const inWeek = eods.filter((r) => r.report_date >= startISO && r.report_date <= endISO);
    const m: Record<string, { booked: number; dms: number; shows: number }> = {};
    for (const r of inWeek) {
      const b = m[r.user_id] ?? (m[r.user_id] = { booked: 0, dms: 0, shows: 0 });
      b.booked += r.calls_booked; b.dms += r.dms_sent; b.shows += r.shows;
    }
    return Object.entries(m)
      .map(([uid, v]) => ({ uid, name: profiles[uid]?.display_name ?? "Unknown", value: v.booked, sub: `${v.dms.toLocaleString()} DMs · ${v.shows} shows` }))
      .sort((a, b) => b.value - a.value);
  }, [eods, profiles, startISO, endISO]);

  const rows = mode === "cash" ? cashRows : bookedRows;
  const isLoading = mode === "cash" && cashLoading;

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Star className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold">Weekly leaderboard</span>
          <span className="text-[10px] text-muted-foreground truncate">
            {startISO} → {endISO} · resets Monday
          </span>
        </div>
        <div className="flex gap-1">
          {(canSeeCash ? (["booked", "cash"] as const) : (["booked"] as const)).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                "text-[13px] font-medium px-3 py-1.5 rounded-md motion-safe:transition-colors " +
                (mode === m
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted")
              }
            >
              {m === "booked" ? "Booked (setters)" : "Cash (closers)"}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          {mode === "cash" ? "No cash collected this week yet." : "Nothing submitted yet this week."}
        </div>
      ) : (
        <div>
          {rows.slice(0, 10).map((r, i) => (
            <div
              key={r.uid}
              className={
                "flex items-center gap-3 px-3 py-2 border-b border-border/50 last:border-0 " +
                (i === 0 ? "bg-warning-bg" : "")
              }
            >
              <span className={"text-[11px] w-5 " + (i === 0 ? "text-warning-fg" : "text-muted-foreground")}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{r.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{r.sub}</div>
              </div>
              <div className="text-sm tabular-nums text-success-fg">
                {mode === "cash" ? money(r.value) : r.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


