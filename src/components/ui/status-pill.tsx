import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "accent";

const TONES: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-success-bg text-success-fg", dot: "bg-success" },
  warning: { pill: "bg-warning-bg text-warning-fg", dot: "bg-warning" },
  danger:  { pill: "bg-danger-bg text-danger-fg",   dot: "bg-danger" },
  neutral: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  accent:  { pill: "bg-primary/10 text-primary",     dot: "bg-primary" },
};

/**
 * The one way to show status: KPI hit/miss, paid/due/overdue, call outcomes,
 * deal stages, at-risk. Color here always means something.
 */
export function StatusPill({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-micro font-medium whitespace-nowrap",
        t.pill,
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", t.dot)} />}
      {children}
    </span>
  );
}
