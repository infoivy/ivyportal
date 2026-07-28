import { type Deal, type CommissionRates, commissionForDeal, setterWeekBonusIds, isSelfSet } from "@/lib/revenue";
import { cofounderCappedCommission, type CommissionEvent, COFOUNDER_RATE, COFOUNDER_WEEK_CAP, COFOUNDER_MONTH_CAP } from "@/lib/payouts-calc";

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

export type PayoutProfile = { id: string; display_name: string; commission_cap_pct?: number | null; base_pay_monthly?: number | null };

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
  for (const ip of periodPayments) {
    const inst = installmentMap.get(ip.installment_id);
    if (!inst?.setter_id || inst.setter_id === inst.closer_id) continue;
    setterInstCash.set(inst.setter_id, (setterInstCash.get(inst.setter_id) ?? 0) + ip.amount);
  }
  const allSetterIds = new Set([...setterMap.keys(), ...setterInstCash.keys()]);
  const setterRows: SetterRow[] = Array.from(allSetterIds).map(sid => {
    const entry = setterMap.get(sid);
    const dealsCash = entry?.deals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0) ?? 0;
    const baseRate = rates.setter_base + (entry?.weekBonus ? 0.01 : 0);
    const dealCommission = dealsCash * baseRate;
    const iCash = setterInstCash.get(sid) ?? 0;
    const iCommission = iCash * baseRate;
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
  const instSetSet = new Map<string, boolean>(); // closer_id → self-set installment this period (set+close rate)
  for (const ip of periodPayments) {
    const inst = installmentMap.get(ip.installment_id);
    if (!inst?.closer_id) continue;
    closerInstCash.set(inst.closer_id, (closerInstCash.get(inst.closer_id) ?? 0) + ip.amount);
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
      return {
        id: cid,
        name: profileMap.get(cid)?.display_name ?? cid.slice(0, 8),
        deals: cDeals.length,
        cash: dealsCash,
        commission: owed,
        installmentCash: iCash,
        installmentCommission: 0,
        total: owed,
        capNote: `co-founder · ${(COFOUNDER_RATE * 100).toFixed(0)}% flat · capped $${COFOUNDER_WEEK_CAP / 1000}k/wk · $${COFOUNDER_MONTH_CAP / 1000}k/mo${capped.capped ? " · cap hit" : ""}`,
      };
    }

    const dealCommission = cDeals.reduce((s, d) => s + commissionForDeal(d, rates, profile?.commission_cap_pct), 0);
    // Use set_close for installments where a setter was involved, cap applies
    const iBaseRate = instSetSet.get(cid) ? rates.set_close : rates.new_close;
    const iRate = profile?.commission_cap_pct != null ? Math.min(iBaseRate, profile.commission_cap_pct) : iBaseRate;
    const iCommission = iCash * iRate;
    return {
      id: cid,
      name: profileMap.get(cid)?.display_name ?? cid.slice(0, 8),
      deals: cDeals.length,
      cash: dealsCash,
      commission: dealCommission,
      installmentCash: iCash,
      installmentCommission: iCommission,
      total: dealCommission + iCommission,
    };
  }).sort((a, b) => b.total - a.total);

  return { setterRows, closerRows, periodDeals, periodPayments };
}

export type OwedMember = { id: string; name: string; commission: number; basePay: number; total: number };

/**
 * Everything a member is owed for a period: setter + closer commission, plus
 * monthly base pay when the period is the second half. This is the unit one
 * payout confirmation covers.
 */
export function memberPayoutTotals(
  rows: { setterRows: SetterRow[]; closerRows: CloserRow[] },
  profileMap: Map<string, PayoutProfile>,
  isSecondHalf: boolean,
): OwedMember[] {
  const map = new Map<string, OwedMember>();
  const bump = (id: string, name: string, commission: number) => {
    const cur = map.get(id) ?? { id, name, commission: 0, basePay: 0, total: 0 };
    cur.commission += commission;
    map.set(id, cur);
  };
  for (const r of rows.setterRows) bump(r.id, r.name, r.total);
  for (const r of rows.closerRows) bump(r.id, r.name, r.total);
  if (isSecondHalf) {
    for (const p of profileMap.values()) {
      if ((p.base_pay_monthly ?? 0) <= 0) continue;
      const cur = map.get(p.id) ?? { id: p.id, name: p.display_name ?? p.id.slice(0, 8), commission: 0, basePay: 0, total: 0 };
      cur.basePay = Number(p.base_pay_monthly);
      map.set(p.id, cur);
    }
  }
  return [...map.values()]
    .map(m => ({ ...m, total: m.commission + m.basePay }))
    .filter(m => m.total >= 0.01)
    .sort((a, b) => b.total - a.total);
}
