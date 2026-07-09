import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, MessagesSquare, CalendarCheck, Eye, EyeOff, Trophy,
  Target, TrendingUp, ArrowUpRight, ArrowDownRight, Flame, Users2,
  FileText, StickyNote,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
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

// Team-wide monthly targets. Admin-configurable later.
const GOALS = {
  dms: 8000,
  convos: 1200,
  calls: 200,
  shows: 140,
  showRate: 70, // percent
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

  // Totals
  const totals = useMemo(() => sumRows(eods), [eods]);
  const prevTotals = useMemo(() => sumRows(prevEods), [prevEods]);

  // Trend series
  const trend = useMemo(() => buildTrend(eods, days), [eods, days]);

  // Top setters
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

  // Setter bar chart data
  const setterBars = useMemo(() =>
    topSetters.slice(0, 5).map((s) => ({
      name: (profiles[s.user_id]?.display_name ?? "—").split(" ")[0],
      Calls: s.calls,
      Shows: s.shows,
    })), [topSetters, profiles]);

  const showRate = totals.shows + totals.no_shows > 0
    ? Math.round((totals.shows / (totals.shows + totals.no_shows)) * 100)
    : 0;
  const prevShowRate = prevTotals.shows + prevTotals.no_shows > 0
    ? Math.round((prevTotals.shows / (prevTotals.shows + prevTotals.no_shows)) * 100)
    : 0;

  const activeSetters = new Set(eods.map((e) => e.user_id)).size;
  const totalEods = eods.length;

  const rangeLabel = range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "Last 90 days";

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
              {(displayName ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{displayName ?? "Team member"}</h1>
              <p className="text-sm text-muted-foreground">
                {roles.length ? roles.join(" · ") : "member"} · Team overview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-card p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`text-xs px-3 py-1.5 rounded-full transition ${
                    range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Badge variant="outline" className="text-xs">{rangeLabel}</Badge>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Kpi icon={MessageSquare} label="DMs" value={totals.dms_sent} prev={prevTotals.dms_sent} accent="var(--tab-inbound)" />
          <Kpi icon={MessagesSquare} label="Convos" value={totals.convos_started} prev={prevTotals.convos_started} accent="var(--tab-conv)" />
          <Kpi icon={CalendarCheck} label="Booked" value={totals.calls_booked} prev={prevTotals.calls_booked} accent="var(--tab-dmclose)" />
          <Kpi icon={Eye} label="Shows" value={totals.shows} prev={prevTotals.shows} accent="var(--tab-engage)" />
          <Kpi icon={EyeOff} label="No-shows" value={totals.no_shows} prev={prevTotals.no_shows} accent="var(--tab-outbound)" invertDelta />
          <Kpi icon={TrendingUp} label="Show %" value={showRate} suffix="%" prev={prevShowRate} accent="var(--tab-psych)" />
          <Kpi icon={Users2} label="Setters" value={activeSetters} prev={new Set(prevEods.map((e) => e.user_id)).size} accent="var(--tab-story)" />
          <Kpi icon={FileText} label="EODs" value={totalEods} prev={prevEods.length} accent="var(--tab-stages)" />
        </div>

        {/* Row: Trend + Transformation */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Growth Trend</h3>
                <p className="text-xs text-muted-foreground">{rangeLabel}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <LegendDot color="var(--tab-inbound)" label="DMs" />
                <LegendDot color="var(--tab-conv)" label="Convos" />
                <LegendDot color="var(--tab-dmclose)" label="Booked" />
              </div>
            </div>
            <div className="h-64">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="dms" stroke="var(--tab-inbound)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="convos" stroke="var(--tab-conv)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="booked" stroke="var(--tab-dmclose)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <Flame className="h-4 w-4" />
              </div>
              <h3 className="font-semibold">Momentum</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">This period vs previous period</p>
            <div className="space-y-3">
              <TransformRow label="DMs" prev={prevTotals.dms_sent} curr={totals.dms_sent} />
              <TransformRow label="Convos" prev={prevTotals.convos_started} curr={totals.convos_started} />
              <TransformRow label="Calls booked" prev={prevTotals.calls_booked} curr={totals.calls_booked} />
              <TransformRow label="Shows" prev={prevTotals.shows} curr={totals.shows} />
              <TransformRow label="Show rate" prev={prevShowRate} curr={showRate} suffix="%" />
            </div>
          </Card>
        </div>

        {/* Row: Top setters + Goals */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Top Performing Setters</h3>
              </div>
              <span className="text-xs text-muted-foreground">{rangeLabel}</span>
            </div>

            {topSetters.length === 0 ? (
              <EmptyState text="No EODs submitted in this range yet." />
            ) : (
              <>
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left font-normal py-2 w-8">#</th>
                        <th className="text-left font-normal py-2">Setter</th>
                        <th className="text-right font-normal py-2">DMs</th>
                        <th className="text-right font-normal py-2">Convos</th>
                        <th className="text-right font-normal py-2">Booked</th>
                        <th className="text-right font-normal py-2">Shows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSetters.map((s, i) => (
                        <tr key={s.user_id} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 font-medium truncate max-w-[180px]">
                            {profiles[s.user_id]?.display_name ?? "Unknown"}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{s.dms.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums">{s.convos.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums font-semibold text-primary">{s.calls}</td>
                          <td className="py-2.5 text-right tabular-nums">{s.shows}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {setterBars.length > 0 && (
                  <div className="h-40 mt-4">
                    <ResponsiveContainer>
                      <BarChart data={setterBars} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={70} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="Calls" fill="var(--tab-dmclose)" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Shows" fill="var(--tab-engage)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Team Goals</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Monthly targets — pace vs {rangeLabel.toLowerCase()}</p>
            <div className="space-y-4">
              <Goal label="DMs sent" value={totals.dms_sent} target={GOALS.dms} />
              <Goal label="Convos started" value={totals.convos_started} target={GOALS.convos} />
              <Goal label="Calls booked" value={totals.calls_booked} target={GOALS.calls} />
              <Goal label="Shows" value={totals.shows} target={GOALS.shows} />
              <Goal label="Show rate" value={showRate} target={GOALS.showRate} suffix="%" />
            </div>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickLink to="/eods" icon={FileText} label="Submit EOD" desc="Log today's numbers" />
          <QuickLink to="/notes" icon={StickyNote} label="Add note" desc="Capture an objection or win" />
          <QuickLink to="/policies/crm-hygiene" icon={Target} label="CRM Hygiene" desc="Review the policy" />
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
  icon: Icon, label, value, prev, suffix, accent, invertDelta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  prev: number;
  suffix?: string;
  accent: string;
  invertDelta?: boolean;
}) {
  const delta = prev === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - prev) / prev) * 100);
  const positive = invertDelta ? delta < 0 : delta > 0;
  const flat = delta === 0;
  return (
    <Card className="p-3 relative overflow-hidden">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums">
        {value.toLocaleString()}{suffix}
      </div>
      <div className={`mt-1 text-[11px] flex items-center gap-0.5 tabular-nums ${
        flat ? "text-muted-foreground" : positive ? "text-emerald-500" : "text-red-500"
      }`}>
        {!flat && (positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
        {flat ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
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
        <span className={`text-[11px] ${positive ? "text-emerald-500" : "text-red-500"} w-12 text-right`}>
          {delta > 0 ? "+" : ""}{delta}%
        </span>
      </div>
    </div>
  );
}

function Goal({ label, value, target, suffix }: { label: string; value: number; target: number; suffix?: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const onPace = pct >= 60;
  return (
    <div>
      <div className="flex justify-between items-center text-sm mb-1.5">
        <span className="flex items-center gap-1.5">
          {label}
          <span className={`h-1.5 w-1.5 rounded-full ${onPace ? "bg-emerald-500" : "bg-amber-500"}`} />
        </span>
        <span className="tabular-nums text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{value.toLocaleString()}{suffix}</span>
          <span> / {target.toLocaleString()}{suffix}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: onPace ? "var(--tab-dmclose)" : "var(--tab-outbound)" }}
        />
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, desc }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="p-4 hover:border-primary/60 transition group">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium group-hover:text-primary transition">{label}</p>
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
