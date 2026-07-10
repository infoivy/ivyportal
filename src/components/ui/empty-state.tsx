import type { ReactNode } from "react";

export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card-surface p-10 text-center">
      {icon && (
        <div className="flex justify-center mb-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-full border border-[var(--border)] bg-[var(--background)] flex items-center justify-center">
            {icon}
          </div>
        </div>
      )}
      <div className="text-body font-semibold text-foreground">{title}</div>
      {description && <div className="text-caption text-muted-foreground mt-1 max-w-sm mx-auto">{description}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
