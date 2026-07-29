import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildGoogleAuthUrl,
  signState,
  getRedirectUri,
  refreshAccessToken,
  listCalendarEvents,
  insertCalendarEvent,
  deleteCalendarEvent,
  type GCalEvent,
} from "@/lib/calendar.server";
import { randomBytes, randomUUID } from "crypto";

const CALENDAR_STAFF_ROLES = new Set(["admin", "founder", "cofounder", "closer", "setter", "csm", "coach"]);
const SET_OPERATIONS_ROLES = new Set(["admin", "founder", "cofounder", "closer", "setter"]);
const SET_LEADERSHIP_ROLES = ["admin", "founder", "cofounder", "closer"] as const;

type CalendarAuthContext = {
  supabase: { from: (table: string) => any };
  userId: string;
};

async function requireCalendarRole(context: CalendarAuthContext, allowed: Set<string>): Promise<Set<string>> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error("Could not verify calendar access");
  const roles = new Set<string>(((data ?? []) as { role: string }[]).map((row) => row.role));
  if (![...roles].some((role) => allowed.has(role))) throw new Error("Forbidden");
  return roles;
}

const requireStaffCalendarAccess = (context: CalendarAuthContext) => requireCalendarRole(context, CALENDAR_STAFF_ROLES);
const requireSetOperationsAccess = (context: CalendarAuthContext) => requireCalendarRole(context, SET_OPERATIONS_ROLES);

function hasSetLeadership(roles: Set<string>) {
  return SET_LEADERSHIP_ROLES.some((role) => roles.has(role));
}

/** Return Google OAuth authorize URL for the signed-in user. */
export const startGoogleCalendarAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaffCalendarAccess(context);
    const req = getRequest();
    const redirectUri = getRedirectUri(req.url);
    const nonce = randomBytes(12).toString("hex");
    const state = signState(context.userId, nonce);
    const url = buildGoogleAuthUrl(state, redirectUri);
    return { url };
  });

/** My own connection status. */
export const getMyCalendarConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaffCalendarAccess(context);
    const { data } = await context.supabase
      .from("calendar_connections")
      .select("id, google_email, calendar_id, color_hex, connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

/** Team-wide list: everyone connected + their color + display name. */
export const getTeamCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaffCalendarAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conns } = await supabaseAdmin
      .from("calendar_connections")
      .select("user_id, color_hex, connected_at");
    if (!conns) return [];
    const ids = conns.map((c) => c.user_id);
    const { data: statusRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    const statusRolesBy = new Map<string, string[]>();
    (statusRoles ?? []).forEach((r) => statusRolesBy.set(r.user_id, [...(statusRolesBy.get(r.user_id) ?? []), r.role]));
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("is_demo", false)
      .in("id", ids);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    return conns.filter((c) => pmap.has(c.user_id) && (statusRolesBy.get(c.user_id) ?? []).some((r) => ["admin", "founder", "cofounder", "closer", "coach", "csm"].includes(r))).map((c) => ({
      user_id: c.user_id,
      color: c.color_hex,
      connected_at: c.connected_at,
      display_name: pmap.get(c.user_id)?.display_name ?? "Unknown",
      avatar_url: pmap.get(c.user_id)?.avatar_url ?? null,
    }));
  });

export const disconnectMyCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaffCalendarAccess(context);
    const { error } = await context.supabase
      .from("calendar_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type TeamEvent = {
  id: string;
  user_id: string;
  color: string;
  display_name: string;
  summary: string;
  description: string | null;
  start: string; // ISO
  end: string;   // ISO
  all_day: boolean;
  html_link: string | null;
  meet_link: string | null;
};

