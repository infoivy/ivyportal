import { cn } from "@/lib/utils";

/**
 * Standard page container — every route uses this instead of re-deciding
 * its own gutters and max width.
 */
export function PageShell({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Data-dense pages (tables, kanban) get the wider container. */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 sm:p-6 mx-auto space-y-5",
        wide ? "max-w-[1500px]" : "max-w-[1400px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
