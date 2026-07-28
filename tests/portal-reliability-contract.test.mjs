import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const dashboard = readFileSync(new URL("src/routes/_authenticated.dashboard.tsx", root), "utf8");
const performanceUrl = new URL("src/routes/_authenticated.performance.tsx", root);
const eods = readFileSync(new URL("src/routes/_authenticated.eods.tsx", root), "utf8");
const sales = readFileSync(new URL("src/routes/_authenticated.sales.tsx", root), "utf8");
const authenticatedLayout = readFileSync(new URL("src/routes/_authenticated.tsx", root), "utf8");
const adminConsole = readFileSync(new URL("src/routes/_authenticated.admin.tsx", root), "utf8");
const volumeTrend = readFileSync(new URL("src/components/volume-trend-panel.tsx", root), "utf8");
const dailyDigest = readFileSync(new URL("supabase/functions/daily-digest/index.ts", root), "utf8");
const analyticsAlias = readFileSync(new URL("src/routes/_authenticated.analytics.tsx", root), "utf8");
const navigation = readFileSync(new URL("src/lib/portal-navigation.ts", root), "utf8");
const directoryUrl = new URL("src/routes/_authenticated.directory.tsx", root);
const directory = readFileSync(directoryUrl, "utf8");
const teamMemberRoute = readFileSync(new URL("src/routes/_authenticated.team_.$id.tsx", root), "utf8");
const teamAdminRoute = readFileSync(new URL("src/routes/_authenticated.team.tsx", root), "utf8");
const demoSeed = readFileSync(new URL("scripts/seed-demo.mjs", root), "utf8");
const studentPortal = readFileSync(
  new URL("src/routes/_authenticated.student-portal.tsx", root),
  "utf8",
);
const csm = readFileSync(new URL("src/routes/_authenticated.csm.tsx", root), "utf8");
const csmOverview = readFileSync(new URL("src/components/csm-overview.tsx", root), "utf8");
const csmTodayQueue = readFileSync(new URL("src/components/csm-today-queue.tsx", root), "utf8");
const studentHealth = readFileSync(new URL("src/lib/use-student-health.ts", root), "utf8");
const studentPlacements = readFileSync(new URL("src/components/student-placements.tsx", root), "utf8");
const commandPalette = readFileSync(new URL("src/components/command-palette.tsx", root), "utf8");
const notificationsBell = readFileSync(new URL("src/components/notifications-bell.tsx", root), "utf8");
const settingProcess = readFileSync(
  new URL("src/routes/_authenticated.sops.isa-setting-process.tsx", root),
  "utf8",
);
const studentSuccess = readFileSync(
  new URL("src/routes/_authenticated.student-success.tsx", root),
  "utf8",
);
const weeklyMigration = readFileSync(
  new URL("supabase/migrations/20260718100000_student_weekly_eods.sql", root),
  "utf8",
);
const realActivityMigrationUrl = new URL(
  "supabase/migrations/20260728101500_eods_activity_real_view.sql",
  root,
);
const profileDemoMigrationUrl = new URL(
  "supabase/migrations/20260728113000_profiles_demo_flag.sql",
  root,
);
const immutableStaffEodMigrationUrl = new URL(
  "supabase/migrations/20260728140725_staff_eods_insert_only.sql",
  root,
);
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

