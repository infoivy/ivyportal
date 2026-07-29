import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readOptional = (path) => {
  const url = new URL(path, root);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const calendar = readOptional("src/routes/_authenticated.calendar.tsx");
const calendarFunctions = readOptional("src/lib/calendar.functions.ts");
const tracker = readOptional("src/components/setter-tracking-sheet.tsx");
const trackerFunctions = readOptional("src/lib/setter-tracker.functions.ts");
const removeDemo = readOptional("scripts/remove-demo.mjs");
const migrationPath = "supabase/migrations/20260729005406_setter_tracking_sheet.sql";
const migration = readOptional(migrationPath);

test("Calendar is a refined three-view workspace with explicit failure handling", () => {
  assert.match(calendar, /PageShell/);
  assert.match(calendar, /PageHeader/);
  assert.match(calendar, /"calendar" \| "sets" \| "tracker"/);
  assert.match(calendar, />Schedule</);
  assert.match(calendar, />Sets</);
  assert.match(calendar, />Tracker</);
  assert.match(calendar, /<SetterTrackingSheet/);
  assert.match(calendar, /events\.isError/);
  assert.match(calendar, /min-h-12/);
  assert.doesNotMatch(calendar, /autoCancelled|no confirmation 6h before the call/);
  assert.doesNotMatch(calendarFunctions, /deleteSetReminder|\.from\("set_reminders"\)\.delete\(/);
  assert.doesNotMatch(calendar, /rgba\(59,130,246|#3b82f6/i);
});

test("setter tracker reuses canonical EOD activity and set records instead of duplicating them", () => {
  assert.ok(tracker, "setter tracking component must exist");
  assert.ok(trackerFunctions, "setter tracker server functions must exist");
  assert.match(trackerFunctions, /from\("eods_activity_real"\)/);
  assert.match(trackerFunctions, /from\("set_reminders"\)/);
  assert.match(trackerFunctions, /from\("set_follow_ups"\)/);
  assert.match(trackerFunctions, /from\("set_reminder_events"\)/);
  assert.match(trackerFunctions, /from\("profiles"\)[\s\S]{0,180}?\.eq\("is_demo", false\)/);
  assert.doesNotMatch(trackerFunctions, /from\("eods"\)/);
  assert.doesNotMatch(tracker, /from\("eods"\)|\.insert\([^)]*eod|\.upsert\([^)]*eod/i);
  assert.match(tracker, /Submitted EODs/);
  assert.match(tracker, /Unavailable/);
});

test("setter tracking migration adds lifecycle fields and durable follow-up history", () => {
  assert.ok(migration, `${migrationPath} must exist`);
  for (const column of [
    "lead_channel",
    "qualification_status",
    "attendance_status",
    "sales_outcome",
    "outcome_recorded_at",
    "calendar_sync_status",
    "calendar_sync_error",
    "calendar_sync_token",
    "calendar_sync_updated_at",
    "gcal_event_owner_id",
    "updated_at",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`, "i"));
  }
  assert.match(migration, /create table(?: if not exists)? public\.set_follow_ups/i);
  assert.match(migration, /create table(?: if not exists)? public\.set_reminder_events/i);
  assert.match(migration, /audit_set_reminder_transition/i);
  assert.match(migration, /audit_set_follow_up_change/i);
  assert.match(migration, /set_id uuid not null references public\.set_reminders\(id\) on delete restrict/i);
  assert.match(migration, /due_at timestamptz not null/i);
  assert.match(migration, /status text not null default 'open'/i);
  assert.match(migration, /completed_at timestamptz/i);
  assert.match(migration, /created_by uuid not null/i);
  assert.match(migration, /revoke all on table public\.set_follow_ups from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update on table public\.set_follow_ups to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*set_follow_ups/i);
  assert.match(migration, /revoke all on table public\.set_reminder_events from public, anon, authenticated/i);
  assert.match(migration, /grant select on table public\.set_reminder_events to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*(?:insert|update|delete)[^;]*set_reminder_events/i);
  assert.match(migration, /protect_set_reminder_event_history/i);
  assert.match(migration, /raise exception 'Set reminder audit history is immutable'/i);
  assert.match(migration, /protect_set_reminder_internal_fields/i);
  assert.match(migration, /Calendar sync fields are server-controlled/i);
  assert.match(migration, /grant select, insert, update on table public\.set_reminders to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*set_reminders to authenticated/i);
  assert.doesNotMatch(migration, /create policy "Admins delete erroneous sets"/i);
  assert.match(migration, /create unique index[^;]*set_follow_ups[^;]*where status = 'open'/i);
  assert.match(removeDemo, /set_reminder_events[\s\S]*set_follow_ups[\s\S]*set_reminders/);
});

test("database and server authorization isolate setter sheets while preserving leadership oversight", () => {
  assert.match(migration, /drop policy if exists "Team can update set tracking"/i);
  assert.match(migration, /drop policy if exists "Sales staff view set reminders"/i);
  assert.match(migration, /owner_id = auth\.uid\(\)/i);
  assert.match(migration, /p\.is_demo is not true/i);
  for (const role of ["admin", "founder", "cofounder", "closer"]) {
    assert.match(migration, new RegExp(`has_role\\(auth\\.uid\\(\\), '${role}'\\)`, "i"));
  }
  assert.match(migration, /alter table public\.set_follow_ups enable row level security/i);
  assert.match(migration, /exists[\s\S]*from public\.set_reminders sr/i);
  assert.match(trackerFunctions, /requireSalesTrackerAccess/);
  assert.match(trackerFunctions, /canViewTeam/);
  assert.match(trackerFunctions, /targetUserId !== context\.userId/);
  assert.match(trackerFunctions, /assertSetMutationTarget/);
  assert.match(trackerFunctions, /assertFollowUpMutationTarget/);
  assert.match(trackerFunctions, /Set owner is not an active real profile/);
  assert.match(calendarFunctions, /randomUUID\(\)/);
  assert.match(calendarFunctions, /calendar_sync_token/);
  assert.match(calendarFunctions, /\.eq\("calendar_sync_token", operationId\)/);
  assert.match(calendarFunctions, /gcal_event_owner_id/);
  assert.match(calendarFunctions, /Only the owner or a sales leader can cancel this set/);
  assert.match(calendarFunctions, /Only the owner or a sales leader can restore this set/);
});

test("tracker supports operational lifecycle actions and responsive sheet behavior", () => {
  assert.match(trackerFunctions, /updateSetLifecycle/);
  assert.match(trackerFunctions, /scheduleSetFollowUp/);
  assert.match(trackerFunctions, /completeSetFollowUp/);
  assert.match(trackerFunctions, /qualified|unqualified/);
  assert.match(trackerFunctions, /showed|no_show/);
  assert.match(trackerFunctions, /follow_up|closed|lost/);
  assert.match(tracker, /Reminder due/);
  assert.match(tracker, /No-show/);
  assert.match(tracker, /Follow-up/);
  assert.match(tracker, /Activity history/);
  assert.match(tracker, /xl:block/);
  assert.match(tracker, /xl:hidden/);
  assert.match(tracker, /<SheetContent[\s\S]{0,120}?side="bottom"/);
  assert.match(tracker, /min-h-12/);
  assert.doesNotMatch(tracker, /green|emerald|lime|olive|#22c55e|#16a34a/i);
});
