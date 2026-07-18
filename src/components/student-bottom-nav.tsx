import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, UserCircle, ListChecks, Trophy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const items: { tab: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { tab: "start", label: "Start", icon: Sparkles },
  { tab: "eod", label: "EOD", icon: FileText },
  { tab: "actions", label: "Actions", icon: ListChecks },
  { tab: "leaderboard", label: "Board", icon: Trophy },
];

export function StudentBottomNav({ activeTab, onTabChange }: { activeTab?: string; onTabChange?: (t: string) => void }) {
  const path = useRouterState({ select: s => s.location.pathname });
  const { user } = useAuth();
  // Until Start Here is complete the portal is Start Here only — mirror that
  // here so the mobile nav doesn't advertise tabs the page won't render.
  const lockedQ = useQuery({
    queryKey: ["student-portal-locked", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("onboarding_completed_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data && !data.onboarding_completed_at;
    },
  });
  const locked = lockedQ.data === true;
  const visible = locked ? items.filter(it => it.tab === "start") : items;
  const onPortal = path === "/student-portal";
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className={`grid ${locked ? "grid-cols-2" : "grid-cols-5"}`}>
        {visible.map(it => {
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
