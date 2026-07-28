import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const dashboard = readFileSync(new URL("src/routes/_authenticated.dashboard.tsx", root), "utf8");
const performanceUrl = new URL("src/routes/_authenticated.performance.tsx", root);
const eods = readFileSync(new URL("src/routes/_authenticated.eods.tsx", root), "utf8");
const sales = readFileSync(new URL("src/routes/_authenticated.sales.tsx", root), "utf8");
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
  assert.equal((sales.match(/from\("eods"\)[^\n]*\.eq\("is_demo", false\)/g) ?? []).length, 2);
  assert.match(teamAdminRoute, /from\("profiles"\)[^\n]*\.eq\("is_demo", false\)/);
  assert.match(demoSeed, /is_demo: true/);
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
