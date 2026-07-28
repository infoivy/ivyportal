import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { keys, invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ChevronLeft, ChevronRight, CircleCheck, Undo2 } from "lucide-react";
import { money, type Deal, type CommissionRates, DEFAULT_RATES } from "@/lib/revenue";
import {
  getPeriod, buildPayoutRows, memberPayoutTotals,
  type PayoutProfile as Profile, type PayoutInstallmentPayment as InstallmentPayment,
  type PayoutInstallment as Installment, type OwedMember,
} from "@/lib/payout-period";
import { todayLocal } from "@/lib/dates";
import { toast } from "sonner";
import { RevenueTabBar } from "@/components/revenue-tab-bar";
import { PayoutAlertBanner } from "@/components/payout-alert";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({ meta: [{ title: "Payouts · ISA" }] }),
  component: Payouts,
});

type PayoutConfirmation = {
  period_start: string;
  user_id: string;
  amount_paid: number;
  confirmed_at: string;
  confirmed_by: string;
};

function Payouts() {
  const { roles } = useAuth();
  if (!roles.some((r) => ["admin", "cofounder"].includes(r))) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-border bg-card rounded-sm p-8 text-center text-sm text-muted-foreground">
          Admin or co-founder access required.
        </div>
      </div>
    );
  }
  return <PayoutsInner />;
}

