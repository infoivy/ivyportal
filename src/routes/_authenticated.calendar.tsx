import { createFileRoute, useSearch } from "@tanstack/react-router";
import { CashInCalendarCard } from "@/components/cash-in-calendar";
import { shortName } from "@/lib/names";
import { SetterTrackingSheet } from "@/components/setter-tracking-sheet";
import { SetterDailyTracker } from "@/components/setter-daily-tracker";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  addDays, addWeeks, endOfMonth, endOfWeek, format, isSameDay, startOfWeek, subMonths, subWeeks, addMonths,
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
import { PageHeader } from "@/components/ui/page-header";
import {
  disconnectMyCalendar, getMyCalendarConnection, getTeamCalendarEvents, createSetReminder,
  listUpcomingSets, syncCalendlySets, claimSet, type UpcomingSet,
  updateSetTracking, cancelSet, restoreSet, unclaimSet, assignSet, type ReminderWindow, type ReminderState,
  getTeamCalendarStatus, startGoogleCalendarAuth, type TeamEvent,
} from "@/lib/calendar.functions";

type ConnectStatus =
  | "ok" | "denied" | "missing" | "invalid_state" | "no_refresh" | "db_error" | "exchange_failed";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar · ISA Team" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    connect: (s.connect as ConnectStatus | undefined) ?? undefined,
  }),
  component: CalendarPage,
});


