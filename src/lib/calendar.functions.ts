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
  type GCalEvent,
} from "@/lib/calendar.server";
import { randomBytes } from "crypto";

/** Return Google OAuth authorize URL for the signed-in user. */
export const startGoogleCalendarAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
    const { data } = await context.supabase
      .from("calendar_connections")
      .select("id, google_email, calendar_id, color_hex, connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

/** Team-wide list: everyone connected + their color + display name. Any signed-in user can read. */
export const getTeamCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conns } = await supabaseAdmin
      .from("calendar_connections")
      .select("user_id, google_email, color_hex, connected_at");
    if (!conns) return [];
    const ids = conns.map((c) => c.user_id);
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    return conns.map((c) => ({
      user_id: c.user_id,
      email: c.google_email,
      color: c.color_hex,
      connected_at: c.connected_at,
      display_name: pmap.get(c.user_id)?.display_name ?? "Unknown",
      avatar_url: pmap.get(c.user_id)?.avatar_url ?? null,
    }));
  });

export const disconnectMyCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
  .inputValidator((data: { timeMin: string; timeMax: string }) => data)
  .handler(async ({ data }) => {
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
      .in("id", ids);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Unknown"]));

    const now = Date.now();

    // One Google round-trip per member, all in parallel — the page used to
    // wait for each member's calendar sequentially.
    const perUser = await Promise.all(conns.map(async (c): Promise<TeamEvent[]> => {
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
  .inputValidator((data: {
    prospect: string; startISO: string; durationMin: number; notes?: string;
    source?: "manual" | "claimed";
  }) => data)
  .handler(async ({ context, data }) => {
    const { data: conn } = await context.supabase
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
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("calendar_connections")
        .update({ access_token: accessToken, access_token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() })
        .eq("id", conn.id);
    }

    const start = new Date(data.startISO);
    const end = new Date(start.getTime() + Math.max(15, data.durationMin) * 60_000);
    const event = await insertCalendarEvent(accessToken!, conn.calendar_id, {
      summary: `Set: ${data.prospect}`,
      description: [data.notes, "Reminders: 2 days · 1 day · 3 hours · 1 hour before. Confirm, remind, call, follow up."]
        .filter(Boolean)
        .join("\n\n"),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      reminderMinutes: SET_REMINDER_MINUTES,
    });

    // Track it for the upcoming-sets list (RLS: owner must be the caller)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (context.supabase as any).from("set_reminders").insert({
      owner_id: context.userId,
      prospect: data.prospect,
      event_start: start.toISOString(),
      duration_min: Math.max(15, data.durationMin),
      notes: data.notes ?? null,
      source: data.source ?? "manual",
      gcal_event_id: event.id,
      gcal_html_link: event.htmlLink ?? null,
    });
    if (insErr) console.error("[set_reminders] insert failed:", insErr.message);

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
  reminder_log: Partial<Record<"48h" | "24h" | "3h" | "1h", "reminded" | "no_response">>;
  confirmed_at: string | null;
  status: "active" | "cancelled" | "completed";
};

/** Upcoming sets across the sales team, soonest first. */
export const listUpcomingSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (context.supabase as any)
      .from("set_reminders")
      .select("*")
      .gte("event_start", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("event_start", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set(((rows ?? []) as { owner_id: string | null }[]).map((r) => r.owner_id).filter((x): x is string => !!x)));
    const { data: profs } = ids.length
      ? await context.supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const pmap = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Unknown"]));
    return ((rows ?? []) as Omit<UpcomingSet, "owner_name">[]).map((r) => ({
      ...r,
      owner_name: r.owner_id ? (pmap.get(r.owner_id) ?? "Unknown") : "Unclaimed",
    })) as UpcomingSet[];
  });

/** Remove a set reminder row (own or admin; the calendar event stays). */
export const deleteSetReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).from("set_reminders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Calendly ────────────────────────────────────────────────────────────────

/**
 * Only bookings made through the closing-call link are sets (founder-confirmed
 * 2026-07-14): the shared link resolves to the "1-on-1 Pathway Onboarding"
 * event type, one per host. Coaching/advisor/application calls never import.
 */
const CLOSING_CALL_LINK = "https://calendly.com/d/d3f3-7pm-z9r/1-on-1-pathway-onboarding";

/**
 * Pull upcoming Calendly CLOSING-CALL bookings into set_reminders as
 * UNCLAIMED sets. No-ops quietly when CALENDLY_API_KEY is absent. Dedupes on
 * the event URI. Fails closed: if the closing event type can't be resolved
 * (renamed/deleted), nothing imports rather than importing coaching calls.
 */
export const syncCalendlySets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
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
    const closingNames = new Set(direct.map((t) => t.name));
    const closingTypes = new Set(
      etJson.collection.filter((t) => closingNames.has(t.name)).map((t) => t.uri),
    );
    if (closingTypes.size === 0) return { ok: false, imported: 0, reason: "closing-type-not-found" };

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
    const evJson = { collection: evAll.collection.filter((ev) => closingTypes.has(ev.event_type)) };

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Claim an unclaimed (Calendly) set: takes ownership and puts the call on the
 * claimer's Google Calendar with the standard reminder cadence.
 */
export const claimSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    if (row.owner_id) throw new Error("already claimed");

    // RLS "claim unclaimed" policy enforces the caller may take it
    const { error: upErr } = await sr
      .from("set_reminders")
      .update({ owner_id: context.userId })
      .eq("id", data.id)
      .is("owner_id", null);
    if (upErr) throw new Error(upErr.message);

    // Best effort: put it on the claimer's calendar with reminders
    const { data: conn } = await context.supabase
      .from("calendar_connections").select("*").eq("user_id", context.userId).maybeSingle();
    if (!conn) return { ok: true, calendar: false };
    try {
      let accessToken = conn.access_token as string | null;
      const exp = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
      if (!accessToken || exp - 60_000 < Date.now()) {
        const r = await refreshAccessToken(conn.refresh_token);
        accessToken = r.access_token;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("calendar_connections")
          .update({ access_token: accessToken, access_token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() })
          .eq("id", conn.id);
      }
      const start = new Date(row.event_start);
      const end = new Date(start.getTime() + row.duration_min * 60_000);
      const event = await insertCalendarEvent(accessToken!, conn.calendar_id, {
        summary: `Set: ${row.prospect}`,
        description: [row.notes, "Reminders: 2 days · 1 day · 3 hours · 1 hour before. Confirm, remind, call, follow up."].filter(Boolean).join("\n\n"),
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        reminderMinutes: SET_REMINDER_MINUTES,
      });
      {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any).from("set_reminders")
          .update({ gcal_event_id: event.id, gcal_html_link: event.htmlLink ?? null })
          .eq("id", data.id);
      }
      return { ok: true, calendar: true, htmlLink: event.htmlLink ?? null };
    } catch (err) {
      console.error("[claimSet] calendar event failed:", err);
      return { ok: true, calendar: false };
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
  .inputValidator((data: { id: string; window?: ReminderWindow | string; state?: ReminderState | null; confirm?: boolean; notes?: string }) => data)
  .handler(async ({ context, data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const { error: upErr } = await sr.from("set_reminders").update(patch).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/**
 * Cancel a set (unconfirmed by the 6-hour cutoff, or manually): marks the row
 * cancelled and best-effort removes the claimer's Google Calendar event so
 * the hour opens back up.
 */
export const cancelSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; reason?: string }) => data)
  .handler(async ({ context, data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");

    const { error: upErr } = await sr.from("set_reminders").update({
      status: "cancelled",
      notes: [row.notes, data.reason ? `Cancelled: ${data.reason}` : "Cancelled — lead did not confirm"].filter(Boolean).join("\n"),
    }).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    // Best effort: remove from the claimer's Google Calendar
    if (row.owner_id && row.gcal_event_id) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await supabaseAdmin
          .from("calendar_connections").select("*").eq("user_id", row.owner_id).maybeSingle();
        if (conn) {
          let accessToken = conn.access_token as string | null;
          const exp = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
          if (!accessToken || exp - 60_000 < Date.now()) {
            const r = await refreshAccessToken(conn.refresh_token);
            accessToken = r.access_token;
            await supabaseAdmin.from("calendar_connections")
              .update({ access_token: accessToken, access_token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() })
              .eq("id", conn.id);
          }
          const { deleteCalendarEvent } = await import("@/lib/calendar.server");
          await deleteCalendarEvent(accessToken!, conn.calendar_id, row.gcal_event_id);
          return { ok: true, calendarRemoved: true };
        }
      } catch (err) {
        console.error("[cancelSet] gcal delete failed:", err);
      }
    }
    return { ok: true, calendarRemoved: false };
  });

/** Undo a cancellation: reactivate the set and re-create the claimer's
 *  Google Calendar event (with the standard reminder schedule). */
export const restoreSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    if (row.status !== "cancelled") throw new Error("set is not cancelled");

    const { error: upErr } = await sr.from("set_reminders").update({
      status: "active",
      notes: [row.notes, "Restored"].filter(Boolean).join("\n"),
    }).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    // Recreate the calendar event on the claimer's calendar (best effort)
    if (row.owner_id) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await supabaseAdmin
          .from("calendar_connections").select("*").eq("user_id", row.owner_id).maybeSingle();
        if (conn) {
          let accessToken = conn.access_token as string | null;
          const exp = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
          if (!accessToken || exp - 60_000 < Date.now()) {
            const r = await refreshAccessToken(conn.refresh_token);
            accessToken = r.access_token;
            await supabaseAdmin.from("calendar_connections")
              .update({ access_token: accessToken, access_token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() })
              .eq("id", conn.id);
          }
          const start = new Date(row.event_start);
          const end = new Date(start.getTime() + row.duration_min * 60_000);
          const event = await insertCalendarEvent(accessToken!, conn.calendar_id, {
            summary: `Set: ${row.prospect}`,
            description: [row.notes, "Reminders: 2 days · 1 day · 3 hours · 1 hour before."].filter(Boolean).join("\n\n"),
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            reminderMinutes: SET_REMINDER_MINUTES,
          });
          await (supabaseAdmin as any).from("set_reminders")
            .update({ gcal_event_id: event.id, gcal_html_link: event.htmlLink ?? null })
            .eq("id", data.id);
          return { ok: true, calendarRestored: true };
        }
      } catch (err) {
        console.error("[restoreSet] gcal insert failed:", err);
      }
    }
    return { ok: true, calendarRestored: false };
  });

