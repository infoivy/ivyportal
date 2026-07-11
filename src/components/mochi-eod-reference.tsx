import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
import { getMochiEodReference } from "@/lib/mochi.functions";

type ApplyField = "dms_sent" | "calls_booked";

/**
 * Today's Mochi numbers beside the EOD form. When the signed-in setter is
 * matched to a Mochi member (by email), their DMs and sets auto-fill any
 * still-zero fields once — the setter keeps full control after that, and
 * "use" re-syncs a field on demand. Nothing is ever submitted automatically.
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
  const autoFilled = useRef(false);
  const [didAutoFill, setDidAutoFill] = useState(false);

  // One-shot prefill: only into fields that are still zero, only when matched.
  useEffect(() => {
    if (!d?.available || !personal || autoFilled.current) return;
    autoFilled.current = true;
    let filled = false;
    if (values.dms_sent === 0 && (d.dmsOut ?? 0) > 0) { onApply("dms_sent", d.dmsOut!); filled = true; }
    if (values.calls_booked === 0 && (d.callsBooked ?? 0) > 0) { onApply("calls_booked", d.callsBooked!); filled = true; }
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
        <RefValue label="DMs out" value={d.dmsOut} onApply={personal && d.dmsOut != null ? () => onApply("dms_sent", d.dmsOut!) : undefined} />
        <RefValue label="Sets booked" value={d.callsBooked} onApply={personal && d.callsBooked != null ? () => onApply("calls_booked", d.callsBooked!) : undefined} />
        <RefValue label="New leads" value={d.newLeads} />
        <RefValue label="Active convos" value={d.activeConvos} />
      </div>
    </div>
  );
}

function RefValue({ label, value, onApply }: { label: string; value: number | null; onApply?: () => void }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value ?? "—"}</span>
      {onApply && (
        <button
          type="button"
          onClick={onApply}
          className="text-[10px] text-primary hover:text-primary/80 underline underline-offset-2"
        >
          use
        </button>
      )}
    </div>
  );
}
