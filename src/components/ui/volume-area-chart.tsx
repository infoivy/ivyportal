import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export type VolumeSeries = {
  key: string;
  label: string;
  color: string; // one of #9CA3AF, #3B82F6, #22C55E, #F59E0B
  strokeWidth?: number;
};

/**
 * Canonical portal chart. Smooth monotone area lines with a soft gradient
 * fill fading to transparent, dotted horizontal-only gridlines, muted labels,
 * no axis lines, and a small legend row underneath.
 */
export function VolumeAreaChart({
  data, xKey = "label", series, height = 240, yTickCount = 5,
}: {
  data: any[];
  xKey?: string;
  series: VolumeSeries[];
  height?: number;
  yTickCount?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.14} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#8A919C" }} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tick={{ fontSize: 11, fill: "#8A919C" }} tickLine={false} axisLine={false} tickCount={yTickCount} width={38} />
          <Tooltip
            contentStyle={{ background: "#1A1E24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#E3E5E8", fontWeight: 500 }}
            itemStyle={{ color: "#8A919C" }}
            cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
          />
          {series.map(s => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 1.75}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small legend row with a circular color marker per series. */
export function VolumeLegend({ series }: { series: VolumeSeries[] }) {
  return (
    <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground mt-2">
      {series.map(s => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