// Internal: run a Google Calendar operation with a user's fresh access token.
async function withUserCalendar<T>(
  ownerId: string,
  fn: (accessToken: string, calendarId: string) => Promise<T>,
): Promise<T | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn } = await supabaseAdmin
    .from("calendar_connections").select("*").eq("user_id", ownerId).maybeSingle();
  if (!conn) return null;
  let accessToken = conn.access_token as string | null;
  const exp = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
  if (!accessToken || exp - 60_000 < Date.now()) {
    const r = await refreshAccessToken(conn.refresh_token);
    accessToken = r.access_token;
    await supabaseAdmin.from("calendar_connections")
      .update({ access_token: accessToken, access_token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() })
      .eq("id", conn.id);
  }
  return fn(accessToken!, conn.calendar_id);
}

/** Give a claimed set back to the pool (owner or admin/founder). Removes the
 *  previous owner's calendar event. */
export const unclaimSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    if (!row.owner_id) return { ok: true };
    const { data: myRoles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const elevated = (myRoles ?? []).some(r => r.role === "admin" || r.role === "founder");
    if (row.owner_id !== context.userId && !elevated) throw new Error("Only the owner or an admin can unclaim");

    if (row.gcal_event_id) {
      try {
        const { deleteCalendarEvent } = await import("@/lib/calendar.server");
        await withUserCalendar(row.owner_id, (t, cal) => deleteCalendarEvent(t, cal, row.gcal_event_id));
      } catch (err) { console.error("[unclaimSet] gcal delete failed:", err); }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabaseAdmin as any).from("set_reminders")
      .update({ owner_id: null, gcal_event_id: null, gcal_html_link: null })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/** Assign a set to a specific setter (admin/founder, or the current owner
 *  handing it off). Moves the calendar event to the new owner. */
export const assignSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; userId: string }) => data)
  .handler(async ({ context, data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sr = context.supabase as any;
    const { data: row, error } = await sr.from("set_reminders").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("set not found");
    const { data: myRoles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const elevated = (myRoles ?? []).some(r => r.role === "admin" || r.role === "founder");
    if (!elevated && row.owner_id !== context.userId) throw new Error("Only an admin or the current owner can assign");

    // remove from the previous owner's calendar
    if (row.owner_id && row.owner_id !== data.userId && row.gcal_event_id) {
      try {
        const { deleteCalendarEvent } = await import("@/lib/calendar.server");
        await withUserCalendar(row.owner_id, (t, cal) => deleteCalendarEvent(t, cal, row.gcal_event_id));
      } catch (err) { console.error("[assignSet] old gcal delete failed:", err); }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { error: upErr } = await admin.from("set_reminders")
      .update({ owner_id: data.userId, gcal_event_id: null, gcal_html_link: null })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    // create the event on the new owner's calendar (best effort)
    try {
      const start = new Date(row.event_start);
      const end = new Date(start.getTime() + row.duration_min * 60_000);
      const event = await withUserCalendar(data.userId, (t, cal) =>
        insertCalendarEvent(t, cal, {
          summary: `Set: ${row.prospect}`,
          description: [row.notes, "Reminders: 2 days · 1 day · 3 hours · 1 hour before."].filter(Boolean).join("\n\n"),
          startISO: start.toISOString(),
          endISO: end.toISOString(),
          reminderMinutes: SET_REMINDER_MINUTES,
        }));
      if (event) {
        await admin.from("set_reminders")
          .update({ gcal_event_id: event.id, gcal_html_link: event.htmlLink ?? null })
          .eq("id", data.id);
        return { ok: true, calendar: true };
      }
    } catch (err) { console.error("[assignSet] gcal insert failed:", err); }
    return { ok: true, calendar: false };
  });
