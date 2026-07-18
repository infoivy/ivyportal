import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const dashboard = readFileSync(new URL("src/routes/_authenticated.dashboard.tsx", root), "utf8");
const studentPortal = readFileSync(
  new URL("src/routes/_authenticated.student-portal.tsx", root),
  "utf8",
);
const csm = readFileSync(new URL("src/routes/_authenticated.csm.tsx", root), "utf8");
const weeklyMigration = readFileSync(
  new URL("supabase/migrations/20260718100000_student_weekly_eods.sql", root),
  "utf8",
);
const activityMigration = readFileSync(
  new URL("supabase/migrations/20260718101000_eods_activity_real_only.sql", root),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

test("Overview defaults to a useful reporting window and uses shared activity aggregation", () => {
  assert.match(dashboard, /rangeFor\("7d"\)/);
  assert.match(dashboard, /buildDashboardTrend/);
  assert.match(dashboard, /getMochiDashboard/);
  assert.match(dashboard, /getCloseActivityReport/);
  assert.doesNotMatch(dashboard, /getCloseCallStats|getCloseLeadStats/);
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
