import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Tables } from "@/integrations/supabase/types";

const SALES_ROLES = ["admin", "founder", "cofounder", "closer", "setter"] as const;
const TEAM_TRACKER_ROLES = ["admin", "founder", "cofounder", "closer"] as const;
const LEAD_CHANNELS = ["unknown", "inbound", "outbound", "referral", "other"] as const;
const QUALIFICATION_STATUSES = ["unknown", "qualified", "unqualified"] as const;
const ATTENDANCE_STATUSES = ["pending", "showed", "no_show", "cancelled"] as const;
const SALES_OUTCOMES = ["pending", "follow_up", "closed", "lost"] as const;
const FOLLOW_UP_CHANNELS = ["dm", "phone", "email", "other"] as const;
const FOLLOW_UP_STATUSES = ["completed", "cancelled"] as const;
const RANGE_DAYS = [7, 30, 90] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SalesRole = (typeof SALES_ROLES)[number];
type TrackerContext = { supabase: any; userId: string };
export type TrackerLeadChannel = (typeof LEAD_CHANNELS)[number];
export type TrackerQualification = (typeof QUALIFICATION_STATUSES)[number];
export type TrackerAttendance = (typeof ATTENDANCE_STATUSES)[number];
export type TrackerOutcome = (typeof SALES_OUTCOMES)[number];
export type TrackerFollowUpChannel = (typeof FOLLOW_UP_CHANNELS)[number];
export type TrackerSet = Pick<
  Tables<"set_reminders">,
  | "id"
  | "prospect"
  | "event_start"
  | "duration_min"
  | "owner_id"
  | "source"
  | "status"
  | "confirmed_at"
  | "reminder_log"
  | "notes"
  | "lead_channel"
  | "qualification_status"
  | "attendance_status"
  | "sales_outcome"
  | "outcome_recorded_at"
  | "calendar_sync_status"
  | "calendar_sync_error"
  | "updated_at"
>;
export type TrackerFollowUp = Tables<"set_follow_ups">;
export type TrackerEvent = Tables<"set_reminder_events">;
export type TrackerEod = Tables<"eods_activity_real">;

function includesValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function optionalNote(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid note");
  const trimmed = value.trim();
  if (trimmed.length > 4000) throw new Error("Note must be 4,000 characters or fewer");
  return trimmed || null;
}

function dateKeyInTimeZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function requireSalesTrackerAccess(context: TrackerContext) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);

  const roles = ((data ?? []) as { role: string }[])
    .map((row) => row.role)
    .filter((role: string): role is SalesRole => SALES_ROLES.includes(role as SalesRole));
  if (roles.length === 0) throw new Error("Forbidden: sales calendar access required");

  const canViewTeam = roles.some((role: SalesRole) => TEAM_TRACKER_ROLES.includes(role as (typeof TEAM_TRACKER_ROLES)[number]));
  return { roles, canViewTeam };
}

async function assertTrackerTarget(
  context: TrackerContext,
  targetUserId: string,
) {
  const access = await requireSalesTrackerAccess(context);
  if (targetUserId !== context.userId && !access.canViewTeam) {
    throw new Error("Forbidden: you can only open your own tracking sheet");
  }
  return access;
}

async function assertSetMutationTarget(context: TrackerContext, setId: string) {
  const access = await requireSalesTrackerAccess(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: set, error: setError } = await supabaseAdmin
    .from("set_reminders")
    .select("id, owner_id")
    .eq("id", setId)
    .maybeSingle();
  if (setError || !set?.owner_id) throw new Error("Set not found");
  if (set.owner_id !== context.userId && !access.canViewTeam) {
    throw new Error("Forbidden: you can only update your own tracking sheet");
  }

  const { data: owner, error: ownerError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", set.owner_id)
    .eq("is_demo", false)
    .eq("active", true)
    .maybeSingle();
  if (ownerError || !owner) throw new Error("Set owner is not an active real profile");
  return set;
}

async function assertFollowUpMutationTarget(context: TrackerContext, followUpId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: followUp, error } = await supabaseAdmin
    .from("set_follow_ups")
    .select("set_id")
    .eq("id", followUpId)
    .maybeSingle();
  if (error || !followUp) throw new Error("Follow-up not found");
  await assertSetMutationTarget(context, followUp.set_id);
}

export type SetterTrackerMember = {
  id: string;
  name: string;
  role: "setter" | "closer";
};

