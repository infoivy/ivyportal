import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek, subWeeks,
} from "date-fns";
import {
  CalendarClock, Check, ChevronLeft, ChevronRight, ExternalLink, Link2Off, Plus, X,
  RefreshCw, Users2, Video,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { DateField } from "@/components/ui/date-field";
import { SelectField } from "@/components/ui/select-field";
import {
  disconnectMyCalendar, getMyCalendarConnection, getTeamCalendarEvents, createSetReminder,
  listUpcomingSets, deleteSetReminder, syncCalendlySets, claimSet, type UpcomingSet,
  updateSetTracking, cancelSet, restoreSet, unclaimSet, assignSet, type ReminderWindow, type ReminderState,
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

const DEFAULT_HOUR_START = 7; // 7am
const ROW_PX = 44;

/** Google Calendar descriptions arrive as HTML (Zoom invites etc.) — flatten to text. */
function cleanDescription(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n");
  const text = typeof window !== "undefined"
    ? new DOMParser().parseFromString(withBreaks, "text/html").body.textContent ?? ""
    : withBreaks.replace(/<[^>]+>/g, "");
  return text.replace(/[—–_-]{6,}/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function zoomLink(text: string): string | null {
  const m = text.match(/https:\/\/[\w.-]*zoom\.us\/j\/[^\s<>"']+/);
  return m ? m[0] : null;
}

/** Every IANA timezone the browser knows, with the region's common ones first. */
function tzOptions(): { value: string; label: string }[] {
  const all: string[] = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Asia/Riyadh", "Asia/Dubai", "Europe/Amsterdam", "Europe/London", "America/New_York", "America/Los_Angeles"];
  const pinned = ["Asia/Riyadh", "Asia/Dubai", "Europe/Amsterdam", "Europe/London", "America/New_York", "America/Los_Angeles"];
  const rest = all.filter((z) => !pinned.includes(z));
  const label = (z: string) => z.replace(/_/g, " ");
  return [
    { value: "", label: "Device time" },
    ...pinned.filter((z) => all.includes(z)).map((z) => ({ value: z, label: label(z) })),
    ...rest.map((z) => ({ value: z, label: label(z) })),
  ];
}
const TZ_OPTIONS = tzOptions();

/** Date whose local fields equal the wall-clock time in tz (display only). */
function shiftToTz(iso: string | Date, tz: string): Date {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (!tz) return d;
  return new Date(d.toLocaleString("en-US", { timeZone: tz }));
}

function CalendarPage() {
  const { user } = useAuth();
  const [tz, setTz] = useState<string>(() => {
    try { return localStorage.getItem("isa-cal-tz") ?? ""; } catch { return ""; }
  });
  const changeTz = (next: string) => {
    setTz(next);
    try { localStorage.setItem("isa-cal-tz", next); } catch { /* ignore */ }
    setWeekStart(startOfWeek(shiftToTz(new Date(), next), { weekStartsOn: 1 }));
  };
  const toLocal = (iso: string | Date) => shiftToTz(iso, tz);
  const search = useSearch({ from: "/_authenticated/calendar" });
  const [weekStart, setWeekStart] = useState(() => {
    let saved = "";
    try { saved = localStorage.getItem("isa-cal-tz") ?? ""; } catch { /* ignore */ }
    return startOfWeek(shiftToTz(new Date(), saved), { weekStartsOn: 1 });
  });
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
  const qc = useQueryClient();

  const isMobile = useIsMobile();
  const daySpan = isMobile ? 3 : 7;
  // On phones a full week is unreadable — show a 3-day window anchored on today.
  useEffect(() => {
    if (isMobile) setWeekStart((w) => {
      const now = shiftToTz(new Date(), tz);
      now.setHours(0, 0, 0, 0);
      return w <= now && now < addDays(w, 7) ? now : w;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);
  const weekEnd = useMemo(
    () => (daySpan === 7 ? endOfWeek(weekStart, { weekStartsOn: 1 }) : addDays(weekStart, daySpan - 1)),
    [weekStart, daySpan],
  );
  const days = useMemo(
    () => Array.from({ length: daySpan }, (_, i) => addDays(weekStart, i)),
    [weekStart, daySpan],
  );

  const myConnFn = useServerFn(getMyCalendarConnection);
  const teamStatusFn = useServerFn(getTeamCalendarStatus);
  const teamEventsFn = useServerFn(getTeamCalendarEvents);
  const startAuthFn = useServerFn(startGoogleCalendarAuth);
  const disconnectFn = useServerFn(disconnectMyCalendar);
  const setReminderFn = useServerFn(createSetReminder);
  const listSetsFn = useServerFn(listUpcomingSets);
  const deleteSetFn = useServerFn(deleteSetReminder);
  const [setOpen, setSetOpen] = useState(false);
  const [setsFilter, setSetsFilter] = useState<"all" | "mine">("all");
  const [pageView, setPageView] = useState<"calendar" | "sets">(() => {
    try { return (localStorage.getItem("isa-cal-view") as "calendar" | "sets") ?? "calendar"; } catch { return "calendar"; }
  });
  const changePageView = (v: "calendar" | "sets") => {
    setPageView(v);
    try { localStorage.setItem("isa-cal-view", v); } catch { /* ignore */ }
  };
  const syncCalendlyFn = useServerFn(syncCalendlySets);
  const claimSetFn = useServerFn(claimSet);
  const trackSetFn = useServerFn(updateSetTracking);
  const cancelSetFn = useServerFn(cancelSet);
  const restoreSetFn = useServerFn(restoreSet);
  const unclaimSetFn = useServerFn(unclaimSet);
  const assignSetFn = useServerFn(assignSet);

  // setter roster for the assign dropdown
  const settersQ = useQuery({
    queryKey: ["cal", "setters"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: roleRows } = await supabase.from("user_roles").select("user_id, role").in("role", ["setter", "closer", "admin"]);
      const ids = Array.from(new Set((roleRows ?? []).map((r: { user_id: string }) => r.user_id)));
      if (!ids.length) return [] as { id: string; display_name: string | null }[];
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      return (profs ?? []) as { id: string; display_name: string | null }[];
    },
  });
  const upcomingSets = useQuery({ queryKey: ["cal", "sets"], queryFn: () => listSetsFn(), staleTime: 30_000 });

  // 6-hour rule: a set the lead hasn't confirmed by 6h before start is pulled
  // from the calendar so the slot can be re-used. Runs once per set per visit.
  const autoCancelled = useRef(new Set<string>());
  useEffect(() => {
    const sets = upcomingSets.data ?? [];
    const cutoff = 6 * 3_600_000;
    for (const s of sets) {
      if (s.status !== "active" || s.confirmed_at || s.owner_id == null) continue;
      const msLeft = new Date(s.event_start).getTime() - Date.now();
      if (msLeft > 0 && msLeft <= cutoff && !autoCancelled.current.has(s.id)) {
        autoCancelled.current.add(s.id);
        cancelSetFn({ data: { id: s.id, reason: "no confirmation 6h before the call" } })
          .then(() => {
            toast.warning(`${s.prospect} removed — no confirmation 6h before the call.`);
            qc.invalidateQueries({ queryKey: ["cal", "sets"] });
          })
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingSets.data]);
  // pull fresh Calendly bookings once per visit, then refresh the list
  useEffect(() => {
    syncCalendlyFn().then((r) => {
      if (r && "imported" in r && (r.imported ?? 0) > 0) qc.invalidateQueries({ queryKey: ["cal", "sets"] });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myConn = useQuery({ queryKey: ["cal", "me"], queryFn: () => myConnFn() });
  // Team calendars fan out to Google per teammate — don't pay for that while
  // the user is on the Sets view.
  const team = useQuery({ queryKey: ["cal", "team"], queryFn: () => teamStatusFn(), enabled: pageView === "calendar" });
  const events = useQuery({
    queryKey: ["cal", "events", weekStart.toISOString(), daySpan],
    queryFn: () => teamEventsFn({
      data: { timeMin: weekStart.toISOString(), timeMax: addDays(weekEnd, 1).toISOString() },
    }),
    staleTime: 30_000,
    enabled: pageView === "calendar",
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
  // Classify calendar events by title so the grid can be filtered down to
  // just closing calls (sets), coaching, or team meetings.
  const classify = (summary: string): "closing" | "coaching" | "team" | "other" => {
    const t = summary.toLowerCase();
    if (/coach|role ?play|pathway|mastery|1[:\-]?1|one[- ]on[- ]one/.test(t)) return "coaching";
    if (/team|meeting|sync|standup|all[- ]?hands|huddle/.test(t)) return "team";
    if (/isa call|set[:\s]|closing|sales call|discovery|45|60 ?min/.test(t)) return "closing";
    return "other";
  };
  const [typeFilter, setTypeFilter] = useState<"all" | "closing" | "coaching" | "team">(() => {
    try { return (localStorage.getItem("isa-cal-type") as "all" | "closing" | "coaching" | "team") ?? "all"; } catch { return "all"; }
  });
  const changeTypeFilter = (t: typeof typeFilter) => {
    setTypeFilter(t);
    try { localStorage.setItem("isa-cal-type", t); } catch { /* ignore */ }
  };
  const visibleEvents = (events.data ?? []).filter((e) =>
    !hiddenUsers.has(e.user_id) && (typeFilter === "all" || classify(e.summary ?? "") === typeFilter));

  // Full 24-hour grid, scrolled to the working day by default
  const hourStart = 0;
  const hourRows = 24;
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    gridScrollRef.current?.scrollTo({ top: DEFAULT_HOUR_START * ROW_PX });
  }, [weekStart]);

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
            <div className="inline-flex rounded-lg bg-muted p-[3px] ml-2">
              <button onClick={() => changePageView("calendar")} className={`text-[13px] font-medium px-3 py-1.5 rounded-[8px] motion-safe:transition-colors ${pageView === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Calendar</button>
              <button onClick={() => changePageView("sets")} className={`text-[13px] font-medium px-3 py-1.5 rounded-[8px] motion-safe:transition-colors ${pageView === "sets" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Sets</button>
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

        {pageView === "calendar" && (<>
        {/* Connected team + filters */}
        <Card className="p-4 border-border/60">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Users2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground shrink-0">Calendars:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {teamList.length === 0 && (
                  <span className="text-sm text-muted-foreground">No one has connected yet.</span>
                )}
                {teamList.map((m) => {
                  const shown = !hiddenUsers.has(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => toggleUser(m.user_id)}
                      aria-pressed={shown}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs motion-safe:transition ${
                        shown ? "border-border/80 bg-muted/40 text-foreground" : "opacity-45 border-border text-muted-foreground line-through"
                      }`}
                      title={shown ? "Click to hide this calendar" : "Click to show this calendar"}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: m.color }} />
                      <span className="font-medium">{m.display_name}</span>
                      {shown && <Check className="h-3 w-3 opacity-70" />}
                    </button>
                  );
                })}
                {teamList.length > 1 && (
                  <>
                    <span className="h-3.5 w-px bg-border mx-0.5" />
                    <button
                      onClick={() => setHiddenUsers(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground px-1.5"
                    >
                      Show all
                    </button>
                    {user && teamList.some((m) => m.user_id === user.id) && (
                      <button
                        onClick={() => setHiddenUsers(new Set(teamList.filter((m) => m.user_id !== user.id).map((m) => m.user_id)))}
                        className="text-xs text-muted-foreground hover:text-foreground px-1.5"
                      >
                        Only mine
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <div className="inline-flex rounded-lg bg-muted p-[3px] mr-1">
                {([
                  ["all", "All"],
                  ["closing", "Closing"],
                  ["coaching", "Coaching"],
                  ["team", "Meetings"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => changeTypeFilter(key)}
                    className={`text-caption font-medium px-2.5 py-1 rounded-[7px] motion-safe:transition-colors ${typeFilter === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <TzPicker value={tz} onChange={changeTz} />
              <Button size="icon" variant="ghost" onClick={() => setWeekStart((w) => (daySpan === 7 ? subWeeks(w, 1) : addDays(w, -daySpan)))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { const now = shiftToTz(new Date(), tz); now.setHours(0, 0, 0, 0); setWeekStart(daySpan === 7 ? startOfWeek(now, { weekStartsOn: 1 }) : now); }}>
                Today
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setWeekStart((w) => (daySpan === 7 ? addWeeks(w, 1) : addDays(w, daySpan)))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-1 sm:ml-2 basis-full sm:basis-auto text-sm text-muted-foreground tabular-nums">
                {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </Card>

        {/* Week grid — full 24h, scrollable, opens at the working day */}
        <Card className="p-0 border-border/60 overflow-hidden relative">
          <div ref={gridScrollRef} className="max-h-[68vh] overflow-y-auto overscroll-contain">
          <div className="grid" style={{ gridTemplateColumns: `${isMobile ? 40 : 48}px repeat(${daySpan}, minmax(0, 1fr))` }}>
            {/* header row */}
            <div className="sticky top-0 z-20 border-b border-border/60 bg-card" />
            {days.map((d) => {
              const today = isSameDay(d, toLocal(new Date()));
              return (
                <div key={d.toISOString()} className="sticky top-0 z-20 border-b border-l border-border/60 bg-card px-2 py-2 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{format(d, "EEE")}</div>
                  <div className={`text-sm font-semibold tabular-nums ${today ? "text-primary" : ""}`}>{format(d, "d")}</div>
                </div>
              );
            })}

            {/* hour rows */}
            <div className="relative">
              {Array.from({ length: hourRows }, (_, i) => (
                <div
                  key={i}
                  className="border-b border-border/40 pr-1 text-right text-[10px] text-muted-foreground"
                  style={{ height: ROW_PX }}
                >
                  <span className="pr-1">{formatHour(hourStart + i)}</span>
                </div>
              ))}
            </div>
            {days.map((d) => (
              <DayColumn
                key={d.toISOString()}
                day={d}
                events={visibleEvents}
                onSelect={setSelectedEvent}
                toLocal={toLocal}
                hourStart={hourStart}
                hourRows={hourRows}
              />
            ))}
          </div>
          </div>

          {events.isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground border-t border-border/60">
              Loading team calendar…
            </div>
          )}
          {!events.isLoading && (events.data?.length ?? 0) === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="rounded-md border border-border/60 bg-card/95 px-4 py-3 text-sm text-muted-foreground shadow-sm text-center">
                {teamList.length === 0
                  ? "Connect your Google Calendar to start seeing events here."
                  : "No events for this week."}
              </div>
            </div>
          )}
        </Card>

        </>)}

        {/* Set reminders — every upcoming set and its reminder schedule */}
        {pageView === "sets" && (
        <Card className="p-5 border-border/60 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-title text-foreground">Set reminders</h2>
              <p className="text-caption text-muted-foreground">Track every set: tick each reminder window as you send it, confirm the lead, and unconfirmed sets auto-drop 6h before the call.</p>
            </div>
            <div className="flex gap-1">
              {(["all", "mine"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSetsFilter(f)}
                  className={`text-caption font-medium px-3 py-1.5 rounded-md motion-safe:transition-colors ${setsFilter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  {f === "all" ? "All sets" : "My sets"}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const live = (upcomingSets.data ?? []).filter((s) => s.status !== "cancelled");
            const now = Date.now();
            const dueNow = live.filter((s) => {
              if (s.confirmed_at || !s.owner_id) return false;
              const msLeft = new Date(s.event_start).getTime() - now;
              return WINDOWS.some((w) => msLeft > 0 && msLeft <= w.minutes * 60_000 && !(s.reminder_log as Record<string, string> | null | undefined)?.[w.key]);
            }).length;
            const stats = [
              { label: "Upcoming", value: live.length, cls: "text-foreground" },
              { label: "Unclaimed", value: live.filter((s) => !s.owner_id).length, cls: live.some((s) => !s.owner_id) ? "text-warning-fg" : "text-foreground" },
              { label: "Reminder due", value: dueNow, cls: dueNow ? "text-danger-fg" : "text-foreground" },
              { label: "Unconfirmed", value: live.filter((s) => !s.confirmed_at).length, cls: live.some((s) => !s.confirmed_at) ? "text-warning-fg" : "text-foreground" },
              { label: "Confirmed", value: live.filter((s) => !!s.confirmed_at).length, cls: "text-success-fg" },
            ];
            return (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {stats.map((c) => (
                  <div key={c.label} className="rounded-md border border-border bg-[var(--background)] px-3 py-2">
                    <div className={`text-lg font-medium tabular-nums leading-none ${c.cls}`}>{c.value}</div>
                    <div className="text-micro text-muted-foreground mt-1">{c.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}
          <UpcomingSetsList
            big
            sets={upcomingSets.data ?? []}
            toLocal={toLocal}
            team={settersQ.data ?? []}
            onUnclaim={async (id) => {
              try {
                await unclaimSetFn({ data: { id } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                toast.success("Unclaimed — back in the pool (removed from the calendar).");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            onAssign={async (id, userId) => {
              try {
                const r = await assignSetFn({ data: { id, userId } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                toast.success(r.calendar ? "Assigned — it's on their calendar with reminders." : "Assigned. They should connect Google Calendar for the reminders.");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            onTrack={(id, window, state) => {
              // Optimistic: flip the chip instantly, reconcile in the background
              qc.setQueryData<UpcomingSet[]>(["cal", "sets"], (old) => (old ?? []).map((r) => {
                if (r.id !== id) return r;
                const log = { ...((r.reminder_log ?? {}) as Record<string, string>) };
                if (state == null) delete log[window]; else log[window] = state;
                return { ...r, reminder_log: log };
              }));
              trackSetFn({ data: { id, window, state } }).catch((err) => {
                toast.error(String((err as Error).message ?? err));
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
              });
            }}
            onConfirm={(id, confirm) => {
              qc.setQueryData<UpcomingSet[]>(["cal", "sets"], (old) => (old ?? []).map((r) =>
                r.id === id ? { ...r, confirmed_at: confirm ? new Date().toISOString() : null } : r,
              ));
              if (confirm) toast.success("Confirmed — the slot is locked in.");
              trackSetFn({ data: { id, confirm } }).catch((err) => {
                toast.error(String((err as Error).message ?? err));
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
              });
            }}
            onCancel={async (id) => {
              try {
                const r = await cancelSetFn({ data: { id, reason: "removed manually" } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                toast.success(r.calendarRemoved ? "Cancelled and removed from the calendar. Undo below if that was a mistake." : "Cancelled — undo below if that was a mistake.");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            onRestore={async (id) => {
              try {
                const r = await restoreSetFn({ data: { id } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                toast.success(r.calendarRestored ? "Restored — it's back on the calendar with reminders." : "Restored to the list. Reconnect Google Calendar to re-add the event.");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            onClaim={async (id) => {
              try {
                const r = await claimSetFn({ data: { id } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                toast.success(r.calendar
                  ? "Claimed — it's on your calendar with reminders 2d · 1d · 3h · 1h before."
                  : "Claimed. Connect your Google Calendar to get the reminders.");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            loading={upcomingSets.isLoading}
            filter={setsFilter}
            onDelete={async (id) => {
              try {
                await deleteSetFn({ data: { id } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                toast.success("Removed from the list (the calendar event stays).");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
          />
        </Card>
        )}

        {/* Detail modal */}
        {selectedEvent && (
          <EventModal
            e={selectedEvent}
            toLocal={toLocal}
            onClose={() => setSelectedEvent(null)}
            canClaim={!!myConn.data}
            onClaim={async (ev) => {
              try {
                const start = new Date(ev.start);
                const durationMin = Math.max(15, Math.round((new Date(ev.end).getTime() - start.getTime()) / 60000));
                await setReminderFn({ data: { prospect: ev.summary.replace(/^Set:\s*/i, ""), startISO: ev.start, durationMin, notes: ev.description ? cleanDescription(ev.description) : undefined, source: "claimed" } });
                toast.success("Set claimed — it's on your calendar with reminders 2d · 1d · 3h · 1h before.");
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                setSelectedEvent(null);
              } catch (err) {
                const msg = String((err as Error).message ?? err);
                if (msg.includes("insufficient-scope")) toast.error("Your calendar was connected read-only. Disconnect and reconnect to enable reminders.");
                else if (msg.includes("no-connection")) toast.error("Connect your Google Calendar first.");
                else toast.error(msg);
              }
            }}
          />
        )}
      </div>
      {setOpen && (
        <SetReminderDialog
          onClose={() => setSetOpen(false)}
          onCreate={async (input) => {
            try {
              const r = await setReminderFn({ data: { ...input, source: "manual" as const } });
              qc.invalidateQueries({ queryKey: ["cal", "sets"] });
              toast.success("Set logged — reminders at 2 days, 1 day, 3 hours, and 1 hour before.");
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

function DayColumn({ day, events, onSelect, toLocal, hourStart, hourRows }: { day: Date; events: TeamEvent[]; onSelect: (e: TeamEvent) => void; toLocal: (iso: string | Date) => Date; hourStart: number; hourRows: number }) {
  const dayEvents = events.filter((e) => isSameDay(toLocal(e.start), day) && !e.all_day);
  const allDay = events.filter((e) => isSameDay(toLocal(e.start), day) && e.all_day);

  return (
    <div className="relative border-l border-border/60" style={{ height: hourRows * ROW_PX }}>
      {/* hour grid lines */}
      {Array.from({ length: hourRows }, (_, i) => (
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
      {(() => {
        // A shared meeting appears once per connected member calendar —
        // collapse identical (title, start, end) copies into one chip.
        const seen = new Set<string>();
        const deduped = dayEvents.filter((e) => {
          const k = `${e.summary}|${e.start}|${e.end}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        // Lane layout: overlapping events share the width instead of stacking
        const sorted = [...deduped].sort((a, b) => a.start.localeCompare(b.start));
        const lanes: { end: number }[] = [];
        const placed = sorted.map((e) => {
          const startMs = new Date(e.start).getTime();
          const endMs = new Date(e.end).getTime();
          let lane = lanes.findIndex((l) => l.end <= startMs);
          if (lane === -1) { lanes.push({ end: endMs }); lane = lanes.length - 1; }
          else lanes[lane] = { end: endMs };
          return { e, lane };
        });
        // events overlapping in time share the max lane count of their cluster
        return placed.map(({ e, lane }) => {
          const s = toLocal(e.start);
          const en = toLocal(e.end);
          // Overlap must compare RAW instants — mixing the tz-shifted display
          // date with raw dates broke clustering whenever a timezone was set,
          // which stacked concurrent events at full width.
          const sRaw = new Date(e.start).getTime();
          const enRaw = new Date(e.end).getTime();
          const overlapping = placed.filter(({ e: o }) =>
            new Date(o.start).getTime() < enRaw && new Date(o.end).getTime() > sRaw);
          const cols = Math.max(1, ...overlapping.map((o) => o.lane + 1));
          const startMin = s.getHours() * 60 + s.getMinutes();
          const endMin = en.getHours() * 60 + en.getMinutes();
          const top = ((startMin - hourStart * 60) / 60) * ROW_PX;
          const height = Math.max(20, ((endMin - startMin) / 60) * ROW_PX);
          if (top + height < 0 || top > hourRows * ROW_PX) return null;
          const compact = height < 36; // one line only — no clipped second line
          const widthPct = 100 / cols;
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="absolute rounded px-1.5 text-left text-[11px] leading-tight overflow-hidden hover:brightness-110 motion-safe:transition-[filter]"
              style={{
                top: Math.max(0, top),
                height,
                left: `calc(${lane * widthPct}% + 3px)`,
                width: `calc(${widthPct}% - 5px)`,
                background: `${e.color}26`,
                boxShadow: `inset 3px 0 0 ${e.color}`,
                color: "var(--foreground)",
                paddingTop: compact ? 0 : 3,
                display: compact ? "flex" : "block",
                alignItems: compact ? "center" : undefined,
              }}
              title={`${e.display_name}: ${e.summary} · ${format(s, "h:mma").toLowerCase()}–${format(en, "h:mma").toLowerCase()}`}
            >
              {compact ? (
                <span className="truncate w-full">
                  <span className="opacity-75 tabular-nums">{format(s, "h:mm")}</span>{" "}
                  <span className="font-medium">{e.summary}</span>
                </span>
              ) : (
                <>
                  <div className="font-medium truncate">{e.summary}</div>
                  <div className="text-[10px] opacity-75 truncate tabular-nums">
                    {format(s, "h:mma").toLowerCase()} · {e.display_name}
                  </div>
                </>
              )}
            </button>
          );
        });
      })()}
    </div>
  );
}

function EventModal({ e, onClose, canClaim, onClaim, toLocal }: {
  e: TeamEvent; onClose: () => void;
  canClaim: boolean; onClaim: (e: TeamEvent) => Promise<void>;
  toLocal: (iso: string | Date) => Date;
}) {
  const s = toLocal(e.start);
  const en = toLocal(e.end);
  return (
    <div className="fixed inset-0 overflow-y-auto bg-black/50 flex z-50 p-4" onClick={onClose}>
      <Card className="m-auto max-w-md w-full p-5 border-border/60" onClick={(evt) => evt.stopPropagation()}>
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
          {e.description && (
            <p className="whitespace-pre-wrap text-caption text-muted-foreground max-h-44 overflow-y-auto rounded-md bg-muted/40 p-2.5">
              <Linkified text={cleanDescription(e.description)} />
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {e.description && zoomLink(cleanDescription(e.description)) && (
              <Button asChild size="sm" variant="secondary">
                <a href={zoomLink(cleanDescription(e.description))!} target="_blank" rel="noreferrer">
                  <Video className="h-3.5 w-3.5 mr-1.5" /> Join Zoom
                </a>
              </Button>
            )}
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
            {canClaim && (
              <Button size="sm" onClick={() => onClaim(e)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Claim as my set
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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log a set</DialogTitle>
          <p className="text-caption text-muted-foreground">
            Creates the call on your Google Calendar with reminders 2 days, 1 day, 3 hours, and 1 hour before.
          </p>
        </DialogHeader>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Prospect</label>
          <Input value={prospect} onChange={(e) => setProspect(e.target.value)} placeholder="e.g. Ahmed R." className="h-9 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1 col-span-1">
            <label className="text-[10px] text-muted-foreground">Date</label>
            <DateField value={date} onChange={setDate} clearable={false} className="h-9" />
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
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create reminder"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const WINDOWS: { key: "48h" | "24h" | "3h" | "1h"; label: string; minutes: number }[] = [
  { key: "48h", label: "48h", minutes: 48 * 60 },
  { key: "24h", label: "24h", minutes: 24 * 60 },
  { key: "3h", label: "3h", minutes: 3 * 60 },
  { key: "1h", label: "1h", minutes: 60 },
];

function UpcomingSetsList({ sets, loading, filter, onDelete, onClaim, onTrack, onConfirm, onCancel, onRestore, onUnclaim, onAssign, team = [], toLocal, big = false }: {
  sets: UpcomingSet[];
  loading: boolean;
  filter: "all" | "mine";
  onDelete: (id: string) => void;
  onClaim: (id: string) => void;
  onTrack: (id: string, window: ReminderWindow | string, state: ReminderState | null) => void;
  onConfirm: (id: string, confirm: boolean) => void;
  onCancel: (id: string) => void;
  onRestore: (id: string) => void;
  onUnclaim?: (id: string) => void;
  onAssign?: (id: string, userId: string) => void;
  team?: { id: string; display_name: string | null }[];
  toLocal: (iso: string | Date) => Date;
  big?: boolean;
}) {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const pool = filter === "mine" ? sets.filter((s) => s.owner_id === user?.id) : sets;
  const visible = pool.filter((s) => s.status !== "cancelled");
  const cancelled = pool.filter((s) => s.status === "cancelled");

  const untilLabel = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "now";
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return `in ${Math.max(1, Math.floor(ms / 60_000))}m`;
    if (h < 48) return `in ${h}h`;
    return `in ${Math.floor(h / 24)}d`;
  };

  if (loading) return <div className="text-caption text-muted-foreground py-4">Loading…</div>;
  if (visible.length === 0 && cancelled.length === 0) {
    return (
      <div className="text-caption text-muted-foreground py-6 text-center">
        {filter === "mine" ? "No upcoming sets assigned to you. Log one or claim one from the calendar above." : "No upcoming sets yet. Log a set, or click a calendar event and claim it."}
      </div>
    );
  }
  const todayKey = format(toLocal(new Date()), "yyyy-MM-dd");
  const tomorrowKey = format(addDays(toLocal(new Date()), 1), "yyyy-MM-dd");
  const dayLabel = (k: string) =>
    k === todayKey ? "Today" : k === tomorrowKey ? "Tomorrow" : format(new Date(k + "T00:00:00"), "EEEE, MMM d");
  const groups: [string, UpcomingSet[]][] = [];
  for (const s of visible) {
    const k = format(toLocal(s.event_start), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last && last[0] === k) last[1].push(s); else groups.push([k, [s]]);
  }
  const durLabel = (ms: number) => {
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
    if (h < 48) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const renderSet = (s: UpcomingSet) => {
        const start = toLocal(s.event_start);
        const mine = s.owner_id === user?.id;
        const msLeft = new Date(s.event_start).getTime() - Date.now();
        const confirmed = !!s.confirmed_at;
        const inDanger = !confirmed && msLeft > 0 && msLeft <= 12 * 3_600_000;
        const canTrack = mine || isAdmin || roles.includes("closer");
        const todayWarmKey = "warm:" + new Date().toISOString().slice(0, 10);
        const warmToday = !!(s.reminder_log as Record<string, string> | undefined)?.[todayWarmKey];
        const farOut = msLeft > 48 * 3_600_000;
        const log = s.reminder_log as Record<string, string> | null | undefined;
        const sentCount = WINDOWS.filter((w) => log?.[w.key] === "reminded").length;
        const openDue = WINDOWS.filter((w) => msLeft > 0 && msLeft <= w.minutes * 60_000 && !log?.[w.key]);
        const nextToOpen = WINDOWS.find((w) => msLeft > w.minutes * 60_000);
        return (
          <div key={s.id} className={big ? "py-4 space-y-2.5" : "py-2.5 space-y-1.5"}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-[55%] flex-1">
                <div className={`${big ? "text-[15px]" : "text-body"} font-medium text-foreground truncate`}>
                  {s.prospect}
                  {s.source === "calendly" && <span className="ml-2 text-micro text-muted-foreground">calendly</span>}
                </div>
                <div className="text-caption truncate">
                  <span className="text-muted-foreground">{format(start, "EEE, MMM d · h:mm a")} · </span>
                  {s.owner_id
                    ? <span className="text-muted-foreground">{s.owner_name}{mine ? " (you)" : ""}</span>
                    : <span className="text-warning-fg">Unclaimed — needs a setter</span>}
                </div>
              </div>
              {confirmed ? (
                <span className="text-micro font-medium text-success-fg bg-success-bg border border-success/25 rounded-full px-2 py-0.5 shrink-0">Confirmed</span>
              ) : (
                <span className={`text-micro font-medium rounded-full px-2 py-0.5 border shrink-0 ${inDanger ? "text-danger-fg bg-danger-bg border-danger/25" : "text-warning-fg bg-warning-bg border-warning/25"}`}>
                  {inDanger ? "Unconfirmed — drops 6h before" : "Unconfirmed"}
                </span>
              )}
              {!s.owner_id && (
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-caption shrink-0" onClick={() => onClaim(s.id)}>
                  Claim
                </Button>
              )}
              {onAssign && (isAdmin || roles.includes("founder") || mine) && team.length > 0 && (
                <SelectField
                  value=""
                  onChange={(v) => { if (v) onAssign(s.id, v); }}
                  placeholder={s.owner_id ? "Reassign…" : "Assign…"}
                  className="h-7 w-28 text-caption shrink-0"
                  options={team.map((t) => ({ value: t.id, label: t.display_name ?? "Teammate" }))}
                />
              )}
              {s.owner_id && onUnclaim && (mine || isAdmin || roles.includes("founder")) && (
                <button onClick={() => onUnclaim(s.id)} className="text-micro text-muted-foreground hover:text-foreground shrink-0" title="Give this set back to the pool">
                  unclaim
                </button>
              )}
              <span className="text-caption text-muted-foreground tabular-nums shrink-0">{untilLabel(s.event_start)}</span>
              {s.gcal_html_link && (
                <a href={s.gcal_html_link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" title="Open in Google Calendar">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {(mine || isAdmin) && (
                <button onClick={() => onDelete(s.id)} className="text-muted-foreground hover:text-danger-fg shrink-0" title="Remove from list">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* What's done and what's next — at a glance, no chip-reading needed */}
            {big && s.owner_id && s.status === "active" && (
              <div className="text-micro text-muted-foreground pl-0.5">
                <span className={sentCount === WINDOWS.length ? "text-success-fg" : ""}>{sentCount}/{WINDOWS.length} reminders sent</span>
                {openDue.length > 0 ? (
                  <span className="text-danger-fg font-medium"> · {openDue[0].label} reminder due now — send it</span>
                ) : nextToOpen ? (
                  <span> · next ({nextToOpen.label}) opens in {durLabel(msLeft - nextToOpen.minutes * 60_000)}</span>
                ) : null}
                {!confirmed && <span> · not confirmed by the lead yet</span>}
              </div>
            )}

            {/* Reminder tracker: tick each window as you send it */}
            {s.owner_id && (
              <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
                <span className="text-micro text-muted-foreground mr-0.5">Reminders:</span>
                {WINDOWS.map((w) => {
                  const state = s.reminder_log?.[w.key];
                  const windowOpen = msLeft <= w.minutes * 60_000;
                  const next: ReminderState | null = state === "reminded" ? "no_response" : state === "no_response" ? null : "reminded";
                  return (
                    <button
                      key={w.key}
                      disabled={!canTrack}
                      onClick={() => onTrack(s.id, w.key, next)}
                      title={state === "reminded" ? `${w.label}: reminded — click for 'no response'` : state === "no_response" ? `${w.label}: reached out, no response — click to clear` : windowOpen ? `${w.label} window open — click when you've sent the reminder` : `${w.label} before the call`}
                      className={`text-micro font-medium rounded-full px-2 py-0.5 border motion-safe:transition-colors disabled:cursor-default ${
                        state === "reminded"
                          ? "text-success-fg bg-success-bg border-success/25"
                          : state === "no_response"
                            ? "text-warning-fg bg-warning-bg border-warning/25"
                            : windowOpen
                              ? "text-foreground bg-muted border-border animate-pulse"
                              : "text-muted-foreground bg-transparent border-border"
                      }`}
                    >
                      {w.label}{state === "reminded" ? " ✓" : state === "no_response" ? " · no reply" : ""}
                    </button>
                  );
                })}
                {farOut && (
                  <button
                    disabled={!canTrack}
                    onClick={() => onTrack(s.id, todayWarmKey, warmToday ? null : "reminded")}
                    title={warmToday ? "Warm touch logged today — click to undo" : "Booked days out — send one warm touch per day so the lead stays engaged"}
                    className={`text-micro font-medium rounded-full px-2 py-0.5 border motion-safe:transition-colors disabled:cursor-default ${
                      warmToday
                        ? "text-success-fg bg-success-bg border-success/25"
                        : "text-warning-fg bg-warning-bg border-warning/25 animate-pulse"
                    }`}
                  >
                    {warmToday ? "kept warm today ✓" : "keep warm today"}
                  </button>
                )}
                <span className="mx-1 h-3 w-px bg-border" />
                {canTrack && (confirmed ? (
                  <button onClick={() => onConfirm(s.id, false)} className="text-micro text-muted-foreground hover:text-foreground" title="Undo confirmation">
                    confirmed {format(toLocal(s.confirmed_at!), "MMM d, h:mm a")} · undo
                  </button>
                ) : (
                  <>
                    <button onClick={() => onConfirm(s.id, true)} className="text-micro font-medium text-success-fg hover:opacity-80">
                      Lead confirmed ✓
                    </button>
                    <button onClick={() => onCancel(s.id)} className="text-micro text-muted-foreground hover:text-danger-fg">
                      remove from calendar
                    </button>
                  </>
                ))}
              </div>
            )}
          </div>
        );
  };

  return (
    <div className={big ? "space-y-3" : "divide-y divide-border/60"}>
      {big
        ? groups.map(([k, list]) => (
            <div key={k}>
              <div className="flex items-baseline gap-2 pb-1 border-b border-border/60">
                <span className="text-caption font-semibold text-foreground">{dayLabel(k)}</span>
                <span className="text-micro text-muted-foreground">{list.length === 1 ? "1 set" : `${list.length} sets`}</span>
              </div>
              <div className="divide-y divide-border/60">{list.map(renderSet)}</div>
            </div>
          ))
        : visible.map(renderSet)}
      {cancelled.length > 0 && (
        <div className="pt-2.5">
          <p className="text-micro text-muted-foreground mb-1.5">Removed (no confirmation)</p>
          {cancelled.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-1.5 opacity-55">
              <span className="text-caption line-through truncate flex-1">{s.prospect} · {format(toLocal(s.event_start), "EEE, MMM d · h:mm a")}</span>
              <span className="text-micro text-danger-fg shrink-0">cancelled</span>
              {new Date(s.event_start).getTime() > Date.now() && (
                <button onClick={() => onRestore(s.id)} className="text-micro font-medium text-primary hover:opacity-80 shrink-0">
                  Undo
                </button>
              )}
              {(s.owner_id === user?.id || isAdmin) && (
                <button onClick={() => onDelete(s.id)} className="text-muted-foreground hover:text-danger-fg shrink-0" title="Delete row">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Searchable timezone picker — 600 IANA zones need a combobox, not a native select. */
function TzPicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = TZ_OPTIONS.find((o) => o.value === value)?.label ?? "Device time";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title="Times shown in this timezone"
          className="text-caption h-7 px-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground mr-1 max-w-40 truncate"
        >
          {current}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-72">
        <Command className="h-72">
          <CommandInput placeholder="Search timezones…" />
          <CommandList className="flex-1">
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {TZ_OPTIONS.map((o) => (
                <CommandItem
                  key={o.value || "device"}
                  value={o.label}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                >
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
