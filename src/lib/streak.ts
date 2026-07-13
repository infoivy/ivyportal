// Compute a "current streak" of consecutive daily submissions ending today or
// yesterday. All keys use the USER'S LOCAL calendar day (same basis as
// report_date) — toISOString() is UTC and shifts the day for anyone at a
// positive offset (e.g. Dubai), silently under-counting streaks.
const localKey = (d: Date) => new Intl.DateTimeFormat("en-CA").format(d);

export function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates.map(d => d.slice(0, 10)));
  const dayMs = 86400000;
  const now = new Date();
  const todayKey = localKey(now);
  const yesterdayKey = localKey(new Date(now.getTime() - dayMs));
  let cursor: Date;
  if (set.has(todayKey)) cursor = now;
  else if (set.has(yesterdayKey)) cursor = new Date(now.getTime() - dayMs);
  else return 0;
  let streak = 0;
  while (set.has(localKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - dayMs);
  }
  return streak;
}
