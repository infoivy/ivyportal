import type { ReactNode } from "react";

/** Consistent page header — 32px bold title, Apple HIG Large Title pattern. */
export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 pb-5 mb-6">
      <div className="min-w-0">
        <h1 className="text-[32px] font-bold tracking-[-0.02em] text-foreground leading-none">{title}</h1>
        {subtitle && <div className="text-[15px] text-muted-foreground mt-2">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
