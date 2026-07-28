import * as React from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { timezoneOptions, timeIn } from "@/components/student-local-time";
import { cn } from "@/lib/utils";

/**
 * Searchable timezone picker (shadcn combobox pattern) — type a city instead
 * of scrolling 400 options. Each entry shows its current local time so the
 * right zone is self-evident.
 */
export function TimezoneCombobox({ value, onChange, className, placeholder = "Select your timezone…" }: {
  value: string;
  onChange: (tz: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const options = React.useMemo(() => timezoneOptions(), []);
  const now = new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full h-10 items-center gap-2 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="flex-1 text-left truncate">{value ? value.replace(/_/g, " ") : placeholder}</span>
          {value && <span className="text-xs text-muted-foreground tabular-nums shrink-0">{timeIn(value, now)}</span>}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0 bg-[var(--card)] border-[var(--border)]">
        <Command>
          <CommandInput placeholder="Search city or region…" className="h-9" />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {options.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz.replace(/_/g, " ")}
                  onSelect={() => { onChange(tz); setOpen(false); }}
                  className="text-xs gap-2"
                >
                  <Check className={cn("h-3 w-3", value === tz ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{tz.replace(/_/g, " ")}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{timeIn(tz, now)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