function PayoutsInner() {
  const [periodOffset, setPeriodOffset] = useState(0);
  const period = useMemo(() => getPeriod(periodOffset), [periodOffset]);

  // Cached month-wide read (the co-founder monthly cap needs both halves).
  // Deal logging, installment payments, and profile edits elsewhere reach
  // this ledger through invalidateForTables + focus refetch.
  const dataQ = useQuery({
    queryKey: [...keys.payoutsPage, period.monthStart],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const [dealsRes, profilesRes, ratesRes, ipRes, instRes, cofRes] = await Promise.all([
        supabase
          .from("deals")
          .select("id, closer_id, setter_id, total_value, cash_collected_upfront, deal_date, payment_type")
          .gte("deal_date", period.monthStart)
          .lte("deal_date", period.monthEnd),
        supabase.from("profiles").select("id, display_name, commission_cap_pct, base_pay_monthly"),
        supabase.from("commission_rates").select("key, rate").eq("active", true),
        supabase
          .from("installment_payments")
          .select("id, amount, paid_at, installment_id")
          .eq("status", "paid")
          .gte("paid_at", period.monthStart + "T00:00:00")
          .lte("paid_at", period.monthEnd + "T23:59:59")
          .not("paid_at", "is", null),
        supabase.from("installments").select("id, setter_id, closer_id, student_name"),
        supabase.from("user_roles").select("user_id").eq("role", "cofounder"),
      ]);
      const ratesOut: CommissionRates = { ...DEFAULT_RATES };
      for (const row of (ratesRes.data ?? [])) {
        const k = row.key as keyof CommissionRates;
        if (k in ratesOut) (ratesOut as Record<string, number>)[k] = Number(row.rate);
      }
      return {
        deals: (dealsRes.data ?? []) as Deal[],
        profiles: (profilesRes.data ?? []) as Profile[],
        rates: ratesOut,
        installmentPayments: (ipRes.data ?? []) as InstallmentPayment[],
        installments: (instRes.data ?? []) as Installment[],
        cofounderIds: ((cofRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id),
      };
    },
  });
  const data = dataQ.data;
  const rates = data?.rates ?? DEFAULT_RATES;
  const loading = dataQ.isPending;
  const profileMap = useMemo(() => {
    const pm = new Map<string, Profile>();
    for (const p of data?.profiles ?? []) pm.set(p.id, p);
    return pm;
  }, [data?.profiles]);

  // The one payout computation, shared with the confirmation banner/bell
  // (src/lib/payout-period.ts) so every surface shows identical numbers.
  const rows = useMemo(
    () => buildPayoutRows({
      deals: data?.deals ?? [],
      installmentPayments: data?.installmentPayments ?? [],
      installments: data?.installments ?? [],
      profileMap,
      rates,
      cofounderIds: new Set(data?.cofounderIds ?? []),
    }, period),
    [data, profileMap, rates, period],
  );
  const { setterRows, closerRows, periodDeals, periodPayments } = rows;

  const totalPayouts = setterRows.reduce((s, r) => s + r.total, 0) + closerRows.reduce((s, r) => s + r.total, 0);

  // Per-member payout confirmations (founder-requested 2026-07-28): once a
  // period's payout date arrives, every member with a nonzero payout must be
  // marked paid. The dashboard banner and bell stay loud until all are.
  const { user } = useAuth();
  const qc = useQueryClient();
  const confirmQ = useQuery({
    queryKey: [...keys.payoutsPage, "confirmations", period.start],
    queryFn: async () =>
      (((await (supabase.from("payout_confirmations" as any).select("*").eq("period_start", period.start) as any)).data ?? []) as PayoutConfirmation[]),
  });
  const confirmations = confirmQ.data ?? [];
  const owed = useMemo(
    () => memberPayoutTotals(rows, profileMap, period.isSecondHalf),
    [rows, profileMap, period.isSecondHalf],
  );
  const periodEnded = todayLocal() > period.end;
  const confirmedBy = new Map(confirmations.map(c => [c.user_id, c]));
  const unconfirmed = owed.filter(m => !confirmedBy.has(m.id));

  const markPaid = async (m: OwedMember) => {
    if (!user) return;
    const { error } = await (supabase.from("payout_confirmations" as any).upsert({
      period_start: period.start,
      user_id: m.id,
      amount_paid: Math.round(m.total * 100) / 100,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    }) as any);
    if (error) return toast.error(error.message);
    toast.success(`${m.name} marked paid · ${money(m.total)}`);
    invalidateForTables(qc, ["payout_confirmations"]);
  };

  const undoPaid = async (userId: string, name: string) => {
    const { error } = await (supabase.from("payout_confirmations" as any).delete().eq("period_start", period.start).eq("user_id", userId) as any);
    if (error) return toast.error(error.message);
    toast.success(`${name} unmarked`);
    invalidateForTables(qc, ["payout_confirmations"]);
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-[1100px] mx-auto p-4 sm:p-6 space-y-6">
        <PayoutAlertBanner onJumpToPeriod={setPeriodOffset} />
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">Admin</div>
            <h1 className="text-xl font-semibold">Payout Ledger</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Commission owed per period</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPeriodOffset(o => o - 1)} className="h-8 w-8 flex items-center justify-center rounded-sm border border-border hover:bg-accent transition">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium px-3 py-1.5 border border-border rounded-sm bg-card whitespace-nowrap">{period.label}</span>
            <button onClick={() => setPeriodOffset(o => Math.min(0, o + 1))} className="h-8 w-8 flex items-center justify-center rounded-sm border border-border hover:bg-accent transition" disabled={periodOffset >= 0}>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Base pay — monthly, alongside per-period commissions */}
        {(() => {
          const withBase = [...profileMap.values()].filter((p) => (p.base_pay_monthly ?? 0) > 0);
          if (withBase.length === 0) return null;
          return (
            <div className="card-surface px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="text-[13px] font-medium text-foreground">Base pay</span>
                <span className="text-[11px] text-muted-foreground">monthly · paid with the 2nd half{period.isSecondHalf ? " (this period)" : ""}</span>
              </div>
              <div className="space-y-1">
                {withBase.map((p) => (
                  <div key={p.id} className="flex items-baseline justify-between text-[13px] rounded-md px-2 py-1.5 hover:bg-muted/60 motion-safe:transition-colors">
                    <span className="text-foreground">{p.display_name}</span>
                    <span className="tabular-nums font-medium">${Number(p.base_pay_monthly).toLocaleString()}<span className="text-muted-foreground font-normal"> / month</span></span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <RevenueTabBar />

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryChip label="Total payouts" value={money(totalPayouts)} accent="green" />
          <SummaryChip label="Setter payouts" value={money(setterRows.reduce((s, r) => s + r.total, 0))} />
          <SummaryChip label="Closer payouts" value={money(closerRows.reduce((s, r) => s + r.total, 0))} />
          <SummaryChip label="Deals in period" value={periodDeals.length} />
        </div>

        {/* Payout confirmations: per member, from the payout date onward */}
        {periodEnded && owed.length > 0 && (
          <section className={`rounded-sm border p-4 space-y-3 ${unconfirmed.length ? "border-danger/40 bg-danger-bg" : "border-success/25 bg-success-bg"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[13px] font-medium text-foreground">
                {unconfirmed.length
                  ? `Payout day: ${unconfirmed.length} of ${owed.length} payouts not confirmed`
                  : "All payouts confirmed for this period"}
              </div>
              <span className="text-[11px] text-muted-foreground">Confirm each member once their money has actually left</span>
            </div>
            <div className="space-y-1">
              {owed.map(m => {
                const c = confirmedBy.get(m.id);
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-sm bg-[var(--card)]/70 border border-border px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {money(m.commission)} commission{m.basePay > 0 ? ` + ${money(m.basePay)} base` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] font-semibold tabular-nums">{money(m.total)}</span>
                      {c ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-success-fg border border-success/25 bg-success-bg px-2 py-1 rounded-sm">
                            <CircleCheck className="h-3.5 w-3.5" /> Paid {new Date(c.confirmed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                          <button onClick={() => undoPaid(m.id, m.name)} title="Undo" className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted motion-safe:transition-colors">
                            <Undo2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => markPaid(m)} className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-2.5 py-1.5 rounded-sm">
                          <CircleCheck className="h-3.5 w-3.5" /> Mark paid
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Setters table */}
        <section className="space-y-2">
          <h2 className="text-[11px] text-muted-foreground font-semibold">Setters · {(rates.setter_base * 100).toFixed(1)}% base (+ 1% if $5k week)</h2>
          <div className="border border-border bg-card rounded-sm overflow-x-auto">
            {setterRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No setter-attributed activity this period.</div>
            ) : (
              <table className="w-full min-w-[580px] text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] text-muted-foreground">
                    <th className="text-left px-4 py-2.5">Setter</th>
                    <th className="text-right px-3 py-2.5">Deals</th>
                    <th className="text-right px-3 py-2.5">Deal cash</th>
                    <th className="text-right px-3 py-2.5">Install. cash</th>
                    <th className="text-right px-3 py-2.5">Rate</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-foreground">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {setterRows.map(r => (
                    <tr key={r.id} className="border-b border-accent last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {r.name}
                        {r.weekBonus && <span className="ml-2 text-[10px] text-warning-fg border border-warning/25 bg-warning-bg px-1.5 py-0.5 rounded-sm">$5k week</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.deals}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{money(r.cash)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.installmentCash > 0 ? money(r.installmentCash) : "–"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.weekBonus ? `${((rates.setter_base + 0.01) * 100).toFixed(1)}%` : `${(rates.setter_base * 100).toFixed(1)}%`}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-accent/30">
                    <td className="px-4 py-2.5 text-[10px] text-muted-foreground" colSpan={5}>Total setter payouts</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary">{money(setterRows.reduce((s, r) => s + r.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* Closers table */}
        <section className="space-y-2">
          <h2 className="text-[11px] text-muted-foreground font-semibold">Closers · {(rates.new_close * 100).toFixed(0)}% close-only · {(rates.set_close * 100).toFixed(0)}% set+close</h2>
          <div className="border border-border bg-card rounded-sm overflow-x-auto">
            {closerRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No closer-attributed activity this period.</div>
            ) : (
              <table className="w-full min-w-[580px] text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] text-muted-foreground">
                    <th className="text-left px-4 py-2.5">Closer</th>
                    <th className="text-right px-3 py-2.5">Deals</th>
                    <th className="text-right px-3 py-2.5">Deal cash</th>
                    <th className="text-right px-3 py-2.5">Install. cash</th>
                    <th className="text-right px-3 py-2.5">Deal comm.</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-foreground">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {closerRows.map(r => (
                    <tr key={r.id} className="border-b border-accent last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {r.name}
                        {r.capNote && <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{r.capNote}</div>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.deals}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{money(r.cash)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.installmentCash > 0 ? money(r.installmentCash) : "–"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{money(r.commission)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-accent/30">
                    <td className="px-4 py-2.5 text-[10px] text-muted-foreground" colSpan={5}>Total closer payouts</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary">{money(closerRows.reduce((s, r) => s + r.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* Installments context note */}
        {periodPayments.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {periodPayments.length} installment payment{periodPayments.length !== 1 ? "s" : ""} collected in this period are included in commission calculations above.
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryChip({ label, value, accent }: { label: string; value: string | number; accent?: "green" }) {
  return (
    <div className="border border-border bg-card rounded-sm p-3 text-center">
      <div className={`text-lg font-semibold ${accent === "green" ? "text-success-fg" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
