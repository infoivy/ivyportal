import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { keys } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { money, type Deal, type CommissionRates, commissionForDeal, setterWeekBonusIds, DEFAULT_RATES, isSelfSet } from "@/lib/revenue";
import { cofounderCappedCommission, type CommissionEvent, COFOUNDER_RATE, COFOUNDER_WEEK_CAP, COFOUNDER_MONTH_CAP } from "@/lib/payouts-calc";
import { RevenueTabBar } from "@/components/revenue-tab-bar";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({ meta: [{ title: "Payouts · ISA" }] }),
  component: Payouts,
});

// Pay periods: semi-monthly halves — 1st–15th and 16th–end of month.
// Commissions are paid twice a month (founder-confirmed 2026-07-12);
// monthly base pay is shown separately.
function getPeriod(offset = 0) {
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

type Profile = { id: string; display_name: string; commission_cap_pct?: number | null; base_pay_monthly?: number | null };

type InstallmentPayment = {
  id: string;
  amount: number;
  paid_at: string | null;
  installment_id: string;
};

type Installment = {
  id: string;
  setter_id: string | null;
  closer_id: string | null;
  student_name: string;
};

type SetterRow = {
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

type CloserRow = {
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
  const deals = dataQ.data?.deals ?? [];
  const rates = dataQ.data?.rates ?? DEFAULT_RATES;
  const installmentPayments = dataQ.data?.installmentPayments ?? [];
  const installments = dataQ.data?.installments ?? [];
  const loading = dataQ.isPending;
  const profileMap = useMemo(() => {
    const pm = new Map<string, Profile>();
    for (const p of dataQ.data?.profiles ?? []) pm.set(p.id, p);
    return pm;
  }, [dataQ.data?.profiles]);
  const cofounderIds = useMemo(() => new Set(dataQ.data?.cofounderIds ?? []), [dataQ.data?.cofounderIds]);

  // Build installment map: id → installment
  const installmentMap = useMemo(() => {
    const m = new Map<string, Installment>();
    for (const i of installments) m.set(i.id, i);
    return m;
  }, [installments]);

  // The fetch is month-wide (co-founder caps span both halves); everything
  // else is scoped to the visible period.
  const periodDeals = useMemo(
    () => deals.filter((d) => d.deal_date >= period.start && d.deal_date <= period.end),
    [deals, period.start, period.end],
  );
  const periodPayments = useMemo(
    () => installmentPayments.filter((ip) => {
      const day = (ip.paid_at ?? "").slice(0, 10);
      return day >= period.start && day <= period.end;
    }),
    [installmentPayments, period.start, period.end],
  );

  // Setter rows
  const setterRows = useMemo((): SetterRow[] => {
    const weekBonusIds = setterWeekBonusIds(periodDeals);

    const map = new Map<string, { deals: Deal[]; weekBonus: boolean }>();
    for (const d of periodDeals) {
      if (!d.setter_id || isSelfSet(d)) continue; // self-set = closer's 15%, no setter credit
      const entry = map.get(d.setter_id) ?? { deals: [], weekBonus: false };
      entry.deals.push(d);
      if (weekBonusIds.has(d.setter_id)) entry.weekBonus = true;
      map.set(d.setter_id, entry);
    }

    // Add installment cash to setters
    const instCash = new Map<string, number>();
    for (const ip of periodPayments) {
      const inst = installmentMap.get(ip.installment_id);
      if (!inst?.setter_id || inst.setter_id === inst.closer_id) continue;
      instCash.set(inst.setter_id, (instCash.get(inst.setter_id) ?? 0) + ip.amount);
    }

    const allSetterIds = new Set([...map.keys(), ...instCash.keys()]);
    return Array.from(allSetterIds).map(sid => {
      const entry = map.get(sid);
      const dealsCash = entry?.deals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0) ?? 0;
      const baseRate = rates.setter_base + (entry?.weekBonus ? 0.01 : 0);
      const dealCommission = dealsCash * baseRate;
      const iCash = instCash.get(sid) ?? 0;
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
  }, [periodDeals, periodPayments, installmentMap, profileMap, rates]);

  // Closer rows
  const closerRows = useMemo((): CloserRow[] => {
    const map = new Map<string, Deal[]>();
    for (const d of periodDeals) {
      if (!d.closer_id) continue;
      const entry = map.get(d.closer_id) ?? [];
      entry.push(d);
      map.set(d.closer_id, entry);
    }

    const instCash = new Map<string, number>();
    const instSetSet = new Map<string, boolean>(); // closer_id → self-set installment this period (set+close rate)
    for (const ip of periodPayments) {
      const inst = installmentMap.get(ip.installment_id);
      if (!inst?.closer_id) continue;
      instCash.set(inst.closer_id, (instCash.get(inst.closer_id) ?? 0) + ip.amount);
      if (inst.setter_id && inst.setter_id === inst.closer_id) instSetSet.set(inst.closer_id, true);
    }

    // Co-founders: flat 10% with $1k/week + $2k/month caps, computed over
    // the whole month so this period shows its true slice.
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

    const allCloserIds = new Set([...map.keys(), ...instCash.keys()]);
    return Array.from(allCloserIds).map(cid => {
      const profile = profileMap.get(cid);
      const cDeals = map.get(cid) ?? [];
      const dealsCash = cDeals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0);
      const iCash = instCash.get(cid) ?? 0;

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
  }, [deals, periodDeals, installmentPayments, periodPayments, installmentMap, profileMap, rates, cofounderIds, period.isSecondHalf]);

  const totalPayouts = setterRows.reduce((s, r) => s + r.total, 0) + closerRows.reduce((s, r) => s + r.total, 0);

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
