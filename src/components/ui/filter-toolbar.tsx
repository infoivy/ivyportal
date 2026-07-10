import { ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "@/components/range-picker";
import { RangePicker, daysBetween } from "@/components/range-picker";

type FilterToolbarProps = {
  value: DateRange;
  onChange: (r: DateRange) => void;
  compare?: boolean;
  onCompareToggle?: () => void;
  showCompare?: boolean;
};

/** The window compared against: the same number of days immediately before the range. */
function prevWindowLabel(range: DateRange): string {
  const days = daysBetween(range);
  const prevTo = new Date(range.from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - days + 1);
  return `${format(prevFrom, "MMM d")} – ${format(prevTo, "MMM d")}`;
}

export function FilterToolbar({
  value,
  onChange,
  compare = false,
  onCompareToggle,
  showCompare = true,
}: FilterToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <RangePicker value={value} onChange={onChange} />
      {showCompare && onCompareToggle && (
        <button
          onClick={onCompareToggle}
          title={`Compare against the previous ${daysBetween(value)} days`}
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm border transition ${
            compare
              ? "border-primary/25 text-primary bg-primary/5"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowRightLeft className="h-3 w-3" />
          Compare
        </button>
      )}
      {showCompare && compare && (
        <span className="text-[11px] text-muted-foreground">vs {prevWindowLabel(value)}</span>
      )}
    </div>
  );
}
