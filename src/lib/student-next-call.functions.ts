import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The student's next booked 1:1, straight from the coaches'/closers' connected
 * Google calendars (founder-directed 2026-07-25): if the student is an
 * attendee on an upcoming event — Calendly coaching bookings land there —
 * that beats whatever was hand-logged in student_calls. Falls back to null;
 * the portal then uses the coach-logged next_call_date as before.
 */
export const getStudentNextCall = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshAccessToken, listCalendarEvents } = await import("@/lib/calendar.server");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, full_name, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!student) return { event: null };

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const emails = new Set(
      [student.email, authUser?.user?.email].filter(Boolean).map((e) => (e as string).toLowerCase()),
    );
    const nameLc = student.full_name.trim().toLowerCase();

    const { data: conns } = await supabaseAdmin.from("calendar_connections").select("*");
    if (!conns?.length) return { event: null };

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 45 * 86400000).toISOString();

    type Hit = { start: string; summary: string; meet_link: string | null; host_id: string };
    const perConn = await Promise.all(conns.map(async (c): Promise<Hit[]> => {
      try {
        let accessToken = c.access_token as string | null;
        const exp = c.access_token_expires_at ? new Date(c.access_token_expires_at).getTime() : 0;
        if (!accessToken || exp - 60_000 < now.getTime()) {
          const r = await refreshAccessToken(c.refresh_token);
          accessToken = r.access_token;
          await supabaseAdmin.from("calendar_connections").update({
            access_token: accessToken,
            access_token_expires_at: new Date(now.getTime() + r.expires_in * 1000).toISOString(),
          }).eq("id", c.id);
        }
        const items = await listCalendarEvents(accessToken!, c.calendar_id, timeMin, timeMax);
        const hits: Hit[] = [];
        for (const it of items as Array<Record<string, any>>) {
          if (it.status === "cancelled") continue;
          const start = it.start?.dateTime ?? null; // all-day events are not calls
          if (!start) continue;
          const attendeeMatch = Array.isArray(it.attendees)
            && it.attendees.some((a: { email?: string }) => a.email && emails.has(a.email.toLowerCase()));
          const nameMatch = typeof it.summary === "string" && nameLc.length > 4
            && it.summary.toLowerCase().includes(nameLc);
          if (!attendeeMatch && !nameMatch) continue;
          hits.push({
            start: new Date(start).toISOString(),
            summary: it.summary ?? "1:1 call",
            meet_link: it.hangoutLink ?? null,
            host_id: c.user_id,
          });
        }
        return hits;
      } catch {
        return [];
      }
    }));

    const all = perConn.flat().sort((a, b) => a.start.localeCompare(b.start));
    const next = all[0] ?? null;
    if (!next) return { event: null };

    const { data: host } = await supabaseAdmin
      .from("profiles").select("display_name").eq("id", next.host_id).maybeSingle();
    return { event: { start: next.start, summary: next.summary, meet_link: next.meet_link, with: host?.display_name ?? null } };
  });
