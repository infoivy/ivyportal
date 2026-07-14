import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

// One Students section: the whole fulfillment side lives behind a single
// sidebar entry, tabbed here — same pattern as the Sales section. Each tab
// only shows for roles its route admits.
const TABS = [
  { label: "Students", url: "/students", roles: ["admin", "closer", "csm", "coach", "founder", "cofounder"] },
  { label: "CSM", url: "/csm", roles: ["admin", "csm", "coach", "founder", "cofounder"] },
  { label: "1-on-1 Calls", url: "/calls", roles: ["admin", "coach", "csm"] },
  { label: "Testimonials", url: "/testimonials", roles: ["admin", "coach", "closer", "setter", "csm"] },
  // Closers onboard the students they close; CSMs the ones they support
  { label: "Requests", url: "/students/requests", roles: ["admin", "closer", "csm", "founder", "cofounder"] },
] as const;

export function firstStudentsTab(roles: string[]) {
  return TABS.find(t => t.roles.some(r => roles.includes(r)))?.url ?? "/students";
}

export function StudentsTabBar() {
  const path = useRouterState({ select: s => s.location.pathname });
  const { roles } = useAuth();
  const visible = TABS.filter(t => t.roles.some(r => roles.includes(r)));
  const canSeeRequests = ["admin", "closer", "csm"].some(r => roles.includes(r));
  const pendingQ = useQuery({
    queryKey: ["students", "access-requests-count"],
    enabled: canSeeRequests,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    queryFn: async () => {
      const [{ data: profs }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("id, active"),
        supabase.from("user_roles").select("user_id"),
      ]);
      const placed = new Set((roleRows ?? []).map(r => r.user_id));
      return ((profs ?? []) as { id: string; active: boolean | null }[])
        .filter(p => p.active !== false && !placed.has(p.id)).length;
    },
  });
  const pending = pendingQ.data ?? 0;
  if (visible.length <= 1) return null;
  return (
    <div className="flex gap-0 border-b border-[var(--border)] mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto no-scrollbar">
      {visible.map(t => {
        const active = t.url === "/students"
          ? path.startsWith("/students") && !path.startsWith("/students/requests")
          : path.startsWith(t.url);
        return (
          <Link
            key={t.url}
            to={t.url}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-caption font-medium border-b-2 motion-safe:transition-colors whitespace-nowrap ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.url === "/students/requests" && pending > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-4 text-center">
                {pending}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
