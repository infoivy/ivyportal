import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { keys } from "@/lib/query-keys";
import { money, type Deal, type CommissionRates, DEFAULT_RATES } from "@/lib/revenue";
import {
  getPeriod, buildPayoutRows, memberPayoutTotals,
  type PayoutProfile, type PayoutInstallmentPayment, type PayoutInstallment, type OwedMember, type PayoutPeriod,
} from "@/lib/payout-period";
import { todayLocal } from "@/lib/dates";

export type PayoutAlertPeriod = {
  period: PayoutPeriod;
  offset: number;
  owed: OwedMember[];
  unconfirmed: OwedMember[];
};

/**
 * Everyone owed money for a period, live from the same math the Payouts page
 * uses. Shared by the overdue-payout banner and the founder home money strip.
 */
export async function fetchPeriodOwed(period: PayoutPeriod): Promise<OwedMember[]> {
  const [dealsRes, profilesRes, ratesRes, ipRes, instRes, cofRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, closer_id, setter_id, total_value, cash_collected_upfront, deal_date, payment_type")
      .eq("is_demo", false)
      .gte("deal_date", period.monthStart)
      .lte("deal_date", period.monthEnd),
    supabase.from("profiles").select("id, display_name, commission_cap_pct, base_pay_monthly, base_pay_day").eq("is_demo", false),
    supabase.from("commission_rates").select("key, rate").eq("active", true),
    supabase
      .from("installment_payments")
      .select("id, amount, paid_at, installment_id, installments!inner(students!inner(is_demo))")
      .eq("installments.students.is_demo", false)
      .eq("status", "paid")
      .gte("paid_at", period.monthStart + "T00:00:00")
      .lte("paid_at", period.monthEnd + "T23:59:59")
      .not("paid_at", "is", null),
    supabase.from("installments").select("id, setter_id, closer_id, student_name, students!inner(is_demo)").eq("students.is_demo", false),
    supabase.from("user_roles").select("user_id").eq("role", "cofounder"),
  ]);
  const rates: CommissionRates = { ...DEFAULT_RATES };
  for (const row of (ratesRes.data ?? [])) {
    const k = row.key as keyof CommissionRates;
    if (k in rates) (rates as Record<string, number>)[k] = Number(row.rate);
  }
  const profileMap = new Map<string, PayoutProfile>();
  for (const p of (profilesRes.data ?? []) as PayoutProfile[]) profileMap.set(p.id, p);
  const rows = buildPayoutRows({
    deals: (dealsRes.data ?? []) as Deal[],
    installmentPayments: (ipRes.data ?? []) as PayoutInstallmentPayment[],
    installments: (instRes.data ?? []) as PayoutInstallment[],
    profileMap,
    rates,
    cofounderIds: new Set(((cofRes.data ?? []) as { user_id: string }[]).map(r => r.user_id)),
  }, period);
  return memberPayoutTotals(rows, profileMap, period);
}

async function fetchPeriodStatus(offset: number): Promise<PayoutAlertPeriod | null> {
  const period = getPeriod(offset);
  if (todayLocal() <= period.end) return null; // payout date not reached yet
  const [owed, confRes] = await Promise.all([
    fetchPeriodOwed(period),
    (supabase.from("payout_confirmations" as any).select("user_id").eq("period_start", period.start) as any),
  ]);
  const confirmedIds = new Set(((confRes.data ?? []) as { user_id: string }[]).map((r: { user_id: string }) => r.user_id));
  return { period, offset, owed, unconfirmed: owed.filter(m => !confirmedIds.has(m.id)) };
}

/**
 * The two most recently ENDED periods with unconfirmed nonzero payouts.
 * Payout dates are the 1st and 16th; the alert stays up, every day, until
 * every member is marked paid on the Payouts page (founder rule 2026-07-28).
 */
export function usePayoutAlert() {
  const { roles } = useAuth();
  const canSee = roles.some(r => ["admin", "founder", "cofounder"].includes(r));
  const q = useQuery({
    queryKey: [...keys.payoutAlert, todayLocal()],
    enabled: canSee,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const checks = await Promise.all([fetchPeriodStatus(-2), fetchPeriodStatus(-1)]);
      return checks.filter((c): c is PayoutAlertPeriod => !!c && c.unconfirmed.length > 0);
    },
  });
  return { alerts: q.data ?? [], canSee };
}

/**
 * Full-width red banner for unconfirmed payouts past their date. Calm frame,
 * unmistakably red (founder 2026-07-28: keep the urgency and hover, drop the
 * loud animated bordering). Rendered on the Dashboard and the Payouts page
 * for admin/founder/cofounder.
 */
export function PayoutAlertBanner({ onJumpToPeriod }: { onJumpToPeriod?: (offset: number) => void }) {
  const { alerts, canSee } = usePayoutAlert();
  const totalDue = useMemo(
    () => alerts.reduce((s, a) => s + a.unconfirmed.reduce((x, m) => x + m.total, 0), 0),
    [alerts],
  );
  if (!canSee || alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      {alerts.map(a => (
        <div key={a.period.start} className="rounded-lg border border-danger/25 bg-danger-bg hover:bg-danger-bg/80 motion-safe:transition-colors px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <AlertOctagon className="h-5 w-5 text-danger-fg shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-danger-fg">
                Payout day passed: {a.unconfirmed.length} {a.unconfirmed.length === 1 ? "payout" : "payouts"} not confirmed for {a.period.label}
              </div>
              <div className="text-[12px] text-muted-foreground truncate">
                {a.unconfirmed.map(m => `${m.name} (${money(m.total)})`).join(" · ")}
              </div>
            </div>
          </div>
          {onJumpToPeriod ? (
            <button
              onClick={() => onJumpToPeriod(a.offset)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-danger text-white hover:opacity-90 px-3 py-1.5 rounded-md shrink-0"
            >
              Confirm now <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link
              to={"/payouts" as string}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-danger text-white hover:opacity-90 px-3 py-1.5 rounded-md shrink-0"
            >
              Confirm now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ))}
      {alerts.length > 1 && (
        <div className="text-[11px] text-muted-foreground text-right tabular-nums">Total unconfirmed: {money(totalDue)}</div>
      )}
    </div>
  );
}
