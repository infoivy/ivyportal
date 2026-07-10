import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, DollarSign, TrendingUp, BarChart3, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { money, type Deal, startOfWeekMon, isoDay } from "@/lib/revenue";

export const Route = createFileRoute("/_authenticated/founder-hq")({
  head: () => ({ meta: [{ title: "Founder HQ — ISA Portal" }] }),
  component: FounderHQ,
});

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function FounderHQ() {
  const { roles } = useAuth();
  const canView = roles.includes("admin") || roles.includes("founder");

  if (!canView) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-border bg-card rounded-sm p-8 text-center text-sm text-muted-foreground">
          Founder or admin access required.
        </div>
      </div>
    );
  }

  return <FounderHQInner />;
}

function FounderHQInner() {
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
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [dealsRes, eodsRes, roleRes, contentRes, settingsRes] = await Promise.all([
      supabase.from("deals").select("id, closer_id, setter_id, total_value, cash_collected_upfront, deal_date, payment_type").gte("deal_date", monthStart),
      supabase.from("eods").select("user_id, report_date, calls_booked, shows, no_shows").gte("report_date", weekStart).lte("report_date", weekEnd),
      supabase.from("user_roles").select("user_id").eq("role", "setter"),
      supabase.from("content_items").select("scheduled_date, status").gte("scheduled_date", cycleStartStr).lte("scheduled_date", cycleEndStr),
      supabase.from("founder_settings").select("monthly_cash_goal").maybeSingle(),
    ]);
    setDeals((dealsRes.data ?? []) as Deal[]);
    setEods((eodsRes.data ?? []) as any[]);
    setSetterRoster(Array.from(new Set(((roleRes.data ?? []) as any[]).map((r: any) => r.user_id))));
    setContentItems((contentRes.data ?? []) as any[]);
    setMonthlyGoal((settingsRes.data as any)?.monthly_cash_goal ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
      <div className="dashboard-dark min-h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="dashboard-dark min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Abdulrahman</div>
          <h1 className="text-lg font-bold">Founder HQ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Command view — cash, funnel, content, team.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Quadrant 1: Cash */}
          <Quadrant title="Cash" icon={<DollarSign className="h-4 w-4 text-green-400" />} to="/revenue">
            <div className="text-3xl font-bold text-green-400">{money(mtdCash)}</div>
            <div className="text-xs text-muted-foreground">MTD cash collected</div>
            {monthlyGoal && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Goal: {money(monthlyGoal)}</span>
                  <span className={goalPct! >= 100 ? "text-green-400" : "text-muted-foreground"}>{goalPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${goalPct! >= 100 ? "bg-green-500" : goalPct! >= 60 ? "bg-amber-400" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, goalPct!)}%` }}
                  />
                </div>
              </div>
            )}
            {!monthlyGoal && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Set a monthly goal in <Link to="/admin" className="underline hover:text-foreground">Admin settings</Link>.
              </p>
            )}
            <div className="text-xs text-muted-foreground mt-2">{deals.length} deal{deals.length !== 1 ? "s" : ""} closed MTD</div>
          </Quadrant>

          {/* Quadrant 2: Funnel */}
          <Quadrant title="Funnel this week" icon={<TrendingUp className="h-4 w-4 text-sky-400" />} to="/eods">
            <div className="grid grid-cols-4 gap-2 mt-1">
              <FunnelStat label="Sets" value={weekSets} />
              <FunnelStat label="Shows" value={weekShows} />
              <FunnelStat label="Closes" value={weekCloses} />
              <FunnelStat label="Show %" value={showRate} suffix="%" color={showRate >= 70 ? "text-green-400" : showRate >= 50 ? "text-amber-400" : "text-red-400"} />
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Show rate:</span>
              <span className={showRate >= 70 ? "text-green-400 font-semibold" : showRate >= 50 ? "text-amber-400 font-semibold" : "text-red-400 font-semibold"}>{showRate}%</span>
              <span className="text-muted-foreground">Close rate:</span>
              <span className={closeRate >= 30 ? "text-green-400 font-semibold" : closeRate >= 15 ? "text-amber-400 font-semibold" : "text-red-400 font-semibold"}>{closeRate}%</span>
            </div>
          </Quadrant>

          {/* Quadrant 3: Content */}
          <Quadrant title="Content pipeline" icon={<BarChart3 className="h-4 w-4 text-blue-400" />} to="/founder">
            {contentTotal === 0 ? (
              <div className="text-xs text-muted-foreground mt-1">No content scheduled for this 2-week cycle ({cycleStartStr} – {cycleEndStr}).</div>
            ) : (
              <div className="grid grid-cols-4 gap-2 mt-1">
                <FunnelStat label="Total" value={contentTotal} />
                <FunnelStat label="Scripted" value={contentScripted} color={contentScripted >= contentTotal ? "text-green-400" : "text-amber-400"} />
                <FunnelStat label="Recorded" value={contentRecorded} color={contentRecorded >= contentTotal ? "text-green-400" : "text-amber-400"} />
                <FunnelStat label="Posted" value={contentPosted} color={contentPosted >= contentTotal ? "text-green-400" : "text-amber-400"} />
              </div>
            )}
            <div className="text-[10px] text-muted-foreground mt-2">Cycle: {cycleStartStr} → {cycleEndStr}</div>
          </Quadrant>

          {/* Quadrant 4: Team compliance */}
          <Quadrant title="Team compliance" icon={<Users className="h-4 w-4 text-amber-400" />} to="/sales-hq">
            <div className="flex items-end gap-2 mt-1">
              <div className={`text-3xl font-bold ${compliance >= 90 ? "text-green-400" : compliance >= 70 ? "text-amber-400" : "text-red-400"}`}>{compliance}%</div>
              <div className="text-xs text-muted-foreground mb-1">EOD submission rate this week</div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all ${compliance >= 90 ? "bg-green-500" : compliance >= 70 ? "bg-amber-400" : "bg-red-500"}`}
                style={{ width: `${compliance}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {eods.length} EODs filed / {expectedEods} expected · {setterRoster.length} setter{setterRoster.length !== 1 ? "s" : ""} on roster
            </div>
            {compliance < 90 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <Link to="/sales-hq" className="underline hover:text-amber-300">Send nudges →</Link>
              </div>
            )}
            {compliance >= 90 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> On track
              </div>
            )}
          </Quadrant>
        </div>
      </div>
    </div>
  );
}

function Quadrant({ title, icon, to, children }: { title: string; icon: React.ReactNode; to: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-1 relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
          {icon} {title}
        </div>
        <Link to={to} className="text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted">detail →</Link>
      </div>
      {children}
    </div>
  );
}

function FunnelStat({ label, value, suffix = "", color = "text-foreground" }: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>{value}{suffix}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
