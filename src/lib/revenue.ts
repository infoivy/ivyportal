import type { Database } from "@/integrations/supabase/types";

export type Deal = {
  id: string;
  student_id: string | null;
  student_name: string;
  closer_id: string;
  setter_id: string | null;
  program_type: string;
  total_value: number;
  cash_collected_upfront: number;
  payment_type: Database["public"]["Enums"]["deal_payment_type"];
  deal_date: string; // YYYY-MM-DD
  contract_url: string | null;
  fathom_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CommissionRates = {
  /** Close-only closer rate (default 10%) */
  new_close: number;
  /** Set+close closer rate (default 15%) */
  set_close: number;
  /** Setter base rate (default 7.5%) */
  setter_base: number;
};

export const DEFAULT_RATES: CommissionRates = {
  new_close: 0.10,
  set_close: 0.15,
  setter_base: 0.075,
};

/**
 * A deal is "set + close" ONLY when the same person did both — the closer
 * sourced and set the lead themselves (setter_id === closer_id). A deal set
 * by a different setter pays the setter their base and the closer close-only.
 */
export function isSelfSet(d: Deal): boolean {
  return !!d.setter_id && d.setter_id === d.closer_id;
}

/**
 * Closer commission:
 * - 15% (set_close) ONLY when the closer set the deal themselves
 *   (setter_id === closer_id) — instead of 7.5% + 10% separately
 * - 10% (new_close) otherwise (including when a different setter set it)
 * - Per-user cap applied if commission_cap_pct is set on the closer's profile
 * Applied to cash_collected_upfront.
 */
export function commissionForDeal(
  d: Deal,
  rates: CommissionRates,
  closerCapPct?: number | null,
): number {
  const baseRate = isSelfSet(d) ? rates.set_close : rates.new_close;
  const rate = closerCapPct != null ? Math.min(baseRate, closerCapPct) : baseRate;
  return d.cash_collected_upfront * rate;
}

/** Label explaining why a given closer rate applied to a deal (for UI display). */
export function closerRateLabel(d: Deal, rates: CommissionRates, closerCapPct?: number | null): string {
  const baseRate = isSelfSet(d) ? rates.set_close : rates.new_close;
  const rate = closerCapPct != null ? Math.min(baseRate, closerCapPct) : baseRate;
  const pct = `${(rate * 100).toFixed(0)}%`;
  if (closerCapPct != null && baseRate > closerCapPct) return `${pct} (capped)`;
  return isSelfSet(d) ? `${pct} set+close` : `${pct} close-only`;
}

/**
 * Setter commission (base only):
 * - setter_base × cash_collected_upfront when a DIFFERENT setter is attributed
 * - 0 when no setter, or when the closer set it themselves (their 15%
 *   set+close rate already covers both halves)
 * Weekly $5k bonus is calculated separately via setterWeekBonus().
 */
export function setterCommissionForDeal(d: Deal, rates: CommissionRates): number {
  if (!d.setter_id || isSelfSet(d)) return 0;
  return d.cash_collected_upfront * rates.setter_base;
}

/**
 * Returns the set of setter_ids who earned the $5k-week bonus in the given deal list.
 * A setter earns +1% bonus if their total cash_collected_upfront in any Mon–Sun week ≥ $5,000.
 */
export function setterWeekBonusIds(deals: Deal[]): Set<string> {
  const weekMap = new Map<string, number>(); // key: "setterId::weekStart"
  for (const d of deals) {
    if (!d.setter_id || isSelfSet(d)) continue;
    const weekStart = isoDay(startOfWeekMon(new Date(d.deal_date + "T00:00:00")));
    const key = `${d.setter_id}::${weekStart}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + d.cash_collected_upfront);
  }
  const ids = new Set<string>();
  for (const [key, total] of weekMap) {
    if (total >= 5000) ids.add(key.split("::")[0]);
  }
  return ids;
}

export function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

// Week helpers (Monday-Sunday)
export function startOfWeekMon(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}
export function endOfWeekSun(d: Date): Date {
  const start = startOfWeekMon(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function isSameMonth(iso: string, ref: Date = new Date()) {
  const d = new Date(iso + "T00:00:00");
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}
