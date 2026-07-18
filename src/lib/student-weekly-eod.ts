export const GROUP_COACHING_CALLS_PER_WEEK = 7;

export type StudentWeeklyWindow = {
  weekStart: string;
  weekEnd: string;
  dueToday: boolean;
};

export type StudentWeeklyEodInput = {
  groupCallsAttended: number;
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
    form.groupCallsAttended === 0 &&
    !form.implementation &&
    !form.biggestWin &&
    !form.biggestBlocker &&
    !form.nextWeekCommitment;

  return isEmpty ? "remove" : "save";
}

export function validateStudentWeeklyEod(input: StudentWeeklyEodInput): string | null {
  if (
    !Number.isInteger(input.groupCallsAttended) ||
    input.groupCallsAttended < 0 ||
    input.groupCallsAttended > GROUP_COACHING_CALLS_PER_WEEK
  ) {
    return "Group calls attended must be between 0 and 7.";
  }
  if (!input.implementation.trim()) {
    return "Explain what you implemented or what stopped you this week.";
  }
  if (!input.nextWeekCommitment.trim()) {
    return "Add one concrete commitment for next week.";
  }
  return null;
}
