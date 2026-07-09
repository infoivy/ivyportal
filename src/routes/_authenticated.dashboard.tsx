import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Users, UserPlus, Eye, Zap, MessageSquare, Heart, MessagesSquare,
  Link2, FileText, Target, Globe, ArrowRightLeft, Calendar as CalIcon,
  Settings, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
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
};
type Profile = { id: string; display_name: string | null };

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "Q1", days: 90 },
] as const;
type RangeKey = typeof RANGES[number]["key"];

const GOALS = { dms: 20000, convos: 3000, calls: 500, shows: 350, showRate: 75, viral: 3 };

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

  const rangeLabel = range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "Q1 2026";

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
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-[2px] transition ${
                    range === r.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >{r.label}</button>
              ))}
            </div>
            <button className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground">
              <ArrowRightLeft className="h-3 w-3" /> Compare
            </button>
            <Link to="/eods" className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground">
              <CalIcon className="h-3 w-3" /> <span className="hidden sm:inline">{format(new Date(), "MMMM yyyy")}</span>
            </Link>
            <button className="p-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground">
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

        {/* Row 2: Growth + Format + Transformation */}
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
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

          {/* Transformation Results (period-over-period) */}
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
        </div>

        {/* Row 3: Top Setters + Goals + Audience */}
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
          <Panel>
            <PanelHead title="Top Performing Setters" subtitle={rangeLabel} />
            {topSetters.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">No EODs submitted in this range.</div>
            ) : (
              <div className="mt-2">
                <div className="grid grid-cols-[24px_minmax(0,1fr)_90px_60px_60px_60px] gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <span>#</span>
                  <span>Setter</span>
                  <span className="text-right">DMs</span>
                  <span className="text-right">Convos</span>
                  <span className="text-right">Booked</span>
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
                <h3 className="text-sm font-bold">Q1 Goals</h3>
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
