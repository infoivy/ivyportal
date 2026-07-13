import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import type { DateRange as DayPickerRange } from "react-day-picker";

export type DateRange = { from: Date; to: Date; preset: "24h" | "3d" | "7d" | "30d" | "90d" | "custom" };

const PRESETS: { key: "24h" | "3d" | "7d" | "30d" | "90d"; label: string; days: number }[] = [
  { key: "24h", label: "24H", days: 1 },
  { key: "3d", label: "3D", days: 3 },
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
];

export function rangeFor(preset: "24h" | "3d" | "7d" | "30d" | "90d"): DateRange {
  const days = PRESETS.find((p) => p.key === preset)!.days;
  const to = new Date();
  return { from: subDays(to, days - 1), to, preset };
}

export function daysBetween(r: DateRange) {
  return Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000) + 1;
}

export function RangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  // One click = that single day; a second click stretches it into a range.
  const [draft, setDraft] = useState<DayPickerRange | undefined>({ from: value.from, to: value.to });

  const apply = () => {
    if (!draft?.from) return;
    const from = new Date(draft.from); from.setHours(0, 0, 0, 0);
    const to = new Date(draft.to ?? draft.from); to.setHours(23, 59, 59, 999);
    onChange({ from, to, preset: "custom" });
    setOpen(false);
  };

  const label =
    value.preset === "custom" && format(value.from, "yyyy-MM-dd") === format(value.to, "yyyy-MM-dd")
      ? format(value.from, "EEE, MMM d")
      : value.preset === "custom"
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
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) setDraft({ from: value.from, to: value.to });
        }}
      >
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
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from ?? new Date()}
            disabled={{ after: new Date() }}
            numberOfMonths={1}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border p-2.5">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {draft?.from
                ? draft.to && format(draft.to, "yyyy-MM-dd") !== format(draft.from, "yyyy-MM-dd")
                  ? `${format(draft.from, "MMM d")} → ${format(draft.to, "MMM d")}`
                  : `${format(draft.from, "EEE, MMM d")} · one day`
                : "Pick a day — tap again for a range"}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={apply} disabled={!draft?.from}>Apply</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
