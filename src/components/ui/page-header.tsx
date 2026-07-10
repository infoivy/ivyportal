import type { ReactNode } from "react";

/** Consistent page header used across routes. */
export function PageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4 mb-5">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-blue-400 mb-1">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
