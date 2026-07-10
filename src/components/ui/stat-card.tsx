import type { ReactNode } from "react";
import { DeltaChip } from "./delta-chip";
import { Sparkline } from "./sparkline";

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  hint?: ReactNode;
  delta?: { value: number; format?: "money" | "count" | "pct"; positiveIsGood?: boolean };
  sparkData?: number[];
  prevSparkData?: number[];
  noData?: boolean;
};

export function StatCard({ label, value, icon, accent, hint, delta, sparkData, prevSparkData, noData }: StatCardProps) {
  return (
    <div className="relative rounded-xl border border-white/[0.07] bg-card p-5 overflow-hidden">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
        {accent && <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />}
        {icon}{label}
      </div>
      {noData ? (
        <div className="text-[10px] text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5 w-fit mt-1">
          No data available
        </div>
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-3xl font-light tracking-tight text-foreground">{value}</div>
          {delta !== undefined && <DeltaChip {...delta} />}
        </div>
      )}
      {hint && <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>}
      {sparkData && sparkData.length >= 3 && (
        <div className="absolute bottom-0 right-0 w-24 h-9 opacity-40 pointer-events-none">
          <Sparkline data={sparkData} prevData={prevSparkData} />
        </div>
      )}
    </div>
  );
}
