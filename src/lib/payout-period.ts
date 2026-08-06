import { type Deal, type CommissionRates, commissionForDeal, setterWeekBonusIds, isSelfSet } from "@/lib/revenue";
import { cofounderCappedCommission, type CommissionEvent, COFOUNDER_RATE, COFOUNDER_PERIOD_CAP, COFOUNDER_MONTH_CAP } from "@/lib/payouts-calc";

// Pay periods: semi-monthly halves — 1st–15th and 16th–end of month.
// Commissions are paid twice a month (founder-confirmed 2026-07-12);
// monthly base pay is paid alongside the second half.
export function getPeriod(offset = 0) {
  const now = new Date();
  // Index halves absolutely: monthIndex * 2 + (0 for 1st–15th, 1 for 16th–end)
  const half = (now.getFullYear() * 12 + now.getMonth()) * 2 + (now.getDate() <= 15 ? 0 : 1) + offset;
  const monthAbs = Math.floor(half / 2);
  const y = Math.floor(monthAbs / 12);
  const m = monthAbs % 12;
  const second = half % 2 !== 0;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const startD = second ? 16 : 1;
  const endD = second ? lastDay : 15;
  const monthLabel = new Date(y, m, 1).toLocaleString("default", { month: "short", year: "numeric" });
  return {
    start: `${y}-${pad(m + 1)}-${pad(startD)}`,
    end: `${y}-${pad(m + 1)}-${pad(endD)}`,
    monthStart: `${y}-${pad(m + 1)}-01`,
    monthEnd: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
    label: `${monthLabel.split(" ")[0]} ${startD}–${endD}, ${y}`,
    isSecondHalf: second,
  };
}

export type PayoutPeriod = ReturnType<typeof getPeriod>;

export type PayoutProfile = { id: string; display_name: string; commission_cap_pct?: number | null; base_pay_monthly?: number | null; base_pay_day?: number | null; started_on?: string | null };

export type PayoutInstallmentPayment = {
  id: string;
  amount: number;
  paid_at: string | null;
  installment_id: string;
};

export type PayoutInstallment = {
  id: string;
  setter_id: string | null;
  closer_id: string | null;
  student_name: string;
};

export type PayoutLine = {
  kind: "deal" | "installment" | "adjustment";
  refId: string;
  student: string;
  date: string;
  detail: string;
  cash: number;
  rate: number | null;
  commission: number | null;
};

export type PayoutAdjustment = {
  id: string;
  user_id: string;
  period_start: string;
  amount: number;
  note: string;
  created_at: string;
};

export type SetterRow = {
  id: string;
  name: string;
  deals: number;
  cash: number;
  commission: number;
  weekBonus: boolean;
  installmentCash: number;
  installmentCommission: number;
  total: number;
  lines: PayoutLine[];
};

export type CloserRow = {
  id: string;
  name: string;
  deals: number;
  cash: number;
  commission: number;
  installmentCash: number;
  installmentCommission: number;
  total: number;
  capNote?: string;
  lines: PayoutLine[];
};

export type PayoutData = {
  deals: Deal[];
  installmentPayments: PayoutInstallmentPayment[];
  installments: PayoutInstallment[];
  profileMap: Map<string, PayoutProfile>;
  rates: CommissionRates;
  cofounderIds: Set<string>;
};

/**
 * The one payout computation. `data` spans the whole calendar month (the
 * co-founder caps need both halves); rows are scoped to `period`. Extracted
 * from the Payouts page so the confirmation banner/bell compute the exact
 * same numbers the ledger shows.
 */
