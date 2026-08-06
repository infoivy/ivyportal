import { createFileRoute, Link } from "@tanstack/react-router";
import { getWhopCashWindow } from "@/lib/mochi.functions";
import { matchSetterForProspect } from "@/lib/calendar.functions";
import { useEffect, useMemo, useState } from "react";
import { PageSkeleton } from "@/components/ui/skeletons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import {
  Deal,
  CommissionRates,
  DEFAULT_RATES,
  commissionForDeal,
  closerRateLabel,
  setterCommissionForDeal,
  setterWeekBonusIds,
  money,
  isSelfSet, } from "@/lib/revenue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PaymentPlansSection } from "@/components/revenue/payment-plans-section";
import { toast } from "sonner";
import {
  Plus, DollarSign, TrendingUp, Trophy, ClipboardList, Pencil, Ban, Trash2,
  Save, Percent, Download,
} from "lucide-react";
import { MoneyShell } from "@/components/money-shell";
import { exportToCsv } from "@/lib/csv";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line } from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { BreakdownBar } from "@/components/ui/breakdown-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { type DateRange, rangeFor, daysBetween } from "@/components/range-picker";
import { DateField } from "@/components/ui/date-field";
import { SelectField } from "@/components/ui/select-field";
import { BlurMoney } from "@/components/blur-money";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({ meta: [{ title: "Money in · ISA Team" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: "deals" | "plans"; q?: string } => ({
    tab: search.tab === "plans" ? "plans" : search.tab === "deals" ? "deals" : undefined,
    ...(typeof search.q === "string" && search.q ? { q: search.q } : {}),
  }),
  component: RevenuePage,
});

type Profile = { id: string; display_name: string | null; commission_cap_pct?: number | null };
type Student = { id: string; full_name: string };
type PaymentType = Deal["payment_type"];

function RevenuePage() {
  const { roles } = useAuth();
  const canView = roles.includes("admin") || roles.includes("closer") || roles.includes("founder");
  if (!canView) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">Founder, admin, or closer access required.</div>
      </div>
    );
  }
  return <RevenueInner />;
}

