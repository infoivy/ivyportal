import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, addDays, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import type { DateRange as DayPickerRange } from "react-day-picker";

export type RangeUnit = "day" | "week" | "month";
export type DateRange = { from: Date; to: Date; preset: "24h" | "3d" | "7d" | "30d" | "90d" | "custom" | RangeUnit };

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

/** One exact calendar unit (a day, a Mon–Sun week, or a month) around the anchor date. */
export function unitRange(unit: RangeUnit, anchor: Date): DateRange {
  if (unit === "day") {
    const from = new Date(anchor); from.setHours(0, 0, 0, 0);
    const to = new Date(anchor); to.setHours(23, 59, 59, 999);
    return { from, to, preset: "day" };
  }
  if (unit === "week") {
    return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }), preset: "week" };
  }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor), preset: "month" };
}

export function daysBetween(r: DateRange) {
  // Compare calendar days, not raw ms — custom ranges span 00:00 → 23:59:59,
  // which the old ms math counted as an extra day (single day read as 2).
  const a = new Date(r.from); a.setHours(0, 0, 0, 0);
  const b = new Date(r.to); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

export function RangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
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

  const unit: RangeUnit | undefined =
    value.preset === "day" || value.preset === "week" || value.preset === "month" ? value.preset : undefined;
  const shift = (dir: 1 | -1) => {
    if (!unit) return;
    const anchor = unit === "month" ? addMonths(value.from, dir) : addDays(value.from, dir * (unit === "day" ? 1 : 7));
    onChange(unitRange(unit, anchor));
  };
  const nextStart = unit ? (unit === "month" ? addMonths(value.from, 1) : addDays(value.from, unit === "day" ? 1 : 7)) : null;
  const nextDisabled = !nextStart || nextStart > new Date();
  const unitLabel = !unit ? "" : unit === "day"
    ? format(value.from, "EEE, MMM d")
    : unit === "week"
      ? `${format(value.from, "MMM d")} – ${format(value.to, "MMM d")}`
      : format(value.from, "MMMM yyyy");
  const monthOptions = Array.from({ length: 12 }, (_, i) => subMonths(startOfMonth(new Date()), i));

  return (
    <div className="flex items-center gap-2 flex-wrap">
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
            <span className="hidden sm:inline">
              {value.preset === "day" || value.preset === "week" || value.preset === "month" ? "Custom" : label}
            </span>
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
                : "Pick a day · tap again for a range"}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={apply} disabled={!draft?.from}>Apply</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {/* Exact-period mode: pick a specific day, Mon–Sun week, or month
          (founder-requested 2026-08-06) */}
      <Select value={unit ?? ""} onValueChange={(v) => onChange(unitRange(v as RangeUnit, new Date()))}>
        <SelectTrigger
          className={`h-[26px] w-auto rounded-sm px-2.5 py-0 text-[11px] font-medium shadow-none gap-1 border ${
            unit ? "border-primary/25 text-primary bg-primary/5" : "border-border text-muted-foreground"
          }`}
        >
          <SelectValue placeholder="By period" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="day">Day</SelectItem>
          <SelectItem value="week">Week</SelectItem>
          <SelectItem value="month">Month</SelectItem>
        </SelectContent>
      </Select>
      {unit && (
        <div className="inline-flex items-center rounded-sm border border-border bg-card">
          <button onClick={() => shift(-1)} aria-label="Previous period" className="px-1.5 py-1.5 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {unit === "month" ? (
            <Select
              value={format(value.from, "yyyy-MM")}
              onValueChange={(v) => {
                const [y, m] = v.split("-").map(Number);
                onChange(unitRange("month", new Date(y, m - 1, 1)));
              }}
            >
              <SelectTrigger className="h-[26px] w-auto rounded-none border-0 bg-transparent px-1 py-0 text-[11px] font-medium shadow-none gap-1 tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="center">
                {monthOptions.map((m) => (
                  <SelectItem key={format(m, "yyyy-MM")} value={format(m, "yyyy-MM")}>
                    {format(m, "MMMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Popover open={unitOpen} onOpenChange={setUnitOpen}>
              <PopoverTrigger asChild>
                <button className="px-1.5 text-[11px] font-medium tabular-nums text-foreground">
                  {unitLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={value.from}
                  onSelect={(d) => { if (d) { onChange(unitRange(unit, d)); setUnitOpen(false); } }}
                  defaultMonth={value.from}
                  disabled={{ after: new Date() }}
                  numberOfMonths={1}
                />
                {unit === "week" && (
                  <p className="border-t border-border p-2 text-[11px] text-muted-foreground">Pick any day · the Mon–Sun week around it is used</p>
                )}
              </PopoverContent>
            </Popover>
          )}
          <button onClick={() => shift(1)} disabled={nextDisabled} aria-label="Next period" className="px-1.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
