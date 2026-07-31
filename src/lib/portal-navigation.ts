import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  CircleDollarSign,
  Database,
  FileText,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Phone,
  Quote,
  ReceiptText,
  Shield,
  Users,
  WalletCards,
} from "lucide-react";

export const STAFF_ROLES = [
  "admin",
  "founder",
  "cofounder",
  "closer",
  "setter",
  "coach",
  "csm",
] as const;

// Keep these capability sets independent even when their current members overlap.
// Personal analytics and account mutation must not drift together.
// Performance is a leadership view (founder-directed 2026-07-28): reps get
// their own numbers on Home, not the whole team's accountability.
export const SELF_PERFORMANCE_ROLES = [
  "admin",
  "founder",
  "cofounder",
] as const;
export const ACCOUNT_ADMIN_ROLES = ["admin"] as const;

export type PortalNavItem = {
  key: string;
  title: string;
  description: string;
  url: string;
  icon: LucideIcon;
  roles?: readonly string[];
  match?: readonly string[];
  group?: "primary" | "work" | "customers" | "knowledge" | "admin";
  locked?: boolean;
};

export const PRIMARY_NAV_ITEMS: PortalNavItem[] = [
  {
    key: "home",
    title: "Home",
    description: "Priorities, exceptions, and the next action.",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: STAFF_ROLES,
    match: ["/dashboard"],
    group: "primary",
  },
  {
    key: "work",
    title: "Work",
    description: "Role-aware queues and daily operating workflows.",
    url: "/work",
    icon: BriefcaseBusiness,
    roles: STAFF_ROLES,
    match: [
      "/work",
      "/action-items",
      "/calendar",
      "/chat",
      "/crm",
      "/eods",
      "/revenue",
      "/payouts",
      "/finance",
    ],
    group: "primary",
  },
  {
    key: "performance",
    title: "Performance",
    description: "Canonical team activity, accountability, and outcomes.",
    url: "/performance",
    icon: BarChart3,
    roles: SELF_PERFORMANCE_ROLES,
    match: ["/performance"],
    group: "primary",
  },
  {
    key: "customers",
    title: "Customers",
    description: "Students, calls, delivery, and success operations.",
    url: "/customers",
    icon: GraduationCap,
    roles: STAFF_ROLES,
    match: ["/customers", "/students", "/csm", "/calls", "/student-success", "/testimonials"],
    group: "primary",
  },
  {
    key: "knowledge",
    title: "Knowledge",
    description: "SOPs, policies, scripts, and team documentation.",
    url: "/knowledge",
    icon: BookOpen,
    roles: STAFF_ROLES,
    match: ["/knowledge", "/policies", "/sops", "/closer-resources"],
    group: "primary",
    locked: true,
  },
];

export const WORK_NAV_ITEMS: PortalNavItem[] = [
  {
    key: "my-eod",
    title: "My EOD",
    description: "Submit today’s report or review your reporting history.",
    url: "/eods",
    icon: FileText,
    roles: ["closer", "setter", "coach", "csm"],
    group: "work",
    locked: true,
  },
  {
    key: "action-items",
    title: "Action items",
    description: "Assigned, overdue, and completed operational tasks.",
    url: "/action-items",
    icon: ListChecks,
    roles: STAFF_ROLES,
    group: "work",
  },
  {
    key: "calendar",
    title: "Calendar",
    description: "Upcoming calls, sets, confirmations, and ownership.",
    url: "/calendar",
    icon: Calendar,
    roles: STAFF_ROLES,
    group: "work",
  },
  {
    key: "crm",
    title: "CRM",
    description: "Lead queues, conversations, follow-up, and CRM hygiene.",
    url: "/crm",
    icon: Database,
    roles: ["admin", "founder", "cofounder", "closer"],
    group: "work",
  },
  {
    key: "money-in",
    title: "Money in",
    description: "Log closes, track payment plans, and collect cash.",
    url: "/revenue",
    icon: HandCoins,
    roles: ["admin", "founder", "closer", "coach"],
    group: "work",
  },
  {
    key: "payouts",
    title: "Payouts",
    description: "Review and confirm payout periods.",
    url: "/payouts",
    icon: WalletCards,
    roles: ["admin", "cofounder"],
    group: "work",
  },
  {
    key: "finance",
    title: "Finance",
    description: "Expenses, balances, and founder finance controls.",
    url: "/finance",
    icon: CircleDollarSign,
    roles: ["founder", "cofounder"],
    group: "work",
  },
  {
    key: "cards",
    title: "Cards",
    description: "WAP card balances: profit share loaded, spending, what remains.",
    url: "/cards",
    icon: WalletCards,
    roles: ["founder", "cofounder"],
    group: "work",
  },
  {
    key: "team-chat",
    title: "Team chat",
    description: "Internal coordination and operational updates.",
    url: "/chat",
    icon: MessageSquare,
    roles: STAFF_ROLES,
    group: "work",
  },
];

