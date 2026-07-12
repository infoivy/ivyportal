import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalIcon } from "lucide-react";
import { format, subDays } from "date-fns";

export type DateRange = { from: Date; to: Date; preset: "24h" | "7d" | "30d" | "90d" | "custom" };

const PRESETS: { key: "24h" | "7d" | "30d" | "90d"; label: string; days: number }[] = [
  { key: "24h", label: "24H", days: 1 },
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
];

export function rangeFor(preset: "24h" | "7d" | "30d" | "90d"): DateRange {
  const days = PRESETS.find((p) => p.key === preset)!.days;
  const to = new Date();
  return { from: subDays(to, days - 1), to, preset };
}

export function daysBetween(r: DateRange) {
  return Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000) + 1;
}

export function RangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [fromDraft, setFromDraft] = useState(format(value.from, "yyyy-MM-dd"));
  const [toDraft, setToDraft] = useState(format(value.to, "yyyy-MM-dd"));

  const applyCustom = () => {
    const f = new Date(fromDraft + "T00:00:00");
    const t = new Date(toDraft + "T23:59:59");
    if (isNaN(f.getTime()) || isNaN(t.getTime()) || f > t) return;
    onChange({ from: f, to: t, preset: "custom" });
    setOpen(false);
  };

  const label =
    value.preset === "custom"
      ? `${format(value.from, "MMM d")} → ${format(value.to, "MMM d")}`
      : `${format(value.from, "MMM d")} → ${format(value.to, "MMM d, yyyy")}`;

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(rangeFor(p.key))}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-sm transition ${
              value.preset === p.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm border transition ${
              value.preset === "custom"
                ? "border-primary/25 text-primary bg-primary/5"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalIcon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">Custom</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Custom range</div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-muted-foreground">From</label>
              <input
                type="date"
                value={fromDraft}
                onChange={(e) => setFromDraft(e.target.value)}
                className="w-full h-8 rounded-sm border border-input bg-background px-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">To</label>
              <input
                type="date"
                value={toDraft}
                onChange={(e) => setToDraft(e.target.value)}
                className="w-full h-8 rounded-sm border border-input bg-background px-2 text-xs"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={applyCustom}>Apply</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
