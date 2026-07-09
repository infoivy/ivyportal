// Compute a "current streak" of consecutive daily submissions ending today or yesterday.
export function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates.map(d => d.slice(0, 10)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  // Anchor: today if submitted today, else yesterday
  const todayKey = new Date(today).toISOString().slice(0, 10);
  const yesterdayKey = new Date(today.getTime() - dayMs).toISOString().slice(0, 10);
  let cursor: Date;
  if (set.has(todayKey)) cursor = new Date(today);
  else if (set.has(yesterdayKey)) cursor = new Date(today.getTime() - dayMs);
  else return 0;
  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor = new Date(cursor.getTime() - dayMs);
  }
  return streak;
}
