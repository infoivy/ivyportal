import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { canSeeNavItem, isPageHidden, moneyHidden, type RoleAccess } from "@/lib/nav-pages";
import type { PortalNavItem } from "@/lib/portal-navigation";

/** Admin-managed access defaults (page visibility + money blur) per role. */
export function useAccess() {
  const { roles } = useAuth();
  const q = useQuery({
    queryKey: ["role-access"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("role_access").select("role, hidden_pages, granted_pages, hide_money" as never);
      return (data ?? []) as unknown as RoleAccess[];
    },
  });
  const access = q.data ?? [];
  return {
    access,
    pageHidden: (pathname: string) => isPageHidden(pathname, roles, access),
    /** Defaults + admin hides + admin grants, in one check. */
    canSee: (item: Pick<PortalNavItem, "url" | "roles" | "locked">) => canSeeNavItem(item, roles, access),
    hideMoney: moneyHidden(roles, access),
  };
}

