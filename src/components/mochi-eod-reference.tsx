import { useQuery } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
import { getMochiEodReference } from "@/lib/mochi.functions";

type ApplyField = "dms_sent" | "calls_booked";

/**
 * Today's Mochi numbers beside the EOD form — a reference, never an
 * auto-write. Apply buttons only exist for fields with a clean 1:1 meaning
 * (DMs out → DMs sent, booked → sets); everything else is context.
 */
export function MochiEodReference({ onApply }: { onApply: (field: ApplyField, value: number) => void }) {
  const q = useQuery({
    queryKey: ["mochi-eod-reference"],
    queryFn: () => getMochiEodReference(),
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const d = q.data;
  if (!d?.available) return null;

  const personal = d.scope === "personal";

  return (
    <div className="rounded-sm border border-[var(--border)] bg-[var(--background)] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Instagram className="h-3 w-3" />
          Mochi today {personal ? `· ${d.memberName}` : "· team-wide"}
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
