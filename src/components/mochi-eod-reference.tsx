import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
import { getMochiEodReference } from "@/lib/mochi.functions";

type ApplyField = "dms_sent" | "calls_booked";

/**
 * Today's Mochi numbers beside the EOD form. When the signed-in setter is
 * matched to a Mochi member (by email), their DMs and sets auto-fill and
 * stay synced — unless the setter edits a field by hand, which wins forever.
 * Nothing is ever submitted automatically.
 */
export function MochiEodReference({
  values,
  onApply,
}: {
  values: { dms_sent: number; calls_booked: number };
  onApply: (field: ApplyField, value: number) => void;
}) {
  const q = useQuery({
    queryKey: ["mochi-eod-reference"],
    queryFn: () => getMochiEodReference(),
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const d = q.data;
  const personal = d?.scope === "personal";
  const touched = useRef<Set<string>>(new Set());
  const [didAutoFill, setDidAutoFill] = useState(false);

  // Track fields the setter edited by hand — auto-fill never fights them.
  const prev = useRef(values);
  useEffect(() => {
    if (prev.current.dms_sent !== values.dms_sent && values.dms_sent !== (d?.dmsOut ?? -1)) touched.current.add("dms_sent");
    if (prev.current.calls_booked !== values.calls_booked && values.calls_booked !== (d?.callsBooked ?? -1)) touched.current.add("calls_booked");
    prev.current = values;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.dms_sent, values.calls_booked]);

  // Auto-fill: keeps untouched fields synced to Mochi as numbers grow.
  // Fills the form only — submitting stays a human decision.
  useEffect(() => {
    if (!d?.available || !personal) return;
    let filled = false;
    if (!touched.current.has("dms_sent") && (d.dmsOut ?? 0) > 0 && values.dms_sent !== d.dmsOut) {
      onApply("dms_sent", d.dmsOut!); filled = true;
    }
    if (!touched.current.has("calls_booked") && (d.callsBooked ?? 0) > 0 && values.calls_booked !== d.callsBooked) {
      onApply("calls_booked", d.callsBooked!); filled = true;
    }
    if (filled) setDidAutoFill(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  if (!d?.available) return null;

  return (
    <div className="rounded-sm border border-[var(--border)] bg-[var(--background)] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Instagram className="h-3 w-3" />
          Mochi today {personal ? `· ${d.memberName}` : "· team-wide"}
          {didAutoFill && <span className="text-success-fg">· auto-filled</span>}
        </div>
        {!personal && (
          <span className="text-[10px] text-muted-foreground/70">
            Your account isn't linked in Mochi yet — ask an admin
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        <RefValue label="DMs out" value={d.dmsOut} />
        <RefValue label="Sets booked" value={d.callsBooked} />
        <RefValue label="New leads" value={d.newLeads} />
        <RefValue label="Active convos" value={d.activeConvos} />
      </div>
    </div>
  );
}

function RefValue({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value ?? "—"}</span>
    </div>
  );
}
