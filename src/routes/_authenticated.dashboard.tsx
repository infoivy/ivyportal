import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { BlurMoney } from "@/components/blur-money";
import { fetchSetNudges } from "@/lib/set-nudges";
import { toast } from "sonner";
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
import { money, startOfWeekMon, endOfWeekSun, isoDay } from "@/lib/revenue";
import { fetchCollectedCashByCloser } from "@/lib/collected-cash";
import { RangePicker, type DateRange, rangeFor, daysBetween } from "@/components/range-picker";
import { StatDrilldown, type MetricKey } from "@/components/stat-drilldown";
import { DashboardSettingsSheet } from "@/components/dashboard-settings-sheet";
import { useDashboardPrefs } from "@/lib/dashboard-prefs";
import { humanDue, todayLocal } from "@/lib/dates";
import { VolumeAreaChart, VolumeLegend, type VolumeSeries } from "@/components/ui/volume-area-chart";
import { OnboardingPanel } from "@/components/onboarding-panel";
import { MochiIgSection } from "@/components/mochi-ig-section";
import { TeamGoalCard } from "@/components/team-goal-card";
import { getMochiDashboard, getWhopCashWindow, type MochiPeriod } from "@/lib/mochi.functions";
import { getCloseActivityReport } from "@/lib/close-crm.functions";
import { SetterActivityCard } from "@/components/setter-activity-card";
import { PayoutAlertBanner } from "@/components/payout-alert";
import { DeltaChip } from "@/components/ui/delta-chip";
import {
  buildDashboardTrend,
  buildEodFunnel,
  buildMochiFunnel,
  trendHasData,
  type DashboardTrendRow,
} from "@/lib/dashboard-activity";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · ISA Team" }] }),
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
type ActivitySource = "all" | "eod" | "crm";
type FunnelSource = "eod" | "mochi";

const EOD_VOLUME_SERIES: VolumeSeries[] = [
  { key: "dms", label: "EOD DMs", color: "#9CA3AF" },
  { key: "convos", label: "EOD convos", color: "#6366F1" },
  { key: "booked", label: "EOD booked", color: "#22C55E", strokeWidth: 2 },
  { key: "shows", label: "EOD shows", color: "#F59E0B" },
  { key: "closes", label: "EOD closes", color: "#A855F7" },
];

const CRM_VOLUME_SERIES: VolumeSeries[] = [
  { key: "closeDials", label: "Close dials", color: "#38BDF8" },
  { key: "closeLeads", label: "Close leads", color: "#0EA5E9" },
  { key: "mochiLeads", label: "Mochi leads", color: "#F472B6" },
  { key: "mochiBooked", label: "Mochi booked", color: "#34D399", strokeWidth: 2 },
  { key: "mochiWon", label: "Mochi won", color: "#C084FC" },
];

const COMBINED_VOLUME_SERIES: VolumeSeries[] = [
  CRM_VOLUME_SERIES[0],
  CRM_VOLUME_SERIES[2],
  EOD_VOLUME_SERIES[2],
  EOD_VOLUME_SERIES[3],
  EOD_VOLUME_SERIES[4],
];

