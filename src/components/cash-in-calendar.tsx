import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { keys, invalidateForTables } from "@/lib/query-keys";
import { findWhopMatch } from "@/lib/mochi.functions";
import { ExpenseModal, type BusinessExpense } from "@/components/expense-modal";
import { SelectField } from "@/components/ui/select-field";
import { type Deal, type CommissionRates, DEFAULT_RATES } from "@/lib/revenue";
import {
  buildPayoutRows, basePayDateFor, basePayEligibleOn,
  type PayoutProfile, type PayoutInstallmentPayment, type PayoutInstallment,
} from "@/lib/payout-period";

type PayStatus = "upcoming" | "paid" | "late" | "missed" | "waived";
type Payment = {
  id: string;
  installment_id: string;
  sequence: number;
  amount: number;
  currency: string;
  due_date: string;
  status: PayStatus;
  paid_at: string | null;
  notes: string | null;
};
type OutItem = {
  label: string;
  short: string;
  amount: number;
  // What the entry IS decides what you can do with it in the drill-down
  // (founder 2026-07-28: click an out entry to pay/edit/remove it).
  kind: "expense" | "basePay" | "commission";
  sourceId?: string;
};

const STATUS_LABEL: Record<PayStatus, { label: string; cls: string }> = {
  upcoming: { label: "Upcoming", cls: "text-muted-foreground border-border bg-muted" },
  paid:     { label: "Paid",     cls: "text-success-fg border-success/25 bg-success-bg" },
  late:     { label: "Late",     cls: "text-warning-fg border-warning/25 bg-warning-bg" },
  missed:   { label: "Missed",   cls: "text-danger-fg border-danger/25 bg-danger-bg" },
  waived:   { label: "Waived",   cls: "text-muted-foreground border-border bg-zinc-500/5" },
};

const fmtMoney = (n: number, cur = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n || 0);

/**
 * Cash flow: installments coming in per day, and (founder/cofounder only)
 * money going out — recurring costs, per-member base pay after a full month
 * worked, and the two live semi-monthly team-commission totals on the 15th
 * and the last day of the month (founder-designed 2026-07-28). Drill-down
 * rows are actionable: expenses edit/remove, in-flows change status, one-off
 * costs (e.g. a refund) can be logged straight onto a day.
 * Self-fetching so it can live on the Calendar page and Money in alike.
 */
