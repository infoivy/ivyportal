import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

// One Sales section: operations + money live behind a single sidebar entry,
// tabbed here. Each tab only shows for roles its route admits.
const TABS = [
  { label: "Sales", url: "/sales", roles: ["admin", "closer"] },
  { label: "Revenue", url: "/revenue", roles: ["admin", "closer", "coach", "founder"] },
  { label: "Installments", url: "/installments", roles: ["admin", "closer", "coach", "founder"] },
  { label: "Payouts", url: "/payouts", roles: ["admin", "cofounder"] },
] as const;

export function RevenueTabBar() {
  const path = useRouterState({ select: s => s.location.pathname });
  const { roles } = useAuth();
  const visible = TABS.filter(t => t.roles.some(r => roles.includes(r)));
  if (visible.length <= 1) return null;
  return (
    <div className="flex gap-0 border-b border-[var(--border)] mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto no-scrollbar">
      {visible.map(t => {
        const active = t.url === "/revenue" || t.url === "/sales"
          ? path === t.url
          : path.startsWith(t.url);
        return (
          <Link
            key={t.url}
            to={t.url}
            search={t.url === "/sales" ? ({ tab: "operations" } as never) : undefined}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 motion-safe:transition-colors whitespace-nowrap ${
              active
                ? "border-primary text-foreground"
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
