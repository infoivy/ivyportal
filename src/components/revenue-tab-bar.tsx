import { Link, useRouterState } from "@tanstack/react-router";

const TABS = [
  { label: "Overview", url: "/revenue" },
  { label: "Installments", url: "/installments" },
  { label: "Payouts", url: "/payouts" },
] as const;

export function RevenueTabBar() {
  const path = useRouterState({ select: s => s.location.pathname });
  return (
    <div className="flex gap-0 border-b border-[var(--border)] mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
      {TABS.map(t => {
        const active = t.url === "/revenue" ? path === "/revenue" : path.startsWith(t.url);
        return (
          <Link
            key={t.url}
            to={t.url}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              active
                ? "border-green-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