/** Fetch team calendar events across all connected users for a time range. */
export const getTeamCalendarEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { timeMin: string; timeMax: string }) => data)
  .handler(async ({ context, data }) => {
    await requireStaffCalendarAccess(context);
    const timeMin = new Date(data.timeMin);
    const timeMax = new Date(data.timeMax);
    if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime()) || timeMax <= timeMin) throw new Error("Invalid calendar range");
    if (timeMax.getTime() - timeMin.getTime() > 45 * 86_400_000) throw new Error("Calendar range cannot exceed 45 days");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conns, error } = await supabaseAdmin
      .from("calendar_connections")
      .select("*");
    if (error) throw new Error(error.message);
    if (!conns || conns.length === 0) return [] as TeamEvent[];

    const ids = conns.map((c) => c.user_id);
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .eq("is_demo", false)
      .in("id", ids);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Unknown"]));
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    const rolesBy = new Map<string, string[]>();
    (roleRows ?? []).forEach((r) => rolesBy.set(r.user_id, [...(rolesBy.get(r.user_id) ?? []), r.role]));
    const feedsTeamCalendar = (id: string) => {
      const rs = rolesBy.get(id) ?? [];
      // setter-only calendars stay personal (founder-directed 2026-07-29)
      return rs.some((r) => ["admin", "founder", "cofounder", "closer", "coach", "csm"].includes(r));
    };
    const realConnections = conns.filter((c) => pmap.has(c.user_id) && feedsTeamCalendar(c.user_id));

    const now = Date.now();

    // One Google round-trip per member, all in parallel — the page used to
    // wait for each member's calendar sequentially.
    const perUser = await Promise.all(realConnections.map(async (c): Promise<TeamEvent[]> => {
      try {
        let accessToken = c.access_token as string | null;
        const exp = c.access_token_expires_at ? new Date(c.access_token_expires_at).getTime() : 0;
        if (!accessToken || exp - 60_000 < now) {
          const r = await refreshAccessToken(c.refresh_token);
          accessToken = r.access_token;
          const newExpiry = new Date(now + r.expires_in * 1000).toISOString();
          await supabaseAdmin
            .from("calendar_connections")
            .update({ access_token: accessToken, access_token_expires_at: newExpiry })
            .eq("id", c.id);
        }
        const items = await listCalendarEvents(accessToken!, c.calendar_id, data.timeMin, data.timeMax);
        const out: TeamEvent[] = [];
        for (const it of items) {
          const startStr = it.start?.dateTime ?? it.start?.date;
          const endStr = it.end?.dateTime ?? it.end?.date;
          if (!startStr || !endStr) continue;
          if (it.status === "cancelled") continue;
          out.push({
            id: `${c.user_id}:${it.id}`,
            user_id: c.user_id,
            color: c.color_hex,
            display_name: pmap.get(c.user_id) ?? "Unknown",
            summary: it.summary ?? "(no title)",
            description: it.description ?? null,
            start: new Date(startStr).toISOString(),
            end: new Date(endStr).toISOString(),
            all_day: !!it.start?.date && !it.start?.dateTime,
            html_link: it.htmlLink ?? null,
            meet_link: it.hangoutLink ?? null,
          } satisfies TeamEvent);
        }
        return out;
      } catch (err) {
        console.error(`[calendar] user ${c.user_id} fetch failed:`, err);
        return [];
      }
    }));
    const events = perUser.flat();
    events.sort((a, b) => a.start.localeCompare(b.start));
    return events;
  });

/** Reminder cadence for sets: 2 days, 1 day, 3 hours, 1 hour before. */
export const SET_REMINDER_MINUTES = [2 * 24 * 60, 24 * 60, 3 * 60, 60];

/**
 * Set reminder: creates the booked call on the setter's own Google Calendar
 * with popup reminders 2 days, 1 day, 3 hours, and 1 hour before — confirm,
 * remind, call, follow up. Also records the set in set_reminders so the
 * upcoming-sets list shows it to the whole sales team.
 */
