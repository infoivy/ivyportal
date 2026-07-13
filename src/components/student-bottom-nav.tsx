import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, UserCircle, ListChecks, Trophy, Sparkles } from "lucide-react";

const items: { tab: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { tab: "start", label: "Start", icon: Sparkles },
  { tab: "eod", label: "EOD", icon: FileText },
  { tab: "actions", label: "Actions", icon: ListChecks },
  { tab: "leaderboard", label: "Board", icon: Trophy },
];

export function StudentBottomNav({ activeTab, onTabChange }: { activeTab?: string; onTabChange?: (t: string) => void }) {
  const path = useRouterState({ select: s => s.location.pathname });
  const onPortal = path === "/student-portal";
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className="grid grid-cols-5">
        {items.map(it => {
          const Icon = it.icon;
          const active = onPortal && activeTab === it.tab;
          return (
            <button
              key={it.tab}
              onClick={() => onTabChange?.(it.tab)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </button>
          );
        })}
        <Link
          to="/profile"
          className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${path === "/profile" ? "text-primary" : "text-muted-foreground"}`}
        >
          <UserCircle className="h-4 w-4" />
          Me
        </Link>
      </div>
    </nav>
  );
}
