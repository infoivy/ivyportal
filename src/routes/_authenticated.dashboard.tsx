import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  BarChart, Bar, Cell,
} from "recharts";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import { CashLeaderboard } from "@/components/weekly-leaderboard";
import { RangePicker, type DateRange, rangeFor, daysBetween } from "@/components/range-picker";
import { StatDrilldown, type MetricKey } from "@/components/stat-drilldown";
import { DashboardSettingsSheet } from "@/components/dashboard-settings-sheet";
import { useDashboardPrefs } from "@/lib/dashboard-prefs";

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
  no_shows: number;
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

const GOALS = { dms: 20000, convos: 3000, calls: 500, shows: 350, showRate: 75, viral: 3 };

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

  const days = daysBetween(dateRange);

  useEffect(() => {
    setLoading(true);
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

    (async () => {
      const [cur, prev, profs, students, callsThisWeek, callsRecent, eodsRecent, todayEods, installmentsDue, installmentsLate, testimonials, actionCalls] = await Promise.all([
        supabase.from("eods").select("*").gte("report_date", from).lte("report_date", to).order("report_date", { ascending: true }),
        compare
          ? supabase.from("eods").select("*").gte("report_date", prevFrom).lte("report_date", prevTo)
          : Promise.resolve({ data: [] as EodRow[] }),
        supabase.from("profiles").select("id, display_name"),
        supabase.from("students").select("id, status").eq("status", "active"),
        supabase.from("student_calls").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("call_date", today).lte("call_date", in7),
        supabase.from("student_calls").select("student_id, call_date").eq("status", "completed").gte("call_date", callRisk),
        supabase.from("student_eods").select("student_id, report_date").gte("report_date", eodRisk),
        supabase.from("eods").select("user_id").eq("report_date", today),
        supabase.from("installment_payments").select("id", { count: "exact", head: true }).eq("status", "upcoming").gte("due_date", today).lte("due_date", in3),
        supabase.from("installment_payments").select("id", { count: "exact", head: true }).eq("status", "upcoming").lt("due_date", today),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active").eq("testimonial_collected", false).not("first_win_at", "is", null),
        supabase.from("student_calls").select("action_items_json").not("action_items_json", "is", null).limit(2000),
      ]);
      setEods((cur.data as EodRow[]) ?? []);
      setPrevEods((prev.data as EodRow[]) ?? []);
      const pmap: Record<string, Profile> = {};
      (profs.data as Profile[] | null)?.forEach((p) => { pmap[p.id] = p; });
      setProfiles(pmap);

      const eodByStudent = new Set((eodsRecent.data as { student_id: string }[] | null ?? []).map(r => r.student_id));
      const callByStudent = new Set((callsRecent.data as { student_id: string }[] | null ?? []).map(r => r.student_id));
      const activeStudents = (students.data as { id: string; status: string }[] | null) ?? [];
      const atRisk = activeStudents.filter(s => !eodByStudent.has(s.id) || !callByStudent.has(s.id)).length;

      const filedToday = new Set(((todayEods.data as { user_id: string }[] | null) ?? []).map(r => r.user_id));
      const recentFilers = new Set(((cur.data as EodRow[]) ?? []).map(r => r.user_id));
      const eodsMissingToday = Array.from(recentFilers).filter(u => !filedToday.has(u)).length;

      let openActionItems = 0;
      ((actionCalls.data as any[]) ?? []).forEach(r => {
        const items = Array.isArray(r.action_items_json) ? r.action_items_json : [];
        openActionItems += items.filter((it: any) => !it?.done).length;
      });

      setOps({
        atRisk,
        installmentsDueSoon: installmentsDue.count ?? 0,
        installmentsOverdue: installmentsLate.count ?? 0,
        callsThisWeek: callsThisWeek.count ?? 0,
        eodsMissingToday,
        testimonialsPending: testimonials.count ?? 0,
        openActionItems,
      });
      setLoading(false);
    })();
  }, [dateRange.from.getTime(), dateRange.to.getTime(), compare]);

  const totals = useMemo(() => sumRows(eods), [eods]);
  const prevTotals = useMemo(() => sumRows(prevEods), [prevEods]);
  const trend = useMemo(() => buildTrend(eods, days), [eods, days]);
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

  const formatBreakdown = [
    { label: "DMs → Convos", value: totals.convos_started, color: "#3b82f6" },
    { label: "Convos → Booked", value: totals.calls_booked, color: "#f59e0b" },
    { label: "Booked → Shows", value: totals.shows, color: "#ef4444" },
  ];

  const rangeLabel =
    dateRange.preset === "7d" ? "Last 7 days"
    : dateRange.preset === "30d" ? "Last 30 days"
    : dateRange.preset === "90d" ? `Last 90 days · ${currentQuarterLabel()}`
    : `${format(dateRange.from, "MMM d")} → ${format(dateRange.to, "MMM d, yyyy")}`;
  const goalsLabel = `${currentQuarterLabel()} Goals`;

  return (
    <div className="dashboard-dark min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-500/10 border border-emerald-500/40 font-bold text-emerald-400">
              {(displayName ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold">{displayName ?? "Team member"}</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                  {rangeLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {roles.length ? roles.join(" · ") : "member"} · ISA Team overview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RangePicker value={dateRange} onChange={setDateRange} />
            <button
              onClick={() => setCompare((c) => !c)}
              className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm border transition ${
                compare
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Toggle previous-period comparison"
            >
              <ArrowRightLeft className="h-3 w-3" /> Compare
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground"
              title="Dashboard settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
          <Kpi icon={Users}         label="Active Setters" value={activeSetters} highlight />
          <Kpi icon={UserPlus}      label="EODs Filed"     value={totalEods} />
          <Kpi icon={Eye}            label="DMs Sent"       value={totals.dms_sent} color="#3b82f6" />
          <Kpi icon={Zap}            label="Convos"         value={totals.convos_started} color="#a855f7" />
          <Kpi icon={Users}          label="Booked"         value={totals.calls_booked} color="#22c55e" />
          <Kpi icon={Heart}          label="Shows"          value={totals.shows} color="#f59e0b" />
          <Kpi icon={MessagesSquare} label="No-Shows"       value={totals.no_shows} color="#ef4444" />
          <Kpi icon={Link2}          label="Show Rate"      value={showRate} suffix="%" color="#06b6d4" />
          <Kpi icon={FileText}       label="Scheduled"      value={totals.calls_scheduled} color="#ec4899" />
        </div>

        {/* Ops Row */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <span>Ops today</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <OpsCard to="/students" search={{ view: "atRisk" }} tone={ops && ops.atRisk > 0 ? "rose" : "muted"} icon={AlertTriangle} label="At-risk students" value={ops?.atRisk} />
            <OpsCard to="/installments" tone={ops && ops.installmentsOverdue > 0 ? "rose" : "muted"} icon={DollarSign} label="Installments overdue" value={ops?.installmentsOverdue} />
            <OpsCard to="/installments" tone={ops && ops.installmentsDueSoon > 0 ? "amber" : "muted"} icon={DollarSign} label="Due in ≤3 days" value={ops?.installmentsDueSoon} />
            <OpsCard to="/calls" tone="sky" icon={Phone} label="1:1s this week" value={ops?.callsThisWeek} />
            <OpsCard to="/eods" tone={ops && ops.eodsMissingToday > 0 ? "amber" : "muted"} icon={FileText} label="EODs missing today" value={ops?.eodsMissingToday} />
            <OpsCard to="/students" tone={ops && ops.testimonialsPending > 0 ? "amber" : "muted"} icon={Star} label="Testimonials pending" value={ops?.testimonialsPending} />
            <OpsCard to="/action-items" tone={ops && ops.openActionItems > 0 ? "amber" : "muted"} icon={ListChecks} label="Open action items" value={ops?.openActionItems} />
          </div>
        </div>

        <MyDayBlock roles={roles} />


        <InstallmentReminders />

        {/* Row 2: Growth + Format + Transformation */}
        <div className={`grid gap-3 ${hasPrev ? "lg:grid-cols-[1.2fr_1fr_1fr]" : "lg:grid-cols-[1.5fr_1fr]"}`}>
          {/* Growth Trend */}
          <Panel>
            <PanelHead title="Growth Trend" subtitle={rangeLabel} legend={[
              { color: "#22c55e", label: "Booked" },
              { color: "#3b82f6", label: "DMs" },
              { color: "#f59e0b", label: "Convos" },
            ]} />
            <div className="h-[220px] mt-1">
              {loading ? <Skeleton /> : (
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#0f1116", border: "1px solid #1f2530", borderRadius: 4, fontSize: 11 }} />
                    <Line type="monotone" dataKey="dms"    stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="convos" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="booked" stroke="#22c55e" strokeWidth={2}   dot={{ r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* Performance by Format */}
          <Panel>
            <PanelHead title="Funnel Performance" subtitle="Volume by stage" />
            <div className="h-[220px] mt-1">
              {loading ? <Skeleton /> : (
                <ResponsiveContainer>
                  <BarChart data={formatBreakdown} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={100} />
                    <Tooltip contentStyle={{ background: "#0f1116", border: "1px solid #1f2530", borderRadius: 4, fontSize: 11 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                      {formatBreakdown.map((f, i) => <Cell key={i} fill={f.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* Transformation Results (period-over-period) — only when we have a prior period */}
          {hasPrev && (
            <Panel accent="emerald">
              <div className="flex items-center gap-2 mb-3">
                <div className="grid h-6 w-6 place-items-center rounded-sm bg-emerald-500/15 border border-emerald-500/40">
                  <Zap className="h-3 w-3 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold">Period Deltas</h3>
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

        {(roles.includes("admin") || roles.includes("closer") || roles.includes("coach")) && (
          <CashLeaderboard compact />
        )}

        {/* Row 3: Top Setters + Goals + Audience */}
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
          <Panel>
            <PanelHead
              title="Top Performing Setters"
              subtitle={rangeLabel}
              legend={[{ color: "#22c55e", label: "Sorted by Booked" }]}
            />
            {topSetters.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">No EODs submitted in this range.</div>
            ) : (
              <div className="mt-2">
                <div className="grid grid-cols-[24px_minmax(0,1fr)_90px_60px_60px_60px] gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <span>#</span>
                  <span>Setter</span>
                  <span className="text-right">DMs</span>
                  <span className="text-right">Convos</span>
                  <span className="text-right inline-flex items-center justify-end gap-0.5 text-emerald-400">Booked <ChevronDown className="h-3 w-3" /></span>
                  <span className="text-right">Shows</span>
                </div>
                {topSetters.map((s, i) => {
                  const name = profiles[s.user_id]?.display_name ?? "Unknown";
                  return (
                    <div key={s.user_id} className="grid grid-cols-[24px_minmax(0,1fr)_90px_60px_60px_60px] gap-2 px-2 py-2 text-xs tabular-nums border-b border-border/50 hover:bg-white/[0.02]">
                      <span className="text-muted-foreground">{i + 1}</span>
                      <span className="truncate font-medium">{name}</span>
                      <span className="text-right text-blue-400">{s.dms.toLocaleString()}</span>
                      <span className="text-right text-purple-400">{s.convos.toLocaleString()}</span>
                      <span className="text-right text-emerald-400 font-semibold">{s.calls.toLocaleString()}</span>
                      <span className="text-right text-amber-400">{s.shows.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="grid gap-3">
            <Panel>
              <div className="flex items-center gap-2 mb-3">
                <div className="grid h-6 w-6 place-items-center rounded-sm bg-blue-500/15 border border-blue-500/40">
                  <Target className="h-3 w-3 text-blue-400" />
                </div>
                <h3 className="text-sm font-bold">{goalsLabel}</h3>
              </div>
              <div className="space-y-3">
                <Goal label="DMs Sent"     value={totals.dms_sent}       target={GOALS.dms}     color="#3b82f6" />
                <Goal label="Convos"       value={totals.convos_started} target={GOALS.convos}  color="#a855f7" />
                <Goal label="Calls Booked" value={totals.calls_booked}   target={GOALS.calls}   color="#22c55e" />
                <Goal label="Shows"        value={totals.shows}          target={GOALS.shows}   color="#f59e0b" warn={totals.shows < GOALS.shows * 0.5 && days >= 30} />
                <Goal label="Show Rate"    value={showRate}              target={GOALS.showRate} suffix="%" color="#06b6d4" />
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2 mb-3">
                <div className="grid h-6 w-6 place-items-center rounded-sm bg-purple-500/15 border border-purple-500/40">
                  <Globe className="h-3 w-3 text-purple-400" />
                </div>
                <h3 className="text-sm font-bold">Team Composition</h3>
              </div>
              <div className="space-y-2">
                <AudienceRow label="Active this period" value={activeSetters} total={Math.max(activeSetters, 1)} color="#3b82f6" />
                <AudienceRow label="EODs / setter"      value={activeSetters > 0 ? Math.round(totalEods / activeSetters) : 0} total={days} color="#22c55e" suffix={` / ${days}`} />
                <AudienceRow label="Avg calls / setter" value={activeSetters > 0 ? Math.round(totals.calls_booked / activeSetters) : 0} total={GOALS.calls / Math.max(activeSetters, 1)} color="#f59e0b" />
              </div>
            </Panel>
          </div>
        </div>

        <WeeklyLeaderboard profiles={profiles} eods={eods} />


        {/* Quick actions */}
        <div className="grid gap-2 sm:grid-cols-4">
          <QuickAction to="/eods"     icon={FileText}   label="Submit EOD" />
          <QuickAction to="/analytics" icon={Target}    label="Full Analytics" />
          <QuickAction to="/training" icon={Zap}        label="Training" />
          <QuickAction to="/policies/crm-hygiene" icon={MessageSquare} label="CRM Hygiene" />
        </div>
      </div>
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
  }), { dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0, shows: 0, no_shows: 0 });
}
function prevShowRateOf(t: ReturnType<typeof sumRows>) {
  return t.shows + t.no_shows > 0 ? Math.round((t.shows / (t.shows + t.no_shows)) * 100) : 0;
}
function buildTrend(rows: EodRow[], days: number) {
  const map: Record<string, { dms: number; convos: number; booked: number }> = {};
  const out: { key: string; label: string; dms: number; convos: number; booked: number }[] = [];
  const today = new Date();
  const step = days <= 7 ? 1 : days <= 30 ? 1 : 3;
  for (let i = days - 1; i >= 0; i -= step) {
    const d = subDays(today, i);
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
    <div className={`rounded-md border p-3.5 bg-card ${accent === "emerald" ? "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.06)_inset]" : "border-border"}`}>
      {children}
    </div>
  );
}
function PanelHead({ title, subtitle, legend }: { title: string; subtitle?: string; legend?: { color: string; label: string }[] }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-1">
      <div className="min-w-0">
        <h3 className="text-sm font-bold truncate">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{subtitle}</p>}
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
function Kpi({ icon: Icon, label, value, suffix, color, highlight }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: number; suffix?: string; color?: string; highlight?: boolean;
}) {
  const c = color ?? "#94a3b8";
  return (
    <div className={`rounded-md border p-2.5 bg-card ${highlight ? "border-blue-500/60 shadow-[0_0_0_1px_rgba(59,130,246,0.15)_inset]" : "border-border"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color: c }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums mt-1" style={{ color: c }}>
        {value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : value.toLocaleString()}{suffix}
      </div>
    </div>
  );
}

const OPS_TONE: Record<string, { border: string; bg: string; text: string; iconBg: string }> = {
  rose:   { border: "border-rose-500/40",    bg: "bg-rose-500/5",    text: "text-rose-400",    iconBg: "bg-rose-500/15" },
  amber:  { border: "border-amber-500/40",   bg: "bg-amber-500/5",   text: "text-amber-400",   iconBg: "bg-amber-500/15" },
  sky:    { border: "border-sky-500/40",     bg: "bg-sky-500/5",     text: "text-sky-400",     iconBg: "bg-sky-500/15" },
  muted:  { border: "border-border",         bg: "bg-card",          text: "text-foreground",  iconBg: "bg-white/5" },
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
      className={`rounded-md border ${t.border} ${t.bg} p-2.5 hover:brightness-110 transition block`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className={`grid h-4 w-4 place-items-center rounded-sm ${t.iconBg}`}>
          <Icon className={`h-2.5 w-2.5 ${t.text}`} />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${t.text}`}>
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
        <span className="font-bold text-emerald-400">{curr.toLocaleString()}{suffix}</span>
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
          {warn ? <AlertTriangle className="h-3 w-3 text-red-400" /> : pct >= 100 ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : null}
        </span>
        <span className="tabular-nums text-[11px] text-muted-foreground">
          <span className="font-bold text-foreground">{value.toLocaleString()}{suffix}</span> / {target.toLocaleString()}{suffix}
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
        <span className="tabular-nums text-[11px] font-semibold" style={{ color }}>{value.toLocaleString()}{suffix ?? ""}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
function QuickAction({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} className="rounded-md border border-border bg-card p-3 hover:border-white/20 transition flex items-center gap-2">
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
            const tone = r.days < 0 ? "text-rose-400" : r.days === 0 ? "text-amber-400" : r.days === 1 ? "text-amber-300" : "text-muted-foreground";
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

      if (roles.includes("admin")) {
        // Admins: brief snapshot — Ops row is right below.
        setState({ loading: false, parts: [{ label: "Admin view", value: "Ops row below", tone: "sky" }] });
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
        const goal = Math.round(GOALS.calls / 90);
        parts.push({ label: "Booked today", value: `${booked}/${goal}`, tone: booked >= goal ? "emerald" : "amber" });
      }

      if (parts.length === 0) parts.push({ label: "Welcome", value: "No role blocks", tone: "muted" });
      setState({ loading: false, parts });
    })();
  }, [user, roles]);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        <Sunrise className="h-3 w-3 text-amber-400" /> <span>My day</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {state.parts.map((p, i) => {
          const tones: Record<string, string> = {
            rose: "border-rose-500/40 bg-rose-500/5 text-rose-400",
            amber: "border-amber-500/40 bg-amber-500/5 text-amber-400",
            emerald: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
            sky: "border-sky-500/40 bg-sky-500/5 text-sky-400",
            muted: "border-border bg-card text-foreground",
          };
          const inner = (
            <div className={`rounded-md border p-3 ${tones[p.tone] ?? tones.muted}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.label}</div>
              <div className="text-lg font-bold mt-1">{p.value}</div>
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

/* ---------------- Weekly leaderboard ---------------- */
function WeeklyLeaderboard({ profiles, eods }: { profiles: Record<string, Profile>; eods: EodRow[] }) {
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - ((day + 6) % 7)); // Mon
  const lastMonday = new Date(monday); lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(monday); lastSunday.setDate(lastSunday.getDate() - 1);

  const inRange = (d: string, a: Date, b: Date) => {
    const t = new Date(d).getTime();
    return t >= a.getTime() && t <= b.getTime();
  };

  const acc = (rows: EodRow[]) => {
    const m: Record<string, { dms: number; booked: number; shows: number; calls: number }> = {};
    for (const r of rows) {
      const b = m[r.user_id] ?? (m[r.user_id] = { dms: 0, booked: 0, shows: 0, calls: 0 });
      b.dms += r.dms_sent; b.booked += r.calls_booked; b.shows += r.shows;
    }
    return m;
  };

  const thisWeek = acc(eods.filter(r => inRange(r.report_date, monday, today)));
  const lastWeek = acc(eods.filter(r => inRange(r.report_date, lastMonday, lastSunday)));

  const users = Array.from(new Set([...Object.keys(thisWeek), ...Object.keys(lastWeek)]));
  const rows = users.map(uid => {
    const t = thisWeek[uid] ?? { dms: 0, booked: 0, shows: 0, calls: 0 };
    const l = lastWeek[uid] ?? { dms: 0, booked: 0, shows: 0, calls: 0 };
    return { uid, name: profiles[uid]?.display_name ?? "Unknown", t, l };
  }).sort((a, b) => b.t.booked - a.t.booked).slice(0, 10);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Weekly leaderboard</span>
          <span className="text-[10px] text-muted-foreground">this week vs last · resets Monday</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">Nothing submitted yet this week.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(70px,1fr))] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
            <span>Member</span>
            <span className="text-right">DMs</span>
            <span className="text-right">Booked</span>
            <span className="text-right">Shows</span>
          </div>
          {rows.map(r => (
            <div key={r.uid} className="grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(70px,1fr))] gap-2 px-3 py-2 border-b border-border/50 last:border-0 text-xs">
              <span className="truncate font-medium">{r.name}</span>
              <MoveCell curr={r.t.dms} prev={r.l.dms} />
              <MoveCell curr={r.t.booked} prev={r.l.booked} highlight />
              <MoveCell curr={r.t.shows} prev={r.l.shows} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MoveCell({ curr, prev, highlight }: { curr: number; prev: number; highlight?: boolean }) {
  const diff = curr - prev;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const color = diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-muted-foreground";
  return (
    <span className="text-right tabular-nums inline-flex items-center justify-end gap-1">
      <span className={highlight ? "font-semibold text-emerald-400" : ""}>{curr}</span>
      <span className={`inline-flex items-center gap-0.5 text-[10px] ${color}`}>
        <Icon className="h-2.5 w-2.5" />
        {diff > 0 ? `+${diff}` : diff}
      </span>
    </span>
  );
}

