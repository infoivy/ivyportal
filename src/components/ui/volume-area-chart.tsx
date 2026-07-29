import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

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
  data, xKey = "label", series, height = 240, yTickCount = 5, showDots = false,
}: {
  data: any[];
  xKey?: string;
  series: VolumeSeries[];
  height?: number;
  yTickCount?: number;
  showDots?: boolean;
}) {
  const gridColor = "var(--color-border)";
  const tickColor = "var(--color-muted-foreground)";
  // Phones get a shorter plot, thinned date labels, and no dot clutter — the
  // desktop chart squeezed into 375px read as cramped (founder 2026-07-29).
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? Math.min(height, 200) : height;
  const xInterval = isMobile ? ("preserveStartEnd" as const) : (data.length > 40 ? ("preserveStartEnd" as const) : 0);
  const dots = showDots && !isMobile;

  const tooltipProps = {
    contentStyle: {
      background: "var(--color-card)",
      border: "1px solid var(--color-border)",
      borderRadius: 10,
      fontSize: 12,
      boxShadow: "var(--shadow-overlay)",
    },
    labelStyle: { color: "var(--color-foreground)", fontWeight: 500 as const, marginBottom: 4 },
  };

  // A single bucket (e.g. the 24h range) has no line to draw — an area chart
  // degenerates to floating dots. Render grouped bars instead.
  if (data.length === 1) {
    return (
      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickCount={yTickCount} width={38} />
            <Tooltip {...tooltipProps} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
            {series.map(s => (
              <Bar
                key={s.key}
                name={s.label || s.key}
                dataKey={s.key}
                fill={s.color}
                fillOpacity={s.ghost ? 0.35 : 0.9}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: isMobile ? 6 : 12, left: isMobile ? -16 : -10, bottom: 0 }}>
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
            tick={{ fontSize: isMobile ? 10 : 11, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={xInterval}
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            tickCount={yTickCount}
            width={isMobile ? 32 : 38}
          />
          <Tooltip {...tooltipProps} cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }} />
          {series.map(s => (
            <Area
              key={s.key}
              name={s.label || s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 1.75}
              strokeOpacity={s.strokeOpacity ?? 1}
              strokeLinecap="round"
              fill={s.ghost ? "none" : `url(#grad-${s.key})`}
              fillOpacity={s.ghost ? 0 : 1}
              dot={dots && !s.ghost ? { r: 2.75, strokeWidth: 0, fill: s.color } : false}
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
