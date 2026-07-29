/**
 * Greeting-safe short name: kunya and compound-name particles keep their
 * second word ("Abu Bilal" must never greet as "Abu" · founder 2026-07-29).
 */
const PARTICLES = new Set(["abu", "umm", "abd", "ibn", "bin", "al"]);

export function shortName(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "there";
  if (parts.length > 1 && PARTICLES.has(parts[0].toLowerCase())) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}
