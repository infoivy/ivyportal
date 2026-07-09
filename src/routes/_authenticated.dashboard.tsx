import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import {
  MessageSquare, MessagesSquare, CalendarCheck, Eye, EyeOff, Trophy,
  Target, TrendingUp, ArrowUpRight, ArrowDownRight, Flame, Users2,
  FileText, StickyNote, Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { format, subDays } from "date-fns";

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
  wins: string | null;
};

type Profile = { id: string; display_name: string | null };

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
] as const;
type RangeKey = typeof RANGES[number]["key"];

const GOALS = { dms: 8000, convos: 1200, calls: 200, shows: 140, showRate: 70 };

// Vibrant creator-dashboard palette per KPI
const KPI_COLORS = {
  dms:     { bg: "#3b82f6", soft: "rgba(59,130,246,0.14)" },   // blue
  convos:  { bg: "#a855f7", soft: "rgba(168,85,247,0.14)" },   // purple
  booked:  { bg: "#22c55e", soft: "rgba(34,197,94,0.14)" },    // green
  shows:   { bg: "#f59e0b", soft: "rgba(245,158,11,0.16)" },   // amber
  noshow:  { bg: "#ef4444", soft: "rgba(239,68,68,0.14)" },    // red
  rate:    { bg: "#06b6d4", soft: "rgba(6,182,212,0.14)" },    // cyan
  setters: { bg: "#ec4899", soft: "rgba(236,72,153,0.14)" },   // pink
  eods:    { bg: "#f97316", soft: "rgba(249,115,22,0.14)" },   // orange
};

