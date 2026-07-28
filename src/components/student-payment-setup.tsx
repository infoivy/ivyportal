import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { SelectField } from "@/components/ui/select-field";
import { Plus, Trash2 } from "lucide-react";

// Mirrors the payment step of AddStudentModal (students route) for a student
// that already exists (signed up first / approved from the pending queue).
// Writes the same records — deals + installments + installment_payments +
// students.payment_state — so Revenue and Installments pick it up untouched.

type Person = { id: string; display_name: string | null };
type ScheduleRow = { id: string; amount: string; due_date: string; payment_method: string };

export function StudentPaymentSetup({
  student,
  onClose,
  onDone,
}: {
  student: { id: string; full_name: string; coach_id: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [closers, setClosers] = useState<Person[]>([]);
  const [setters, setSetters] = useState<Person[]>([]);

  const [pkg, setPkg] = useState<"one_on_one" | "group_only">("one_on_one");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [payMode, setPayMode] = useState<"pif" | "installments" | "scholarship">("pif");
  const [closerId, setCloserId] = useState<string>("");
  const [setterId, setSetterId] = useState<string>("");
  const [dealDate, setDealDate] = useState(new Date().toISOString().slice(0, 10));

  const [scheduleMode, setScheduleMode] = useState<"even" | "custom">("even");
  const [depositAmount, setDepositAmount] = useState<string>("0");
  const [numInstallments, setNumInstallments] = useState<string>("3");
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10);
  });
  const [frequency, setFrequency] = useState<"monthly" | "biweekly" | "weekly">("monthly");

  const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };
  const [customRows, setCustomRows] = useState<ScheduleRow[]>(() => [
    { id: crypto.randomUUID(), amount: "", due_date: nextMonth(), payment_method: "" },
  ]);
  const addCustomRow = () => setCustomRows(rs => [...rs, { id: crypto.randomUUID(), amount: "", due_date: nextMonth(), payment_method: "" }]);
  const removeCustomRow = (id: string) => setCustomRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs);
  const updateCustomRow = (id: string, patch: Partial<ScheduleRow>) => setCustomRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: roleRows } = await supabase.from("user_roles").select("user_id, role").in("role", ["closer", "admin", "setter"]);
      const closerIds = Array.from(new Set((roleRows ?? []).filter(r => r.role === "closer" || r.role === "admin").map(r => r.user_id)));
      const setterIds = Array.from(new Set((roleRows ?? []).filter(r => r.role === "setter" || r.role === "admin").map(r => r.user_id)));
      const allIds = Array.from(new Set([...closerIds, ...setterIds]));
      if (!allIds.length) return;
      const { data: profs } = await supabase.from("profiles").select("id, display_name").eq("is_demo", false).in("id", allIds);
      const byId = new Map((profs ?? []).map(p => [p.id, p as Person]));
      setClosers(closerIds.map(id => byId.get(id) ?? { id, display_name: null }));
      setSetters(setterIds.map(id => byId.get(id) ?? { id, display_name: null }));
      if (user?.id && closerIds.includes(user.id)) setCloserId(user.id);
      else if (closerIds.length === 1) setCloserId(closerIds[0]);
    })();
  }, [user?.id]);

  const tv = Number(totalAmount) || 0;
  const dep = Number(depositAmount) || 0;
  const n = Math.max(1, Math.min(24, Number(numInstallments) || 0));
  const remaining = Math.max(0, tv - dep);
  const perInstallment = payMode === "installments" && n > 0 ? remaining / n : 0;
  const customTotal = useMemo(() => customRows.reduce((a, r) => a + (Number(r.amount) || 0), 0), [customRows]);
  const customDelta = tv - dep - customTotal;

  const submit = async () => {
    // Scholarship: no money, no deal — just mark the student and unlock the flow.
    if (payMode === "scholarship") {
      setSaving(true);
      try {
        const callsAllotted = pkg === "one_on_one" ? 10 : 0;
        const { error: stuErr } = await supabase.from("students").update({
          payment_state: "scholarship",
          calls_included: callsAllotted,
          calls_allotted: callsAllotted,
        } as never).eq("id", student.id);
        if (stuErr) throw new Error("Student: " + stuErr.message);
        toast.success("Scholarship set · no deal or installments created");
        invalidateForTables(qc, ["students"]);
        onDone();
      } catch (e) {
        toast.error(String((e as Error).message ?? e));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (tv <= 0) return toast.error("Total amount must be > 0");
    if (!closerId) return toast.error("Pick who closed this deal");
    if (payMode === "installments") {
      if (dep > tv) return toast.error("Deposit cannot exceed total");
      if (scheduleMode === "even" && n < 1) return toast.error("At least 1 installment");
      if (scheduleMode === "custom") {
        const cleanRows = customRows.filter(r => Number(r.amount) > 0);
        if (cleanRows.length === 0) return toast.error("Add at least one payment row");
        if (cleanRows.some(r => !r.due_date)) return toast.error("Each payment row needs a due date");
      }
    }

    setSaving(true);
    try {
      const callsAllotted = pkg === "one_on_one" ? 10 : 0;
      const { error: stuErr } = await supabase.from("students").update({
        payment_state: payMode === "pif" ? "paid_in_full" : "installments",
        calls_included: callsAllotted,
        calls_allotted: callsAllotted,
      } as never).eq("id", student.id);
      if (stuErr) throw new Error("Student: " + stuErr.message);

      const cashUpfront = payMode === "pif" ? tv : dep;
      const paymentType = payMode === "pif" ? "pif" : dep > 0 ? "deposit" : "split";
      const { error: dealErr } = await supabase.from("deals").insert({
        student_id: student.id,
        student_name: student.full_name,
        closer_id: closerId,
        setter_id: setterId || null,
        program_type: pkg === "one_on_one" ? "1:1 Pathway" : "Group Expertise Pathway",
        total_value: tv,
        cash_collected_upfront: cashUpfront,
        payment_type: paymentType,
        deal_date: dealDate,
        created_by: user?.id ?? null,
      } as never);
      if (dealErr) throw new Error("Deal: " + dealErr.message);

      if (payMode === "installments") {
        const cleanCustom = customRows.filter(r => Number(r.amount) > 0);
        const planTotal = scheduleMode === "custom"
          ? cleanCustom.reduce((a, r) => a + Number(r.amount), 0)
          : remaining;
        if (planTotal > 0) {
          const { data: plan, error: planErr } = await supabase.from("installments").insert({
            student_id: student.id,
            student_name: student.full_name,
            closer_id: closerId,
            setter_id: setterId || null,
            coach_id: student.coach_id ?? null,
            total_amount: planTotal,
            currency: "USD",
            created_by: user?.id ?? null,
          } as never).select("id").single();
          if (planErr) throw new Error("Installment plan: " + planErr.message);

          let rows: Record<string, unknown>[] = [];
          if (scheduleMode === "even" && n > 0) {
            const start = new Date(firstDueDate + "T00:00:00");
            rows = Array.from({ length: n }, (_, i) => {
              const due = new Date(start);
              if (frequency === "monthly") due.setMonth(start.getMonth() + i);
              else if (frequency === "biweekly") due.setDate(start.getDate() + i * 14);
              else due.setDate(start.getDate() + i * 7);
              return {
                installment_id: plan.id,
                sequence: i + 1,
                amount: perInstallment,
                currency: "USD",
                due_date: due.toISOString().slice(0, 10),
                status: "upcoming",
              };
            });
          } else {
            rows = cleanCustom
              .slice()
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .map((r, i) => ({
                installment_id: plan.id,
                sequence: i + 1,
                amount: Number(r.amount),
                currency: "USD",
                due_date: r.due_date,
                status: "upcoming",
                payment_method: r.payment_method.trim() || null,
              }));
          }
          if (rows.length) {
            const { error: payErr } = await supabase.from("installment_payments").insert(rows as never);
            if (payErr) throw new Error("Installment schedule: " + payErr.message);
          }
        }
      }

      toast.success("Payment set up · deal and installments created");
      invalidateForTables(qc, ["deals", "installments", "installment_payments", "students"]);
      onDone();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const personOpts = (list: Person[]) => list.map(p => ({ value: p.id, label: p.display_name ?? p.id.slice(0, 8) }));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Set up payment · {student.full_name}</DialogTitle>
          <p className="text-caption text-muted-foreground">
            Creates the deal and installment plan; Revenue and Installments update automatically.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-caption text-muted-foreground">Pathway</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPkg("one_on_one")}
                className={`text-left p-3 rounded-lg border transition ${pkg === "one_on_one" ? "border-primary/40 bg-primary/10" : "border-[var(--border)] bg-[var(--card)] hover:bg-muted"}`}
              >
                <div className="text-sm font-medium">1:1 Pathway</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">10 one-on-one coaching calls + group access</div>
              </button>
              <button
                type="button"
                onClick={() => setPkg("group_only")}
                className={`text-left p-3 rounded-lg border transition ${pkg === "group_only" ? "border-primary/40 bg-primary/10" : "border-[var(--border)] bg-[var(--card)] hover:bg-muted"}`}
              >
                <div className="text-sm font-medium">Group Expertise Pathway</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Group coaching only · no 1:1 calls</div>
              </button>
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-caption text-muted-foreground">Payment</Label>
            <SelectField
              value={payMode}
              onChange={(v) => setPayMode(v as typeof payMode)}
              options={[
                { value: "pif", label: "PIF (paid in full)" },
                { value: "installments", label: "Installments" },
                { value: "scholarship", label: "Scholarship (free)" },
              ]}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {payMode === "scholarship" ? (
          <div className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5 text-caption text-primary">
            Free placement · no deal, revenue, or installment plan is created. The student is marked Scholarship and gets full program access.
          </div>
        ) : (<>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-caption text-muted-foreground">Total value ($)</Label>
            <Input type="number" min="0" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="e.g. 5000" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-caption text-muted-foreground">Deal date</Label>
            <DateField value={dealDate} onChange={setDealDate} clearable={false} className="h-9" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-caption text-muted-foreground">Closer</Label>
            <SelectField value={closerId} onChange={setCloserId} options={personOpts(closers)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-caption text-muted-foreground">Setter (optional)</Label>
            <SelectField value={setterId} onChange={setSetterId} options={personOpts(setters)} allowEmpty emptyLabel="– None –" placeholder="– None –" className="h-9 text-sm" />
          </div>
        </div>
        </>)}

        {payMode === "installments" && (
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-caption text-muted-foreground">Deposit now ($)</Label>
                <Input type="number" min="0" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-caption text-muted-foreground">Schedule</Label>
                <SelectField
                  value={scheduleMode}
                  onChange={(v) => setScheduleMode(v as typeof scheduleMode)}
                  options={[
                    { value: "even", label: "Even split" },
                    { value: "custom", label: "Custom schedule" },
                  ]}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {scheduleMode === "even" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-caption text-muted-foreground"># payments</Label>
                  <Input type="number" min="1" max="24" value={numInstallments} onChange={e => setNumInstallments(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-caption text-muted-foreground">First due</Label>
                  <DateField value={firstDueDate} onChange={setFirstDueDate} clearable={false} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-caption text-muted-foreground">Frequency</Label>
                  <SelectField
                    value={frequency}
                    onChange={(v) => setFrequency(v as typeof frequency)}
                    options={[
                      { value: "monthly", label: "Monthly" },
                      { value: "biweekly", label: "Biweekly" },
                      { value: "weekly", label: "Weekly" },
                    ]}
                    className="h-9 text-sm"
                  />
                </div>
                {perInstallment > 0 && (
                  <div className="col-span-3 text-caption text-muted-foreground">
                    {n} × <span className="text-foreground font-medium">${perInstallment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> after ${dep.toLocaleString()} deposit
                  </div>
                )}
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
                    <Input type="number" min="0" step="0.01" value={r.amount} onChange={e => updateCustomRow(r.id, { amount: e.target.value })} placeholder="Amount" className="col-span-1 sm:col-span-3 h-9" />
                    <DateField value={r.due_date} onChange={v => updateCustomRow(r.id, { due_date: v })} clearable={false} className="col-span-1 sm:col-span-4 h-9" />
                    <Input value={r.payment_method} onChange={e => updateCustomRow(r.id, { payment_method: e.target.value })} placeholder="Method" className="col-span-2 sm:col-span-3 h-9" />
                    <button onClick={() => removeCustomRow(r.id)} className="hidden sm:block sm:col-span-1 p-1.5 rounded hover:bg-danger-bg text-danger-fg justify-self-end">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={addCustomRow}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add row
                  </Button>
                  <span className={`text-caption tabular-nums ${Math.abs(customDelta) < 0.01 ? "text-success-fg" : "text-warning-fg"}`}>
                    scheduled ${customTotal.toLocaleString()} · {Math.abs(customDelta) < 0.01 ? "matches total" : `${customDelta > 0 ? "$" + customDelta.toLocaleString() + " unallocated" : "$" + Math.abs(customDelta).toLocaleString() + " over"}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving || (payMode !== "scholarship" && (tv <= 0 || !closerId))}>
            {saving ? "Saving…" : payMode === "scholarship" ? "Place on scholarship" : "Create deal & plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
