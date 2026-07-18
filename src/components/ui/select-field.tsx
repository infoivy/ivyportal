import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

/**
 * shadcn Select with a native-select-like API — drop-in for
 * <select value onChange> swaps. Use value="" for "nothing selected"
 * (rendered via placeholder; Radix reserves empty item values).
 */
export function SelectField({
  value,
  onChange,
  options,
  placeholder = "– Select –",
  className,
  disabled,
  allowEmpty = false,
  emptyLabel = "– None –",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Adds a "none" choice that maps back to "". */
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const EMPTY = "__none__";
  return (
    <Select
      value={value === "" ? undefined : value}
      onValueChange={(v) => onChange(v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={EMPTY}>{emptyLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
