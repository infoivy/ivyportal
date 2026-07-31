/**
 * Record refund: the one action that removes a refunded student's money from
 * EVERYTHING at once (founder 2026-07-31 after the half-void bug: voiding a
 * plan left already-paid installments feeding commissions).
 *
 * It dry-runs first so the operator sees exactly what will change, then calls
 * the refund_student_money RPC: voids active deals and plans, waives unpaid
 * installments, flips paid ones to "refunded". Optionally cancels the
 * student's set rows so setter stats stay honest too.
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invalidateForTables } from "@/lib/query-keys";
import { cancelSet } from "@/lib/calendar.functions";
import { money } from "@/lib/revenue";

type Preview = {
  deals: number;
  dealsCash: number;
  plans: number;
  paidPayments: number;
  paidCash: number;
  upcoming: number;
  sets: { id: string; event_start: string }[];
};

export function RefundStudentDialog({ studentId, studentName, onClose }: {
  studentId: string;
  studentName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const cancelSetFn = useServerFn(cancelSet);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("Student refunded");
  const [cancelSets, setCancelSets] = useState(true);
  const [archive, setArchive] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const name = studentName.trim();
      const [byId, byName, instRes, setsRes] = await Promise.all([
        supabase.from("deals").select("id, cash_collected_upfront").eq("student_id", studentId).is("voided_at", null),
        supabase.from("deals").select("id, cash_collected_upfront").is("student_id", null).is("voided_at", null).ilike("student_name", name),
        (supabase.from("installments" as any).select("id, installment_payments(id, amount, status)").eq("student_id", studentId).is("voided_at", null) as any),
        (supabase.from("set_reminders" as any).select("id, event_start").ilike("prospect", name).neq("status", "cancelled") as any),
      ]);
      if (!alive) return;
      const err = byId.error ?? byName.error ?? instRes.error ?? setsRes.error;
      if (err) { setLoadError(err.message); return; }
      const deals = [...(byId.data ?? []), ...(byName.data ?? [])];
      const pays = ((instRes.data ?? []) as { installment_payments?: { id: string; amount: number; status: string }[] }[])
        .flatMap(i => i.installment_payments ?? []);
      const paid = pays.filter(p => p.status === "paid");
      setPreview({
        deals: deals.length,
        dealsCash: deals.reduce((s, d) => s + Number(d.cash_collected_upfront ?? 0), 0),
        plans: (instRes.data ?? []).length,
        paidPayments: paid.length,
        paidCash: paid.reduce((s, p) => s + Number(p.amount), 0),
        upcoming: pays.filter(p => ["upcoming", "late", "missed"].includes(p.status)).length,
        sets: ((setsRes.data ?? []) as { id: string; event_start: string }[]),
      });
    })();
    return () => { alive = false; };
  }, [studentId, studentName]);

  const apply = async () => {
    if (!preview || reason.trim().length < 3) return;
    setApplying(true);
    const { data, error } = await (supabase.rpc as any)("refund_student_money", {
      p_student_id: studentId,
      p_reason: reason.trim(),
      p_archive: archive,
    });
    if (error) {
      setApplying(false);
      return toast.error(error.message);
    }
    let setsCancelled = 0;
    if (cancelSets) {
      for (const s of preview.sets) {
        try {
          await cancelSetFn({ data: { id: s.id, reason: `Student refunded: ${reason.trim()}` } });
          setsCancelled += 1;
        } catch (err) {
          console.error("[refund] set cancel failed:", err);
        }
      }
    }
    setApplying(false);
    const r = (data ?? {}) as { deals?: number; deals_cash?: number; plans?: number; paid_payments?: number; paid_cash?: number; waived?: number };
    toast.success(
      `${studentName} refunded · ${r.deals ?? 0} deal${(r.deals ?? 0) === 1 ? "" : "s"} voided (${money(Number(r.deals_cash ?? 0))}), ` +
      `${r.paid_payments ?? 0} paid payment${(r.paid_payments ?? 0) === 1 ? "" : "s"} refunded (${money(Number(r.paid_cash ?? 0))}), ` +
      `${r.waived ?? 0} upcoming waived${setsCancelled ? `, ${setsCancelled} set${setsCancelled === 1 ? "" : "s"} cancelled` : ""}`,
      { duration: 9000 },
    );
    invalidateForTables(qc, ["deals", "installments", "installment_payments", "students", "set_reminders"]);
    onClose();
  };

  const nothingToRefund = preview && preview.deals === 0 && preview.plans === 0 && preview.paidPayments === 0 && preview.upcoming === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-card border border-border rounded-t-xl sm:rounded-lg shadow-xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={`Record refund for ${studentName}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-danger-fg" /> Record refund · {studentName}
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Removes their money from cash collected, commissions, payouts, and Finance in one step. Records stay visible with a refund note; nothing is deleted.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted shrink-0" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadError ? (
          <div className="rounded-md border border-danger/25 bg-danger-bg px-3 py-2 text-[12px] text-danger-fg">{loadError}</div>
        ) : !preview ? (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking their deals, plans, and payments…
          </div>
        ) : (
          <>
            <div className="rounded-md border border-border bg-muted/30 px-3.5 py-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Deals voided</span><span className="tabular-nums font-medium">{preview.deals} · {money(preview.dealsCash)} upfront</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Payment plans voided</span><span className="tabular-nums font-medium">{preview.plans}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Paid installments refunded</span><span className="tabular-nums font-medium">{preview.paidPayments} · {money(preview.paidCash)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Upcoming installments waived</span><span className="tabular-nums font-medium">{preview.upcoming}</span></div>
            </div>

            {nothingToRefund && (
              <div className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-bg px-3 py-2 text-[12px] text-warning-fg">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                No active money found for this student. Their deals or plans may already be voided.
              </div>
            )}

            <label className="block">
              <span className="text-[12px] text-muted-foreground">Reason (required, lands on every voided record)</span>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="mt-1 w-full h-9 px-3 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[13px] focus:outline-none focus:border-ring"
              />
            </label>

            {preview.sets.length > 0 && (
              <label className="flex items-start gap-2 text-[12px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={cancelSets} onChange={e => setCancelSets(e.target.checked)} className="mt-0.5" />
                <span>Also cancel their {preview.sets.length} set row{preview.sets.length === 1 ? "" : "s"} in the setter tracker (keeps show rates honest)</span>
              </label>
            )}

            <label className="flex items-start gap-2 text-[12px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={archive} onChange={e => setArchive(e.target.checked)} className="mt-0.5" />
              <span>Archive the student: removed from every list and picker (history preserved, page reachable from the Archived view)</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={onClose} className="text-[12px] text-muted-foreground hover:text-foreground px-3 py-2">Cancel</button>
              <button
                onClick={() => void apply()}
                disabled={applying || reason.trim().length < 3}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-danger text-white hover:opacity-90 px-3.5 py-2 rounded-md disabled:opacity-40"
              >
                {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                Record refund
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
