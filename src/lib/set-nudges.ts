import { supabase } from "@/integrations/supabase/client";

export type SetNudge = { id: string; prospect: string; event_start: string; window: string };

const SET_WINDOWS: { key: string; minutes: number }[] = [
  { key: "48h", minutes: 48 * 60 },
  { key: "24h", minutes: 24 * 60 },
  { key: "3h", minutes: 3 * 60 },
  { key: "1h", minutes: 60 },
];

/**
 * The signed-in user's claimed sets that need action right now: an open,
 * unticked reminder window (48h/24h/3h/1h), or — for sets further out —
 * today's keep-warm touch not yet logged.
 */
export async function fetchSetNudges(userId: string): Promise<SetNudge[]> {
  const { data } = await supabase
    .from("set_reminders")
    .select("id, prospect, event_start, reminder_log, confirmed_at, status")
    .eq("owner_id", userId)
    .eq("status", "active")
    .gte("event_start", new Date().toISOString())
    .order("event_start")
    .limit(30);
  const now = Date.now();
  const todayKey = "warm:" + new Intl.DateTimeFormat("en-CA").format(new Date());
  const out: SetNudge[] = [];

  for (const r of (data ?? []) as any[]) {
    const msLeft = new Date(r.event_start).getTime() - now;
    const log = (r.reminder_log ?? {}) as Record<string, string>;
    const due = SET_WINDOWS.filter(w => msLeft <= w.minutes * 60_000 && !log[w.key]);
    if (due.length) {
      out.push({ id: r.id, prospect: r.prospect, event_start: r.event_start, window: due[due.length - 1].key });
    } else if (msLeft > 48 * 3_600_000 && !log[todayKey]) {
      const days = Math.round(msLeft / 86_400_000);
      out.push({ id: r.id, prospect: r.prospect, event_start: r.event_start, window: `keep warm · call in ${days}d` });
    }
  }
  return out;
}

export type UnclaimedSet = { id: string; prospect: string; event_start: string };

/** Closing calls nobody has claimed yet — every setter gets pinged until one takes it. */
export async function fetchUnclaimedSets(): Promise<UnclaimedSet[]> {
  const { data } = await supabase
    .from("set_reminders")
    .select("id, prospect, event_start")
    .is("owner_id", null)
    .eq("status", "active")
    .gte("event_start", new Date().toISOString())
    .order("event_start")
    .limit(20);
  return ((data ?? []) as UnclaimedSet[]);
}
