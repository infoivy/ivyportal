import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  Activity, Calendar, CheckCircle2, FileText, Footprints, ListChecks,
  MessageSquare, Phone, PlayCircle, Briefcase, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyPastDay } from "@/lib/dates";

/**
 * Every touchpoint this student has with the business, in one stream
 * (founder-asked 2026-08-09: "who has access, at what time, what happened,
 * how many touch points"). Derived from the tables that already record
 * timestamps, plus portal_activity presence rows (tracked since Aug 2026).
 */

type Ev = { at: string; label: string; icon: "eod" | "weekly" | "tick" | "step" | "item" | "checkin" | "note" | "call" | "placement" | "presence" };

const ICONS: Record<Ev["icon"], React.ReactNode> = {
  eod: <FileText className="h-3 w-3" />,
  weekly: <Calendar className="h-3 w-3" />,
  tick: <CheckCircle2 className="h-3 w-3" />,
  step: <Footprints className="h-3 w-3" />,
  item: <ListChecks className="h-3 w-3" />,
  checkin: <MessageSquare className="h-3 w-3" />,
  note: <MessageSquare className="h-3 w-3" />,
  call: <Phone className="h-3 w-3" />,
  placement: <Briefcase className="h-3 w-3" />,
  presence: <Eye className="h-3 w-3" />,
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function useStudentActivity(studentId: string, userId: string | null) {
  return useQuery({
    queryKey: ["page", "student", "activity", studentId],
    staleTime: 60_000,
    queryFn: async () => {
      const sinceTs = subDays(new Date(), 30).toISOString();
      const sinceDay = iso(subDays(new Date(), 30));
      const sb = supabase as any;
      // Individual failures (RLS varies by role) degrade to empty, never break the card.
      const q = async <T,>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
        try { return ((await p).data ?? []) as T[]; } catch { return []; }
      };
      const [eods, weekly, ticks, steps, items, checkins, notes, calls, placements, presence] = await Promise.all([
        q<{ report_date: string; created_at: string | null; roleplays: number | null; looms_sent: number | null; applications_submitted: number | null }>(
          sb.from("student_eods").select("report_date, created_at, roleplays, looms_sent, applications_submitted").eq("student_id", studentId).gte("report_date", sinceDay)),
        q<{ week_start: string; submitted_at: string }>(
          sb.from("student_weekly_eods").select("week_start, submitted_at").eq("student_id", studentId).gte("submitted_at", sinceTs)),
        q<{ day: string; name: string; ticked_at: string }>(
          sb.from("student_call_attendance").select("day, name, ticked_at").eq("student_id", studentId).gte("ticked_at", sinceTs)),
        q<{ step_key: string; done_at: string }>(
          sb.from("student_guide_steps").select("step_key, done_at").eq("student_id", studentId)),
        q<{ text: string; done_at: string | null }>(
          sb.from("student_action_items").select("text, done_at").eq("student_id", studentId).eq("done", true).gte("done_at", sinceTs)),
        q<{ checked_at: string; csm_id: string | null }>(
          sb.from("student_checkins").select("checked_at, csm_id").eq("student_id", studentId).gte("checked_at", sinceTs)),
        q<{ created_at: string; user_id: string }>(
          sb.from("csm_student_notes").select("created_at, user_id").eq("student_id", studentId).gte("created_at", sinceTs)),
        q<{ call_date: string; status: string | null; created_at: string }>(
          sb.from("student_calls").select("call_date, status, created_at").eq("student_id", studentId).is("voided_at", null).gte("created_at", sinceTs)),
        q<{ created_at: string; business_name: string; stage: string | null }>(
          sb.from("student_placements").select("created_at, business_name, stage").eq("student_id", studentId).is("voided_at", null).gte("created_at", sinceTs)),
        userId
          ? q<{ day: string; first_seen_at: string; last_seen_at: string; pings: number; opens: number | null }>(
              sb.from("portal_activity").select("day, first_seen_at, last_seen_at, pings, opens").eq("user_id", userId).gte("day", sinceDay))
          : Promise.resolve([] as { day: string; first_seen_at: string; last_seen_at: string; pings: number; opens: number | null }[]),
      ]);

      // Staff names for check-ins/notes
      const staffIds = Array.from(new Set([
        ...checkins.map(c => c.csm_id).filter(Boolean) as string[],
        ...notes.map(n => n.user_id),
      ]));
      const staffNames = new Map<string, string>();
      if (staffIds.length) {
        const profs = await q<{ id: string; display_name: string | null }>(
          sb.from("profiles").select("id, display_name").in("id", staffIds));
        profs.forEach(p => staffNames.set(p.id, p.display_name ?? "staff"));
      }

      const events: Ev[] = [];
      for (const e of eods) {
        const nums = `${e.roleplays ?? 0} roleplays · ${e.looms_sent ?? 0} looms · ${e.applications_submitted ?? 0} apps`;
        events.push({ at: e.created_at ?? `${e.report_date}T12:00:00Z`, label: `Filed their daily EOD (${nums})`, icon: "eod" });
      }
      for (const w of weekly) events.push({ at: w.submitted_at, label: "Filed their weekly EOD", icon: "weekly" });
      for (const t of ticks) events.push({ at: t.ticked_at, label: `Ticked attendance: ${t.name} (${t.day})`, icon: "tick" });
      for (const s of steps) if (s.done_at >= sinceTs) events.push({ at: s.done_at, label: `Completed Start Here step: ${s.step_key.replace(/_/g, " ")}`, icon: "step" });
      for (const i of items) if (i.done_at) events.push({ at: i.done_at, label: `Finished action item: ${i.text.slice(0, 60)}${i.text.length > 60 ? "…" : ""}`, icon: "item" });
      for (const c of checkins) events.push({ at: c.checked_at, label: `CSM check-in${c.csm_id ? ` by ${staffNames.get(c.csm_id) ?? "staff"}` : ""}`, icon: "checkin" });
      for (const n of notes) events.push({ at: n.created_at, label: `CSM note added by ${staffNames.get(n.user_id) ?? "staff"}`, icon: "note" });
      for (const c of calls) events.push({ at: c.created_at, label: `1:1 call logged (${c.status ?? "scheduled"} · ${c.call_date})`, icon: "call" });
      for (const p of placements) events.push({ at: p.created_at, label: `Placement opportunity: ${p.business_name}${p.stage ? ` (${p.stage})` : ""}`, icon: "placement" });
      events.sort((a, b) => b.at.localeCompare(a.at));

      return { events, presence };
    },
  });
}

