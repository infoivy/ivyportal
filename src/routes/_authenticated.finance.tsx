import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceRevenue, findWhopMatch } from "@/lib/mochi.functions";
import { calcMonthPayouts } from "@/lib/payouts-calc";
import { MoneyShell } from "@/components/money-shell";
import { ExpenseModal } from "@/components/expense-modal";
import { DEFAULT_RATES } from "@/lib/revenue";
import { money } from "@/lib/revenue";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Wallet, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, TrendingUp,
  ArrowDownRight, ArrowUpRight, PiggyBank,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance · ISA" }] }),
  component: FinancePage,
});

type Expense = {
  id: string; name: string; amount: number; recurring: boolean;
  due_day: number | null; one_off_date: string | null; category: string | null;
  notes: string | null; active: boolean;
};
type Payment = {
  id?: string; installment_id?: string; sequence?: number;
  amount: number; due_date: string; status: string;
  notes?: string | null;
  installments?: { student_name: string | null } | null;
};

// Profit split after expenses — the agreed structure.
const SPLIT = [
  { name: "Abdulrahmane", pct: 70 },
  { name: "Faizan", pct: 15 },
  { name: "Abu Bilal", pct: 15 },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd"); // local, not UTC · month boundaries must not shift

function FinancePage() {
  const { roles } = useAuth();
  if (!roles.includes("founder") && !roles.includes("cofounder")) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">Founder or co-founder access required.</div>
      </div>
    );
  }
  return <FinanceInner />;
}

