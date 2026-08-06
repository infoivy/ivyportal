import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const securityMigrationPaths = [
  "supabase/migrations/20260729122127_secure_sensitive_data_boundaries.sql",
  "supabase/migrations/20260729131802_enforce_sensitive_data_boundaries.sql",
];
const readSecurityMigrations = () => securityMigrationPaths.map(read).join("\n");

function authenticatedSurfaceSources() {
  const routeDir = join(root, "src/routes");
  const routeFiles = readdirSync(routeDir)
    .filter((name) => name.startsWith("_authenticated") && name.endsWith(".tsx"))
    .map((name) => join(routeDir, name));
  const sharedFiles = [
    "src/components/ui/page-shell.tsx",
    "src/components/ui/skeletons.tsx",
    "src/components/doc-shell.tsx",
    "src/components/mochi-crm.tsx",
    "src/components/sop-canvas.tsx",
  ].map((path) => join(root, path));
  return [...routeFiles, ...sharedFiles].map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, "utf8"),
  }));
}

test("authenticated workspaces do not use page-level fixed max widths", () => {
  const pageConstraint = /className="(?:p-4 sm:p-6 max-w-(?:3xl|6xl|7xl|\[(?:1100|1200|1400|1500)px\]) mx-auto|max-w-(?:3xl|6xl|7xl|\[(?:1100|1200|1400|1500)px\]) mx-auto (?:p-|space-y)|mx-auto w-full max-w-(?:6xl|7xl)|px-[^"]+ max-w-\[(?:1100|1200|1400|1500)px\] mx-auto)[^"]*"/g;
  const offenders = authenticatedSurfaceSources().flatMap(({ path, source }) =>
    [...source.matchAll(pageConstraint)].map((match) => `${path}: ${match[0]}`),
  );
  assert.deepEqual(offenders, [], `Fixed-width authenticated surfaces:\n${offenders.join("\n")}`);

  const pageShell = read("src/components/ui/page-shell.tsx");
  assert.match(pageShell, /w-full max-w-none/);
  assert.doesNotMatch(pageShell, /max-w-\[(?:1400|1500)px\]/);
});

test("calendar OAuth credentials never cross the authenticated PostgREST boundary", () => {
  for (const migrationPath of securityMigrationPaths) {
    assert.equal(existsSync(join(root, migrationPath)), true, `${migrationPath} must exist`);
  }
  const migration = readSecurityMigrations();
  assert.match(migration, /revoke select, insert, update on public\.calendar_connections from authenticated/i);
  assert.match(migration, /grant select \([^)]+\) on public\.calendar_connections to authenticated/i);
  assert.doesNotMatch(migration.match(/grant select \([^)]+\) on public\.calendar_connections to authenticated/i)?.[0] ?? "", /access_token|refresh_token|scope/i);

  const calendarFns = read("src/lib/calendar.functions.ts");
  const start = calendarFns.indexOf("export const createSetReminder");
  const end = calendarFns.indexOf("export const", start + 20);
  const createSetBlock = calendarFns.slice(start, end > start ? end : undefined);
  assert.match(createSetBlock, /supabaseAdmin/);
  assert.doesNotMatch(createSetBlock, /context\.supabase[\s\S]*?from\("calendar_connections"\)[\s\S]*?select\("\*"\)/);
});

