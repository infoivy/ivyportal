import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Shield, TrendingUp, Users, Phone, Target, AlertTriangle, CheckCircle2,
  Activity, Trophy, Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — ISA" }] }),
  component: AdminDashboard,
});

type EodRow = {
  id: string; user_id: string; report_date: string;
  dms_sent: number; convos_started: number; calls_booked: number; calls_scheduled: number;
  shows: number; no_shows: number;
  wins: string | null; blockers: string | null;
};
type Profile = { id: string; display_name: string | null };
type UserRole = { user_id: string; role: string };

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
] as const;
type RangeKey = typeof RANGES[number]["key"];

function AdminDashboard() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [range, setRange] = useState<RangeKey>("30d");
  const [eods, setEods] = useState<EodRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const days = RANGES.find(r => r.key === range)!.days;

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    (async () => {
      const [eodRes, profRes, roleRes] = await Promise.all([
        supabase.from("eods").select("*").gte("report_date", from).order("report_date", { ascending: true }),
        supabase.from("profiles").select("id, display_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      setEods((eodRes.data as EodRow[]) ?? []);
      const pmap: Record<string, Profile> = {};
      (profRes.data as Profile[] | null)?.forEach(p => { pmap[p.id] = p; });
      setProfiles(pmap);
      setUserRoles((roleRes.data as UserRole[]) ?? []);
      setLoading(false);
    })();
  }, [days, isAdmin]);

  const totals = useMemo(() => sumRows(eods), [eods]);
  const trend = useMemo(() => buildTrend(eods, days), [eods, days]);
  const perSetter = useMemo(() => buildPerSetter(eods, profiles), [eods, profiles]);
  const compliance = useMemo(() => buildCompliance(eods, userRoles, profiles, days), [eods, userRoles, profiles, days]);
  const funnelData = useMemo(() => [
    { stage: "DMs", value: totals.dms_sent, fill: "#334155" },
    { stage: "Convos", value: totals.convos_started, fill: "#0891b2" },
    { stage: "Booked", value: totals.calls_booked, fill: "#0ea5e9" },
    { stage: "Shows", value: totals.shows, fill: "#10b981" },
  ], [totals]);

  const showRate = totals.shows + totals.no_shows > 0 ? Math.round((totals.shows / (totals.shows + totals.no_shows)) * 100) : 0;
  const bookRate = totals.convos_started > 0 ? Math.round((totals.calls_booked / totals.convos_started) * 100) : 0;
  const convRate = totals.dms_sent > 0 ? ((totals.convos_started / totals.dms_sent) * 100).toFixed(1) : "0";

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="border border-rose-500/30 bg-rose-500/5 rounded-sm p-8 text-center">
          <Shield className="h-8 w-8 text-rose-400 mx-auto mb-3" />
          <div className="text-sm text-rose-400 font-medium">Admin access required</div>
          <p className="text-xs text-muted-foreground mt-1">You need the admin role to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-rose-400 mb-1">
            <Shield className="h-3 w-3" /> Admin console
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Operations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Live analytics across every setter and closer.</p>
        </div>
        <div className="flex items-center gap-1 border border-[#1f2530] bg-[#0f1116] rounded-sm p-0.5">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 text-[11px] font-medium rounded-sm transition ${
                range === r.key ? "bg-emerald-500/15 text-emerald-400" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <Kpi label="Team DMs" value={totals.dms_sent} icon={<Users className="h-3 w-3" />} />
        <Kpi label="Convos" value={totals.convos_started} icon={<Activity className="h-3 w-3" />} sub={`${convRate}%`} />
        <Kpi label="Booked" value={totals.calls_booked} icon={<Phone className="h-3 w-3" />} accent />
        <Kpi label="Scheduled" value={totals.calls_scheduled} icon={<Clock className="h-3 w-3" />} />
        <Kpi label="Shows" value={totals.shows} icon={<CheckCircle2 className="h-3 w-3" />} />
        <Kpi label="No-shows" value={totals.no_shows} icon={<AlertTriangle className="h-3 w-3" />} />
        <Kpi label="Book rate" value={`${bookRate}%`} icon={<Target className="h-3 w-3" />} accent />
        <Kpi label="Show rate" value={`${showRate}%`} icon={<TrendingUp className="h-3 w-3" />} accent />
      </div>

      {/* Row 1: Volume trend + Funnel */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Volume trend" subtitle={`DMs, convos & booked · last ${days} days`} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gDms" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64748b" stopOpacity={0.4} /><stop offset="100%" stopColor="#64748b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.5} /><stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gBook" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2530" strokeDasharray="2 3" vertical={false} />
              <XAxis dataKey="d" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="dms" stroke="#64748b" fill="url(#gDms)" strokeWidth={1.5} name="DMs" />
              <Area type="monotone" dataKey="convos" stroke="#0ea5e9" fill="url(#gCon)" strokeWidth={1.5} name="Convos" />
              <Area type="monotone" dataKey="booked" stroke="#10b981" fill="url(#gBook)" strokeWidth={2} name="Booked" />
              <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Funnel" subtitle="DM → Convo → Booked → Show">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#1f2530" strokeDasharray="2 3" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis dataKey="stage" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={60} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                {funnelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Row 2: Sets vs Closes + Show/no-show */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Sets vs Closes" subtitle="Daily booked calls vs shows" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1f2530" strokeDasharray="2 3" vertical={false} />
              <XAxis dataKey="d" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="booked" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Sets" />
              <Line type="monotone" dataKey="shows" stroke="#10b981" strokeWidth={2} dot={false} name="Closes" />
              <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Show breakdown" subtitle={`${totals.shows + totals.no_shows} booked calls`}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={[
                  { name: "Shows", value: totals.shows, fill: "#10b981" },
                  { name: "No-shows", value: totals.no_shows, fill: "#f43f5e" },
                ]}
                dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Row 3: Leaderboard + EOD compliance */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Setter leaderboard" subtitle="Ranked by calls booked" icon={<Trophy className="h-3.5 w-3.5 text-amber-400" />}>
          <div className="divide-y divide-[#1a1f29]">
            {perSetter.length === 0 && <EmptyState text="No setter activity yet." />}
            {perSetter.slice(0, 10).map((s, i) => (
              <div key={s.userId} className="flex items-center gap-3 py-2.5">
                <div className={`w-6 text-center text-xs font-mono font-semibold ${i < 3 ? "text-amber-400" : "text-muted-foreground"}`}>#{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {s.dms} DMs · {s.convos} convos · {s.showRate}% show
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-semibold text-emerald-400">{s.booked}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Booked</div>
                </div>
                <div className="w-20 h-1.5 rounded-full bg-[#1a1f29] overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (s.booked / (perSetter[0]?.booked || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="EOD compliance" subtitle={`Reports submitted in last ${days} days`} icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}>
          <div className="divide-y divide-[#1a1f29]">
            {compliance.length === 0 && <EmptyState text="No team members yet." />}
            {compliance.map(c => (
              <div key={c.userId} className="flex items-center gap-3 py-2.5">
                <div className="h-7 w-7 rounded-sm bg-[#1a1f29] border border-[#1f2530] flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{c.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-[#1a1f29] overflow-hidden">
                    <div
                      className={`h-full ${c.rate >= 80 ? "bg-emerald-500" : c.rate >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                  <div className={`text-xs font-mono w-14 text-right ${c.rate >= 80 ? "text-emerald-400" : c.rate >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                    {c.submitted}/{days}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 4: Recent EODs feed */}
      <Panel title="Recent EODs" subtitle="Latest team submissions" icon={<Activity className="h-3.5 w-3.5 text-sky-400" />}>
        <div className="divide-y divide-[#1a1f29]">
          {[...eods].sort((a, b) => b.report_date.localeCompare(a.report_date)).slice(0, 10).map(e => (
            <div key={e.id} className="grid grid-cols-[80px_140px_1fr_auto] items-center gap-3 py-2.5 text-xs">
              <span className="font-mono text-muted-foreground">{e.report_date}</span>
              <span className="truncate">{profiles[e.user_id]?.display_name ?? "Unknown"}</span>
              <div className="flex gap-3 text-[11px] text-muted-foreground font-mono">
                <span>DM <span className="text-foreground">{e.dms_sent}</span></span>
                <span>Conv <span className="text-foreground">{e.convos_started}</span></span>
                <span>Book <span className="text-emerald-400">{e.calls_booked}</span></span>
                <span>Show <span className="text-foreground">{e.shows}</span></span>
              </div>
              {e.blockers ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-amber-500/30 bg-amber-500/5 text-amber-400 max-w-[200px] truncate" title={e.blockers}>
                  ⚠ {e.blockers.slice(0, 30)}
                </span>
              ) : <span />}
            </div>
          ))}
          {eods.length === 0 && !loading && <EmptyState text="No EOD reports in this range." />}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- helpers ---------- */

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

function buildTrend(rows: EodRow[], days: number) {
  const byDate = new Map<string, { dms: number; convos: number; booked: number; shows: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    byDate.set(d, { dms: 0, convos: 0, booked: 0, shows: 0 });
  }
  rows.forEach(r => {
    const b = byDate.get(r.report_date);
    if (b) { b.dms += r.dms_sent; b.convos += r.convos_started; b.booked += r.calls_booked; b.shows += r.shows; }
  });
  return Array.from(byDate, ([d, v]) => ({ d: d.slice(5), ...v }));
}

function buildPerSetter(rows: EodRow[], profiles: Record<string, Profile>) {
  const map = new Map<string, { dms: number; convos: number; booked: number; shows: number; no_shows: number }>();
  rows.forEach(r => {
    const cur = map.get(r.user_id) ?? { dms: 0, convos: 0, booked: 0, shows: 0, no_shows: 0 };
    cur.dms += r.dms_sent; cur.convos += r.convos_started; cur.booked += r.calls_booked;
    cur.shows += r.shows; cur.no_shows += r.no_shows;
    map.set(r.user_id, cur);
  });
  return Array.from(map, ([userId, v]) => ({
    userId,
    name: profiles[userId]?.display_name ?? "Unknown",
    ...v,
    showRate: v.shows + v.no_shows > 0 ? Math.round((v.shows / (v.shows + v.no_shows)) * 100) : 0,
  })).sort((a, b) => b.booked - a.booked);
}

function buildCompliance(rows: EodRow[], userRoles: UserRole[], profiles: Record<string, Profile>, days: number) {
  const submitted = new Map<string, Set<string>>();
  rows.forEach(r => {
    const s = submitted.get(r.user_id) ?? new Set<string>();
    s.add(r.report_date);
    submitted.set(r.user_id, s);
  });
  const roleMap = new Map<string, string[]>();
  userRoles.forEach(ur => {
    const arr = roleMap.get(ur.user_id) ?? [];
    arr.push(ur.role);
    roleMap.set(ur.user_id, arr);
  });
  return Object.values(profiles).map(p => {
    const subCount = submitted.get(p.id)?.size ?? 0;
    return {
      userId: p.id,
      name: p.display_name ?? "Unknown",
      role: (roleMap.get(p.id) ?? ["member"]).join(" · "),
      submitted: subCount,
      rate: Math.round((subCount / days) * 100),
    };
  }).sort((a, b) => b.rate - a.rate);
}

const tooltipStyle = { background: "#0f1116", border: "1px solid #1f2530", borderRadius: 4, fontSize: 11, color: "#e5e7eb" } as const;

function Kpi({ label, value, icon, accent, sub }: { label: string; value: number | string; icon: React.ReactNode; accent?: boolean; sub?: string }) {
  return (
    <div className={`border border-[#1f2530] rounded-sm p-2.5 ${accent ? "bg-emerald-500/5" : "bg-[#0f1116]"}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
      <div className="flex items-baseline gap-1.5">
        <div className={`text-lg font-mono font-semibold ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground font-mono">{sub}</div>}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, icon, children, className }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-[#1f2530] bg-[#0f1116] rounded-sm p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">{icon}{title}</div>
          {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center text-xs text-muted-foreground py-6">{text}</div>;
}