function FinanceInner() {
  const qc = useQueryClient();
  const [monthOffset, setMonthOffset] = useState(0);
  // Scheduled-revenue chart pages in 6-month windows anchored to the viewed
  // month (founder: "allow me to click the next button").
  const [mrrPage, setMrrPage] = useState(0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  const isCurrentMonth = monthOffset === 0;
  const mrrFrom = new Date(now.getFullYear(), now.getMonth() + monthOffset + mrrPage * 6, 1);
  const mrrTo = new Date(now.getFullYear(), now.getMonth() + monthOffset + mrrPage * 6 + 6, 0);
  const today = iso(now);

  const [expenseModal, setExpenseModal] = useState<{ open: boolean; editing: Expense | null }>({ open: false, editing: null });
  const [balanceDraft, setBalanceDraft] = useState<string>("");

  const pageQ = useQuery({
    queryKey: ["page", "finance", iso(monthStart), mrrPage],
    queryFn: async () => {
      const in6mo = new Date(now.getFullYear(), now.getMonth() + 6, 0);
      const [expensesRes, dealsRes, paysRes, futurePaysRes, settingsRes, paidRes, instRes, profRes, ratesRes, cofRes] = await Promise.all([
        supabase.from("business_expenses").select("*").order("recurring", { ascending: false }).order("due_day"),
        supabase.from("deals").select("id, closer_id, setter_id, cash_collected_upfront, deal_date").eq("is_demo", false).is("voided_at", null).gte("deal_date", iso(monthStart)).lte("deal_date", iso(monthEnd)),
        supabase.from("installment_payments").select("id, installment_id, sequence, amount, due_date, status, notes, installments!inner(student_name, students!inner(is_demo))").eq("installments.students.is_demo", false).gte("due_date", iso(monthStart)).lte("due_date", iso(monthEnd)),
        supabase.from("installment_payments").select("amount, due_date, status, installments!inner(students!inner(is_demo))").eq("installments.students.is_demo", false).not("status", "in", "(waived,refunded)").gte("due_date", iso(mrrFrom)).lte("due_date", iso(mrrTo)),
        supabase.from("founder_settings").select("id, processor_balance, processor_balance_updated_at, monthly_cash_goal, base_pay_day").maybeSingle(),
        supabase.from("installment_payments").select("amount, paid_at, installment_id, installments!inner(students!inner(is_demo))").eq("installments.students.is_demo", false).eq("status", "paid").gte("paid_at", iso(monthStart) + "T00:00:00").lte("paid_at", iso(monthEnd) + "T23:59:59").not("paid_at", "is", null),
        supabase.from("installments").select("id, setter_id, closer_id, students!inner(is_demo)").eq("students.is_demo", false),
        supabase.from("profiles").select("id, display_name, commission_cap_pct, base_pay_monthly, base_pay_day").eq("is_demo", false),
        supabase.from("commission_rates").select("key, rate").eq("active", true),
        supabase.from("user_roles").select("user_id").eq("role", "cofounder"),
      ]);
      const rates = { ...DEFAULT_RATES };
      for (const row of ratesRes.data ?? []) {
        const k = row.key as keyof typeof rates;
        if (k in rates) (rates as Record<string, number>)[k] = Number(row.rate);
      }
      return {
        expenses: (expensesRes.data ?? []) as Expense[],
        deals: (dealsRes.data ?? []) as { id: string; closer_id: string | null; setter_id: string | null; cash_collected_upfront: number; deal_date: string }[],
        monthPays: (paysRes.data ?? []) as unknown as Payment[],
        futurePays: (futurePaysRes.data ?? []) as unknown as Payment[],
        settings: settingsRes.data as { id: string; processor_balance: number | null; processor_balance_updated_at: string | null; monthly_cash_goal: number | null } | null,
        paidPays: (paidRes.data ?? []) as { amount: number; paid_at: string | null; installment_id: string }[],
        installments: (instRes.data ?? []) as { id: string; setter_id: string | null; closer_id: string | null }[],
        profiles: (profRes.data ?? []) as { id: string; commission_cap_pct: number | null; base_pay_monthly: number | null }[],
        rates,
        cofounderIds: new Set(((cofRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id)),
      };
    },
  });
  const d = pageQ.data;

  const revQ = useQuery({
    queryKey: ["finance-revenue", iso(monthStart)],
    queryFn: () => getFinanceRevenue({ data: { from: iso(monthStart), to: iso(monthEnd) } }),
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000, // founder: cash must update on its own
    retry: 1,
  });
  const rev = revQ.data;

  useEffect(() => {
    if (d?.settings?.processor_balance != null) setBalanceDraft(String(d.settings.processor_balance));
  }, [d?.settings?.processor_balance]);


  // ── month math ──────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    if (!d) return null;
    const daysInMonth = monthEnd.getDate();
    const activeExpenses = d.expenses.filter(e => e.active);

    const monthExpenses = activeExpenses.flatMap(e => {
      if (e.recurring && e.due_day) {
        const day = Math.min(e.due_day, daysInMonth);
        return [{ ...e, date: iso(new Date(monthStart.getFullYear(), monthStart.getMonth(), day)) }];
      }
      if (!e.recurring && e.one_off_date && e.one_off_date >= iso(monthStart) && e.one_off_date <= iso(monthEnd)) {
        return [{ ...e, date: e.one_off_date }];
      }
      return [];
    }).sort((a, b) => a.date.localeCompare(b.date));

    const expensesTotal = monthExpenses.reduce((a, e) => a + Number(e.amount), 0);
    // Base pay presents as a business expense (founder-directed 2026-07-28)
    // but stays OUT of expensesTotal — calcMonthPayouts already counts it, so
    // profit would double-subtract otherwise. Each member lands on THEIR own
    // pay day (profiles.base_pay_day, anchored to their start date).
    const basePayRows = (d.profiles as { id: string; display_name?: string | null; base_pay_monthly?: number | null; base_pay_day?: number | null }[])
      .filter(p => (p.base_pay_monthly ?? 0) > 0)
      .map(p => {
        const day = Math.min(Math.max(Number(p.base_pay_day) || 1, 1), daysInMonth);
        return {
          id: p.id,
          name: p.display_name ?? "Team member",
          amount: Number(p.base_pay_monthly),
          day,
          date: iso(new Date(monthStart.getFullYear(), monthStart.getMonth(), day)),
        };
      });
    // Collected = upfronts logged this month + installments PAID this month
    // (by paid_at — a payment due in May but paid in June is June cash).
    const collected = d.deals.reduce((a, x) => a + (Number(x.cash_collected_upfront) || 0), 0)
      + d.paidPays.reduce((a, p) => a + Number(p.amount), 0);
    const expectedRest = d.monthPays
      .filter(p => p.status === "upcoming" && (!isCurrentMonth || p.due_date >= today))
      .reduce((a, p) => a + Number(p.amount), 0);
    const projectedIn = collected + expectedRest;

    const profitSoFar = collected - expensesTotal;
    const profitProjected = projectedIn - expensesTotal;

    // day-by-day flow for the rest of the month (projection = scheduled items only)
    const flow: { date: string; label: string; amount: number; kind: "in" | "out"; pay?: Payment; expense?: Expense; basePay?: boolean }[] = [];
    d.monthPays
      .filter(p => p.status === "upcoming" && (!isCurrentMonth || p.due_date >= today))
      .forEach(p => flow.push({ date: p.due_date, label: `${p.installments?.student_name ?? "Installment"} · #${p.sequence ?? "?"} due`, amount: Number(p.amount), kind: "in", pay: p }));
    monthExpenses
      .filter(e => !isCurrentMonth || e.date >= today)
      .forEach(e => flow.push({ date: e.date, label: e.name, amount: Number(e.amount), kind: "out", expense: e }));
    basePayRows
      .filter(b => !isCurrentMonth || b.date >= today)
      .forEach(b => flow.push({ date: b.date, label: `${b.name} · base pay`, amount: b.amount, kind: "out", basePay: true }));
    flow.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "in" ? -1 : 1));

    const startBalance = d.settings?.processor_balance != null ? Number(d.settings.processor_balance) : null;
    let running = startBalance ?? 0;
    const flowWithBalance = flow.map(f => {
      running += f.kind === "in" ? f.amount : -f.amount;
      return { ...f, balance: running };
    });

    // Scheduled installment revenue per due-month: PAID + still-due together
    // (the old version counted only unpaid rows, so it decayed to zero as
    // people actually paid — founder-reported 2026-07-28). Waived excluded.
    const mrrByMonth = new Map<string, { total: number; collected: number }>();
    d.futurePays.forEach(p => {
      const key = p.due_date.slice(0, 7);
      const cur = mrrByMonth.get(key) ?? { total: 0, collected: 0 };
      cur.total += Number(p.amount);
      if (p.status === "paid") cur.collected += Number(p.amount);
      mrrByMonth.set(key, cur);
    });
    const mrrSeries = Array.from({ length: 6 }, (_, i) => {
      const m = new Date(mrrFrom.getFullYear(), mrrFrom.getMonth() + i, 1);
      const key = iso(m).slice(0, 7);
      const bucket = mrrByMonth.get(key) ?? { total: 0, collected: 0 };
      return { month: m.toLocaleString("en", { month: "short" }), value: bucket.total, collected: bucket.collected };
    });
    const mrrNow = mrrSeries[0] ?? { month: "", value: 0, collected: 0 };

    return {
      monthExpenses, expensesTotal, basePayRows, collected, expectedRest, projectedIn,
      profitSoFar, profitProjected, flowWithBalance, startBalance, mrrSeries, mrrNow,
      endBalance: startBalance != null ? running : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, monthOffset, mrrPage]);
  // Team payouts for the month — commissions (incl. co-founder caps) + base
  // pay. Profit is what's left AFTER these, not just after expenses.
  const payouts = useMemo(() => {
    if (!d) return null;
    return calcMonthPayouts({
      deals: d.deals as never,
      installmentPayments: d.paidPays,
      installments: d.installments,
      profiles: d.profiles,
      rates: d.rates,
      cofounderIds: d.cofounderIds,
    });
  }, [d]);

  // Whop is the cash-in source of truth, and NET is the real number — gross
  // includes processor fees we never receive (founder rule 2026-07-14).
  // Profit and the split are built on net.
  const cashIn = rev?.connected ? rev.whopNet : calc?.collected ?? 0;
  const payoutsTotal = payouts?.total ?? 0;
  const profitSoFar = cashIn - (calc?.expensesTotal ?? 0) - payoutsTotal;
  const profitProjected = cashIn + (calc?.expectedRest ?? 0) - (calc?.expensesTotal ?? 0) - payoutsTotal;

  const saveBalance = async () => {
    const val = Number(balanceDraft);
    if (Number.isNaN(val)) return toast.error("Enter a number");
    const patch = { processor_balance: val, processor_balance_updated_at: new Date().toISOString() };
    const { error } = d?.settings?.id
      ? await (supabase as any).from("founder_settings").update(patch).eq("id", d.settings.id)
      : await (supabase as any).from("founder_settings").insert(patch);
    if (error) return toast.error(error.message);
    toast.success("Balance saved");
    qc.invalidateQueries({ queryKey: ["page", "finance"] });
  };

  const { roles: myRoles } = useAuth();
  // Installment writes are closer/admin territory (RLS enforces it).
  const canEditMoney = myRoles.includes("admin") || myRoles.includes("closer");
  const [openFlow, setOpenFlow] = useState<number | null>(null);
  const [payDraft, setPayDraft] = useState<{ amount: string; due: string } | null>(null);
  const findWhopMatchFn = useServerFn(findWhopMatch);

  const PAY_STATUSES = ["upcoming", "paid", "late", "missed", "waived"] as const;
  const setPayStatus = async (pay: Payment, status: string) => {
    if (!pay.id) return;
    if (pay.status === "paid" && status !== "paid") return toast.error("Paid history is immutable");
    const patch: { status: string; paid_at: string | null } = { status, paid_at: null };
    if (status === "paid") {
      // Cash only counts once it's actually in Whop (founder rule 2026-07-14).
      try {
        const m = await findWhopMatchFn({ data: { amount: Number(pay.amount) } });
        if (m.connected && !m.matched) {
          const go = confirm(
            `No Whop payment of ~$${Number(pay.amount).toLocaleString()} found in the last few days.\n\n` +
            `Money only counts once it's in Whop. Mark paid anyway? (Only for verified off-Whop money, e.g. a Wise transfer.)`,
          );
          if (!go) return;
        }
      } catch { /* verification unavailable · reconciliation will flag it */ }
      patch.paid_at = new Date().toISOString();
    }
    const { error } = await (supabase.from("installment_payments") as never as { update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).update(patch).eq("id", pay.id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    invalidateForTables(qc, ["installment_payments"]);
  };

  const savePayment = async (pay: Payment) => {
    if (!pay.id || !payDraft) return;
    if (pay.status === "paid") return toast.error("Paid history is immutable");
    const amt = Number(payDraft.amount);
    if (!(amt > 0) || !payDraft.due) return toast.error("Amount and due date required");
    const { error } = await (supabase.from("installment_payments") as never as { update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).update({ amount: amt, due_date: payDraft.due }).eq("id", pay.id);
    if (error) return toast.error(error.message);
    toast.success("Installment updated");
    setOpenFlow(null); setPayDraft(null);
    invalidateForTables(qc, ["installment_payments"]);
  };

  const waivePayment = async (pay: Payment) => {
    if (!pay.id) return;
    if (pay.status === "paid") return toast.error("Paid history cannot be waived");
    const reason = prompt(`Why is this ${money(Number(pay.amount))} installment for ${pay.installments?.student_name ?? "this student"} being waived?`, "Schedule correction");
    if (!reason?.trim()) return;
    const notes = [pay.notes, `Waived: ${reason.trim()}`].filter(Boolean).join("\n");
    const { error } = await (supabase.from("installment_payments") as any).update({ status: "waived", paid_at: null, notes }).eq("id", pay.id);
    if (error) return toast.error(error.message);
    toast.success("Installment waived · row preserved");
    setOpenFlow(null);
    invalidateForTables(qc, ["installment_payments"]);
  };

  const waiveFollowing = async (pay: Payment) => {
    if (!pay.installment_id || pay.sequence == null) return;
    const name = pay.installments?.student_name ?? "this student";
    const reason = prompt(`Why are this and all later unpaid installments for ${name} being waived?`, "Schedule ended");
    if (!reason?.trim()) return;
    const { data, error } = await (supabase.from("installment_payments") as any)
      .update({ status: "waived", paid_at: null, notes: `Waived with future schedule: ${reason.trim()}` })
      .eq("installment_id", pay.installment_id).gte("sequence", pay.sequence).neq("status", "paid").select("id");
    if (error) return toast.error(error.message);
    toast.success(`${(data ?? []).length} installment${(data ?? []).length === 1 ? "" : "s"} waived for ${name}`);
    setOpenFlow(null);
    invalidateForTables(qc, ["installment_payments"]);
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("business_expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    invalidateForTables(qc, ["business_expenses"]);
  };

  const monthLabel = monthStart.toLocaleString("en", { month: "long", year: "numeric" });

  return (
    <MoneyShell
      actions={
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthOffset(o => o - 1)} className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted motion-safe:transition-colors" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium px-3 py-2 border border-border rounded-md bg-card whitespace-nowrap tabular-nums min-w-[130px] text-center">{monthLabel}</span>
          <button onClick={() => setMonthOffset(o => o + 1)} className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted motion-safe:transition-colors" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
          {monthOffset !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => setMonthOffset(0)}>Today</Button>
          )}
        </div>
      }
    >

      {/* Top strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard
          label="Cash in · Whop net"
          value={rev?.connected ? money(rev.whopNet) : calc ? money(calc.collected) : "–"}
          sub={(() => {
            const goal = d?.settings?.monthly_cash_goal;
            if (!goal || !isCurrentMonth) return rev?.connected ? `${rev.whopCount} payments · ${money(rev.whopGross)} gross` : undefined;
            const dayOfMonth = now.getDate();
            const pace = dayOfMonth > 0 ? (cashIn / dayOfMonth) * monthEnd.getDate() : 0;
            return `goal ${money(goal)} · pace ${money(Math.round(pace))} · ${money(rev?.whopGross ?? 0)} gross`;
          })()}
          icon={<ArrowDownRight className="h-3.5 w-3.5" />}
        />
        <StatCard label="Expenses + payouts" value={calc ? money(calc.expensesTotal + payoutsTotal) : "–"} sub={calc && payouts ? `${money(calc.expensesTotal + payouts.basePay)} expenses incl. base pay · ${money(payouts.setterCommission + payouts.closerCommission)} commissions` : undefined} icon={<ArrowUpRight className="h-3.5 w-3.5" />} />
        <StatCard label="Profit (projected)" value={calc ? money(profitProjected) : "–"} sub={calc ? `${money(profitSoFar)} so far · after expenses & payouts` : undefined} icon={<TrendingUp className="h-3.5 w-3.5" />} tone={calc && profitProjected < 0 ? "danger" : "default"} />
        <StatCard label="Installment revenue" value={calc ? money(calc.mrrNow.value) : "–"} sub={calc ? `${money(calc.mrrNow.collected)} collected · ${money(calc.mrrNow.value - calc.mrrNow.collected)} still due` : undefined} icon={<PiggyBank className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scheduled installment revenue chart */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h2 className="text-sm font-semibold">Scheduled installment revenue</h2>
            <span className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setMrrPage(p => p - 1)} aria-label="Previous 6 months"><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <span className="text-caption text-muted-foreground whitespace-nowrap">
                {mrrPage === 0 ? "next 6 months" : `${mrrPage > 0 ? "+" : ""}${mrrPage * 6} to ${mrrPage * 6 + 6} months`}
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setMrrPage(p => p + 1)} aria-label="Next 6 months"><ChevronRight className="h-3.5 w-3.5" /></Button>
            </span>
          </div>
          <div className="text-[28px] font-medium tabular-nums tracking-[-0.02em] leading-none">{calc ? money(calc.mrrNow.value) : "–"}</div>
          <div className="mt-1.5 text-caption text-muted-foreground">
            {calc ? `${money(calc.mrrNow.collected)} collected · ${money(calc.mrrNow.value - calc.mrrNow.collected)} still due · paid installments stay counted` : ""}
          </div>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={calc?.mrrSeries ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [money(v), "scheduled"]}
                />
                <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#mrrFill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit split */}
        <div className="card-surface p-5">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-sm font-semibold">Profit split</h2>
            <span className="text-caption text-muted-foreground">after expenses & payouts · {monthLabel}</span>
          </div>
          <div className="text-[28px] font-medium tabular-nums tracking-[-0.02em] mb-4">
            {calc ? money(Math.max(0, profitProjected)) : "–"}
            <span className="text-[13px] text-muted-foreground font-normal ml-2">projected profit</span>
          </div>
          <div className="space-y-2.5">
            {SPLIT.map(p => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-[13px] w-28 shrink-0">{p.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${p.pct}%`, opacity: p.pct === 70 ? 1 : 0.55 }} />
                </div>
                <span className="text-caption text-muted-foreground w-8 text-right">{p.pct}%</span>
                <span className="text-[13px] tabular-nums font-medium w-24 text-right">
                  {calc ? money(Math.max(0, profitProjected) * (p.pct / 100)) : "–"}
                </span>
              </div>
            ))}
          </div>
          {calc && profitSoFar !== profitProjected && (
            <p className="text-caption text-muted-foreground mt-4">
              On banked cash only: {SPLIT.map(p => `${p.name} ${money(Math.max(0, profitSoFar) * (p.pct / 100))}`).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Processor balance + upcoming flow */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">Money flow · rest of {monthStart.toLocaleString("en", { month: "long" })}</h2>
            <p className="text-caption text-muted-foreground mt-0.5">Scheduled installments in, expenses out. PIF closes land on top of this.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-caption text-muted-foreground whitespace-nowrap">Processor balance today ($)</Label>
            <Input type="number" value={balanceDraft} onChange={e => setBalanceDraft(e.target.value)} className="h-8 w-32 tabular-nums" placeholder="0" />
            <Button size="sm" variant="outline" onClick={saveBalance}>Save</Button>
          </div>
        </div>
        {calc && calc.flowWithBalance.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-6 text-center">Nothing scheduled for the rest of the month.</p>
        ) : (
          <div className="divide-y divide-[var(--accent)]">
            {calc?.flowWithBalance.map((f, i) => (
              <div key={i}>
                <button
                  onClick={() => { setOpenFlow(openFlow === i ? null : i); setPayDraft(f.pay ? { amount: String(f.pay.amount), due: f.pay.due_date } : null); }}
                  className={`w-full grid grid-cols-[90px_minmax(0,1fr)_110px_120px] gap-3 items-center py-2 text-[13px] text-left hover:bg-muted/40 motion-safe:transition-colors ${openFlow === i ? "bg-muted/40" : ""}`}
                >
                  <span className="text-muted-foreground tabular-nums">{format(new Date(f.date + "T00:00:00"), "EEE d MMM")}</span>
                  <span className="truncate">{f.label}</span>
                  <span className={`text-right tabular-nums ${f.kind === "in" ? "text-success-fg" : "text-danger-fg"}`}>
                    {f.kind === "in" ? "+" : "−"}{money(f.amount)}
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {calc.startBalance != null ? money(f.balance) : "–"}
                  </span>
                </button>
                {openFlow === i && f.pay && (
                  <div className="mx-1 mb-2 rounded-md border border-border bg-[var(--background)] px-3 py-3 space-y-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium">{f.pay.installments?.student_name ?? "Unknown student"}</span>
                      <span className="text-muted-foreground">installment #{f.pay.sequence ?? "?"}</span>
                      {canEditMoney && f.pay.status !== "refunded" ? (
                        <SelectField
                          value={f.pay.status}
                          onChange={v => void setPayStatus(f.pay!, v)}
                          options={PAY_STATUSES.map(st => ({ value: st, label: st }))}
                          disabled={f.pay.status === "paid"}
                          className="w-auto text-xs capitalize"
                        />
                      ) : (
                        <span className="text-caption text-muted-foreground capitalize">{f.pay.status}</span>
                      )}
                      <Link to="/revenue" search={{ tab: "plans" } as never} className="ml-auto text-caption text-primary hover:underline">
                        Open full plan →
                      </Link>
                    </div>
                    {canEditMoney && payDraft && f.pay.status !== "paid" && (
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                          <Label className="text-caption text-muted-foreground">Amount ($)</Label>
                          <Input type="number" min="0" step="0.01" value={payDraft.amount} onChange={e => setPayDraft(dft => dft ? { ...dft, amount: e.target.value } : dft)} className="h-8 w-28 tabular-nums" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-caption text-muted-foreground">Due date</Label>
                          <DateField value={payDraft.due} onChange={v => setPayDraft(dft => dft ? { ...dft, due: v } : dft)} clearable={false} className="h-8" />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => void savePayment(f.pay!)}>Save changes</Button>
                        <span className="flex-1" />
                        <button onClick={() => void waivePayment(f.pay!)} className="text-caption text-danger-fg hover:underline">Waive this installment</button>
                        <button onClick={() => void waiveFollowing(f.pay!)} className="text-caption text-danger-fg hover:underline">Waive this + all following</button>
                      </div>
                    )}
                  </div>
                )}
                {openFlow === i && f.expense && (
                  <div className="mx-1 mb-2 rounded-md border border-border bg-[var(--background)] px-3 py-2.5 flex flex-wrap items-center gap-3 text-[13px]">
                    <span className="text-muted-foreground">{f.expense.recurring ? `Recurring · day ${f.expense.due_day ?? 1} monthly` : `One-off · ${f.expense.one_off_date ?? "–"}`}{f.expense.category ? ` · ${f.expense.category}` : ""}</span>
                    <span className="ml-auto flex items-center gap-3">
                      <button onClick={() => setExpenseModal({ open: true, editing: f.expense! })} className="text-caption text-muted-foreground hover:text-foreground">Edit</button>
                      <button onClick={() => void deleteExpense(f.expense!.id)} className="text-caption text-danger-fg hover:underline">Remove</button>
                    </span>
                  </div>
                )}
                {openFlow === i && f.basePay && (
                  <div className="mx-1 mb-2 rounded-md border border-border bg-[var(--background)] px-3 py-2.5 flex flex-wrap items-center gap-3 text-[13px]">
                    <span className="text-muted-foreground">Monthly base pay · anchored to their start date, first payment after a full month.</span>
                    <Link to="/payouts" className="ml-auto text-caption text-primary hover:underline">Manage on Payouts →</Link>
                  </div>
                )}
              </div>
            ))}
            {calc && calc.endBalance != null && (
              <div className="grid grid-cols-[90px_minmax(0,1fr)_110px_120px] gap-3 items-center py-2.5 text-[13px] font-medium">
                <span />
                <span>Projected end of month</span>
                <span />
                <span className="text-right tabular-nums">{money(calc.endBalance)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expense tracker */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">Business expenses</h2>
            <p className="text-caption text-muted-foreground mt-0.5">Recurring bills hit every month on their day; one-offs hit once.</p>
          </div>
          <Button size="sm" onClick={() => setExpenseModal({ open: true, editing: null })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add expense
          </Button>
        </div>
        {d && d.expenses.length === 0 && (calc?.basePayRows.length ?? 0) === 0 ? (
          <p className="text-[13px] text-muted-foreground py-6 text-center">No expenses yet · add your software, contractors, and ad spend.</p>
        ) : (
          <div className="divide-y divide-[var(--accent)]">
            {d?.expenses.map(e => (
              <div key={e.id} className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:grid-cols-[minmax(0,1.4fr)_110px_150px_100px_70px] gap-3 items-center py-2.5 text-[13px] ${!e.active ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <span className="truncate font-medium">{e.name}</span>
                  {e.category && <span className="ml-2 text-caption text-muted-foreground">{e.category}</span>}
                </div>
                <span className="tabular-nums text-right">{money(Number(e.amount))}</span>
                <span className="text-muted-foreground text-right hidden sm:block">
                  {e.recurring ? `monthly · day ${e.due_day ?? 1}` : `one-off · ${e.one_off_date ?? "–"}`}
                </span>
                <span className={`text-caption text-right hidden sm:block ${e.active ? "text-success-fg" : "text-muted-foreground"}`}>{e.active ? "active" : "paused"}</span>
                <span className="flex justify-end gap-1">
                  <button onClick={() => setExpenseModal({ open: true, editing: e })} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteExpense(e.id)} className="p-1.5 rounded text-muted-foreground hover:text-danger-fg hover:bg-danger-bg"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            ))}
            {/* Team base pay: part of the monthly out-flow, managed on Payouts */}
            {calc?.basePayRows.map(b => (
              <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:grid-cols-[minmax(0,1.4fr)_110px_150px_100px_70px] gap-3 items-center py-2.5 text-[13px]">
                <div className="min-w-0">
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="ml-2 text-caption text-muted-foreground">team base pay</span>
                </div>
                <span className="tabular-nums text-right">{money(b.amount)}</span>
                <span className="text-muted-foreground text-right hidden sm:block">monthly · day {b.day}</span>
                <span className="text-caption text-right hidden sm:block text-success-fg">active</span>
                <span className="flex justify-end">
                  <Link to={"/payouts" as string} className="text-caption text-primary hover:underline px-1.5 py-1">edit →</Link>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Reconciliation: Whop vs what the team logged ──────────────── */}
      {rev?.connected && (
        <div className="card-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold">Revenue reconciliation</h2>
            <span className="text-caption text-muted-foreground">
              Whop {money(rev.whopGross)} · logged {money(rev.loggedTotal)} ·{" "}
              <span className={rev.gap === 0 ? "text-success-fg" : "text-warning-fg"}>
                gap {rev.gap >= 0 ? "+" : "−"}{money(Math.abs(rev.gap))}
              </span>
            </span>
          </div>
          {rev.gap === 0 && rev.unmatchedWhop.length === 0 && rev.unmatchedLogged.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Every Whop payment matches a logged close or installment. Clean month.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  In Whop, not logged ({rev.unmatchedWhop.length})
                </div>
                {rev.unmatchedWhop.length === 0 && <p className="text-[12px] text-muted-foreground">Nothing · all Whop money is accounted for.</p>}
                <div className="space-y-1">
                  {rev.unmatchedWhop.map((t, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-[13px] rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="truncate">{t.customer}{t.product ? <span className="text-muted-foreground"> · {t.product}</span> : null}</span>
                      <span className="tabular-nums shrink-0">{money(t.amount)} <span className="text-muted-foreground">{t.date.slice(5)}</span></span>
                    </div>
                  ))}
                </div>
                {rev.unmatchedWhop.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">Money that arrived without a logged close · e.g. sent in from Wise, or a close nobody logged.</p>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Logged, not in Whop ({rev.unmatchedLogged.length})
                </div>
                {rev.unmatchedLogged.length === 0 && <p className="text-[12px] text-muted-foreground">Nothing · every logged close has Whop money behind it.</p>}
                <div className="space-y-1">
                  {rev.unmatchedLogged.map((l, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-[13px] rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="truncate">{l.student} <span className="text-muted-foreground">· {l.kind}</span></span>
                      <span className="tabular-nums shrink-0">{money(l.amount)} <span className="text-muted-foreground">{l.date.slice(5)}</span></span>
                    </div>
                  ))}
                </div>
                {rev.unmatchedLogged.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">Logged revenue with no Whop payment · collected elsewhere (Wise/bank) or double-logged.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {expenseModal.open && (
        <ExpenseModal
          editing={expenseModal.editing}
          onClose={() => setExpenseModal({ open: false, editing: null })}
          onSaved={() => { setExpenseModal({ open: false, editing: null }); invalidateForTables(qc, ["business_expenses"]); }}
        />
      )}
    </MoneyShell>
  );
}

function StatCard({ label, value, sub, icon, tone = "default" }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; tone?: "default" | "danger";
}) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-2">{icon} {label}</div>
      <div className={`text-[22px] font-medium tabular-nums tracking-[-0.02em] leading-none ${tone === "danger" ? "text-danger-fg" : "text-foreground"}`}>{value}</div>
      {sub && <div className="text-caption text-muted-foreground mt-1.5">{sub}</div>}
    </div>
  );
}