export const createSetReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    prospect: string; startISO: string; durationMin: number; notes?: string;
    source?: "manual" | "claimed";
  }) => data)
  .handler(async ({ context, data }) => {
    await requireSetOperationsAccess(context);
    const prospect = data.prospect.trim();
    const start = new Date(data.startISO);
    const durationMin = Math.max(15, Math.min(240, Math.round(data.durationMin)));
    if (!prospect || prospect.length > 200) throw new Error("Prospect must be between 1 and 200 characters");
    if (Number.isNaN(start.getTime())) throw new Error("A valid set time is required");
    if (!Number.isFinite(data.durationMin) || data.durationMin < 15 || data.durationMin > 240) throw new Error("Duration must be between 15 and 240 minutes");
    if ((data.notes?.length ?? 0) > 4_000) throw new Error("Notes must be 4,000 characters or fewer");
    if (data.source && !["manual", "claimed"].includes(data.source)) throw new Error("Invalid set source");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conn) throw new Error("no-connection");

    let accessToken = conn.access_token as string | null;
    const exp = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
    if (!accessToken || exp - 60_000 < Date.now()) {
      const r = await refreshAccessToken(conn.refresh_token);
      accessToken = r.access_token;
      await supabaseAdmin
        .from("calendar_connections")
        .update({ access_token: accessToken, access_token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() })
        .eq("id", conn.id);
    }

    const end = new Date(start.getTime() + durationMin * 60_000);
    const event = await insertCalendarEvent(accessToken!, conn.calendar_id, {
      summary: `Set: ${prospect}`,
      description: [data.notes, "Reminders: 2 days · 1 day · 3 hours · 1 hour before. Confirm, remind, call, follow up."]
        .filter(Boolean)
        .join("\n\n"),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      reminderMinutes: SET_REMINDER_MINUTES,
    });

    // Track it for the upcoming-sets list (RLS: owner must be the caller)

    const { error: insErr } = await (context.supabase as any).from("set_reminders").insert({
      owner_id: context.userId,
      prospect,
      event_start: start.toISOString(),
      duration_min: durationMin,
      notes: data.notes ?? null,
      source: data.source ?? "manual",
      gcal_event_id: event.id,
      gcal_event_owner_id: context.userId,
      gcal_html_link: event.htmlLink ?? null,
    });
    if (insErr) {
      try {
        await deleteCalendarEvent(accessToken!, conn.calendar_id, event.id);
      } catch (cleanupError) {
        console.error("[set_reminders] failed to compensate Google Calendar insert:", cleanupError);
      }
      throw new Error(`Could not save the set: ${insErr.message}`);
    }

    return { ok: true, htmlLink: event.htmlLink ?? null };
  });

export type UpcomingSet = {
  id: string;
  owner_id: string | null;
  owner_name: string;
  prospect: string;
  event_start: string;
  duration_min: number;
  notes: string | null;
  source: string;
  gcal_html_link: string | null;
  reminder_log: Partial<Record<"48h" | "24h" | "3h" | "1h", "reminded" | "confirmed" | "no_response">>;
  confirmed_at: string | null;
  status: "active" | "cancelled" | "completed";
  calendar_sync_status: "synced" | "pending" | "error" | "not_connected";
  calendar_sync_error: string | null;
};

/** Upcoming sets across the sales team, soonest first. */
export const listUpcomingSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSetOperationsAccess(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("set_reminders")
      .select("id, owner_id, prospect, event_start, duration_min, notes, source, gcal_html_link, reminder_log, confirmed_at, status, calendar_sync_status, calendar_sync_error")
      .gte("event_start", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("event_start", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set(((rows ?? []) as { owner_id: string | null }[]).map((r) => r.owner_id).filter((x): x is string => !!x)));
    const { data: profs } = ids.length
      ? await context.supabase.from("profiles").select("id, display_name").eq("is_demo", false).in("id", ids)
      : { data: [] };
    const pmap = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Unknown"]));
    return ((rows ?? []) as Omit<UpcomingSet, "owner_name">[])
      .filter((r) => !r.owner_id || pmap.has(r.owner_id))
      .map((r) => ({
      ...r,
      owner_name: r.owner_id ? (pmap.get(r.owner_id) ?? "Unknown") : "Unclaimed",
      })) as UpcomingSet[];
  });

// ── Calendly ────────────────────────────────────────────────────────────────

/**
 * Only closing-call bookings are sets (founder-confirmed 2026-07-14):
 * the shared Pathway Onboarding link plus the "45-60min ISA Call" type the
 * team books through in practice (verified against live Calendly 2026-07-14).
 * Coaching/advisor/application calls never import. Name-matching covers new
 * per-host copies of the same event type.
 */
const CLOSING_CALL_LINK = "https://calendly.com/d/d3f3-7pm-z9r/1-on-1-pathway-onboarding";
const CLOSING_CALL_NAMES = ["45-60min ISA Call"];

/**
 * Pull upcoming Calendly CLOSING-CALL bookings into set_reminders as
 * UNCLAIMED sets. No-ops quietly when CALENDLY_API_KEY is absent. Dedupes on
 * the event URI. Fails closed: if the closing event type can't be resolved
 * (renamed/deleted), nothing imports rather than importing coaching calls.
 */
