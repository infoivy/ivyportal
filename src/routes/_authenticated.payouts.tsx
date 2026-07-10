import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { money, type Deal, type CommissionRates, commissionForDeal, setterWeekBonusIds, DEFAULT_RATES } from "@/lib/revenue";
import { RevenueTabBar } from "@/components/revenue-tab-bar";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({ meta: [{ title: "Payouts — ISA" }] }),
  component: Payouts,
});

// Period: 11th → 11th
function getPeriod(offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const d = now.getDate();

  let startY: number, startM: number, endY: number, endM: number;
  if (d < 11) {
    // period = 11th last month → 11th this month
    startM = m - 1;
    startY = y;
    if (startM < 0) { startM = 11; startY = y - 1; }
    endM = m; endY = y;
  } else {
    // period = 11th this month → 11th next month
    startM = m; startY = y;
    endM = m + 1; endY = y;
    if (endM > 11) { endM = 0; endY = y + 1; }
  }

  // Apply offset (negative = go back)
  let sm = startM + offset;
  let sy = startY;
  while (sm < 0) { sm += 12; sy--; }
  while (sm > 11) { sm -= 12; sy++; }
  let em = endM + offset;
  let ey = endY;
  while (em < 0) { em += 12; ey--; }
  while (em > 11) { em -= 12; ey++; }

  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${sy}-${pad(sm + 1)}-11`,
    end: `${ey}-${pad(em + 1)}-11`,
    label: `${new Date(sy, sm, 11).toLocaleString("default", { month: "short" })} 11 – ${new Date(ey, em, 11).toLocaleString("default", { month: "short", year: "numeric" })} 11`,
  };
}

type Profile = { id: string; display_name: string; commission_cap_pct?: number | null };

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
};

function Payouts() {
  const { roles } = useAuth();
  if (!roles.includes("admin")) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-border bg-card rounded-sm p-8 text-center text-sm text-muted-foreground">
          Admin access required.
        </div>
      </div>
    );
  }
  return <PayoutsInner />;
}

function PayoutsInner() {
  const [periodOffset, setPeriodOffset] = useState(0);
  const period = useMemo(() => getPeriod(periodOffset), [periodOffset]);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map());
  const [rates, setRates] = useState<CommissionRates>(DEFAULT_RATES);
  const [installmentPayments, setInstallmentPayments] = useState<InstallmentPayment[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [dealsRes, profilesRes, ratesRes, ipRes, instRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, closer_id, setter_id, total_value, cash_collected_upfront, deal_date, payment_type")
        .gte("deal_date", period.start)
        .lt("deal_date", period.end),
      supabase.from("profiles").select("id, display_name, commission_cap_pct"),
      supabase.from("commission_rates").select("key, rate").eq("active", true),
      supabase
        .from("installment_payments")
        .select("id, amount, paid_at, installment_id")
        .gte("paid_at", period.start + "T00:00:00")
        .lt("paid_at", period.end + "T00:00:00")
        .not("paid_at", "is", null),
      supabase.from("installments").select("id, setter_id, closer_id, student_name"),
    ]);
    setDeals((dealsRes.data ?? []) as Deal[]);
    const pm = new Map<string, Profile>();
    for (const p of (profilesRes.data ?? []) as Profile[]) pm.set(p.id, p);
    setProfileMap(pm);
    const r: CommissionRates = { ...DEFAULT_RATES };
    for (const row of (ratesRes.data ?? [])) {
      const k = row.key as keyof CommissionRates;
      if (k in r) (r as Record<string, number>)[k] = Number(row.rate);
    }
    setRates(r);
    setInstallmentPayments((ipRes.data ?? []) as InstallmentPayment[]);
    setInstallments((instRes.data ?? []) as Installment[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [period.start]);

  // Build installment map: id → installment
  const installmentMap = useMemo(() => {
    const m = new Map<string, Installment>();
    for (const i of installments) m.set(i.id, i);
    return m;
  }, [installments]);

  // Setter rows
  const setterRows = useMemo((): SetterRow[] => {
    const weekBonusIds = setterWeekBonusIds(deals);

    const map = new Map<string, { deals: Deal[]; weekBonus: boolean }>();
    for (const d of deals) {
      if (!d.setter_id) continue;
      const entry = map.get(d.setter_id) ?? { deals: [], weekBonus: false };
      entry.deals.push(d);
      if (weekBonusIds.has(d.setter_id)) entry.weekBonus = true;
      map.set(d.setter_id, entry);
    }

    // Add installment cash to setters
    const instCash = new Map<string, number>();
    for (const ip of installmentPayments) {
      const inst = installmentMap.get(ip.installment_id);
      if (!inst?.setter_id) continue;
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
  }, [deals, installmentPayments, installmentMap, profileMap]);

  // Closer rows
  const closerRows = useMemo((): CloserRow[] => {
    const map = new Map<string, Deal[]>();
    for (const d of deals) {
      if (!d.closer_id) continue;
      const entry = map.get(d.closer_id) ?? [];
      entry.push(d);
      map.set(d.closer_id, entry);
    }

    const instCash = new Map<string, number>();
    const instSetSet = new Map<string, boolean>(); // closer_id → had setter on any installment payment this period
    for (const ip of installmentPayments) {
      const inst = installmentMap.get(ip.installment_id);
      if (!inst?.closer_id) continue;
      instCash.set(inst.closer_id, (instCash.get(inst.closer_id) ?? 0) + ip.amount);
      if (inst.setter_id) instSetSet.set(inst.closer_id, true);
    }

    const allCloserIds = new Set([...map.keys(), ...instCash.keys()]);
    return Array.from(allCloserIds).map(cid => {
      const profile = profileMap.get(cid);
      const cDeals = map.get(cid) ?? [];
      const dealsCash = cDeals.reduce((s, d) => s + (d.cash_collected_upfront ?? 0), 0);
      const dealCommission = cDeals.reduce((s, d) => s + commissionForDeal(d, rates, profile?.commission_cap_pct), 0);
      const iCash = instCash.get(cid) ?? 0;
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
  }, [deals, installmentPayments, installmentMap, profileMap]);

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
            <h1 className="text-xl font-bold">Payout Ledger</h1>
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

        <RevenueTabBar />

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryChip label="Total payouts" value={money(totalPayouts)} accent="green" />
          <SummaryChip label="Setter payouts" value={money(setterRows.reduce((s, r) => s + r.total, 0))} />
          <SummaryChip label="Closer payouts" value={money(closerRows.reduce((s, r) => s + r.total, 0))} />
          <SummaryChip label="Deals in period" value={deals.length} />
        </div>

        {/* Setters table */}
        <section className="space-y-2">
          <h2 className="text-[11px] text-muted-foreground font-semibold">Setters — {(rates.setter_base * 100).toFixed(1)}% base (+ 1% if $5k week)</h2>
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
                        {r.weekBonus && <span className="ml-2 text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">$5k week</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.deals}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{money(r.cash)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.installmentCash > 0 ? money(r.installmentCash) : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.weekBonus ? `${((rates.setter_base + 0.01) * 100).toFixed(1)}%` : `${(rates.setter_base * 100).toFixed(1)}%`}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-400">{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-accent/30">
                    <td className="px-4 py-2.5 text-[10px] text-muted-foreground" colSpan={5}>Total setter payouts</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-400">{money(setterRows.reduce((s, r) => s + r.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* Closers table */}
        <section className="space-y-2">
          <h2 className="text-[11px] text-muted-foreground font-semibold">Closers — {(rates.new_close * 100).toFixed(0)}% close-only · {(rates.set_close * 100).toFixed(0)}% set+close</h2>
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
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.deals}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{money(r.cash)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.installmentCash > 0 ? money(r.installmentCash) : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{money(r.commission)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-400">{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-accent/30">
                    <td className="px-4 py-2.5 text-[10px] text-muted-foreground" colSpan={5}>Total closer payouts</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-400">{money(closerRows.reduce((s, r) => s + r.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* Installments context note */}
        {installmentPayments.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {installmentPayments.length} installment payment{installmentPayments.length !== 1 ? "s" : ""} collected in this period are included in commission calculations above.
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryChip({ label, value, accent }: { label: string; value: string | number; accent?: "green" }) {
  return (
    <div className="border border-border bg-card rounded-sm p-3 text-center">
      <div className={`text-lg font-bold ${accent === "green" ? "text-green-400" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