function currentQuarterLabel(d = new Date()) {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
] as const;
type RangeKey = typeof RANGES[number]["key"];


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
  const canSeeCrm = roles.includes("admin") || roles.includes("founder") || roles.includes("cofounder");
  // Founder-set 2026-07-22: every time-ranged view opens on 24 hours.
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeFor("24h"));
  const [compare, setCompare] = useState(false);
  const [activitySource, setActivitySource] = useState<ActivitySource>("all");
  const [funnelSource, setFunnelSource] = useState<FunnelSource>("eod");
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

  const days = daysBetween(dateRange);
  const rangeFrom = format(dateRange.from, "yyyy-MM-dd");
  const rangeTo = format(dateRange.to, "yyyy-MM-dd");
  const mochiPeriod: MochiPeriod = days <= 1 ? "today" : days <= 7 ? "last_7_days" : "last_30_days";

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
      const [cur, prev, profs, students, callsThisWeek, callsRecent, eodsRecent, todayEods, installmentsDue, installmentsLate, testimonials, actionCalls, eodExemptRoles] = await Promise.all([
        // eods_activity: whole team can read team activity (no money columns)
        supabase.from("eods_activity").select("id, user_id, report_date, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows, closes").gte("report_date", from).lte("report_date", to).order("report_date", { ascending: true }),
        compare
          ? supabase.from("eods_activity").select("id, user_id, report_date, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows, closes").gte("report_date", prevFrom).lte("report_date", prevTo)
          : Promise.resolve({ data: [] as EodRow[], error: null }),
        supabase.from("profiles").select("id, display_name"),
        supabase.from("students").select("id, status, phase, eod_exempt").eq("status", "active"),
        supabase.from("student_calls").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("call_date", today).lte("call_date", in7),
        supabase.from("student_calls").select("student_id, call_date").eq("status", "completed").gte("call_date", callRisk),
        supabase.from("student_eods").select("student_id, report_date").gte("report_date", eodRisk),
        supabase.from("eods_activity").select("user_id").eq("report_date", today),
        supabase.from("installment_payments").select("id", { count: "exact", head: true }).eq("status", "upcoming").gte("due_date", today).lte("due_date", in3),
        supabase.from("installment_payments").select("id", { count: "exact", head: true }).eq("status", "upcoming").lt("due_date", today),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active").eq("testimonial_collected", false).not("first_win_at", "is", null),
        supabase.from("student_calls").select("action_items_json").not("action_items_json", "is", null).limit(2000),
        supabase.from("user_roles").select("user_id").in("role", ["cofounder", "founder"]),
      ]);
      if (cur.error) throw new Error(`Team EOD activity failed: ${cur.error.message}`);
      if (prev.error) throw new Error(`Previous EOD activity failed: ${prev.error.message}`);
      if (todayEods.error) throw new Error(`Today's EOD activity failed: ${todayEods.error.message}`);
      const eodRows = (cur.data as EodRow[]) ?? [];
      const prevRows = (prev.data as EodRow[]) ?? [];
      const pmap: Record<string, Profile> = {};
      (profs.data as Profile[] | null)?.forEach((p) => { pmap[p.id] = p; });

      const eodByStudent = new Set((eodsRecent.data as { student_id: string }[] | null ?? []).map(r => r.student_id));
      const callByStudent = new Set((callsRecent.data as { student_id: string }[] | null ?? []).map(r => r.student_id));
      const activeStudents = (students.data as { id: string; status: string; phase: string; eod_exempt?: boolean }[] | null) ?? [];
      // At-risk only while in the active journey; missed-1:1 only applies in
      // coaching. EOD-exempt students never trip the missed-EOD condition.
      const atRisk = activeStudents.filter(s =>
        ["onboarding", "coaching_1on1", "applying"].includes(s.phase) &&
        ((!s.eod_exempt && !eodByStudent.has(s.id)) || (s.phase === "coaching_1on1" && !callByStudent.has(s.id)))
      ).length;

      const eodsToday = (todayEods.data as any[])?.length ?? 0;
      const filedToday = new Set(((todayEods.data as { user_id: string }[] | null) ?? []).map(r => r.user_id));
      // Cofounders/founders don't owe EODs even if they filed some historically
      const eodExempt = new Set(((eodExemptRoles.data as { user_id: string }[] | null) ?? []).map(r => r.user_id));
      const recentFilers = new Set(eodRows.map(r => r.user_id).filter(u => !eodExempt.has(u)));
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

  const mochiQ = useQuery({
    queryKey: ["mochi-dashboard", mochiPeriod],
    queryFn: () => getMochiDashboard({ data: { period: mochiPeriod } }),
    enabled: canSeeCrm,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  const closeActivityQ = useQuery({
    queryKey: ["close-activity-report", rangeFrom, rangeTo],
    queryFn: () => getCloseActivityReport({ data: { from: rangeFrom, to: rangeTo } }),
    enabled: canSeeCrm,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  const cashQ = useQuery({
    queryKey: ["page", "dashboard", "cash-mtd"],
    queryFn: async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const monthStart = `${y}-${m}-01`;
      const today = now.toISOString().slice(0, 10);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const prevSameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
      const [dealsRes, instRes, prevRes] = await Promise.all([
        supabase.from("deals").select("cash_collected_upfront").gte("deal_date", monthStart).lte("deal_date", today),
        supabase.from("installment_payments").select("amount, currency, due_date, installments!inner(students(full_name))").eq("status", "upcoming").gte("due_date", today).order("due_date", { ascending: true }).limit(1),
        supabase.from("deals").select("cash_collected_upfront").gte("deal_date", prevStart).lte("deal_date", prevSameDay),
      ]);
      return { deals: dealsRes.data ?? [], firstDue: (instRes.data ?? [])[0] as any, prevDeals: prevRes.data ?? [] };
    },
  });
  const [cashPrevMtd, setCashPrevMtd] = useState<number | null>(null);
  useEffect(() => {
    if (!cashQ.data) return;
    const total = (cashQ.data.deals as any[]).reduce((s, d) => s + (Number(d.cash_collected_upfront) || 0), 0);
    setCashMtd(total);
    setCashPrevMtd((cashQ.data.prevDeals as any[]).reduce((s, d) => s + (Number(d.cash_collected_upfront) || 0), 0));
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

  // Whop is the revenue source of truth — the cash hero reads it directly,
  // NET of fees, and refreshes itself (founder rule 2026-07-14).
  const whopQ = useQuery({
    queryKey: ["dashboard-whop-window"],
    queryFn: () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevSameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return getWhopCashWindow({ data: { from: iso(monthStart), to: iso(now), prevFrom: iso(prevStart), prevTo: iso(prevSameDay) } });
    },
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
    enabled: roles.includes("admin") || roles.includes("founder"),
    retry: 1,
  });
  // A capped/partial Whop read must fall back to logged cash — never show a wrong number
  const whopHero = whopQ.data?.connected && !whopQ.data.incomplete
    ? { mtd: whopQ.data.net, prevMtd: whopQ.data.prevNet, gross: whopQ.data.gross, count: whopQ.data.count }
    : null;

  // Non-admin team members can flip between the team's collective numbers
  // (default) and just their own — revenue widgets stay role-gated regardless.
  const canScope = !roles.includes("admin") && !roles.includes("founder");
  const [scope, setScope] = useState<"team" | "me">("team");
  const scopedEods = useMemo(
    () => (canScope && scope === "me" ? eods.filter((e) => e.user_id === user?.id) : eods),
    [eods, canScope, scope, user?.id],
  );
  const scopedPrev = useMemo(
    () => (canScope && scope === "me" ? prevEods.filter((e) => e.user_id === user?.id) : prevEods),
    [prevEods, canScope, scope, user?.id],
  );

  const totals = useMemo(() => sumRows(scopedEods), [scopedEods]);
  const prevTotals = useMemo(() => sumRows(scopedPrev), [scopedPrev]);
  const trend = useMemo(() => {
    const curr = buildDashboardTrend({
      range: { from: rangeFrom, to: rangeTo },
      eods: scopedEods,
      mochi: canSeeCrm ? (mochiQ.data?.funnel ?? []) : [],
      closeCalls: canSeeCrm
        ? (closeActivityQ.data?.daily ?? []).map((row) => ({ date: row.date, dials: row.dials, answered: 0 }))
        : [],
      closeLeads: canSeeCrm
        ? (closeActivityQ.data?.daily ?? []).map((row) => ({ date: row.date, count: row.leads }))
        : [],
    });
    if (!compare || scopedPrev.length === 0) return curr;
    const prev = buildDashboardTrend({
      range: {
        from: format(subDays(dateRange.from, days), "yyyy-MM-dd"),
        to: format(subDays(dateRange.from, 1), "yyyy-MM-dd"),
      },
      eods: scopedPrev,
      mochi: [],
      closeCalls: [],
      closeLeads: [],
    });
    return curr.map((row, i) => ({
      ...row,
      prev_dms: prev[i]?.dms ?? 0,
      prev_convos: prev[i]?.convos ?? 0,
      prev_booked: prev[i]?.booked ?? 0,
    }));
  }, [scopedEods, scopedPrev, compare, days, dateRange.from, rangeFrom, rangeTo, canSeeCrm, mochiQ.data, closeActivityQ.data]);
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

  const mochiTotals = trend.reduce((sum, row) => ({
    leads: sum.leads + row.mochiLeads,
    qualified: sum.qualified + row.mochiQualified,
    booked: sum.booked + row.mochiBooked,
    won: sum.won + row.mochiWon,
  }), { leads: 0, qualified: 0, booked: 0, won: 0 });
  const eodFunnel = buildEodFunnel({
    dms: totals.dms_sent,
    convos: totals.convos_started,
    booked: totals.calls_booked,
    shows: totals.shows,
    closes: totals.closes,
  });
  const mochiFunnel = buildMochiFunnel(mochiTotals);
  const selectedFunnelSource: FunnelSource = canSeeCrm ? funnelSource : "eod";
  const selectedActivitySource: ActivitySource = canSeeCrm ? activitySource : "eod";
  const formatBreakdown = selectedFunnelSource === "mochi" ? mochiFunnel : eodFunnel;
  const volumeSeries = selectedActivitySource === "eod"
    ? EOD_VOLUME_SERIES
    : selectedActivitySource === "crm"
      ? CRM_VOLUME_SERIES
      : COMBINED_VOLUME_SERIES;
  const volumeHasData = trendHasData(
    trend,
    volumeSeries.map((series) => series.key as keyof DashboardTrendRow),
  );
  const funnelHasData = formatBreakdown.some((row) => row.value > 0);
  const previousEodSeries: VolumeSeries[] = [
    { key: "prev_dms", label: "DMs (previous)", color: "#9CA3AF", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
    { key: "prev_convos", label: "Convos (previous)", color: "#6366F1", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
    { key: "prev_booked", label: "Booked (previous)", color: "#22C55E", strokeWidth: 1, strokeOpacity: 0.35, ghost: true },
  ];
  const chartVolumeSeries = selectedActivitySource === "eod" && hasPrev
    ? [...previousEodSeries, ...volumeSeries]
    : volumeSeries;
  const crmLoading = canSeeCrm && (mochiQ.isLoading || closeActivityQ.isLoading);
  const crmError = canSeeCrm && (mochiQ.isError || closeActivityQ.isError);
  const volumeLoading = loading || (selectedActivitySource !== "eod" && crmLoading);
  const funnelLoading = loading || (selectedFunnelSource === "mochi" && mochiQ.isLoading);

  const rangeLabel =
    dateRange.preset === "24h" ? "Last 24 hours"
    : dateRange.preset === "7d" ? "Last 7 days"
    : dateRange.preset === "30d" ? "Last 30 days"
    : dateRange.preset === "90d" ? `Last 90 days · ${currentQuarterLabel()}`
    : `${format(dateRange.from, "MMM d")} → ${format(dateRange.to, "MMM d, yyyy")}`;

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
            {canScope && (
              <div className="flex rounded-md bg-muted p-0.5">
                {(["team", "me"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`text-[12px] font-medium px-2.5 py-1 rounded-[5px] motion-safe:transition-colors ${
                      scope === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "team" ? "Team" : "Me"}
                  </button>
                ))}
              </div>
            )}
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

        {mainQ.isError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-danger/25 bg-danger-bg px-4 py-3 text-[13px] text-danger-fg">
            <span>Team EOD analytics could not load. Existing reports have not been replaced with zeros.</span>
            <button onClick={() => mainQ.refetch()} className="shrink-0 font-medium underline underline-offset-4">Retry</button>
          </div>
        )}

        {/* Start Here — one checklist per business role held */}
        <OnboardingPanel compact />

        {/* Action items assigned to me — always at the very top */}
        <MyAssignedItems />

        {/* Set reminders due — same urgency treatment */}
        {/* Unconfirmed payouts past their date outrank everything on this page */}
        <PayoutAlertBanner />

        <MySetNudges />

        {/* The collective goal — whole team sees the same bar */}
        <TeamGoalCard />

        {/* IG monthly log reminder */}
        {roles.includes("founder") && !igLoggedThisMonth && !igReminderDismissed && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-muted text-[13px] text-foreground">
            <span>No IG analytics logged this month · keep your growth data up to date.</span>
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
              <div className="text-[12px] text-muted-foreground mb-3">
                Cash collected this month{whopHero ? " · Whop net" : ""}
              </div>
              {(() => {
                // Whop net is the truth; logged deals only as a fallback when
                // Whop isn't connected. Never mix sources in one comparison.
                const heroVal = whopHero ? whopHero.mtd : cashMtd;
                const prevVal = whopHero ? whopHero.prevMtd : (cashPrevMtd ?? 0);
                const prevMonthName = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleString("en", { month: "long" });
                return (
                  <>
                    <div className="text-[36px] font-medium tabular-nums text-foreground tracking-[-0.025em] leading-none">
                      <BlurMoney>{heroVal > 0 ? money(heroVal) : "–"}</BlurMoney>
                    </div>
                    {prevVal > 0 && heroVal > 0 && (() => {
                      const pct = ((heroVal - prevVal) / prevVal) * 100;
                      const up = pct >= 0;
                      return (
                        <div className="mt-3 text-[12px] text-muted-foreground tabular-nums">
                          <span className={up ? "text-success-fg" : "text-danger-fg"}>
                            {up ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}%
                          </span>
                          {" "}vs {prevMonthName} same day · <BlurMoney>{money(prevVal)}</BlurMoney>
                        </div>
                      );
                    })()}
                    {whopHero && (
                      <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                        {whopHero.count} payments · <BlurMoney>{money(whopHero.gross)}</BlurMoney> gross
                      </div>
                    )}
                  </>
                );
              })()}
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

        {/* Instagram funnel — live from Mochi CRM */}
        {canSeeCrm && <MochiIgSection />}

        {/* Per-rep dials, call durations & DMs — Close + Mochi */}
        {canSeeCrm && <SetterActivityCard />}

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
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-foreground">Volume trend</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Source-separated activity · {rangeLabel}{days > 30 && selectedActivitySource !== "eod" ? " · Mochi covers the latest 30 days" : ""}
                    </div>
                  </div>
                  {canSeeCrm && (
                    <SourceTabs
                      value={selectedActivitySource}
                      options={[{ value: "all", label: "All" }, { value: "eod", label: "EOD" }, { value: "crm", label: "CRM" }]}
                      onChange={setActivitySource}
                    />
                  )}
                </div>
                {volumeLoading ? <div className="h-[240px]"><Skeleton /></div> : !volumeHasData ? (
                  <AnalyticsEmpty
                    message={crmError && selectedActivitySource !== "eod"
                      ? "CRM activity could not load. EOD data remains available under the EOD source."
                      : `No ${selectedActivitySource === "all" ? "EOD or CRM" : selectedActivitySource.toUpperCase()} activity in this range.`}
                    showSevenDayAction={dateRange.preset === "24h"}
                    onViewSevenDays={() => setDateRange(rangeFor("7d"))}
                  />
                ) : (
                  <>
                    <VolumeAreaChart
                      data={trend}
                      series={chartVolumeSeries}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <VolumeLegend series={volumeSeries} />
                      {selectedActivitySource === "eod" && hasPrev && <span className="text-micro text-muted-foreground">faded = previous {days}d</span>}
                    </div>
                  </>
                )}
              </Panel>
            )}


            {prefs.showFunnel && (
              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <PanelHead
                    title="Funnel Performance"
                    subtitle={selectedFunnelSource === "mochi" ? "Mochi CRM stages · no EOD mixing" : "Self-reported EOD stages"}
                  />
                  {canSeeCrm && (
                    <SourceTabs
                      value={selectedFunnelSource}
                      options={[{ value: "eod", label: "EOD" }, { value: "mochi", label: "Mochi" }]}
                      onChange={setFunnelSource}
                    />
                  )}
                </div>
                <div className="h-[220px] mt-1">
                  {funnelLoading ? <Skeleton /> : !funnelHasData ? (
                    <AnalyticsEmpty
                      compact
                      message={selectedFunnelSource === "mochi" && mochiQ.isError
                        ? "Mochi funnel could not load. EOD funnel data remains available."
                        : `No ${selectedFunnelSource === "mochi" ? "Mochi CRM" : "EOD"} funnel activity in this range.`}
                      showSevenDayAction={dateRange.preset === "24h"}
                      onViewSevenDays={() => setDateRange(rangeFor("7d"))}
                    />
                  ) : (
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
                        <Bar dataKey="value" radius={[0, 2, 2, 0]} isAnimationActive={false}>
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




        {/* Quick actions */}
        {prefs.showQuickActions && (
          <div className="grid gap-2 sm:grid-cols-4">
            <QuickAction to="/eods"     icon={FileText}   label="Submit EOD" />
            <QuickAction to="/sales" search={{ tab: "trends" }} icon={Target} label="Sales Trends" />
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

/* subcomponents */
function SourceTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-md bg-muted p-0.5" aria-label="Data source">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-[5px] px-2 py-1 text-[11px] font-medium motion-safe:transition-colors ${
            value === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AnalyticsEmpty({
  message,
  showSevenDayAction,
  onViewSevenDays,
  compact = false,
}: {
  message: string;
  showSevenDayAction: boolean;
  onViewSevenDays: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid place-items-center px-6 text-center ${compact ? "h-full" : "h-[240px]"}`}>
      <div>
        <p className="text-[13px] text-muted-foreground">{message}</p>
        {showSevenDayAction && (
          <button type="button" onClick={onViewSevenDays} className="mt-2 text-[12px] font-medium text-primary hover:underline">
            View the last 7 days
          </button>
        )}
      </div>
    </div>
  );
}

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
      className={`card-surface px-5 py-4 ${clickable ? "cursor-pointer motion-safe:hover:brightness-110 motion-safe:transition-[filter]" : ""}`}
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
        {value == null ? <span className="text-muted-foreground text-sm">–</span> : value.toLocaleString()}
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
  }, [user, isAdmin, isCoach, canSee]);

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
    // Local day, not UTC — an exact .eq("call_date", …) match with the UTC
    // date shows yesterday's calls between midnight and 3am in Riyadh.
    const today = todayLocal();
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
        const goal = 3; // daily sets KPI (business rule)
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
        // COLLECTED cash only (cofounder-directed 2026-07-27): deal upfronts
        // + installments PAID in the window. No scheduled money, no EOD
        // self-reports — those double-count the same dollars.
        const totals = await fetchCollectedCashByCloser(startISO, endISO);
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



/** Open action items assigned to the signed-in team member — amber banner at
 *  the top of the dashboard, with who it came from and inline tick-off. */
function MyAssignedItems() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["dashboard", "my-items", user?.id],
    enabled: !!user,
    refetchInterval: 2 * 60_000, // new assignments show up without a reload
    queryFn: async () => {
      const { data: items } = await supabase
        .from("student_action_items")
        .select("id, text, due_date, created_at, created_by")
        .eq("assignee_id", user!.id)
        .eq("done", false)
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = (items ?? []) as { id: string; text: string; due_date: string | null; created_at: string; created_by: string }[];
      const senderIds = Array.from(new Set(rows.map(r => r.created_by)));
      const names: Record<string, string> = {};
      if (senderIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", senderIds);
        (profs ?? []).forEach((p: { id: string; display_name: string | null }) => { names[p.id] = p.display_name ?? "Teammate"; });
      }
      return rows.map(r => ({ ...r, from: names[r.created_by] ?? "Teammate" }));
    },
  });

  const items = q.data ?? [];
  if (!items.length) return null;
  const today = new Date().toISOString().slice(0, 10);

  const tick = async (id: string) => {
    const { error } = await supabase
      .from("student_action_items")
      .update({ done: true, done_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Done ✓");
    q.refetch();
  };

  return (
    <div className="rounded-xl border border-warning/25 bg-warning-bg/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[12px] font-medium text-warning-fg">For you · {items.length} open</span>
        <Link to="/action-items" search={{ } as never} className="text-[12px] text-muted-foreground hover:text-foreground shrink-0">All action items →</Link>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 4).map(it => {
          const overdue = !!it.due_date && it.due_date < today;
          return (
            <div key={it.id} className="flex items-start gap-2.5">
              <Checkbox className="mt-0.5" checked={false} onCheckedChange={() => tick(it.id)} aria-label="Mark done" />
              <div className="min-w-0 flex-1 text-[13px] leading-snug">
                <span className="text-foreground">{it.text}</span>
                <span className="text-muted-foreground"> · from {it.from}</span>
                {it.due_date && (
                  <span className={overdue ? "text-danger-fg" : "text-muted-foreground"} title={it.due_date}> · {humanDue(it.due_date)}</span>
                )}
              </div>
            </div>
          );
        })}
        {items.length > 4 && (
          <Link to="/action-items" className="block text-[12px] text-muted-foreground hover:text-foreground pl-6">
            +{items.length - 4} more
          </Link>
        )}
      </div>
    </div>
  );
}

/** Claimed sets needing action now (open reminder window or today's warm
 *  touch) — mirrors the action-items banner because a cold set costs a slot. */
function MySetNudges() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["dashboard", "set-nudges", user?.id],
    enabled: !!user,
    refetchInterval: 2 * 60_000,
    queryFn: () => fetchSetNudges(user!.id),
  });
  const nudges = q.data ?? [];
  if (!nudges.length) return null;
  return (
    <div className="rounded-xl border border-warning/25 bg-warning-bg/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[12px] font-medium text-warning-fg">Your sets need you · {nudges.length}</span>
        <Link to="/calendar" search={{} as never} className="text-[12px] text-muted-foreground hover:text-foreground shrink-0">Open the tracker →</Link>
      </div>
      <div className="space-y-1">
        {nudges.slice(0, 4).map(n => (
          <Link key={n.id} to="/calendar" search={{} as never} className="block text-[13px] leading-snug hover:opacity-80">
            <span className="text-foreground font-medium">{n.prospect}</span>
            <span className="text-muted-foreground">
              {" "}· {n.window.startsWith("keep warm")
                ? n.window
                : `${n.window} reminder due · call ${new Date(n.event_start).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </Link>
        ))}
        {nudges.length > 4 && (
          <span className="block text-[12px] text-muted-foreground">+{nudges.length - 4} more</span>
        )}
      </div>
    </div>
  );
}