function RevenueInner() {
  const search = Route.useSearch();
  const tab = search.tab ?? "deals";
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const canLog = isAdmin || roles.includes("closer");

  const [deals, setDeals] = useState<Deal[]>([]);
  const [rates, setRates] = useState<CommissionRates>(DEFAULT_RATES);
  const [rateRows, setRateRows] = useState<{ id: string; key: string; label: string; rate: number; active: boolean }[]>([]);
  const [closers, setClosers] = useState<Profile[]>([]);
  const [setters, setSetters] = useState<Profile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  // 30 days by default (founder 2026-07-28: 24h opened on "No data" everywhere)
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeFor("30d"));
  const [compare, setCompare] = useState(false);

  const fetchPage = async () => {
    const [dealsRes, ratesRes, rolesRes, studentsRes] = await Promise.all([
      supabase.from("deals").select("*").eq("is_demo", false).is("voided_at", null).order("deal_date", { ascending: false }).limit(500),
      supabase.from("commission_rates").select("*").eq("active", true),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["closer", "coach", "admin", "setter"]),
      supabase.from("students").select("id, full_name").eq("is_demo", false).is("archived_at" as never, null).order("full_name"),
    ]);

    const r: CommissionRates = { ...DEFAULT_RATES };
    const rows: { id: string; key: string; label: string; rate: number; active: boolean }[] = [];
    for (const row of ratesRes.data ?? []) {
      rows.push({ id: row.id, key: row.key, label: row.label, rate: Number(row.rate), active: row.active });
      const k = row.key as keyof CommissionRates;
      if (k in r) (r as Record<string, number>)[k] = Number(row.rate);
    }

    const closerIds = Array.from(
      new Set((rolesRes.data ?? []).filter((r) => r.role !== "setter").map((r) => r.user_id)),
    );
    const setterIds = Array.from(
      new Set((rolesRes.data ?? []).filter((r) => r.role === "setter" || r.role === "admin").map((r) => r.user_id)),
    );
    const allIds = Array.from(new Set([...closerIds, ...setterIds]));
    let closerList: Profile[] = [];
    let setterList: Profile[] = [];
    if (allIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, commission_cap_pct").eq("is_demo", false).in("id", allIds);
      const profMap = new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
      closerList = closerIds.map((id) => profMap.get(id)).filter(Boolean) as Profile[];
      setterList = setterIds.map((id) => profMap.get(id)).filter(Boolean) as Profile[];
    }
    return {
      deals: (dealsRes.data ?? []) as Deal[],
      rates: r, rateRows: rows, closerList, setterList,
      students: (studentsRes.data ?? []) as Student[],
    };
  };

  const qc = useQueryClient();
  const pageQ = useQuery({ queryKey: ["page", "revenue"], queryFn: fetchPage });
  useEffect(() => {
    if (!pageQ.data) return;
    setDeals(pageQ.data.deals);
    setRates(pageQ.data.rates);
    setRateRows(pageQ.data.rateRows);
    setClosers(pageQ.data.closerList);
    setSetters(pageQ.data.setterList);
    setStudents(pageQ.data.students);
    setLoading(false);
  }, [pageQ.data]);

  const fromISO = dateRange.from.toISOString().slice(0, 10);
  const toISO = dateRange.to.toISOString().slice(0, 10);
  const days = daysBetween(dateRange);

  const rangeDeals = useMemo(
    () => deals.filter((d) => d.deal_date >= fromISO && d.deal_date <= toISO),
    [deals, fromISO, toISO],
  );
  const prevRangeDeals = useMemo(() => {
    if (!compare) return [];
    const prevTo = new Date(dateRange.from); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1);
    const pf = prevFrom.toISOString().slice(0, 10);
    const pt = prevTo.toISOString().slice(0, 10);
    return deals.filter((d) => d.deal_date >= pf && d.deal_date <= pt);
  }, [deals, compare, dateRange.from, days]);

  // Whop is the cash-in source of truth — NET of fees; deals stay as the
  // logged-attribution view. Auto-refreshes so the number is never stale.
  const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const whopFrom = localIso(dateRange.from);
  const whopTo = localIso(dateRange.to);
  const whopQ = useQuery({
    queryKey: ["revenue-whop", whopFrom, whopTo],
    queryFn: () => getWhopCashWindow({ data: { from: whopFrom, to: whopTo } }),
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  // Incomplete Whop read (txn cap / window past the 90d feed) → fall back to logged cash
  const whopCash = whopQ.data?.connected && !whopQ.data.incomplete ? whopQ.data.net : null;

  const stats = useMemo(() => {
    const cash = rangeDeals.reduce((a, d) => a + Number(d.cash_collected_upfront), 0);
    const booked = rangeDeals.reduce((a, d) => a + Number(d.total_value), 0);
    const count = rangeDeals.length;
    const avg = count > 0 ? booked / count : 0;
    return { cash, booked, count, avg };
  }, [rangeDeals]);

  const prevStats = useMemo(() => {
    const cash = prevRangeDeals.reduce((a, d) => a + Number(d.cash_collected_upfront), 0);
    const booked = prevRangeDeals.reduce((a, d) => a + Number(d.total_value), 0);
    const count = prevRangeDeals.length;
    return { cash, booked, count };
  }, [prevRangeDeals]);

  const cashSparkData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of rangeDeals) map[d.deal_date] = (map[d.deal_date] || 0) + Number(d.cash_collected_upfront);
    const from = new Date(fromISO + "T00:00:00");
    return Array.from({ length: days }, (_, i) => {
      const dt = new Date(from); dt.setDate(dt.getDate() + i);
      return map[dt.toISOString().slice(0, 10)] ?? 0;
    });
  }, [rangeDeals, fromISO, days]);

  const paymentBreakdown = useMemo(() => {
    const pif = rangeDeals.filter((d) => d.payment_type === "pif").length;
    const deposit = rangeDeals.filter((d) => d.payment_type === "deposit").length;
    const split = rangeDeals.filter((d) => d.payment_type === "split").length;
    return [
      { label: "PIF", value: pif, color: "#525252" },
      { label: "Deposit", value: deposit, color: "#3b82f6" },
      { label: "Split", value: split, color: "#f59e0b" },
    ];
  }, [rangeDeals]);

  // Per-closer breakdown (MTD)
  const perCloser = useMemo(() => {
    const closerMap = new Map(closers.map((c) => [c.id, c]));
    const map = new Map<string, { cash: number; booked: number; deals: number; setCloseDeals: number; commission: number }>();
    for (const d of rangeDeals) {
      const closer = closerMap.get(d.closer_id);
      const c = map.get(d.closer_id) ?? { cash: 0, booked: 0, deals: 0, setCloseDeals: 0, commission: 0 };
      c.cash += Number(d.cash_collected_upfront);
      c.booked += Number(d.total_value);
      c.deals += 1;
      if (isSelfSet(d)) c.setCloseDeals += 1;
      c.commission += commissionForDeal(d, rates, closer?.commission_cap_pct);
      map.set(d.closer_id, c);
    }
    const nameMap = new Map(closers.map((c) => [c.id, c.display_name || "Unknown"]));
    return Array.from(map.entries())
      .map(([id, v]) => ({ closer_id: id, name: nameMap.get(id) ?? "Unknown", ...v }))
      .sort((a, b) => b.cash - a.cash);
  }, [rangeDeals, closers, rates]);

  // Per-setter breakdown (MTD)
  const perSetter = useMemo(() => {
    const weekBonusIds = setterWeekBonusIds(rangeDeals);
    const map = new Map<string, { cash: number; deals: number; weekBonus: boolean; commission: number }>();
    for (const d of rangeDeals) {
      if (!d.setter_id || isSelfSet(d)) continue; // self-set = closer's 15%, no setter credit
      const c = map.get(d.setter_id) ?? { cash: 0, deals: 0, weekBonus: false, commission: 0 };
      c.cash += Number(d.cash_collected_upfront);
      c.deals += 1;
      c.commission += setterCommissionForDeal(d, rates);
      if (weekBonusIds.has(d.setter_id)) c.weekBonus = true;
      map.set(d.setter_id, c);
    }
    const nameMap = new Map(setters.map((s) => [s.id, s.display_name || "Unknown"]));
    return Array.from(map.entries())
      .map(([id, v]) => {
        const bonusComm = v.weekBonus ? v.cash * 0.01 : 0;
        return { setter_id: id, name: nameMap.get(id) ?? "Unknown", ...v, commission: v.commission + bonusComm };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [rangeDeals, setters, rates]);

  // Monthly / weekly / daily trend
  const [trendMode, setTrendMode] = useState<"monthly" | "weekly" | "daily">("monthly");
  const trend = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; cash: number; booked: number; deals: number }[] = [];
    if (trendMode === "monthly") {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const inRange = deals.filter((x) => {
          const dd = new Date(x.deal_date + "T00:00:00");
          return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth();
        });
        buckets.push({
          label: d.toLocaleString("en-US", { month: "short" }),
          cash: inRange.reduce((a, x) => a + Number(x.cash_collected_upfront), 0),
          booked: inRange.reduce((a, x) => a + Number(x.total_value), 0),
          deals: inRange.length,
        });
      }
    } else if (trendMode === "weekly") {
      for (let i = 7; i >= 0; i--) {
        const anchor = new Date(now); anchor.setDate(anchor.getDate() - i * 7);
        const start = new Date(anchor); const day = start.getDay();
        start.setDate(start.getDate() - ((day + 6) % 7)); start.setHours(0,0,0,0);
        const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
        const inRange = deals.filter((x) => {
          const dd = new Date(x.deal_date + "T00:00:00");
          return dd >= start && dd <= end;
        });
        buckets.push({
          label: `${start.toLocaleString("en-US", { month: "short", day: "numeric" })}`,
          cash: inRange.reduce((a, x) => a + Number(x.cash_collected_upfront), 0),
          booked: inRange.reduce((a, x) => a + Number(x.total_value), 0),
          deals: inRange.length,
        });
      }
    } else {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
        const iso = d.toISOString().slice(0, 10);
        const inRange = deals.filter((x) => x.deal_date === iso);
        buckets.push({
          label: d.toLocaleString("en-US", { month: "short", day: "numeric" }),
          cash: inRange.reduce((a, x) => a + Number(x.cash_collected_upfront), 0),
          booked: inRange.reduce((a, x) => a + Number(x.total_value), 0),
          deals: inRange.length,
        });
      }
    }
    return buckets;
  }, [deals, trendMode]);

  const voidDeal = async (id: string) => {
    const reason = prompt("Why is this deal being voided?", "Incorrect revenue record");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("deals").update({
      voided_at: new Date().toISOString(),
      voided_by: user?.id ?? null,
      void_reason: reason.trim(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deal voided · original record preserved");
    invalidateForTables(qc, ["deals", "installments", "installment_payments"]);
  };

  if (loading) return <PageSkeleton />;

  return (
    <MoneyShell
      actions={
        <>
          {tab === "deals" && (
            <FilterToolbar value={dateRange} onChange={setDateRange} compare={compare} onCompareToggle={() => setCompare((c) => !c)} />
          )}
          {canLog && (
            <Button onClick={() => { setEditing(null); setLogOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Log a close
            </Button>
          )}
        </>
      }
    >

      {/* Deals vs payment plans — one merged Money-in destination
          (founder-approved 2026-07-28) */}
      <div className="inline-flex rounded-lg bg-muted p-[3px]">
        <Link
          to="/revenue"
          search={{ tab: "deals" } as never}
          className={`text-[13px] font-medium px-3 py-1.5 rounded-[8px] motion-safe:transition-colors ${tab === "deals" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Deals
        </Link>
        <Link
          to="/revenue"
          search={{ tab: "plans" } as never}
          className={`text-[13px] font-medium px-3 py-1.5 rounded-[8px] motion-safe:transition-colors ${tab === "plans" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Payment plans
        </Link>
      </div>

      {tab === "plans" ? <PaymentPlansSection initialQuery={search.q} /> : (<>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={whopCash != null ? "Cash collected · Whop net" : "Cash collected"}
          value={<BlurMoney>{whopQ.isLoading ? "…" : money(whopCash ?? stats.cash)}</BlurMoney>}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          accent
          sparkData={cashSparkData}
          delta={whopCash == null && compare ? { value: stats.cash - prevStats.cash, format: "money" } : undefined}
          noData={!whopQ.isLoading && whopCash == null && rangeDeals.length === 0}
        />
        <StatCard
          label="Booked value"
          value={<BlurMoney>{money(stats.booked)}</BlurMoney>}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          delta={compare ? { value: stats.booked - prevStats.booked, format: "money" } : undefined}
          noData={rangeDeals.length === 0}
          hint="full deal values closed in this window, collected or not"
        />
        <StatCard
          label="Deals"
          value={String(stats.count)}
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          delta={compare ? { value: stats.count - prevStats.count, format: "count" } : undefined}
          noData={rangeDeals.length === 0}
        />
        <StatCard
          label="Avg deal size"
          value={<BlurMoney>{money(stats.avg)}</BlurMoney>}
          icon={<Trophy className="h-3.5 w-3.5" />}
          noData={rangeDeals.length === 0}
        />
      </div>

      {/* Payment type breakdown */}
      <div className="card-surface p-4">
        <BreakdownBar segments={paymentBreakdown} title="Payment types" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Sales trend</h3>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-muted-foreground/40" /> booked</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-success" /> cash</span>
              </div>
              <div className="flex gap-1">
                {(["monthly", "weekly", "daily"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTrendMode(m)}
                    className={`text-[13px] font-medium px-2.5 py-1 rounded-md motion-safe:transition-colors ${trendMode === m ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  >
                    {m === "monthly" ? "6mo" : m === "weekly" ? "8wk" : "30d"}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} barGap={2}>
                  <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval="preserveStartEnd" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={34} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-overlay)" }}
                    formatter={(v: number, k: string) => (k === "deals" ? [v, "deals"] : [money(v), k === "cash" ? "cash" : "booked"])}
                  />
                  <Bar dataKey="booked" fill="var(--color-muted-foreground)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  <Bar dataKey="cash" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Same buckets, different lens — fills the column beside the taller leaderboards */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Deals & average size</h3>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-muted-foreground/40" /> deals</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-3 rounded-full bg-success" /> avg size</span>
                <span>{trendMode === "monthly" ? "6mo" : trendMode === "weekly" ? "8wk" : "30d"}</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend.map((t) => ({ ...t, avg: t.deals ? Math.round(t.booked / t.deals) : 0 }))}>
                  <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval="preserveStartEnd" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis yAxisId="deals" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <YAxis yAxisId="avg" orientation="right" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={34} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-overlay)" }}
                    formatter={(v: number, k: string) => (k === "deals" ? [v, "deals"] : [money(v), "avg deal size"])}
                  />
                  <Bar yAxisId="deals" dataKey="deals" fill="var(--color-muted-foreground)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  <Line yAxisId="avg" dataKey="avg" stroke="var(--success)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
      </div>

      {/* Per-person payouts live in the Payouts ledger (Revenue → Payouts tab) */}
      <Link
        to="/payouts"
        className="card-surface p-4 flex items-center justify-between hover:bg-muted/30 motion-safe:transition-colors"
      >
        <div>
          <div className="text-body font-medium text-foreground">Per-closer & per-setter payouts</div>
          <div className="text-caption text-muted-foreground mt-0.5">Full commission ledger for the current pay period (11th → 11th)</div>
        </div>
        <span className="text-caption text-primary">Open ledger →</span>
      </Link>

      {/* Recent deals */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">Recent deals</h3>
          <button
            onClick={() => exportToCsv("deals.csv", deals.map(d => ({
              date: d.deal_date, student: d.student_name,
              total_value: d.total_value, cash_upfront: d.cash_collected_upfront,
              payment_type: d.payment_type, program: d.program_type,
            })))}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground motion-safe:transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-[12px] text-muted-foreground/70 bg-card">
              <tr>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-left px-4 py-2.5">Student</th>
                <th className="text-left px-4 py-2.5">Closer</th>
                <th className="text-left px-4 py-2.5">Setter</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-right px-4 py-2.5">Value</th>
                <th className="text-right px-4 py-2.5">Cash</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {deals.slice(0, 25).map((d) => {
                const canEdit = isAdmin || d.created_by === user?.id;
                const closer = closers.find((c) => c.id === d.closer_id);
                const closerName = closer?.display_name || "–";
                const setterName = d.setter_id
                  ? setters.find((s) => s.id === d.setter_id)?.display_name || "–"
                  : "–";
                const rateLabel = closerRateLabel(d, rates, closer?.commission_cap_pct);
                return (
                  <tr key={d.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{d.deal_date}</td>
                    <td className="px-4 py-3 font-medium">{d.student_name}</td>
                    <td className="px-4 py-3">{closerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{setterName}</td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] bg-muted rounded-full px-2 py-0.5">
                        {rateLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{money(Number(d.total_value))}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(Number(d.cash_collected_upfront))}</td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setLogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" asChild title="Open this student's payment plan">
                            <Link to="/revenue" search={{ tab: "plans", q: d.student_name ?? "" } as never}>
                              <ClipboardList className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {isAdmin && (
                            <Button size="icon" variant="ghost" onClick={() => voidDeal(d.id)} className="text-destructive" title="Void deal and preserve history">
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {deals.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-8">No deals logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <a href="/admin#commission" className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted">
            Edit commission rates → Admin settings
          </a>
        </div>
      )}

      </>)}

      <LogDealDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        closers={closers}
        setters={setters}
        students={students}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        editing={editing}
        onSaved={() => { setLogOpen(false); setEditing(null); invalidateForTables(qc, ["deals", "installments", "installment_payments", "students"]); }}
      />
    </MoneyShell>
  );
}

function LogDealDialog({
  open, onOpenChange, closers, setters, students, currentUserId, isAdmin, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  closers: Profile[];
  setters: Profile[];
  students: Student[];
  currentUserId?: string;
  isAdmin: boolean;
  editing: Deal | null;
  onSaved: () => void;
}) {
  const [studentMode, setStudentMode] = useState<"existing" | "new">("existing");
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState("");
  const [closerId, setCloserId] = useState<string>("");
  const [setterId, setSetterId] = useState<string>("");
  const [programType, setProgramType] = useState("");
  const [totalValue, setTotalValue] = useState<string>("0");
  const [cashUpfront, setCashUpfront] = useState<string>("0");
  const [paymentType, setPaymentType] = useState<PaymentType>("pif");
  const [dealDate, setDealDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [contractUrl, setContractUrl] = useState("");
  const [setterMatch, setSetterMatch] = useState<{ name: string; date: string } | null>(null);
  const [fathomUrl, setFathomUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [autoCreateStudent, setAutoCreateStudent] = useState(true);
  const [autoCreateInstallment, setAutoCreateInstallment] = useState(true);
  const [saving, setSaving] = useState(false);

  // Installment schedule builder (mirrors StudentPaymentSetup)
  type ScheduleRow = { id: string; amount: string; due_date: string; payment_method: string };
  const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };
  const [scheduleMode, setScheduleMode] = useState<"even" | "custom">("even");
  const [numInstallments, setNumInstallments] = useState<string>("3");
  const [firstDueDate, setFirstDueDate] = useState<string>(nextMonth);
  const [frequency, setFrequency] = useState<"monthly" | "biweekly" | "weekly">("monthly");
  const [customRows, setCustomRows] = useState<ScheduleRow[]>([]);
  const addCustomRow = () => setCustomRows(rs => [...rs, { id: crypto.randomUUID(), amount: "", due_date: nextMonth(), payment_method: "" }]);
  const removeCustomRow = (id: string) => setCustomRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs);
  const updateCustomRow = (id: string, patch: Partial<ScheduleRow>) => setCustomRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setStudentMode(editing.student_id ? "existing" : "new");
      setStudentId(editing.student_id ?? "");
      setStudentName(editing.student_name);
      setCloserId(editing.closer_id);
      setSetterId(editing.setter_id ?? "");
      setProgramType(editing.program_type);
      setTotalValue(String(editing.total_value));
      setCashUpfront(String(editing.cash_collected_upfront));
      setPaymentType(editing.payment_type);
      setDealDate(editing.deal_date);
      setContractUrl(editing.contract_url ?? "");
      setFathomUrl(editing.fathom_url ?? "");
      setNotes(editing.notes ?? "");
      setAutoCreateStudent(false);
      setAutoCreateInstallment(false);
    } else {
      setStudentMode("existing");
      setStudentId("");
      setStudentName("");
      setCloserId(currentUserId ?? "");
      setSetterId("");
      setProgramType("");
      setTotalValue("0");
      setCashUpfront("0");
      setPaymentType("pif");
      setDealDate(new Date().toISOString().slice(0, 10));
      setContractUrl("");
      setFathomUrl("");
      setNotes("");
      setAutoCreateStudent(true);
      setAutoCreateInstallment(true);
      setScheduleMode("even");
      setNumInstallments("3");
      setFirstDueDate(nextMonth());
      setFrequency("monthly");
      setCustomRows([{ id: crypto.randomUUID(), amount: "", due_date: nextMonth(), payment_method: "" }]);
      setProgramType("1:1 Pathway");
    }

  }, [open, editing, currentUserId]);

  const matchSetterFn = useServerFn(matchSetterForProspect);
  useEffect(() => {
    // Close name matches a tracked set → the setter fills in automatically
    // (founder 2026-07-30). Manual choice always wins; the effect never
    // overwrites a non-empty selection.
    const name = (studentMode === "existing" ? students.find(st => st.id === studentId)?.full_name : studentName)?.trim();
    if (!name || name.length < 3 || setterId || editing) return;
    const t = setTimeout(() => {
      void matchSetterFn({ data: { name } })
        .then(m => {
          if (m.matched) {
            setSetterId(m.setter_id);
            setSetterMatch({ name: m.setter_name, date: m.set_date });
          }
        })
        .catch(() => { /* matching is best-effort */ });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, studentName, studentMode, editing]);

  const submit = async () => {
    if (!currentUserId) return;
    let finalStudentId: string | null = studentMode === "existing" ? studentId || null : null;
    let finalStudentName = studentName.trim();
    if (studentMode === "existing" && studentId) {
      finalStudentName = students.find((s) => s.id === studentId)?.full_name ?? "";
    }
    if (!finalStudentName) return toast.error("Student name required");
    if (!closerId) return toast.error("Closer required");
    const tv = Number(totalValue) || 0;
    const cu = Number(cashUpfront) || 0;
    if (tv <= 0) return toast.error("Total value must be > 0");
    if (cu > tv) return toast.error("Cash upfront cannot exceed total value");
    const remaining = Math.max(0, tv - cu);
    const planWanted = !editing && paymentType !== "pif" && autoCreateInstallment && remaining > 0;
    const cleanCustom = customRows.filter(r => Number(r.amount) > 0);
    if (planWanted && scheduleMode === "custom") {
      if (cleanCustom.length === 0) return toast.error("Add at least one payment row to the schedule");
      if (cleanCustom.some(r => !r.due_date)) return toast.error("Each payment row needs a due date");
      const scheduled = cleanCustom.reduce((a, r) => a + Number(r.amount), 0);
      if (Math.abs(scheduled - remaining) > 0.01) return toast.error(`Schedule ($${scheduled.toLocaleString()}) must match the remaining balance ($${remaining.toLocaleString()})`);
    }

    setSaving(true);

    // Pathway drives the coaching allowance: 1:1 gets ten 1-on-1 calls,
    // Group Expertise runs on group calls only.
    const callsAllotted = programType === "1:1 Pathway" ? 10 : 0;

    // Optionally create student first
    if (!editing && studentMode === "new" && autoCreateStudent) {
      const { data: newStu, error } = await supabase
        .from("students")
        .insert({
          full_name: finalStudentName,
          phase: "onboarding",
          status: "active",
          payment_state: paymentType === "pif" ? "paid_in_full" : "installments",
          calls_included: callsAllotted,
          calls_allotted: callsAllotted,
        })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        return toast.error("Create student: " + error.message);
      }
      finalStudentId = newStu.id;
    } else if (!editing && finalStudentId) {
      // Existing student (e.g. signed up themselves): the deal defines their
      // package and payment state.
      await supabase.from("students").update({
        payment_state: paymentType === "pif" ? "paid_in_full" : "installments",
        calls_included: callsAllotted,
        calls_allotted: callsAllotted,
      } as never).eq("id", finalStudentId);
    }

    const payload = {
      student_id: finalStudentId,
      student_name: finalStudentName,
      closer_id: closerId,
      setter_id: setterId || null,
      program_type: programType,
      total_value: tv,
      cash_collected_upfront: cu,
      payment_type: paymentType,
      deal_date: dealDate,
      contract_url: contractUrl || null,
      fathom_url: fathomUrl || null,
      notes: notes || null,
    };

    let dealId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("deals").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { data, error } = await supabase
        .from("deals")
        .insert({ ...payload, created_by: currentUserId })
        .select("id")
        .single();
      if (error) { setSaving(false); return toast.error(error.message); }
      dealId = data.id;
    }

    // Installment plan — even split or custom schedule (deposit or split)
    if (planWanted && finalStudentId) {
      const n = Math.max(1, Math.min(24, Number(numInstallments) || 3));
      const { data: inst, error: instErr } = await supabase
        .from("installments")
        .insert({
          student_id: finalStudentId,
          student_name: finalStudentName,
          closer_id: closerId,
          setter_id: setterId || null,
          total_amount: remaining,
          currency: "USD",
          created_by: currentUserId,
        })
        .select("id")
        .single();
      if (instErr) {
        toast.error("Installment plan: " + instErr.message);
      } else {
        let payments: Record<string, unknown>[];
        if (scheduleMode === "even") {
          const perInstallment = remaining / n;
          const start = new Date(firstDueDate + "T00:00:00");
          payments = Array.from({ length: n }, (_, i) => {
            const due = new Date(start);
            if (frequency === "monthly") due.setMonth(start.getMonth() + i);
            else if (frequency === "biweekly") due.setDate(start.getDate() + i * 14);
            else due.setDate(start.getDate() + i * 7);
            return {
              installment_id: inst.id,
              sequence: i + 1,
              amount: perInstallment,
              currency: "USD",
              due_date: due.toISOString().slice(0, 10),
              status: "upcoming" as const,
            };
          });
        } else {
          payments = cleanCustom
            .slice()
            .sort((a, b) => a.due_date.localeCompare(b.due_date))
            .map((r, i) => ({
              installment_id: inst.id,
              sequence: i + 1,
              amount: Number(r.amount),
              currency: "USD",
              due_date: r.due_date,
              status: "upcoming" as const,
              payment_method: r.payment_method.trim() || null,
            }));
        }
        const { error: payErr } = await supabase.from("installment_payments").insert(payments as never);
        if (payErr) toast.error("Installment schedule: " + payErr.message);
      }
    }

    setSaving(false);
    toast.success(editing ? "Deal updated" : "Deal logged → Revenue");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit deal" : "Log a close"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <div className="flex gap-2 mb-1.5">
              <Button
                type="button"
                size="sm"
                variant={studentMode === "existing" ? "default" : "outline"}
                onClick={() => setStudentMode("existing")}
                disabled={!!editing && !isAdmin}
              >
                Pick existing
              </Button>
              <Button
                type="button"
                size="sm"
                variant={studentMode === "new" ? "default" : "outline"}
                onClick={() => setStudentMode("new")}
                disabled={!!editing && !isAdmin}
              >
                New student
              </Button>
            </div>
            {studentMode === "existing" ? (
              <SelectField
                value={studentId}
                onChange={setStudentId}
                options={students.map((s) => ({ value: s.id, label: s.full_name }))}
                placeholder="– Select student –"
                className="h-9 text-sm"
                disabled={!!editing && !isAdmin}
              />
            ) : (
              <Input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Full name"
              />
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Closer</Label>
              <SelectField
                value={closerId}
                onChange={setCloserId}
                options={closers.map((c) => ({ value: c.id, label: c.display_name || c.id.slice(0, 8) }))}
                className="h-9 text-sm"
                disabled={!isAdmin && !!currentUserId}
              />
              {!isAdmin && <p className="text-[10px] text-muted-foreground">Only admins can assign to another closer.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Setter (optional)</Label>
              <SelectField
                value={setterId}
                onChange={(v) => { setSetterId(v); setSetterMatch(null); }}
                options={setters.map((s) => ({ value: s.id, label: s.display_name || s.id.slice(0, 8) }))}
                allowEmpty
                placeholder="– None –"
                className="h-9 text-sm"
              />
              {setterMatch ? (
                <p className="text-[10px] text-success-fg">Auto-matched from the setter tracker · {setterMatch.name} set this call on {setterMatch.date}. Change it if that's wrong.</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Attribute to a setter for base + PIF-bonus commission. Names that match a tracked set fill this automatically.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Pathway</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProgramType("1:1 Pathway")}
                className={`text-left p-3 rounded-lg border transition ${programType === "1:1 Pathway" ? "border-primary/40 bg-primary/10" : "border-[var(--border)] bg-[var(--card)] hover:bg-muted"}`}
              >
                <div className="text-sm font-medium">1:1 Pathway</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">10 one-on-one coaching calls + group access</div>
              </button>
              <button
                type="button"
                onClick={() => setProgramType("Group Expertise Pathway")}
                className={`text-left p-3 rounded-lg border transition ${programType === "Group Expertise Pathway" ? "border-primary/40 bg-primary/10" : "border-[var(--border)] bg-[var(--card)] hover:bg-muted"}`}
              >
                <div className="text-sm font-medium">Group Expertise Pathway</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Group coaching only · no 1:1 calls</div>
              </button>
            </div>
            {programType && !["1:1 Pathway", "Group Expertise Pathway"].includes(programType) && (
              <p className="text-[11px] text-muted-foreground">Current value: "{programType}" · picking a tile will replace it.</p>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Total value ($)</Label>
              <Input type="number" min="0" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cash upfront ($)</Label>
              <Input type="number" min="0" value={cashUpfront} onChange={(e) => setCashUpfront(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment type</Label>
              <SelectField
                value={paymentType}
                onChange={(v) => setPaymentType(v as PaymentType)}
                options={[
                  { value: "pif", label: "PIF (paid in full)" },
                  { value: "deposit", label: "Deposit" },
                  { value: "split", label: "Split / installments" },
                ]}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Deal date</Label>
              <DateField value={dealDate} onChange={setDealDate} clearable={false} className="h-9" />
            </div>
          </div>

          {paymentType !== "pif" && !editing && (
            <div className="rounded-lg border border-[var(--border)] p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={autoCreateInstallment} onCheckedChange={(v) => setAutoCreateInstallment(!!v)} />
                  Create installment plan for the remaining balance
                </label>
                <span className="text-caption text-muted-foreground tabular-nums">
                  remaining ${Math.max(0, (Number(totalValue) || 0) - (Number(cashUpfront) || 0)).toLocaleString()}
                </span>
              </div>
              {autoCreateInstallment && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-caption text-muted-foreground">Schedule</Label>
                      <SelectField
                        value={scheduleMode}
                        onChange={(v) => setScheduleMode(v as "even" | "custom")}
                        options={[
                          { value: "even", label: "Even split" },
                          { value: "custom", label: "Custom schedule" },
                        ]}
                        className="h-9 text-sm"
                      />
                    </div>
                    {scheduleMode === "even" && (
                      <div className="space-y-1.5">
                        <Label className="text-caption text-muted-foreground"># payments</Label>
                        <Input type="number" min="1" max="24" value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)} className="h-9" />
                      </div>
                    )}
                  </div>
                  {scheduleMode === "even" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-caption text-muted-foreground">First due</Label>
                        <DateField value={firstDueDate} onChange={setFirstDueDate} clearable={false} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-caption text-muted-foreground">Frequency</Label>
                        <SelectField
                          value={frequency}
                          onChange={(v) => setFrequency(v as "monthly" | "biweekly" | "weekly")}
                          options={[
                            { value: "monthly", label: "Monthly" },
                            { value: "biweekly", label: "Biweekly" },
                            { value: "weekly", label: "Weekly" },
                          ]}
                          className="h-9 text-sm"
                        />
                      </div>
                      {(() => {
                        const rem = Math.max(0, (Number(totalValue) || 0) - (Number(cashUpfront) || 0));
                        const nn = Math.max(1, Math.min(24, Number(numInstallments) || 0));
                        return rem > 0 && nn > 0 ? (
                          <div className="col-span-2 text-caption text-muted-foreground">
                            {nn} × <span className="text-foreground font-medium">${(rem / nn).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customRows.map((r, i) => (
                        <div key={r.id} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                          <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:block">
                            <span className="text-caption text-muted-foreground">#{i + 1}</span>
                            <button onClick={() => removeCustomRow(r.id)} className="sm:hidden p-1.5 rounded hover:bg-danger-bg text-danger-fg">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <Input type="number" min="0" step="0.01" value={r.amount} onChange={(e) => updateCustomRow(r.id, { amount: e.target.value })} placeholder="Amount" className="col-span-1 sm:col-span-3 h-9" />
                          <DateField value={r.due_date} onChange={(v) => updateCustomRow(r.id, { due_date: v })} clearable={false} className="col-span-1 sm:col-span-4 h-9" />
                          <Input value={r.payment_method} onChange={(e) => updateCustomRow(r.id, { payment_method: e.target.value })} placeholder="Method" className="col-span-2 sm:col-span-3 h-9" />
                          <button onClick={() => removeCustomRow(r.id)} className="hidden sm:block sm:col-span-1 p-1.5 rounded hover:bg-danger-bg text-danger-fg justify-self-end">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {(() => {
                        const rem = Math.max(0, (Number(totalValue) || 0) - (Number(cashUpfront) || 0));
                        const scheduled = customRows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
                        const delta = rem - scheduled;
                        return (
                          <div className="flex items-center justify-between">
                            <Button variant="outline" size="sm" onClick={addCustomRow}>
                              <Plus className="h-3.5 w-3.5 mr-1" /> Add row
                            </Button>
                            <span className={`text-caption tabular-nums ${Math.abs(delta) < 0.01 ? "text-success-fg" : "text-warning-fg"}`}>
                              scheduled ${scheduled.toLocaleString()} · {Math.abs(delta) < 0.01 ? "matches remaining" : delta > 0 ? `$${delta.toLocaleString()} unallocated` : `$${Math.abs(delta).toLocaleString()} over`}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contract URL</Label>
              <Input value={contractUrl} onChange={(e) => setContractUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label>Fathom URL</Label>
              <Input value={fathomUrl} onChange={(e) => setFathomUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {!editing && (
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              {studentMode === "new" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={autoCreateStudent}
                    onCheckedChange={(v) => setAutoCreateStudent(!!v)}
                  />
                  Create student record (goes into onboarding)
                </label>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Log close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
