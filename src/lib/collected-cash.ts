import { supabase } from "@/integrations/supabase/client";

/**
 * Collected cash per closer for a window — the ONLY definition leaderboards
 * may use (cofounder-directed 2026-07-27):
 *   · deals.cash_collected_upfront for deals CLOSED in the window
 *     (money that hit at the close: PIF or deposit)
 *   · installment payments PAID in the window (money that hit on schedule),
 *     attributed to the plan's closer
 * Scheduled/upcoming money never counts. EOD-reported cash never counts —
 * it duplicates the same dollars a second time.
 */
export async function fetchCollectedCashByCloser(startISO: string, endISO: string) {
  const [dealsRes, paidRes] = await Promise.all([
    supabase.from("deals")
      .select("closer_id, cash_collected_upfront, deal_date")
      .eq("is_demo", false)
      .gte("deal_date", startISO).lte("deal_date", endISO),
    supabase.from("installment_payments")
      .select("amount, paid_at, installments!inner(closer_id, students!inner(is_demo))")
      .eq("installments.students.is_demo", false)
      .eq("status", "paid")
      .gte("paid_at", `${startISO}T00:00:00Z`)
      .lte("paid_at", `${endISO}T23:59:59Z`),
  ]);

  const totals = new Map<string, { cash: number; closes: number; collectedLater: number }>();
  const bump = (id: string | null) => {
    if (!id) return null;
    const cur = totals.get(id) ?? { cash: 0, closes: 0, collectedLater: 0 };
    totals.set(id, cur);
    return cur;
  };

  for (const d of (dealsRes.data ?? []) as { closer_id: string; cash_collected_upfront: number }[]) {
    const cur = bump(d.closer_id);
    if (!cur) continue;
    cur.cash += Number(d.cash_collected_upfront) || 0;
    cur.closes += 1;
  }
  for (const p of (paidRes.data ?? []) as unknown as { amount: number; installments: { closer_id: string | null } }[]) {
    const cur = bump(p.installments?.closer_id ?? null);
    if (!cur) continue;
    const amt = Number(p.amount) || 0;
    cur.cash += amt;
    cur.collectedLater += amt;
  }
  return totals;
}
