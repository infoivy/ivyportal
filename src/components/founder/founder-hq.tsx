import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, DollarSign, TrendingUp, BarChart3, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { money, type Deal, startOfWeekMon, isoDay } from "@/lib/revenue";
import { DeltaChip } from "@/components/ui/delta-chip";
import { BreakdownBar } from "@/components/ui/breakdown-bar";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ReferenceDot } from "recharts";


const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function FounderHQInner() {
  const today = isoDate(new Date());
  const monthStart = today.slice(0, 8) + "01";

  // Mon of current week
  const weekStart = isoDay(startOfWeekMon(new Date()));
  const weekEnd = isoDate(new Date(new Date(weekStart).getTime() + 6 * 86400000));

  // 2-week cycle start (same logic as health strip)
  const epochMon = new Date("2024-01-01");
  const todayD = new Date();
  const dayOfWeek = todayD.getDay();
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const cs = new Date(todayD);
  cs.setDate(todayD.getDate() - daysToMon);
  const diffDays = Math.floor((cs.getTime() - epochMon.getTime()) / 86400000);
  const batchOffset = diffDays % 14;
  cs.setDate(cs.getDate() - batchOffset);
  const cycleStartStr = isoDate(cs);
  const ce = new Date(cs);
  ce.setDate(cs.getDate() + 13);
  const cycleEndStr = isoDate(ce);

  const sevenDaysAgo = isoDate(new Date(Date.now() - 7 * 86400000));

  const [deals, setDeals] = useState<Deal[]>([]);
  const [eods, setEods] = useState<{ user_id: string; report_date: string; calls_booked: number; shows: number; closes: number }[]>([]);
  const [setterRoster, setSetterRoster] = useState<string[]>([]);
  const [contentItems, setContentItems] = useState<{ scheduled_date: string | null; status: string }[]>([]);
  const [monthlyGoal, setMonthlyGoal] = useState<number | null>(null);
  const [prevMtdCash, setPrevMtdCash] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchPage = async () => {
    const todayObj = new Date(today);
    const lastMonthStart = new Date(todayObj.getFullYear(), todayObj.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastMonthSameDay = new Date(todayObj.getFullYear(), todayObj.getMonth() - 1, todayObj.getDate()).toISOString().slice(0, 10);
    const [dealsRes, eodsRes, roleRes, contentRes, settingsRes, prevRes] = await Promise.all([
      supabase.from("deals").select("id, closer_id, setter_id, total_value, cash_collected_upfront, deal_date, payment_type").gte("deal_date", monthStart),
      supabase.from("eods").select("user_id, report_date, calls_booked, shows, no_shows").gte("report_date", weekStart).lte("report_date", weekEnd),
      supabase.from("user_roles").select("user_id").eq("role", "setter"),
      supabase.from("content_items").select("scheduled_date, status").gte("scheduled_date", cycleStartStr).lte("scheduled_date", cycleEndStr),
      supabase.from("founder_settings").select("monthly_cash_goal").maybeSingle(),
      supabase.from("deals").select("cash_collected_upfront").gte("deal_date", lastMonthStart).lte("deal_date", lastMonthSameDay),
    ]);
    return {
      deals: (dealsRes.data ?? []) as Deal[],
      eods: (eodsRes.data ?? []) as any[],
      roster: Array.from(new Set(((roleRes.data ?? []) as any[]).map((r: any) => r.user_id))),
      content: (contentRes.data ?? []) as any[],
      goal: (settingsRes.data as any)?.monthly_cash_goal ?? null,
      prevMtd: ((prevRes.data ?? []) as any[]).reduce((s, d) => s + (Number(d.cash_collected_upfront) || 0), 0),
    };
  };

  const pageQ = useQuery({ queryKey: ["page", "founder-hq", today], queryFn: fetchPage });
  useEffect(() => {
    const d = pageQ.data;
    if (!d) return;
    setDeals(d.deals);
    setEods(d.eods);
    setSetterRoster(d.roster);
    setContentItems(d.content);
    setMonthlyGoal(d.goal);
    setPrevMtdCash(d.prevMtd);
    setLoading(false);
  }, [pageQ.data]);


  // MTD cash
  const mtdCash = useMemo(() => deals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0), [deals]);
  const goalPct = monthlyGoal && monthlyGoal > 0 ? Math.min(100, Math.round((mtdCash / monthlyGoal) * 100)) : null;

  // Funnel stats this week
  const weekSets = useMemo(() => eods.reduce((s, e) => s + e.calls_booked, 0), [eods]);
  const weekShows = useMemo(() => eods.reduce((s, e) => s + e.shows, 0), [eods]);
  const weekCloses = useMemo(() => deals.filter(d => d.deal_date >= weekStart && d.deal_date <= weekEnd).length, [deals, weekStart, weekEnd]);
  const showRate = weekSets > 0 ? Math.round((weekShows / weekSets) * 100) : 0;
  const closeRate = weekShows > 0 ? Math.round((weekCloses / weekShows) * 100) : 0;

  // Content pipeline
  const contentTotal = contentItems.length;
  const contentPosted = contentItems.filter(i => i.status === "posted").length;
  const contentRecorded = contentItems.filter(i => ["recorded", "filmed", "edited", "scheduled", "posted"].includes(i.status)).length;
  const contentScripted = contentItems.filter(i => ["scripted", "approved", "recorded", "filmed", "edited", "scheduled", "posted"].includes(i.status)).length;

  // Team EOD compliance
  const eodFilers = useMemo(() => new Set(eods.map(e => e.user_id)), [eods]);
  const expectedDays = Math.min(7, Math.floor((new Date().getTime() - new Date(weekStart).getTime()) / 86400000) + 1);
  const expectedEods = setterRoster.length * expectedDays;
  const compliance = expectedEods > 0 ? Math.round((eods.length / expectedEods) * 100) : 100;

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Quadrant 1: Cash */}
          <Quadrant title="Cash" icon={<DollarSign className="h-4 w-4 text-primary" />} to="/revenue">
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-[28px] font-medium tabular-nums text-foreground">{money(mtdCash)}</div>
              {prevMtdCash > 0 && <DeltaChip value={mtdCash - prevMtdCash} format="money" />}
            </div>
            <div className="text-xs text-muted-foreground">MTD cash · vs last month same day</div>
            {monthlyGoal && (
              <div className="mt-3">
                <GoalPaceChart deals={deals} goal={monthlyGoal} mtdCash={mtdCash} />
              </div>
            )}
            {!monthlyGoal && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Set a monthly goal in <Link to="/admin" className="underline hover:text-foreground">Admin settings</Link>.
              </p>
            )}
            <div className="text-[13px] text-muted-foreground mt-2">{deals.length} deal{deals.length !== 1 ? "s" : ""} closed MTD</div>
          </Quadrant>

          {/* Quadrant 2: Funnel */}
          <Quadrant title="Funnel this week" icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} to="/eods">
            <div className="grid grid-cols-4 gap-2 mt-1">
              <FunnelStat label="Sets" value={weekSets} />
              <FunnelStat label="Shows" value={weekShows} />
              <FunnelStat label="Closes" value={weekCloses} />
              <FunnelStat label="Show %" value={showRate} suffix="%" color={showRate >= 70 ? "text-success-fg" : showRate >= 50 ? "text-warning-fg" : "text-danger-fg"} />
            </div>
            <div className="mt-3 flex items-center gap-3 text-[13px]">
              <span className="text-muted-foreground">Show rate:</span>
              <span className={showRate >= 70 ? "text-success-fg font-semibold" : showRate >= 50 ? "text-warning-fg font-semibold" : "text-danger-fg font-semibold"}>{showRate}%</span>
              <span className="text-muted-foreground">Close rate:</span>
              <span className={closeRate >= 30 ? "text-success-fg font-semibold" : closeRate >= 15 ? "text-warning-fg font-semibold" : "text-danger-fg font-semibold"}>{closeRate}%</span>
            </div>
          </Quadrant>

          {/* Quadrant 3: Content */}
          <Quadrant title="Content pipeline" icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />} to="/command" search={{ tab: "content" }}>
            {contentTotal === 0 ? (
              <div className="text-[13px] text-muted-foreground mt-1">No content scheduled for this 2-week cycle ({cycleStartStr} – {cycleEndStr}).</div>
            ) : (
              <div className="grid grid-cols-4 gap-2 mt-1">
                <FunnelStat label="Total" value={contentTotal} />
                <FunnelStat label="Scripted" value={contentScripted} color={contentScripted >= contentTotal ? "text-success-fg" : "text-warning-fg"} />
                <FunnelStat label="Recorded" value={contentRecorded} color={contentRecorded >= contentTotal ? "text-success-fg" : "text-warning-fg"} />
                <FunnelStat label="Posted" value={contentPosted} color={contentPosted >= contentTotal ? "text-success-fg" : "text-warning-fg"} />
              </div>
            )}
            <div className="text-[12px] text-muted-foreground mt-2">Cycle: {cycleStartStr} → {cycleEndStr}</div>
          </Quadrant>

          {/* Quadrant 4: Team compliance */}
          <Quadrant title="Team compliance" icon={<Users className="h-4 w-4 text-muted-foreground" />} to="/sales">
            <div className="flex items-baseline gap-2 mt-1">
              <div className={`text-[28px] font-medium tabular-nums ${compliance >= 90 ? "text-success-fg" : compliance >= 70 ? "text-warning-fg" : "text-danger-fg"}`}>{compliance}%</div>
              <div className="text-[13px] text-muted-foreground">EOD rate this week</div>
            </div>
            <div className="mt-3">
              <BreakdownBar
                segments={[
                  { label: "Filed", value: eods.length, color: "var(--chart-2)" },
                  { label: "Missing", value: Math.max(0, expectedEods - eods.length), color: "var(--chart-5)" },
                ]}
                total={Math.max(expectedEods, 1)}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {eods.length} / {expectedEods} expected · {setterRoster.length} setter{setterRoster.length !== 1 ? "s" : ""} on roster
            </div>
            {compliance < 90 && (
              <div className="flex items-center gap-1.5 mt-2 text-[13px] text-warning-fg">
                <AlertTriangle className="h-3.5 w-3.5" />
                <Link to="/sales" search={{ tab: "operations" }} className="underline hover:text-warning-fg">Send nudges →</Link>
              </div>
            )}
            {compliance >= 90 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-success-fg">
                <CheckCircle2 className="h-3.5 w-3.5" /> On track
              </div>
            )}
          </Quadrant>
        </div>
    </div>
  );
}

