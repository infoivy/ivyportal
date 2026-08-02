import { useEffect, useMemo, useState } from "react";
import { friendlyPastDay } from "@/lib/dates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  ListChecks,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { cancelSet, restoreSet } from "@/lib/calendar.functions";
import {
  completeSetFollowUp,
  getSetterTracker,
  listSetterTrackerMembers,
  scheduleSetFollowUp,
  updateSetLifecycle,
  type SetterTrackerData,
  type TrackerAttendance,
  type TrackerEvent,
  type TrackerFollowUp,
  type TrackerFollowUpChannel,
  type TrackerLeadChannel,
  type TrackerOutcome,
  type TrackerQualification,
  type TrackerSet,
} from "@/lib/setter-tracker.functions";

const RANGE_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];
const CHANNEL_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];
const QUALIFICATION_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
];
const ATTENDANCE_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "showed", label: "Showed" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];
const OUTCOME_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "follow_up", label: "Follow-up" },
  { value: "closed", label: "Closed" },
  { value: "lost", label: "Lost" },
];
const FOLLOW_UP_CHANNEL_OPTIONS = [
  { value: "dm", label: "DM" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];
const REMINDER_WINDOWS = [
  { key: "48h", minutes: 48 * 60 },
  { key: "24h", minutes: 24 * 60 },
  { key: "3h", minutes: 3 * 60 },
  { key: "1h", minutes: 60 },
] as const;

type SetFilter = "action" | "all" | "upcoming" | "history";
type LifecyclePatch = {
  leadChannel?: TrackerLeadChannel;
  qualificationStatus?: TrackerQualification;
  attendanceStatus?: TrackerAttendance;
  salesOutcome?: TrackerOutcome;
  notes?: string | null;
};

function isReminderDue(set: TrackerSet, now = Date.now()): boolean {
  if (set.status !== "active" || set.confirmed_at) return false;
  const msLeft = new Date(set.event_start).getTime() - now;
  if (msLeft <= 0) return false;
  const log = (set.reminder_log ?? {}) as Record<string, unknown>;
  return REMINDER_WINDOWS.some((window) => msLeft <= window.minutes * 60_000 && !log[window.key]);
}

function currentFollowUp(followUps: TrackerFollowUp[], setId: string): TrackerFollowUp | undefined {
  return followUps.find((followUp) => followUp.set_id === setId && followUp.status === "open");
}

function formatMetric(value: number | null | undefined): string {
  return value == null ? "Unavailable" : value.toLocaleString();
}

function formatDateTime(value: string): string {
  return format(new Date(value), "MMM d · h:mm a");
}

function dateKeyForTimeZone(value: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function localDateTimeValue(date = new Date(Date.now() + 86_400_000)): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function statusLabel(value: string): string {
  if (value === "no_show") return "No-show";
  if (value === "follow_up") return "Follow-up";
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function eventValue(event: TrackerEvent, key: string): unknown {
  const value = event.to_value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

function eventDetail(event: TrackerEvent): string | null {
  const keyByType: Record<string, string> = {
    status_changed: "status",
    channel_changed: "lead_channel",
    qualification_changed: "qualification_status",
    attendance_changed: "attendance_status",
    outcome_changed: "sales_outcome",
  };
  if (event.event_type === "assignment_changed") {
    return eventValue(event, "owner_id") ? "Assigned" : "Unclaimed";
  }
  if (event.event_type === "confirmation_changed") {
    return eventValue(event, "confirmed_at") ? "Confirmed" : "Confirmation cleared";
  }
  if (event.event_type === "follow_up_created" || event.event_type === "follow_up_changed") {
    const status = eventValue(event, "status");
    const dueAt = eventValue(event, "due_at");
    const parts = [
      typeof status === "string" ? statusLabel(status) : null,
      typeof dueAt === "string" ? formatDateTime(dueAt) : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  const key = keyByType[event.event_type];
  const value = key ? eventValue(event, key) : undefined;
  return typeof value === "string" ? statusLabel(value) : null;
}

function StatusBadge({ value, urgent = false }: { value: string; urgent?: boolean }) {
  const active = ["showed", "closed", "qualified", "completed", "confirmed"].includes(value);
  return (
    <Badge
      variant="outline"
      className={
        urgent
          ? "border-foreground/40 bg-muted text-foreground"
          : active
            ? "border-foreground/20 bg-foreground text-background"
            : "border-border bg-muted text-muted-foreground"
      }
    >
      {statusLabel(value)}
    </Badge>
  );
}

function TrackerStat({
  label,
  value,
  note,
  urgent = false,
}: {
  label: string;
  value: string;
  note: string;
  urgent?: boolean;
}) {
  return (
    <Card className="card-surface border-0 p-4 shadow-none">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p
        className={
          urgent
            ? "mt-2 text-metric font-semibold text-foreground"
            : "mt-2 text-metric text-foreground"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-micro text-muted-foreground">{note}</p>
    </Card>
  );
}

function TrackerLoading() {
  return (
    <div className="space-y-4" aria-label="Loading setter tracker">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function LifecycleSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <SelectField
      aria-label={label}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      className="h-9 min-w-28 bg-background text-caption"
    />
  );
}

export function SetterTrackingSheet() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const membersFn = useServerFn(listSetterTrackerMembers);
  const trackerFn = useServerFn(getSetterTracker);
  const lifecycleFn = useServerFn(updateSetLifecycle);
  const scheduleFn = useServerFn(scheduleSetFollowUp);
  const completeFn = useServerFn(completeSetFollowUp);
  const cancelFn = useServerFn(cancelSet);
  const restoreFn = useServerFn(restoreSet);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [filter, setFilter] = useState<SetFilter>("action");
  const [search, setSearch] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["setter-tracker", "members"],
    queryFn: () => membersFn(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const available = members.data?.members ?? [];
    if (available.length === 0 || available.some((member) => member.id === selectedUserId)) return;
    const own = available.find((member) => member.id === user?.id);
    setSelectedUserId((own ?? available[0]).id);
  }, [members.data, selectedUserId, user?.id]);

  const tracker = useQuery({
    queryKey: ["setter-tracker", selectedUserId, rangeDays],
    queryFn: () => trackerFn({ data: { targetUserId: selectedUserId, days: rangeDays } }),
    enabled: Boolean(selectedUserId),
    staleTime: 30_000,
  });

  const invalidateTracker = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["setter-tracker", selectedUserId] }),
      queryClient.invalidateQueries({ queryKey: ["cal", "sets"] }),
    ]);
  };

  const lifecycle = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LifecyclePatch }) =>
      lifecycleFn({ data: { id, ...patch } }),
    onSuccess: async () => {
      await invalidateTracker();
      toast.success("Set tracking updated");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update set tracking"),
  });

  const schedule = useMutation({
    mutationFn: (payload: {
      setId: string;
      dueAt: string;
      channel: TrackerFollowUpChannel;
      note: string | null;
    }) => scheduleFn({ data: payload }),
    onSuccess: async () => {
      await invalidateTracker();
      toast.success("Follow-up scheduled");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not schedule follow-up"),
  });

  const complete = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "completed" | "cancelled" }) =>
      completeFn({ data: { id, status } }),
    onSuccess: async (_, variables) => {
      await invalidateTracker();
      toast.success(
        variables.status === "completed" ? "Follow-up completed" : "Follow-up cancelled",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update follow-up"),
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelFn({ data: { id, reason } }),
    onSuccess: async (result) => {
      await invalidateTracker();
      const warning = (result as { warning?: string } | null)?.warning;
      if (warning) toast.warning(warning);
      else toast.success("Set cancelled · it no longer counts toward your show rate");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not cancel the set"),
  });

  const restore = useMutation({
    mutationFn: ({ id }: { id: string }) => restoreFn({ data: { id } }),
    onSuccess: async (result) => {
      await invalidateTracker();
      const warning = (result as { warning?: string } | null)?.warning;
      if (warning) toast.warning(warning);
      else toast.success("Set restored");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not restore the set"),
  });

  const data = tracker.data;
  const visibleSets = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    const filtered = data.sets.filter((set) => {
      if (query && !set.prospect.toLowerCase().includes(query)) return false;
      const upcoming = new Date(set.event_start).getTime() > Date.now();
      const followUp = currentFollowUp(data.followUps, set.id);
      if (filter === "upcoming") return upcoming && set.status === "active";
      if (filter === "history") return !upcoming || set.status !== "active";
      if (filter === "action") return isReminderDue(set) || Boolean(followUp);
      return true;
    });

    return filtered.sort((a, b) => {
      const aFollowUp = currentFollowUp(data.followUps, a.id);
      const bFollowUp = currentFollowUp(data.followUps, b.id);
      const aScore =
        aFollowUp && new Date(aFollowUp.due_at).getTime() <= Date.now()
          ? 0
          : isReminderDue(a)
            ? 1
            : 2;
      const bScore =
        bFollowUp && new Date(bFollowUp.due_at).getTime() <= Date.now()
          ? 0
          : isReminderDue(b)
            ? 1
            : 2;
      if (aScore !== bScore) return aScore - bScore;
      return new Date(a.event_start).getTime() - new Date(b.event_start).getTime();
    });
  }, [data, filter, search]);

  if (members.isLoading) return <TrackerLoading />;
  if (members.isError) {
    return (
      <Card className="card-surface border-0 p-6 text-center shadow-none">
        <p className="text-title">Tracker unavailable</p>
        <p className="mt-2 text-body text-muted-foreground">{members.error.message}</p>
        <Button className="mt-4 min-h-12" variant="outline" onClick={() => members.refetch()}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </Card>
    );
  }
  if ((members.data?.members.length ?? 0) === 0) {
    return (
      <Card className="card-surface border-0 p-8 text-center shadow-none">
        <UserRound className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-title">No active setter sheets</p>
        <p className="mt-1 text-body text-muted-foreground">
          Assign the setter or closer role to create a native tracking sheet.
        </p>
      </Card>
    );
  }

  const now = Date.now();
  const openFollowUps = data?.followUps.filter((followUp) => followUp.status === "open") ?? [];
  const overdueFollowUps = openFollowUps.filter(
    (followUp) => new Date(followUp.due_at).getTime() <= now,
  );
  const upcomingSets =
    data?.sets.filter(
      (set) => set.status === "active" && new Date(set.event_start).getTime() > now,
    ) ?? [];
  const remindersDue = upcomingSets.filter((set) => isReminderDue(set, now));
  // Cancelled sets (duplicates, reschedules, prospect cancellations) never
  // touch the show rate: only live sets that resolved showed/no-show count.
  const countableSets = data?.sets.filter((set) => set.status !== "cancelled") ?? [];
  const showed = countableSets.filter((set) => set.attendance_status === "showed").length;
  const noShows = countableSets.filter((set) => set.attendance_status === "no_show").length;
  const showDenominator = showed + noShows;
  const showRate =
    showDenominator > 0 ? `${Math.round((showed / showDenominator) * 100)}%` : "Unavailable";
  // Same prospect with 2+ non-cancelled rows = likely double-book/reschedule
  // leftover. Flag every row in the group; the setter picks which to cancel.
  const prospectCounts = new Map<string, number>();
  for (const set of data?.sets ?? []) {
    if (set.status === "cancelled") continue;
    const key = set.prospect.trim().toLowerCase();
    prospectCounts.set(key, (prospectCounts.get(key) ?? 0) + 1);
  }
  const duplicateProspects = new Set(
    [...prospectCounts.entries()].filter(([, n]) => n > 1).map(([k]) => k),
  );
  const selectedSet = data?.sets.find((set) => set.id === selectedSetId) ?? null;
  const selectedFollowUp =
    selectedSet && data ? currentFollowUp(data.followUps, selectedSet.id) : undefined;
  const selectedEvents =
    selectedSet && data ? data.events.filter((event) => event.set_id === selectedSet.id) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-title">Setter tracker</p>
          <p className="mt-1 text-body text-muted-foreground">
            One owned sheet for sets, reminders, attendance, outcomes, follow-ups, and submitted
            activity.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
          {members.data?.canViewTeam && Boolean(selectedUserId) && (
            <SelectField
              aria-label="Setter sheet"
              value={selectedUserId}
              onChange={setSelectedUserId}
              options={(members.data?.members ?? []).map((member) => ({
                value: member.id,
                label: member.name,
              }))}
              className="min-h-12 min-w-48 bg-card sm:h-10 sm:min-h-10"
            />
          )}
          <SelectField
            aria-label="Tracking range"
            value={String(rangeDays)}
            onChange={(value) => setRangeDays(Number(value) as 7 | 30 | 90)}
            options={RANGE_OPTIONS}
            className="min-h-12 min-w-32 bg-card sm:h-10 sm:min-h-10"
          />
        </div>
      </div>

      {tracker.isError ? (
        <Card className="card-surface border-0 p-6 text-center shadow-none">
          <p className="text-title">Could not open this sheet</p>
          <p className="mt-2 text-body text-muted-foreground">{tracker.error.message}</p>
          <Button className="mt-4 min-h-12" variant="outline" onClick={() => tracker.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      ) : tracker.isLoading || !data ? (
        <TrackerLoading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <TrackerStat
              label="Upcoming sets"
              value={String(upcomingSets.length)}
              note="Next 31 days"
            />
            <TrackerStat
              label="Reminder due"
              value={String(remindersDue.length)}
              note="Unconfirmed, open window"
              urgent={remindersDue.length > 0}
            />
            <TrackerStat
              label="Follow-up due"
              value={String(overdueFollowUps.length)}
              note={`${openFollowUps.length} open total`}
              urgent={overdueFollowUps.length > 0}
            />
            <TrackerStat
              label="Show rate"
              value={showRate}
              note={`${showed} showed · ${noShows} No-show`}
            />
          </div>

          <Card className="card-surface overflow-hidden border-0 shadow-none">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-title">Set lifecycle</p>
                <p className="mt-1 text-caption text-muted-foreground">
                  Action-first. Every follow-up completion remains in history.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a prospect"
                    aria-label="Find a prospect"
                    className="min-h-12 pl-9 sm:h-10 sm:min-h-10 sm:w-48"
                  />
                </div>
                <div className="grid grid-cols-4 rounded-lg bg-muted p-1" aria-label="Set filters">
                  {(["action", "all", "upcoming", "history"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={`min-h-10 rounded-md px-3 text-caption font-medium transition-colors ${filter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {value === "action" ? "Action" : statusLabel(value)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {visibleSets.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <ListChecks className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-3 text-title">No matching sets</p>
                <p className="mt-1 text-body text-muted-foreground">
                  {filter === "action"
                    ? "No reminders or follow-ups need action right now."
                    : "Try another filter or search."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto xl:block">
                  <table className="w-full min-w-[1260px] text-left">
                    <thead className="border-b border-border bg-muted/60 text-micro uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Prospect</th>
                        <th className="px-3 py-3 font-medium">Channel</th>
                        <th className="px-3 py-3 font-medium">Qualification</th>
                        <th className="px-3 py-3 font-medium">Confirmation</th>
                        <th className="px-3 py-3 font-medium">Attendance</th>
                        <th className="px-3 py-3 font-medium">Outcome</th>
                        <th className="px-3 py-3 font-medium">Follow-up</th>
                        <th className="px-4 py-3 text-right font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleSets.map((set) => {
                        const followUp = currentFollowUp(data.followUps, set.id);
                        const reminderDue = isReminderDue(set);
                        const isCancelled = set.status === "cancelled";
                        const isDuplicate = !isCancelled && duplicateProspects.has(set.prospect.trim().toLowerCase());
                        return (
                          <tr key={set.id} className={`bg-card align-middle hover:bg-muted/30 ${isCancelled ? "opacity-55" : ""}`}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{set.prospect}</p>
                              <p className="mt-1 text-micro text-muted-foreground">
                                {formatDateTime(set.event_start)}
                              </p>
                              {isCancelled && (
                                <div className="mt-1">
                                  <StatusBadge value="Cancelled · not counted" />
                                </div>
                              )}
                              {isDuplicate && (
                                <div className="mt-1">
                                  <StatusBadge value="Possible duplicate" urgent />
                                </div>
                              )}
                              {set.calendar_sync_status === "error" && (
                                <div className="mt-1">
                                  <StatusBadge value="Calendar sync needed" urgent />
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <LifecycleSelect
                                label={`Channel for ${set.prospect}`}
                                value={set.lead_channel}
                                options={CHANNEL_OPTIONS}
                                disabled={lifecycle.isPending}
                                onChange={(value) =>
                                  lifecycle.mutate({
                                    id: set.id,
                                    patch: { leadChannel: value as TrackerLeadChannel },
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-3">
                              <LifecycleSelect
                                label={`Qualification for ${set.prospect}`}
                                value={set.qualification_status}
                                options={QUALIFICATION_OPTIONS}
                                disabled={lifecycle.isPending}
                                onChange={(value) =>
                                  lifecycle.mutate({
                                    id: set.id,
                                    patch: { qualificationStatus: value as TrackerQualification },
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge
                                value={
                                  set.confirmed_at
                                    ? "confirmed"
                                    : reminderDue
                                      ? "Reminder due"
                                      : "unconfirmed"
                                }
                                urgent={reminderDue}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <LifecycleSelect
                                label={`Attendance for ${set.prospect}`}
                                value={set.attendance_status}
                                options={ATTENDANCE_OPTIONS}
                                disabled={lifecycle.isPending}
                                onChange={(value) =>
                                  lifecycle.mutate({
                                    id: set.id,
                                    patch: { attendanceStatus: value as TrackerAttendance },
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-3">
                              <LifecycleSelect
                                label={`Outcome for ${set.prospect}`}
                                value={set.sales_outcome}
                                options={OUTCOME_OPTIONS}
                                disabled={lifecycle.isPending}
                                onChange={(value) =>
                                  lifecycle.mutate({
                                    id: set.id,
                                    patch: { salesOutcome: value as TrackerOutcome },
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-3">
                              {followUp ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSetId(set.id)}
                                  className={`rounded-md border px-2.5 py-1.5 text-left text-caption ${new Date(followUp.due_at).getTime() <= Date.now() ? "border-foreground/40 bg-muted text-foreground" : "border-border text-foreground"}`}
                                >
                                  {formatDateTime(followUp.due_at)}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSetId(set.id)}
                                  className="text-caption font-medium text-muted-foreground hover:text-foreground"
                                >
                                  Schedule
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedSetId(set.id)}
                              >
                                Manage <ChevronRight className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-border xl:hidden">
                  {visibleSets.map((set) => {
                    const followUp = currentFollowUp(data.followUps, set.id);
                    const reminderDue = isReminderDue(set);
                    const isCancelled = set.status === "cancelled";
                    const isDuplicate = !isCancelled && duplicateProspects.has(set.prospect.trim().toLowerCase());
                    return (
                      <button
                        key={set.id}
                        type="button"
                        onClick={() => setSelectedSetId(set.id)}
                        className={`flex min-h-24 w-full items-center gap-3 px-4 py-4 text-left active:bg-muted ${isCancelled ? "opacity-55" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-foreground">{set.prospect}</p>
                            {isCancelled && <StatusBadge value="Cancelled · not counted" />}
                            {isDuplicate && <StatusBadge value="Possible duplicate" urgent />}
                            {reminderDue && !isCancelled && <StatusBadge value="Reminder due" urgent />}
                            {set.attendance_status === "no_show" && (
                              <StatusBadge value="no_show" urgent />
                            )}
                            {set.calendar_sync_status === "error" && (
                              <StatusBadge value="Calendar sync needed" urgent />
                            )}
                          </div>
                          <p className="mt-1 text-caption text-muted-foreground">
                            {formatDateTime(set.event_start)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <StatusBadge value={set.qualification_status} />
                            {(set.sales_outcome !== "follow_up" || !followUp) && (
                              <StatusBadge value={set.sales_outcome} />
                            )}
                            {followUp && (
                              <StatusBadge
                                value={`Follow-up ${formatDateTime(followUp.due_at)}`}
                                urgent={new Date(followUp.due_at).getTime() <= Date.now()}
                              />
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          <EodActivity data={data} />
        </>
      )}

      <SetDetailSheet
        set={selectedSet}
        followUp={selectedFollowUp}
        events={selectedEvents}
        saving={lifecycle.isPending || schedule.isPending || complete.isPending || cancel.isPending || restore.isPending}
        isDuplicate={Boolean(selectedSet && selectedSet.status !== "cancelled" && duplicateProspects.has(selectedSet.prospect.trim().toLowerCase()))}
        onOpenChange={(open) => {
          if (!open) setSelectedSetId(null);
        }}
        onLifecycle={(id, patch) => lifecycle.mutate({ id, patch })}
        onSchedule={(payload) => schedule.mutate(payload)}
        onComplete={(id, status) => complete.mutate({ id, status })}
        onCancel={(id, reason) => cancel.mutate({ id, reason })}
        onRestore={(id) => restore.mutate({ id })}
      />
    </div>
  );
}

function EodActivity({ data }: { data: SetterTrackerData }) {
  const completedByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const followUp of data.followUps) {
      if (followUp.status !== "completed" || !followUp.completed_at) continue;
      const key = dateKeyForTimeZone(followUp.completed_at, data.member.timezone);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [data.followUps, data.member.timezone]);

  return (
    <Card className="card-surface overflow-hidden border-0 shadow-none">
      <div className="border-b border-border p-4">
        <p className="text-title">Submitted EODs</p>
        <p className="mt-1 text-caption text-muted-foreground">
          Read-only activity from the canonical real EOD view. Follow-up completions come from
          tracker history.
        </p>
      </div>
      {data.eods.length === 0 ? (
        <div className="px-6 py-12 text-center text-body text-muted-foreground">
          No submitted EODs in this range.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[920px] text-left">
              <thead className="border-b border-border bg-muted/60 text-micro uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Dials</th>
                  <th className="px-3 py-3 font-medium">Leads</th>
                  <th className="px-3 py-3 font-medium">DMs</th>
                  <th className="px-3 py-3 font-medium">Conversations</th>
                  <th className="px-3 py-3 font-medium">Sets</th>
                  <th className="px-3 py-3 font-medium">Shows</th>
                  <th className="px-3 py-3 font-medium">No-shows</th>
                  <th className="px-3 py-3 font-medium">Follow-ups</th>
                  <th className="px-4 py-3 font-medium">Closes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.eods.map((eod) => (
                  <tr key={eod.id ?? eod.report_date} className="bg-card">
                    <td className="px-4 py-3 font-medium">
                      {eod.report_date
                        ? friendlyPastDay(eod.report_date)
                        : "Unavailable"}
                    </td>
                    <td className="px-3 py-3">{formatMetric(eod.dials)}</td>
                    <td className="px-3 py-3">{formatMetric(eod.leads_contacted)}</td>
                    <td className="px-3 py-3">{formatMetric(eod.dms_sent)}</td>
                    <td className="px-3 py-3">{formatMetric(eod.convos_started)}</td>
                    <td className="px-3 py-3">{formatMetric(eod.calls_booked)}</td>
                    <td className="px-3 py-3">{formatMetric(eod.shows)}</td>
                    <td className="px-3 py-3">{formatMetric(eod.no_shows)}</td>
                    <td className="px-3 py-3">
                      {eod.report_date
                        ? formatMetric(completedByDate.get(eod.report_date) ?? 0)
                        : "Unavailable"}
                    </td>
                    <td className="px-4 py-3">{formatMetric(eod.closes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border xl:hidden">
            {data.eods.map((eod) => (
              <div key={eod.id ?? eod.report_date} className="px-4 py-4">
                <p className="font-medium">
                  {eod.report_date
                    ? friendlyPastDay(eod.report_date)
                    : "Date unavailable"}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 text-caption">
                  {[
                    ["Dials", eod.dials],
                    ["Leads", eod.leads_contacted],
                    ["DMs", eod.dms_sent],
                    ["Convos", eod.convos_started],
                    ["Sets", eod.calls_booked],
                    ["Shows", eod.shows],
                    ["No-shows", eod.no_shows],
                    [
                      "Follow-ups",
                      eod.report_date ? (completedByDate.get(eod.report_date) ?? 0) : null,
                    ],
                    ["Closes", eod.closes],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-muted-foreground">{label}</p>
                      <p className="mt-0.5 font-medium text-foreground">
                        {formatMetric(value as number | null)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

const CANCEL_REASONS = [
  { value: "Duplicate booking", label: "Duplicate booking" },
  { value: "Prospect cancelled", label: "Prospect cancelled" },
  { value: "Rescheduled to a new time", label: "Rescheduled to a new time" },
  { value: "Other", label: "Other" },
];

function SetDetailSheet({
  set,
  followUp,
  events,
  saving,
  isDuplicate,
  onOpenChange,
  onLifecycle,
  onSchedule,
  onComplete,
  onCancel,
  onRestore,
}: {
  set: TrackerSet | null;
  followUp?: TrackerFollowUp;
  events: TrackerEvent[];
  saving: boolean;
  isDuplicate?: boolean;
  onOpenChange: (open: boolean) => void;
  onLifecycle: (id: string, patch: LifecyclePatch) => void;
  onSchedule: (payload: {
    setId: string;
    dueAt: string;
    channel: TrackerFollowUpChannel;
    note: string | null;
  }) => void;
  onComplete: (id: string, status: "completed" | "cancelled") => void;
  onCancel: (id: string, reason: string) => void;
  onRestore: (id: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [followUpAt, setFollowUpAt] = useState(localDateTimeValue());
  const [followUpChannel, setFollowUpChannel] = useState<TrackerFollowUpChannel>("dm");
  const [followUpNote, setFollowUpNote] = useState("");
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0].value);

  useEffect(() => {
    setNotes(set?.notes ?? "");
    setFollowUpAt(followUp ? localDateTimeValue(new Date(followUp.due_at)) : localDateTimeValue());
    setFollowUpChannel((followUp?.channel as TrackerFollowUpChannel | undefined) ?? "dm");
    setFollowUpNote(followUp?.note ?? "");
    setCancelReason(isDuplicate ? "Duplicate booking" : CANCEL_REASONS[0].value);
  }, [followUp, set, isDuplicate]);

  if (!set) return null;
  const reminderLog = (set.reminder_log ?? {}) as Record<string, unknown>;

  return (
    <Sheet open={Boolean(set)} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-xl px-4 pb-8 pt-6 sm:px-6"
      >
        <div className="mx-auto w-full max-w-3xl">
          <SheetHeader className="pr-10 text-left">
            <SheetTitle>{set.prospect}</SheetTitle>
            <SheetDescription>
              {formatDateTime(set.event_start)} · {set.duration_min} minutes
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <section>
                <p className="text-caption font-medium text-muted-foreground">Lifecycle</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <SelectField
                    aria-label="Lead channel"
                    value={set.lead_channel}
                    onChange={(value) =>
                      onLifecycle(set.id, { leadChannel: value as TrackerLeadChannel })
                    }
                    options={CHANNEL_OPTIONS}
                    disabled={saving}
                    className="min-h-12"
                  />
                  <SelectField
                    aria-label="Qualification status"
                    value={set.qualification_status}
                    onChange={(value) =>
                      onLifecycle(set.id, { qualificationStatus: value as TrackerQualification })
                    }
                    options={QUALIFICATION_OPTIONS}
                    disabled={saving}
                    className="min-h-12"
                  />
                  <SelectField
                    aria-label="Attendance status"
                    value={set.attendance_status}
                    onChange={(value) =>
                      onLifecycle(set.id, { attendanceStatus: value as TrackerAttendance })
                    }
                    options={ATTENDANCE_OPTIONS}
                    disabled={saving}
                    className="min-h-12"
                  />
                  <SelectField
                    aria-label="Sales outcome"
                    value={set.sales_outcome}
                    onChange={(value) =>
                      onLifecycle(set.id, { salesOutcome: value as TrackerOutcome })
                    }
                    options={OUTCOME_OPTIONS}
                    disabled={saving}
                    className="min-h-12"
                  />
                </div>
              </section>

              {set.status === "cancelled" ? (
                <section className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-caption font-medium text-foreground">This set is cancelled</p>
                  <p className="mt-1 text-micro text-muted-foreground">
                    It does not count toward your sets or show rate. Restore it if that was a mistake.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    disabled={saving}
                    onClick={() => onRestore(set.id)}
                  >
                    Restore set
                  </Button>
                </section>
              ) : (
                <section className={`rounded-lg border p-4 ${isDuplicate ? "border-foreground/40 bg-muted" : "border-border bg-muted/40"}`}>
                  <p className="text-caption font-medium text-foreground">
                    {isDuplicate ? "Possible duplicate booking" : "Cancel this set"}
                  </p>
                  <p className="mt-1 text-micro text-muted-foreground">
                    {isDuplicate
                      ? "This prospect has more than one live set. Cancel the wrong one so your show rate stays honest."
                      : "Double-booked, rescheduled, or the prospect pulled out? Cancelling removes it from your sets and show rate and clears the calendar event."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SelectField
                      aria-label="Cancel reason"
                      value={cancelReason}
                      onChange={setCancelReason}
                      options={CANCEL_REASONS}
                      disabled={saving}
                      className="h-9 min-w-44 bg-background text-caption"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => onCancel(set.id, cancelReason)}
                    >
                      <X className="h-4 w-4" /> Cancel set
                    </Button>
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-caption font-medium text-muted-foreground">Set notes</p>
                  {notes !== (set.notes ?? "") && (
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => onLifecycle(set.id, { notes })}
                    >
                      Save notes
                    </Button>
                  )}
                </div>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={4000}
                  rows={5}
                  placeholder="Objections, context, decision-maker details, or anything the closer needs."
                  className="mt-2 min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
                />
              </section>

              <section>
                <p className="text-caption font-medium text-muted-foreground">Reminder trail</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {REMINDER_WINDOWS.map((window) => {
                    const state = reminderLog[window.key];
                    return (
                      <div
                        key={window.key}
                        className="rounded-lg border border-border bg-muted/50 p-3"
                      >
                        <p className="text-caption font-medium">{window.key}</p>
                        <p className="mt-1 text-micro text-muted-foreground">
                          {typeof state === "string" ? statusLabel(state) : "Not logged"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                <p className="text-title">Follow-up</p>
              </div>
              {followUp && (
                <div
                  className={`mt-3 rounded-lg border p-3 ${new Date(followUp.due_at).getTime() <= Date.now() ? "border-foreground/40 bg-muted" : "border-border bg-card"}`}
                >
                  <p className="text-caption font-medium">
                    Open · {formatDateTime(followUp.due_at)}
                  </p>
                  <p className="mt-1 text-micro text-muted-foreground">
                    {statusLabel(followUp.channel)}
                    {followUp.note ? ` · ${followUp.note}` : ""}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      className="min-h-12"
                      disabled={saving}
                      onClick={() => onComplete(followUp.id, "completed")}
                    >
                      <Check className="h-4 w-4" /> Done
                    </Button>
                    <Button
                      className="min-h-12"
                      variant="outline"
                      disabled={saving}
                      onClick={() => onComplete(followUp.id, "cancelled")}
                    >
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="follow-up-at" className="text-caption text-muted-foreground">
                    Due date and time
                  </label>
                  <Input
                    id="follow-up-at"
                    type="datetime-local"
                    value={followUpAt}
                    onChange={(event) => setFollowUpAt(event.target.value)}
                    className="mt-1 min-h-12"
                  />
                </div>
                <div>
                  <label className="text-caption text-muted-foreground">Channel</label>
                  <SelectField
                    aria-label="Follow-up channel"
                    value={followUpChannel}
                    onChange={(value) => setFollowUpChannel(value as TrackerFollowUpChannel)}
                    options={FOLLOW_UP_CHANNEL_OPTIONS}
                    className="mt-1 min-h-12"
                  />
                </div>
                <div>
                  <label htmlFor="follow-up-note" className="text-caption text-muted-foreground">
                    Next action
                  </label>
                  <Input
                    id="follow-up-note"
                    value={followUpNote}
                    onChange={(event) => setFollowUpNote(event.target.value)}
                    maxLength={4000}
                    placeholder="What should happen next?"
                    className="mt-1 min-h-12"
                  />
                </div>
                <Button
                  className="min-h-12 w-full"
                  disabled={saving || !followUpAt}
                  onClick={() =>
                    onSchedule({
                      setId: set.id,
                      dueAt: new Date(followUpAt).toISOString(),
                      channel: followUpChannel,
                      note: followUpNote.trim() || null,
                    })
                  }
                >
                  <Clock3 className="h-4 w-4" />{" "}
                  {followUp ? "Reschedule follow-up" : "Schedule follow-up"}
                </Button>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-caption font-medium text-muted-foreground">Activity history</p>
                {events.length === 0 ? (
                  <p className="mt-1 text-caption text-muted-foreground">
                    No recorded changes yet.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
                    {events.slice(0, 8).map((event) => {
                      const detail = eventDetail(event);
                      return (
                        <div key={event.id} className="px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3 text-caption">
                            <span className="font-medium text-foreground">
                              {statusLabel(event.event_type)}
                            </span>
                            <span className="text-muted-foreground">
                              {formatDateTime(event.created_at)}
                            </span>
                          </div>
                          {detail && (
                            <p className="mt-1 text-micro text-muted-foreground">{detail}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5" /> Source: {statusLabel(set.source)}
            </span>
            <span>Last updated {formatDateTime(set.updated_at)}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
