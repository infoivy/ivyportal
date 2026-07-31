import { startOfWeekMon, isoDay } from "@/lib/revenue";

/**
 * Co-founder closing rule (founder-confirmed 2026-07-12): Abu Bilal and
 * Faizan earn a flat 10% when they close — even set+close — capped at
 * $1,000 per Mon–Sun week and $2,000 per calendar month, paid across the
 * two semi-monthly payouts.
 */
export const COFOUNDER_RATE = 0.10;
export const COFOUNDER_WEEK_CAP = 1000;
export const COFOUNDER_MONTH_CAP = 2000;

export type CommissionEvent = { date: string; cash: number };

export type CappedResult = {
  total: number;
  firstHalf: number; // paid in the 1st–15th payout
  secondHalf: number; // paid in the 16th–end payout
  raw: number;
  capped: boolean;
};

/** Apply the weekly + monthly caps chronologically over one calendar month. */
export function cofounderCappedCommission(events: CommissionEvent[]): CappedResult {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const weekUsed = new Map<string, number>();
  let monthUsed = 0;
  let firstHalf = 0;
  let secondHalf = 0;
  let raw = 0;
  for (const ev of sorted) {
    const r = ev.cash * COFOUNDER_RATE;
    raw += r;
    const wk = isoDay(startOfWeekMon(new Date(ev.date + "T00:00:00")));
    const w = weekUsed.get(wk) ?? 0;
    const granted = Math.max(0, Math.min(r, COFOUNDER_WEEK_CAP - w, COFOUNDER_MONTH_CAP - monthUsed));
    weekUsed.set(wk, w + granted);
    monthUsed += granted;
    if (Number(ev.date.slice(8, 10)) <= 15) firstHalf += granted;
    else secondHalf += granted;
  }
  return { total: monthUsed, firstHalf, secondHalf, raw, capped: monthUsed < raw };
}
