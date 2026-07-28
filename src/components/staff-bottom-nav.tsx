import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useAccess } from "@/lib/use-access";
import { PRIMARY_NAV_ITEMS, isVisibleToRoles, matchesNavItem } from "@/lib/portal-navigation";

const MOBILE_PRIMARY_KEYS = ["home", "work", "performance", "customers"] as const;

export function StaffBottomNav() {
  const { roles } = useAuth();
  const { pageHidden } = useAccess();
  const { setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = PRIMARY_NAV_ITEMS.filter(
    (item) =>
      (MOBILE_PRIMARY_KEYS as readonly string[]).includes(item.key) &&
      isVisibleToRoles(item, roles) &&
      !pageHidden(item.url),
  );
  const moreActive = !items.some((item) => matchesNavItem(item, pathname));

  return (
    <nav
      aria-label="Staff primary navigation"
      className="frosted fixed inset-x-0 bottom-0 z-40 border-t border-border md:hidden"
    >
      <div
        className="grid px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
        style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = matchesNavItem(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.url as never}
              preload="intent"
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium motion-safe:transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="truncate">{item.title}</span>
              {active && (
                <span
                  className="absolute bottom-1 h-0.5 w-4 rounded-full bg-foreground"
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium motion-safe:transition-colors ${
            moreActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Open more navigation"
        >
          <Menu className="h-[18px] w-[18px]" />
          <span>More</span>
          {moreActive && (
            <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-foreground" aria-hidden />
          )}
        </button>
      </div>
    </nav>
  );
}
