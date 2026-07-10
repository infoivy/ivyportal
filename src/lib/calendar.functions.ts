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
    const events: TeamEvent[] = [];

    for (const c of conns) {
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
        for (const it of items) {
          const startStr = it.start?.dateTime ?? it.start?.date;
          const endStr = it.end?.dateTime ?? it.end?.date;
          if (!startStr || !endStr) continue;
          if (it.status === "cancelled") continue;
          events.push({
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
      } catch (err) {
        console.error(`[calendar] user ${c.user_id} fetch failed:`, err);
      }
    }
    events.sort((a, b) => a.start.localeCompare(b.start));
    return events;
  });

/**
 * Set reminder: creates the booked call on the setter's own Google Calendar
 * with popup reminders 3 days, 1 day, and 3 hours before — so the prospect
 * gets reminded, called, and followed up with before the call.
 */
export const createSetReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prospect: string; startISO: string; durationMin: number; notes?: string }) => data)
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
      description: [data.notes, "Reminders: 3 days · 1 day · 3 hours before. Confirm, call, follow up."]
        .filter(Boolean)
        .join("\n\n"),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      reminderMinutes: [3 * 24 * 60, 24 * 60, 3 * 60],
    });
    return { ok: true, htmlLink: event.htmlLink ?? null };
  });