function Quadrant({ title, icon, to, search, children }: { title: string; icon: React.ReactNode; to: string; search?: Record<string, string>; children: React.ReactNode }) {
  return (
    <div className="card-surface p-4 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          {icon} {title}
        </div>
        <Link to={to} search={search} className="text-[12px] text-muted-foreground hover:text-foreground motion-safe:transition-colors">detail →</Link>
      </div>
      {children}
    </div>
  );
}

function FunnelStat({ label, value, suffix = "", color = "text-foreground" }: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-[20px] font-semibold tabular-nums ${color}`}>{value}{suffix}</div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * The month as a race: your cumulative cash vs the straight-line pace to the
 * goal (ghost dashed line). The dot is today; the caption says whether the
 * month lands ahead or behind at the current run rate.
 */
function GoalPaceChart({ deals, goal, mtdCash }: { deals: Deal[]; goal: number; mtdCash: number }) {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const data = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const d of deals) {
      const day = Number(d.deal_date.slice(8, 10));
      byDay.set(day, (byDay.get(day) ?? 0) + (Number(d.cash_collected_upfront) || 0));
    }
    let run = 0;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      if (day <= dayOfMonth) run += byDay.get(day) ?? 0;
      return {
        day,
        actual: day <= dayOfMonth ? run : null,
        pace: Math.round((goal * day) / daysInMonth),
      };
    });
  }, [deals, goal, dayOfMonth, daysInMonth]);

  const projected = dayOfMonth > 0 ? (mtdCash / dayOfMonth) * daysInMonth : 0;
  const ahead = projected >= goal;
  const pct = Math.min(999, Math.round((mtdCash / goal) * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-muted-foreground">Goal {money(goal)} · <span className={pct >= 100 ? "text-success-fg" : "text-foreground"}>{pct}%</span></span>
        <span className={ahead ? "text-success-fg" : "text-warning-fg"}>
          {ahead ? "▲" : "▽"} pace {money(Math.round(projected))}
        </span>
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="goalActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ahead ? "var(--chart-2)" : "var(--chart-5)"} stopOpacity={0.3} />
                <stop offset="100%" stopColor={ahead ? "var(--chart-2)" : "var(--chart-5)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" hide />
            <YAxis hide domain={[0, Math.max(goal, mtdCash) * 1.05]} />
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number, k: string) => [money(v), k === "actual" ? "collected" : "goal pace"]}
              labelFormatter={(d) => `Day ${d}`}
            />
            <Line type="monotone" dataKey="pace" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} strokeOpacity={0.5} />
            <Area type="monotone" dataKey="actual" stroke={ahead ? "var(--chart-2)" : "var(--chart-5)"} strokeWidth={2} fill="url(#goalActual)" connectNulls={false} isAnimationActive={false} />
            <ReferenceDot x={dayOfMonth} y={mtdCash} r={3.5} fill={ahead ? "var(--chart-2)" : "var(--chart-5)"} stroke="var(--card)" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        {ahead
          ? `At this run rate the month lands at ${money(Math.round(projected))} — ${money(Math.round(projected - goal))} over the goal.`
          : `At this run rate the month lands at ${money(Math.round(projected))} — ${money(Math.round(goal - projected))} short. The dashed line is the pace to hit it.`}
      </p>
    </div>
  );
}
