import {
  CUSTOMER_NAV_ITEMS,
  PRIMARY_NAV_ITEMS,
  WORK_NAV_ITEMS,
  type PortalNavItem,
} from "@/lib/portal-navigation";

// Access defaults and route visibility are derived from the same navigation
// metadata as the shell and command palette. Server-side RLS remains the
// authorization boundary; this registry controls discoverability only.
// `roles` = which business roles see the page by default (undefined = every
// signed-in team member). Admin/founder surfaces are not overridable.

export type NavPage = {
  title: string;
  url: string;
  /** roles that see it by default; undefined = all roles */
  roles?: readonly string[];
  /** pages that can never be hidden via access defaults */
  locked?: boolean;
};

const ACCESS_ITEMS: PortalNavItem[] = [
  ...PRIMARY_NAV_ITEMS.filter((item) => ["home", "performance", "knowledge"].includes(item.key)),
  ...WORK_NAV_ITEMS,
  ...CUSTOMER_NAV_ITEMS,
];

export const CONFIGURABLE_PAGES: NavPage[] = Array.from(
  new Map(
    ACCESS_ITEMS.map((item) => [
      item.url,
      { title: item.title, url: item.url, roles: item.roles, locked: item.locked },
    ]),
  ).values(),
);

export const CONFIGURABLE_ROLES = ["setter", "closer", "coach", "csm"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export type RoleAccess = { role: string; hidden_pages: string[]; granted_pages: string[]; hide_money: boolean };

/** Pages a role can see by default (before overrides). */
export function defaultPagesFor(role: ConfigurableRole): NavPage[] {
  return CONFIGURABLE_PAGES.filter((p) => !p.roles || p.roles.includes(role));
}

/**
 * Route/server-enforced role ceilings. A visibility grant cannot cross
 * these: the page itself would refuse the role. The admin grid shows such
 * combinations disabled instead of pretending a checkbox would work.
 */
export const HARD_GATES: Record<string, readonly string[]> = {
  "/payouts": ["admin", "cofounder"],
  "/finance": ["founder", "cofounder"],
  "/cards": ["founder", "cofounder"],
  "/crm": ["admin", "closer", "founder", "cofounder"],
  "/revenue": ["admin", "closer", "founder", "coach"],
  "/csm": ["admin", "csm", "coach", "founder", "cofounder"],
  "/calls": ["admin", "coach", "csm"],
  "/student-success": ["admin", "founder", "coach", "csm"],
  "/performance": ["admin", "founder", "cofounder"],
};

/** Can this role EVER see this page (server walls permitting)? */
export function grantable(role: string, url: string): boolean {
  const gate = HARD_GATES[url];
  return !gate || gate.includes(role);
}

/** One role's effective visibility for one page: default minus hides, plus
 *  grants that the server wall allows. */
export function roleSeesPage(role: ConfigurableRole, page: NavPage, access: RoleAccess[]): boolean {
  if (page.locked) return !page.roles || page.roles.includes(role);
  const row = access.find((a) => a.role === role);
  const byDefault = !page.roles || page.roles.includes(role);
  if (byDefault) return !(row?.hidden_pages ?? []).includes(page.url);
  return grantable(role, page.url) && (row?.granted_pages ?? []).includes(page.url);
}

/**
 * The one visibility check for nav surfaces: defaults, admin hides, AND
 * admin grants (founder 2026-08-04: every page toggleable for every role).
 * Extra roles only ever add access; admin and founder are never restricted.
 */
export function canSeeNavItem(
  item: Pick<PortalNavItem, "url" | "roles" | "locked">,
  roles: readonly string[],
  access: RoleAccess[],
): boolean {
  // Admins/founders bypass overrides but still respect nav defaults
  // (founder-only surfaces stay founder-only).
  if (roles.includes("admin") || roles.includes("founder")) {
    return !item.roles || item.roles.some((r) => roles.includes(r));
  }
  const page = CONFIGURABLE_PAGES.find((p) => p.url === item.url);
  for (const r of roles) {
    if ((CONFIGURABLE_ROLES as readonly string[]).includes(r)) {
      if (page) {
        if (roleSeesPage(r as ConfigurableRole, page, access)) return true;
      } else if (!item.roles || item.roles.includes(r)) {
        return true;
      }
    } else if (!item.roles || item.roles.includes(r)) {
      // Non-configurable roles (cofounder, view roles, …) keep their defaults.
      return true;
    }
  }
  return false;
}

/**
 * A page is hidden only if EVERY role the user holds hides it — extra roles
 * only ever add access. Admin and founder are never restricted.
 */
export function isPageHidden(pathname: string, roles: string[], access: RoleAccess[]): boolean {
  if (roles.includes("admin") || roles.includes("founder")) return false;
  const page = CONFIGURABLE_PAGES.find((p) => pathname === p.url || pathname.startsWith(p.url + "/"));
  if (!page || page.locked) return false;
  const holding = roles.filter((r) => (CONFIGURABLE_ROLES as readonly string[]).includes(r));
  if (!holding.length) return false;
  return holding.every((r) => !roleSeesPage(r as ConfigurableRole, page, access));
}

/** Money figures blur only if every money-role the user holds hides them. */
export function moneyHidden(roles: string[], access: RoleAccess[]): boolean {
  if (roles.includes("admin") || roles.includes("founder")) return false;
  const holding = roles.filter((r) => (CONFIGURABLE_ROLES as readonly string[]).includes(r));
  if (!holding.length) return false;
  return holding.every((r) => access.find((a) => a.role === r)?.hide_money === true);
}
