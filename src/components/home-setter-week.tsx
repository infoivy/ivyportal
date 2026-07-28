import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { CalendarCheck2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dayStatus, outreachOf, type EodKpiRow, type SetterType } from "@/lib/eod-kpi";
import { computeStreak } from "@/lib/streak";
import { todayLocal } from "@/lib/dates";

type ActivityRow = {
  user_id: string;
  report_date: string;
  dials: number | null;
  dms_sent: number | null;
  leads_contacted: number | null;
  calls_booked: number | null;
};

type PoolProfile = {
  id: string;
  display_name: string | null;
  setter_type: string | null;
  active: boolean | null;
};

const CHIP_CLS: Record<"green" | "amber" | "red" | "pending", string> = {
  green:   "border-success/25 bg-success-bg text-success-fg",
  amber:   "border-warning/25 bg-warning-bg text-warning-fg",
  red:     "border-danger/25 bg-danger-bg text-danger-fg",
  pending: "border-dashed border-border bg-muted/40 text-muted-foreground",
};

/**
 * The setter's home: their own seven days, streak, and standing — replacing
 * the team blocks (founder 2026-07-28: the EOD is filed at day's END, so
 * "submitted yet?" is useless as morning info; show the week instead).
 * KPI colors share src/lib/eod-kpi.ts with the Performance Team week cards.
 */
export function HomeSetterWeek({ userId, setterType, activities, profiles }: {
  userId: string;
  setterType: SetterType;
  activities: ActivityRow[];
  profiles: PoolProfile[];
}) {
  const today = todayLocal();

  // Streak wants more history than the home feed carries; own rows only.
  const streakQ = useQuery({
    queryKey: ["page", "home", "setter-streak", userId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eods_activity_real")
        .select("report_date")
        .eq("user_id", userId)
        .gte("report_date", format(subDays(new Date(), 90), "yyyy-MM-dd"));
      if (error) throw new Error(error.message);
      return (data ?? []).map(r => r.report_date as string);
    },
  });
  const streak = computeStreak(streakQ.data ?? []);

  const week = useMemo(() => {
    const own = new Map<string, ActivityRow>();
    for (const row of activities) {
      if (row.user_id === userId) own.set(row.report_date, row);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
      const row = own.get(date);
      const status: keyof typeof CHIP_CLS = row
        ? dayStatus(row as EodKpiRow, setterType)
        : date === today ? "pending" : "red";
      return { date, row, status };
    });
  }, [activities, userId, setterType, today]);

  const totals = useMemo(() => {
    let dials = 0, dms = 0, sets = 0;
    for (const day of week) {
      if (!day.row) continue;
      dials += day.row.dials ?? 0;
      dms += outreachOf(day.row as EodKpiRow);
      sets += day.row.calls_booked ?? 0;
    }
    return { dials, dms, sets };
  }, [week]);

  const standing = useMemo(() => {
    const pool = profiles.filter(p => p.setter_type && p.active !== false);
    if (!pool.some(p => p.id === userId)) return null;
    const from = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const setsBy = new Map<string, number>(pool.map(p => [p.id, 0]));
    for (const row of activities) {
      if (row.report_date < from || !setsBy.has(row.user_id)) continue;
      setsBy.set(row.user_id, (setsBy.get(row.user_id) ?? 0) + (row.calls_booked ?? 0));
    }
    const ranked = [...setsBy.entries()].sort((a, b) => b[1] - a[1]);
    const rank = ranked.findIndex(([id]) => id === userId) + 1;
    return pool.length > 1 ? { rank, of: pool.length } : null;
  }, [activities, profiles, userId]);

  return (
    <>
      <section className="card-surface p-5" aria-labelledby="my-week-title">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarCheck2 className="h-4 w-4" />
          <p className="text-micro font-semibold uppercase tracking-[0.1em]">Personal</p>
        </div>
        <h2 id="my-week-title" className="mt-2 text-title font-semibold text-foreground">My week</h2>
        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {week.map(day => (
            <div key={day.date} className="text-center">
              <div className="text-micro text-muted-foreground">{format(new Date(`${day.date}T12:00:00`), "EEEEE")}</div>
              <div
                className={`mt-1 grid h-9 place-items-center rounded-md border text-caption font-medium tabular-nums ${CHIP_CLS[day.status]}`}
                title={
                  day.status === "pending" ? "Today · file your EOD at day's end"
                  : day.status === "red" ? "No EOD submitted"
                  : day.status === "green" ? "KPI hit"
                  : "Submitted · KPI missed"
                }
              >
                {Number(day.date.slice(8, 10))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Flame className={`h-3.5 w-3.5 ${streak > 0 ? "text-warning-fg" : ""}`} />
            {streak > 0 ? `${streak} day streak` : "No active streak"}
          </span>
          {standing && (
            <span>#{standing.rank} of {standing.of} by sets this week</span>
          )}
        </div>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link to="/eods">Open EOD</Link>
        </Button>
      </section>

      <section className="card-surface p-5" aria-labelledby="my-7d-title">
        <h2 id="my-7d-title" className="text-title font-semibold text-foreground">My last 7 days</h2>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-micro text-muted-foreground">Dials</dt>
            <dd className="mt-1 text-body font-semibold tabular-nums text-foreground">{totals.dials.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-micro text-muted-foreground">DMs</dt>
            <dd className="mt-1 text-body font-semibold tabular-nums text-foreground">{totals.dms.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-micro text-muted-foreground">Sets</dt>
            <dd className="mt-1 text-body font-semibold tabular-nums text-foreground">{totals.sets.toLocaleString()}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