export const CUSTOMER_NAV_ITEMS: PortalNavItem[] = [
  {
    key: "students",
    title: "Students",
    description: "Roster, health, ownership, and student records.",
    url: "/students",
    icon: GraduationCap,
    roles: ["admin", "founder", "cofounder", "closer", "coach", "csm"],
    group: "customers",
  },
  {
    key: "student-success",
    title: "Student success",
    description: "Delivery health, outcomes, and intervention queues.",
    url: "/student-success",
    icon: HeartHandshake,
    roles: ["admin", "founder", "coach", "csm"],
    group: "customers",
  },
  {
    key: "csm",
    title: "CSM workspace",
    description: "Check-ins, notes, placement support, and coverage.",
    url: "/csm",
    icon: Users,
    roles: ["admin", "founder", "cofounder", "coach", "csm"],
    group: "customers",
  },
  {
    key: "calls",
    title: "1-on-1 calls",
    description: "Scheduled coaching calls and follow-up records.",
    url: "/calls",
    icon: Phone,
    roles: ["admin", "coach", "csm"],
    group: "customers",
  },
  {
    key: "testimonials",
    title: "Testimonials",
    description: "Collect, review, and organize student proof.",
    url: "/testimonials",
    icon: Quote,
    roles: ["admin", "coach", "closer", "setter", "csm"],
    group: "customers",
  },
];

export const ADMIN_NAV_ITEMS: PortalNavItem[] = [
  {
    key: "admin",
    title: "Admin",
    description: "Access, integrations, policies, and system controls.",
    url: "/admin",
    icon: Shield,
    roles: ACCOUNT_ADMIN_ROLES,
    match: ["/admin"],
    group: "admin",
    locked: true,
  },
  {
    key: "team",
    title: "Team administration",
    description: "Roles, profiles, onboarding, and account status.",
    url: "/team",
    icon: Users,
    roles: ACCOUNT_ADMIN_ROLES,
    match: ["/team"],
    group: "admin",
    locked: true,
  },
];

export const DIRECT_COMMAND_ITEMS: PortalNavItem[] = [
  ...WORK_NAV_ITEMS,
  ...CUSTOMER_NAV_ITEMS,
  ...ADMIN_NAV_ITEMS,
];

export function isVisibleToRoles(item: PortalNavItem, roles: readonly string[]) {
  return !item.roles || item.roles.some((role) => roles.includes(role));
}

export function visibleItems(items: readonly PortalNavItem[], roles: readonly string[]) {
  return items.filter((item) => isVisibleToRoles(item, roles));
}

export function matchesNavItem(item: PortalNavItem, pathname: string) {
  const paths = item.match ?? [item.url];
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const LABEL_ITEMS = [
  ...PRIMARY_NAV_ITEMS,
  ...DIRECT_COMMAND_ITEMS,
  {
    key: "profile",
    title: "Profile",
    description: "Account and personal settings.",
    url: "/profile",
    icon: Users,
  },
];

export function pageLabelForPath(pathname: string) {
  const exact = LABEL_ITEMS.find((item) => pathname === item.url);
  if (exact) return exact.title;
  return (
    LABEL_ITEMS.filter((item) => matchesNavItem(item, pathname)).sort(
      (a, b) => b.url.length - a.url.length,
    )[0]?.title ?? "Ivy Portal"
  );
}