/** Google Calendar descriptions arrive as HTML (Zoom invites etc.) — flatten to text. */
function cleanDescription(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n");
  const text = typeof window !== "undefined"
    ? new DOMParser().parseFromString(withBreaks, "text/html").body.textContent ?? ""
    : withBreaks.replace(/<[^>]+>/g, "");
  return text.replace(/[––_-]{6,}/g, "").replace(/\n{3,}/g, "\n\n").trim();
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
  const { user, roles: myRoles } = useAuth();
  const [tz, setTz] = useState<string>(() => {
    try { return localStorage.getItem("isa-cal-tz") ?? ""; } catch { return ""; }
  });
  const changeTz = (next: string) => {
    setTz(next);
    try { localStorage.setItem("isa-cal-tz", next); } catch { /* ignore */ }
    setWeekStart(startOfWeek(shiftToTz(new Date(), next), { weekStartsOn: 1 }));
  };
  const toLocal = (iso: string | Date) => shiftToTz(iso, tz);
  // Month grid is the default view (founder 2026-07-29: full view, see calls
  // daily); the week time-grid stays as the drill-down.
  const [calView, setCalView] = useState<"month" | "week">(() => {
    try { return (localStorage.getItem("isa-cal-view2") as "month" | "week") ?? "week"; } catch { return "week"; }
  });
  const changeCalView = (v: "month" | "week") => {
    setCalView(v);
    try { localStorage.setItem("isa-cal-view2", v); } catch { /* ignore */ }
  };
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const n = shiftToTz(new Date(), (() => { try { return localStorage.getItem("isa-cal-tz") ?? Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return Intl.DateTimeFormat().resolvedOptions().timeZone; } })());
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
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

  const [setOpen, setSetOpen] = useState(false);
  const canUseTracker = myRoles.some((role) => ["admin", "founder", "cofounder", "closer", "setter"].includes(role));
  const canViewTeamSets = myRoles.some((role) => ["admin", "founder", "cofounder", "closer"].includes(role));
  // Setters open on THEIR sets — Aalian saw the whole pool and thought a set
  // was someone else's. An explicit choice (either button) is remembered.
  const [setsFilter, setSetsFilterRaw] = useState<"all" | "mine">(() => {
    try {
      const s = localStorage.getItem("isa-sets-filter");
      if (s === "all" || s === "mine") return s;
    } catch { /* ignore */ }
    return "all";
  });
  useEffect(() => {
    try { if (localStorage.getItem("isa-sets-filter")) return; } catch { /* ignore */ }
    if (myRoles.includes("setter") && !canViewTeamSets) setSetsFilterRaw("mine");
  }, [canViewTeamSets, myRoles]);
  const setSetsFilter = (f: "all" | "mine") => {
    setSetsFilterRaw(f);
    try { localStorage.setItem("isa-sets-filter", f); } catch { /* ignore */ }
  };
  const [pageView, setPageView] = useState<"calendar" | "sets" | "tracker">(() => {
    try {
      const saved = localStorage.getItem("isa-cal-view");
      return saved === "sets" || saved === "tracker" ? saved : "calendar";
    } catch { return "calendar"; }
  });
  const changePageView = (v: "calendar" | "sets" | "tracker") => {
    setPageView(v);
    try { localStorage.setItem("isa-cal-view", v); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (myRoles.length > 0 && pageView === "tracker" && !canUseTracker) changePageView("calendar");
    // Sets merged into the tracker (founder-directed 2026-07-30)
    if (pageView === "sets") changePageView(canUseTracker ? "tracker" : "calendar");
  }, [canUseTracker, myRoles.length, pageView]);
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
      const { data: profs } = await supabase.from("profiles").select("id, display_name").eq("is_demo", false).in("id", ids);
      return (profs ?? []) as { id: string; display_name: string | null }[];
    },
  });
  const upcomingSets = useQuery({ queryKey: ["cal", "sets"], queryFn: () => listSetsFn(), staleTime: 30_000 });

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
  const monthGridStart = useMemo(() => startOfWeek(monthAnchor, { weekStartsOn: 1 }), [monthAnchor]);
  const monthGridEnd = useMemo(() => endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 }), [monthAnchor]);
  // ONE shared 6-week span serves both views (founder 2026-07-29: loads were
  // slow): week and month toggle and week-nav inside the same month all hit
  // the cache; previous events stay on screen while a new span refetches.
  const spanAnchor = useMemo(
    () => (calView === "month" ? monthAnchor : new Date(weekStart.getFullYear(), weekStart.getMonth(), 1)),
    [calView, monthAnchor, weekStart],
  );
  const rangeStart = useMemo(() => startOfWeek(spanAnchor, { weekStartsOn: 1 }), [spanAnchor]);
  const rangeEnd = useMemo(() => endOfWeek(endOfMonth(spanAnchor), { weekStartsOn: 1 }), [spanAnchor]);
  const events = useQuery({
    queryKey: ["cal", "events", rangeStart.toISOString()],
    queryFn: () => teamEventsFn({
      data: { timeMin: rangeStart.toISOString(), timeMax: addDays(rangeEnd, 1).toISOString() },
    }),
    staleTime: 3 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
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
    if (/coach|role ?play|pathway|mastery|1[:-]?1|one[- ]on[- ]one/.test(t)) return "coaching";
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
  type GroupedEvent = TeamEvent & { members: { name: string; color: string }[] };
  // The same meeting mirrored on several connected calendars collapses to one
  // chip carrying every member (founder 2026-07-29: the team meeting once,
  // with a shaded color or tag per person to distinguish).
  const groupEvents = (list: TeamEvent[]): GroupedEvent[] => {
    const out: GroupedEvent[] = [];
    const byKey = new Map<string, GroupedEvent>();
    for (const e of list) {
      const key = `${e.start}|${(e.summary ?? "").trim().toLowerCase()}`;
      const g = byKey.get(key);
      if (g) {
        if (!g.members.some(m => m.name === e.display_name)) g.members.push({ name: e.display_name, color: e.color });
      } else {
        const ng = { ...e, members: [{ name: e.display_name, color: e.color }] };
        byKey.set(key, ng);
        out.push(ng);
      }
    }
    return out;
  };

  const visibleEvents = (events.data ?? []).filter((e) =>
    !hiddenUsers.has(e.user_id) && (typeFilter === "all" || classify(e.summary ?? "") === typeFilter));

  const toggleUser = (uid: string) => {
    setHiddenUsers((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-none p-4 sm:p-6 space-y-5">
        <PageHeader
          title="Calendar"
          subtitle="Schedule, set reminders, ownership, attendance, and follow-up in one workspace."
          actions={<div className="flex flex-wrap items-center justify-end gap-2">
            {myConn.data ? (
              <>
                <Button className="min-h-10" size="sm" onClick={() => setSetOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Log a set
                </Button>
                <Badge variant="outline" className="min-h-8 max-w-52 gap-1.5 truncate">
                  <span className="h-2 w-2 rounded-full" style={{ background: myConn.data.color_hex }} />
                  {myConn.data.google_email ?? "Connected"}
                </Badge>
                <Button className="min-h-10" size="sm" variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                  <Link2Off className="h-4 w-4 mr-1.5" /> Disconnect
                </Button>
              </>
            ) : (
              <Button className="min-h-10" size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
                <CalendarClock className="h-4 w-4 mr-2" />
                {connect.isPending ? "Redirecting…" : "Connect Google Calendar"}
              </Button>
            )}
            {pageView === "calendar" && (
              <Button className="h-10 w-10" size="icon" variant="ghost" onClick={() => events.refetch()} aria-label="Refresh calendar">
                <RefreshCw className={`h-4 w-4 ${events.isFetching ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>}
        />

        <div
          className={`card-surface grid w-full gap-1 border-0 p-1 shadow-none sm:w-fit ${canUseTracker ? "grid-cols-2" : "grid-cols-1"}`}
          role="tablist"
          aria-label="Calendar workspace views"
        >
          <button role="tab" aria-selected={pageView === "calendar"} onClick={() => changePageView("calendar")} className={`min-h-12 rounded-lg px-5 text-body font-medium transition-colors ${pageView === "calendar" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Schedule</button>
          {canUseTracker && (
            <button role="tab" aria-selected={pageView === "tracker"} onClick={() => changePageView("tracker")} className={`min-h-12 rounded-lg px-5 text-body font-medium transition-colors ${pageView === "tracker" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Setter tracker</button>
          )}
        </div>

        {pageView === "calendar" && (<>
        {/* Connected team + filters */}
        <Card className="card-surface border-0 p-4 shadow-none">
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
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-caption transition-colors ${
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
                      className="min-h-10 px-2 text-caption text-muted-foreground hover:text-foreground"
                    >
                      Show all
                    </button>
                    {user && teamList.some((m) => m.user_id === user.id) && (
                      <button
                        onClick={() => setHiddenUsers(new Set(teamList.filter((m) => m.user_id !== user.id).map((m) => m.user_id)))}
                        className="min-h-10 px-2 text-caption text-muted-foreground hover:text-foreground"
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
                {(["week", "month"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => changeCalView(v)}
                    className={`text-caption font-medium px-2.5 py-1 rounded-[7px] capitalize motion-safe:transition-colors ${calView === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
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
                    className={`min-h-10 rounded-md px-3 py-2 text-caption font-medium transition-colors ${typeFilter === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <TzPicker value={tz} onChange={changeTz} />
              <Button className="h-10 w-10" size="icon" variant="ghost" onClick={() => calView === "month" ? setMonthAnchor(a => subMonths(a, 1)) : setWeekStart((w) => (daySpan === 7 ? subWeeks(w, 1) : addDays(w, -daySpan)))} aria-label="Previous dates">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button className="min-h-10" size="sm" variant="ghost" onClick={() => { const now = shiftToTz(new Date(), tz); if (calView === "month") { setMonthAnchor(new Date(now.getFullYear(), now.getMonth(), 1)); } else { now.setHours(0, 0, 0, 0); setWeekStart(daySpan === 7 ? startOfWeek(now, { weekStartsOn: 1 }) : now); } }}>
                Today
              </Button>
              <Button className="h-10 w-10" size="icon" variant="ghost" onClick={() => calView === "month" ? setMonthAnchor(a => addMonths(a, 1)) : setWeekStart((w) => (daySpan === 7 ? addWeeks(w, 1) : addDays(w, daySpan)))} aria-label="Next dates">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-1 sm:ml-2 basis-full sm:basis-auto text-sm text-muted-foreground tabular-nums">
                {calView === "month" ? format(monthAnchor, "MMMM yyyy") : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
              </span>
            </div>
          </div>
        </Card>

        {calView === "month" && (
          <Card className="p-0 border-border/60 overflow-hidden relative">
            <div className="grid grid-cols-7 border-b border-border/60 bg-card">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="px-2 py-2 text-[11px] uppercase tracking-wide text-muted-foreground text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7" style={{ gridAutoRows: isMobile ? "minmax(84px, 1fr)" : "minmax(118px, 1fr)", minHeight: isMobile ? "48vh" : "60vh" }}>
              {Array.from({ length: Math.round((monthGridEnd.getTime() - monthGridStart.getTime()) / 86400000) + 1 }, (_, i) => addDays(monthGridStart, i)).map((day, i) => {
                const inMonth = day.getMonth() === monthAnchor.getMonth();
                const isToday = isSameDay(day, toLocal(new Date()));
                const dayEvents = groupEvents(visibleEvents
                  .filter(e => isSameDay(toLocal(new Date(e.start)), day))
                  .sort((a, b) => a.start.localeCompare(b.start)));
                const shown = dayEvents.slice(0, 4);
                const drill = () => { changeCalView("week"); setWeekStart(daySpan === 7 ? startOfWeek(day, { weekStartsOn: 1 }) : day); };
                return (
                  <div key={i} className={`border-b border-l border-border/40 [&:nth-child(7n+1)]:border-l-0 px-1.5 py-1.5 min-w-0 flex flex-col gap-1 ${inMonth ? "" : "bg-muted/30"}`}>
                    <button onClick={drill} className="self-end" title="Open this week">
                      <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] tabular-nums ${isToday ? "bg-danger text-white font-semibold" : inMonth ? "text-foreground" : "text-muted-foreground/60"}`}>
                        {day.getDate() === 1 ? format(day, "MMM d") : day.getDate()}
                      </span>
                    </button>
                    {shown.map(e => (
                      <button
                        key={e.id}
                        onClick={() => setSelectedEvent(e)}
                        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] leading-4 hover:bg-muted/60 motion-safe:transition-colors min-w-0"
                        style={{ borderLeft: `2px solid ${e.members[0]?.color ?? "var(--border)"}` }}
                        title={`${e.summary ?? ""} · ${e.members.map(m => m.name).join(", ")}`}
                      >
                        <span className="flex shrink-0 -space-x-0.5">
                          {e.members.slice(0, 3).map(m => (
                            <span key={m.name} className="h-1.5 w-1.5 rounded-full ring-1 ring-[var(--card)]" style={{ background: m.color }} />
                          ))}
                        </span>
                        <span className="tabular-nums text-muted-foreground shrink-0">{format(toLocal(new Date(e.start)), "HH:mm")}</span>
                        <span className="truncate text-foreground">{e.summary ?? "Untitled"}</span>
                      </button>
                    ))}
                    {dayEvents.length > shown.length && (
                      <button onClick={drill} className="text-left text-[10px] text-muted-foreground hover:text-foreground px-1">
                        +{dayEvents.length - shown.length} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {events.isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground border-t border-border/60">Loading team calendar…</div>
            )}
            {!events.isLoading && (events.data?.length ?? 0) === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground border-t border-border/60">
                {teamList.length === 0 ? "Connect your Google Calendar to start seeing events here." : "No events this month."}
              </div>
            )}
          </Card>
        )}

        {calView === "week" && (
        <Card className="p-0 border-border/60 overflow-hidden relative">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${daySpan}, minmax(0, 1fr))` }}>
            {days.map((d, ci) => {
              const today = isSameDay(d, toLocal(new Date()));
              const dayEvents = groupEvents(visibleEvents
                .filter(e => isSameDay(toLocal(new Date(e.start)), d))
                .sort((a, b) => a.start.localeCompare(b.start)));
              const slots: (typeof dayEvents)[] = [];
              for (const g of dayEvents) {
                const last = slots[slots.length - 1];
                if (last && last[0].start === g.start) last.push(g); else slots.push([g]);
              }
              return (
                <div key={d.toISOString()} className={`min-w-0 flex flex-col ${ci > 0 ? "border-l border-border/40" : ""}`}>
                  <div className="border-b border-border/60 bg-card px-2 py-2 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{format(d, "EEE")}</div>
                    <span className={`mx-auto mt-0.5 grid h-6 min-w-6 place-items-center rounded-full px-1 text-sm font-semibold tabular-nums ${today ? "bg-danger text-white" : ""}`}>
                      {format(d, "d")}
                    </span>
                  </div>
                  <div className="flex-1 min-h-[52vh] max-h-[68vh] overflow-y-auto overscroll-contain p-1.5 space-y-1">
                    {slots.map((slot, si) => (
                      <div key={si} className={slot.length > 1 ? "grid grid-cols-2 gap-1" : ""}>
                        {slot.map(e => (
                          <button
                            key={e.id}
                            onClick={() => setSelectedEvent(e)}
                            className="w-full rounded-[5px] hover:bg-muted/70 px-1.5 py-1.5 text-left motion-safe:transition-colors min-w-0"
                            style={{
                              borderLeft: `2px solid color-mix(in srgb, ${e.members[0]?.color ?? "var(--border)"} 60%, var(--border))`,
                              background: e.members.length === 1 ? `color-mix(in srgb, ${e.members[0].color} 5%, transparent)` : "var(--muted)",
                            }}
                            title={`${e.summary ?? ""} · ${e.members.map(m => m.name).join(", ")}`}
                          >
                            <span className="flex items-center gap-1.5 text-[11px] leading-4 min-w-0">
                              <span className="tabular-nums text-muted-foreground shrink-0">{format(toLocal(new Date(e.start)), "HH:mm")}</span>
                              {e.members.length === 1 ? (
                                <span className="truncate text-muted-foreground">{shortName(e.members[0].name)}</span>
                              ) : (
                                <span className="flex items-center gap-1 shrink-0">
                                  <span className="flex -space-x-1">
                                    {e.members.slice(0, 4).map(m => (
                                      <span key={m.name} className="h-2 w-2 rounded-full ring-1 ring-[var(--card)]" style={{ background: m.color }} />
                                    ))}
                                  </span>
                                  <span className="text-muted-foreground">×{e.members.length}</span>
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] leading-4 text-foreground">{e.summary ?? "Untitled"}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {dayEvents.length === 0 && (
                      <div className="pt-4 text-center text-[11px] text-muted-foreground/60">–</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {events.isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground border-t border-border/60">Loading team calendar…</div>
          )}
          {events.isError && (
            <div className="border-t border-border p-5 text-center">
              <p className="text-body font-medium text-foreground">Calendar events could not be loaded.</p>
              <p className="mt-1 text-caption text-muted-foreground">{events.error.message}</p>
              <Button className="mt-3 min-h-10" size="sm" variant="outline" onClick={() => events.refetch()}>
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          )}
          {!events.isLoading && !events.isError && (events.data?.length ?? 0) === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground border-t border-border/60">
              {teamList.length === 0 ? "Connect your Google Calendar to start seeing events here." : "No events this week."}
            </div>
          )}
        </Card>
        )}

        </>)}

        {/* Set reminders — every upcoming set and its reminder schedule */}
        {pageView === "tracker" && canUseTracker && (
        <Card className="card-surface space-y-4 border-0 p-5 shadow-none">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-title text-foreground">Set reminders</h2>
              <p className="text-caption text-muted-foreground">Closing-call bookings (Pathway Onboarding + ISA Call links) land here automatically · coaching calls never do. Tick each reminder as you send it, confirm the lead, and cancel only when a human has verified the change.</p>
            </div>
            {canViewTeamSets && (
              <div className="flex gap-1">
                {(["all", "mine"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSetsFilter(f)}
                    className={`min-h-10 rounded-md px-3 py-2 text-caption font-medium transition-colors ${setsFilter === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    {f === "all" ? "All sets" : "My sets"}
                  </button>
                ))}
              </div>
            )}
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
              { label: "Unclaimed", value: live.filter((s) => !s.owner_id).length, cls: "text-foreground" },
              { label: "Reminder due", value: dueNow, cls: "text-foreground" },
              { label: "Unconfirmed", value: live.filter((s) => !s.confirmed_at).length, cls: "text-foreground" },
              { label: "Confirmed", value: live.filter((s) => !!s.confirmed_at).length, cls: "text-foreground" },
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
                const r = await unclaimSetFn({ data: { id } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                if (r.warning) toast.warning(r.warning);
                else toast.success("Unclaimed · back in the pool and removed from the calendar.");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            onAssign={async (id, userId) => {
              try {
                const r = await assignSetFn({ data: { id, userId } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                if (r.warning) toast.warning(r.warning);
                else toast.success(r.calendar ? "Assigned · it's on their calendar with reminders." : "Assigned.");
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
              if (confirm) toast.success("Confirmed · the slot is locked in.");
              trackSetFn({ data: { id, confirm } }).catch((err) => {
                toast.error(String((err as Error).message ?? err));
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
              });
            }}
            onNotes={(id, notes) => {
              qc.setQueryData<UpcomingSet[]>(["cal", "sets"], (old) => (old ?? []).map((r) =>
                r.id === id ? { ...r, notes: notes.trim() || null } : r,
              ));
              trackSetFn({ data: { id, notes } }).then(() => toast.success("Notes saved")).catch((err) => {
                toast.error(String((err as Error).message ?? err));
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
              });
            }}
            onCancel={async (id) => {
              try {
                const r = await cancelSetFn({ data: { id, reason: "removed manually" } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                if (r.warning) toast.warning(r.warning);
                else toast.success(r.calendarRemoved ? "Cancelled and removed from the calendar. Undo below if that was a mistake." : "Cancelled · undo below if that was a mistake.");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            onRestore={async (id) => {
              try {
                const r = await restoreSetFn({ data: { id } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                if (r.warning) toast.warning(r.warning);
                else toast.success(r.calendarRestored ? "Restored · it's back on the calendar with reminders." : "Restored to the list.");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            onClaim={async (id) => {
              try {
                const r = await claimSetFn({ data: { id } });
                qc.invalidateQueries({ queryKey: ["cal", "sets"] });
                if (r.warning) toast.warning(r.warning);
                else toast.success("Claimed · it's on your calendar with reminders 2d · 1d · 3h · 1h before.");
              } catch (err) { toast.error(String((err as Error).message ?? err)); }
            }}
            loading={upcomingSets.isLoading}
            filter={setsFilter}
          />
        </Card>
        )}

        {pageView === "tracker" && canUseTracker && (<div className="space-y-5"><SetterDailyTracker /><SetterTrackingSheet /></div>)}

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
                toast.success("Set claimed · it's on your calendar with reminders 2d · 1d · 3h · 1h before.");
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

        {/* Cash flow calendar — founder/cofounder ONLY on this page
            (founder-directed 2026-07-28); everyone else sees nothing here. */}
        {pageView === "calendar" && <CashInCalendarCard foundersOnly />}
      </div>
      {setOpen && (
        <SetReminderDialog
          onClose={() => setSetOpen(false)}
          onCreate={async (input) => {
            try {
              const r = await setReminderFn({ data: { ...input, source: "manual" as const } });
              qc.invalidateQueries({ queryKey: ["cal", "sets"] });
              toast.success("Set logged · reminders at 2 days, 1 day, 3 hours, and 1 hour before.");
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

const WINDOWS: { key: "48h" | "24h" | "3h" | "1h"; label: string; full: string; minutes: number }[] = [
  { key: "48h", label: "48h", full: "2 days before", minutes: 48 * 60 },
  { key: "24h", label: "24h", full: "1 day before", minutes: 24 * 60 },
  { key: "3h", label: "3h", full: "3 hours before", minutes: 3 * 60 },
  { key: "1h", label: "1h", full: "1 hour before", minutes: 60 },
];

function UpcomingSetsList({ sets, loading, filter, onClaim, onTrack, onConfirm, onCancel, onRestore, onUnclaim, onAssign, onNotes, team = [], toLocal, big = false }: {
  sets: UpcomingSet[];
  loading: boolean;
  filter: "all" | "mine";

  onClaim: (id: string) => void;
  onTrack: (id: string, window: ReminderWindow | string, state: ReminderState | null) => void;
  onConfirm: (id: string, confirm: boolean) => void;
  onCancel: (id: string) => void;
  onRestore: (id: string) => void;
  onUnclaim?: (id: string) => void;
  onAssign?: (id: string, userId: string) => void;
  onNotes?: (id: string, notes: string) => void;
  team?: { id: string; display_name: string | null }[];
  toLocal: (iso: string | Date) => Date;
  big?: boolean;
}) {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const canManageTeam = roles.some((role) => ["admin", "founder", "cofounder", "closer"].includes(role));
  // "My sets" = mine + UNCLAIMED. New bookings have no owner yet — hiding
  // them behind "All sets" made new setters think no sets were coming in.
  const pool = filter === "mine" ? sets.filter((s) => s.owner_id === user?.id || s.owner_id === null) : sets;
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
        {filter === "mine" ? "Nothing here yet · your claimed sets and any unclaimed new bookings will show up here. Check All sets to see the whole team's." : "No upcoming sets yet. New closing-call bookings land here automatically."}
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
        const canTrack = mine || canManageTeam;
        const todayWarmKey = "warm:" + new Intl.DateTimeFormat("en-CA").format(new Date());
        const warmToday = !!(s.reminder_log as Record<string, string> | undefined)?.[todayWarmKey];
        const farOut = msLeft > 48 * 3_600_000;
        const log = s.reminder_log as Record<string, string> | null | undefined;
        const sentCount = WINDOWS.filter((w) => log?.[w.key] === "reminded" || log?.[w.key] === "confirmed").length;
        const openDue = WINDOWS.filter((w) => msLeft > 0 && msLeft <= w.minutes * 60_000 && !log?.[w.key]);
        const nextToOpen = WINDOWS.find((w) => msLeft > w.minutes * 60_000);
        // The freshest window the lead confirmed at (WINDOWS runs 48h → 1h)
        const confirmedWins = WINDOWS.filter((w) => log?.[w.key] === "confirmed");
        const freshestConfirm = confirmedWins[confirmedWins.length - 1] ?? null;
        return (
          // Your own sets get a rail + tint so ownership is never a guess
          <div key={s.id} className={`${big ? "py-4 space-y-2.5" : "py-2.5 space-y-1.5"} ${mine && big ? "border-l-2 border-primary/40 bg-primary/5 rounded-sm -mx-2 px-2 pl-3" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-[55%] flex-1">
                <div className={`${big ? "text-[15px]" : "text-body"} font-medium text-foreground truncate`}>
                  {s.prospect}
                  {s.source === "calendly" && <span className="ml-2 text-micro text-muted-foreground">calendly</span>}
                </div>
                <div className="text-caption truncate">
                  <span className="text-muted-foreground">{format(start, "EEE, MMM d · h:mm a")}</span>
                </div>
              </div>
              {/* Who owns this set — loud and first, so nobody works someone else's lead */}
              {s.owner_id ? (
                <span className={`inline-flex items-center gap-1.5 text-micro font-medium rounded-full pl-1 pr-2 py-0.5 border shrink-0 ${mine ? "text-primary border-primary/25 bg-primary/10" : "text-muted-foreground border-border bg-muted"}`}>
                  <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-semibold ${mine ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-foreground"}`}>
                    {(s.owner_name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  {mine ? "Your set" : s.owner_name}
                </span>
              ) : (
                <span className="text-micro font-medium text-foreground bg-muted border border-border rounded-full px-2 py-0.5 shrink-0">
                  Unclaimed · needs a setter
                </span>
              )}
              {confirmed ? (
                <span className="text-micro font-medium text-background bg-foreground border border-foreground rounded-full px-2 py-0.5 shrink-0">
                  {freshestConfirm ? `Confirmed at ${freshestConfirm.label}` : "Confirmed"}
                </span>
              ) : (
                <span className={`text-micro font-medium rounded-full px-2 py-0.5 border shrink-0 ${inDanger ? "text-background bg-foreground border-foreground" : "text-muted-foreground bg-muted border-border"}`}>
                  {inDanger ? "Unconfirmed · verify now" : "Unconfirmed"}
                </span>
              )}
              {!s.owner_id && (
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-caption shrink-0" onClick={() => onClaim(s.id)}>
                  Claim
                </Button>
              )}
              {onAssign && (canManageTeam || mine) && team.length > 0 && (
                <SelectField
                  value=""
                  onChange={(v) => { if (v) onAssign(s.id, v); }}
                  placeholder={s.owner_id ? "Reassign…" : "Assign…"}
                  className="h-7 w-28 text-caption shrink-0"
                  options={team.map((t) => ({ value: t.id, label: t.display_name ?? "Teammate" }))}
                />
              )}
              {s.owner_id && onUnclaim && (mine || canManageTeam) && (
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

            </div>

            {/* What's done and what's next — at a glance, no chip-reading needed */}
            {big && s.owner_id && s.status === "active" && (
              <div className="text-micro text-muted-foreground pl-0.5">
                <span className={sentCount === WINDOWS.length ? "font-medium text-foreground" : ""}>{sentCount}/{WINDOWS.length} reminders sent</span>
                {openDue.length > 0 ? (
                  <span className="font-semibold text-foreground"> · {openDue[0].label} reminder due now · send it</span>
                ) : nextToOpen ? (
                  <span> · next ({nextToOpen.label}) opens in {durLabel(msLeft - nextToOpen.minutes * 60_000)}</span>
                ) : null}
                {freshestConfirm
                  ? <span className="font-medium text-foreground"> · lead confirmed at the {freshestConfirm.label} reminder</span>
                  : confirmed
                    ? <span className="font-medium text-foreground"> · confirmed (not tied to a reminder)</span>
                    : <span> · not confirmed by the lead yet</span>}
              </div>
            )}

            {/* Reminder tracker — big view gets a per-window checklist, small view keeps chips */}
            {s.owner_id && big && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {WINDOWS.map((w) => {
                    const state = log?.[w.key];
                    const windowOpen = msLeft > 0 && msLeft <= w.minutes * 60_000;
                    const opensAt = new Date(new Date(s.event_start).getTime() - w.minutes * 60_000);
                    // Cycle: sent → lead confirmed → no reply → clear
                    const next: ReminderState | null =
                      state === "reminded" ? "confirmed"
                      : state === "confirmed" ? "no_response"
                      : state === "no_response" ? null
                      : "reminded";
                    return (
                      <button
                        key={w.key}
                        disabled={!canTrack}
                        onClick={() => onTrack(s.id, w.key, next)}
                        aria-pressed={state === "reminded" || state === "confirmed"}
                        aria-label={`${w.full} reminder for ${s.prospect}`}
                        className={`text-left rounded-md border px-3 py-2 motion-safe:transition-colors disabled:cursor-default ${
                          state === "confirmed"
                            ? "border-foreground/40 bg-muted"
                            : state === "reminded"
                              ? "border-foreground/25 bg-muted"
                              : state === "no_response"
                                ? "border-border bg-muted"
                                : windowOpen
                                  ? "border-foreground/40 bg-muted"
                                  : "border-border bg-[var(--background)] hover:bg-muted/60"
                        }`}
                      >
                        <div className={`text-caption font-medium ${state === "no_response" ? "text-muted-foreground" : "text-foreground"}`}>
                          {w.full}
                          {state === "confirmed" ? " · confirmed ✓" : state === "reminded" ? " · sent" : state === "no_response" ? " · no reply" : ""}
                        </div>
                        <div className="text-micro text-muted-foreground mt-0.5">
                          {state === "confirmed"
                            ? "lead confirmed at this reminder"
                            : state === "reminded"
                              ? "tap when they confirm · tap twice for no reply"
                              : state === "no_response"
                                ? "tap to clear"
                                : windowOpen
                                  ? "due now · tap once sent"
                                  : msLeft <= 0 ? "call has started" : `opens ${format(toLocal(opensAt), "EEE h:mm a")}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {farOut && (
                    <button
                      disabled={!canTrack}
                      onClick={() => onTrack(s.id, todayWarmKey, warmToday ? null : "reminded")}
                      title={warmToday ? "Warm touch logged today · click to undo" : "Booked days out · send one warm touch per day so the lead stays engaged"}
                      className={`text-caption font-medium rounded-md px-3 py-1.5 border motion-safe:transition-colors disabled:cursor-default ${
                        warmToday
                          ? "text-background bg-foreground border-foreground"
                          : "text-foreground bg-muted border-foreground/25 animate-pulse"
                      }`}
                    >
                      {warmToday ? "Kept warm today ✓" : "Keep warm today"}
                    </button>
                  )}
                  {canTrack && (confirmed ? (
                    <button onClick={() => onConfirm(s.id, false)} className="text-caption text-muted-foreground hover:text-foreground" title="Undo confirmation">
                      Confirmed {format(toLocal(s.confirmed_at!), "MMM d, h:mm a")} · undo
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onConfirm(s.id, true)}
                        className="text-caption font-medium rounded-md px-3 py-1.5 border border-foreground/25 text-foreground hover:bg-muted motion-safe:transition-colors"
                      >
                        Lead confirmed ✓
                      </button>
                      <button onClick={() => onCancel(s.id)} className="text-caption text-muted-foreground hover:text-foreground motion-safe:transition-colors">
                        Didn't confirm · remove from calendar
                      </button>
                    </>
                  ))}
                </div>
              </div>
            )}
            {/* Notes — CRM context for the person working this set */}
            {big && onNotes && s.status === "active" && (canTrack || !s.owner_id) && (
              <SetNotes id={s.id} initial={s.notes ?? ""} onSave={onNotes} />
            )}

            {s.owner_id && !big && (
              <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
                <span className="text-micro text-muted-foreground mr-0.5">Reminders:</span>
                {WINDOWS.map((w) => {
                  const state = s.reminder_log?.[w.key];
                  const windowOpen = msLeft <= w.minutes * 60_000;
                  const next: ReminderState | null =
                    state === "reminded" ? "confirmed"
                    : state === "confirmed" ? "no_response"
                    : state === "no_response" ? null
                    : "reminded";
                  return (
                    <button
                      key={w.key}
                      disabled={!canTrack}
                      onClick={() => onTrack(s.id, w.key, next)}
                      title={state === "reminded" ? `${w.label}: sent · click when the lead confirms` : state === "confirmed" ? `${w.label}: lead confirmed · click for 'no response'` : state === "no_response" ? `${w.label}: reached out, no response · click to clear` : windowOpen ? `${w.label} window open · click when you've sent the reminder` : `${w.label} before the call`}
                      className={`text-micro font-medium rounded-full px-2 py-0.5 border motion-safe:transition-colors disabled:cursor-default ${
                        state === "confirmed"
                          ? "text-background bg-foreground border-foreground"
                          : state === "reminded"
                            ? "text-primary bg-primary/10 border-primary/25"
                            : state === "no_response"
                              ? "text-muted-foreground bg-muted border-border"
                              : windowOpen
                                ? "text-foreground bg-muted border-border animate-pulse"
                                : "text-muted-foreground bg-transparent border-border"
                      }`}
                    >
                      {w.label}{state === "confirmed" ? " ✓✓" : state === "reminded" ? " ✓" : state === "no_response" ? " · no reply" : ""}
                    </button>
                  );
                })}
                {canTrack && (confirmed ? (
                  <button onClick={() => onConfirm(s.id, false)} className="text-micro text-muted-foreground hover:text-foreground" title="Undo confirmation">
                    confirmed · undo
                  </button>
                ) : (
                  <button onClick={() => onConfirm(s.id, true)} className="text-micro font-medium text-foreground hover:opacity-70">
                    Lead confirmed ✓
                  </button>
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
              <span className="text-micro text-muted-foreground shrink-0">cancelled</span>
              {new Date(s.event_start).getTime() > Date.now() && (
                <button onClick={() => onRestore(s.id)} className="text-micro font-medium text-primary hover:opacity-80 shrink-0">
                  Undo
                </button>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Inline CRM-style notes on a set: click to expand, saves on blur. */
function SetNotes({ id, initial, onSave }: { id: string; initial: string; onSave: (id: string, notes: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  useEffect(() => { setDraft(initial); }, [initial]);
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="block w-full text-left text-[12px] rounded-md border border-transparent hover:border-border px-2 py-1 -mx-2 motion-safe:transition-colors"
        title="Click to edit notes"
      >
        {initial
          ? <span className="text-muted-foreground whitespace-pre-wrap">{initial}</span>
          : <span className="text-muted-foreground/60 italic">Add notes · objections, context, CRM info…</span>}
      </button>
    );
  }
  return (
    <textarea
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== initial) onSave(id, draft); }}
      rows={3}
      placeholder="Objections, context, CRM info…"
      className="w-full bg-[var(--background)] border border-border rounded-md px-2 py-1.5 text-[12px] resize-none focus:outline-none focus:border-ring"
    />
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
