import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Users, UserPlus, Eye, Zap, Users2, Heart, MessageCircle, Link as LinkIcon,
  FileText, Target, Calendar as CalendarIcon, ArrowLeftRight, Settings, Globe,
  Instagram, Loader2, CheckCircle2, AlertTriangle, Pencil, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/instagram")({
  head: () => ({ meta: [{ title: "IG Analytics — Founder" }] }),
  component: IgPage,
});

// -- Types --
type StatKey =
  | "followers" | "new_followers" | "views" | "reached" | "visits"
  | "interactions" | "dms" | "link_clicks" | "posted";
type Reel = { topic: string; pillar: string; pillar_color: string; views: number; saves: number; shares: number; comments: number };
type GoalRow = { label: string; current: number; target: number; suffix?: string };
type Pillar = { name: string; pct: number; color: string };
type AudienceRow = { country: string; timezone: string; engagement: number; pct: number };
type GrowthPoint = { label: string; followers: number; views: number; reached: number };
type FormatRow = { name: string; value: number; color: string };

type Dashboard = {
  before_snapshot: {
    followers: number; monthly_views: number; engagement: number; best_reel: number;
  };
  current_snapshot: {
    followers: number; monthly_views: number; engagement: number; best_reel: number;
  };
  stats: Record<StatKey, number>;
  growth: GrowthPoint[];
  formats: FormatRow[];
  reels: Reel[];
  goals: GoalRow[];
  pillars: Pillar[];
  audience: AudienceRow[];
};

const DEFAULT_DATA: Dashboard = {
  before_snapshot: { followers: 2700, monthly_views: 42000, engagement: 1.6, best_reel: 8200 },
  current_snapshot: { followers: 36700, monthly_views: 1280000, engagement: 6.1, best_reel: 1100000 },
  stats: {
    followers: 36700, new_followers: 34000, views: 1280000, reached: 298000,
    visits: 48200, interactions: 94800, dms: 2100, link_clicks: 2300, posted: 78,
  },
  growth: [
    { label: "Oct", followers: 2700, views: 42000, reached: 20000 },
    { label: "Nov", followers: 8400, views: 220000, reached: 90000 },
    { label: "Dec", followers: 18200, views: 620000, reached: 190000 },
    { label: "Jan", followers: 36700, views: 1280000, reached: 340000 },
  ],
  formats: [
    { name: "Talking Head", value: 26000, color: "#3b82f6" },
    { name: "Text Overlay", value: 14000, color: "#f59e0b" },
    { name: "Raw/Documentary", value: 9000, color: "#ef4444" },
  ],
  reels: [
    { topic: "The exact process I used to manifest my dream life",  pillar: "Manifestation", pillar_color: "#f59e0b", views: 1100000, saves: 24800, shares: 12400, comments: 4200 },
    { topic: "22 year old philosophy student reveals the truth",    pillar: "Philosophy",    pillar_color: "#a78bfa", views: 64300,   saves: 2100,  shares: 890,   comments: 387 },
    { topic: "ELEVATION - The mindset transformation nobody talks", pillar: "Identity",      pillar_color: "#10b981", views: 26000,   saves: 1400,  shares: 620,   comments: 245 },
    { topic: "You've never made a conscious decision in your life", pillar: "Subconscious",  pillar_color: "#3b82f6", views: 20700,   saves: 980,   shares: 420,   comments: 187 },
    { topic: "The Cure to Anxiety (from someone who beat it)",      pillar: "Psychology",    pillar_color: "#ef4444", views: 20000,   saves: 1800,  shares: 540,   comments: 298 },
    { topic: "Why Being Weak Makes You Strong",                     pillar: "Philosophy",    pillar_color: "#a78bfa", views: 16900,   saves: 720,   shares: 340,   comments: 156 },
    { topic: "Identity. The single word that changes everything",   pillar: "Identity",      pillar_color: "#10b981", views: 12300,   saves: 890,   shares: 280,   comments: 134 },
    { topic: "How to Correctly Heal Trauma",                        pillar: "Psychology",    pillar_color: "#ef4444", views: 10300,   saves: 1200,  shares: 380,   comments: 187 },
  ],
  goals: [
    { label: "Instagram Followers", current: 37000,   target: 50000, suffix: "K" },
    { label: "Monthly Views",       current: 1300000, target: 2000000, suffix: "M" },
    { label: "Engagement Rate",     current: 6.1,     target: 7 },
    { label: "Weekly Output",       current: 7,       target: 7 },
    { label: "DMs per Month",       current: 2000,    target: 4000, suffix: "K" },
    { label: "Viral Reels (100K+)", current: 1,       target: 3 },
  ],
  pillars: [
    { name: "Identity",      pct: 28, color: "#3b82f6" },
    { name: "Subconscious",  pct: 4,  color: "#a78bfa" },
    { name: "Psychology",    pct: 8,  color: "#8b5cf6" },
    { name: "Manifestation", pct: 14, color: "#ef4444" },
    { name: "Philosophy",    pct: 22, color: "#10b981" },
    { name: "Other",         pct: 24, color: "#f59e0b" },
  ],
  audience: [
    { country: "United States",  timezone: "9am-12pm EST",  engagement: 6.4, pct: 34 },
    { country: "United Kingdom", timezone: "2pm-5pm GMT",   engagement: 6.8, pct: 22 },
    { country: "Canada",         timezone: "10am-1pm EST",  engagement: 5.8, pct: 12 },
    { country: "India",          timezone: "7pm-10pm IST",  engagement: 5.2, pct: 10 },
    { country: "UAE",            timezone: "8pm-11pm GST",  engagement: 7.2, pct: 8  },
  ],
};

const fmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, "") + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(n >= 10_000 ? 1 : 1).replace(/\.0$/, "") + "K";
  return String(n);
};

function IgPage() {
  const { user, roles } = useAuth();
  const isFounder = roles.includes("founder");

  const [connection, setConnection] = useState<{ username?: string; display_name?: string; subtitle?: string; status: string } | null>(null);
  const [data, setData] = useState<Dashboard>(DEFAULT_DATA);
  const [periodLabel, setPeriodLabel] = useState("Q1 2026");
  const [monthLabel, setMonthLabel] = useState("March 2026");
  const [viewBefore, setViewBefore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: conn }, { data: dash }] = await Promise.all([
      supabase.from("ig_connections").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("ig_dashboards").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    if (conn) setConnection(conn as never);
    if (dash) {
      setPeriodLabel((dash as never as { period_label: string }).period_label ?? "Q1 2026");
      setMonthLabel((dash as never as { month_label: string }).month_label ?? "March 2026");
      const d = (dash as never as { data: Partial<Dashboard> }).data;
      if (d && Object.keys(d).length) setData({ ...DEFAULT_DATA, ...d });
    }
    setLoading(false);
  };

  useEffect(() => { if (isFounder && user) load(); /* eslint-disable-next-line */ }, [isFounder, user?.id]);

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

  const shownSnap = viewBefore ? data.before_snapshot : data.current_snapshot;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-lg font-bold text-emerald-950">
            {(connection?.display_name ?? "G").slice(0, 1)}
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">{connection?.display_name || "Aamer Janbey"}</div>
            <div className="text-xs text-muted-foreground">{connection?.subtitle || "Professional Nerd · Identity Architect"}</div>
          </div>
          <div className="ml-2 px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] font-medium">
            {periodLabel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewBefore(v => !v)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[#1f2530] bg-[#0f1116] hover:border-emerald-500/40 text-xs"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {viewBefore ? "View After" : "View Before"}
            <span className="ml-1 text-emerald-400 font-mono">{fmt(viewBefore ? data.current_snapshot.followers : data.before_snapshot.followers)}</span>
          </button>
          <div className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[#1f2530] bg-[#0f1116] text-xs">
            <CalendarIcon className="h-3.5 w-3.5" /> {monthLabel}
          </div>
          <button
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[#1f2530] bg-[#0f1116] hover:border-pink-500/40 text-xs"
            title={connection?.status === "connected" ? "Instagram connected" : "Connect Instagram"}
          >
            <Instagram className="h-3.5 w-3.5 text-pink-400" />
            {connection?.status === "connected" ? "Connected" : "Connect IG"}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[#1f2530] bg-[#0f1116] hover:border-emerald-500/40"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Top stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        <StatCard icon={<Users className="h-3.5 w-3.5" />} label="Followers" value={fmt(data.stats.followers)} accent="blue" active />
        <StatCard icon={<UserPlus className="h-3.5 w-3.5" />} label="New"          value={fmt(data.stats.new_followers)} />
        <StatCard icon={<Eye className="h-3.5 w-3.5" />}      label="Views"        value={fmt(data.stats.views)} accent="cyan" />
        <StatCard icon={<Zap className="h-3.5 w-3.5" />}      label="Reached"      value={fmt(data.stats.reached)} />
        <StatCard icon={<Users2 className="h-3.5 w-3.5" />}   label="Visits"       value={fmt(data.stats.visits)} />
        <StatCard icon={<Heart className="h-3.5 w-3.5" />}    label="Interactions" value={fmt(data.stats.interactions)} />
        <StatCard icon={<MessageCircle className="h-3.5 w-3.5" />} label="DMs"    value={fmt(data.stats.dms)} />
        <StatCard icon={<LinkIcon className="h-3.5 w-3.5" />} label="Link"         value={fmt(data.stats.link_clicks)} />
        <StatCard icon={<FileText className="h-3.5 w-3.5" />} label="Posted"       value={String(data.stats.posted)} />
      </div>

      {/* Row: Growth chart + Format + Transformation */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <Panel>
          <PanelHeader title="Growth Trend" subtitle={periodLabel}>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <LegendDot color="#10b981" label="Followers" />
              <LegendDot color="#3b82f6" label="Views" />
              <LegendDot color="#f59e0b" label="Reached" />
            </div>
          </PanelHeader>
          <GrowthChart points={data.growth} />
        </Panel>

        <Panel>
          <PanelHeader title="Performance by Format" subtitle="Average views per post" />
          <FormatChart rows={data.formats} />
        </Panel>

        <Panel accent="emerald">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-semibold">Transformation Results</div>
          </div>
          <div className="text-[11px] text-muted-foreground mb-3">{shownSnap === data.before_snapshot ? "Before starting" : "Current state"}</div>
          <div className="space-y-2 text-sm">
            <TransRow label="Followers"    before={data.before_snapshot.followers}    after={data.current_snapshot.followers}    fmtFn={fmt} />
            <TransRow label="Monthly Views" before={data.before_snapshot.monthly_views} after={data.current_snapshot.monthly_views} fmtFn={fmt} />
            <TransRow label="Engagement"    before={data.before_snapshot.engagement}    after={data.current_snapshot.engagement}    fmtFn={(n) => `${n.toFixed(1)}%`} />
            <TransRow label="Best Reel"     before={data.before_snapshot.best_reel}     after={data.current_snapshot.best_reel}     fmtFn={fmt} />
          </div>
        </Panel>
      </div>

      {/* Row: Top reels + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
        <Panel>
          <PanelHeader title="Top Performing Reels" subtitle={monthLabel} />
          <ReelsTable reels={data.reels} />
        </Panel>

        <div className="space-y-3">
          <Panel>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-emerald-400" />
              <div className="text-sm font-semibold">{periodLabel.split(" ")[0]} Goals</div>
            </div>
            <div className="space-y-3">
              {data.goals.map((g, i) => <GoalBar key={i} goal={g} />)}
            </div>
          </Panel>

          <Panel>
            <div className="text-sm font-semibold mb-3">Content Pillars</div>
            <PillarsDonut pillars={data.pillars} />
          </Panel>
        </div>
      </div>

      {/* Row: Audience */}
      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-sky-400" />
          <div className="text-sm font-semibold">Audience</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {data.audience.map((a, i) => <AudienceCard key={i} row={a} />)}
        </div>
      </Panel>

      <div className="text-[10px] text-muted-foreground pt-2 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        <Link to="/founder" className="hover:text-foreground">← Back to Founder Space</Link>
      </div>

      {connectOpen && user && (
        <ConnectDialog
          userId={user.id}
          existing={connection}
          onClose={() => setConnectOpen(false)}
          onSaved={load}
        />
      )}
      {settingsOpen && user && (
        <SettingsDialog
          userId={user.id}
          data={data}
          periodLabel={periodLabel}
          monthLabel={monthLabel}
          onClose={() => setSettingsOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ============= Sub-components =============

function StatCard({ icon, label, value, accent, active }: { icon: React.ReactNode; label: string; value: string; accent?: "blue" | "cyan"; active?: boolean }) {
  const border = active ? "border-blue-500/50" : "border-[#1f2530]";
  const valColor = accent === "cyan" ? "text-cyan-300" : accent === "blue" ? "text-blue-400" : "text-foreground";
  return (
    <div className={`border ${border} bg-[#0f1116] rounded-md p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {icon}<span>{label}</span>
      </div>
      <div className={`text-lg font-semibold font-mono ${valColor}`}>{value}</div>
    </div>
  );
}

function Panel({ children, accent }: { children: React.ReactNode; accent?: "emerald" }) {
  const border = accent === "emerald" ? "border-emerald-500/30" : "border-[#1f2530]";
  return <div className={`border ${border} bg-[#0f1116] rounded-md p-4`}>{children}</div>;
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

function GrowthChart({ points }: { points: GrowthPoint[] }) {
  const w = 500, h = 200, padL = 40, padB = 24, padT = 10, padR = 10;
  const max = Math.max(...points.flatMap(p => [p.followers, p.views, p.reached]), 1);
  const iw = w - padL - padR, ih = h - padT - padB;
  const x = (i: number) => padL + (i / Math.max(points.length - 1, 1)) * iw;
  const y = (v: number) => padT + ih - (v / max) * ih;
  const path = (key: keyof GrowthPoint) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key] as number)}`).join(" ");
  const gridYs = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]">
      {gridYs.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={padT + ih * g} y2={padT + ih * g} stroke="#1f2530" strokeDasharray="2 4" />
          <text x={4} y={padT + ih * g + 4} fill="#6b7280" fontSize="9" fontFamily="ui-monospace,monospace">
            {fmt(Math.round(max * (1 - g)))}
          </text>
        </g>
      ))}
      <path d={path("views")}    fill="none" stroke="#3b82f6" strokeWidth="2" />
      <path d={path("reached")}  fill="none" stroke="#f59e0b" strokeWidth="2" />
      <path d={path("followers")} fill="none" stroke="#10b981" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.views)}     r="3" fill="#3b82f6" />
          <circle cx={x(i)} cy={y(p.reached)}   r="3" fill="#f59e0b" />
          <circle cx={x(i)} cy={y(p.followers)} r="3" fill="#10b981" />
          <text x={x(i)} y={h - 6} textAnchor="middle" fill="#9ca3af" fontSize="10">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function FormatChart({ rows }: { rows: FormatRow[] }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="space-y-3 py-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-24 text-[11px] text-muted-foreground text-right">{r.name}</div>
          <div className="flex-1 h-6 rounded-sm bg-[#0a0b0f] border border-[#1f2530] overflow-hidden">
            <div className="h-full rounded-sm" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
          <div className="w-14 text-[11px] font-mono text-right">{fmt(r.value)}</div>
        </div>
      ))}
      <div className="ml-24 flex items-center justify-between text-[9px] text-muted-foreground font-mono">
        <span>0K</span><span>{fmt(Math.round(max / 2))}</span><span>{fmt(max)}</span>
      </div>
    </div>
  );
}

function TransRow({ label, before, after, fmtFn }: { label: string; before: number; after: number; fmtFn: (n: number) => string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground text-[13px]">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-[13px] font-mono">{fmtFn(before)}</span>
        <span className="text-muted-foreground text-xs">→</span>
        <span className="text-emerald-400 font-semibold font-mono">{fmtFn(after)}</span>
      </div>
    </div>
  );
}

function ReelsTable({ reels }: { reels: Reel[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-[#1f2530]">
            <th className="text-left font-normal py-2 w-6">#</th>
            <th className="text-left font-normal py-2">Topic</th>
            <th className="text-left font-normal py-2 w-28">Pillar</th>
            <th className="text-right font-normal py-2 w-16"><span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> Views</span></th>
            <th className="text-right font-normal py-2 w-14">Saves</th>
            <th className="text-right font-normal py-2 w-14">Shares</th>
            <th className="text-right font-normal py-2 w-16">Comments</th>
          </tr>
        </thead>
        <tbody>
          {reels.map((r, i) => (
            <tr key={i} className="border-b border-[#141821] last:border-0 hover:bg-[#141821]">
              <td className="py-2 text-muted-foreground font-mono">{i + 1}</td>
              <td className="py-2 truncate max-w-[380px]" title={r.topic}>{r.topic}</td>
              <td className="py-2">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] border font-medium"
                  style={{ background: `${r.pillar_color}22`, color: r.pillar_color, borderColor: `${r.pillar_color}55` }}
                >{r.pillar}</span>
              </td>
              <td className="py-2 text-right font-mono text-blue-400 font-semibold">{fmt(r.views)}</td>
              <td className="py-2 text-right font-mono">{fmt(r.saves)}</td>
              <td className="py-2 text-right font-mono">{fmt(r.shares)}</td>
              <td className="py-2 text-right font-mono">{fmt(r.comments)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalBar({ goal }: { goal: GoalRow }) {
  const pct = Math.min(100, (goal.current / Math.max(goal.target, 1)) * 100);
  const done = pct >= 100;
  const risky = pct < 30;
  const displayCurrent = goal.suffix === "M" ? (goal.current / 1_000_000).toFixed(1) + "M"
                       : goal.suffix === "K" ? (goal.current / 1_000).toFixed(0) + "K"
                       : String(goal.current);
  const displayTarget  = goal.suffix === "M" ? (goal.target / 1_000_000).toFixed(1) + "M"
                       : goal.suffix === "K" ? (goal.target / 1_000).toFixed(0) + "K"
                       : String(goal.target);
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground">{goal.label}</span>
          {done ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : risky ? <AlertTriangle className="h-3 w-3 text-amber-400" /> : <CheckCircle2 className="h-3 w-3 text-muted-foreground/60" />}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground"><span className="text-foreground">{displayCurrent}</span> / {displayTarget}</div>
      </div>
      <div className="h-1.5 rounded-full bg-[#0a0b0f] overflow-hidden">
        <div className={`h-full rounded-full ${done ? "bg-emerald-500" : risky ? "bg-amber-500" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
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
    const mid = (a1 + a2) / 2;
    const lx = cx + (R + 14) * Math.cos(mid);
    const ly = cy + (R + 14) * Math.sin(mid);
    return { d, color: p.color, label: `${p.pct}%`, lx, ly };
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 200 160" className="w-40 h-40 shrink-0">
        {arcs.map((a, i) => (
          <g key={i}>
            <path d={a.d} fill={a.color} stroke="#0f1116" strokeWidth="1" />
            <text x={a.lx} y={a.ly} textAnchor="middle" fontSize="10" fill={a.color} fontWeight="bold">{a.label}</text>
          </g>
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
    <div className="border border-[#1f2530] rounded-md p-3 bg-[#0a0b0f]">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-xs font-medium">{row.country}</div>
          <div className="text-[10px] text-muted-foreground">{row.timezone}</div>
        </div>
        <div className="text-[10px] font-mono text-emerald-400">{row.engagement}%</div>
      </div>
      <div className="mt-2 h-1 rounded-full bg-[#0a0b0f] border border-[#141821] overflow-hidden">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.pct * 2}%`, maxWidth: "100%" }} />
      </div>
      <div className="text-right text-[10px] text-muted-foreground font-mono mt-1">{row.pct}%</div>
    </div>
  );
}

// -- Connect dialog: stub for Meta Graph OAuth. Saves username + optional token.
function ConnectDialog({ userId, existing, onClose, onSaved }: {
  userId: string;
  existing: { username?: string; display_name?: string; subtitle?: string; status: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(existing?.username ?? "");
  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? "");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (asConnected: boolean) => {
    setSaving(true);
    const payload = {
      user_id: userId,
      username: username || null,
      display_name: displayName || null,
      subtitle: subtitle || null,
      access_token: token ? token : undefined,
      connected_at: asConnected ? new Date().toISOString() : null,
      status: asConnected ? "connected" : "pending",
    };
    const { error } = await supabase.from("ig_connections").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(asConnected ? "Instagram connected" : "Saved");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0f1116] border border-[#1f2530] rounded-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-400" />
          <div className="text-sm font-semibold">Connect Instagram</div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enter your IG profile. Full Meta Graph API sync coming next — for now this stores your profile so the dashboard shows your name and lets us start pushing live data.
        </p>
        <Field label="Instagram username" value={username} onChange={setUsername} placeholder="aamerjanbey" />
        <Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Aamer Janbey" />
        <Field label="Subtitle" value={subtitle} onChange={setSubtitle} placeholder="Professional Nerd · Identity Architect" />
        <Field label="Long-lived access token (optional)" value={token} onChange={setToken} placeholder="EAAG…" type="password" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="h-8 px-3 rounded-sm border border-[#1f2530] text-xs">Cancel</button>
          <button onClick={() => save(false)} disabled={saving} className="h-8 px-3 rounded-sm border border-[#1f2530] text-xs hover:border-emerald-500/40">Save</button>
          <button onClick={() => save(true)} disabled={saving} className="h-8 px-3 rounded-sm bg-pink-500 hover:bg-pink-400 text-white text-xs font-medium">
            {saving ? "Saving…" : "Mark connected"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Settings: edit dashboard JSON so the founder can adjust numbers until IG sync is live.
function SettingsDialog({ userId, data, periodLabel, monthLabel, onClose, onSaved }: {
  userId: string; data: Dashboard; periodLabel: string; monthLabel: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(data, null, 2));
  const [pLabel, setPLabel] = useState(periodLabel);
  const [mLabel, setMLabel] = useState(monthLabel);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let parsed: Dashboard;
    try { parsed = JSON.parse(text); }
    catch { return toast.error("Invalid JSON"); }
    setSaving(true);
    const { error } = await supabase.from("ig_dashboards").upsert(
      { user_id: userId, period_label: pLabel, month_label: mLabel, data: parsed as never },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dashboard saved");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-[#0f1116] border border-[#1f2530] rounded-md p-5 space-y-3 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-emerald-400" />
          <div className="text-sm font-semibold">Edit dashboard data</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Period label" value={pLabel} onChange={setPLabel} />
          <Field label="Month label" value={mLabel} onChange={setMLabel} />
        </div>
        <div className="space-y-1 flex-1 flex flex-col min-h-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Data (JSON)</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 min-h-[300px] bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 font-mono text-[11px] resize-none focus:outline-none focus:border-emerald-500/40"
            spellCheck={false}
          />
          <p className="text-[10px] text-muted-foreground">Structure: stats, growth, formats, reels, goals, pillars, audience, before_snapshot, current_snapshot.</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 rounded-sm border border-[#1f2530] text-xs">Cancel</button>
          <button onClick={save} disabled={saving} className="h-8 px-3 rounded-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-medium">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 bg-[#0a0b0f] border border-[#1f2530] rounded-sm px-2 text-sm focus:outline-none focus:border-emerald-500/40"
      />
    </div>
  );
}
