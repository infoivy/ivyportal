/**
 * Start Here onboarding checklist (founder-directed 2026-07-18).
 *
 * Same five steps for both pathways — the 1:1 difference happens AFTER
 * completion (an automatic "Book your 1:1 coaching calls" action item).
 * Until every step is done the portal shows Start Here and nothing else:
 * placements, EODs, and action items only confuse a student who just paid.
 */
export type GuideStep = {
  key: string;
  title: string;
  /** Compact name for staff badges/alerts ("3/5 · Skool training"). */
  shortLabel: string;
  body: string;
  link?: { to: string; label: string };
  /** Inline video embed (e.g. Loom) rendered inside the step card. */
  embedUrl?: string;
};

export const START_HERE_STEPS: GuideStep[] = [
  {
    key: "typeform",
    title: "Fill out your onboarding form",
    shortLabel: "Onboarding form",
    body: "You received a Typeform right after payment. Fill it out first so the team knows exactly where you're starting from. Check your email/WhatsApp if you can't find it.",
  },
  {
    key: "offer_board",
    title: "Join the offer board",
    shortLabel: "Join offer board",
    body: "The offer board is where the live setter positions are. Join it now, everything after training happens there.",
  },
  {
    key: "offer_board_loom",
    title: "Watch the offer board walkthrough Loom",
    shortLabel: "Offer board Loom",
    body: "This walkthrough shows exactly how to use the offer board: roles, applications, what good looks like. Watch it fully before you touch anything else there.",
    embedUrl: "https://www.loom.com/embed/75693ce98cdd41c1adfd6ba9dcd5fd72",
  },
  {
    key: "skool_training",
    title: "Finish ALL the training videos in Skool",
    shortLabel: "Skool training",
    body: "Every video, in order, inside the Skool community. This is your foundation: the group calls and looms only click once you've seen the full system.",
  },
  {
    key: "offer_board_course",
    title: "Complete the offer board course",
    shortLabel: "Offer board course",
    body: "Inside the offer board itself there's a course on how to run it end to end. Go through the whole thing, it's the last step before your portal unlocks.",
  },
];

export const START_HERE_REQUIRED_KEYS = START_HERE_STEPS.map((s) => s.key);

export function isStartHereComplete(doneKeys: ReadonlySet<string> | string[]): boolean {
  const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys);
  return START_HERE_REQUIRED_KEYS.every((key) => done.has(key));
}

/**
 * The step a locked student is ON: steps are sequential, so it's the first
 * one not done. Null once everything is complete.
 */
export function nextStartHereStep(doneKeys: ReadonlySet<string> | string[]): GuideStep | null {
  const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys);
  return START_HERE_STEPS.find((s) => !done.has(s.key)) ?? null;
}