export const listSetterTrackerMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ canViewTeam: boolean; members: SetterTrackerMember[] }> => {
    const access = await requireSalesTrackerAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["setter", "closer"]);
    if (roleError) throw new Error(roleError.message);

    const roleByUser = new Map<string, "setter" | "closer">();
    for (const row of roleRows ?? []) {
      if (row.role === "setter" || !roleByUser.has(row.user_id)) {
        roleByUser.set(row.user_id, row.role as "setter" | "closer");
      }
    }
    const ids = Array.from(roleByUser.keys());
    if (ids.length === 0) return { canViewTeam: access.canViewTeam, members: [] };

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles").select("id, display_name, active").eq("is_demo", false).in("id", ids);
    if (profileError) throw new Error(profileError.message);

    const members = (profiles ?? [])
      .filter((profile) => profile.active !== false)
      .filter((profile) => access.canViewTeam || profile.id === context.userId)
      .map((profile) => ({
        id: profile.id,
        name: profile.display_name?.trim() || "Unnamed setter",
        role: roleByUser.get(profile.id) ?? "setter",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { canViewTeam: access.canViewTeam, members };
  });

export type SetterTrackerData = {
  canViewTeam: boolean;
  member: { id: string; name: string; timezone: string };
  range: { days: 7 | 30 | 90; from: string; to: string; setsThrough: string };
  sets: TrackerSet[];
  followUps: TrackerFollowUp[];
  events: TrackerEvent[];
  eods: TrackerEod[];
};

export const getSetterTracker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { targetUserId?: string; days?: number } | undefined) => {
    const days = RANGE_DAYS.includes(input?.days as (typeof RANGE_DAYS)[number])
      ? input!.days as 7 | 30 | 90
      : 30;
    const targetUserId = input?.targetUserId ? requireUuid(input.targetUserId, "setter id") : undefined;
    return { days, targetUserId };
  })
  .handler(async ({ data, context }): Promise<SetterTrackerData> => {
    const targetUserId = data.targetUserId ?? context.userId;
    const access = await assertTrackerTarget(context, targetUserId);

    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("id, display_name, timezone")
      .eq("is_demo", false)
      .eq("id", targetUserId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Setter profile not found");

    const timezone = profile.timezone || "UTC";
    const to = dateKeyInTimeZone(new Date(), timezone);
    const from = shiftDateKey(to, -(data.days - 1));
    const setsThrough = shiftDateKey(to, 31);
    // Query a padded UTC window, then apply the exact member-local date keys.
    // This avoids dropping boundary-day sets when the member is not in UTC.
    const eventMin = new Date(Date.now() - (data.days + 2) * 86_400_000).toISOString();
    const eventMax = new Date(Date.now() + 33 * 86_400_000).toISOString();

    const [setsResult, eodsResult] = await Promise.all([
      context.supabase
        .from("set_reminders")
        .select("id, prospect, event_start, duration_min, owner_id, source, status, confirmed_at, reminder_log, notes, lead_channel, qualification_status, attendance_status, sales_outcome, outcome_recorded_at, calendar_sync_status, calendar_sync_error, updated_at")
        .eq("owner_id", targetUserId)
        .gte("event_start", eventMin)
        .lte("event_start", eventMax)
        .order("event_start", { ascending: false }),
      context.supabase
        .from("eods_activity_real")
        .select("id, user_id, report_date, dials, leads_contacted, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows, closes, created_at")
        .eq("user_id", targetUserId)
        .gte("report_date", from)
        .lte("report_date", to)
        .order("report_date", { ascending: false }),
    ]);
    if (setsResult.error) throw new Error(setsResult.error.message);
    if (eodsResult.error) throw new Error(eodsResult.error.message);

    const sets = ((setsResult.data ?? []) as TrackerSet[]).filter((set) => {
      const localDate = dateKeyInTimeZone(new Date(set.event_start), timezone);
      return localDate >= from && localDate <= setsThrough;
    });
    let followUps: TrackerFollowUp[] = [];
    let events: TrackerEvent[] = [];
    if (sets.length > 0) {
      const setIds = sets.map((set) => set.id);
      const [followUpsResult, eventsResult] = await Promise.all([
        context.supabase
          .from("set_follow_ups")
          .select("id, set_id, due_at, channel, status, note, completed_at, completed_by, created_by, created_at, updated_at")
          .in("set_id", setIds)
          .order("due_at", { ascending: true }),
        context.supabase
          .from("set_reminder_events")
          .select("id, set_id, actor_id, event_type, from_value, to_value, created_at")
          .in("set_id", setIds)
          .order("created_at", { ascending: false }),
      ]);
      if (followUpsResult.error) throw new Error(followUpsResult.error.message);
      if (eventsResult.error) throw new Error(eventsResult.error.message);
      followUps = (followUpsResult.data ?? []) as TrackerFollowUp[];
      events = (eventsResult.data ?? []) as TrackerEvent[];
    }

    return {
      canViewTeam: access.canViewTeam,
      member: {
        id: profile.id,
        name: profile.display_name?.trim() || "Unnamed setter",
        timezone,
      },
      range: { days: data.days, from, to, setsThrough },
      sets,
      followUps,
      events,
      eods: (eodsResult.data ?? []) as TrackerEod[],
    };
  });

export const updateSetLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    id: string;
    leadChannel?: string;
    qualificationStatus?: string;
    attendanceStatus?: string;
    salesOutcome?: string;
    notes?: string | null;
  }) => {
    const id = requireUuid(input?.id, "set id");
    const leadChannel = input.leadChannel === undefined
      ? undefined
      : includesValue(LEAD_CHANNELS, input.leadChannel) ? input.leadChannel : (() => { throw new Error("Invalid lead channel"); })();
    const qualificationStatus = input.qualificationStatus === undefined
      ? undefined
      : includesValue(QUALIFICATION_STATUSES, input.qualificationStatus) ? input.qualificationStatus : (() => { throw new Error("Invalid qualification status"); })();
    const attendanceStatus = input.attendanceStatus === undefined
      ? undefined
      : includesValue(ATTENDANCE_STATUSES, input.attendanceStatus) ? input.attendanceStatus : (() => { throw new Error("Invalid attendance status"); })();
    const salesOutcome = input.salesOutcome === undefined
      ? undefined
      : includesValue(SALES_OUTCOMES, input.salesOutcome) ? input.salesOutcome : (() => { throw new Error("Invalid sales outcome"); })();
    const notes = optionalNote(input.notes);
    if ([leadChannel, qualificationStatus, attendanceStatus, salesOutcome, notes].every((value) => value === undefined)) {
      throw new Error("No tracking change supplied");
    }
    return { id, leadChannel, qualificationStatus, attendanceStatus, salesOutcome, notes };
  })
  .handler(async ({ data, context }) => {
    await assertSetMutationTarget(context, data.id);
    const patch: Database["public"]["Tables"]["set_reminders"]["Update"] = {};
    if (data.leadChannel !== undefined) patch.lead_channel = data.leadChannel;
    if (data.qualificationStatus !== undefined) patch.qualification_status = data.qualificationStatus;
    if (data.attendanceStatus !== undefined) patch.attendance_status = data.attendanceStatus;
    if (data.salesOutcome !== undefined) patch.sales_outcome = data.salesOutcome;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (
      (data.attendanceStatus !== undefined && data.attendanceStatus !== "pending")
      || (data.salesOutcome !== undefined && data.salesOutcome !== "pending")
    ) {
      patch.outcome_recorded_at = new Date().toISOString();
    }

    const { data: row, error } = await context.supabase
      .from("set_reminders")
      .update(patch)
      .eq("id", data.id)
      .select("id, lead_channel, qualification_status, attendance_status, sales_outcome, outcome_recorded_at, notes, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const scheduleSetFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { setId: string; dueAt: string; channel?: string; note?: string | null }) => {
    const setId = requireUuid(input?.setId, "set id");
    const due = new Date(input?.dueAt ?? "");
    if (Number.isNaN(due.getTime())) throw new Error("Invalid follow-up date");
    const channel = input.channel === undefined
      ? "dm"
      : includesValue(FOLLOW_UP_CHANNELS, input.channel) ? input.channel : (() => { throw new Error("Invalid follow-up channel"); })();
    return { setId, dueAt: due.toISOString(), channel, note: optionalNote(input.note) ?? null };
  })
  .handler(async ({ data, context }) => {
    await assertSetMutationTarget(context, data.setId);

    const { data: existing, error: existingError } = await context.supabase
      .from("set_follow_ups")
      .select("id")
      .eq("set_id", data.setId)
      .eq("status", "open")
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const query = existing
      ? context.supabase
          .from("set_follow_ups")
          .update({ due_at: data.dueAt, channel: data.channel, note: data.note })
          .eq("id", existing.id)
      : context.supabase
          .from("set_follow_ups")
          .insert({
            set_id: data.setId,
            due_at: data.dueAt,
            channel: data.channel,
            note: data.note,
            created_by: context.userId,
          });
    const { data: row, error } = await query
      .select("id, set_id, due_at, channel, status, note, completed_at, completed_by, created_by, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as TrackerFollowUp;
  });

export const completeSetFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; status?: string }) => {
    const id = requireUuid(input?.id, "follow-up id");
    const status = input.status === undefined
      ? "completed"
      : includesValue(FOLLOW_UP_STATUSES, input.status) ? input.status : (() => { throw new Error("Invalid follow-up status"); })();
    return { id, status };
  })
  .handler(async ({ data, context }) => {
    await assertFollowUpMutationTarget(context, data.id);
    const { data: row, error } = await context.supabase
      .from("set_follow_ups")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("status", "open")
      .select("id, set_id, due_at, channel, status, note, completed_at, completed_by, created_by, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as TrackerFollowUp;
  });