export const syncCalendlySets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSetOperationsAccess(context);
    const key = process.env.CALENDLY_API_KEY;
    if (!key) return { ok: true, imported: 0, reason: "no-key" };
    const H = { Authorization: `Bearer ${key}` };

    const meRes = await fetch("https://api.calendly.com/users/me", { headers: H });
    if (!meRes.ok) return { ok: false, imported: 0, reason: `calendly-auth-${meRes.status}` };
    const me = (await meRes.json()) as { resource: { uri: string; current_organization: string } };

    // Resolve which event types count as closing calls: the type the shared
    // link points at (matched by URL or slug), plus same-named types on the
    // other hosts' calendars.
    const etParams = new URLSearchParams({ organization: me.resource.current_organization, count: "100" });
    const etRes = await fetch(`https://api.calendly.com/event_types?${etParams}`, { headers: H });
    if (!etRes.ok) return { ok: false, imported: 0, reason: `calendly-types-${etRes.status}` };
    const etJson = (await etRes.json()) as { collection: { uri: string; name: string; scheduling_url: string }[] };
    const slug = CLOSING_CALL_LINK.split("/").filter(Boolean).pop()!;
    const direct = etJson.collection.filter(
      (t) => t.scheduling_url === CLOSING_CALL_LINK || t.scheduling_url.split("/").filter(Boolean).pop() === slug,
    );
    const closingNames = new Set([...direct.map((t) => t.name), ...CLOSING_CALL_NAMES]);
    const closingTypes = new Set(
      etJson.collection.filter((t) => closingNames.has(t.name)).map((t) => t.uri),
    );
    if (closingNames.size === 0) return { ok: false, imported: 0, reason: "closing-type-not-found" };

    const params = new URLSearchParams({
      organization: me.resource.current_organization,
      status: "active",
      min_start_time: new Date().toISOString(),
      count: "50",
      sort: "start_time:asc",
    });
    const evRes = await fetch(`https://api.calendly.com/scheduled_events?${params}`, { headers: H });
    if (!evRes.ok) return { ok: false, imported: 0, reason: `calendly-events-${evRes.status}` };
    const evAll = (await evRes.json()) as {
      collection: { uri: string; name: string; start_time: string; end_time: string; event_type: string }[];
    };
    // Match by type URI AND by event name — shared/round-robin event types
    // don't appear in the org event-type listing, so the URI set misses them.
    const evJson = { collection: evAll.collection.filter((ev) => closingTypes.has(ev.event_type) || closingNames.has(ev.name)) };

    // Invitee names, one call per event, in parallel
    const events = await Promise.all(evJson.collection.map(async (ev) => {
      let invitee = "";
      try {
        const invRes = await fetch(`${ev.uri}/invitees?count=1`, { headers: H });
        if (invRes.ok) {
          const inv = (await invRes.json()) as { collection: { name?: string; email?: string }[] };
          invitee = inv.collection[0]?.name ?? inv.collection[0]?.email ?? "";
        }
      } catch { /* keep event name */ }
      return { ...ev, invitee };
    }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let imported = 0;
    for (const ev of events) {
      const durationMin = Math.max(15, Math.round((new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / 60000));

      const { error, data } = await (supabaseAdmin as any)
        .from("set_reminders")
        .upsert({
          calendly_event_uri: ev.uri,
          prospect: ev.invitee || ev.name,
          event_start: ev.start_time,
          duration_min: durationMin,
          notes: ev.name,
          source: "calendly",
        }, { onConflict: "calendly_event_uri", ignoreDuplicates: true })
        .select("id");
      if (!error && data?.length) imported += 1;
    }
    return { ok: true, imported };
  });

type CalendarSyncAdmin = { from: (table: string) => any };

async function withFreshUserCalendar<T>(
  ownerId: string,
  operation: (accessToken: string, calendarId: string) => Promise<T>,
): Promise<{ connected: false } | { connected: true; value: T }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: connection } = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!connection) return { connected: false };

  let accessToken = connection.access_token as string | null;
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  if (!accessToken || expiresAt - 60_000 < Date.now()) {
    const refreshed = await refreshAccessToken(connection.refresh_token);
    accessToken = refreshed.access_token;
    await supabaseAdmin
      .from("calendar_connections")
      .update({
        access_token: accessToken,
        access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1_000).toISOString(),
      })
      .eq("id", connection.id);
  }

  return {
    connected: true,
    value: await operation(accessToken!, connection.calendar_id),
  };
}

