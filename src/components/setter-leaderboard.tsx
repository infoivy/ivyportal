import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type Deal,
  type CommissionRates,
  DEFAULT_RATES,
  setterCommissionForDeal,
  money,
  startOfWeekMon,
  endOfWeekSun,
  isoDay,
} from "@/lib/revenue";
import { Card } from "@/components/ui/card";
import { Target } from "lucide-react";

/**
 * Weekly setter leaderboard (Mon–Sun of current week).
 * Ranks setters by attributed deal value and shows earned setter commission.
 */
export function SetterLeaderboard({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<
    { user_id: string; name: string; booked: number; deals: number; commission: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const startISO = isoDay(startOfWeekMon(new Date()));
        const endISO = isoDay(endOfWeekSun(new Date()));

        const [dealsRes, ratesRes] = await Promise.all([
          supabase.from("deals").select("*").not("setter_id", "is", null)
            .gte("deal_date", startISO).lte("deal_date", endISO),
          supabase.from("commission_rates").select("key, rate").eq("active", true),
        ]);

        const rates: CommissionRates = { ...DEFAULT_RATES };
        for (const r of ratesRes.data ?? []) {
          const k = r.key as keyof CommissionRates;
          if (k in rates) (rates as Record<string, number>)[k] = Number(r.rate);
        }

        const totals = new Map<string, { booked: number; deals: number; commission: number }>();
        for (const d of (dealsRes.data ?? []) as Deal[]) {
          if (!d.setter_id) continue;
          const cur = totals.get(d.setter_id) ?? { booked: 0, deals: 0, commission: 0 };
          cur.booked += Number(d.total_value) || 0;
          cur.deals += 1;
          cur.commission += setterCommissionForDeal(d, rates);
          totals.set(d.setter_id, cur);
        }

        const userIds = Array.from(totals.keys());
        if (userIds.length === 0) { setRows([]); return; }
        const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
        const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Unknown"]));
        setRows(userIds
          .map((id) => ({ user_id: id, name: nameMap.get(id) ?? "Unknown", ...totals.get(id)! }))
          .sort((a, b) => b.booked - a.booked));
      } catch (e) {
        console.error("SetterLeaderboard load failed", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className={compact ? "p-4" : "p-5"}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-semibold">Weekly setter leaderboard</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {isoDay(startOfWeekMon(new Date()))} → {isoDay(endOfWeekSun(new Date()))}
        </span>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No setter-attributed closes this week.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.slice(0, compact ? 5 : 10).map((r, i) => (
            <div
              key={r.user_id}
              className={
                "flex items-center gap-3 px-3 py-2 rounded-md border " +
                (i === 0 ? "border-sky-500/30 bg-sky-500/5" : "border-[var(--border)] bg-[var(--card)]")
              }
            >
              <div className={"text-xs font-mono w-5 " + (i === 0 ? "text-sky-400" : "text-muted-foreground")}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {r.deals} set close{r.deals === 1 ? "" : "s"} · {money(r.booked)} booked
                </div>
              </div>
              <div className="text-sm font-mono tabular-nums text-emerald-400">{money(r.commission)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
