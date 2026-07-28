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

export type RoleAccess = { role: string; hidden_pages: string[]; hide_money: boolean };

/** Pages a role can see by default (before overrides). */
export function defaultPagesFor(role: ConfigurableRole): NavPage[] {
  return CONFIGURABLE_PAGES.filter((p) => !p.roles || p.roles.includes(role));
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
  return holding.every((r) => access.find((a) => a.role === r)?.hidden_pages.includes(page.url));
}

/** Money figures blur only if every money-role the user holds hides them. */
export function moneyHidden(roles: string[], access: RoleAccess[]): boolean {
  if (roles.includes("admin") || roles.includes("founder")) return false;
  const holding = roles.filter((r) => (CONFIGURABLE_ROLES as readonly string[]).includes(r));
  if (!holding.length) return false;
  return holding.every((r) => access.find((a) => a.role === r)?.hide_money === true);
}
