import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type Deal,
  money,
  startOfWeekMon,
  endOfWeekSun,
  isoDay,
} from "@/lib/revenue";
import { Card } from "@/components/ui/card";
import { Trophy, Zap } from "lucide-react";

/**
 * Weekly cash leaderboard (Mon–Sun of current week).
 * Combines deals.cash_collected_upfront + eods.cash_collected per closer.
 * Top closer flagged "Double bookings eligible".
 */
export function CashLeaderboard({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<{ user_id: string; name: string; cash: number; closes: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const startISO = isoDay(startOfWeekMon(new Date()));
      const endISO = isoDay(endOfWeekSun(new Date()));

      const [dealsRes, eodsRes] = await Promise.all([
        supabase.from("deals").select("closer_id, cash_collected_upfront, deal_date")
          .gte("deal_date", startISO).lte("deal_date", endISO),
        supabase.from("eods").select("user_id, cash_collected, closes, report_date")
          .gte("report_date", startISO).lte("report_date", endISO),
      ]);

      const totals = new Map<string, { cash: number; closes: number }>();
      for (const d of (dealsRes.data ?? []) as Deal[]) {
        const cur = totals.get(d.closer_id) ?? { cash: 0, closes: 0 };
        cur.cash += Number(d.cash_collected_upfront) || 0;
        cur.closes += 1;
        totals.set(d.closer_id, cur);
      }
      for (const e of eodsRes.data ?? []) {
        const key = e.user_id as string;
        const cur = totals.get(key) ?? { cash: 0, closes: 0 };
        cur.cash += Number(e.cash_collected) || 0;
        totals.set(key, cur);
      }

      const userIds = Array.from(totals.keys());
      if (userIds.length === 0) { setRows([]); return; }
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Unknown"]));
      setRows(userIds.map((id) => ({
        user_id: id, name: nameMap.get(id) ?? "Unknown",
        cash: totals.get(id)!.cash, closes: totals.get(id)!.closes,
      })).sort((a, b) => b.cash - a.cash));
    } catch (e) {
      console.error("CashLeaderboard load failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <Card className={compact ? "p-4" : "p-5"}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
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
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-[#1f2530] bg-[#0f1116]")
              }
            >
              <div className={"text-xs font-mono w-5 " + (i === 0 ? "text-amber-400" : "text-muted-foreground")}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-[10px] text-muted-foreground">{r.closes} close{r.closes === 1 ? "" : "s"}</div>
              </div>
              <div className="text-sm font-mono tabular-nums">{money(r.cash)}</div>
              {i === 0 && (
                <span
                  title="Top closer this week — eligible for double bookings next week per the Double Bookings SOP"
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                >
                  <Zap className="h-3 w-3" /> 2× bookings
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
