import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { keys, invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ChevronLeft, ChevronRight, CircleCheck, Undo2, X, Pencil } from "lucide-react";
import { money, type Deal, type CommissionRates, DEFAULT_RATES } from "@/lib/revenue";
import { Link } from "@tanstack/react-router";
import {
  getPeriod, buildPayoutRows, memberPayoutTotals,
  type PayoutProfile as Profile, type PayoutInstallmentPayment as InstallmentPayment,
  type PayoutInstallment as Installment, type OwedMember, type PayoutAdjustment,
} from "@/lib/payout-period";
import { friendlyPastDay, todayLocal } from "@/lib/dates";
import { toast } from "sonner";
import { MoneyShell } from "@/components/money-shell";
import { PayoutAlertBanner } from "@/components/payout-alert";
import { DateField } from "@/components/ui/date-field";

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
  note: string | null;
};

const LinesPanel = ({ lines, colSpan, aggregate }: { lines: import("@/lib/payout-period").PayoutLine[]; colSpan: number; aggregate?: string }) => (
  <tr className="border-b border-accent last:border-0 bg-muted/20">
    <td colSpan={colSpan} className="px-4 py-2.5">
      {lines.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-1">No cash events this period.</div>
      ) : (
        <div className="space-y-1">
          {lines.map(l => (
            <div key={l.refId} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-muted-foreground w-[92px] shrink-0">{friendlyPastDay(l.date)}</span>
              {l.kind === "adjustment" ? (
                <>
                  <span className="font-medium text-foreground">Adjustment</span>
                  <span className="text-muted-foreground">{l.detail}</span>
                  <span className="tabular-nums font-medium">{l.commission != null ? money(l.commission) : ""}</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{l.student}</span>
                  <span className="text-muted-foreground">{l.detail}</span>
                  <span className="tabular-nums">{money(l.cash)}</span>
                  {l.rate != null && <span className="tabular-nums text-muted-foreground">× {(l.rate * 100).toFixed(1)}%</span>}
                  <span className="tabular-nums font-medium">{l.commission != null ? `= ${money(l.commission)}` : ""}</span>
                  <Link
                    to="/revenue"
                    search={(l.kind === "installment" ? { tab: "plans" } : {}) as never}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {l.kind === "installment" ? "open plan →" : "open deal →"}
                  </Link>
                </>
              )}
            </div>
          ))}
          {aggregate && <div className="pt-1 text-[10px] text-muted-foreground">{aggregate}</div>}
        </div>
      )}
    </td>
  </tr>
);

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
  const [openRow, setOpenRow] = useState<string | null>(null);
  const period = useMemo(() => getPeriod(periodOffset), [periodOffset]);

  // Cached month-wide read (the co-founder monthly cap needs both halves).
  // Deal logging, installment payments, and profile edits elsewhere reach
  // this ledger through invalidateForTables + focus refetch.
  const dataQ = useQuery({
    queryKey: [...keys.payoutsPage, period.monthStart],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const [dealsRes, profilesRes, ratesRes, ipRes, instRes, cofRes, teamRes] = await Promise.all([
        supabase
          .from("deals")
          .select("id, student_name, closer_id, setter_id, total_value, cash_collected_upfront, deal_date, payment_type")
          .eq("is_demo", false)
          .is("voided_at", null)
          .gte("deal_date", period.monthStart)
          .lte("deal_date", period.monthEnd),
        supabase.from("profiles").select("id, display_name, commission_cap_pct, base_pay_monthly, base_pay_day, started_on").eq("is_demo", false),
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
        supabase.from("user_roles").select("user_id").in("role", ["admin", "founder", "cofounder", "closer", "setter", "coach", "csm"]),
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
        teamIds: Array.from(new Set(((teamRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id))),
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
  const adjQ = useQuery({
    queryKey: [...keys.payoutsPage, "adjustments", period.start],
    queryFn: async () =>
      (((await (supabase.from("payout_adjustments" as any).select("*").eq("period_start", period.start).order("created_at", { ascending: true }) as any)).data ?? []) as PayoutAdjustment[]),
  });
  const adjustments = useMemo(() => adjQ.data ?? [], [adjQ.data]);
  const owed = useMemo(
    () => memberPayoutTotals(rows, profileMap, period, adjustments),
    [rows, profileMap, period, adjustments],
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
      <MoneyShell
        actions={
          <div className="flex items-center gap-1">
            <button onClick={() => setPeriodOffset(o => o - 1)} className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted motion-safe:transition-colors" aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium px-3 py-2 border border-border rounded-md bg-card whitespace-nowrap tabular-nums min-w-[130px] text-center">{period.label}</span>
            <button onClick={() => setPeriodOffset(o => Math.min(0, o + 1))} className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted motion-safe:transition-colors disabled:opacity-40" disabled={periodOffset >= 0} aria-label="Next period">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <PayoutAlertBanner onJumpToPeriod={setPeriodOffset} />

        {/* One number for the whole period: commissions due + base pay whose
            day falls inside it (founder-requested 2026-07-28). */}
        {(() => {
          const owedTotal = owed.reduce((s, m) => s + m.total, 0);
          const commissionSum = owed.reduce((s, m) => s + m.commission, 0);
          const basePaySum = owed.reduce((s, m) => s + m.basePay, 0);
          const adjSum = owed.reduce((s, m) => s + m.adjustment, 0);
          const paidSum = owed.filter(m => confirmedBy.has(m.id)).reduce((s, m) => s + Number(confirmedBy.get(m.id)!.amount_paid), 0);
          const leftSum = owedTotal - paidSum;
          const periodCash = periodDeals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0)
            + periodPayments.reduce((s, p) => s + p.amount, 0);
          const pct = periodCash > 0 ? (owedTotal / periodCash) * 100 : null;
          return (
            <div className="card-surface px-5 py-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div>
                <div className="text-[12px] text-muted-foreground mb-2">To pay out · {period.label}</div>
                <div className="text-[30px] font-medium tabular-nums leading-none">{money(owedTotal)}</div>
                <div className="mt-2.5 text-[12px] text-muted-foreground tabular-nums">
                  {money(commissionSum)} commissions{basePaySum > 0 ? ` + ${money(basePaySum)} base pay` : ""}{Math.abs(adjSum) >= 0.01 ? ` ${adjSum > 0 ? "+" : "−"} ${money(Math.abs(adjSum))} adjustments` : ""} · {owed.length} {owed.length === 1 ? "person" : "people"}
                  {periodEnded && paidSum > 0 && (
                    <>
                      {" "}· <span className="text-success-fg">{money(paidSum)} confirmed paid</span>
                      {leftSum > 0.009 && <> · <span className="text-danger-fg">{money(leftSum)} left</span></>}
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-muted-foreground mb-2">Cash collected this period</div>
                <div className="text-[22px] font-medium tabular-nums leading-none">{money(periodCash)}</div>
                <div className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                  {pct != null ? `payouts are ${pct.toFixed(1)}% of cash` : "no cash collected yet"}
                  {!periodEnded && " · period still running"}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Base pay — monthly, per member on their own day. Editable here so
            new base pay doesn't require a trip to the Team page. */}
        <BasePayPanel
          profileMap={profileMap}
          teamIds={data?.teamIds ?? []}
          onChanged={() => {
            invalidateForTables(qc, ["profiles"]);
            qc.invalidateQueries({ queryKey: ["payout-alert"] });
          }}
        />

        {/* Manual adjustments: signed corrections on a member's payout for
            this period (off-system payments, clawbacks). Note is mandatory
            so every number keeps its receipt. */}
        <AdjustmentsPanel
          period={period}
          adjustments={adjustments}
          profileMap={profileMap}
          teamIds={data?.teamIds ?? []}
        />


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
                        {money(m.commission)} commission{m.basePay > 0 ? ` + ${money(m.basePay)} base` : ""}{Math.abs(m.adjustment) >= 0.01 ? ` ${m.adjustment > 0 ? "+" : "−"} ${money(Math.abs(m.adjustment))} adj.` : ""}
                      </div>
                      {c?.note && <div className="text-[11px] text-muted-foreground/80 truncate" title={c.note}>{c.note}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Once confirmed, the STORED paid amount is the number that
                          matters; the computed figure demotes to context when they
                          differ (founder 2026-07-31: settled rows looked wrong). */}
                      {c ? (
                        <span className="text-right">
                          <span className="text-[13px] font-semibold tabular-nums block">{money(Number(c.amount_paid))}</span>
                          {Math.abs(Number(c.amount_paid) - m.total) >= 1 && (
                            <span className="text-[10px] text-muted-foreground tabular-nums block">ledger computed {money(m.total)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[13px] font-semibold tabular-nums">{money(m.total)}</span>
                      )}
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
                    <Fragment key={r.id}>
                    <tr onClick={() => setOpenRow(o => o === `s-${r.id}` ? null : `s-${r.id}`)} className="border-b border-accent last:border-0 cursor-pointer hover:bg-muted/30 motion-safe:transition-colors">
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
                    {openRow === `s-${r.id}` && <LinesPanel lines={r.lines} colSpan={6} />}
                    </Fragment>
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
                    <Fragment key={r.id}>
                    <tr onClick={() => setOpenRow(o => o === `c-${r.id}` ? null : `c-${r.id}`)} className="border-b border-accent last:border-0 cursor-pointer hover:bg-muted/30 motion-safe:transition-colors">
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
                    {openRow === `c-${r.id}` && (
                      <LinesPanel
                        lines={r.lines}
                        colSpan={6}
                        aggregate={r.capNote ? "Owed is the aggregate flat 10% with the weekly and monthly caps applied across the whole month; per-line commission is not additive." : undefined}
                      />
                    )}
                    </Fragment>
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
      </MoneyShell>
    </div>
  );
}

/** Base pay lives on profiles (base_pay_monthly + started_on). The founder
 *  picks each member's FIRST DAY with a calendar; the monthly pay day derives
 *  from it (they're paid every month on that day — founder-directed
 *  2026-07-28). Changes flow to Finance, confirmations, and the calendar. */
function BasePayPanel({ profileMap, teamIds, onChanged }: {
  profileMap: Map<string, Profile>;
  teamIds: string[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftStart, setDraftStart] = useState("");
  const [adding, setAdding] = useState(false);
  const [addId, setAddId] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addStart, setAddStart] = useState("");
  const [saving, setSaving] = useState(false);

  const withBase = [...profileMap.values()].filter((p) => (p.base_pay_monthly ?? 0) > 0);
  const addable = teamIds
    .map(id => profileMap.get(id))
    .filter((p): p is Profile => !!p && (p.base_pay_monthly ?? 0) <= 0)
    .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));

  const save = async (id: string, amount: number | null, startedOn: string) => {
    setSaving(true);
    const patch: Record<string, unknown> = { base_pay_monthly: amount };
    if (startedOn) {
      patch.started_on = startedOn;
      patch.base_pay_day = Math.min(Math.max(Number(startedOn.slice(8, 10)) || 1, 1), 31);
    }
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(amount == null ? "Base pay removed" : `Base pay set · $${amount.toLocaleString()}/month${startedOn ? ` · pays the ${Number(startedOn.slice(8, 10))}` : ""}`);
    setEditingId(null); setAdding(false); setAddId(""); setAddAmount(""); setAddStart("");
    onChanged();
  };

  return (
    <div className="card-surface px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
        <span className="text-[13px] font-medium text-foreground">Base pay</span>
        <span className="text-[11px] text-muted-foreground">pick their first day · they get paid that day every month</span>
      </div>
      <div className="space-y-1">
        {withBase.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 text-[13px] rounded-md px-2 py-1.5 hover:bg-muted/60 motion-safe:transition-colors">
            <span className="text-foreground">{p.display_name}</span>
            {editingId === p.id ? (
              <span className="flex flex-wrap items-center gap-1.5 justify-end">
                <input
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
                  onKeyDown={e => { if (e.key === "Enter" && Number(draft) > 0) void save(p.id, Number(draft), draftStart); if (e.key === "Escape") setEditingId(null); }}
                  className="h-8 w-24 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-right text-[13px] tabular-nums focus:outline-none focus:border-ring"
                />
                <span className="text-[11px] text-muted-foreground">started</span>
                <DateField value={draftStart} onChange={setDraftStart} placeholder="First day" clearable={false} className="w-[150px]" />
                <button disabled={saving || !(Number(draft) > 0)} onClick={() => save(p.id, Number(draft), draftStart)} className="text-[11px] font-medium text-primary hover:underline disabled:opacity-40">Save</button>
                <button onClick={() => setEditingId(null)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <button
                  onClick={() => { setEditingId(p.id); setDraft(String(p.base_pay_monthly ?? "")); setDraftStart(p.started_on ?? ""); }}
                  className="tabular-nums font-medium hover:underline underline-offset-2"
                  title="Edit amount and start date"
                >
                  ${Number(p.base_pay_monthly).toLocaleString()}
                  <span className="text-muted-foreground font-normal">
                    {" "}/ month · pays the {Number(p.base_pay_day) || 1}
                    {p.started_on ? ` · started ${new Date(p.started_on + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
                  </span>
                </button>
                <button
                  onClick={() => { setEditingId(p.id); setDraft(String(p.base_pay_monthly ?? "")); setDraftStart(p.started_on ?? ""); }}
                  className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Edit amount and start date"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => { if (confirm(`Remove ${p.display_name}'s base pay?`)) void save(p.id, null, ""); }}
                  className="p-1 rounded-sm text-muted-foreground hover:text-danger-fg hover:bg-danger-bg"
                  title="Remove base pay"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        ))}
        {withBase.length === 0 && <div className="text-[12px] text-muted-foreground px-2 py-1">No base pay set yet.</div>}
      </div>
      {adding ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
          <select
            value={addId}
            onChange={e => setAddId(e.target.value)}
            className="h-8 rounded-sm border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] focus:outline-none focus:border-ring"
          >
            <option value="">Pick a team member…</option>
            {addable.map(p => <option key={p.id} value={p.id}>{p.display_name ?? p.id.slice(0, 8)}</option>)}
          </select>
          <input
            placeholder="$/month"
            value={addAmount}
            onChange={e => setAddAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="h-8 w-24 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-right text-[12px] tabular-nums focus:outline-none focus:border-ring"
          />
          <span className="text-[11px] text-muted-foreground">started</span>
          <DateField value={addStart} onChange={setAddStart} placeholder="First day" clearable={false} className="w-[150px]" />
          <button
            disabled={saving || !addId || !(Number(addAmount) > 0) || !addStart}
            onClick={() => save(addId, Number(addAmount), addStart)}
            className="h-8 px-3 rounded-sm bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            Add
          </button>
          <button onClick={() => { setAdding(false); setAddId(""); setAddAmount(""); setAddStart(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 text-[11px] font-medium text-primary hover:underline">+ Add base pay</button>
      )}
    </div>
  );
}

/** Signed payout corrections for the shown period. Every adjustment needs a
 *  note; each one shows up in the member's owed total, the confirmation
 *  banner, and the receipts. Deleting is allowed (the audit log keeps the
 *  history). */
function AdjustmentsPanel({ period, adjustments, profileMap, teamIds }: {
  period: { start: string; label: string };
  adjustments: PayoutAdjustment[];
  profileMap: Map<string, Profile>;
  teamIds: string[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const members = teamIds
    .map(id => profileMap.get(id))
    .filter((p): p is Profile => !!p)
    .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));

  const add = async () => {
    const amt = Number(amount);
    if (!user || !memberId || !Number.isFinite(amt) || amt === 0 || note.trim().length < 3) return;
    setSaving(true);
    const { error } = await (supabase.from("payout_adjustments" as any).insert({
      user_id: memberId,
      period_start: period.start,
      amount: Math.round(amt * 100) / 100,
      note: note.trim(),
      created_by: user.id,
    }) as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Adjustment added");
    setAdding(false); setMemberId(""); setAmount(""); setNote("");
    invalidateForTables(qc, ["payout_adjustments"]);
  };

  const remove = async (a: PayoutAdjustment) => {
    if (!confirm(`Remove this adjustment (${money(a.amount)})? The audit log keeps the record.`)) return;
    const { error } = await (supabase.from("payout_adjustments" as any).delete().eq("id", a.id) as any);
    if (error) return toast.error(error.message);
    toast.success("Adjustment removed");
    invalidateForTables(qc, ["payout_adjustments"]);
  };

  if (adjustments.length === 0 && !adding) {
    return (
      <div className="card-surface px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-[12px] text-muted-foreground">No adjustments for {period.label}. Use one to correct a payout or record money paid outside the ledger.</span>
        <button onClick={() => setAdding(true)} className="text-[11px] font-medium text-primary hover:underline shrink-0">+ Add adjustment</button>
      </div>
    );
  }

  return (
    <div className="card-surface px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
        <span className="text-[13px] font-medium text-foreground">Adjustments · {period.label}</span>
        {!adding && <button onClick={() => setAdding(true)} className="text-[11px] font-medium text-primary hover:underline">+ Add adjustment</button>}
      </div>
      <div className="space-y-1">
        {adjustments.map(a => (
          <div key={a.id} className="flex items-center justify-between gap-3 text-[13px] rounded-md px-2 py-1.5 hover:bg-muted/60 motion-safe:transition-colors">
            <div className="min-w-0 flex-1">
              <span className="text-foreground font-medium">{profileMap.get(a.user_id)?.display_name ?? a.user_id.slice(0, 8)}</span>
              <span className="text-muted-foreground"> · {a.note}</span>
            </div>
            <span className={`tabular-nums font-medium shrink-0 ${a.amount < 0 ? "text-danger-fg" : ""}`}>{money(a.amount)}</span>
            <button onClick={() => remove(a)} className="p-1 rounded-sm text-muted-foreground hover:text-danger-fg hover:bg-danger-bg shrink-0" title="Remove adjustment">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {adding && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
          <select
            value={memberId}
            onChange={e => setMemberId(e.target.value)}
            className="h-8 rounded-sm border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] focus:outline-none focus:border-ring"
          >
            <option value="">Pick a team member…</option>
            {members.map(p => <option key={p.id} value={p.id}>{p.display_name ?? p.id.slice(0, 8)}</option>)}
          </select>
          <input
            placeholder="± amount"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9.-]/g, ""))}
            className="h-8 w-24 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-right text-[12px] tabular-nums focus:outline-none focus:border-ring"
          />
          <input
            placeholder="Why (required)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="h-8 flex-1 min-w-[180px] px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[12px] focus:outline-none focus:border-ring"
          />
          <button
            disabled={saving || !memberId || !Number.isFinite(Number(amount)) || Number(amount) === 0 || note.trim().length < 3}
            onClick={() => void add()}
            className="h-8 px-3 rounded-sm bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            Add
          </button>
          <button onClick={() => { setAdding(false); setMemberId(""); setAmount(""); setNote(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">Positive adds to what the member is owed, negative subtracts. Shows in their receipts and the payout banner.</p>
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
