import { ArrowRightLeft } from "lucide-react";
import type { DateRange } from "@/components/range-picker";
import { RangePicker } from "@/components/range-picker";

type FilterToolbarProps = {
  value: DateRange;
  onChange: (r: DateRange) => void;
  compare?: boolean;
  onCompareToggle?: () => void;
  showCompare?: boolean;
};

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
    </div>
  );
}