async function finishCalendarSync(
  admin: CalendarSyncAdmin,
  setId: string,
  operationId: string,
  actorId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await admin
    .from("set_reminders")
    .update({
      ...patch,
      calendar_sync_token: null,
      calendar_sync_error: null,
      transition_actor_id: actorId,
    })
    .eq("id", setId)
    .eq("calendar_sync_token", operationId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function failCalendarSync(
  admin: CalendarSyncAdmin,
  setId: string,
  operationId: string,
  actorId: string,
  message: string,
): Promise<void> {
  const { error } = await admin
    .from("set_reminders")
    .update({
      calendar_sync_status: "error",
      calendar_sync_error: message.slice(0, 500),
      calendar_sync_token: null,
      transition_actor_id: actorId,
    })
    .eq("id", setId)
    .eq("calendar_sync_token", operationId);
  if (error) throw new Error(error.message);
}

function calendarEventInput(row: {
  prospect: string;
  notes: string | null;
  event_start: string;
  duration_min: number;
}) {
  const start = new Date(row.event_start);
  const end = new Date(start.getTime() + row.duration_min * 60_000);
  return {
    summary: `Set: ${row.prospect}`,
    description: [
      row.notes,
      "Reminders: 2 days · 1 day · 3 hours · 1 hour before. Confirm, remind, call, follow up.",
    ].filter(Boolean).join("\n\n"),
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    reminderMinutes: SET_REMINDER_MINUTES,
  };
}

/**
 * Claim an unclaimed (Calendly) set: takes ownership and puts the call on the
 * claimer's Google Calendar with the standard reminder cadence.
 */
export const claimSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSetOperationsAccess(context);
    const sr = context.supabase as any;
    const { data: row, error } = await sr
      .from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    if (row.owner_id) throw new Error("already claimed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as CalendarSyncAdmin;
    const operationId = randomUUID();
    // The authenticated read establishes access. The service write carries the
    // verified actor and uses compare-and-set so only one caller can win.
    const { data: claimed, error: upErr } = await admin
      .from("set_reminders")
      .update({
        owner_id: context.userId,
        calendar_sync_status: "pending",
        calendar_sync_error: null,
        calendar_sync_token: operationId,
        transition_actor_id: context.userId,
      })
      .eq("id", data.id)
      .is("owner_id", null)
      .select("id")
      .maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (!claimed) throw new Error("This set was claimed by someone else");

    try {
      const created = await withFreshUserCalendar(context.userId, (token, calendarId) =>
        insertCalendarEvent(token, calendarId, calendarEventInput(row)));
      if (!created.connected) {
        await finishCalendarSync(admin, data.id, operationId, context.userId, {
          calendar_sync_status: "not_connected",
          gcal_event_id: null,
          gcal_event_owner_id: null,
          gcal_html_link: null,
        });
        return {
          ok: true,
          calendar: false,
          warning: "Set claimed, but your Google Calendar is not connected.",
        };
      }

      const committed = await finishCalendarSync(admin, data.id, operationId, context.userId, {
        calendar_sync_status: "synced",
        gcal_event_id: created.value.id,
        gcal_event_owner_id: context.userId,
        gcal_html_link: created.value.htmlLink ?? null,
      });
      if (!committed) {
        await withFreshUserCalendar(context.userId, (token, calendarId) =>
          deleteCalendarEvent(token, calendarId, created.value.id));
        throw new Error("Set ownership changed during calendar sync");
      }
      return { ok: true, calendar: true, htmlLink: created.value.htmlLink ?? null };
    } catch (err) {
      console.error("[claimSet] calendar event failed:", err);
      await failCalendarSync(
        admin,
        data.id,
        operationId,
        context.userId,
        "Google Calendar event could not be created.",
      );
      return {
        ok: true,
        calendar: false,
        warning: "Set claimed, but Google Calendar needs attention.",
      };
    }
  });

// ── Set tracking: reminder checklist, confirmation, cancellation ────────────

export type ReminderWindow = "48h" | "24h" | "3h" | "1h";
// Per-window states: the reminder went out; the lead CONFIRMED at that
// window (closers need to know how fresh the confirmation is); or no reply.
export type ReminderState = "reminded" | "confirmed" | "no_response";

/** Tick a reminder window, mark confirmed/reopen, or update the set's notes. */
export const updateSetTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; window?: ReminderWindow | string; state?: ReminderState | null; confirm?: boolean; notes?: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSetOperationsAccess(context);
    if (data.window && !["48h", "24h", "3h", "1h"].includes(data.window)) throw new Error("Invalid reminder window");
    if (data.state !== undefined && data.state !== null && !["reminded", "confirmed", "no_response"].includes(data.state)) throw new Error("Invalid reminder state");
    if ((data.notes?.length ?? 0) > 4_000) throw new Error("Notes must be 4,000 characters or fewer");
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("id, reminder_log, confirmed_at").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    const patch: Record<string, unknown> = {};
    if (data.window) {
      const log = { ...(row.reminder_log ?? {}) } as Record<string, string>;
      if (data.state == null) delete log[data.window];
      else log[data.window] = data.state;
      patch.reminder_log = log;
      // A window-level confirmation locks the slot in (keeps the 6h auto-drop away)
      if (data.state === "confirmed" && !row.confirmed_at) {
        patch.confirmed_at = new Date().toISOString();
      }
    }
    if (data.confirm !== undefined) {
      patch.confirmed_at = data.confirm ? new Date().toISOString() : null;
    }
    if (data.notes !== undefined) {
      patch.notes = data.notes.trim() || null;
    }
    if (Object.keys(patch).length === 0) throw new Error("No tracking change was provided");
    const { error: upErr } = await sr.from("set_reminders").update(patch).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/** Explicitly cancel a set and remove its linked Calendar event when present. */
export const cancelSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; reason?: string }) => data)
  .handler(async ({ context, data }) => {
    const roles = await requireSetOperationsAccess(context);
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    if (row.owner_id !== context.userId && !hasSetLeadership(roles)) {
      throw new Error("Only the owner or a sales leader can cancel this set");
    }

    const operationId = row.gcal_event_id ? randomUUID() : null;
    const reason = data.reason?.trim().slice(0, 500);
    const note = row.status === "cancelled"
      ? row.notes
      : [row.notes, reason ? `Cancelled: ${reason}` : "Cancelled manually"].filter(Boolean).join("\n");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as CalendarSyncAdmin;
    const { data: cancelled, error: upErr } = await admin.from("set_reminders").update({
      status: "cancelled",
      attendance_status: "cancelled",
      notes: note,
      calendar_sync_status: operationId ? "pending" : "synced",
      calendar_sync_error: null,
      calendar_sync_token: operationId,
      transition_actor_id: context.userId,
    }).eq("id", data.id).eq("status", row.status).select("id").maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (!cancelled) throw new Error("Set changed. Refresh and try again.");
    if (!operationId || !row.gcal_event_id) return { ok: true, calendarRemoved: false };

    const calendarOwnerId = row.gcal_event_owner_id ?? row.owner_id;
    if (!calendarOwnerId) {
      await failCalendarSync(admin, data.id, operationId, context.userId, "Calendar event owner is unknown.");
      return { ok: true, calendarRemoved: false, warning: "Set cancelled, but Calendar cleanup needs attention." };
    }

    try {
      const removed = await withFreshUserCalendar(calendarOwnerId, async (token, calendarId) => {
        await deleteCalendarEvent(token, calendarId, row.gcal_event_id);
        return true;
      });
      if (!removed.connected) {
        await failCalendarSync(admin, data.id, operationId, context.userId, "Calendar owner is not connected.");
        return { ok: true, calendarRemoved: false, warning: "Set cancelled, but the Calendar event could not be reached." };
      }
      await finishCalendarSync(admin, data.id, operationId, context.userId, {
        calendar_sync_status: "synced",
        gcal_event_id: null,
        gcal_event_owner_id: null,
        gcal_html_link: null,
      });
      return { ok: true, calendarRemoved: true };
    } catch (err) {
      console.error("[cancelSet] gcal delete failed:", err);
      await failCalendarSync(admin, data.id, operationId, context.userId, "Google Calendar event could not be removed.");
      return { ok: true, calendarRemoved: false, warning: "Set cancelled, but Calendar cleanup needs attention." };
    }
  });