export function buildPayoutRows(data: PayoutData, period: Pick<PayoutPeriod, "start" | "end" | "isSecondHalf">) {
  const { deals, installmentPayments, installments, profileMap, rates, cofounderIds } = data;
  const installmentMap = new Map<string, PayoutInstallment>();
  for (const i of installments) installmentMap.set(i.id, i);

  const periodDeals = deals.filter((d) => d.deal_date >= period.start && d.deal_date <= period.end);
  const periodPayments = installmentPayments.filter((ip) => {
    const day = (ip.paid_at ?? "").slice(0, 10);
    return day >= period.start && day <= period.end;
  });

  // Setter rows
  const weekBonusIds = setterWeekBonusIds(periodDeals);
  const setterMap = new Map<string, { deals: Deal[]; weekBonus: boolean }>();
  for (const d of periodDeals) {
    if (!d.setter_id || isSelfSet(d)) continue; // self-set = closer's 15%, no setter credit
    const entry = setterMap.get(d.setter_id) ?? { deals: [], weekBonus: false };
    entry.deals.push(d);
    if (weekBonusIds.has(d.setter_id)) entry.weekBonus = true;
    setterMap.set(d.setter_id, entry);
  }
  const setterInstCash = new Map<string, number>();
  const setterInstPays = new Map<string, { ip: PayoutInstallmentPayment; inst: PayoutInstallment }[]>();
  for (const ip of periodPayments) {
    const inst = installmentMap.get(ip.installment_id);
    if (!inst?.setter_id || inst.setter_id === inst.closer_id) continue;
    setterInstCash.set(inst.setter_id, (setterInstCash.get(inst.setter_id) ?? 0) + ip.amount);
    setterInstPays.set(inst.setter_id, [...(setterInstPays.get(inst.setter_id) ?? []), { ip, inst }]);
  }
  const allSetterIds = new Set([...setterMap.keys(), ...setterInstCash.keys()]);
  const setterRows: SetterRow[] = Array.from(allSetterIds).map(sid => {
    const entry = setterMap.get(sid);
    const dealsCash = entry?.deals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0) ?? 0;
    const baseRate = rates.setter_base + (entry?.weekBonus ? 0.01 : 0);
    const dealCommission = dealsCash * baseRate;
    const iCash = setterInstCash.get(sid) ?? 0;
    const iCommission = iCash * baseRate;
    const lines: PayoutLine[] = [
      ...(entry?.deals ?? []).map((d): PayoutLine => ({
        kind: "deal",
        refId: d.id,
        student: (d as { student_name?: string }).student_name ?? "Deal",
        date: d.deal_date,
        detail: "deal upfront",
        cash: d.cash_collected_upfront ?? 0,
        rate: baseRate,
        commission: (d.cash_collected_upfront ?? 0) * baseRate,
      })),
      ...(setterInstPays.get(sid) ?? []).map(({ ip, inst }): PayoutLine => ({
        kind: "installment",
        refId: ip.id,
        student: (inst as { student_name?: string }).student_name ?? "Installment",
        date: (ip.paid_at ?? "").slice(0, 10),
        detail: "installment marked paid",
        cash: ip.amount,
        rate: baseRate,
        commission: ip.amount * baseRate,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return {
      id: sid,
      name: profileMap.get(sid)?.display_name ?? sid.slice(0, 8),
      deals: entry?.deals.length ?? 0,
      cash: dealsCash,
      commission: dealCommission,
      weekBonus: entry?.weekBonus ?? false,
      installmentCash: iCash,
      installmentCommission: iCommission,
      total: dealCommission + iCommission,
      lines,
    };
  }).sort((a, b) => b.total - a.total);

  // Closer rows
  const closerMap = new Map<string, Deal[]>();
  for (const d of periodDeals) {
    if (!d.closer_id) continue;
    const entry = closerMap.get(d.closer_id) ?? [];
    entry.push(d);
    closerMap.set(d.closer_id, entry);
  }
  const closerInstCash = new Map<string, number>();
  const closerInstPays = new Map<string, { ip: PayoutInstallmentPayment; inst: PayoutInstallment }[]>();
  const instSetSet = new Map<string, boolean>(); // closer_id → self-set installment this period (set+close rate)
  for (const ip of periodPayments) {
    const inst = installmentMap.get(ip.installment_id);
    if (!inst?.closer_id) continue;
    closerInstCash.set(inst.closer_id, (closerInstCash.get(inst.closer_id) ?? 0) + ip.amount);
    closerInstPays.set(inst.closer_id, [...(closerInstPays.get(inst.closer_id) ?? []), { ip, inst }]);
    if (inst.setter_id && inst.setter_id === inst.closer_id) instSetSet.set(inst.closer_id, true);
  }

  // Co-founders: flat 10% with $1k/week + $2k/month caps, computed over the
  // whole month so each period shows its true slice.
  const cofounderMonthEvents = new Map<string, CommissionEvent[]>();
  for (const d of deals) {
    if (!d.closer_id || !cofounderIds.has(d.closer_id)) continue;
    const arr = cofounderMonthEvents.get(d.closer_id) ?? [];
    arr.push({ date: d.deal_date, cash: d.cash_collected_upfront ?? 0 });
    cofounderMonthEvents.set(d.closer_id, arr);
  }
  for (const ip of installmentPayments) {
    const inst = installmentMap.get(ip.installment_id);
    if (!inst?.closer_id || !cofounderIds.has(inst.closer_id) || !ip.paid_at) continue;
    const arr = cofounderMonthEvents.get(inst.closer_id) ?? [];
    arr.push({ date: ip.paid_at.slice(0, 10), cash: ip.amount });
    cofounderMonthEvents.set(inst.closer_id, arr);
  }

  const allCloserIds = new Set([...closerMap.keys(), ...closerInstCash.keys()]);
  const closerRows: CloserRow[] = Array.from(allCloserIds).map(cid => {
    const profile = profileMap.get(cid);
    const cDeals = closerMap.get(cid) ?? [];
    const dealsCash = cDeals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0);
    const iCash = closerInstCash.get(cid) ?? 0;

    if (cofounderIds.has(cid)) {
      const capped = cofounderCappedCommission(cofounderMonthEvents.get(cid) ?? []);
      const owed = period.isSecondHalf ? capped.secondHalf : capped.firstHalf;
      const cofLines: PayoutLine[] = [
        ...cDeals.map((d): PayoutLine => ({
          kind: "deal", refId: d.id,
          student: (d as { student_name?: string }).student_name ?? "Deal",
          date: d.deal_date, detail: "deal upfront",
          cash: d.cash_collected_upfront ?? 0, rate: COFOUNDER_RATE, commission: null,
        })),
        ...(closerInstPays.get(cid) ?? []).map(({ ip, inst }): PayoutLine => ({
          kind: "installment", refId: ip.id,
          student: (inst as { student_name?: string }).student_name ?? "Installment",
          date: (ip.paid_at ?? "").slice(0, 10), detail: "installment marked paid",
          cash: ip.amount, rate: COFOUNDER_RATE, commission: null,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      return {
        id: cid,
        name: profileMap.get(cid)?.display_name ?? cid.slice(0, 8),
        deals: cDeals.length,
        cash: dealsCash,
        commission: owed,
        installmentCash: iCash,
        installmentCommission: 0,
        total: owed,
        capNote: `co-founder · ${(COFOUNDER_RATE * 100).toFixed(0)}% flat · capped $${COFOUNDER_PERIOD_CAP / 1000}k per payout period · $${COFOUNDER_MONTH_CAP / 1000}k/mo${capped.capped ? " · cap hit" : ""}`,
        lines: cofLines,
      };
    }

    const dealCommission = cDeals.reduce((s, d) => s + commissionForDeal(d, rates, profile?.commission_cap_pct), 0);
    // Use set_close for installments where a setter was involved, cap applies
    const iBaseRate = instSetSet.get(cid) ? rates.set_close : rates.new_close;
    const iRate = profile?.commission_cap_pct != null ? Math.min(iBaseRate, profile.commission_cap_pct) : iBaseRate;
    const iCommission = iCash * iRate;
    const closerLines: PayoutLine[] = [
      ...cDeals.map((d): PayoutLine => {
        const comm = commissionForDeal(d, rates, profile?.commission_cap_pct);
        const cash = d.cash_collected_upfront ?? 0;
        return {
          kind: "deal", refId: d.id,
          student: (d as { student_name?: string }).student_name ?? "Deal",
          date: d.deal_date,
          detail: isSelfSet(d) ? "deal upfront · set + close" : "deal upfront",
          cash, rate: cash > 0 ? comm / cash : null, commission: comm,
        };
      }),
      ...(closerInstPays.get(cid) ?? []).map(({ ip, inst }): PayoutLine => ({
        kind: "installment", refId: ip.id,
        student: (inst as { student_name?: string }).student_name ?? "Installment",
        date: (ip.paid_at ?? "").slice(0, 10), detail: "installment marked paid",
        cash: ip.amount, rate: iRate, commission: ip.amount * iRate,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return {
      id: cid,
      name: profileMap.get(cid)?.display_name ?? cid.slice(0, 8),
      deals: cDeals.length,
      cash: dealsCash,
      commission: dealCommission,
      installmentCash: iCash,
      installmentCommission: iCommission,
      total: dealCommission + iCommission,
      lines: closerLines,
    };
  }).sort((a, b) => b.total - a.total);

  return { setterRows, closerRows, periodDeals, periodPayments };
}

export type OwedMember = { id: string; name: string; commission: number; basePay: number; adjustment: number; adjustmentLines: PayoutLine[]; total: number };

/** A member's base pay lands once a month on their own day (anchored to when
 *  they started — founder-corrected 2026-07-28), clamped to the month's
 *  length. */
export function basePayDateFor(p: PayoutProfile, monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(Number(p.base_pay_day) || 1, 1), daysInMonth);
  return `${monthStart.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

/** Base pay is owed only after a FULL month worked (founder 2026-07-28:
 *  started June 30 → first payment July 30; started July 12 → first payment
 *  August 12). Without a start date we can't know, so it's always eligible. */
export function basePayEligibleOn(p: PayoutProfile, payDate: string): boolean {
  if (!p.started_on) return true;
  const start = new Date(p.started_on + "T00:00:00");
  const first = new Date(start.getFullYear(), start.getMonth() + 1, Math.min(start.getDate(), new Date(start.getFullYear(), start.getMonth() + 2, 0).getDate()));
  const firstIso = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(first.getDate()).padStart(2, "0")}`;
  return payDate >= firstIso;
}

/**
 * Everything a member is owed for a period: setter + closer commission, plus
 * monthly base pay when THEIR pay day falls inside the period, plus any
 * manual adjustments (signed corrections with a mandatory note). This is the
 * unit one payout confirmation covers.
 */
export function memberPayoutTotals(
  rows: { setterRows: SetterRow[]; closerRows: CloserRow[] },
  profileMap: Map<string, PayoutProfile>,
  period: Pick<PayoutPeriod, "start" | "end" | "monthStart">,
  adjustments: PayoutAdjustment[] = [],
): OwedMember[] {
  const map = new Map<string, OwedMember>();
  const blank = (id: string, name: string): OwedMember =>
    ({ id, name, commission: 0, basePay: 0, adjustment: 0, adjustmentLines: [], total: 0 });
  const bump = (id: string, name: string, commission: number) => {
    const cur = map.get(id) ?? blank(id, name);
    cur.commission += commission;
    map.set(id, cur);
  };
  for (const r of rows.setterRows) bump(r.id, r.name, r.total);
  for (const r of rows.closerRows) bump(r.id, r.name, r.total);
  for (const p of profileMap.values()) {
    if ((p.base_pay_monthly ?? 0) <= 0) continue;
    const payDate = basePayDateFor(p, period.monthStart);
    if (payDate < period.start || payDate > period.end) continue;
    if (!basePayEligibleOn(p, payDate)) continue; // full month not worked yet
    const cur = map.get(p.id) ?? blank(p.id, p.display_name ?? p.id.slice(0, 8));
    cur.basePay = Number(p.base_pay_monthly);
    map.set(p.id, cur);
  }
  for (const a of adjustments) {
    if (a.period_start !== period.start) continue;
    const name = profileMap.get(a.user_id)?.display_name ?? a.user_id.slice(0, 8);
    const cur = map.get(a.user_id) ?? blank(a.user_id, name);
    cur.adjustment += Number(a.amount);
    cur.adjustmentLines.push({
      kind: "adjustment",
      refId: a.id,
      student: "",
      date: (a.created_at ?? "").slice(0, 10),
      detail: a.note,
      cash: 0,
      rate: null,
      commission: Number(a.amount),
    });
    map.set(a.user_id, cur);
  }
  return [...map.values()]
    .map(m => ({ ...m, total: m.commission + m.basePay + m.adjustment }))
    .filter(m => Math.abs(m.total) >= 0.01 || m.adjustment !== 0)
    .sort((a, b) => b.total - a.total);
}
