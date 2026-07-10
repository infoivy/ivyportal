import type { ReactNode } from "react";

/** Consistent page header used across routes. */
export function PageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 pb-5 mb-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">{eyebrow}</div>
        )}
        <h1 className="text-[28px] font-semibold tracking-tight truncate leading-tight">{title}</h1>
        {subtitle && <div className="text-sm text-muted-foreground mt-1.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
