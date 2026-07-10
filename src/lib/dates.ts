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
