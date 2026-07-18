export const GROUP_COACHING_CALLS_PER_WEEK = 7;

/** One weekly group coaching call. Names only — times differ per student timezone. */
export type GroupCall = { day: string; name: string };

/**
 * Fallback mirror of the org_settings.group_call_schedule seed, used when the
 * settings read fails. The database row is the source of truth (admin-editable).
 * Names confirmed by the founder from the Skool calendar 2026-07-18.
 */
export const DEFAULT_GROUP_CALL_SCHEDULE: GroupCall[] = [
  { day: "Mon", name: "🧠 Off Call Discipline w/ Abu Bilal" },
  { day: "Tue", name: "💼 Role Finding Masterclass w/ Faizan" },
  { day: "Wed", name: "📞 Roleplays w/ Abdulrahman" },
  { day: "Thu", name: "📝 Script Breakdown w/ Faizan" },
  { day: "Fri", name: "⚔️ Setting Mastery w/ Abdulrahman" },
  { day: "Sat", name: "🎬 Call Review Thursdays w/ Abu Bilal" },
  { day: "Sun", name: "📞 Roleplays w/ Abdulrahman" },
];

export function parseGroupCallSchedule(raw: unknown): GroupCall[] {
  if (!Array.isArray(raw)) return DEFAULT_GROUP_CALL_SCHEDULE;
  const rows = raw
    .filter((r): r is { day: unknown; name: unknown } => !!r && typeof r === "object")
    .map((r) => ({ day: String(r.day ?? "").slice(0, 12), name: String(r.name ?? "").slice(0, 80) }))
    .filter((r) => r.day && r.name);
  return rows.length > 0 ? rows : DEFAULT_GROUP_CALL_SCHEDULE;
}

export type StudentWeeklyWindow = {
  weekStart: string;
  weekEnd: string;
  dueToday: boolean;
};

export type StudentWeeklyEodInput = {
  /** Day keys ("Mon"…"Sun") of the schedule entries the student ticked. */
  callsAttended: string[];
  /** Self-reported 1:1 calls this week; null for group-pathway students. */
  oneOnOneCalls: number | null;
  implementation: string;
  nextWeekCommitment: string;
};

export type StudentWeeklyEodDraft = StudentWeeklyEodInput & {
  biggestWin: string;
  biggestBlocker: string;
};

export type StudentWeeklyDraftAction = "skip" | "remove" | "save";

const DAY_MS = 86_400_000;

function parseIsoDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function addDays(value: string, amount: number): string {
  return new Date(parseIsoDay(value).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Student accountability follows the Portal's Monday-to-Sunday operating week.
 * Sunday reviews the current week; Monday through Saturday keep the most recent
 * completed week open so a missed Sunday review remains recoverable.
 */
export function getStudentWeeklyWindow(today: string): StudentWeeklyWindow {
  const weekday = parseIsoDay(today).getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  const currentMonday = addDays(today, -daysSinceMonday);
  const weekStart = weekday === 0 ? currentMonday : addDays(currentMonday, -7);

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    dueToday: weekday === 0,
  };
}

/** Monday of the week containing `today` — the week whose calls are being ticked live. */
export function getCurrentWeekStart(today: string): string {
  const weekday = parseIsoDay(today).getUTCDay();
  return addDays(today, -(weekday === 0 ? 6 : weekday - 1));
}

export function countStudentDailyEods(
  reportDates: string[],
  window: Pick<StudentWeeklyWindow, "weekStart" | "weekEnd">,
): number {
  return new Set(
    reportDates
      .map((date) => date.slice(0, 10))
      .filter((date) => date >= window.weekStart && date <= window.weekEnd),
  ).size;
}

/** Resolve ticked day keys against the schedule into durable {day, name} records. */
export function toAttendedRecords(callsAttended: string[], schedule: GroupCall[]): GroupCall[] {
  return schedule.filter((call) => callsAttended.includes(call.day));
}

/** Read stored calls_attended jsonb back into day keys, tolerating legacy shapes. */
export function fromStoredCallsAttended(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => (r && typeof r === "object" ? String((r as { day?: unknown }).day ?? "") : ""))
    .filter(Boolean);
}

export function getStudentWeeklyDraftAction({
  hydrated,
  hasSubmission,
  form,
}: {
  hydrated: boolean;
  hasSubmission: boolean;
  form: StudentWeeklyEodDraft;
}): StudentWeeklyDraftAction {
  if (!hydrated || hasSubmission) return "skip";

  const isEmpty =
    form.callsAttended.length === 0 &&
    !form.oneOnOneCalls &&
    !form.implementation &&
    !form.biggestWin &&
    !form.biggestBlocker &&
    !form.nextWeekCommitment;

  return isEmpty ? "remove" : "save";
}

export function validateStudentWeeklyEod(
  input: StudentWeeklyEodInput,
  schedule: GroupCall[],
): string | null {
  const validDays = new Set(schedule.map((call) => call.day));
  const unique = new Set(input.callsAttended);
  if (unique.size !== input.callsAttended.length || input.callsAttended.some((day) => !validDays.has(day))) {
    return "Attended calls don't match this week's call schedule — reload and try again.";
  }
  if (input.oneOnOneCalls != null && (!Number.isInteger(input.oneOnOneCalls) || input.oneOnOneCalls < 0 || input.oneOnOneCalls > 20)) {
    return "1:1 calls this week must be a small whole number.";
  }
  if (!input.implementation.trim()) {
    return "Explain what you implemented from the calls, or what stopped you.";
  }
  if (!input.nextWeekCommitment.trim()) {
    return "Add one concrete commitment for next week.";
  }
  return null;
}
