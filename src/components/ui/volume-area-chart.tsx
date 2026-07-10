import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export type VolumeSeries = {
  key: string;
  label: string;
  color: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  ghost?: boolean;
};

/** CSS variable reader — falls back gracefully on SSR */
function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function VolumeAreaChart({
  data, xKey = "label", series, height = 240, yTickCount = 5,
}: {
  data: any[];
  xKey?: string;
  series: VolumeSeries[];
  height?: number;
  yTickCount?: number;
}) {
  const gridColor = "var(--color-border)";
  const tickColor = "var(--color-muted-foreground)";

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="85%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            tickCount={yTickCount}
            width={38}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              fontSize: 12,
              boxShadow: "var(--shadow-overlay)",
            }}
            labelStyle={{ color: "var(--color-foreground)", fontWeight: 500, marginBottom: 4 }}
            cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
          />
          {series.map(s => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 1.75}
              strokeOpacity={s.strokeOpacity ?? 1}
              strokeLinecap="round"
              fill={s.ghost ? "none" : `url(#grad-${s.key})`}
              fillOpacity={s.ghost ? 0 : 1}
              dot={false}
              activeDot={s.ghost ? false : { r: 3, strokeWidth: 0, fill: s.color }}
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
    <div className="flex items-center justify-center gap-5 text-[13px] text-muted-foreground mt-2">
      {series.map(s => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
