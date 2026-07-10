import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Users, UserPlus, Eye, Zap, Users2, Heart, MessageCircle, Link as LinkIcon,
  FileText, Target, Calendar as CalendarIcon, Settings, Globe,
  Instagram, Loader2, CheckCircle2, AlertTriangle, Pencil, Sparkles, Plus, Trash2, X,
  TrendingUp, TrendingDown, Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/instagram")({
  head: () => ({ meta: [{ title: "IG Analytics — Founder" }] }),
  component: IgPage,
});

// -- Types --
type Snapshot = {
  id: string;
  month: string; // YYYY-MM-DD (first of month)
  followers: number;
  new_followers: number;
  views: number;
  reach: number;
  profile_visits: number;
  interactions: number;
  dms: number;
  link_clicks: number;
  posts: number;
  notes: string | null;
  updated_at: string;
};

type TopReel = {
  id: string;
  month: string;
  topic: string;
  pillar: string | null;
  views: number;
  saves: number;
  shares: number;
  comments: number;
  avg_watch_sec: number | null;
  new_follows: number | null;
  content_item_id: string | null;
};

type GoalRow = { label: string; current: number; target: number; suffix?: string };
type Pillar = { name: string; pct: number; color: string };
type AudienceRow = { country: string; timezone: string; engagement: number; pct: number };
type FormatRow = { name: string; value: number; color: string };

type DashboardSettings = {
  goals: GoalRow[];
  pillars: Pillar[];
  audience: AudienceRow[];
  formats: FormatRow[];
};

const DEFAULT_SETTINGS: DashboardSettings = {
  goals: [
    { label: "Instagram Followers", current: 0, target: 50000, suffix: "K" },
    { label: "Monthly Views",       current: 0, target: 2000000, suffix: "M" },
    { label: "Engagement Rate",     current: 0, target: 7 },
    { label: "Weekly Output",       current: 0, target: 7 },
    { label: "DMs per Month",       current: 0, target: 4000, suffix: "K" },
    { label: "Viral Reels (100K+)", current: 0, target: 3 },
  ],
  pillars: [
    { name: "Identity",      pct: 20, color: "#3b82f6" },
    { name: "Psychology",    pct: 20, color: "#8b5cf6" },
    { name: "Philosophy",    pct: 20, color: "#10b981" },
    { name: "Manifestation", pct: 20, color: "#ef4444" },
    { name: "Other",         pct: 20, color: "#f59e0b" },
  ],
  audience: [],
  formats: [],
};

const PILLAR_COLORS: Record<string, string> = {
  Identity: "#10b981", Psychology: "#ef4444", Philosophy: "#a78bfa",
  Manifestation: "#f59e0b", Subconscious: "#3b82f6", Other: "#f59e0b",
};

const fmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, "") + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
};

function currentMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function IgPage() {
  const { user, roles } = useAuth();
  const isFounder = roles.includes("founder");

  const [connection, setConnection] = useState<{ username?: string; display_name?: string; subtitle?: string; status: string } | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [reels, setReels] = useState<TopReel[]>([]);
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthISO());
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: conn }, { data: dash }, { data: snaps }, { data: rls }] = await Promise.all([
      supabase.from("ig_connections").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("ig_dashboards").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("ig_monthly_snapshots").select("*").order("month", { ascending: false }),
      supabase.from("ig_top_reels").select("*").order("views", { ascending: false }),
    ]);
    if (conn) setConnection(conn as never);
    if (dash) {
      const d = (dash as never as { data: Partial<DashboardSettings> }).data ?? {};
      setSettings({ ...DEFAULT_SETTINGS, ...d });
    }
    const ss = (snaps ?? []) as Snapshot[];
    setSnapshots(ss);
    setReels((rls ?? []) as TopReel[]);
    // Default to most recent snapshot if any exist
    if (ss.length && !ss.find(s => s.month === selectedMonth)) {
      setSelectedMonth(ss[0].month);
    }
    setLoading(false);
  };

  useEffect(() => { if (isFounder && user) load(); /* eslint-disable-next-line */ }, [isFounder, user?.id]);

  const selected = useMemo(() => snapshots.find(s => s.month === selectedMonth) ?? null, [snapshots, selectedMonth]);
  const previous = useMemo(() => {
    const idx = snapshots.findIndex(s => s.month === selectedMonth);
    return idx >= 0 && idx < snapshots.length - 1 ? snapshots[idx + 1] : null;
  }, [snapshots, selectedMonth]);
  const monthReels = useMemo(() => reels.filter(r => r.month === selectedMonth).sort((a, b) => b.views - a.views), [reels, selectedMonth]);
  const growthPoints = useMemo(() => [...snapshots].slice(0, 6).reverse(), [snapshots]);

  if (!isFounder) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-2">
        <Instagram className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-lg font-semibold">Instagram Analytics</div>
        <p className="text-sm text-muted-foreground">This area is not accessible with your account.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const monthLabel = selected ? format(parseISO(selected.month), "MMMM yyyy") : format(parseISO(selectedMonth), "MMMM yyyy");
  const empty = snapshots.length === 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-lg font-bold text-green-950">
            {(connection?.display_name ?? "?").slice(0, 1)}
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">{connection?.display_name || "Instagram Analytics"}</div>
            <div className="text-xs text-muted-foreground">{connection?.subtitle || "Log a month to start tracking"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs"
          >
            {snapshots.length === 0 && <option value={selectedMonth}>{monthLabel}</option>}
            {snapshots.map(s => (
              <option key={s.month} value={s.month}>{format(parseISO(s.month), "MMMM yyyy")}</option>
            ))}
          </select>
          {selected && (
            <div className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-[10px] text-muted-foreground" title={`Last updated ${format(parseISO(selected.updated_at), "MMM d, yyyy")}`}>
              <Clock className="h-3 w-3" /> {format(parseISO(selected.updated_at), "MMM d")}
            </div>
          )}
          <button
            onClick={() => setLogOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-green-500 hover:bg-green-400 text-green-950 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> {selected ? "Update month" : "Log this month"}
          </button>
          <button
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] hover:border-blue-500/40 text-xs"
          >
            <Instagram className="h-3.5 w-3.5 text-blue-400" />
            {connection?.username ? `@${connection.username}` : "Profile"}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[var(--border)] bg-[var(--card)] hover:border-green-500/40"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {empty && (
        <div className="border border-green-500/30 bg-green-500/5 rounded-md p-6 text-center">
          <Instagram className="h-8 w-8 mx-auto text-green-400 mb-2" />
          <div className="text-sm font-semibold mb-1">No snapshots yet</div>
          <p className="text-xs text-muted-foreground mb-3">Log the first month to populate this dashboard. Numbers come from your IG insights.</p>
          <button
            onClick={() => setLogOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-green-500 hover:bg-green-400 text-green-950 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Log this month
          </button>
        </div>
      )}

      {selected && (
        <>
          {/* Top stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
            <StatCard icon={<Users className="h-3.5 w-3.5" />} label="Followers" value={fmt(selected.followers)} delta={previous ? selected.followers - previous.followers : null} accent="blue" active />
            <StatCard icon={<UserPlus className="h-3.5 w-3.5" />} label="New"    value={fmt(selected.new_followers)} delta={previous ? selected.new_followers - previous.new_followers : null} />
            <StatCard icon={<Eye className="h-3.5 w-3.5" />}      label="Views"        value={fmt(selected.views)} delta={previous ? selected.views - previous.views : null} accent="cyan" />
            <StatCard icon={<Zap className="h-3.5 w-3.5" />}      label="Reached"      value={fmt(selected.reach)} delta={previous ? selected.reach - previous.reach : null} />
            <StatCard icon={<Users2 className="h-3.5 w-3.5" />}   label="Visits"       value={fmt(selected.profile_visits)} delta={previous ? selected.profile_visits - previous.profile_visits : null} />
            <StatCard icon={<Heart className="h-3.5 w-3.5" />}    label="Interactions" value={fmt(selected.interactions)} delta={previous ? selected.interactions - previous.interactions : null} />
            <StatCard icon={<MessageCircle className="h-3.5 w-3.5" />} label="DMs"    value={fmt(selected.dms)} delta={previous ? selected.dms - previous.dms : null} />
            <StatCard icon={<LinkIcon className="h-3.5 w-3.5" />} label="Link"         value={fmt(selected.link_clicks)} delta={previous ? selected.link_clicks - previous.link_clicks : null} />
            <StatCard icon={<FileText className="h-3.5 w-3.5" />} label="Posted"       value={String(selected.posts)} delta={previous ? selected.posts - previous.posts : null} />
          </div>

          {/* Row: Growth chart + Goals */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
            <Panel>
              <PanelHeader title="Growth Trend" subtitle={`Last ${growthPoints.length} month${growthPoints.length === 1 ? "" : "s"}`}>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <LegendDot color="#10b981" label="Followers" />
                  <LegendDot color="#3b82f6" label="Views" />
                  <LegendDot color="#f59e0b" label="Reach" />
                </div>
              </PanelHeader>
              {growthPoints.length >= 2 ? (
                <GrowthChart points={growthPoints} />
              ) : (
                <div className="h-40 grid place-items-center text-[11px] text-muted-foreground">Log another month to see the trend line.</div>
              )}
            </Panel>

            <Panel>
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-green-400" />
                <div className="text-sm font-semibold">Goals</div>
              </div>
              <div className="space-y-3">
                {settings.goals.map((g, i) => <GoalBar key={i} goal={g} />)}
              </div>
            </Panel>
          </div>

          {/* Row: Top reels + Pillars */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
            <Panel>
              <PanelHeader title="Top Performing Reels" subtitle={monthLabel} />
              {monthReels.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-8">
                  No reels logged for {monthLabel}. Add them in "Update month".
                </div>
              ) : (
                <ReelsTable reels={monthReels} />
              )}
            </Panel>

            <Panel>
              <div className="text-sm font-semibold mb-3">Content Pillars</div>
              <PillarsDonut pillars={settings.pillars} />
            </Panel>
          </div>

          {settings.audience.length > 0 && (
            <Panel>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-sky-400" />
                <div className="text-sm font-semibold">Audience</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {settings.audience.map((a, i) => <AudienceCard key={i} row={a} />)}
              </div>
            </Panel>
          )}
        </>
      )}

      <div className="text-[10px] text-muted-foreground pt-2 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        <Link to="/founder" className="hover:text-foreground">← Back to Founder Hub</Link>
      </div>

      {connectOpen && user && (
        <ConnectDialog userId={user.id} existing={connection} onClose={() => setConnectOpen(false)} onSaved={load} />
      )}
      {settingsOpen && user && (
        <SettingsDialog userId={user.id} settings={settings} onClose={() => setSettingsOpen(false)} onSaved={load} />
      )}
      {logOpen && user && (
        <LogMonthDialog
          userId={user.id}
          month={selectedMonth}
          existing={selected}
          existingReels={monthReels}
          onClose={() => setLogOpen(false)}
          onSaved={(m) => { setSelectedMonth(m); load(); }}
        />
      )}
    </div>
  );
}

