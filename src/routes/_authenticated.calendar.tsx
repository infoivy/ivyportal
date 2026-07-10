import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek, subWeeks,
} from "date-fns";
import {
  CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Link2Off, Plus,
  RefreshCw, Users2, Video,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  disconnectMyCalendar, getMyCalendarConnection, getTeamCalendarEvents, createSetReminder,
  getTeamCalendarStatus, startGoogleCalendarAuth, type TeamEvent,
} from "@/lib/calendar.functions";

type ConnectStatus =
  | "ok" | "denied" | "missing" | "invalid_state" | "no_refresh" | "db_error" | "exchange_failed";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — ISA Team" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    connect: (s.connect as ConnectStatus | undefined) ?? undefined,
  }),
  component: CalendarPage,
});

const HOUR_START = 7;   // 7am
const HOUR_END = 22;    // 10pm
const HOUR_ROWS = HOUR_END - HOUR_START;
const ROW_PX = 44;

function CalendarPage() {
  const search = useSearch({ from: "/_authenticated/calendar" });
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
  const qc = useQueryClient();

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const myConnFn = useServerFn(getMyCalendarConnection);
  const teamStatusFn = useServerFn(getTeamCalendarStatus);
  const teamEventsFn = useServerFn(getTeamCalendarEvents);
  const startAuthFn = useServerFn(startGoogleCalendarAuth);
  const disconnectFn = useServerFn(disconnectMyCalendar);
  const setReminderFn = useServerFn(createSetReminder);
  const [setOpen, setSetOpen] = useState(false);

  const myConn = useQuery({ queryKey: ["cal", "me"], queryFn: () => myConnFn() });
  const team = useQuery({ queryKey: ["cal", "team"], queryFn: () => teamStatusFn() });
  const events = useQuery({
    queryKey: ["cal", "events", weekStart.toISOString()],
    queryFn: () => teamEventsFn({
      data: { timeMin: weekStart.toISOString(), timeMax: addDays(weekEnd, 1).toISOString() },
    }),
    staleTime: 30_000,
  });

  const connect = useMutation({
    mutationFn: () => startAuthFn(),
    onSuccess: (res) => { if (res?.url) window.location.href = res.url; },
    onError: (e: Error) => toast.error(e.message ?? "Could not start Google connect"),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      toast.success("Google Calendar disconnected");
      qc.invalidateQueries({ queryKey: ["cal"] });
    },
  });

  // Handle ?connect=<status> after OAuth redirect
  useEffect(() => {
    if (!search.connect) return;
    const s = search.connect;
    if (s === "ok") {
      toast.success("Google Calendar connected");
      qc.invalidateQueries({ queryKey: ["cal"] });
    } else if (s === "denied") toast.info("Google sign-in cancelled");
    else if (s === "no_refresh") toast.error("Google didn't return a refresh token. Revoke access in your Google account and reconnect.");
    else toast.error(`Connect failed: ${s.replace(/_/g, " ")}`);
    // clean the URL
    const url = new URL(window.location.href);
    url.searchParams.delete("connect");
    window.history.replaceState({}, "", url.toString());
  }, [search.connect, qc]);

  const teamList = team.data ?? [];
  const visibleEvents = (events.data ?? []).filter((e) => !hiddenUsers.has(e.user_id));

  const toggleUser = (uid: string) => {
    setHiddenUsers((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)" }}>
              <CalendarClock className="h-5 w-5" style={{ color: "#3b82f6" }} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Team Calendar</h1>
              <p className="text-sm text-muted-foreground">Unified view of every closer's booked calls.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {myConn.data ? (
              <>
                <Button size="sm" onClick={() => setSetOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Log a set
                </Button>
                <Badge variant="outline" className="gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: myConn.data.color_hex }} />
                  {myConn.data.google_email ?? "Connected"}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                  <Link2Off className="h-4 w-4 mr-1.5" /> Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
                <GoogleIcon className="h-4 w-4 mr-2" />
                {connect.isPending ? "Redirecting…" : "Connect Google Calendar"}
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => events.refetch()} title="Refresh">
              <RefreshCw className={`h-4 w-4 ${events.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Connected team + filters */}
        <Card className="p-4 border-border/60">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Users2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground shrink-0">Connected:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {teamList.length === 0 && (
                  <span className="text-sm text-muted-foreground">No one has connected yet.</span>
                )}
                {teamList.map((m) => {
                  const hidden = hiddenUsers.has(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => toggleUser(m.user_id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                        hidden ? "opacity-40 border-border" : "border-border/80 bg-muted/40"
                      }`}
                      title={hidden ? "Show" : "Hide"}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                      <span className="font-medium">{m.display_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Today
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </Card>

        {/* Week grid */}
        <Card className="p-0 border-border/60 overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, minmax(0, 1fr))" }}>
            {/* header row */}
            <div className="border-b border-border/60 bg-muted/30" />
            {days.map((d) => {
              const today = isSameDay(d, new Date());
              return (
                <div key={d.toISOString()} className="border-b border-l border-border/60 bg-muted/30 px-2 py-2 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{format(d, "EEE")}</div>
                  <div className={`text-sm font-semibold tabular-nums ${today ? "text-primary" : ""}`}>{format(d, "d")}</div>
                </div>
              );
            })}

            {/* hour rows */}
            <div className="relative">
              {Array.from({ length: HOUR_ROWS }, (_, i) => (
                <div
                  key={i}
                  className="border-b border-border/40 pr-1 text-right text-[10px] text-muted-foreground"
                  style={{ height: ROW_PX }}
                >
                  <span className="pr-1">{formatHour(HOUR_START + i)}</span>
                </div>
              ))}
            </div>
            {days.map((d) => (
              <DayColumn
                key={d.toISOString()}
                day={d}
                events={visibleEvents}
                onSelect={setSelectedEvent}
              />
            ))}
          </div>

          {events.isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground border-t border-border/60">
              Loading team calendar…
            </div>
          )}
          {!events.isLoading && (events.data?.length ?? 0) === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground border-t border-border/60">
              {teamList.length === 0
                ? "Connect your Google Calendar to start seeing events here."
                : "No events for this week."}
            </div>
          )}
        </Card>

        {/* Detail modal */}
        {selectedEvent && (
          <EventModal e={selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}
      </div>
      {setOpen && (
        <SetReminderDialog
          onClose={() => setSetOpen(false)}
          onCreate={async (input) => {
            try {
              const r = await setReminderFn({ data: input });
              toast.success("Set logged — reminders at 3 days, 1 day, and 3 hours before.");
              if (r.htmlLink) window.open(r.htmlLink, "_blank");
              setSetOpen(false);
            } catch (e) {
              const msg = String((e as Error).message ?? e);
              if (msg.includes("insufficient-scope")) {
                toast.error("Your calendar was connected read-only. Disconnect and reconnect to enable reminders.");
              } else if (msg.includes("no-connection")) {
                toast.error("Connect your Google Calendar first.");
              } else {
                toast.error(msg);
              }
            }
          }}
        />
      )}
    </div>
  );
}

