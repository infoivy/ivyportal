import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useAccess } from "@/lib/use-access";
import { PRIMARY_NAV_ITEMS, isVisibleToRoles, matchesNavItem } from "@/lib/portal-navigation";

const MOBILE_PRIMARY_KEYS = ["home", "work", "performance", "customers"] as const;

/**
 * Floating pill tab bar (founder 2026-07-31, from a reference screenshot):
 * a detached rounded capsule above the bottom edge, native-app style. Pure
 * CSS — blur, rounding, and safe-area work on Android exactly like iOS.
 */
export function StaffBottomNav() {
  const { roles } = useAuth();
  const { canSee } = useAccess();
  const { setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = PRIMARY_NAV_ITEMS.filter(
    (item) =>
      (MOBILE_PRIMARY_KEYS as readonly string[]).includes(item.key) &&
      canSee(item),
  );
  const moreActive = !items.some((item) => matchesNavItem(item, pathname));

  return (
    <nav
      aria-label="Staff primary navigation"
      className="fixed inset-x-0 z-40 md:hidden pointer-events-none"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="frosted pointer-events-auto mx-auto grid w-[min(100%-1.5rem,26rem)] rounded-full border border-border/80 px-1.5 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
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
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-medium motion-safe:transition-colors ${
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="truncate">{item.title}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-medium motion-safe:transition-colors ${
            moreActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Open more navigation"
        >
          <Menu className="h-[18px] w-[18px]" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
