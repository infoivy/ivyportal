type DeltaChipProps = {
  value: number;
  format?: "money" | "count" | "pct";
  positiveIsGood?: boolean;
};

function formatValue(v: number, fmt: "money" | "count" | "pct"): string {
  const abs = Math.abs(v);
  if (fmt === "money") {
    if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`;
    return `$${abs.toFixed(0)}`;
  }
  if (fmt === "pct") return `${abs.toFixed(1)}%`;
  return abs.toLocaleString();
}

export function DeltaChip({ value, format = "count", positiveIsGood = true }: DeltaChipProps) {
  if (value === 0) return null;
  const isPositive = value > 0;
  const good = positiveIsGood ? isPositive : !isPositive;
  const arrow = isPositive ? "▲" : "▼";
  const colorClass = good
    ? "bg-success-bg text-success-fg border-success/20"
    : "bg-warning-bg text-warning-fg border-warning/20";

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${colorClass}`}>
      <span>{arrow}</span>
      <span>{formatValue(value, format)}</span>
    </span>
  );
}