test("Home is action-first and does not duplicate the canonical analytics workspace", () => {
  assert.match(dashboard, /Next actions/);
  assert.match(dashboard, /Team pulse/);
  assert.match(dashboard, /Your day/);
  assert.match(dashboard, /from\("eods_activity_real"\)/);
  assert.doesNotMatch(dashboard, /recharts|RangePicker|buildDashboardTrend/);
  assert.doesNotMatch(dashboard, /getMochiDashboard|getCloseActivityReport|getWhopCashWindow/);
  assert.doesNotMatch(dashboard, /from\("deals"\)|from\("revenue"\)/);
  assert.doesNotMatch(dashboard, /\.insert\(|\.update\(|\.delete\(/);
});

test("Home preserves unavailable operational values and ranks urgent exceptions first", () => {
  assert.match(dashboard, /rows\.some\(\(row\) => row\[key\] == null\)/);
  assert.match(dashboard, /result\.count == null/);
  assert.match(dashboard, /todayBooked == null \|\| recentAverage == null/);
  assert.match(dashboard, /select\("user_id, role"\)\.in\("role", \["founder", "cofounder", "setter", "closer", "coach", "csm"\]\)/);
  assert.match(dashboard, /const reportingUsers = new Set/);
  assert.doesNotMatch(dashboard, /const recentFilers = new Set/);
  assert.match(dashboard, /items\.sort\(\(a, b\) => Number\(b\.urgent\) - Number\(a\.urgent\)\)/);
});

test("Performance is the single EOD activity analytics workspace", () => {
  assert.ok(existsSync(performanceUrl));
  const performance = readFileSync(performanceUrl, "utf8");
  assert.match(performance, /Team accountability/);
  assert.match(performance, /Activity trend/);
  assert.match(performance, /showDots/);
  assert.match(performance, /from\("eods_activity_real"\)/);
  assert.match(performance, /<SheetContent side="bottom"/);
  assert.match(performance, /hidden overflow-x-auto xl:block/);
  assert.match(performance, /divide-y divide-border xl:hidden/);
  assert.match(performance, /rows\.some\(\(row\) => row\[key\] == null\)/);
  assert.match(performance, /No verified show\/no-show denominator/);
  assert.match(performance, /function formatMetric/);
  assert.doesNotMatch(performance, /from\("deals"\)|getMochiDashboard|getWhopCashWindow/);
  assert.doesNotMatch(performance, /\.insert\(|\.update\(|\.delete\(/);
});

test("EOD remains a focused submission workflow", () => {
  assert.match(eods, /const defaultTab = "submit"/);
  assert.match(eods, /Performance now lives in its own workspace/);
  assert.match(eods, /My EOD/);
  assert.match(eods, /My history/);
  assert.doesNotMatch(eods, /canViewTeam|fetchTeam|TeamOverview|ComplianceMatrix|ComplianceGraphs|TeamFeed/);
  const miniChip = eods.slice(eods.indexOf("function MiniChip"), eods.indexOf("function KpiBar"));
  assert.doesNotMatch(miniChip, /green/i);
});

test("Sales remains a daily work queue and legacy analytics opens Performance", () => {
  assert.match(sales, /Today's submission status/);
  assert.doesNotMatch(sales, /#22c55e|green|emerald/i);
  assert.doesNotMatch(sales, /function TrendsTab|VolumeAreaChart|Scorecards · last 30 days/);
  assert.match(analyticsAlias, /to: "\/performance"/);
  assert.doesNotMatch(analyticsAlias, /tab: "trends"/);
});

test("directory, performance, and account administration have independent access models", () => {
  assert.ok(existsSync(directoryUrl));
  assert.match(navigation, /TEAM_DIRECTORY_ROLES/);
  assert.match(navigation, /SELF_PERFORMANCE_ROLES/);
  assert.match(navigation, /ACCOUNT_ADMIN_ROLES/);
  assert.doesNotMatch(navigation, /TEAM_DIRECTORY_ROLES\s*=\s*STAFF_ROLES/);
  assert.doesNotMatch(navigation, /SELF_PERFORMANCE_ROLES\s*=\s*STAFF_ROLES/);
  assert.match(navigation, /key: "team-directory"/);
  assert.match(directory, /from\("profiles"\)/);
  assert.match(directory, /from\("user_roles"\)/);
  assert.doesNotMatch(directory, /phone|\.insert\(|\.update\(|\.delete\(/);
});

test("legacy member analytics resolves to canonical Performance without demo-capable queries", () => {
  assert.match(teamMemberRoute, /to: "\/performance"/);
  assert.match(teamMemberRoute, /search: \{ member: params\.id \}/);
  assert.doesNotMatch(teamMemberRoute, /eods_activity|recharts|getMochiDashboard|getCloseCallStats/);
  assert.match(teamAdminRoute, /to="\/performance"/);
  assert.doesNotMatch(teamAdminRoute, /to="\/team\/\$id"/);
});

test("operational Home, Performance, and directory exclude demo profiles as well as demo activity", () => {
  assert.ok(existsSync(profileDemoMigrationUrl));
  const migration = readFileSync(profileDemoMigrationUrl, "utf8");
  const performance = readFileSync(performanceUrl, "utf8");
  assert.match(migration, /add column if not exists is_demo boolean not null default false/);
  assert.match(migration, /from auth\.users/);
  assert.match(migration, /@isa\.demo/);
  assert.match(dashboard, /from\("profiles"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(performance, /from\("profiles"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(performance, /filter\(\(id\) => profileMap\.has\(id\)\)/);
  assert.match(directory, /from\("profiles"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(sales, /from\("profiles"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.equal((sales.match(/from\("eods_activity_real"\)/g) ?? []).length, 2);
  assert.doesNotMatch(sales, /from\("eods"\)/);
  assert.match(teamAdminRoute, /from\("profiles"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.match(adminConsole, /from\("eods_activity_real"\)/);
  assert.equal((adminConsole.match(/from\("eods"\)/g) ?? []).length, 1);
  assert.match(adminConsole, /from\("eods"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("is_demo", true\)/);
  assert.match(adminConsole, /from\("profiles"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.match(adminConsole, /from\("students"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.match(adminConsole, /students!inner\(is_demo\)/);
  assert.match(adminConsole, /\.eq\("students\.is_demo", false\)/);
  assert.equal((volumeTrend.match(/from\("eods_activity_real"\)/g) ?? []).length, 2);
  assert.doesNotMatch(volumeTrend, /from\("eods"\)/);
  assert.match(volumeTrend, /from\("profiles"\)[^\n]*\.eq\("is_demo", false\)/);
});

test("founders with reporting roles remain in Home and Performance accountability", () => {
  const performance = readFileSync(performanceUrl, "utf8");
  assert.doesNotMatch(dashboard, /activeUsers\.has\(id\) && !exemptUsers\.has\(id\)/);
  assert.match(dashboard, /\[\.\.\.reportingUsers\]\.filter\(\(id\) => activeUsers\.has\(id\)\)/);
  assert.match(performance, /const reportingIdSet = new Set\(reportingIds\)/);
  assert.match(performance, /reportingIdSet\.has\(id\) \|\| !exempt\.has\(id\)/);
});

test("Home and Student Success exclude demo students and their dependent records", () => {
  assert.match(dashboard, /from\("student_action_items"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.equal((dashboard.match(/from\("students"\)[\s\S]*?\.eq\("is_demo", false\)/g) ?? []).length, 2);
  assert.equal((dashboard.match(/students!inner\(is_demo\)/g) ?? []).length, 5);
  assert.equal((dashboard.match(/\.eq\("students\.is_demo", false\)/g) ?? []).length, 3);
  assert.equal((dashboard.match(/from\("installment_payments"\)\.select\("id, installments!inner\(students!inner\(is_demo\)\)"/g) ?? []).length, 2);
  assert.equal((dashboard.match(/\.eq\("installments\.students\.is_demo", false\)/g) ?? []).length, 2);

  assert.match(studentSuccess, /from\("students"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(studentSuccess, /from\("student_action_items"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.match(studentSuccess, /from\("profiles"\)[\s\S]*?\.eq\("is_demo", false\)/);
  assert.equal((studentSuccess.match(/students!inner\(is_demo\)/g) ?? []).length, 6);
  assert.equal((studentSuccess.match(/\.eq\("students\.is_demo", false\)/g) ?? []).length, 5);
  assert.match(studentSuccess, /from\("installment_payments"\)\.select\("id, installment_id, status, due_date, installments!inner\(students!inner\(is_demo\)\)"\)\.eq\("installments\.students\.is_demo", false\)/);

  assert.match(csm, /from\("students"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.match(csm, /from\("student_action_items"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.match(csm, /from\("profiles"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.equal((csm.match(/students!inner\(is_demo\)/g) ?? []).length, 6);
  assert.equal((csm.match(/\.eq\("students\.is_demo", false\)/g) ?? []).length, 6);
});

test("CSM summaries and shared staff shell never surface demo students or their dependent records", () => {
  for (const source of [csmOverview, csmTodayQueue, studentHealth, studentPlacements]) {
    assert.match(source, /from\("students"\)[^\n]*\.eq\("is_demo", false\)/);
  }
  assert.equal((csmTodayQueue.match(/students!inner\(is_demo\)/g) ?? []).length, 3);
  assert.equal((csmTodayQueue.match(/\.eq\("students\.is_demo", false\)/g) ?? []).length, 3);
  assert.equal((csmOverview.match(/students!inner\(is_demo\)/g) ?? []).length, 4);
  assert.equal((csmOverview.match(/\.eq\("students\.is_demo", false\)/g) ?? []).length, 4);
  assert.equal((studentHealth.match(/students!inner\(is_demo\)/g) ?? []).length, 4);
  assert.equal((studentHealth.match(/\.eq\("students\.is_demo", false\)/g) ?? []).length, 4);
  assert.match(studentPlacements, /from\("student_placements"\)[^\n]*students!inner\(is_demo\)[^\n]*\.eq\("students\.is_demo", false\)/);
  assert.match(commandPalette, /from\("students"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.match(commandPalette, /from\("profiles"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.match(notificationsBell, /from\("students"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.equal((notificationsBell.match(/students!inner\(is_demo\)/g) ?? []).length, 4);
  assert.equal((notificationsBell.match(/\.eq\("students\.is_demo", false\)/g) ?? []).length, 4);
  assert.match(notificationsBell, /from\("installment_payments"\)[\s\S]*?installments!inner\(coach_id, student_id, students!inner\(id, full_name, is_demo\)\)[\s\S]*?\.eq\("installments\.students\.is_demo", false\)/);
});

test("every operational installment-payment reader requires a real owning student", () => {
  const readers = [
    ["src/lib/collected-cash.ts", 1],
    ["src/lib/mochi.functions.ts", 1],
    ["src/routes/_authenticated.dashboard.tsx", 2],
    ["src/routes/_authenticated.student-success.tsx", 1],
    ["src/components/payout-alert.tsx", 1],
    ["src/routes/_authenticated.payouts.tsx", 1],
    ["src/routes/_authenticated.finance.tsx", 3],
    ["src/components/cash-in-calendar.tsx", 1],
    ["src/routes/_authenticated.students.$id.tsx", 1],
    ["src/routes/_authenticated.installments.tsx", 1],
    ["src/components/notifications-bell.tsx", 1],
  ];

  for (const [path, expectedReads] of readers) {
    const source = readFileSync(new URL(path, root), "utf8");
    const paymentReads = source.match(/from\("installment_payments"(?:\s+as\s+(?:any|never))?\)\s*\.select\(/g) ?? [];
    const realOwnerFilters = source.match(/\.eq\("installments\.students\.is_demo", false\)/g) ?? [];
    assert.equal(paymentReads.length, expectedReads, `${path} payment read inventory changed`);
    assert.equal(realOwnerFilters.length, expectedReads, `${path} must filter every payment read by its owning student`);
  }

  const dealReaders = [
    "src/lib/collected-cash.ts",
    "src/lib/mochi.functions.ts",
    "src/components/setter-leaderboard.tsx",
    "src/components/cash-in-calendar.tsx",
    "src/routes/_authenticated.students.$id.tsx",
    "src/components/payout-alert.tsx",
    "src/routes/_authenticated.payouts.tsx",
    "src/routes/_authenticated.revenue.tsx",
    "src/routes/_authenticated.finance.tsx",
  ];

  for (const path of dealReaders) {
    const source = readFileSync(new URL(path, root), "utf8");
    assert.match(
      source,
      /from\("deals"\)\s*\.select\([\s\S]{0,300}?\.eq\("is_demo", false\)/,
      `${path} must exclude demo deals from operational reads`,
    );
  }
});

test("shared student workspaces and staff utilities exclude demo-owned records at query time", () => {
  const queries = readFileSync(new URL("src/lib/queries.ts", root), "utf8");
  const calls = readFileSync(new URL("src/routes/_authenticated.calls.tsx", root), "utf8");
  const actionItems = readFileSync(new URL("src/routes/_authenticated.action-items.tsx", root), "utf8");
  const chat = readFileSync(new URL("src/routes/_authenticated.chat.tsx", root), "utf8");
  const testimonials = readFileSync(new URL("src/routes/_authenticated.testimonials.tsx", root), "utf8");
  const revenue = readFileSync(new URL("src/routes/_authenticated.revenue.tsx", root), "utf8");
  const teamAdmin = readFileSync(new URL("src/lib/team-admin.functions.ts", root), "utf8");
  const studentsRoute = readFileSync(new URL("src/routes/_authenticated.students.tsx", root), "utf8");
  const studentLeaderboard = readFileSync(new URL("src/lib/student-portal.functions.ts", root), "utf8");
  const setterActivity = readFileSync(new URL("src/components/setter-activity-card.tsx", root), "utf8");
  const cashLeaderboard = readFileSync(new URL("src/components/weekly-leaderboard.tsx", root), "utf8");
  const setterLeaderboard = readFileSync(new URL("src/components/setter-leaderboard.tsx", root), "utf8");
  const paymentSetup = readFileSync(new URL("src/components/student-payment-setup.tsx", root), "utf8");
  const calendarRoute = readFileSync(new URL("src/routes/_authenticated.calendar.tsx", root), "utf8");
  const calendarFunctions = readFileSync(new URL("src/lib/calendar.functions.ts", root), "utf8");
  const studentDetail = readFileSync(new URL("src/routes/_authenticated.students.$id.tsx", root), "utf8");
  const leadNotes = readFileSync(new URL("src/lib/crm-lead-notes.functions.ts", root), "utf8");
  const knowledgeDetail = readFileSync(new URL("src/routes/_authenticated.knowledge.$slug.tsx", root), "utf8");

  assert.match(queries, /from\("students"\)\.select\("\*"\)\.eq\("is_demo", false\)/);
  assert.match(queries, /from\("student_calls"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);
  assert.match(queries, /from\("student_eods"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);
  assert.match(queries, /from\("profiles"\)\.select\("id, display_name"\)\.eq\("is_demo", false\)/);

  assert.match(calls, /from\("student_calls"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);
  assert.match(calls, /from\("students"\)\.select\("id, full_name, calls_allotted"\)\.eq\("is_demo", false\)/);
  assert.match(calls, /from\("profiles"\)[\s\S]{0,140}?\.eq\("is_demo", false\)[\s\S]{0,100}?\.in\("id", coachIds\)/);

  assert.match(actionItems, /from\("student_calls"\)[\s\S]{0,220}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);
  assert.match(actionItems, /from\("student_action_items"\)\.select\("\*"\)\.eq\("is_demo", false\)/);
  assert.match(actionItems, /from\("students"\)\.select\("id, full_name"\)\.eq\("is_demo", false\)/);
  assert.match(actionItems, /from\("profiles"\)\.select\("id, display_name"\)\.eq\("is_demo", false\)/);

  assert.match(chat, /from\("students"\)\.select\("id, full_name"\)\.eq\("is_demo", false\)/);
  assert.match(chat, /from\("profiles"\)\.select\("id, display_name"\)\.eq\("is_demo", false\)/);
  assert.match(chat, /from\("team_chat"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);
  assert.match(chat, /from\("team_chat"\)\.select\("\*"\)\.is\("student_id", null\)/);

  assert.match(testimonials, /from\("testimonials"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);
  assert.match(testimonials, /from\("students"\)\.select\("id, full_name"\)\.eq\("is_demo", false\)/);
  assert.match(commandPalette, /from\("testimonials"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);

  assert.match(revenue, /from\("students"\)\.select\("id, full_name"\)\.eq\("is_demo", false\)/);
  assert.match(revenue, /from\("profiles"\)\.select\("id, display_name, commission_cap_pct"\)\.eq\("is_demo", false\)/);
  assert.match(teamAdmin, /from\("profiles"\)\.select\("id, display_name, active"\)\.eq\("is_demo", false\)\.in\("id", ids\)/);

  assert.match(studentsRoute, /from\("student_guide_steps"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);
  assert.match(studentsRoute, /key: "training", label: "Training"/);
  assert.equal((studentsRoute.match(/from\("profiles"\)\.select/g) ?? []).length, 2);
  assert.equal((studentsRoute.match(/\.eq\("is_demo", false\)\.in\("id",/g) ?? []).length, 2);
  assert.match(studentLeaderboard, /from\("students"\)[\s\S]{0,180}?\.eq\("is_demo", false\)/);
  assert.match(studentLeaderboard, /from\("student_eods"\)[\s\S]{0,200}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);

  for (const source of [setterActivity, cashLeaderboard, setterLeaderboard, paymentSetup, calendarRoute]) {
    assert.match(source, /from\("profiles"\)[\s\S]{0,180}?\.eq\("is_demo", false\)/);
  }

  assert.equal((calendarFunctions.match(/from\("profiles"\)/g) ?? []).length, 3);
  assert.equal((calendarFunctions.match(/\.eq\("is_demo", false\)/g) ?? []).length, 3);
  assert.match(calendarFunctions, /const realConnections = conns\.filter/);
  assert.match(calendarFunctions, /!r\.owner_id \|\| pmap\.has\(r\.owner_id\)/);

  assert.match(studentPlacements, /from\("student_placements"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);
  assert.match(studentDetail, /from\("student_placements"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,120}?\.eq\("students\.is_demo", false\)/);

  assert.match(csm, /from\("csm_tally"\)\.select\("\*"\)\.eq\("user_id", user\.id\)\.is\("student_id", null\)/);
  assert.match(csm, /from\("csm_tally"\)[\s\S]{0,180}?students!inner\(is_demo\)[\s\S]{0,160}?\.eq\("students\.is_demo", false\)/);
  assert.match(leadNotes, /from\("profiles"\)[\s\S]{0,140}?\.eq\("is_demo", false\)/);
  assert.match(leadNotes, /const realRows = \(rows \?\? \[\]\)\.filter/);
  assert.match(knowledgeDetail, /from\("profiles"\)[\s\S]{0,100}?\.eq\("is_demo", false\)[\s\S]{0,80}?\.eq\("id", data\.updated_by\)/);
});

test("base EOD reads are own-row real history; shared activity uses the real-only view", () => {
  assert.match(eods, /from\("eods"\)\.select\("\*"\)\.eq\("is_demo", false\)\.eq\("user_id", user\.id\)/);
  assert.match(authenticatedLayout, /from\("eods"\)[\s\S]*?\.eq\("is_demo", false\)[\s\S]*?\.eq\("user_id", userId\)/);
  assert.match(settingProcess, /from\("eods"\)[\s\S]*?\.eq\("is_demo", false\)[\s\S]*?\.eq\("user_id", userId\)/);
  assert.match(dailyDigest, /from\("eods"\)[\s\S]*?\.eq\("is_demo", false\)[\s\S]*?\.eq\("report_date", yesterday\)/);
});

test("submitted staff EOD history is insert-only and cannot be silently replaced or deleted", () => {
  assert.ok(existsSync(immutableStaffEodMigrationUrl));
  assert.match(eods, /from\("eods"\)\.insert\(payload\)/);
  assert.doesNotMatch(eods, /from\("eods"\)\.upsert|deleteEod|from\("eods"\)\.delete\(\)/);
  assert.match(eods, /Submitted reports are locked/);
  assert.match(csm, /from\("eods"\)\.insert\(payload\)/);
  assert.doesNotMatch(csm, /from\("eods"\)\.upsert/);
  assert.match(settingProcess, /from\("eods"\)\.insert\(payload as never\)/);
  assert.doesNotMatch(settingProcess, /from\("eods"\)\.upsert/);

  const migration = readFileSync(immutableStaffEodMigrationUrl, "utf8");
  assert.match(migration, /drop policy if exists "Users manage own eods" on public\.eods/i);
  assert.match(migration, /drop policy if exists "Users delete own eods" on public\.eods/i);
  assert.doesNotMatch(migration, /drop policy if exists "Admins and closers view all eods"/i);
  assert.match(migration, /revoke all on table public\.eods from authenticated/i);
  assert.match(migration, /grant select, insert on table public\.eods to authenticated/i);
  assert.match(migration, /pg_get_serial_sequence\('public\.eods', 'id'\) is not null/i);
  assert.match(migration, /for select to authenticated/i);
  assert.match(migration, /for insert to authenticated/i);
  assert.doesNotMatch(migration, /for update|for delete/i);
  assert.match(migration, /reject_staff_eod_history_mutation/i);
  assert.match(migration, /before update or delete on public\.eods/i);
  assert.match(migration, /when \(old\.is_demo is not true\)/i);
  assert.match(demoSeed, /from\("eods"\)\.delete\(\)\.eq\("is_demo", true\)/);
  assert.match(demoSeed, /is_demo: true/);
  assert.match(demoSeed, /from\("eods"\)\.upsert\(eodRows/);
});

test("student portal reads and writes weekly accountability EODs", () => {
  assert.match(studentPortal, /student_weekly_eods/);
  assert.match(studentPortal, /group_calls_attended/);
  assert.match(studentPortal, /Weekly accountability/);
  const weeklySubmit = studentPortal.slice(
    studentPortal.indexOf("const submitWeeklyEod"),
    studentPortal.indexOf("const toggleGuideStep"),
  );
  assert.doesNotMatch(weeklySubmit, /submitted_at/);
  assert.match(csm, /Weekly calls/);
  assert.match(csm, /weeklyEodLoadError/);
});

test("operational analytics exclude demos and include every founder role", () => {
  assert.ok(existsSync(realActivityMigrationUrl));
  const activityMigration = readFileSync(realActivityMigrationUrl, "utf8");
  assert.match(activityMigration, /create or replace view public\.eods_activity_real/);
  assert.match(activityMigration, /is_demo is not true/);
  assert.match(activityMigration, /has_role\(auth\.uid\(\), 'cofounder'\)/);
});

test("weekly accountability has database-enforced attendance, week, and history rules", () => {
  assert.match(weeklyMigration, /group_calls_attended between 0 and 7/);
  assert.match(weeklyMigration, /extract\(isodow from week_start\) = 1/);
  assert.match(weeklyMigration, /unique \(student_id, week_start\)/);
  assert.doesNotMatch(weeklyMigration, /references public\.students\(id\) on delete cascade/i);
  assert.match(weeklyMigration, /protect_student_weekly_eod_history/);
  assert.match(weeklyMigration, /new\.submitted_at := old\.submitted_at/i);
  assert.match(weeklyMigration, /new\.created_at := old\.created_at/i);
  assert.doesNotMatch(weeklyMigration, /for delete/i);
  assert.doesNotMatch(studentPortal, /from\("student_eods"\)\.delete\(\)/);
  assert.match(weeklyMigration, /revoke delete on table public\.student_eods from authenticated/i);
  assert.match(weeklyMigration, /protect_student_eod_history_identity/);
});

test("repository verification runs regressions, lint, typecheck, and production build in CI", () => {
  assert.equal(packageJson.scripts.test, "node --test tests/*.test.mjs");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.equal(
    packageJson.scripts.verify,
    "npm run test && npm run lint && npm run typecheck && npm run build",
  );
  assert.ok(existsSync(new URL(".github/workflows/verify.yml", root)));
});