test("money writes are closer/admin-only and historical rows cannot be hard deleted", () => {
  const migration = readSecurityMigrations();
  assert.match(migration, /drop policy if exists "Staff can view payments" on public\.installment_payments/i);
  assert.match(migration, /drop policy if exists "Staff can view installments" on public\.installments/i);
  assert.match(migration, /has_role\(auth\.uid\(\), 'closer'/);
  assert.match(migration, /create policy "Money stakeholders view deals"/i);
  assert.match(migration, /revoke delete on public\.(?:deals|installments|installment_payments) from authenticated/i);
  assert.match(migration, /voided_at timestamptz/i);
  assert.match(migration, /function public\.void_installment_plan/i);
  assert.match(migration, /function public\.protect_paid_installment_history/i);
  assert.match(migration, /before insert or update or delete on public\.installment_payments/i);

  const sourceFiles = [
    "src/routes/_authenticated.revenue.tsx",
    "src/routes/_authenticated.finance.tsx",
    "src/components/cash-in-calendar.tsx",
    "src/components/revenue/payment-plans-section.tsx",
  ];
  for (const path of sourceFiles) {
    const source = read(path);
    assert.doesNotMatch(source, /from\("deals"[^\n]*\)\.delete\(\)/, `${path} hard-deletes deals`);
    assert.doesNotMatch(source, /from\("installment_payments"[^\n]*\)[^\n]*\.delete\(\)/, `${path} hard-deletes payments`);
    assert.doesNotMatch(source, /from\("installments"[^\n]*\)[^\n]*\.delete\(\)/, `${path} hard-deletes plans`);
  }
});

test("EOD correction archives source rows and removes all direct delete privileges", () => {
  const migration = readSecurityMigrations();
  for (const table of ["eods", "student_eods", "student_weekly_eods"]) {
    assert.match(migration, new RegExp(`revoke delete on public\\.${table} from authenticated`, "i"));
  }
  assert.match(migration, /create table if not exists public\.eod_correction_archive/i);
  assert.match(migration, /function public\.archive_and_unlock_eod/i);
  assert.match(migration, /source_record jsonb not null/i);

  for (const path of [
    "src/components/team-week.tsx",
    "src/routes/_authenticated.students.$id.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /archive_and_unlock_eod/, `${path} must use the audited correction RPC`);
    assert.doesNotMatch(source, /from\("(?:eods|student_eods|student_weekly_eods)"\)[^\n]*\.delete\(\)/, `${path} directly deletes EOD history`);
  }
});

test("Whop net headline never reuses logged-deal comparison data", () => {
  const revenue = read("src/routes/_authenticated.revenue.tsx");
  // The sparkline is a trend SHAPE and always renders (founder 2026-08-06:
  // it vanished when the Whop number loaded); the numeric delta comparison
  // still never mixes logged-deal math with a Whop headline.
  assert.match(revenue, /sparkData=\{cashSparkData\}/);
  assert.match(revenue, /delta=\{whopCash == null && compare \?/);
});

test("service-backed aggregates and CRM reads enforce intended eligibility", () => {
  const studentPortal = read("src/lib/student-portal.functions.ts");
  assert.match(studentPortal, /requireActiveStudentPortalAccess/);
  assert.match(studentPortal, /\.eq\("is_demo", false\)/);
  assert.match(studentPortal, /\.eq\("status", "active"\)/);

  const closeCrm = read("src/lib/close-crm.functions.ts");
  const guardCalls = closeCrm.match(/await requireClosePipelineAccess\(context\)/g) ?? [];
  assert.ok(guardCalls.length >= 4, "Close status, list, detail, and compliance must enforce pipeline access");
  assert.doesNotMatch(closeCrm, /readCloseKey\(context\)/);

  const mochi = read("src/lib/mochi.functions.ts");
  const statusStart = mochi.indexOf("export const getMochiStatus");
  const statusEnd = mochi.indexOf("export const", statusStart + 20);
  const statusBlock = mochi.slice(statusStart, statusEnd);
  assert.match(statusBlock, /requireFounderAnalyticsAccess/);
});

test("self-service profile updates cannot modify payroll or operational controls", () => {
  const migration = readSecurityMigrations();
  for (const column of [
    "active",
    "is_demo",
    "eod_exempt",
    "base_pay_day",
    "base_pay_monthly",
    "commission_cap_pct",
    "csm_daily_target",
    "setter_type",
    "started_on",
  ]) {
    assert.match(migration, new RegExp(`new\\.${column}`, "i"), `${column} must be protected`);
  }
  assert.match(migration, /before update on public\.profiles/i);
});

test("student-success history is voided with provenance and excluded from active readers", () => {
  const migration = readSecurityMigrations();
  for (const table of ["student_calls", "student_placements"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table}[\\s\\S]*?voided_at timestamptz`, "i"));
    assert.match(migration, new RegExp(`revoke delete on public\\.${table} from authenticated`, "i"));
  }
  assert.match(migration, /function public\.void_student_call\(p_call_id uuid, p_reason text\)/i);
  assert.match(migration, /function public\.void_student_placement\(p_placement_id uuid, p_reason text\)/i);
  assert.match(migration, /Voided call history is immutable/i);
  assert.match(migration, /Voided placement history is immutable/i);
  assert.equal((migration.match(/coalesce\(current_setting\('app\.student_history_void', true\), ''\) <> 'on'/g) ?? []).length, 2);
  assert.match(migration, /offer_counted_at timestamptz/i);
  assert.match(migration, /before insert or update of stage on public\.student_placements/i);
  assert.match(migration, /revoke delete on public\.students from authenticated/i);
  assert.match(migration, /drop policy if exists "Team view student calls" on public\.student_calls/i);
  assert.match(migration, /drop policy if exists "CSM\/founder\/cofounder view student calls" on public\.student_calls/i);
  assert.match(migration, /create policy "Team view active student calls"[\s\S]*?voided_at is null/i);
  assert.match(migration, /create policy "Leadership and CSM view active student calls"[\s\S]*?voided_at is null/i);
  assert.match(migration, /create policy "Student view own active calls"[\s\S]*?voided_at is null/i);
  assert.match(migration, /create policy "Admins audit voided student calls"/i);
  assert.match(migration, /drop policy if exists "placements team manage" on public\.student_placements/i);
  assert.match(migration, /drop policy if exists "placements student own" on public\.student_placements/i);
  assert.match(migration, /drop policy if exists "Closers view placements" on public\.student_placements/i);
  assert.match(migration, /create policy "placements team view active"[\s\S]*?voided_at is null[\s\S]*?has_role\(auth\.uid\(\), 'closer'\)/i);
  assert.match(migration, /create policy "placements student view own active"[\s\S]*?voided_at is null/i);
  assert.match(migration, /create policy "Admins audit voided student placements"/i);

  const studentsRoute = read("src/routes/_authenticated.students.tsx");
  assert.match(studentsRoute, /status: "inactive"/);
  assert.doesNotMatch(studentsRoute, /from\("students"\)[^;]*\.delete\(/);

  const sourceFiles = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(path);
    }
  };
  walk(join(root, "src"));

  const offenders = [];
  for (const path of sourceFiles) {
    const source = readFileSync(path, "utf8");
    for (const table of ["student_calls", "student_placements"]) {
      const needle = `.from("${table}")`;
      let cursor = 0;
      while ((cursor = source.indexOf(needle, cursor)) !== -1) {
        const end = source.indexOf(";", cursor);
        const statement = source.slice(cursor, end === -1 ? cursor + 1200 : end);
        if (statement.includes(".delete(")) offenders.push(`${relative(root, path)} hard-deletes ${table}`);
        if (statement.includes(".select(") && !statement.includes('.is("voided_at", null)')) {
          offenders.push(`${relative(root, path)} reads active ${table} without void filter`);
        }
        cursor += needle.length;
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("calendar reassignment keeps ownership unchanged until old-event cleanup succeeds", () => {
  const source = read("src/lib/calendar.functions.ts");
  const start = source.indexOf("export const assignSet");
  const block = source.slice(start);
  const cleanup = block.indexOf("deleteCalendarEvent(token, calendarId, row.gcal_event_id)");
  const ownershipCommit = block.indexOf("owner_id: data.userId", cleanup);
  assert.ok(cleanup >= 0, "assignSet must clean up the prior calendar event");
  assert.ok(ownershipCommit > cleanup, "assignSet must commit the new owner after prior-event cleanup");
});
