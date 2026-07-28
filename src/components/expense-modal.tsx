import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type BusinessExpense = {
  id: string; name: string; amount: number; recurring: boolean;
  due_day: number | null; one_off_date: string | null; category: string | null;
  notes: string | null; active: boolean;
};

/**
 * Add/edit a business expense. Shared between Finance and the Cash flow
 * calendar (founder 2026-07-28: edit costs right where they appear).
 * `defaultOneOffDate` pre-fills a one-off on a specific day (calendar
 * quick-add, e.g. logging a refund as a cost on its day).
 */
export function ExpenseModal({ editing, defaultOneOffDate, onClose, onSaved }: {
  editing: BusinessExpense | null;
  defaultOneOffDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [recurring, setRecurring] = useState(editing ? editing.recurring : !defaultOneOffDate);
  const [dueDay, setDueDay] = useState(editing?.due_day ? String(editing.due_day) : "1");
  const [oneOffDate, setOneOffDate] = useState(editing?.one_off_date ?? defaultOneOffDate ?? new Date().toISOString().slice(0, 10));
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
      ? await (supabase as never as { from: (t: string) => { update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } } }).from("business_expenses").update(payload).eq("id", editing.id)
      : await (supabase as never as { from: (t: string) => { insert: (v: object) => Promise<{ error: { message: string } | null }> } }).from("business_expenses").insert({ ...payload, created_by: user?.id ?? null });
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
