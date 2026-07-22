/**
 * Student health — a transparent, deterministic score (same philosophy as the
 * team "Hunger" score): every point traceable to a behavior, comparable
 * across students, never hallucinated. Bands drive the CSM priority queue.
 *
 * Weights (100 total):
 *   EOD consistency        35  — recency + 14-day submission rate
 *   Action items           15  — overdue count + completion rate
 *   1-on-1 cadence         15  — days since last completed call (coaching phase)
 *   Work volume            15  — 14d roleplays + looms vs daily targets (3 / 5)
 *   Placement momentum     20  — stage advance or interview scheduled in 14d
 * Modifiers: payment behind/late −20 · status "ghosting" caps the score at 25.
 */

export type HealthBand = "green" | "amber" | "red";

export type StudentHealth = {
  score: number;
  band: HealthBand;
  reasons: string[];
  /** Days since the student was last seen in any signal (EOD/call/placement). */
  daysQuiet: number | null;
  /** Still locked in Start Here — none of the activity judgments apply yet. */
  locked?: boolean;
};

export type HealthInputs = {
  status: string;
  phase: string;
  paymentState: string | null;
  /** ISO dates of student EODs, any order. */
  eodDates: string[];
  /** 14d totals from student EODs. */
  roleplays14: number;
  looms14: number;
  apps14: number;
  /** Open action items past due / total open. */
  overdueItems: number;
  openItems: number;
  /** ISO date of last completed 1-on-1, if any. */
  lastCallDate: string | null;
  /** Placement signals. */
  placementStages: string[];
  placementActivity14: boolean;
  interviewUpcoming: boolean;
  /** Founder-set switch: this student's EODs aren't tracked — no missed-EOD or volume penalties. */
  eodExempt?: boolean;
  /** Locked in Start Here onboarding: cannot submit EODs, book path hasn't started. */
  locked?: boolean;
};

const DAY = 86400000;
const daysSince = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null;

export function computeStudentHealth(i: HealthInputs): StudentHealth {
  const reasons: string[] = [];

  // Locked in Start Here: EODs, calls, volume, and placements can't have
  // happened yet — scoring them as absent floods the CSM queue with red.
  // The "stuck in Start Here" bell alert owns this population instead.
  if (i.locked) {
    if (i.paymentState === "behind") reasons.push("Payment behind");
    reasons.push("In Start Here onboarding · portal locked");
    return { score: 0, band: i.paymentState === "behind" ? "red" : "amber", reasons, daysQuiet: null, locked: true };
  }

  // Offer landed: the grind is over — no EOD, volume, call-cadence, or
  // placement judgments apply. Only payment/ghosting can pull them down.
  if (["offer_won", "testimonial", "graduated"].includes(i.phase)) {
    let gScore = 100;
    if (i.paymentState === "behind") { gScore -= 20; reasons.push("Payment behind"); }
    if (i.status === "ghosting") { gScore = Math.min(gScore, 25); reasons.unshift("Marked ghosting"); }
    const gBand: HealthBand = gScore >= 70 ? "green" : gScore >= 40 ? "amber" : "red";
    return { score: gScore, band: gBand, reasons, daysQuiet: null };
  }

  // EOD consistency (35) — exempt students get full credit, no nagging
  const recent = i.eodDates.map((d) => d.slice(0, 10)).sort().reverse();
  const lastEodDays = recent.length ? daysSince(recent[0])! : null;
  let eodScore: number;
  if (i.eodExempt) {
    eodScore = 35;
  } else {
    // Local day to match report_date (a local-day string), not UTC.
    const cutoff14 = new Intl.DateTimeFormat("en-CA").format(new Date(Date.now() - 13 * DAY));
    const submitted14 = new Set(recent.filter((d) => d >= cutoff14)).size;
    eodScore = (submitted14 / 14) * 25;
    if (lastEodDays == null) { eodScore = 0; reasons.push("Never submitted an EOD"); }
    else if (lastEodDays >= 5) { eodScore = Math.min(eodScore, 5); reasons.push(`No EOD in ${lastEodDays} days`); }
    else if (lastEodDays >= 3) { eodScore = Math.min(eodScore, 12); reasons.push(`No EOD in ${lastEodDays} days`); }
    else eodScore += 10; // recent = full recency credit
    eodScore = Math.min(35, eodScore);
  }

  // Action items (15)
  let itemScore = 15;
  if (i.overdueItems > 0) {
    itemScore = Math.max(0, 15 - i.overdueItems * 5);
    reasons.push(`${i.overdueItems} overdue action item${i.overdueItems > 1 ? "s" : ""}`);
  }

  // 1-on-1 cadence (15) — only judged once they're in coaching or later
  let callScore = 15;
  const callDays = daysSince(i.lastCallDate);
  if (["coaching_1on1", "applying"].includes(i.phase)) {
    if (callDays == null) { callScore = 4; reasons.push("No 1-on-1 on record"); }
    else if (callDays > 14) { callScore = 4; reasons.push(`No 1-on-1 in ${callDays} days`); }
    else if (callDays > 9) callScore = 10;
  }

  // Work volume (15): 3 roleplays/day always, plus the stage metric —
  // 3 looms/day for review pre-approval, 5 loom applications/day once
  // approved (phase applying+). Volume comes from EODs, so exempt students
  // get full credit here too.
  let volumeScore = 15;
  if (!i.eodExempt) {
    const applying = ["applying", "offer_won", "testimonial"].includes(i.phase);
    const targetRoleplays = 3 * 14;
    const stageDone = applying ? i.apps14 : i.looms14;
    const stageTarget = (applying ? 5 : 3) * 14;
    const volumeRatio = Math.min(1, (i.roleplays14 / targetRoleplays + stageDone / stageTarget) / 2);
    volumeScore = Math.round(volumeRatio * 15);
    if (volumeRatio < 0.3 && lastEodDays != null && lastEodDays < 5) {
      reasons.push(applying ? "Roleplay/application volume far below target" : "Roleplay/loom volume far below target");
    }
  }

  // Placement momentum (20)
  let placementScore = 0;
  if (i.placementStages.includes("placed")) placementScore = 20;
  else if (i.interviewUpcoming) { placementScore = 16; }
  else if (i.placementStages.includes("trial")) placementScore = 16;
  else if (i.placementStages.includes("interviewing")) placementScore = 12;
  else if (i.placementActivity14) placementScore = 8;
  else if (i.placementStages.length > 0) placementScore = 5;
  if (["applying", "coaching_1on1"].includes(i.phase) && i.placementStages.length === 0) {
    reasons.push("No placement opportunities in play");
  }

  let score = Math.round(eodScore + itemScore + callScore + volumeScore + placementScore);

  if (i.paymentState === "behind") { score -= 20; reasons.push("Payment behind"); }
  if (i.status === "ghosting") { score = Math.min(score, 25); reasons.unshift("Marked ghosting"); }
  score = Math.max(0, Math.min(100, score));

  const band: HealthBand = score >= 70 ? "green" : score >= 40 ? "amber" : "red";
  const daysQuiet = lastEodDays;

  return { score, band, reasons, daysQuiet };
}

export const BAND_META: Record<HealthBand, { label: string; text: string; chip: string }> = {
  green: { label: "Healthy", text: "text-success-fg", chip: "text-success-fg bg-success-bg border-success/25" },
  amber: { label: "Watch", text: "text-warning-fg", chip: "text-warning-fg bg-warning-bg border-warning/25" },
  red: { label: "At risk", text: "text-danger-fg", chip: "text-danger-fg bg-danger-bg border-danger/25" },
};