export function StudentActivityCard({ studentId, userId, timezone }: {
  studentId: string;
  userId: string | null;
  timezone: string | null;
}) {
  const q = useStudentActivity(studentId, userId);
  const d = q.data;

  const stats = useMemo(() => {
    if (!d) return null;
    const now = Date.now();
    const cutoff7 = new Date(now - 7 * 86400000).toISOString();
    const touch30 = d.events.length;
    const touch7 = d.events.filter(e => e.at >= cutoff7).length;
    // Last seen: real presence beats derived touchpoints.
    const lastPresence = d.presence.map(p => p.last_seen_at).sort().at(-1) ?? null;
    const lastTouch = d.events[0]?.at ?? null;
    const lastSeen = lastPresence && (!lastTouch || lastPresence > lastTouch) ? lastPresence : lastTouch;
    // Typical hour: the mode of touchpoint hours in the student's timezone.
    const hourCounts = new Map<number, number>();
    const hourIn = (ts: string) => {
      try {
        return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone ?? undefined }).format(new Date(ts)));
      } catch { return new Date(ts).getHours(); }
    };
    d.events.forEach(e => { const h = hourIn(e.at); hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1); });
    const topHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    // Days-in-portal (presence) this month
    const presenceDays = d.presence.length;
    const totalMinutes = d.presence.reduce((acc, p) => acc + Math.max(0, (new Date(p.last_seen_at).getTime() - new Date(p.first_seen_at).getTime()) / 60000), 0);
    // Per-day intensity for the dot strip (their local day)
    const dayOf = (ts: string) => {
      try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone ?? undefined }).format(new Date(ts)); }
      catch { return ts.slice(0, 10); }
    };
    const perDay = new Map<string, number>();
    d.events.forEach(e => { const k = dayOf(e.at); perDay.set(k, (perDay.get(k) ?? 0) + 1); });
    type Presence = (typeof d.presence)[number];
    const presenceMap = new Map<string, Presence>(d.presence.map(p => [p.day, p]));
    const days: { key: string; count: number; presence: Presence | null }[] = [];
    for (let i = 29; i >= 0; i--) {
      const key = iso(subDays(new Date(), i));
      days.push({ key, count: perDay.get(key) ?? 0, presence: presenceMap.get(key) ?? null });
    }
    const portalDays = [...d.presence].sort((a, b) => b.day.localeCompare(a.day));
    return { touch7, touch30, lastSeen, topHour, presenceDays, totalMinutes, days, portalDays };
  }, [d, timezone]);

  const fmtClock = (ts: string) => {
    try {
      return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone ?? undefined }).format(new Date(ts));
    } catch {
      return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
  };
  const fmtWhen = (ts: string) => `${friendlyPastDay(ts)} · ${fmtClock(ts)}${timezone ? " their time" : ""}`;
  const fmtSpan = (mins: number) => (mins < 60 ? `${Math.max(1, Math.round(mins))}m` : `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`);

  if (q.isLoading) return null;
  if (!d || !stats) return null;

  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3 w-3 text-primary" /> Activity & touchpoints · last 30 days
          </div>
          <p className="text-[12px] text-muted-foreground mt-1.5">
            {stats.lastSeen
              ? <>Last activity <span className="text-foreground font-medium">{fmtWhen(stats.lastSeen)}</span></>
              : "No recorded activity in the last 30 days."}
            {stats.topHour != null && stats.touch30 >= 5 && (
              <> · usually active around <span className="text-foreground font-medium">{stats.topHour}:00{timezone ? " their time" : ""}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-lg font-semibold tabular-nums leading-none">{stats.touch7}</div>
            <div className="text-[10px] text-muted-foreground mt-1">touchpoints 7d</div>
          </div>
          <div>
            <div className="text-lg font-semibold tabular-nums leading-none">{stats.touch30}</div>
            <div className="text-[10px] text-muted-foreground mt-1">touchpoints 30d</div>
          </div>
          <div>
            <div className="text-lg font-semibold tabular-nums leading-none">{stats.presenceDays}</div>
            <div className="text-[10px] text-muted-foreground mt-1" title="Days with a portal session · tracked since Aug 2026">days in portal</div>
          </div>
        </div>
      </div>

      {/* 30-day dot strip: intensity = touchpoints; ring = they opened the portal that day */}
      <div className="flex items-end gap-[3px] mb-1" aria-label="Activity per day, last 30 days">
        {stats.days.map(day => {
          const intensity = day.count === 0 ? 0 : day.count <= 2 ? 1 : day.count <= 5 ? 2 : 3;
          const fill = ["bg-[var(--accent)]", "bg-primary/30", "bg-primary/60", "bg-primary"][intensity];
          const p = day.presence;
          const portalNote = p
            ? ` · opened the portal ${Math.max(1, p.opens ?? 0)}x (${fmtClock(p.first_seen_at)} to ${fmtClock(p.last_seen_at)})`
            : "";
          return (
            <div
              key={day.key}
              title={`${friendlyPastDay(day.key)} · ${day.count} touchpoint${day.count === 1 ? "" : "s"}${portalNote}`}
              className={`h-5 flex-1 min-w-[5px] rounded-[3px] ${fill} ${p ? "ring-1 ring-success/60" : ""}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mb-4">
        <span>30 days ago</span>
        <span>green ring = opened the portal that day (tracked since Aug 2026)</span>
        <span>today</span>
      </div>

      {/* Portal opens, day by day: how many times, first in, last seen, rough time inside */}
      {stats.portalDays.length > 0 && (
        <div className="mb-4 rounded-md border border-border bg-background p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">In the portal · day by day</div>
          <div className="max-h-40 overflow-y-auto divide-y divide-border/50">
            {stats.portalDays.slice(0, 14).map(p => {
              const activeMin = Math.max(0, (new Date(p.last_seen_at).getTime() - new Date(p.first_seen_at).getTime()) / 60000);
              return (
                <div key={p.day} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-[12px]">
                  <span className="w-24 shrink-0 text-foreground font-medium">{friendlyPastDay(p.day)}</span>
                  <span className="text-muted-foreground">opened <span className="text-foreground font-medium tabular-nums">{Math.max(1, p.opens ?? 0)}x</span></span>
                  <span className="text-muted-foreground">{fmtClock(p.first_seen_at)} to {fmtClock(p.last_seen_at)}{timezone ? " their time" : ""}</span>
                  <span className="text-muted-foreground ml-auto tabular-nums">{fmtSpan(activeMin)} span</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* The stream itself */}
      {d.events.length === 0 ? (
        <div className="py-4 text-center text-[11px] text-muted-foreground">Nothing recorded yet. As they file EODs, tick calls, and finish steps, everything shows up here.</div>
      ) : (
        <div className="max-h-64 overflow-y-auto -mx-1 px-1 divide-y divide-border/50">
          {d.events.slice(0, 80).map((e, i) => (
            <div key={`${e.at}-${i}`} className="flex items-center gap-2.5 py-1.5 text-[12px]">
              <span className="h-6 w-6 rounded-full bg-[var(--background)] border border-border flex items-center justify-center text-muted-foreground shrink-0">
                {ICONS[e.icon]}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{e.label}</span>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtWhen(e.at)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <PlayCircle className="h-3 w-3" />
        Portal opens are presence only: when they were in and for how long, never which pages.
      </div>
    </div>
  );
}