function Dashboard() {
  const { displayName, roles } = useAuth();
  const [range, setRange] = useState<RangeKey>("30d");
  const [eods, setEods] = useState<EodRow[]>([]);
  const [prevEods, setPrevEods] = useState<EodRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const days = RANGES.find((r) => r.key === range)!.days;

  useEffect(() => {
    setLoading(true);
    const now = new Date();
    const from = format(subDays(now, days - 1), "yyyy-MM-dd");
    const prevFrom = format(subDays(now, days * 2 - 1), "yyyy-MM-dd");
    const prevTo = format(subDays(now, days), "yyyy-MM-dd");

    (async () => {
      const [cur, prev, profs] = await Promise.all([
        supabase.from("eods").select("*").gte("report_date", from).order("report_date", { ascending: true }),
        supabase.from("eods").select("*").gte("report_date", prevFrom).lte("report_date", prevTo),
        supabase.from("profiles").select("id, display_name"),
      ]);
      setEods((cur.data as EodRow[]) ?? []);
      setPrevEods((prev.data as EodRow[]) ?? []);
      const pmap: Record<string, Profile> = {};
      (profs.data as Profile[] | null)?.forEach((p) => { pmap[p.id] = p; });
      setProfiles(pmap);
      setLoading(false);
    })();
  }, [days]);

  const totals = useMemo(() => sumRows(eods), [eods]);
  const prevTotals = useMemo(() => sumRows(prevEods), [prevEods]);
  const trend = useMemo(() => buildTrend(eods, days), [eods, days]);

  const topSetters = useMemo(() => {
    const byUser: Record<string, { user_id: string; calls: number; dms: number; convos: number; shows: number }> = {};
    for (const r of eods) {
      const b = byUser[r.user_id] ?? (byUser[r.user_id] = { user_id: r.user_id, calls: 0, dms: 0, convos: 0, shows: 0 });
      b.calls += r.calls_booked;
      b.dms += r.dms_sent;
      b.convos += r.convos_started;
      b.shows += r.shows;
    }
    return Object.values(byUser).sort((a, b) => b.calls - a.calls).slice(0, 6);
  }, [eods]);

  const maxCalls = topSetters[0]?.calls ?? 0;

  const showRate = totals.shows + totals.no_shows > 0
    ? Math.round((totals.shows / (totals.shows + totals.no_shows)) * 100) : 0;
  const prevShowRate = prevTotals.shows + prevTotals.no_shows > 0
    ? Math.round((prevTotals.shows / (prevTotals.shows + prevTotals.no_shows)) * 100) : 0;

  const activeSetters = new Set(eods.map((e) => e.user_id)).size;
  const totalEods = eods.length;
  const rangeLabel = range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "Last 90 days";

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Hero header */}
        <Card className="relative overflow-hidden border-border/60 p-5 sm:p-6">
          <div
            className="absolute inset-0 opacity-70 pointer-events-none"
            style={{
              background:
                "radial-gradient(600px 200px at 0% 0%, rgba(168,85,247,0.18), transparent 60%), radial-gradient(500px 200px at 100% 0%, rgba(59,130,246,0.18), transparent 60%)",
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-lg"
                style={{ background: "linear-gradient(135deg,#a855f7,#3b82f6)" }}>
                {(displayName ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{displayName ?? "Team member"}</h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    <Sparkles className="h-3 w-3" /> ISA Team
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {roles.length ? roles.join(" · ") : "member"} · {rangeLabel.toLowerCase()} overview
                </p>
              </div>
            </div>
            <div className="inline-flex rounded-full border border-border bg-card/60 backdrop-blur p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`text-xs px-3.5 py-1.5 rounded-full transition ${
                    range === r.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >{r.label}</button>
              ))}
            </div>
          </div>
        </Card>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={MessageSquare}  label="DMs Sent"    value={totals.dms_sent}       prev={prevTotals.dms_sent}       color={KPI_COLORS.dms} />
          <Kpi icon={MessagesSquare} label="Convos"      value={totals.convos_started} prev={prevTotals.convos_started} color={KPI_COLORS.convos} />
          <Kpi icon={CalendarCheck}  label="Calls Booked" value={totals.calls_booked}  prev={prevTotals.calls_booked}   color={KPI_COLORS.booked} />
          <Kpi icon={Eye}            label="Shows"       value={totals.shows}          prev={prevTotals.shows}          color={KPI_COLORS.shows} />
          <Kpi icon={EyeOff}         label="No-shows"    value={totals.no_shows}       prev={prevTotals.no_shows}       color={KPI_COLORS.noshow} invertDelta />
          <Kpi icon={TrendingUp}     label="Show rate"   value={showRate} suffix="%"   prev={prevShowRate}              color={KPI_COLORS.rate} />
          <Kpi icon={Users2}         label="Active Setters" value={activeSetters}      prev={new Set(prevEods.map((e) => e.user_id)).size} color={KPI_COLORS.setters} />
          <Kpi icon={FileText}       label="EODs Filed"  value={totalEods}             prev={prevEods.length}           color={KPI_COLORS.eods} />
        </div>

        {/* Row: Trend + Momentum */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-5 border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Growth Trend</h3>
                <p className="text-xs text-muted-foreground">{rangeLabel} · daily activity</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <LegendDot color={KPI_COLORS.dms.bg} label="DMs" />
                <LegendDot color={KPI_COLORS.convos.bg} label="Convos" />
                <LegendDot color={KPI_COLORS.booked.bg} label="Booked" />
              </div>
            </div>
            <div className="h-72">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={trend} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gDms" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KPI_COLORS.dms.bg} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={KPI_COLORS.dms.bg} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KPI_COLORS.convos.bg} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={KPI_COLORS.convos.bg} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gBook" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KPI_COLORS.booked.bg} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={KPI_COLORS.booked.bg} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                    <Area type="monotone" dataKey="dms"    stroke={KPI_COLORS.dms.bg}    strokeWidth={2} fill="url(#gDms)"  />
                    <Area type="monotone" dataKey="convos" stroke={KPI_COLORS.convos.bg} strokeWidth={2} fill="url(#gConv)" />
                    <Area type="monotone" dataKey="booked" stroke={KPI_COLORS.booked.bg} strokeWidth={2.5} fill="url(#gBook)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="p-5 border-border/60">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
                <Flame className="h-4 w-4" style={{ color: "#f97316" }} />
              </div>
              <h3 className="font-semibold">Momentum</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">This period vs previous</p>
            <div className="space-y-3">
              <TransformRow label="DMs"         prev={prevTotals.dms_sent}       curr={totals.dms_sent} />
              <TransformRow label="Convos"      prev={prevTotals.convos_started} curr={totals.convos_started} />
              <TransformRow label="Calls booked" prev={prevTotals.calls_booked}  curr={totals.calls_booked} />
              <TransformRow label="Shows"       prev={prevTotals.shows}          curr={totals.shows} />
              <TransformRow label="Show rate"   prev={prevShowRate}              curr={showRate} suffix="%" />
            </div>
          </Card>
        </div>

        {/* Row: Top setters + Goals */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-5 border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                  <Trophy className="h-4 w-4" style={{ color: "#f59e0b" }} />
                </div>
                <div>
                  <h3 className="font-semibold">Top Performing Setters</h3>
                  <p className="text-xs text-muted-foreground">{rangeLabel} · ranked by calls booked</p>
                </div>
              </div>
            </div>

            {topSetters.length === 0 ? (
              <EmptyState text="No EODs submitted in this range yet." />
            ) : (
              <div className="space-y-2.5">
                {topSetters.map((s, i) => {
                  const name = profiles[s.user_id]?.display_name ?? "Unknown";
                  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  const pct = maxCalls ? Math.max(4, Math.round((s.calls / maxCalls) * 100)) : 0;
                  const rankColors = ["#f59e0b", "#94a3b8", "#f97316"];
                  const rankBg = i < 3 ? rankColors[i] : "var(--muted)";
                  const rankFg = i < 3 ? "#0b0b0b" : "var(--muted-foreground)";
                  return (
                    <div key={s.user_id} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/40 transition">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: rankBg, color: rankFg }}>{i + 1}</div>
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                        style={{ background: `linear-gradient(135deg, hsl(${(i * 67) % 360} 70% 55%), hsl(${(i * 67 + 40) % 360} 70% 45%))` }}>
                        {initials || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums shrink-0">
                            <span className="font-semibold text-foreground">{s.calls}</span> booked · {s.shows} shows
                          </p>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${KPI_COLORS.booked.bg}, ${KPI_COLORS.rate.bg})` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5 border-border/60">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
                <Target className="h-4 w-4" style={{ color: "#22c55e" }} />
              </div>
              <h3 className="font-semibold">Team Goals</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Monthly targets</p>
            <div className="space-y-4">
              <Goal label="DMs sent"       value={totals.dms_sent}       target={GOALS.dms}     color={KPI_COLORS.dms.bg} />
              <Goal label="Convos started" value={totals.convos_started} target={GOALS.convos}  color={KPI_COLORS.convos.bg} />
              <Goal label="Calls booked"   value={totals.calls_booked}   target={GOALS.calls}   color={KPI_COLORS.booked.bg} />
              <Goal label="Shows"          value={totals.shows}          target={GOALS.shows}   color={KPI_COLORS.shows.bg} />
              <Goal label="Show rate"      value={showRate}              target={GOALS.showRate} suffix="%" color={KPI_COLORS.rate.bg} />
            </div>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickLink to="/eods"     icon={FileText}   label="Submit EOD"   desc="Log today's numbers" color={KPI_COLORS.booked.bg} />
          <QuickLink to="/notes"    icon={StickyNote} label="Add note"     desc="Capture an objection or win" color={KPI_COLORS.convos.bg} />
          <QuickLink to="/policies/crm-hygiene" icon={Target} label="CRM Hygiene" desc="Review the policy" color={KPI_COLORS.rate.bg} />
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function sumRows(rows: EodRow[]) {
  return rows.reduce(
    (acc, r) => ({
      dms_sent: acc.dms_sent + r.dms_sent,
      convos_started: acc.convos_started + r.convos_started,
      calls_booked: acc.calls_booked + r.calls_booked,
      shows: acc.shows + r.shows,
      no_shows: acc.no_shows + r.no_shows,
    }),
    { dms_sent: 0, convos_started: 0, calls_booked: 0, shows: 0, no_shows: 0 },
  );
}

function buildTrend(rows: EodRow[], days: number) {
  const map: Record<string, { dms: number; convos: number; booked: number }> = {};
  const out: { key: string; label: string; dms: number; convos: number; booked: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
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

/* ---------- subcomponents ---------- */

function Kpi({
  icon: Icon, label, value, prev, suffix, color, invertDelta,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  prev: number;
  suffix?: string;
  color: { bg: string; soft: string };
  invertDelta?: boolean;
}) {
  const delta = prev === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - prev) / prev) * 100);
  const positive = invertDelta ? delta < 0 : delta > 0;
  const flat = delta === 0;
  return (
    <Card className="p-4 relative overflow-hidden border-border/60 hover:border-border transition">
      <div
        className="absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-60 pointer-events-none"
        style={{ background: color.soft }}
      />
      <div className="relative flex items-start justify-between">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: color.soft }}>
          <Icon className="h-4 w-4" style={{ color: color.bg }} />
        </div>
        <span
          className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 tabular-nums ${
            flat ? "bg-muted text-muted-foreground" : positive ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
          }`}
        >
          {!flat && (positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
          {flat ? "0%" : `${delta > 0 ? "+" : ""}${delta}%`}
        </span>
      </div>
      <div className="relative mt-3">
        <div className="text-2xl font-bold tabular-nums tracking-tight">
          {value.toLocaleString()}{suffix}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function TransformRow({ label, prev, curr, suffix }: { label: string; prev: number; curr: number; suffix?: string }) {
  const delta = prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
  const positive = delta >= 0;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 tabular-nums">
        <span className="text-xs text-muted-foreground">{prev.toLocaleString()}{suffix}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-semibold">{curr.toLocaleString()}{suffix}</span>
        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${positive ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"} w-14 text-center`}>
          {delta > 0 ? "+" : ""}{delta}%
        </span>
      </div>
    </div>
  );
}

function Goal({ label, value, target, suffix, color }: { label: string; value: number; target: number; suffix?: string; color: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div>
      <div className="flex justify-between items-center text-sm mb-1.5">
        <span>{label}</span>
        <span className="tabular-nums text-xs">
          <span className="font-semibold text-foreground">{value.toLocaleString()}{suffix}</span>
          <span className="text-muted-foreground"> / {target.toLocaleString()}{suffix}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, desc, color }: { to: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; desc: string; color: string }) {
  return (
    <Link to={to}>
      <Card className="p-4 border-border/60 hover:border-primary/60 transition group">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold group-hover:text-primary transition">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ChartSkeleton() {
  return <div className="h-full w-full rounded-md bg-muted/40 animate-pulse" />;
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground py-10 text-center">{text}</div>;
}
