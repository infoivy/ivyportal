import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Deal,
  CommissionRates,
  DEFAULT_RATES,
  commissionForDeal,
  setterCommissionForDeal,
  money,
  isSameMonth,
} from "@/lib/revenue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CashLeaderboard } from "@/components/weekly-leaderboard";
import { SetterLeaderboard } from "@/components/setter-leaderboard";
import { toast } from "sonner";
import {
  Plus, DollarSign, TrendingUp, Trophy, ClipboardList, Pencil, Trash2,
  Save, Percent,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({ meta: [{ title: "Revenue — ISA Team" }] }),
  component: RevenuePage,
});

type Profile = { id: string; display_name: string | null };
type Student = { id: string; full_name: string };
type PaymentType = Deal["payment_type"];

function RevenuePage() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const canLog = isAdmin || roles.includes("closer") || roles.includes("coach");

  const [deals, setDeals] = useState<Deal[]>([]);
  const [rates, setRates] = useState<CommissionRates>(DEFAULT_RATES);
  const [rateRows, setRateRows] = useState<{ id: string; key: string; label: string; rate: number; active: boolean }[]>([]);
  const [closers, setClosers] = useState<Profile[]>([]);
  const [setters, setSetters] = useState<Profile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  const load = async () => {
    const [dealsRes, ratesRes, rolesRes, studentsRes] = await Promise.all([
      supabase.from("deals").select("*").order("deal_date", { ascending: false }).limit(500),
      supabase.from("commission_rates").select("*").eq("active", true),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["closer", "coach", "admin", "setter"]),
      supabase.from("students").select("id, full_name").order("full_name"),
    ]);

    setDeals(((dealsRes.data ?? []) as Deal[]));
    const r: CommissionRates = { ...DEFAULT_RATES };
    const rows: { id: string; key: string; label: string; rate: number; active: boolean }[] = [];
    for (const row of ratesRes.data ?? []) {
      rows.push({ id: row.id, key: row.key, label: row.label, rate: Number(row.rate), active: row.active });
      const k = row.key as keyof CommissionRates;
      if (k in r) (r as Record<string, number>)[k] = Number(row.rate);
    }
    setRates(r);
    setRateRows(rows);

    const closerIds = Array.from(
      new Set((rolesRes.data ?? []).filter((r) => r.role !== "setter").map((r) => r.user_id)),
    );
    const setterIds = Array.from(
      new Set((rolesRes.data ?? []).filter((r) => r.role === "setter" || r.role === "admin").map((r) => r.user_id)),
    );
    const allIds = Array.from(new Set([...closerIds, ...setterIds]));
    if (allIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", allIds);
      const profMap = new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
      setClosers(closerIds.map((id) => profMap.get(id)).filter(Boolean) as Profile[]);
      setSetters(setterIds.map((id) => profMap.get(id)).filter(Boolean) as Profile[]);
    }
    setStudents((studentsRes.data ?? []) as Student[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const monthDeals = useMemo(() => deals.filter((d) => isSameMonth(d.deal_date)), [deals]);
  const stats = useMemo(() => {
    const cash = monthDeals.reduce((a, d) => a + Number(d.cash_collected_upfront), 0);
    const booked = monthDeals.reduce((a, d) => a + Number(d.total_value), 0);
    const count = monthDeals.length;
    const avg = count > 0 ? booked / count : 0;
    return { cash, booked, count, avg };
  }, [monthDeals]);

  // Per-closer breakdown (MTD)
  const perCloser = useMemo(() => {
    const map = new Map<string, { cash: number; booked: number; deals: number; pif: number; commission: number }>();
    for (const d of monthDeals) {
      const c = map.get(d.closer_id) ?? { cash: 0, booked: 0, deals: 0, pif: 0, commission: 0 };
      c.cash += Number(d.cash_collected_upfront);
      c.booked += Number(d.total_value);
      c.deals += 1;
      if (d.payment_type === "pif") c.pif += 1;
      c.commission += commissionForDeal(d, rates);
      map.set(d.closer_id, c);
    }
    const nameMap = new Map(closers.map((c) => [c.id, c.display_name || "Unknown"]));
    return Array.from(map.entries())
      .map(([id, v]) => ({ closer_id: id, name: nameMap.get(id) ?? "Unknown", ...v }))
      .sort((a, b) => b.cash - a.cash);
  }, [monthDeals, closers, rates]);

  // Per-setter breakdown (MTD)
  const perSetter = useMemo(() => {
    const map = new Map<string, { booked: number; deals: number; pifBonus: number; commission: number }>();
    for (const d of monthDeals) {
      if (!d.setter_id) continue;
      const c = map.get(d.setter_id) ?? { booked: 0, deals: 0, pifBonus: 0, commission: 0 };
      c.booked += Number(d.total_value);
      c.deals += 1;
      const comm = setterCommissionForDeal(d, rates);
      c.commission += comm;
      const base = Number(d.total_value) * rates.setter_base;
      if (comm > base + 0.001) c.pifBonus += 1;
      map.set(d.setter_id, c);
    }
    const nameMap = new Map(setters.map((s) => [s.id, s.display_name || "Unknown"]));
    return Array.from(map.entries())
      .map(([id, v]) => ({ setter_id: id, name: nameMap.get(id) ?? "Unknown", ...v }))
      .sort((a, b) => b.commission - a.commission);
  }, [monthDeals, setters, rates]);

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

  // Commission milestone bonuses (team cash MTD)
  const milestones = useMemo(() => {
    const tiers = [
      { threshold: 10_000, bonus: 500 },
      { threshold: 25_000, bonus: 1_500 },
      { threshold: 50_000, bonus: 4_000 },
      { threshold: 100_000, bonus: 10_000 },
    ];
    const cash = stats.cash;
    return tiers.map((t) => ({ ...t, hit: cash >= t.threshold, progress: Math.min(1, cash / t.threshold) }));
  }, [stats.cash]);

  const deleteDeal = async (id: string) => {
    if (!confirm("Delete this deal? This does NOT delete the linked student.")) return;
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Sales</div>
          <h1 className="text-2xl font-semibold tracking-tight">Revenue</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Closes, cash, and commissions — month to date.</p>
        </div>
        {canLog && (
          <Button onClick={() => { setEditing(null); setLogOpen(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Log a close
          </Button>
        )}
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Cash collected MTD" value={money(stats.cash)} icon={<DollarSign className="h-4 w-4" />} accent />
        <KpiCard label="Booked value MTD" value={money(stats.booked)} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Deals MTD" value={String(stats.count)} icon={<ClipboardList className="h-4 w-4" />} />
        <KpiCard label="Avg deal size" value={money(stats.avg)} icon={<Trophy className="h-4 w-4" />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Sales trend</h3>
              <div className="flex gap-1">
                {(["monthly", "weekly", "daily"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTrendMode(m)}
                    className={
                      "text-[10px] uppercase tracking-wider px-2 py-1 rounded border " +
                      (trendMode === m
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-[var(--border)] text-muted-foreground hover:text-foreground")
                    }
                  >
                    {m === "monthly" ? "6mo" : m === "weekly" ? "8wk" : "30d"}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8A919C" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "#8A919C" }} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number, k: string) => (k === "deals" ? [v, "deals"] : [money(v), k === "cash" ? "cash" : "booked"])}
                  />
                  <Bar dataKey="booked" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cash" fill="#22C55E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <CashLeaderboard />
        <SetterLeaderboard />
      </div>

      {/* Commission milestone bonuses */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Team cash milestones (MTD)</h3>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Cash collected: <span className="text-emerald-400">{money(stats.cash)}</span>
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {milestones.map((m) => (
            <div
              key={m.threshold}
              className={
                "rounded-md border p-3 " +
                (m.hit
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-[var(--border)] bg-[var(--card)]")
              }
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">{money(m.threshold)}</span>
                <span className={"text-[10px] " + (m.hit ? "text-emerald-400" : "text-muted-foreground")}>
                  {m.hit ? "UNLOCKED" : `${Math.floor(m.progress * 100)}%`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden mb-2">
                <div
                  className={"h-full " + (m.hit ? "bg-emerald-500" : "bg-primary/60")}
                  style={{ width: `${m.progress * 100}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Team bonus <span className="text-amber-400">{money(m.bonus)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>


      {/* Per-closer breakdown */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold">Per-closer breakdown (MTD)</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Commission via active rates</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground/70 bg-[var(--card)]">
              <tr>
                <th className="text-left px-4 py-2.5">Closer</th>
                <th className="text-right px-4 py-2.5">Deals</th>
                <th className="text-right px-4 py-2.5">PIF</th>
                <th className="text-right px-4 py-2.5">Booked</th>
                <th className="text-right px-4 py-2.5">Cash</th>
                <th className="text-right px-4 py-2.5">Commission</th>
              </tr>
            </thead>
            <tbody>
              {perCloser.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-8">No deals this month.</td>
                </tr>
              ) : (
                perCloser.map((r) => (
                  <tr key={r.closer_id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.deals}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.pif}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{money(r.booked)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(r.cash)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-400">{money(r.commission)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Per-setter breakdown */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold">Per-setter breakdown (MTD)</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {(rates.setter_base * 100).toFixed(1)}% base · +{(rates.setter_pif_bonus * 100).toFixed(1)}% PIF bonus
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground/70 bg-[var(--card)]">
              <tr>
                <th className="text-left px-4 py-2.5">Setter</th>
                <th className="text-right px-4 py-2.5">Set closes</th>
                <th className="text-right px-4 py-2.5">PIF bonuses</th>
                <th className="text-right px-4 py-2.5">Booked</th>
                <th className="text-right px-4 py-2.5">Commission</th>
              </tr>
            </thead>
            <tbody>
              {perSetter.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-8">No setter-attributed deals this month.</td>
                </tr>
              ) : (
                perSetter.map((r) => (
                  <tr key={r.setter_id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.deals}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sky-400">{r.pifBonus}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{money(r.booked)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-400">{money(r.commission)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent deals */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">Recent deals</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground/70 bg-[var(--card)]">
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
                const closerName = closers.find((c) => c.id === d.closer_id)?.display_name || "—";
                const setterName = d.setter_id
                  ? setters.find((s) => s.id === d.setter_id)?.display_name || "—"
                  : "—";
                return (
                  <tr key={d.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{d.deal_date}</td>
                    <td className="px-4 py-3 font-medium">{d.student_name}</td>
                    <td className="px-4 py-3">{closerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{setterName}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-wider border border-[var(--border)] rounded-full px-2 py-0.5">
                        {d.payment_type}
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
                          {isAdmin && (
                            <Button size="icon" variant="ghost" onClick={() => deleteDeal(d.id)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
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

      {isAdmin && <CommissionRatesCard rows={rateRows} reload={load} />}

      <LogDealDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        closers={closers}
        setters={setters}
        students={students}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        editing={editing}
        onSaved={() => { setLogOpen(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={"p-4 " + (accent ? "border-emerald-500/30 bg-emerald-500/5" : "")}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        {icon}
        {label}
      </div>
      <div className={"text-2xl font-semibold " + (accent ? "text-emerald-400" : "")}>{value}</div>
    </Card>
  );
}

function CommissionRatesCard({
  rows,
  reload,
}: {
  rows: { id: string; key: string; label: string; rate: number; active: boolean }[];
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(rows);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(rows), [rows]);

  const save = async () => {
    setSaving(true);
    for (const r of draft) {
      const orig = rows.find((x) => x.id === r.id);
      if (!orig || orig.rate !== r.rate) {
        await supabase.from("commission_rates").update({ rate: r.rate }).eq("id", r.id);
      }
    }
    setSaving(false);
    toast.success("Commission rates updated");
    reload();
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Commission rates</h3>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {draft.map((r) => (
          <div key={r.id} className="space-y-1">
            <Label className="text-xs">{r.label}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={r.rate}
                onChange={(e) =>
                  setDraft((d) =>
                    d.map((x) => (x.id === r.id ? { ...x, rate: Math.max(0, Math.min(1, Number(e.target.value) || 0)) } : x)),
                  )
                }
                className=""
              />
              <span className="text-xs text-muted-foreground tabular-nums w-12">
                {(r.rate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Editing here affects future commission calculations across the app. Historical deals reflect the current rate.
      </p>
    </Card>
  );
}

/* ---------- Log a close dialog ---------- */

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
  const [fathomUrl, setFathomUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [autoCreateStudent, setAutoCreateStudent] = useState(true);
  const [autoCreateInstallment, setAutoCreateInstallment] = useState(true);
  const [installments, setInstallments] = useState<string>("3");
  const [saving, setSaving] = useState(false);

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
      setAutoCreateInstallment(false);
      setInstallments("3");
    }
  }, [open, editing, currentUserId]);

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

    setSaving(true);

    // Optionally create student first
    if (!editing && studentMode === "new" && autoCreateStudent) {
      const { data: newStu, error } = await supabase
        .from("students")
        .insert({
          full_name: finalStudentName,
          phase: "onboarding",
          status: "active",
          payment_state: paymentType === "pif" ? "paid_in_full" : "installments",
        })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        return toast.error("Create student: " + error.message);
      }
      finalStudentId = newStu.id;
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

    // Optionally create installment plan
    if (!editing && paymentType === "split" && autoCreateInstallment && finalStudentId) {
      const n = Math.max(1, Math.min(24, Number(installments) || 3));
      const remaining = Math.max(0, tv - cu);
      const perInstallment = remaining / n;
      const { data: inst, error: instErr } = await supabase
        .from("installments")
        .insert({
          student_id: finalStudentId,
          student_name: finalStudentName,
          closer_id: closerId,
          total_amount: remaining,
          currency: "USD",
          created_by: currentUserId,
        })
        .select("id")
        .single();
      if (instErr) {
        toast.error("Installment plan: " + instErr.message);
      } else {
        const payments = Array.from({ length: n }, (_, i) => {
          const due = new Date(dealDate + "T00:00:00");
          due.setMonth(due.getMonth() + i + 1);
          return {
            installment_id: inst.id,
            sequence: i + 1,
            amount: perInstallment,
            currency: "USD",
            due_date: due.toISOString().slice(0, 10),
            status: "upcoming" as const,
          };
        });
        const { error: payErr } = await supabase.from("installment_payments").insert(payments);
        if (payErr) toast.error("Installment schedule: " + payErr.message);
      }
    }

    setSaving(false);
    toast.success(editing ? "Deal updated" : "Deal logged");
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
                disabled={!!editing}
              >
                Pick existing
              </Button>
              <Button
                type="button"
                size="sm"
                variant={studentMode === "new" ? "default" : "outline"}
                onClick={() => setStudentMode("new")}
                disabled={!!editing}
              >
                New student
              </Button>
            </div>
            {studentMode === "existing" ? (
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={!!editing}
              >
                <option value="">— Select student —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
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
              <select
                value={closerId}
                onChange={(e) => setCloserId(e.target.value)}
                disabled={!isAdmin && !!currentUserId}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Select —</option>
                {closers.map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name || c.id.slice(0, 8)}</option>
                ))}
              </select>
              {!isAdmin && <p className="text-[10px] text-muted-foreground">Only admins can assign to another closer.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Setter (optional)</Label>
              <select
                value={setterId}
                onChange={(e) => setSetterId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— None —</option>
                {setters.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name || s.id.slice(0, 8)}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">Attribute to a setter for base + PIF-bonus commission.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Program type</Label>
            <Input value={programType} onChange={(e) => setProgramType(e.target.value)} placeholder="e.g. Setter Accelerator" />
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
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="pif">PIF (paid in full)</option>
                <option value="deposit">Deposit</option>
                <option value="split">Split / installments</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Deal date</Label>
              <Input type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
            </div>
            {paymentType === "split" && !editing && (
              <div className="space-y-1.5">
                <Label># of installments</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                />
              </div>
            )}
          </div>

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
              {paymentType === "split" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={autoCreateInstallment}
                    onCheckedChange={(v) => setAutoCreateInstallment(!!v)}
                  />
                  Auto-create installment plan (monthly, starting next month)
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