/** Undo a cancellation: reactivate the set and re-create the claimer's
 *  Google Calendar event (with the standard reminder schedule). */
export const restoreSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const roles = await requireSetOperationsAccess(context);
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    if (row.status !== "cancelled") throw new Error("set is not cancelled");
    if (row.owner_id !== context.userId && !hasSetLeadership(roles)) {
      throw new Error("Only the owner or a sales leader can restore this set");
    }

    const operationId = row.owner_id && !row.gcal_event_id ? randomUUID() : null;
    const alreadyLinked = Boolean(
      row.owner_id
      && row.gcal_event_id
      && (row.gcal_event_owner_id ?? row.owner_id) === row.owner_id,
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as CalendarSyncAdmin;
    const { data: restored, error: upErr } = await admin.from("set_reminders").update({
      status: "active",
      notes: [row.notes, "Restored"].filter(Boolean).join("\n"),
      calendar_sync_status: alreadyLinked ? "synced" : operationId ? "pending" : "synced",
      calendar_sync_error: null,
      calendar_sync_token: operationId,
      transition_actor_id: context.userId,
    }).eq("id", data.id).eq("status", "cancelled").select("id").maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (!restored) throw new Error("Set changed. Refresh and try again.");
    if (alreadyLinked) return { ok: true, calendarRestored: true };
    if (!row.owner_id || !operationId) return { ok: true, calendarRestored: false };

    try {
      const created = await withFreshUserCalendar(row.owner_id, (token, calendarId) =>
        insertCalendarEvent(token, calendarId, calendarEventInput(row)));
      if (!created.connected) {
        await finishCalendarSync(admin, data.id, operationId, context.userId, {
          calendar_sync_status: "not_connected",
          gcal_event_id: null,
          gcal_event_owner_id: null,
          gcal_html_link: null,
        });
        return { ok: true, calendarRestored: false, warning: "Set restored, but the owner has no connected Google Calendar." };
      }
      const committed = await finishCalendarSync(admin, data.id, operationId, context.userId, {
        calendar_sync_status: "synced",
        gcal_event_id: created.value.id,
        gcal_event_owner_id: row.owner_id,
        gcal_html_link: created.value.htmlLink ?? null,
      });
      if (!committed) {
        await withFreshUserCalendar(row.owner_id, (token, calendarId) =>
          deleteCalendarEvent(token, calendarId, created.value.id));
        throw new Error("Set changed during Calendar restoration");
      }
      return { ok: true, calendarRestored: true };
    } catch (err) {
      console.error("[restoreSet] gcal insert failed:", err);
      await failCalendarSync(admin, data.id, operationId, context.userId, "Google Calendar event could not be restored.");
      return { ok: true, calendarRestored: false, warning: "Set restored, but Google Calendar needs attention." };
    }
  });

