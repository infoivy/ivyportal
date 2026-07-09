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
  new_close: number;
  pif_under_30d: number;
  payment_plan: number;
  setter_base: number;
  setter_pif_bonus: number;
};

export const DEFAULT_RATES: CommissionRates = {
  new_close: 0.10,
  pif_under_30d: 0.12,
  payment_plan: 0.05,
  setter_base: 0.03,
  setter_pif_bonus: 0.02,
};

function isPifWithin30d(d: Deal, asOf: Date): boolean {
  const dealDate = new Date(d.deal_date + "T00:00:00");
  const daysSince = Math.floor((asOf.getTime() - dealDate.getTime()) / 86_400_000);
  const isPIF = d.payment_type === "pif" && d.cash_collected_upfront >= d.total_value;
  return isPIF && daysSince <= 30;
}

/**
 * Closer commission:
 * - PIF within 30d: pif_under_30d × total_value
 * - split/deposit: payment_plan × total_value
 * - fallback: new_close × total_value
 */
export function commissionForDeal(d: Deal, rates: CommissionRates, asOf: Date = new Date()): number {
  if (isPifWithin30d(d, asOf)) return d.total_value * rates.pif_under_30d;
  if (d.payment_type === "split" || d.payment_type === "deposit") return d.total_value * rates.payment_plan;
  return d.total_value * rates.new_close;
}

/**
 * Setter commission:
 * - setter_base × total_value when a setter is attributed
 * - + setter_pif_bonus × total_value when the deal is PIF within 30 days
 * - 0 when no setter attributed
 */
export function setterCommissionForDeal(d: Deal, rates: CommissionRates, asOf: Date = new Date()): number {
  if (!d.setter_id) return 0;
  const base = d.total_value * rates.setter_base;
  const bonus = isPifWithin30d(d, asOf) ? d.total_value * rates.setter_pif_bonus : 0;
  return base + bonus;
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