export function CashInCalendarCard({ foundersOnly = false }: { foundersOnly?: boolean } = {}) {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isFounderSide = roles.includes("founder") || roles.includes("cofounder");
  // On the Calendar page the whole card is founder/cofounder-only
  // (founder-directed 2026-07-28); on Money in the in-flows stay
  // visible to the money roles.
  const canSeeIn = foundersOnly
    ? isFounderSide
    : roles.some(r => ["admin", "closer", "founder", "cofounder"].includes(r));
  const canSeeMoneyOut = isFounderSide;
  // Writing installment rows is closer/admin territory (RLS enforces it);
  // don't render controls that would silently fail for anyone else.
  const canEditIn = roles.some(r => ["admin", "closer"].includes(r));

  const q = useQuery({
    queryKey: keys.cashCalendar,
    enabled: canSeeIn,
    queryFn: async () => {
      const [pRes, iRes, eRes, profRes, dealsRes, ratesRes, cofRes] = await Promise.all([
        (supabase.from("installment_payments" as never).select("*, installments!inner(students!inner(is_demo))").eq("installments.students.is_demo", false).order("due_date", { ascending: true }) as unknown as Promise<{ data: Payment[] | null }>),
        (supabase.from("installments" as never).select("id, student_name, setter_id, closer_id, students!inner(is_demo)").eq("students.is_demo", false) as unknown as Promise<{ data: (PayoutInstallment & { student_name: string })[] | null }>),
        // RLS blanks these for anyone who isn't founder/cofounder
        (supabase.from("business_expenses").select("*").eq("active", true) as unknown as Promise<{ data: BusinessExpense[] | null }>),
        supabase.from("profiles").select("id, display_name, commission_cap_pct, base_pay_monthly, base_pay_day, started_on").eq("is_demo", false),
        supabase.from("deals").select("id, closer_id, setter_id, total_value, cash_collected_upfront, deal_date, payment_type").eq("is_demo", false).is("voided_at", null).gte("deal_date", new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().slice(0, 10)),
        supabase.from("commission_rates").select("key, rate").eq("active", true),
        supabase.from("user_roles").select("user_id").eq("role", "cofounder"),
      ]);
      const rates: CommissionRates = { ...DEFAULT_RATES };
      for (const row of (ratesRes.data ?? [])) {
        const k = row.key as keyof CommissionRates;
        if (k in rates) (rates as Record<string, number>)[k] = Number(row.rate);
      }
      return {
        payments: (pRes.data ?? []) as Payment[],
        installments: (iRes.data ?? []) as (PayoutInstallment & { student_name: string })[],
        expenses: (eRes.data ?? []) as BusinessExpense[],
        profiles: (profRes.data ?? []) as PayoutProfile[],
        deals: (dealsRes.data ?? []) as Deal[],
        rates,
        cofounderIds: ((cofRes.data ?? []) as { user_id: string }[]).map(r => r.user_id),
      };
    },
  });

  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [expenseModal, setExpenseModal] = useState<{ open: boolean; editing: BusinessExpense | null; defaultDate?: string }>({ open: false, editing: null });

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayIso = iso(new Date());
  const payments = useMemo(() => q.data?.payments ?? [], [q.data]);
  const nameByInstallment = useMemo(
    () => new Map((q.data?.installments ?? []).map(i => [i.id, i.student_name])),
    [q.data],
  );

  const findWhopMatchFn = useServerFn(findWhopMatch);

  const setStatus = async (id: string, status: PayStatus) => {
    const row = payments.find(p => p.id === id);
    if (row?.status === "paid" && status !== "paid") return toast.error("Paid history is immutable");
    const patch: { status: PayStatus; paid_at: string | null } = { status, paid_at: null };
    if (status === "paid") {
      // Cash only counts once it's actually in Whop (founder rule 2026-07-14).
      // Check for a matching charge before letting the row flip to paid.
      if (row) {
        try {
          const m = await findWhopMatchFn({ data: { amount: Number(row.amount) } });
          if (m.connected && !m.matched) {
            const go = confirm(
              `No Whop payment of ~$${Number(row.amount).toLocaleString()} found in the last few days.\n\n` +
              `Money only counts once it's in Whop. Mark paid anyway? (Only do this for verified off-Whop money, e.g. a Wise transfer.)`,
            );
            if (!go) return;
          }
        } catch { /* verification unavailable · proceed, reconciliation will flag it */ }
      }
      patch.paid_at = new Date().toISOString();
    }
    const { error } = await (supabase.from("installment_payments" as never) as unknown as { update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    invalidateForTables(qc, ["installment_payments"]);
  };

  const removePayment = async (id: string) => {
    const row = payments.find(p => p.id === id);
    if (!row || row.status === "paid") return toast.error("Paid history cannot be waived");
    const reason = prompt("Why is this scheduled payment being waived?", "Schedule correction");
    if (!reason?.trim()) return;
    const notes = [row.notes, `Waived: ${reason.trim()}`].filter(Boolean).join("\n");
    const { error } = await (supabase.from("installment_payments" as any).update({ status: "waived", paid_at: null, notes }).eq("id", id) as any);
    if (error) return toast.error(error.message);
    toast.success("Payment waived · row preserved");
    invalidateForTables(qc, ["installment_payments"]);
  };

  const deleteExpense = async (e: BusinessExpense) => {
    const scope = e.recurring ? "This is a recurring cost: removing it removes it from every month." : "This removes the one-off cost.";
    if (!confirm(`Remove "${e.name}"? ${scope}`)) return;
    const { error } = await (supabase.from("business_expenses" as never) as unknown as { delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Expense removed");
    invalidateForTables(qc, ["business_expenses"]);
  };

  const byDay = useMemo(() => {
    const m = new Map<string, { expected: number; collected: number; rows: Payment[] }>();
    for (const p of payments) {
      if (p.status === "waived") continue;
      const cur = m.get(p.due_date) ?? { expected: 0, collected: 0, rows: [] };
      if (p.status === "paid") cur.collected += Number(p.amount) || 0;
      else cur.expected += Number(p.amount) || 0;
      cur.rows.push(p);
      m.set(p.due_date, cur);
    }
    return m;
  }, [payments]);

  const monthLabel = monthStart.toLocaleDateString("en", { month: "long", year: "numeric" });
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const firstDow = (monthStart.getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1))),
  ];

  // Money going out (founder/cofounder): recurring costs on their due day,
  // one-offs on their date, base pay per member on THEIR day once a full
  // month is worked, and the two semi-monthly commission totals (live).
  const outByDay = useMemo(() => {
    const m = new Map<string, { total: number; items: OutItem[] }>();
    if (!canSeeMoneyOut || !q.data) return m;
    const add = (day: string, item: OutItem) => {
      const cur = m.get(day) ?? { total: 0, items: [] };
      cur.total += item.amount;
      cur.items.push(item);
      m.set(day, cur);
    };
    const monthKey = iso(monthStart).slice(0, 7);
    const monthStartIso = `${monthKey}-01`;
    const monthEndIso = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`;

    for (const e of q.data.expenses) {
      const amount = Number(e.amount) || 0;
      if (amount <= 0) continue;
      if (e.recurring) {
        const day = Math.min(Math.max(e.due_day ?? 1, 1), daysInMonth);
        add(`${monthKey}-${String(day).padStart(2, "0")}`, { label: e.name + (e.category ? ` · ${e.category}` : ""), short: e.name, amount, kind: "expense", sourceId: e.id });
      } else if (e.one_off_date && e.one_off_date.slice(0, 7) === monthKey) {
        add(e.one_off_date, { label: e.name + (e.category ? ` · ${e.category}` : ""), short: e.name, amount, kind: "expense", sourceId: e.id });
      }
    }

    for (const p of q.data.profiles) {
      if ((p.base_pay_monthly ?? 0) <= 0) continue;
      const payDate = basePayDateFor(p, monthStartIso);
      if (!basePayEligibleOn(p, payDate)) continue;
      add(payDate, { label: `${p.display_name ?? "Team member"} · base pay`, short: p.display_name ?? "Base pay", amount: Number(p.base_pay_monthly), kind: "basePay", sourceId: p.id });
    }

    // Two live commission entries: mid-month and last day (founder-designed).
    const profileMap = new Map(q.data.profiles.map(p => [p.id, p]));
    const monthDeals = q.data.deals.filter(d => d.deal_date >= monthStartIso && d.deal_date <= monthEndIso);
    const monthPaid: PayoutInstallmentPayment[] = payments
      .filter(p => p.status === "paid" && p.paid_at && p.paid_at.slice(0, 7) === monthKey)
      .map(p => ({ id: p.id, amount: Number(p.amount), paid_at: p.paid_at, installment_id: p.installment_id }));
    const data = {
      deals: monthDeals,
      installmentPayments: monthPaid,
      installments: q.data.installments,
      profileMap,
      rates: q.data.rates,
      cofounderIds: new Set(q.data.cofounderIds),
    };
    const half = (start: string, end: string) => {
      const rows = buildPayoutRows(data, { start, end, isSecondHalf: end === monthEndIso });
      return rows.setterRows.reduce((s, r) => s + r.total, 0) + rows.closerRows.reduce((s, r) => s + r.total, 0);
    };
    const firstHalf = half(monthStartIso, `${monthKey}-15`);
    const secondHalf = half(`${monthKey}-16`, monthEndIso);
    if (firstHalf > 0.009) add(`${monthKey}-15`, { label: `Team commissions · ${monthLabel.split(" ")[0]} 1–15 (live)`, short: "Team commissions", amount: firstHalf, kind: "commission" });
    if (secondHalf > 0.009) add(monthEndIso, { label: `Team commissions · ${monthLabel.split(" ")[0]} 16–${daysInMonth} (live)`, short: "Team commissions", amount: secondHalf, kind: "commission" });
    return m;
  }, [q.data, canSeeMoneyOut, monthStart, daysInMonth, payments, monthLabel]);

  const expenseById = useMemo(
    () => new Map((q.data?.expenses ?? []).map(e => [e.id, e])),
    [q.data],
  );

  const monthTotals = useMemo(() => {
    let expected = 0, collected = 0, out = 0;
    for (const [day, v] of byDay) {
      if (day.slice(0, 7) === iso(monthStart).slice(0, 7)) { expected += v.expected; collected += v.collected; }
    }
    for (const v of outByDay.values()) out += v.total;
    return { expected, collected, out };
  }, [byDay, outByDay, monthStart]);

  const shiftMonth = (delta: number) => {
    setSelected(null);
    setMonthStart(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  if (!canSeeIn) return null;

  const sel = selected ? byDay.get(selected) : null;
  const selOut = selected ? outByDay.get(selected) : null;
  const compact = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(n)}`;
  const nameFor = (p: Payment) => nameByInstallment.get(p.installment_id) ?? "–";

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium text-sm">Cash flow</h2>
        <span className="text-xs text-muted-foreground">
          {fmtMoney(monthTotals.expected)} still expected · {fmtMoney(monthTotals.collected)} collected
          {canSeeMoneyOut && monthTotals.out > 0 && (
            <> · <span className="cal-out-general font-medium">{fmtMoney(monthTotals.out)} going out</span></>
          )}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[130px] text-center tabular-nums">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`b${i}`} />;
            const v = byDay.get(day);
            const out = outByDay.get(day);
            const isToday = day === todayIso;
            const isSel = day === selected;
            const overdue = v && v.expected > 0 && day < todayIso;
            const lines: { key: string; cls: string; amt: string; name: string }[] = [
              ...(v?.rows ?? []).map(p => ({
                key: p.id,
                cls: p.status === "paid" ? "text-success-fg" : (day < todayIso ? "text-danger-fg" : "text-warning-fg"),
                amt: `${p.status === "paid" ? "✓" : ""}${compact(Number(p.amount) || 0)}`,
                name: nameFor(p),
              })),
              ...(out?.items ?? []).map((it, j) => ({
                key: `o${j}`,
                cls: "cal-out-general",
                amt: `−${compact(it.amount)}`,
                name: it.short,
              })),
            ];
            const shown = lines.slice(0, 4);
            return (
              <button
                key={day}
                onClick={() => setSelected(isSel ? null : day)}
                className={`min-h-[64px] rounded-md border p-1.5 text-left align-top motion-safe:transition-colors ${
                  isSel ? "border-primary/40 bg-primary/10"
                  : v ? (overdue ? "border-danger/25 bg-danger-bg hover:bg-danger-bg/70" : v.expected > 0 ? "border-warning/25 bg-warning-bg/60 hover:bg-warning-bg" : "border-success/25 bg-success-bg/60 hover:bg-success-bg")
                  : out ? "border-danger/20 bg-danger-bg/40 hover:bg-danger-bg/60"
                  : "border-[var(--border)] bg-[var(--background)] hover:bg-muted/50"
                } ${isToday ? "ring-2 ring-ring/40" : ""}`}
              >
                <div className={`text-[10px] tabular-nums ${isToday ? "font-bold text-foreground" : "text-muted-foreground"}`}>{Number(day.slice(8, 10))}</div>
                {shown.map(l => (
                  <div key={l.key} className={`text-[10px] leading-4 tabular-nums truncate ${l.cls}`}>
                    {l.amt} <span className="text-[9px] opacity-70">{l.name}</span>
                  </div>
                ))}
                {lines.length > 4 && (
                  <div className="text-[9px] text-muted-foreground">+{lines.length - 4} more</div>
                )}
              </button>
            );
          })}
        </div>
        {canSeeMoneyOut && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> collected</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> expected, not confirmed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full cal-out-general-dot" /> money out (costs, base pay, commissions)</span>
            <span className="ml-auto opacity-70">commission totals are live · they move with cash until the period closes</span>
          </div>
        )}
        {selected && (sel || selOut || canSeeMoneyOut) && (
          <div className="mt-3 rounded-md border border-border bg-[var(--background)]">
            <div className="px-3 py-2 border-b border-border text-xs font-medium">
              {selected}
              {sel && <> · {fmtMoney(sel.expected)} expected{sel.collected > 0 ? ` · ${fmtMoney(sel.collected)} collected` : ""}</>}
              {selOut && <> · <span className="cal-out-general">{fmtMoney(selOut.total)} out</span></>}
            </div>
            <div className="divide-y divide-border">
              {sel?.rows.map(p => (
                <div key={p.id} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium">{nameFor(p)}</span>
                  <span className="text-muted-foreground">#{p.sequence} · {fmtMoney(Number(p.amount), p.currency)}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {canEditIn ? (
                      <>
                        <SelectField
                          value={p.status}
                          onChange={v => setStatus(p.id, v as PayStatus)}
                          options={(Object.keys(STATUS_LABEL) as PayStatus[]).map(s => ({ value: s, label: STATUS_LABEL[s].label }))}
                          disabled={p.status === "paid"}
                          className={`w-auto text-xs ${STATUS_LABEL[p.status].cls}`}
                        />
                        {p.status !== "paid" && p.status !== "waived" && (
                          <button onClick={() => removePayment(p.id)} className="text-danger-fg hover:underline inline-flex items-center gap-1" aria-label="Waive scheduled payment">
                            <Ban className="h-3 w-3" /> Waive
                          </button>
                        )}
                      </>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_LABEL[p.status].cls}`}>{STATUS_LABEL[p.status].label}</span>
                    )}
                  </div>
                </div>
              ))}
              {selOut?.items.map((it, i) => {
                const exp = it.kind === "expense" && it.sourceId ? expenseById.get(it.sourceId) : null;
                return (
                  <div key={`out-${i}`} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-medium cal-out-general">{it.label}</span>
                    <span className="text-muted-foreground">−{fmtMoney(it.amount)}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {exp && (
                        <>
                          <button
                            onClick={() => setExpenseModal({ open: true, editing: exp })}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => deleteExpense(exp)}
                            className="inline-flex items-center gap-1 text-danger-fg hover:underline"
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </button>
                        </>
                      )}
                      {it.kind === "basePay" && (
                        <Link to="/payouts" className="text-muted-foreground hover:text-foreground hover:underline">
                          Manage on Payouts →
                        </Link>
                      )}
                      {it.kind === "commission" && (
                        <span className="text-[10px] text-muted-foreground">live · tracks the payout ledger</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!sel && !selOut && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nothing scheduled on this day.</div>
              )}
            </div>
            {canSeeMoneyOut && (
              <div className="px-3 py-2 border-t border-border">
                <button
                  onClick={() => setExpenseModal({ open: true, editing: null, defaultDate: selected })}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add one-off cost on this day
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {expenseModal.open && (
        <ExpenseModal
          editing={expenseModal.editing}
          defaultOneOffDate={expenseModal.defaultDate}
          onClose={() => setExpenseModal({ open: false, editing: null })}
          onSaved={() => {
            setExpenseModal({ open: false, editing: null });
            invalidateForTables(qc, ["business_expenses"]);
          }}
        />
      )}
    </section>
  );
}
