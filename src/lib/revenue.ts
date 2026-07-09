import type { Database } from "@/integrations/supabase/types";

export type Deal = {
  id: string;
  student_id: string | null;
  student_name: string;
  closer_id: string;
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
};

export const DEFAULT_RATES: CommissionRates = {
  new_close: 0.10,
  pif_under_30d: 0.12,
  payment_plan: 0.05,
};

/**
 * Commission rule:
 * - PIF (full cash upfront covering total_value) within 30 days of deal_date: pif_under_30d on total_value
 * - Otherwise if split/deposit (payment plan): payment_plan on total_value
 * - Otherwise (PIF where somehow not eligible): new_close on total_value
 * Always at least new_close on total_value as a floor for non-plan closes.
 */
export function commissionForDeal(d: Deal, rates: CommissionRates, asOf: Date = new Date()): number {
  const dealDate = new Date(d.deal_date + "T00:00:00");
  const daysSince = Math.floor((asOf.getTime() - dealDate.getTime()) / 86_400_000);
  const isPIF = d.payment_type === "pif" && d.cash_collected_upfront >= d.total_value;

  if (isPIF && daysSince <= 30) return d.total_value * rates.pif_under_30d;
  if (d.payment_type === "split" || d.payment_type === "deposit") return d.total_value * rates.payment_plan;
  return d.total_value * rates.new_close;
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
