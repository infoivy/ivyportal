type Segment = { label: string; value: number; color: string };

type BreakdownBarProps = {
  segments: Segment[];
  total?: number;
  title?: string;
};

export function BreakdownBar({ segments, total, title }: BreakdownBarProps) {
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
  if (sum === 0) return null;

  return (
    <div className="space-y-2">
      {title && (
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      )}
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map((s) => {
          const pct = (s.value / sum) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={s.label}
              className="transition-[width] duration-500 ease-out motion-safe:transition-[width]"
              style={{ width: `${pct}%`, backgroundColor: s.color }}
            />
          );
        })}
      </div>
      <div className="space-y-1">
        {segments.map((s) => {
          const pct = sum > 0 ? ((s.value / sum) * 100).toFixed(0) : "0";
          return (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium tabular-nums">{s.value.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
