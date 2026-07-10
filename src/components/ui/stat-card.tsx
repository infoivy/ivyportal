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
    <div className="relative card-surface p-5 overflow-hidden">
      {/* Label — normal-case, 13px, muted */}
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-3">
        {accent && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
        {icon && <span className="text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
        {label}
      </div>
      {noData ? (
        <div className="text-[12px] text-muted-foreground bg-muted rounded-full px-3 py-1 w-fit">
          No data
        </div>
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-[28px] font-semibold tracking-[-0.02em] text-foreground num">{value}</div>
          {delta !== undefined && <DeltaChip {...delta} />}
        </div>
      )}
      {hint && <div className="text-[13px] text-muted-foreground mt-1.5">{hint}</div>}
      {sparkData && sparkData.length >= 3 && (
        <div className="absolute bottom-0 right-0 w-24 h-9 opacity-30 pointer-events-none">
          <Sparkline data={sparkData} prevData={prevSparkData} />
        </div>
      )}
    </div>
  );
}