function formatHour(h: number) {
  const suffix = h < 12 || h === 24 ? "am" : "pm";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${suffix}`;
}

function DayColumn({ day, events, onSelect }: { day: Date; events: TeamEvent[]; onSelect: (e: TeamEvent) => void }) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.start), day) && !e.all_day);
  const allDay = events.filter((e) => isSameDay(new Date(e.start), day) && e.all_day);

  return (
    <div className="relative border-l border-border/60" style={{ height: HOUR_ROWS * ROW_PX }}>
      {/* hour grid lines */}
      {Array.from({ length: HOUR_ROWS }, (_, i) => (
        <div key={i} className="border-b border-border/40" style={{ height: ROW_PX }} />
      ))}
      {/* All-day chips at the top */}
      {allDay.length > 0 && (
        <div className="absolute top-1 left-1 right-1 flex flex-col gap-1 z-10">
          {allDay.map((e) => (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="text-left text-[10px] px-1.5 py-0.5 rounded-md truncate"
              style={{ background: `${e.color}33`, color: e.color, borderLeft: `2px solid ${e.color}` }}
              title={`${e.display_name}: ${e.summary}`}
            >
              {e.summary}
            </button>
          ))}
        </div>
      )}
      {dayEvents.map((e) => {
        const s = new Date(e.start);
        const en = new Date(e.end);
        const startMin = s.getHours() * 60 + s.getMinutes();
        const endMin = en.getHours() * 60 + en.getMinutes();
        const top = ((startMin - HOUR_START * 60) / 60) * ROW_PX;
        const height = Math.max(18, ((endMin - startMin) / 60) * ROW_PX);
        if (top + height < 0 || top > HOUR_ROWS * ROW_PX) return null;
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e)}
            className="absolute left-1 right-1 rounded-md px-1.5 py-1 text-left text-[11px] leading-tight overflow-hidden hover:shadow-md transition"
            style={{
              top: Math.max(0, top),
              height,
              background: `${e.color}22`,
              borderLeft: `3px solid ${e.color}`,
              color: "var(--foreground)",
            }}
            title={`${e.display_name}: ${e.summary}`}
          >
            <div className="font-semibold truncate">{e.summary}</div>
            <div className="text-[10px] opacity-80 truncate">
              {format(s, "h:mma").toLowerCase()} · {e.display_name}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EventModal({ e, onClose }: { e: TeamEvent; onClose: () => void }) {
  const s = new Date(e.start);
  const en = new Date(e.end);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="max-w-md w-full p-5 border-border/60" onClick={(evt) => evt.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <span className="h-3 w-3 rounded-full mt-1.5 shrink-0" style={{ background: e.color }} />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base leading-tight">{e.summary}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{e.display_name}</p>
          </div>
        </div>
        <div className="text-sm space-y-2">
          <div className="text-muted-foreground">
            {format(s, "EEE, MMM d · h:mm a")} – {format(en, "h:mm a")}
          </div>
          {e.description && <p className="whitespace-pre-wrap text-sm">{e.description}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            {e.meet_link && (
              <Button asChild size="sm" variant="secondary">
                <a href={e.meet_link} target="_blank" rel="noreferrer">
                  <Video className="h-3.5 w-3.5 mr-1.5" /> Join Meet
                </a>
              </Button>
            )}
            {e.html_link && (
              <Button asChild size="sm" variant="ghost">
                <a href={e.html_link} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in Google
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.12A6.98 6.98 0 0 1 5.47 12c0-.74.13-1.45.37-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function SetReminderDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (input: { prospect: string; startISO: string; durationMin: number; notes?: string }) => Promise<void>;
}) {
  const [prospect, setProspect] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!prospect.trim()) { toast.error("Prospect name is required"); return; }
    setSaving(true);
    await onCreate({
      prospect: prospect.trim(),
      startISO: new Date(`${date}T${time}:00`).toISOString(),
      durationMin: Number(duration) || 30,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md card-surface p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="text-sm font-semibold">Log a set</div>
          <p className="text-caption text-muted-foreground mt-0.5">
            Creates the call on your Google Calendar with reminders 3 days, 1 day, and 3 hours before.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Prospect</label>
          <Input value={prospect} onChange={(e) => setProspect(e.target.value)} placeholder="e.g. Ahmed R." className="h-9 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1 col-span-1">
            <label className="text-[10px] text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Time</label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Duration (min)</label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Notes (optional)</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Objections, context…" className="h-9 text-sm" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create reminder"}</Button>
        </div>
      </div>
    </div>
  );
}
