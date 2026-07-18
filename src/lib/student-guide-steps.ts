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
  body: string;
  link?: { to: string; label: string };
};

export const START_HERE_STEPS: GuideStep[] = [
  {
    key: "typeform",
    title: "Fill out your onboarding form",
    body: "You received a Typeform right after payment. Fill it out first so the team knows exactly where you're starting from. Check your email/WhatsApp if you can't find it.",
  },
  {
    key: "offer_board",
    title: "Join the offer board",
    body: "The offer board is where the live setter positions are. Join it now, everything after training happens there.",
  },
  {
    key: "offer_board_loom",
    title: "Watch the offer board walkthrough Loom",
    body: "The Loom attached in the offer board shows exactly how to use it: roles, applications, what good looks like. Watch it fully before you touch anything else there.",
  },
  {
    key: "skool_training",
    title: "Finish ALL the training videos in Skool",
    body: "Every video, in order. This is your foundation: the group calls and looms only click once you've seen the full system.",
    link: { to: "/training", label: "Open training" },
  },
  {
    key: "offer_board_course",
    title: "Complete the offer board course",
    body: "Inside the offer board itself there's a course on how to run it end to end. Go through the whole thing, it's the last step before your portal unlocks.",
  },
];

export const START_HERE_REQUIRED_KEYS = START_HERE_STEPS.map((s) => s.key);

export function isStartHereComplete(doneKeys: ReadonlySet<string> | string[]): boolean {
  const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys);
  return START_HERE_REQUIRED_KEYS.every((key) => done.has(key));
}
