import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, UserCircle, ListChecks, Trophy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const items: { tab: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { tab: "eod", label: "EOD", icon: FileText },
  { tab: "actions", label: "Actions", icon: ListChecks },
  { tab: "leaderboard", label: "Board", icon: Trophy },
  { tab: "start", label: "Start", icon: Sparkles },
];

const GRID = { 1: "grid-cols-1", 2: "grid-cols-2", 4: "grid-cols-4", 5: "grid-cols-5" } as Record<number, string>;

export function StudentBottomNav({ activeTab, onTabChange }: { activeTab?: string; onTabChange?: (t: string) => void }) {
  const path = useRouterState({ select: s => s.location.pathname });
  const { user } = useAuth();
  // Mirror the portal: locked → Start is everything; unlocked with the
  // checklist finished → Start disappears and EOD leads.
  const stateQ = useQuery({
    queryKey: ["student-portal-locked", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: s } = await supabase
        .from("students")
        .select("id, onboarding_completed_at, phase")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!s) return { locked: false, graduated: false };
      return {
        locked: !s.onboarding_completed_at,
        graduated: ["offer_won", "testimonial", "graduated"].includes(s.phase),
      };
    },
  });
  const locked = stateQ.data?.locked === true;
  const graduated = stateQ.data?.graduated === true;
  // Graduated students see the graduation page only — no tabs to advertise.
  // Start exists only while locked (founder-directed 2026-07-25).
  const visible = graduated
    ? []
    : locked
      ? items.filter(it => it.tab === "start")
      : items.filter(it => it.tab !== "start");
  const onPortal = path === "/student-portal";
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className={`grid pb-[max(0.25rem,env(safe-area-inset-bottom))] ${GRID[visible.length + 1] ?? "grid-cols-5"}`}>
        {visible.map(it => {
          const Icon = it.icon;
          const active = onPortal && activeTab === it.tab;
          return (
            <button
              key={it.tab}
              onClick={() => onTabChange?.(it.tab)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </button>
          );
        })}
        <Link
          to="/profile"
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] ${path === "/profile" ? "text-primary" : "text-muted-foreground"}`}
        >
          <UserCircle className="h-4 w-4" />
          Me
        </Link>
      </div>
    </nav>
  );
}
