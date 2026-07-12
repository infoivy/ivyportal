import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getFinanceRevenue } from "@/lib/mochi.functions";
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
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — ISA" }] }),
  component: FinancePage,
});

type Expense = {
  id: string; name: string; amount: number; recurring: boolean;
  due_day: number | null; one_off_date: string | null; category: string | null;
  notes: string | null; active: boolean;
};
type Payment = { amount: number; due_date: string; status: string };

// Profit split after expenses — the agreed structure.
const SPLIT = [
  { name: "Abdulrahmane", pct: 70 },
  { name: "Faizan", pct: 15 },
  { name: "Abu Bilal", pct: 15 },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd"); // local, not UTC — month boundaries must not shift

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
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  const isCurrentMonth = monthOffset === 0;
  const today = iso(now);

  const [expenseModal, setExpenseModal] = useState<{ open: boolean; editing: Expense | null }>({ open: false, editing: null });
  const [balanceDraft, setBalanceDraft] = useState<string>("");

  const pageQ = useQuery({
    queryKey: ["page", "finance", iso(monthStart)],
    queryFn: async () => {
      const in6mo = new Date(now.getFullYear(), now.getMonth() + 6, 0);
      const [expensesRes, dealsRes, paysRes, futurePaysRes, settingsRes] = await Promise.all([
        supabase.from("business_expenses").select("*").order("recurring", { ascending: false }).order("due_day"),
        supabase.from("deals").select("cash_collected_upfront, deal_date").gte("deal_date", iso(monthStart)).lte("deal_date", iso(monthEnd)),
        supabase.from("installment_payments").select("amount, due_date, status").gte("due_date", iso(monthStart)).lte("due_date", iso(monthEnd)),
        supabase.from("installment_payments").select("amount, due_date, status").eq("status", "upcoming").gte("due_date", iso(new Date(now.getFullYear(), now.getMonth(), 1))).lte("due_date", iso(in6mo)),
        supabase.from("founder_settings").select("id, processor_balance, processor_balance_updated_at").maybeSingle(),
      ]);
      return {
        expenses: (expensesRes.data ?? []) as Expense[],
        deals: (dealsRes.data ?? []) as { cash_collected_upfront: number; deal_date: string }[],
        monthPays: (paysRes.data ?? []) as Payment[],
        futurePays: (futurePaysRes.data ?? []) as Payment[],
        settings: settingsRes.data as { id: string; processor_balance: number | null; processor_balance_updated_at: string | null } | null,
      };
    },
  });
  const d = pageQ.data;

  const revQ = useQuery({
    queryKey: ["finance-revenue", iso(monthStart)],
    queryFn: () => getFinanceRevenue({ data: { from: iso(monthStart), to: iso(monthEnd) } }),
    staleTime: 5 * 60_000,
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
    const collected = d.deals.reduce((a, x) => a + (Number(x.cash_collected_upfront) || 0), 0)
      + d.monthPays.filter(p => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);
    const expectedRest = d.monthPays
      .filter(p => p.status === "upcoming" && (!isCurrentMonth || p.due_date >= today))
      .reduce((a, p) => a + Number(p.amount), 0);
    const projectedIn = collected + expectedRest;

    const profitSoFar = collected - expensesTotal;
    const profitProjected = projectedIn - expensesTotal;

    // day-by-day flow for the rest of the month (projection = scheduled items only)
    const flow: { date: string; label: string; amount: number; kind: "in" | "out" }[] = [];
    d.monthPays
      .filter(p => p.status === "upcoming" && (!isCurrentMonth || p.due_date >= today))
      .forEach(p => flow.push({ date: p.due_date, label: "Installment due", amount: Number(p.amount), kind: "in" }));
    monthExpenses
      .filter(e => !isCurrentMonth || e.date >= today)
      .forEach(e => flow.push({ date: e.date, label: e.name, amount: Number(e.amount), kind: "out" }));
    flow.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "in" ? -1 : 1));

    const startBalance = d.settings?.processor_balance != null ? Number(d.settings.processor_balance) : null;
    let running = startBalance ?? 0;
    const flowWithBalance = flow.map(f => {
      running += f.kind === "in" ? f.amount : -f.amount;
      return { ...f, balance: running };
    });

    // MRR: upcoming installment income per month, next 6 months
    const mrrByMonth = new Map<string, number>();
    d.futurePays.forEach(p => {
      const key = p.due_date.slice(0, 7);
      mrrByMonth.set(key, (mrrByMonth.get(key) ?? 0) + Number(p.amount));
    });
    const mrrSeries = Array.from({ length: 6 }, (_, i) => {
      const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = iso(m).slice(0, 7);
      return { month: m.toLocaleString("en", { month: "short" }), value: mrrByMonth.get(key) ?? 0 };
    });
    const mrrNow = mrrSeries[0]?.value ?? 0;

    return {
      monthExpenses, expensesTotal, collected, expectedRest, projectedIn,
      profitSoFar, profitProjected, flowWithBalance, startBalance, mrrSeries, mrrNow,
      endBalance: startBalance != null ? running : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, monthOffset]);

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

  const deleteExpense = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("business_expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["page", "finance"] });
  };

  const monthLabel = monthStart.toLocaleString("en", { month: "long", year: "numeric" });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
            <Wallet className="h-3 w-3" /> Founder finance
          </div>
          <h1 className="text-display text-foreground">Finance</h1>
          <p className="text-body text-muted-foreground mt-1">Cash in, expenses out, profit split, and recurring revenue.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setMonthOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground tabular-nums min-w-[130px] text-center">{monthLabel}</span>
          <Button size="icon" variant="ghost" onClick={() => setMonthOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
          {monthOffset !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => setMonthOffset(0)}>Today</Button>
          )}
        </div>
      </header>

      {/* Top strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard label="Cash in · Whop" value={rev?.connected ? money(rev.whopGross) : calc ? money(calc.collected) : "—"} sub={rev?.connected ? `${rev.whopCount} payments · ${money(rev.whopNet)} net` : undefined} icon={<ArrowDownRight className="h-3.5 w-3.5" />} />
        <StatCard label="Expenses" value={calc ? money(calc.expensesTotal) : "—"} sub={calc ? `${calc.monthExpenses.length} items` : undefined} icon={<ArrowUpRight className="h-3.5 w-3.5" />} />
        <StatCard label="Profit (projected)" value={calc ? money(calc.profitProjected) : "—"} sub={calc ? `${money(calc.profitSoFar)} banked so far` : undefined} icon={<TrendingUp className="h-3.5 w-3.5" />} tone={calc && calc.profitProjected < 0 ? "danger" : "default"} />
        <StatCard label="MRR (scheduled)" value={calc ? money(calc.mrrNow) : "—"} sub="installments due this month" icon={<PiggyBank className="h-3.5 w-3.5" />} />
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
                {rev.unmatchedWhop.length === 0 && <p className="text-[12px] text-muted-foreground">Nothing — all Whop money is accounted for.</p>}
                <div className="space-y-1">
                  {rev.unmatchedWhop.map((t, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-[13px] rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="truncate">{t.customer}{t.product ? <span className="text-muted-foreground"> · {t.product}</span> : null}</span>
                      <span className="tabular-nums shrink-0">{money(t.amount)} <span className="text-muted-foreground">{t.date.slice(5)}</span></span>
                    </div>
                  ))}
                </div>
                {rev.unmatchedWhop.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">Money that arrived without a logged close — e.g. sent in from Wise, or a close nobody logged.</p>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Logged, not in Whop ({rev.unmatchedLogged.length})
                </div>
                {rev.unmatchedLogged.length === 0 && <p className="text-[12px] text-muted-foreground">Nothing — every logged close has Whop money behind it.</p>}
                <div className="space-y-1">
                  {rev.unmatchedLogged.map((l, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-[13px] rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="truncate">{l.student} <span className="text-muted-foreground">· {l.kind}</span></span>
                      <span className="tabular-nums shrink-0">{money(l.amount)} <span className="text-muted-foreground">{l.date.slice(5)}</span></span>
                    </div>
                  ))}
                </div>
                {rev.unmatchedLogged.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">Logged revenue with no Whop payment — collected elsewhere (Wise/bank) or double-logged.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* MRR chart */}
        <div className="card-surface p-5">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-sm font-semibold">Recurring revenue</h2>
            <span className="text-caption text-muted-foreground">next 6 months · scheduled installments</span>
          </div>
          <div className="text-[28px] font-medium tabular-nums tracking-[-0.02em] mb-3">{calc ? money(calc.mrrNow) : "—"}</div>
          <div className="h-40">
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
            <span className="text-caption text-muted-foreground">after expenses · {monthLabel}</span>
          </div>
          <div className="text-[28px] font-medium tabular-nums tracking-[-0.02em] mb-4">
            {calc ? money(Math.max(0, calc.profitProjected)) : "—"}
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
                  {calc ? money(Math.max(0, calc.profitProjected) * (p.pct / 100)) : "—"}
                </span>
              </div>
            ))}
          </div>
          {calc && calc.profitSoFar !== calc.profitProjected && (
            <p className="text-caption text-muted-foreground mt-4">
              On banked cash only: {SPLIT.map(p => `${p.name} ${money(Math.max(0, calc.profitSoFar) * (p.pct / 100))}`).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Processor balance + upcoming flow */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">Money flow — rest of {monthStart.toLocaleString("en", { month: "long" })}</h2>
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
              <div key={i} className="grid grid-cols-[90px_minmax(0,1fr)_110px_120px] gap-3 items-center py-2 text-[13px]">
                <span className="text-muted-foreground tabular-nums">{format(new Date(f.date + "T00:00:00"), "EEE d MMM")}</span>
                <span className="truncate">{f.label}</span>
                <span className={`text-right tabular-nums ${f.kind === "in" ? "text-success-fg" : "text-danger-fg"}`}>
                  {f.kind === "in" ? "+" : "−"}{money(f.amount)}
                </span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {calc.startBalance != null ? money(f.balance) : "—"}
                </span>
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
        {d && d.expenses.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-6 text-center">No expenses yet — add your software, contractors, and ad spend.</p>
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
                  {e.recurring ? `monthly · day ${e.due_day ?? 1}` : `one-off · ${e.one_off_date ?? "—"}`}
                </span>
                <span className={`text-caption text-right hidden sm:block ${e.active ? "text-success-fg" : "text-muted-foreground"}`}>{e.active ? "active" : "paused"}</span>
                <span className="flex justify-end gap-1">
                  <button onClick={() => setExpenseModal({ open: true, editing: e })} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteExpense(e.id)} className="p-1.5 rounded text-muted-foreground hover:text-danger-fg hover:bg-danger-bg"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {expenseModal.open && (
        <ExpenseModal
          editing={expenseModal.editing}
          onClose={() => setExpenseModal({ open: false, editing: null })}
          onSaved={() => { setExpenseModal({ open: false, editing: null }); qc.invalidateQueries({ queryKey: ["page", "finance"] }); }}
        />
      )}
    </div>
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

function ExpenseModal({ editing, onClose, onSaved }: { editing: Expense | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [recurring, setRecurring] = useState(editing?.recurring ?? true);
  const [dueDay, setDueDay] = useState(editing?.due_day ? String(editing.due_day) : "1");
  const [oneOffDate, setOneOffDate] = useState(editing?.one_off_date ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(editing?.category ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    const amt = Number(amount);
    if (!(amt >= 0)) return toast.error("Amount must be ≥ 0");
    const day = Math.max(1, Math.min(31, Number(dueDay) || 1));
    setSaving(true);
    const payload = {
      name: name.trim(),
      amount: amt,
      recurring,
      due_day: recurring ? day : null,
      one_off_date: recurring ? null : oneOffDate,
      category: category.trim() || null,
      active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await (supabase as any).from("business_expenses").update(payload).eq("id", editing.id)
      : await (supabase as any).from("business_expenses").insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Expense updated" : "Expense added");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Close CRM" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($ / month)</Label>
              <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 99" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm pt-6">
              <Checkbox checked={recurring} onCheckedChange={v => setRecurring(!!v)} /> Recurring monthly
            </label>
            {recurring ? (
              <div className="space-y-1.5">
                <Label>Due day of month</Label>
                <Input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DateField value={oneOffDate} onChange={setOneOffDate} clearable={false} className="h-9" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category (optional)</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="software / team / ads" />
            </div>
            <label className="flex items-center gap-2 text-sm pt-6">
              <Checkbox checked={active} onCheckedChange={v => setActive(!!v)} /> Active
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add expense"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
