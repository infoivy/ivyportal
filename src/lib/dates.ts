/** Canonical business timezone for all EOD boundaries. */
export const BUSINESS_TZ = "Asia/Riyadh";

const businessDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ });

/** Returns today's date as YYYY-MM-DD in the business timezone. */
export function todayBiz(): string {
  return businessDayFormatter.format(new Date());
}

/** Converts an external timestamp to its YYYY-MM-DD business reporting day. */
export function businessDay(value: string | Date): string {
  return businessDayFormatter.format(typeof value === "string" ? new Date(value) : value);
}

/** Riyadh has no daylight-saving shift, so an explicit +03:00 boundary is stable. */
export function businessDayUtcBoundary(isoDate: string, end = false): string {
  const time = end ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${isoDate}T${time}+03:00`).toISOString();
}

/** Today in the USER'S own timezone — EODs belong to the day the rep lived
 *  (founder-confirmed 2026-07-12: Aalian's Saturday EOD from Canada must not
 *  land on the business calendar's Sunday). */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

/** Returns a Date representing midnight (start of day) in the business timezone. */
export function startOfDayBiz(isoDate?: string): Date {
  const base = isoDate ?? todayBiz();
  // Construct as if it's local, then adjust — simpler to just use the string directly
  // for comparison purposes. For display, always compare ISO strings.
  return new Date(`${base}T00:00:00`);
}

/** "due today" / "due tomorrow" / "due by Friday" / "due by next Tuesday" — reads like a person, not a database. */
export function humanDue(isoDate: string | null | undefined): string {
  if (!isoDate) return "no due date";
  // Viewer-local day, not business day: students read their own action items
  // and "due today" must mean THEIR today.
  const today = todayLocal();
  const days = Math.round((new Date(isoDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  const weekday = new Date(isoDate + "T00:00:00").toLocaleDateString("en", { weekday: "long" });
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days === -1) return "was due yesterday";
  if (days < -1 && days >= -6) return `was due ${weekday}`;
  if (days > 1 && days <= 6) return `due by ${weekday}`;
  if (days >= 7 && days <= 13) return `due by next ${weekday}`;
  const nice = new Date(isoDate + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" });
  return days < 0 ? `was due ${nice}` : `due ${nice}`;
}

/** Friendly label for a recent past day (founder 2026-07-31): "Today",
 *  "Yesterday", a weekday inside the current week, "Last Thursday" for the
 *  week before, and only beyond two weeks the exact date. */
export function friendlyPastDay(isoDate: string | null | undefined): string {
  if (!isoDate) return "–";
  const day = isoDate.slice(0, 10);
  const today = todayLocal();
  const d = new Date(day + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  const days = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (days < 0 || days > 13) {
    return d.toLocaleDateString("en", { month: "short", day: "numeric", year: d.getFullYear() !== t.getFullYear() ? "numeric" : undefined });
  }
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  const weekday = d.toLocaleDateString("en", { weekday: "long" });
  // Monday-started weeks: same week → bare weekday; the week before → "Last …".
  const mondayOffset = (t.getDay() + 6) % 7;
  const sameWeek = days <= mondayOffset;
  return sameWeek ? weekday : `Last ${weekday}`;
}
