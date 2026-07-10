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
 * Pull upcoming Calendly bookings into set_reminders as UNCLAIMED sets.
 * No-ops quietly when CALENDLY_API_KEY is absent. Dedupes on the event URI.
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

    const params = new URLSearchParams({
      organization: me.resource.current_organization,
      status: "active",
      min_start_time: new Date().toISOString(),
      count: "50",
      sort: "start_time:asc",
    });
    const evRes = await fetch(`https://api.calendly.com/scheduled_events?${params}`, { headers: H });
    if (!evRes.ok) return { ok: false, imported: 0, reason: `calendly-events-${evRes.status}` };
    const evJson = (await evRes.json()) as {
      collection: { uri: string; name: string; start_time: string; end_time: string }[];
    };

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
