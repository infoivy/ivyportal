import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  money,
  startOfWeekMon,
  endOfWeekSun,
  isoDay,
} from "@/lib/revenue";
import { fetchCollectedCashByCloser } from "@/lib/collected-cash";
import { Card } from "@/components/ui/card";
import { Trophy, Zap } from "lucide-react";

/**
 * Weekly cash leaderboard (Mon–Sun of current week). COLLECTED cash only:
 * deal upfronts + installment payments that were actually PAID this week
 * (cofounder-directed 2026-07-27) — scheduled money and EOD self-reports
 * never count.
 */
export function CashLeaderboard({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<{ user_id: string; name: string; cash: number; closes: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = async () => {
    {
      const startISO = isoDay(startOfWeekMon(new Date()));
      const endISO = isoDay(endOfWeekSun(new Date()));

      const totals = await fetchCollectedCashByCloser(startISO, endISO);
      const userIds = Array.from(totals.keys());
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Unknown"]));
      return userIds.map((id) => ({
        user_id: id, name: nameMap.get(id) ?? "Unknown",
        cash: totals.get(id)!.cash, closes: totals.get(id)!.closes,
      })).sort((a, b) => b.cash - a.cash);
    }
  };
  const rowsQ = useQuery({ queryKey: ["page", "weekly-leaderboard"], queryFn: fetchRows });
  useEffect(() => {
    if (rowsQ.data) { setRows(rowsQ.data); setLoading(false); }
    else if (rowsQ.isError) { setRows([]); setLoading(false); }
  }, [rowsQ.data, rowsQ.isError]);

  return (
    <Card className={compact ? "p-4" : "p-5"}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning-fg" />
          <h3 className="text-sm font-semibold">Weekly cash leaderboard</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {isoDay(startOfWeekMon(new Date()))} → {isoDay(endOfWeekSun(new Date()))}
        </span>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No closes yet this week.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.slice(0, compact ? 5 : 10).map((r, i) => (
            <div
              key={r.user_id}
              className={
                "flex items-center gap-3 px-3 py-2 rounded-md border " +
                (i === 0
                  ? "border-warning/25 bg-warning-bg"
                  : "border-[var(--border)] bg-[var(--card)]")
              }
            >
              <div className={"text-xs w-5 " + (i === 0 ? "text-warning-fg" : "text-muted-foreground")}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-[10px] text-muted-foreground">{r.closes} close{r.closes === 1 ? "" : "s"}</div>
              </div>
              <div className="text-sm tabular-nums">{money(r.cash)}</div>
              {i === 0 && (
                <span
                  title="This week's top closer gets DOUBLE the closing-call bookings next week (Double Bookings SOP)"
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25"
                >
                  <Zap className="h-3 w-3" /> Top closer · 2× bookings next week
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
