/** Common card-spend categories (founder 2026-07-31): most spends are one
 *  pick, no typing. "Other" plus the optional detail field covers the rest. */
export const SPEND_CATEGORIES = [
  "Food",
  "Gas",
  "Entertainment",
  "Studies",
  "Software",
  "Subscriptions",
  "Family",
  "Business",
  "Travel",
  "Other",
] as const;

/** One note string from a category pick + optional typed detail. */
export function spendNote(category: string, detail: string): string {
  const d = detail.trim();
  return d ? `${category} · ${d}` : category;
}
