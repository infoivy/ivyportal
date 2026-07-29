import { cn } from "@/lib/utils";

/** Standard full-width workspace container for authenticated routes. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  /** Retained for backwards compatibility. All workspaces are fluid now. */
  wide?: boolean;
}) {
  return (
    <div className={cn("w-full max-w-none p-4 sm:p-6 space-y-5", className)}>
      {children}
    </div>
  );
}
