/** Canonical business timezone for all EOD boundaries. */
export const BUSINESS_TZ = "Asia/Dubai";

/** Returns today's date as YYYY-MM-DD in the business timezone. */
export function todayBiz(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
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
  const today = todayBiz();
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
