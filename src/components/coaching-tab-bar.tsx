import { Link, useRouterState } from "@tanstack/react-router";

const TABS = [
  { label: "Calls", url: "/calls" },
  { label: "Coaches", url: "/coaches" },
] as const;

export function CoachingTabBar() {
  const path = useRouterState({ select: s => s.location.pathname });
  return (
    <div className="flex gap-0 border-b border-border mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
      {TABS.map(t => {
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
