import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Canonical query-key prefixes. Values MUST match the literals already used in
 * routes/components (react-query v5 invalidation is prefix-matched, so
 * ["page","dashboard"] hits the date-ranged main query, "cash-mtd", and
 * "ig-logged" alike). New pages register here first.
 *
 * Mutation rule: patch your OWN screen's cache for instant feedback
 * (setQueryData / local state), then call invalidateForTables for everyone
 * else. Never setQueryData another page's key.
 */
export const keys = {
  revenue: ["page", "revenue"],
  weeklyLeaderboard: ["page", "weekly-leaderboard"],
  dashboard: ["page", "dashboard"],
  dashboardMyItems: ["dashboard", "my-items"],
  dashboardNudges: ["dashboard", "set-nudges"],
  finance: ["page", "finance"],
  financeRevenue: ["finance-revenue"],
  sales: ["page", "sales"],
  eodsTeam: ["page", "eods", "team"],
  actionItems: ["page", "action-items"],
  admin: ["page", "admin"],
  csmPage: ["page", "csm"],
  studentPages: ["page", "student"],
  installmentsPage: ["page", "installments"],
  payoutsPage: ["page", "payouts"],
  payoutAlert: ["payout-alert"],
  teamPage: ["page", "team"],
  testimonialsPage: ["page", "testimonials"],
  csmOverview: ["csm-overview"],
  csmTodayQueue: ["csm-today-queue"],
  studentHealth: ["student-health"],
  studentsAll: ["students", "all"],
  studentEodsAgg: ["student_eods", "agg"],
  studentCallsAgg: ["student_calls", "agg"],
  studentLeaderboard: ["student-leaderboard"],
  placementBoard: ["placement-board"],
  placements: ["placements"],
  notifications: ["notifications"],
} as const satisfies Record<string, QueryKey>;

/**
 * Which cached reads go stale when a table is written. Broad on purpose:
 * invalidation marks queries stale and refetches only the MOUNTED ones
 * (refetchType "active"); unmounted pages refetch on next visit.
 */
const TABLE_KEYS = {
  deals: [
    keys.revenue, keys.weeklyLeaderboard, keys.dashboard, keys.finance,
    keys.payoutsPage, keys.payoutAlert, keys.studentPages,
  ],
  installments: [
    keys.finance, keys.payoutsPage, keys.payoutAlert, keys.installmentsPage,
    keys.dashboard, keys.weeklyLeaderboard, keys.studentPages, keys.notifications,
  ],
  installment_payments: [
    keys.finance, keys.payoutsPage, keys.payoutAlert, keys.installmentsPage,
    keys.dashboard, keys.weeklyLeaderboard, keys.studentPages, keys.notifications,
  ],
  students: [
    keys.studentsAll, keys.csmPage, keys.csmOverview, keys.csmTodayQueue,
    keys.studentHealth, keys.notifications, keys.actionItems, keys.revenue,
    keys.placementBoard, keys.studentPages, keys.installmentsPage,
    keys.dashboard,
  ],
  eods: [keys.eodsTeam, keys.sales, keys.admin, keys.dashboard, keys.dashboardNudges],
  student_eods: [
    keys.studentEodsAgg, keys.csmPage, keys.csmOverview, keys.studentHealth,
    keys.notifications, keys.studentPages, keys.dashboard, keys.studentLeaderboard,
  ],
  student_weekly_eods: [keys.csmPage, keys.studentPages],
  student_calls: [
    keys.studentCallsAgg, keys.csmPage, keys.csmOverview, keys.csmTodayQueue,
    keys.studentHealth, keys.notifications, keys.actionItems, keys.admin,
    keys.studentPages,
  ],
  student_action_items: [
    keys.actionItems, keys.csmPage, keys.studentHealth, keys.studentPages,
    keys.dashboardMyItems,
  ],
  student_placements: [
    keys.placements, keys.placementBoard, keys.csmOverview, keys.studentHealth,
    keys.notifications,
  ],
  csm_tally: [keys.csmPage, keys.csmOverview, keys.csmTodayQueue],
  csm_student_notes: [keys.csmPage, keys.csmTodayQueue, keys.studentPages],
  testimonials: [keys.testimonialsPage, keys.dashboard],
  profiles: [
    keys.revenue, keys.sales, keys.eodsTeam, keys.admin, keys.csmPage,
    keys.actionItems, keys.weeklyLeaderboard, keys.finance, keys.payoutsPage,
    keys.teamPage, keys.installmentsPage,
  ],
  commission_rates: [keys.revenue, keys.finance, keys.payoutsPage, keys.admin],
  business_expenses: [keys.finance, keys.installmentsPage],
  founder_settings: [keys.finance, keys.admin, keys.dashboard],
  payout_confirmations: [keys.payoutsPage, keys.payoutAlert, keys.dashboard, keys.notifications],
} satisfies Record<string, readonly QueryKey[]>;

export type WrittenTable = keyof typeof TABLE_KEYS;

/** Invalidate every cached read that depends on the given tables. */
export function invalidateForTables(qc: QueryClient, tables: WrittenTable[]) {
  const seen = new Set<string>();
  for (const t of tables) {
    for (const key of TABLE_KEYS[t]) {
      const sig = JSON.stringify(key);
      if (seen.has(sig)) continue;
      seen.add(sig);
      qc.invalidateQueries({ queryKey: key as QueryKey });
    }
  }
}
