import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

// One Students section: the whole fulfillment side lives behind a single
// sidebar entry, tabbed here — same pattern as the Sales section. Each tab
// only shows for roles its route admits.
const TABS = [
  { label: "Students", url: "/students", roles: ["admin", "closer", "csm", "coach", "founder", "cofounder"] },
  { label: "CSM", url: "/csm", roles: ["admin", "csm", "coach", "founder", "cofounder"] },
  { label: "1-on-1 Calls", url: "/calls", roles: ["admin", "coach", "csm"] },
  { label: "Testimonials", url: "/testimonials", roles: ["admin", "coach", "closer", "setter", "csm"] },
] as const;

export function firstStudentsTab(roles: string[]) {
  return TABS.find(t => t.roles.some(r => roles.includes(r)))?.url ?? "/students";
}

export function StudentsTabBar() {
  const path = useRouterState({ select: s => s.location.pathname });
  const { roles } = useAuth();
  const visible = TABS.filter(t => t.roles.some(r => roles.includes(r)));
  if (visible.length <= 1) return null;
  return (
    <div className="flex gap-0 border-b border-[var(--border)] mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto no-scrollbar">
      {visible.map(t => {
        const active = path.startsWith(t.url);
        return (
          <Link
            key={t.url}
            to={t.url}
            className={`px-4 py-2.5 text-caption font-medium border-b-2 motion-safe:transition-colors whitespace-nowrap ${
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
