import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, TrendingUp, Trophy, Sparkles, BookOpen, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

// Redesign 2026-08-11: the portal's three sections plus Library and Me.
// Labels and icons match the sidebar and the in-page big tabs exactly.
const items: { tab: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { tab: "home", label: "Home", icon: Home },
  { tab: "progress", label: "Progress", icon: TrendingUp },
  { tab: "board", label: "Board", icon: Trophy },
  { tab: "start", label: "Start", icon: Sparkles },
];

const GRID = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" } as Record<number, string>;

export function StudentBottomNav({ activeTab, onTabChange }: { activeTab?: string; onTabChange?: (t: string) => void }) {
  const path = useRouterState({ select: s => s.location.pathname });
  const { user } = useAuth();
  // Mirror the portal: locked → Start is everything; unlocked with the
  // checklist finished → Start disappears and Home leads.
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
  const showLibrary = !locked && !graduated;
  const onPortal = path === "/student-portal";
  const cellCount = visible.length + (showLibrary ? 1 : 0) + 1;
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className={`grid pb-[max(0.25rem,env(safe-area-inset-bottom))] ${GRID[cellCount] ?? "grid-cols-5"}`}>
        {visible.map(it => {
          const Icon = it.icon;
          const active = onPortal && activeTab === it.tab;
          return (
            <Link
              key={it.tab}
              to="/student-portal"
              onClick={() => onTabChange?.(it.tab)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
        {showLibrary && (
          <Link
            to="/knowledge"
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] ${path.startsWith("/knowledge") ? "text-primary" : "text-muted-foreground"}`}
          >
            <BookOpen className="h-4 w-4" />
            Library
          </Link>
        )}
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
