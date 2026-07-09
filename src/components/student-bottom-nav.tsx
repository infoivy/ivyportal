import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, UserCircle, ListChecks, Trophy, Calendar } from "lucide-react";

const items = [
  { to: "/student-portal", label: "EOD", icon: FileText, hash: "" },
  { to: "/student-portal", label: "Actions", icon: ListChecks, hash: "actions" },
  { to: "/student-portal", label: "Coaching", icon: Calendar, hash: "coaching" },
  { to: "/student-portal", label: "Goals", icon: Trophy, hash: "milestones" },
  { to: "/profile", label: "Me", icon: UserCircle, hash: "" },
];

export function StudentBottomNav() {
  const path = useRouterState({ select: s => s.location.pathname });
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#1f2530] bg-[#0a0b0f]/95 backdrop-blur">
      <div className="grid grid-cols-5">
        {items.map(it => {
          const Icon = it.icon;
          const active = path === it.to && (typeof window === "undefined" || (it.hash ? window.location.hash === `#${it.hash}` : true));
          return (
            <Link
              key={it.label}
              to={it.to}
              hash={it.hash || undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "text-emerald-400" : "text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
