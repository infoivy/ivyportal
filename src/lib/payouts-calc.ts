import {
  type Deal, type CommissionRates, commissionForDeal, setterWeekBonusIds,
  isSelfSet, startOfWeekMon, isoDay,
} from "@/lib/revenue";

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

type InstallmentPayment = { amount: number; paid_at: string | null; installment_id: string };
type Installment = { id: string; setter_id: string | null; closer_id: string | null };
type ProfileLite = { id: string; commission_cap_pct?: number | null; base_pay_monthly?: number | null };

export type MonthPayoutsInput = {
  deals: Deal[]; // whole calendar month
  installmentPayments: InstallmentPayment[]; // paid within the month
  installments: Installment[];
  profiles: ProfileLite[];
  rates: CommissionRates;
  cofounderIds: Set<string>;
};

export type MonthPayouts = {
  setterCommission: number;
  closerCommission: number;
  basePay: number;
  total: number;
};

/**
 * One month of payouts — the number Finance subtracts before profit.
 * Mirrors the Payout Ledger: setter base (+$5k-week bonus), closer 10%/15%
 * with per-profile caps, co-founder flat-10% with weekly/monthly caps, and
 * monthly base pay.
 */
export function calcMonthPayouts(i: MonthPayoutsInput): MonthPayouts {
  const instById = new Map(i.installments.map((x) => [x.id, x]));
  const profById = new Map(i.profiles.map((p) => [p.id, p]));

  // Setters — base rate (+1% for a $5k Mon–Sun week), on upfront + installment cash
  const weekBonus = setterWeekBonusIds(i.deals);
  let setterCommission = 0;
  const setterCash = new Map<string, number>();
  for (const d of i.deals) {
    if (!d.setter_id || isSelfSet(d)) continue;
    setterCash.set(d.setter_id, (setterCash.get(d.setter_id) ?? 0) + (d.cash_collected_upfront ?? 0));
  }
  for (const ip of i.installmentPayments) {
    const inst = instById.get(ip.installment_id);
    if (!inst?.setter_id || inst.setter_id === inst.closer_id) continue;
    setterCash.set(inst.setter_id, (setterCash.get(inst.setter_id) ?? 0) + Number(ip.amount));
  }
  for (const [sid, cash] of setterCash) {
    setterCommission += cash * (i.rates.setter_base + (weekBonus.has(sid) ? 0.01 : 0));
  }

  // Closers — co-founders get the capped flat rate; everyone else the normal rules
  let closerCommission = 0;
  const cofounderEvents = new Map<string, CommissionEvent[]>();
  const pushEvent = (cid: string, date: string, cash: number) => {
    const arr = cofounderEvents.get(cid) ?? [];
    arr.push({ date, cash });
    cofounderEvents.set(cid, arr);
  };
  for (const d of i.deals) {
    if (!d.closer_id) continue;
    if (i.cofounderIds.has(d.closer_id)) pushEvent(d.closer_id, d.deal_date, d.cash_collected_upfront ?? 0);
    else closerCommission += commissionForDeal(d, i.rates, profById.get(d.closer_id)?.commission_cap_pct);
  }
  for (const ip of i.installmentPayments) {
    const inst = instById.get(ip.installment_id);
    if (!inst?.closer_id || !ip.paid_at) continue;
    if (i.cofounderIds.has(inst.closer_id)) {
      pushEvent(inst.closer_id, ip.paid_at.slice(0, 10), Number(ip.amount));
    } else {
      const p = profById.get(inst.closer_id);
      const base = inst.setter_id && inst.setter_id === inst.closer_id ? i.rates.set_close : i.rates.new_close;
      const rate = p?.commission_cap_pct != null ? Math.min(base, p.commission_cap_pct) : base;
      closerCommission += Number(ip.amount) * rate;
    }
  }
  for (const events of cofounderEvents.values()) {
    closerCommission += cofounderCappedCommission(events).total;
  }

  const basePay = i.profiles.reduce((a, p) => a + (Number(p.base_pay_monthly) || 0), 0);
  return {
    setterCommission,
    closerCommission,
    basePay,
    total: setterCommission + closerCommission + basePay,
  };
}
