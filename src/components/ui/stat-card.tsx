import type { ReactNode } from "react";

/** Consistent stat tile. */
export function StatCard({
  label, value, icon, accent, hint,
}: { label: string; value: ReactNode; icon?: ReactNode; accent?: boolean; hint?: ReactNode }) {
  return (
    <div className={`border border-[#1f2530] rounded-sm p-3 ${accent ? "bg-emerald-500/5" : "bg-[#0f1116]"}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
        {icon}{label}
      </div>
      <div className={`text-xl font-mono font-semibold ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1 font-mono">{hint}</div>}
    </div>
  );
}
