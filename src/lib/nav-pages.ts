// Single source of truth for role-visible portal pages. The sidebar, the
// access-defaults admin panel, and the route guard all read from here.
// `roles` = which business roles see the page by default (undefined = every
// signed-in team member). Admin/founder surfaces are not overridable.

export type NavPage = {
  title: string;
  url: string;
  /** roles that see it by default; undefined = all roles */
  roles?: string[];
  /** pages that can never be hidden via access defaults */
  locked?: boolean;
};

export const CONFIGURABLE_PAGES: NavPage[] = [
  { title: "Dashboard", url: "/dashboard", roles: ["admin", "founder", "closer", "setter", "coach"] },
  { title: "EOD Reports", url: "/eods", locked: true }, // the EOD policy depends on it
  { title: "Action Items", url: "/action-items" },
  { title: "Sales", url: "/sales", roles: ["admin", "closer"] },
  { title: "Revenue", url: "/revenue", roles: ["admin", "closer", "coach"] },
  { title: "Closer Resources", url: "/closer-resources", roles: ["admin", "closer"] },
  { title: "Training", url: "/training", roles: ["admin", "founder", "closer", "setter", "coach"] },
  { title: "Calendar", url: "/calendar" },
  { title: "Students", url: "/students", roles: ["admin", "closer", "csm", "coach"] },
  { title: "1-on-1 Calls", url: "/calls", roles: ["admin", "coach", "csm"] },
  { title: "Student Success", url: "/student-success", roles: ["admin", "csm", "coach", "founder"] },
  { title: "CSM", url: "/csm", roles: ["admin", "csm"] },
  { title: "Student Alerts", url: "/alerts", roles: ["admin", "coach", "closer", "setter", "csm"] },
  { title: "Testimonials", url: "/testimonials", roles: ["admin", "coach", "closer", "setter", "csm"] },
  { title: "Knowledge", url: "/knowledge", locked: true },
  { title: "Notes", url: "/notes" },
];

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
