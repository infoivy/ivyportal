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
  // 2026-07-28 founder-directed: DM setters raise to 300 DMs · 6 sets,
  // effective 2026-07-29. Earlier rows judge under the 125 · 3 rules of
  // their day (same philosophy as the leads_contacted fallback).
  dm:         { primary: { key: "dms_sent" as const, label: "DMs sent", target: 300 }, secondary: null, sets: 6 },
  // Full cycle does both: dials AND outreach must hit
  full_cycle: { primary: { key: "dials" as const, label: "Dials", target: 100 }, secondary: { key: "dms_sent" as const, label: "DMs sent", target: 50 }, sets: 3 },
};

// KPI raises never re-judge history: targets resolve per report date.
const DM_V1 = { target: 125, sets: 3 };
const DM_V2_FROM = "2026-07-29";

/** The targets that applied on a given report date. */
export function kpiTargetsFor(st: Exclude<SetterType, null>, reportDate: string) {
  const cfg = KPI[st];
  if (st === "dm" && reportDate < DM_V2_FROM) {
    return { primaryTarget: DM_V1.target, sets: DM_V1.sets, secondaryTarget: null as number | null };
  }
  return { primaryTarget: cfg.primary.target, sets: cfg.sets, secondaryTarget: cfg.secondary?.target ?? null };
}

/** Outreach volume with legacy fallback: pre-2026-07-11 rows logged it as leads_contacted. */
export function outreachOf(e: EodKpiRow): number {
  return Math.max(e.dms_sent ?? 0, e.leads_contacted ?? 0);
}

export function didHitKpi(e: EodKpiRow, st: SetterType): boolean {
  if (!st) return false;
  const cfg = KPI[st];
  const t = kpiTargetsFor(st, e.report_date);
  const read = (k: "dials" | "dms_sent") => (k === "dms_sent" ? outreachOf(e) : (e[k] ?? 0));
  // Founder rule 2026-07-14: SETS are the KPI. Hitting the sets target means
  // KPI met regardless of volume. Couldn't hit sets? Full volume (100 dials /
  // 300 DMs / both for full-cycle) still counts as a KPI day.
  if ((e.calls_booked ?? 0) >= t.sets) return true;
  if (read(cfg.primary.key) < t.primaryTarget) return false;
  if (cfg.secondary && read(cfg.secondary.key) < (t.secondaryTarget ?? cfg.secondary.target)) return false;
  return true;
}

/** CSM KPI: daily student check-ins against their personal target
 *  (profiles.csm_daily_target — part-time vs full-time, founder-set). A
 *  submitted EOD with 0 check-ins must NOT read as green. */
export function didHitCsmKpi(e: EodKpiRow, target: number | null | undefined): boolean {
  return (e.student_checkins ?? 0) >= Math.max(1, Number(target) || 10);
}

/**
 * The ONE answer to "does this member owe EODs?". Every surface (home pulse,
 * Performance accountability, Team week cards) must use it so an exemption
 * toggled in Team admin applies everywhere at once (founder-directed
 * 2026-07-29 after a half-applied toggle). Founder and co-founder roles
 * never owe; deactivation and profiles.eod_exempt excuse anyone else.
 */
export function owesEods(input: {
  roles: readonly string[];
  active?: boolean | null;
  eod_exempt?: boolean | null;
}): boolean {
  if (input.active === false || input.eod_exempt === true) return false;
  if (input.roles.includes("founder") || input.roles.includes("cofounder")) return false;
  return input.roles.some((r) => ["setter", "closer", "coach", "csm"].includes(r));
}

export function dayStatus(e: EodKpiRow | undefined, st: SetterType, csmTarget?: number | null): "green" | "amber" | "red" {
  if (!e) return "red";
  if (st) return didHitKpi(e, st) ? "green" : "amber";
  if (csmTarget != null) return didHitCsmKpi(e, csmTarget) ? "green" : "amber";
  return "green"; // no KPI defined (closer/coach)
}
