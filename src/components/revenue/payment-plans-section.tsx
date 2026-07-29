/**
 * Payment plans (the old Installments page, moved wholesale into the
 * Money-in merge, founder-approved 2026-07-28). Every mutation and its
 * invalidateForTables wiring is unchanged; the page query keeps
 * keys.installmentsPage so all cross-page invalidation keeps working.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { findWhopMatch } from "@/lib/mochi.functions";
import { supabase } from "@/integrations/supabase/client";
import { keys, invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Plus, Trash2, Ban, X, AlertTriangle, Bell, CheckCircle2,
  Calendar as CalendarIcon, Edit3, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { CashInCalendarCard } from "@/components/cash-in-calendar";
import { DateField } from "@/components/ui/date-field";
import { SelectField } from "@/components/ui/select-field";

type PayStatus = "upcoming" | "paid" | "late" | "missed" | "waived";
type Payment = {
  id: string;
  installment_id: string;
  sequence: number;
  amount: number;
  currency: string;
  due_date: string; // yyyy-mm-dd
  status: PayStatus;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  reminded_3d_at: string | null;
  reminded_1d_at: string | null;
};
type Installment = {
  id: string;
  student_id: string | null;
  student_name: string;
  coach_id: string | null;
  closer_id: string | null;
  total_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
};
type Student = { id: string; full_name: string };
type Person = { id: string; display_name: string | null };

const STATUS_META: Record<PayStatus, { label: string; cls: string }> = {
  upcoming: { label: "Upcoming", cls: "text-muted-foreground border-border bg-muted" },
  paid:     { label: "Paid",     cls: "text-success-fg border-success/25 bg-success-bg" },
  late:     { label: "Late",     cls: "text-warning-fg border-warning/25 bg-warning-bg" },
  missed:   { label: "Missed",   cls: "text-danger-fg border-danger/25 bg-danger-bg" },
  waived:   { label: "Waived",   cls: "text-muted-foreground border-border bg-zinc-500/5" },
};

const fmtMoney = (n: number, cur: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD" }).format(n || 0);

const daysUntil = (d: string) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
};

export function PaymentPlansSection() {
  const { user, roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("closer");
  const canDelete = roles.includes("admin");

  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [team, setTeam] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Installment | null>(null);

  // Cached page read: other pages' mutations (deal logging, student renames)
  // reach this view through invalidateForTables; mutations below still patch
  // local state for instant feedback.
  const qc = useQueryClient();
  const pageQ = useQuery({
    queryKey: keys.installmentsPage,
    queryFn: async () => {
      const [iRes, pRes, sRes, tRes] = await Promise.all([
        (supabase.from("installments" as any).select("*, students!inner(is_demo)").eq("students.is_demo", false).is("voided_at", null).order("created_at", { ascending: false }) as any),
        (supabase.from("installment_payments" as any).select("*, installments!inner(students!inner(is_demo))").eq("installments.students.is_demo", false).order("due_date", { ascending: true }) as any),
        supabase.from("students").select("id, full_name").eq("is_demo", false).order("full_name"),
        supabase.from("profiles").select("id, display_name" as any).eq("is_demo", false),
      ]);
      return {
        installments: (iRes.data ?? []) as Installment[],
        payments: (pRes.data ?? []) as Payment[],
        students: (sRes.data ?? []) as Student[],
        team: ((tRes.data ?? []) as any[]).map(p => ({ id: p.id, display_name: p.display_name })) as Person[],
      };
    },
  });
  useEffect(() => {
    if (!pageQ.data) return;
    setInstallments(pageQ.data.installments);
    setPayments(pageQ.data.payments);
    setStudents(pageQ.data.students);
    setTeam(pageQ.data.team);
  }, [pageQ.data]);

  const paymentsByInstallment = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of payments) {
      if (!map.has(p.installment_id)) map.set(p.installment_id, []);
      map.get(p.installment_id)!.push(p);
    }
    return map;
  }, [payments]);

  const teamName = (id: string | null) => id ? (team.find(t => t.id === id)?.display_name ?? id.slice(0,8)) : "–";

  const filtered = installments.filter(i =>
    !q || i.student_name.toLowerCase().includes(q.toLowerCase())
  );

  const overdue = payments.filter(p => p.status !== "paid" && p.status !== "waived" && daysUntil(p.due_date) < 0);
  const dueIn1 = payments.filter(p => p.status === "upcoming" && daysUntil(p.due_date) === 1);
  const dueIn3 = payments.filter(p => p.status === "upcoming" && daysUntil(p.due_date) === 3);
  const dueSoon = payments.filter(p => p.status === "upcoming" && daysUntil(p.due_date) >= 0 && daysUntil(p.due_date) <= 7);

  const totalOutstanding = payments
    .filter(p => p.status !== "paid" && p.status !== "waived")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const collectedThisMonth = payments
    .filter(p => p.status === "paid" && p.paid_at && new Date(p.paid_at).getMonth() === new Date().getMonth() && new Date(p.paid_at).getFullYear() === new Date().getFullYear())
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const findWhopMatchFn = useServerFn(findWhopMatch);

  const setStatus = async (id: string, status: PayStatus) => {
    const existing = payments.find(p => p.id === id);
    if (existing?.status === "paid" && status !== "paid") {
      toast.error("Paid history is immutable · add a documented correction instead");
      return;
    }
    const patch: any = { status };
    if (status === "paid") {
      // Cash only counts once it's actually in Whop (founder rule 2026-07-14).
      // Check for a matching charge before letting the row flip to paid.
      const row = payments.find(p => p.id === id);
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
    } else {
      // Leaving "paid" must clear paid_at, or the money keeps counting as
      // collected and keeps paying commission.
      patch.paid_at = null;
    }
    const { error } = await (supabase.from("installment_payments" as any).update(patch).eq("id", id) as any);
    if (error) return toast.error(error.message);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    invalidateForTables(qc, ["installment_payments"]);
  };

  const removePayment = async (id: string) => {
    const row = payments.find(p => p.id === id);
    if (row?.status === "paid") return toast.error("Paid history cannot be removed");
    const reason = prompt("Why is this scheduled payment being waived?", "Schedule correction");
    if (!reason?.trim()) return;
    const notes = [row?.notes, `Waived: ${reason.trim()}`].filter(Boolean).join("\n");
    const { error } = await (supabase.from("installment_payments" as any).update({ status: "waived", paid_at: null, notes }).eq("id", id) as any);
    if (error) return toast.error(error.message);
    setPayments(x => x.map(p => p.id === id ? { ...p, status: "waived", paid_at: null, notes } : p));
    toast.success("Payment waived · row preserved");
    invalidateForTables(qc, ["installment_payments"]);
  };
  const removeInstallment = async (id: string) => {
    const reason = prompt("Why is this installment plan being voided?", "Incorrect payment plan");
    if (!reason?.trim()) return;
    const { error } = await (supabase.rpc as any)("void_installment_plan", {
      p_installment_id: id,
      p_reason: reason.trim(),
    });
    if (error) return toast.error(error.message);
    setInstallments(x => x.filter(i => i.id !== id));
    setPayments(x => x.map(p => p.installment_id === id && p.status !== "paid" ? { ...p, status: "waived", paid_at: null } : p));
    toast.success("Plan voided · paid history preserved");
    invalidateForTables(qc, ["installments", "installment_payments"]);
  };

  const dismissReminder = async (id: string, which: "3d" | "1d") => {
    const patch: any = which === "3d" ? { reminded_3d_at: new Date().toISOString() } : { reminded_1d_at: new Date().toISOString() };
    const { error } = await (supabase.from("installment_payments" as any).update(patch).eq("id", id) as any);
    if (error) return toast.error(error.message);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    invalidateForTables(qc, ["installment_payments"]);
  };

  const nameFor = (p: Payment) => {
    const inst = installments.find(i => i.id === p.installment_id);
    return inst?.student_name ?? "–";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">Payment plans, follow-ups, and the cash flow calendar.</p>
        {canEdit && (
          <button onClick={() => { setEditing(null); setAddOpen(true); }} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90">
            <Plus className="h-4 w-4" /> New installment plan
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Overdue" value={overdue.length} tone="rose" />
        <StatCard icon={<Bell className="h-4 w-4" />} label="Due in 1 day" value={dueIn1.length} tone="amber" />
        <StatCard icon={<Bell className="h-4 w-4" />} label="Due in 3 days" value={dueIn3.length} tone="sky" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Collected (MTD)" value={fmtMoney(collectedThisMonth, "USD")} tone="emerald" />
      </div>

      {/* Cash-in calendar — every day, and the money that should land on it */}
      <CashInCalendarCard />

      {/* Reminder queue */}
      {(dueIn3.length > 0 || dueIn1.length > 0 || overdue.length > 0) && (
        <section className="rounded-lg border border-border bg-card">
          <header className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Bell className="h-4 w-4 text-warning-fg" />
            <h2 className="font-medium text-sm">Follow-up queue</h2>
            <span className="text-xs text-muted-foreground">Payments to reach out about today</span>
          </header>
          <div className="divide-y divide-border">
            {[...overdue, ...dueIn1, ...dueIn3].map(p => {
              const dLeft = daysUntil(p.due_date);
              const tone = dLeft < 0 ? "rose" : dLeft === 1 ? "amber" : "sky";
              const label = dLeft < 0 ? `${Math.abs(dLeft)}d overdue` : dLeft === 0 ? "Due today" : `${dLeft}d away`;
              return (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${tone === "rose" ? "text-danger-fg border-danger/25 bg-danger-bg" : tone === "amber" ? "text-warning-fg border-warning/25 bg-warning-bg" : "text-muted-foreground border-border bg-muted"}`}>{label}</span>
                  <span className="font-medium">{nameFor(p)}</span>
                  <span className="text-sm text-muted-foreground">Payment #{p.sequence} · {fmtMoney(Number(p.amount), p.currency)}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {p.due_date}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setStatus(p.id, "paid")} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent">Mark paid</button>
                    {dLeft >= 2 && !p.reminded_3d_at && (
                      <button onClick={() => dismissReminder(p.id, "3d")} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent">Followed up (3d)</button>
                    )}
                    {dLeft <= 1 && !p.reminded_1d_at && (
                      <button onClick={() => dismissReminder(p.id, "1d")} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent">Followed up (1d)</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search students…" className="w-full pl-8 pr-3 py-2 rounded-md border border-border bg-background text-sm" />
        </div>
        <div className="text-xs text-muted-foreground ml-auto">Outstanding: <span className="text-foreground font-medium">{fmtMoney(totalOutstanding, "USD")}</span></div>
      </div>

      {/* Plans list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No installment plans yet. Click "New installment plan" to add one.
          </div>
        )}
        {filtered.map(inst => {
          const pays = (paymentsByInstallment.get(inst.id) ?? []).sort((a,b) => a.sequence - b.sequence);
          const paid = pays.filter(p => p.status === "paid").reduce((s,p) => s + Number(p.amount), 0);
          const pct = inst.total_amount > 0 ? Math.min(100, Math.round((paid / Number(inst.total_amount)) * 100)) : 0;
          return (
            <section key={inst.id} className="rounded-lg border border-border bg-card">
              <header className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">{inst.student_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Closer: {teamName(inst.closer_id)} · Coach: {teamName(inst.coach_id)}
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-success-fg font-medium">{fmtMoney(paid, inst.currency)}</span>
                  <span className="text-muted-foreground"> / {fmtMoney(Number(inst.total_amount), inst.currency)}</span>
                </div>
                <div className="w-40 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
                {canEdit && <button onClick={() => { setEditing(inst); setAddOpen(true); }} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"><Edit3 className="h-3 w-3" />Edit</button>}
                {canDelete && (
                  <button onClick={() => removeInstallment(inst.id)} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent text-danger-fg inline-flex items-center gap-1"><Ban className="h-3 w-3" />Void</button>
                )}
              </header>
              {inst.notes && <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">{inst.notes}</div>}
              <div className="divide-y divide-border">
                {pays.map(p => {
                  const dLeft = daysUntil(p.due_date);
                  return (
                    <div key={p.id} className="px-4 py-2 flex items-center gap-3 flex-wrap text-sm">
                      <span className="text-xs text-muted-foreground w-6">#{p.sequence}</span>
                      <span className="font-medium w-28">{fmtMoney(Number(p.amount), p.currency)}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {p.due_date}
                        {p.status === "upcoming" && (
                          <span className={`ml-1 px-1.5 py-0.5 rounded ${dLeft < 0 ? "text-danger-fg" : dLeft <= 3 ? "text-warning-fg" : "text-muted-foreground"}`}>
                            ({dLeft < 0 ? `${Math.abs(dLeft)}d late` : dLeft === 0 ? "today" : `in ${dLeft}d`})
                          </span>
                        )}
                      </span>
                      {canEdit ? (
                        <SelectField
                          value={p.status}
                          onChange={v => setStatus(p.id, v as PayStatus)}
                          options={(Object.keys(STATUS_META) as PayStatus[]).map(s => ({ value: s, label: STATUS_META[s].label }))}
                          disabled={p.status === "paid"}
                          className={`w-auto text-xs ${STATUS_META[p.status].cls}`}
                        />
                      ) : (
                        <span className={`rounded border px-2 py-1 text-xs ${STATUS_META[p.status].cls}`}>{STATUS_META[p.status].label}</span>
                      )}
                      {p.payment_method && <span className="text-xs text-muted-foreground">{p.payment_method}</span>}
                      {p.notes && <span className="text-xs text-muted-foreground italic truncate max-w-[240px]">"{p.notes}"</span>}
                      <div className="ml-auto flex items-center gap-2">
                        {canDelete && p.status !== "paid" && p.status !== "waived" && (
                          <button onClick={() => removePayment(p.id)} className="text-xs text-danger-fg hover:underline inline-flex items-center gap-1" title="Waive scheduled payment"><Ban className="h-3 w-3" />Waive</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {pays.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">No payments scheduled · edit this plan to add some.</div>}
              </div>
            </section>
          );
        })}
      </div>

      {addOpen && (
        <PlanEditor
          initial={editing}
          initialPayments={editing ? (paymentsByInstallment.get(editing.id) ?? []) : []}
          students={students}
          team={team}
          currentUserId={user?.id ?? null}
          onClose={() => { setAddOpen(false); setEditing(null); }}
          onSaved={() => { setAddOpen(false); setEditing(null); invalidateForTables(qc, ["installments", "installment_payments"]); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: "rose" | "amber" | "sky" | "emerald" }) {
  const toneCls = {
    rose:    "text-danger-fg",
    amber:   "text-warning-fg",
    sky:     "text-muted-foreground",
    emerald: "text-success-fg",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className={`flex items-center gap-2 text-xs ${toneCls}`}>{icon}{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

type Draft = {
  id: string | null;
  amount: string;
  due_date: string;
  payment_method: string;
  notes: string;
  status: PayStatus;
  paid_at: string | null;
};

function PlanEditor({
  initial, initialPayments, students, team, currentUserId, onClose, onSaved,
}: {
  initial: Installment | null;
  initialPayments: Payment[];
  students: Student[];
  team: Person[];
  currentUserId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [studentId, setStudentId] = useState<string>(initial?.student_id ?? "");
  const [coachId, setCoachId] = useState<string>(initial?.coach_id ?? "");
  const [closerId, setCloserId] = useState<string>(initial?.closer_id ?? "");
  const [currency, setCurrency] = useState<string>(initial?.currency ?? "USD");
  const [total, setTotal] = useState<string>(initial ? String(initial.total_amount) : "");
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [drafts, setDrafts] = useState<Draft[]>(
    initialPayments.length
      ? [...initialPayments]
          .sort((a,b) => a.sequence - b.sequence)
          .map(p => ({
            id: p.id,
            amount: String(p.amount),
            due_date: p.due_date,
            payment_method: p.payment_method ?? "",
            notes: p.notes ?? "",
            status: p.status,
            paid_at: p.paid_at,
          }))
      : [{ id: null, amount: "", due_date: new Date().toISOString().slice(0,10), payment_method: "", notes: "", status: "upcoming", paid_at: null }]
  );
  const [saving, setSaving] = useState(false);

  const addDraft = () => setDrafts(d => [...d, { id: null, amount: "", due_date: new Date().toISOString().slice(0,10), payment_method: "", notes: "", status: "upcoming", paid_at: null }]);
  const removeDraft = (i: number) => {
    if (drafts[i]?.status === "paid") return toast.error("Paid history cannot be removed from a schedule");
    setDrafts(d => d.filter((_, idx) => idx !== i));
  };

  const generateMonthly = () => {
    const t = Number(total) || 0;
    const n = drafts.length || 1;
    const each = (t / n).toFixed(2);
    setDrafts(d => d.map((row, i) => {
      if (row.status === "paid") return row;
      const base = new Date(); base.setHours(0,0,0,0);
      base.setMonth(base.getMonth() + i);
      return { ...row, amount: each, due_date: base.toISOString().slice(0,10) };
    }));
  };

  const save = async () => {
    // Plans must belong to a student row: without one the plan is invisible
    // to every money surface (schema enforces this too, 2026-07-28).
    if (!studentId) { toast.error("Pick the student · every plan belongs to a student"); return; }
    const name = students.find(s => s.id === studentId)?.full_name ?? "";
    if (!name) { toast.error("Pick the student · every plan belongs to a student"); return; }
    setSaving(true);
    try {
      let planId = initial?.id;
      if (!planId) {
        const { data, error } = await (supabase.from("installments" as any).insert({
          student_id: studentId,
          student_name: name,
          coach_id: coachId || null,
          closer_id: closerId || null,
          total_amount: Number(total) || 0,
          currency,
          notes: notes || null,
          created_by: currentUserId,
        }).select("id").single() as any);
        if (error) throw error;
        planId = data.id as string;
      } else {
        const { error } = await (supabase.from("installments" as any).update({
          student_id: studentId,
          student_name: name,
          coach_id: coachId || null,
          closer_id: closerId || null,
          total_amount: Number(total) || 0,
          currency,
          notes: notes || null,
        }).eq("id", planId) as any);
        if (error) throw error;
      }

      const validDrafts = drafts.filter(d => d.amount && d.due_date);
      const retainedIds = new Set(validDrafts.flatMap(d => d.id ? [d.id] : []));

      // Removing an unpaid row from the editor waives it. Paid rows remain
      // immutable and are always retained even if stale UI state omits them.
      for (const payment of initialPayments) {
        if (retainedIds.has(payment.id) || payment.status === "paid") continue;
        const correctionNote = [payment.notes, "Waived when installment schedule was edited"].filter(Boolean).join("\n");
        const { error } = await (supabase.from("installment_payments" as any)
          .update({ status: "waived", paid_at: null, notes: correctionNote })
          .eq("id", payment.id) as any);
        if (error) throw error;
      }

      const newRows: any[] = [];
      for (const [i, draft] of validDrafts.entries()) {
        const row = {
          installment_id: planId as string,
          sequence: i + 1,
          amount: Number(draft.amount) || 0,
          currency,
          due_date: draft.due_date,
          status: draft.status,
          payment_method: draft.payment_method || null,
          notes: draft.notes || null,
        };
        if (!draft.id) {
          if (draft.status === "paid") throw new Error("New payments must be verified from the payment row before being marked paid");
          newRows.push(row);
          continue;
        }
        const original = initialPayments.find(p => p.id === draft.id);
        if (original?.status === "paid") continue;
        if (draft.status === "paid") throw new Error("Use the payment-row status action so Whop can verify collected cash");
        const { error } = await (supabase.from("installment_payments" as any).update(row).eq("id", draft.id) as any);
        if (error) throw error;
      }

      if (newRows.length) {
        const { error } = await (supabase.from("installment_payments" as any).insert(newRows) as any);
        if (error) throw error;
      }
      toast.success("Installment plan saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto z-50 bg-black/60 flex p-4" onClick={onClose}>
      <div className="m-auto w-full max-w-3xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-card" onClick={e => e.stopPropagation()}>
        <header className="px-4 py-3 border-b border-border flex items-center gap-2">
          <h3 className="font-medium">{initial ? "Edit installment plan" : "New installment plan"}</h3>
          <button onClick={onClose} className="ml-auto p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
        </header>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Student">
              <SelectField value={studentId} onChange={(v) => setStudentId(v)} options={students.map((s) => ({ value: s.id, label: s.full_name }))} placeholder="Pick the student…" />
            </Field>
            <Field label="Closer">
              <SelectField value={closerId} onChange={(v) => setCloserId(v)} options={team.map((t) => ({ value: t.id, label: t.display_name ?? t.id.slice(0,8) }))} allowEmpty emptyLabel="Unassigned" placeholder="Unassigned" />
            </Field>
            <Field label="Coach">
              <SelectField value={coachId} onChange={(v) => setCoachId(v)} options={team.map((t) => ({ value: t.id, label: t.display_name ?? t.id.slice(0,8) }))} allowEmpty emptyLabel="Unassigned" placeholder="Unassigned" />
            </Field>
            <Field label="Total deal value">
              <input value={total} onChange={e => setTotal(e.target.value)} type="number" min="0" step="0.01" className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm" />
            </Field>
            <Field label="Currency">
              <SelectField value={currency} onChange={setCurrency} options={["USD","EUR","GBP","CAD","AUD","AED"].map(c => ({ value: c, label: c }))} className="h-9 text-sm" />
            </Field>
          </div>
          <Field label="Deal notes (optional)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm" />
          </Field>

          <div className="pt-2 border-t border-border">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h4 className="text-sm font-medium">Scheduled payments</h4>
              <button onClick={generateMonthly} className="text-xs px-2 py-1.5 rounded border border-border hover:bg-accent">Split evenly, monthly</button>
              <button onClick={addDraft} className="ml-auto text-xs px-2 py-1.5 rounded border border-border hover:bg-accent inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add payment</button>
            </div>
            <div className="space-y-2">
              {drafts.map((d, i) => (
                <div key={d.id ?? `new-${i}`} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:block">
                    <span className="text-xs text-muted-foreground">#{i+1}</span>
                    {d.status !== "paid" && <button onClick={() => removeDraft(i)} className="sm:hidden p-1.5 rounded hover:bg-accent text-danger-fg"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                  <input disabled={d.status === "paid"} type="number" min="0" step="0.01" value={d.amount} onChange={e => setDrafts(list => list.map((r,idx) => idx === i ? { ...r, amount: e.target.value } : r))} placeholder="Amount" className="col-span-1 sm:col-span-3 px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60" />
                  <DateField disabled={d.status === "paid"} value={d.due_date} onChange={v => setDrafts(list => list.map((r,idx) => idx === i ? { ...r, due_date: v } : r))} clearable={false} className="col-span-1 sm:col-span-3 h-9 text-sm" />
                  <SelectField disabled={d.status === "paid"} value={d.status} onChange={v => setDrafts(list => list.map((r,idx) => idx === i ? { ...r, status: v as PayStatus } : r))} options={(d.status === "paid" ? ["paid"] : (Object.keys(STATUS_META) as PayStatus[]).filter(s => s !== "paid")).map(s => ({ value: s as PayStatus, label: STATUS_META[s as PayStatus].label }))} className="col-span-1 sm:col-span-2 h-9 text-sm" />
                  <input disabled={d.status === "paid"} value={d.payment_method} onChange={e => setDrafts(list => list.map((r,idx) => idx === i ? { ...r, payment_method: e.target.value } : r))} placeholder="Method" className="col-span-1 sm:col-span-2 px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60" />
                  {d.status !== "paid" && <button onClick={() => removeDraft(i)} className="hidden sm:block sm:col-span-1 p-1.5 rounded hover:bg-accent text-danger-fg justify-self-end"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button onClick={onClose} className="ml-auto px-3 py-1.5 rounded border border-border text-sm hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Save plan"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

/**
 * Cash-in calendar: a month grid where every day shows the money scheduled
 * to land (upcoming/late/missed still expected · paid shown as collected).
 * Click a day for the payment breakdown.
 */