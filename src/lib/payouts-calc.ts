/**
 * Co-founder closing rule (founder-confirmed 2026-07-12; cap corrected by
 * the founder 2026-08-06): Abu Bilal and Faizan earn a flat 10% when they
 * close — even set+close — capped at $1,000 per semi-monthly payout period
 * (1st–15th and 16th–end) and $2,000 per calendar month.
 */
export const COFOUNDER_RATE = 0.10;
export const COFOUNDER_PERIOD_CAP = 1000;
export const COFOUNDER_MONTH_CAP = 2000;

export type CommissionEvent = { date: string; cash: number };

export type CappedResult = {
  total: number;
  firstHalf: number; // paid in the 1st–15th payout
  secondHalf: number; // paid in the 16th–end payout
  raw: number;
  capped: boolean;
};

/** Apply the per-period + monthly caps chronologically over one calendar month. */
export function cofounderCappedCommission(events: CommissionEvent[]): CappedResult {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  let monthUsed = 0;
  let firstHalf = 0;
  let secondHalf = 0;
  let raw = 0;
  for (const ev of sorted) {
    const r = ev.cash * COFOUNDER_RATE;
    raw += r;
    const inFirstHalf = Number(ev.date.slice(8, 10)) <= 15;
    const periodUsed = inFirstHalf ? firstHalf : secondHalf;
    const granted = Math.max(0, Math.min(r, COFOUNDER_PERIOD_CAP - periodUsed, COFOUNDER_MONTH_CAP - monthUsed));
    monthUsed += granted;
    if (inFirstHalf) firstHalf += granted;
    else secondHalf += granted;
  }
  return { total: monthUsed, firstHalf, secondHalf, raw, capped: monthUsed < raw };
}