// ============= Sub-components =============

function StatCard({ icon, label, value, accent, active, delta }: { icon: React.ReactNode; label: string; value: string; accent?: "blue" | "cyan"; active?: boolean; delta?: number | null }) {
  const border = active ? "border-blue-500/50" : "border-[var(--border)]";
  const valColor = accent === "cyan" ? "text-blue-300" : accent === "blue" ? "text-blue-400" : "text-foreground";
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <div className={`border ${border} bg-[var(--card)] rounded-md p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {icon}<span>{label}</span>
      </div>
      <div className={`text-lg font-semibold font-mono ${valColor}`}>{value}</div>
      {delta != null && delta !== 0 && (
        <div className={`text-[10px] font-mono flex items-center gap-0.5 mt-0.5 ${up ? "text-green-400" : "text-red-400"}`}>
          {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {up ? "+" : ""}{fmt(delta)}
        </div>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="border border-[var(--border)] bg-[var(--card)] rounded-md p-4">{children}</div>;
}

function PanelHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</div>;
}

function GrowthChart({ points }: { points: Snapshot[] }) {
  const w = 500, h = 200, padL = 40, padB = 24, padT = 10, padR = 10;
  const max = Math.max(...points.flatMap(p => [p.followers, p.views, p.reach]), 1);
  const iw = w - padL - padR, ih = h - padT - padB;
  const x = (i: number) => padL + (i / Math.max(points.length - 1, 1)) * iw;
  const y = (v: number) => padT + ih - (v / max) * ih;
  const path = (key: "followers" | "views" | "reach") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ");
  const gridYs = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]">
      {gridYs.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={padT + ih * g} y2={padT + ih * g} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={4} y={padT + ih * g + 4} fill="#6b7280" fontSize="9" fontFamily="ui-monospace,monospace">
            {fmt(Math.round(max * (1 - g)))}
          </text>
        </g>
      ))}
      <path d={path("views")}    fill="none" stroke="#3b82f6" strokeWidth="2" />
      <path d={path("reach")}    fill="none" stroke="#f59e0b" strokeWidth="2" />
      <path d={path("followers")} fill="none" stroke="#10b981" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.views)}     r="3" fill="#3b82f6" />
          <circle cx={x(i)} cy={y(p.reach)}     r="3" fill="#f59e0b" />
          <circle cx={x(i)} cy={y(p.followers)} r="3" fill="#10b981" />
          <text x={x(i)} y={h - 6} textAnchor="middle" fill="#9ca3af" fontSize="10">{format(parseISO(p.month), "MMM")}</text>
        </g>
      ))}
    </svg>
  );
}

function ReelsTable({ reels }: { reels: TopReel[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-[var(--border)]">
            <th className="text-left font-normal py-2 w-6">#</th>
            <th className="text-left font-normal py-2">Topic</th>
            <th className="text-left font-normal py-2 w-28">Pillar</th>
            <th className="text-right font-normal py-2 w-16">Views</th>
            <th className="text-right font-normal py-2 w-14">Saves</th>
            <th className="text-right font-normal py-2 w-14">Shares</th>
            <th className="text-right font-normal py-2 w-16">Comments</th>
            <th className="text-right font-normal py-2 w-14">Follows</th>
          </tr>
        </thead>
        <tbody>
          {reels.map((r, i) => {
            const color = r.pillar ? (PILLAR_COLORS[r.pillar] ?? "#6b7280") : "#6b7280";
            return (
              <tr key={r.id} className="border-b border-[#141821] last:border-0 hover:bg-[#141821]">
                <td className="py-2 text-muted-foreground font-mono">{i + 1}</td>
                <td className="py-2 truncate max-w-[380px]" title={r.topic}>{r.topic}</td>
                <td className="py-2">
                  {r.pillar && (
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] border font-medium"
                      style={{ background: `${color}22`, color, borderColor: `${color}55` }}
                    >{r.pillar}</span>
                  )}
                </td>
                <td className="py-2 text-right font-mono text-blue-400 font-semibold">{fmt(r.views)}</td>
                <td className="py-2 text-right font-mono">{fmt(r.saves)}</td>
                <td className="py-2 text-right font-mono">{fmt(r.shares)}</td>
                <td className="py-2 text-right font-mono">{fmt(r.comments)}</td>
                <td className="py-2 text-right font-mono text-green-400">{r.new_follows != null ? fmt(r.new_follows) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GoalBar({ goal }: { goal: GoalRow }) {
  const pct = Math.min(100, (goal.current / Math.max(goal.target, 1)) * 100);
  const done = pct >= 100;
  const risky = pct < 30;
  const disp = (n: number) => goal.suffix === "M" ? (n / 1_000_000).toFixed(1) + "M"
                             : goal.suffix === "K" ? (n / 1_000).toFixed(0) + "K"
                             : String(n);
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground">{goal.label}</span>
          {done ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : risky ? <AlertTriangle className="h-3 w-3 text-amber-400" /> : <CheckCircle2 className="h-3 w-3 text-muted-foreground/60" />}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground"><span className="text-foreground">{disp(goal.current)}</span> / {disp(goal.target)}</div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--background)] overflow-hidden">
        <div className={`h-full rounded-full ${done ? "bg-green-500" : risky ? "bg-amber-500" : "bg-green-400"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PillarsDonut({ pillars }: { pillars: Pillar[] }) {
  const total = pillars.reduce((a, p) => a + p.pct, 0) || 1;
  const R = 46, r = 28, cx = 80, cy = 80;
  let angle = -Math.PI / 2;
  const arcs = pillars.map((p) => {
    const frac = p.pct / total;
    const a1 = angle;
    const a2 = angle + frac * Math.PI * 2;
    angle = a2;
    const large = frac > 0.5 ? 1 : 0;
    const x1o = cx + R * Math.cos(a1), y1o = cy + R * Math.sin(a1);
    const x2o = cx + R * Math.cos(a2), y2o = cy + R * Math.sin(a2);
    const x1i = cx + r * Math.cos(a2), y1i = cy + r * Math.sin(a2);
    const x2i = cx + r * Math.cos(a1), y2i = cy + r * Math.sin(a1);
    const d = `M ${x1o} ${y1o} A ${R} ${R} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${r} ${r} 0 ${large} 0 ${x2i} ${y2i} Z`;
    return { d, color: p.color, label: `${p.pct}%` };
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 200 160" className="w-40 h-40 shrink-0">
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="var(--card)" strokeWidth="1" />
        ))}
      </svg>
      <div className="grid grid-cols-1 gap-1 text-[11px] flex-1">
        {pillars.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-mono">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudienceCard({ row }: { row: AudienceRow }) {
  return (
    <div className="border border-[var(--border)] rounded-md p-3 bg-[var(--background)]">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-xs font-medium">{row.country}</div>
          <div className="text-[10px] text-muted-foreground">{row.timezone}</div>
        </div>
        <div className="text-[10px] font-mono text-green-400">{row.engagement}%</div>
      </div>
      <div className="mt-2 h-1 rounded-full bg-[var(--background)] border border-[#141821] overflow-hidden">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.pct * 2}%`, maxWidth: "100%" }} />
      </div>
      <div className="text-right text-[10px] text-muted-foreground font-mono mt-1">{row.pct}%</div>
    </div>
  );
}

// -- Log month dialog: create/update snapshot + top reels
function LogMonthDialog({ userId, month, existing, existingReels, onClose, onSaved }: {
  userId: string;
  month: string;
  existing: Snapshot | null;
  existingReels: TopReel[];
  onClose: () => void;
  onSaved: (month: string) => void;
}) {
  const [selMonth, setSelMonth] = useState(existing?.month ?? month);
  const [followers, setFollowers] = useState(existing?.followers ?? 0);
  const [newFollowers, setNewFollowers] = useState(existing?.new_followers ?? 0);
  const [views, setViews] = useState(existing?.views ?? 0);
  const [reach, setReach] = useState(existing?.reach ?? 0);
  const [profileVisits, setProfileVisits] = useState(existing?.profile_visits ?? 0);
  const [interactions, setInteractions] = useState(existing?.interactions ?? 0);
  const [dms, setDms] = useState(existing?.dms ?? 0);
  const [linkClicks, setLinkClicks] = useState(existing?.link_clicks ?? 0);
  const [posts, setPosts] = useState(existing?.posts ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [reels, setReels] = useState<Partial<TopReel>[]>(existingReels.length ? existingReels : []);
  const [saving, setSaving] = useState(false);

  const addReel = () => setReels(r => [...r, { topic: "", views: 0, saves: 0, shares: 0, comments: 0, pillar: null }]);
  const rmReel = (i: number) => setReels(r => r.filter((_, idx) => idx !== i));
  const updReel = (i: number, patch: Partial<TopReel>) => setReels(r => r.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const save = async () => {
    setSaving(true);
    const payload = {
      created_by: userId, month: selMonth,
      followers, new_followers: newFollowers, views, reach, profile_visits: profileVisits,
      interactions, dms, link_clicks: linkClicks, posts, notes: notes || null,
    };
    const { error } = await supabase.from("ig_monthly_snapshots").upsert(payload, { onConflict: "month" });
    if (error) { setSaving(false); return toast.error(error.message); }
    // Wipe & rewrite top reels for this month
    await supabase.from("ig_top_reels").delete().eq("month", selMonth);
    const reelRows = reels
      .filter(r => (r.topic ?? "").trim())
      .map(r => ({
        created_by: userId, month: selMonth,
        topic: r.topic!, pillar: r.pillar || null,
        views: Number(r.views ?? 0), saves: Number(r.saves ?? 0),
        shares: Number(r.shares ?? 0), comments: Number(r.comments ?? 0),
        avg_watch_sec: r.avg_watch_sec ?? null, new_follows: r.new_follows ?? null,
      }));
    if (reelRows.length) {
      const { error: rerr } = await supabase.from("ig_top_reels").insert(reelRows);
      if (rerr) { setSaving(false); return toast.error(rerr.message); }
    }
    setSaving(false);
    toast.success("Month logged");
    onSaved(selMonth);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="w-full max-w-4xl my-8 bg-[var(--card)] border border-[var(--border)] rounded-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{existing ? "Update month" : "Log this month"}</div>
            <div className="text-[11px] text-muted-foreground">Copy from your IG Insights → Overview</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <FieldNum label="Month" type="month" value={selMonth.slice(0, 7)} onChange={v => setSelMonth(`${v}-01`)} raw />
            <FieldNum label="Followers (total)" value={followers} onChange={setFollowers} />
            <FieldNum label="New followers" value={newFollowers} onChange={setNewFollowers} />
            <FieldNum label="Views" value={views} onChange={setViews} />
            <FieldNum label="Reach" value={reach} onChange={setReach} />
            <FieldNum label="Profile visits" value={profileVisits} onChange={setProfileVisits} />
            <FieldNum label="Interactions" value={interactions} onChange={setInteractions} />
            <FieldNum label="DMs" value={dms} onChange={setDms} />
            <FieldNum label="Link clicks" value={linkClicks} onChange={setLinkClicks} />
            <FieldNum label="Posts" value={posts} onChange={setPosts} />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes (optional)</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-xs resize-y focus:outline-none focus:border-green-500/40" placeholder="What worked / what didn't this month?" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">Top reels this month</div>
              <button onClick={addReel} className="h-7 px-2 rounded-sm border border-[var(--border)] hover:border-green-500/40 text-[11px] inline-flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add reel
              </button>
            </div>
            <div className="space-y-1.5">
              {reels.length === 0 && <div className="text-[11px] text-muted-foreground text-center py-4 border border-dashed border-[var(--border)] rounded-sm">No reels — click "Add reel"</div>}
              {reels.map((r, i) => (
                <div key={i} className="border border-[var(--border)] bg-[var(--background)] rounded-sm p-2 space-y-1.5">
                  <div className="flex gap-1.5">
                    <input value={r.topic ?? ""} onChange={e => updReel(i, { topic: e.target.value })} placeholder="Topic / hook" className="flex-1 h-7 px-2 rounded-sm border border-[var(--border)] bg-[var(--card)] text-xs outline-none focus:border-green-500/40" />
                    <select value={r.pillar ?? ""} onChange={e => updReel(i, { pillar: e.target.value || null })} className="h-7 px-1.5 rounded-sm border border-[var(--border)] bg-[var(--card)] text-[11px]">
                      <option value="">Pillar…</option>
                      {Object.keys(PILLAR_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={() => rmReel(i)} className="h-7 w-7 grid place-items-center rounded-sm border border-[var(--border)] text-muted-foreground hover:text-red-400 hover:border-red-500/40">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <FieldNum label="Views" value={Number(r.views ?? 0)} onChange={v => updReel(i, { views: v })} compact />
                    <FieldNum label="Saves" value={Number(r.saves ?? 0)} onChange={v => updReel(i, { saves: v })} compact />
                    <FieldNum label="Shares" value={Number(r.shares ?? 0)} onChange={v => updReel(i, { shares: v })} compact />
                    <FieldNum label="Comments" value={Number(r.comments ?? 0)} onChange={v => updReel(i, { comments: v })} compact />
                    <FieldNum label="Follows" value={Number(r.new_follows ?? 0)} onChange={v => updReel(i, { new_follows: v })} compact />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs">Cancel</button>
          <button onClick={save} disabled={saving} className="h-8 px-4 rounded-sm bg-green-500 hover:bg-green-400 text-green-950 text-xs font-medium">
            {saving ? "Saving…" : "Save month"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldNum({ label, value, onChange, compact, type, raw }: {
  label: string;
  value: number | string;
  onChange: (v: never) => void;
  compact?: boolean;
  type?: string;
  raw?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        type={type ?? "number"}
        value={value}
        onChange={e => {
          const v = raw ? e.target.value : (e.target.value === "" ? 0 : Number(e.target.value));
          onChange(v as never);
        }}
        className={`w-full ${compact ? "h-7 text-[11px]" : "h-8 text-xs"} px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] outline-none focus:border-green-500/40 font-mono`}
      />
    </div>
  );
}

// -- Connect dialog
function ConnectDialog({ userId, existing, onClose, onSaved }: {
  userId: string;
  existing: { username?: string; display_name?: string; subtitle?: string; status: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(existing?.username ?? "");
  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("ig_connections").upsert({
      user_id: userId,
      username: username || null,
      display_name: displayName || null,
      subtitle: subtitle || null,
      status: "pending",
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-blue-400" />
          <div className="text-sm font-semibold">Instagram profile</div>
        </div>
        <TextField label="Instagram username" value={username} onChange={setUsername} placeholder="handle" />
        <TextField label="Display name" value={displayName} onChange={setDisplayName} placeholder="Your name" />
        <TextField label="Subtitle" value={subtitle} onChange={setSubtitle} placeholder="Bio / one-liner" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs">Cancel</button>
          <button onClick={save} disabled={saving} className="h-8 px-3 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Settings: goals, pillars, audience (JSON editor)
function SettingsDialog({ userId, settings, onClose, onSaved }: {
  userId: string; settings: DashboardSettings; onClose: () => void; onSaved: () => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(settings, null, 2));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let parsed: DashboardSettings;
    try { parsed = JSON.parse(text); } catch { return toast.error("Invalid JSON"); }
    setSaving(true);
    const { error } = await supabase.from("ig_dashboards").upsert(
      { user_id: userId, data: parsed as never },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-[var(--card)] border border-[var(--border)] rounded-md p-5 space-y-3 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-green-400" />
          <div className="text-sm font-semibold">Goals · Pillars · Audience</div>
        </div>
        <div className="space-y-1 flex-1 flex flex-col min-h-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Data (JSON)</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 min-h-[300px] bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 font-mono text-[11px] resize-none focus:outline-none focus:border-green-500/40"
            spellCheck={false}
          />
          <p className="text-[10px] text-muted-foreground">Fields: goals, pillars, audience, formats.</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs">Cancel</button>
          <button onClick={save} disabled={saving} className="h-8 px-3 rounded-sm bg-green-500 hover:bg-green-400 text-green-950 text-xs font-medium">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 bg-[var(--background)] border border-[var(--border)] rounded-sm px-2 text-sm focus:outline-none focus:border-green-500/40"
      />
    </div>
  );
}
