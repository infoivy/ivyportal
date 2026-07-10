import type { ReactNode } from "react";

/** Consistent page header — 32px bold title, Apple HIG Large Title pattern. */
export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 pb-5 mb-6">
      <div className="min-w-0">
        <h1 className="text-display text-foreground">{title}</h1>
        {subtitle && <div className="text-body text-muted-foreground mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
