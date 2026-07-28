/**
 * The one source of EOD KPI truth, shared by the Home "My week" chips and the
 * Performance "Team week" cards. Extracted from the pre-command-center EODs
 * page so the rules can never drift between surfaces.
 */

export type SetterType = "phone" | "dm" | "full_cycle" | null;

export type EodKpiRow = {
  report_date: string;
  dials?: number | null;
  dms_sent?: number | null;
  leads_contacted?: number | null;
  calls_booked?: number | null;
  student_checkins?: number | null;
};

// KPI defaults — plain numbers; founder-set (CLAUDE.md business rules).
export const KPI = {
  phone:      { primary: { key: "dials" as const, label: "Dials", target: 100 }, secondary: null, sets: 3 },
  // 2026-07-11 founder-approved: "leads contacted/outreached" folded into
  // "DMs sent" — same activity, one field. Historical rows keep
  // leads_contacted; readers take the max of both so old KPI days hold.
  dm:         { primary: { key: "dms_sent" as const, label: "DMs sent", target: 125 }, secondary: null, sets: 3 },
  // Full cycle does both: dials AND outreach must hit
  full_cycle: { primary: { key: "dials" as const, label: "Dials", target: 100 }, secondary: { key: "dms_sent" as const, label: "DMs sent", target: 50 }, sets: 3 },
};

/** Outreach volume with legacy fallback: pre-2026-07-11 rows logged it as leads_contacted. */
export function outreachOf(e: EodKpiRow): number {
  return Math.max(e.dms_sent ?? 0, e.leads_contacted ?? 0);
}

export function didHitKpi(e: EodKpiRow, st: SetterType): boolean {
  if (!st) return false;
  const cfg = KPI[st];
  const read = (k: "dials" | "dms_sent") => (k === "dms_sent" ? outreachOf(e) : (e[k] ?? 0));
  // Founder rule 2026-07-14: SETS are the KPI. 3+ sets = KPI met regardless of
  // volume. Couldn't hit sets? Full volume (100 dials / 125 DMs / both for
  // full-cycle) still counts as a KPI day.
  if ((e.calls_booked ?? 0) >= cfg.sets) return true;
  if (read(cfg.primary.key) < cfg.primary.target) return false;
  if (cfg.secondary && read(cfg.secondary.key) < cfg.secondary.target) return false;
  return true;
}

/** CSM KPI: daily student check-ins against their personal target
 *  (profiles.csm_daily_target — part-time vs full-time, founder-set). A
 *  submitted EOD with 0 check-ins must NOT read as green. */
export function didHitCsmKpi(e: EodKpiRow, target: number | null | undefined): boolean {
  return (e.student_checkins ?? 0) >= Math.max(1, Number(target) || 10);
}

export function dayStatus(e: EodKpiRow | undefined, st: SetterType, csmTarget?: number | null): "green" | "amber" | "red" {
  if (!e) return "red";
  if (st) return didHitKpi(e, st) ? "green" : "amber";
  if (csmTarget != null) return didHitCsmKpi(e, csmTarget) ? "green" : "amber";
  return "green"; // no KPI defined (closer/coach)
}
