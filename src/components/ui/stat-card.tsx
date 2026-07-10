import type { ReactNode } from "react";

/** Consistent stat tile — muted label, large light number, subtle depth. */
export function StatCard({
  label, value, icon, accent, hint,
}: { label: string; value: ReactNode; icon?: ReactNode; accent?: boolean; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-card p-5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
        {accent && <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />}
        {icon}{label}
      </div>
      <div className="text-3xl font-light tracking-tight text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>}
    </div>
  );
}