/** Give a claimed set back to the pool (owner or admin/founder). Removes the
 *  previous owner's calendar event. */
export const unclaimSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const roles = await requireSetOperationsAccess(context);
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    const elevated = ["admin", "founder", "cofounder", "closer"].some((role) => roles.has(role));
    if (!row.owner_id && !row.gcal_event_id) return { ok: true, calendar: true };
    if (row.owner_id !== context.userId && !elevated) {
      throw new Error("Only the owner or a sales leader can unclaim this set");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as CalendarSyncAdmin;
    const operationId = randomUUID();
    let transition = admin.from("set_reminders")
      .update({
        owner_id: null,
        calendar_sync_status: "pending",
        calendar_sync_error: null,
        calendar_sync_token: operationId,
        transition_actor_id: context.userId,
      })
      .eq("id", data.id);
    transition = row.owner_id
      ? transition.eq("owner_id", row.owner_id)
      : transition.is("owner_id", null);
    const { data: moved, error: upErr } = await transition.select("id").maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (!moved) throw new Error("Set ownership changed. Refresh and try again.");

    const calendarOwnerId = row.gcal_event_owner_id ?? row.owner_id;
    if (row.gcal_event_id) {
      if (!calendarOwnerId) {
        await failCalendarSync(admin, data.id, operationId, context.userId, "Calendar event owner is unknown.");
        return { ok: true, calendar: false, warning: "Set unclaimed, but Calendar cleanup needs attention." };
      }
      try {
        const removed = await withFreshUserCalendar(calendarOwnerId, async (token, calendarId) => {
          await deleteCalendarEvent(token, calendarId, row.gcal_event_id);
          return true;
        });
        if (!removed.connected) {
          await failCalendarSync(admin, data.id, operationId, context.userId, "Calendar owner is not connected.");
          return { ok: true, calendar: false, warning: "Set unclaimed, but the old Calendar event could not be reached." };
        }
      } catch (err) {
        console.error("[unclaimSet] gcal delete failed:", err);
        await failCalendarSync(admin, data.id, operationId, context.userId, "Old Google Calendar event could not be removed.");
        return { ok: true, calendar: false, warning: "Set unclaimed, but Calendar cleanup needs attention." };
      }
    }

    await finishCalendarSync(admin, data.id, operationId, context.userId, {
      calendar_sync_status: "synced",
      gcal_event_id: null,
      gcal_event_owner_id: null,
      gcal_html_link: null,
    });
    return { ok: true, calendar: true };
  });

/** Assign a set to a specific setter (admin/founder, or the current owner
 *  handing it off). Moves the calendar event to the new owner. */
