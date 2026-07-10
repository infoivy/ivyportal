import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Segment<T extends string> = { label: string; value: T };

type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string>({
  segments, value, onChange, className,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbStyle, setThumbStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeIndex = segments.findIndex(s => s.value === value);
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    const btn = buttons[activeIndex];
    if (!btn) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setThumbStyle({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    });
    setReady(true);
  }, [value, segments]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative flex items-center p-[3px] rounded-[10px] bg-muted gap-0",
        className,
      )}
    >
      {/* Sliding thumb — GPU animated via transform (review-animations: opacity+transform only) */}
      {ready && (
        <span
          aria-hidden
          className="absolute top-[3px] h-[calc(100%-6px)] rounded-[8px] bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)] dark:shadow-none dark:bg-background/80 pointer-events-none motion-safe:transition-[left,width] motion-safe:duration-200 motion-safe:[transition-timing-function:cubic-bezier(0.2,0,0,1)]"
          style={{ left: thumbStyle.left, width: thumbStyle.width }}
        />
      )}
      {segments.map(seg => (
        <button
          key={seg.value}
          role="tab"
          aria-selected={seg.value === value}
          onClick={() => onChange(seg.value)}
          className={cn(
            "relative z-10 flex-1 px-3 py-1.5 text-[13px] font-medium rounded-[8px] leading-none",
            "motion-safe:transition-colors motion-safe:duration-150",
            seg.value === value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {seg.label}
        </button>
      ))}
    </div>
  );
}
