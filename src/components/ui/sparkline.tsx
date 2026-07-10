import { LineChart, Line, ResponsiveContainer } from "recharts";

type SparklineProps = {
  data: number[];
  prevData?: number[];
  color?: string;
  height?: number;
};

export function Sparkline({ data, prevData, color = "var(--chart-1)", height = 36 }: SparklineProps) {
  if (data.length < 3) return null;

  const points = data.map((v, i) => ({
    i,
    curr: v,
    prev: prevData?.[i] ?? undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        {prevData && prevData.length >= 3 && (
          <Line
            type="monotone"
            dataKey="prev"
            stroke="var(--color-muted-foreground)"
            strokeWidth={1}
            strokeOpacity={0.4}
            dot={false}
            isAnimationActive={false}
          />
        )}
        <Line
          type="monotone"
          dataKey="curr"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
