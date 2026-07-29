import { RevenueTabBar } from "@/components/revenue-tab-bar";

/**
 * One head for the whole money section (founder 2026-07-29: switching
 * Overview / Money in / Payouts must not change the header or resize the
 * page). Same width, same title block, tabs in the same spot; each page
 * slots its own controls on the right and swaps only the content below.
 */
export function MoneyShell({ actions, children }: {
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-none p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 min-h-[76px]">
        <div>
          <h1 className="text-display text-foreground">Money</h1>
          <p className="text-body text-muted-foreground mt-1">Cash in, payouts out, and the overview.</p>
        </div>
        <div className="flex min-h-9 flex-wrap items-center gap-2">{actions}</div>
      </header>
      <RevenueTabBar />
      {children}
    </div>
  );
}