export const assignSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; userId: string }) => data)
  .handler(async ({ context, data }) => {
    const roles = await requireSetOperationsAccess(context);
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    const elevated = ["admin", "founder", "cofounder", "closer"].some((role) => roles.has(role));
    if (!elevated && row.owner_id !== context.userId) throw new Error("Only an admin or the current owner can assign");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: targetProfile }, { data: targetRoles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").eq("id", data.userId).eq("is_demo", false).eq("active", true).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
    ]);
    const targetCanOwnSets = (targetRoles ?? []).some((entry) => ["setter", "closer", "admin"].includes(entry.role));
    if (!targetProfile || !targetCanOwnSets) throw new Error("Sets can only be assigned to an active real sales profile");

    if (
      row.owner_id === data.userId
      && row.calendar_sync_status === "synced"
      && (!row.gcal_event_id || row.gcal_event_owner_id === data.userId)
    ) {
      return { ok: true, calendar: Boolean(row.gcal_event_id) };
    }

    const admin = supabaseAdmin as CalendarSyncAdmin;
    const operationId = randomUUID();
    let transition = admin.from("set_reminders")
      .update({
        calendar_sync_status: "pending",
        calendar_sync_error: null,
        calendar_sync_token: operationId,
        transition_actor_id: context.userId,
      })
      .eq("id", data.id);
    transition = row.owner_id
      ? transition.eq("owner_id", row.owner_id)
      : transition.is("owner_id", null);
    const { data: moved, error: upErr } = await transition.select("id").maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (!moved) throw new Error("Set ownership changed. Refresh and try again.");

    const calendarOwnerId = row.gcal_event_owner_id ?? row.owner_id;
    if (row.gcal_event_id) {
      if (!calendarOwnerId) {
        await failCalendarSync(admin, data.id, operationId, context.userId, "Calendar event owner is unknown.");
        return { ok: false, calendar: false, warning: "Assignment was not changed because the old Calendar event owner is unknown." };
      }
      try {
        const removed = await withFreshUserCalendar(calendarOwnerId, async (token, calendarId) => {
          await deleteCalendarEvent(token, calendarId, row.gcal_event_id);
          return true;
        });
        if (!removed.connected) {
          await failCalendarSync(admin, data.id, operationId, context.userId, "Previous Calendar owner is not connected.");
          return { ok: false, calendar: false, warning: "Assignment was not changed because the old Calendar event could not be reached." };
        }
      } catch (err) {
        console.error("[assignSet] old gcal delete failed:", err);
        await failCalendarSync(admin, data.id, operationId, context.userId, "Old Google Calendar event could not be removed.");
        return { ok: false, calendar: false, warning: "Assignment was not changed because Calendar cleanup failed." };
      }
    }

    const { data: cleared, error: clearError } = await admin
      .from("set_reminders")
      .update({
        owner_id: data.userId,
        gcal_event_id: null,
        gcal_event_owner_id: null,
        gcal_html_link: null,
        transition_actor_id: context.userId,
      })
      .eq("id", data.id)
      .eq("calendar_sync_token", operationId)
      .select("id")
      .maybeSingle();
    if (clearError) throw new Error(clearError.message);
    if (!cleared) throw new Error("Set ownership changed during Calendar cleanup");

    try {
      const created = await withFreshUserCalendar(data.userId, (token, calendarId) =>
        insertCalendarEvent(token, calendarId, calendarEventInput(row)));
      if (!created.connected) {
        await finishCalendarSync(admin, data.id, operationId, context.userId, {
          calendar_sync_status: "not_connected",
        });
        return { ok: true, calendar: false, warning: "Set assigned, but the new owner has no connected Google Calendar." };
      }

      const committed = await finishCalendarSync(admin, data.id, operationId, context.userId, {
        calendar_sync_status: "synced",
        gcal_event_id: created.value.id,
        gcal_event_owner_id: data.userId,
        gcal_html_link: created.value.htmlLink ?? null,
      });
      if (!committed) {
        await withFreshUserCalendar(data.userId, (token, calendarId) =>
          deleteCalendarEvent(token, calendarId, created.value.id));
        throw new Error("Set ownership changed during Calendar creation");
      }
      return { ok: true, calendar: true };
    } catch (err) {
      console.error("[assignSet] gcal insert failed:", err);
      await failCalendarSync(admin, data.id, operationId, context.userId, "Google Calendar event could not be created.");
      return { ok: true, calendar: false, warning: "Set assigned, but Google Calendar needs attention." };
    }
  });
