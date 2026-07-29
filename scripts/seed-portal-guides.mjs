#!/usr/bin/env node
/**
 * Seed "How to use the portal" guides into the Knowledge Hub — one per role
 * plus a founder-only co-founders guide. Uploads screenshots from
 * scripts/guide-assets/ (or /tmp/guide) to the public `doc-assets` bucket and
 * upserts the docs by slug, so it is safe to re-run after edits.
 *
 * Usage: node --env-file=.env scripts/seed-portal-guides.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key);

// ── upload screenshots ───────────────────────────────────────────────────────
const ASSET_DIR = ["scripts/guide-assets", "/tmp/guide"].find(d => existsSync(d));
if (ASSET_DIR) {
  console.log(`Uploading screenshots from ${ASSET_DIR}…`);
  for (const f of readdirSync(ASSET_DIR).filter(f => f.endsWith(".png"))) {
    const { error } = await sb.storage.from("doc-assets").upload(`guides/${f}`, readFileSync(join(ASSET_DIR, f)), {
      contentType: "image/png", upsert: true,
    });
    if (error) throw error;
    console.log("  ↑", f);
  }
} else {
  console.log("No screenshot dir found — updating doc text only.");
}
const img = (name, alt) => `![${alt}](${url}/storage/v1/object/public/doc-assets/guides/${name}.png)`;

// ── shared snippets ──────────────────────────────────────────────────────────
const EOD_POLICY = `## The EOD rule — read once, never break it

EODs are **7 days a week, for every role — you cannot miss a single one, ever.** Zero is a valid answer; silence is not.

- The amber **EOD due** pill in the top bar means you haven't filed today. When it disappears, you're done.
- Real emergency? Message a founder **before 23:59** — pre-approved is fine; explained the next morning is a miss.
- Misses escalate fast: **1st** = written warning · **2nd** (within 60 days) = PIP, bonuses paused · **3rd or any fabricated number** = disciplinary.
- Team meetings follow the same rule: **mandatory, on time**, absence pre-approved by a founder.

Full policy (read it once): **[EOD & Meetings Policy](/policies/eod-hygiene)**.`;

const EOD_RULES = `EODs are **7 days a week — there are no off days.** Zero is a valid answer; a missed report is not.

**The KPI is sets-first.** Hit your sets target and your day is green — full stop (3/day for phone and full-cycle, 6/day for DM setters). Couldn't get to 3 sets? Then full volume still counts as a KPI day:

| Setter type | Volume fallback (when sets < 3) |
| --- | --- |
| Phone setter | 100 dials |
| DM setter | 125 DMs sent |
| Full-cycle | 100 dials **and** 50 DMs sent |

Your EOD belongs to **the day you lived it, in your own midnight**. Set your timezone on **Profile** once and the form always points at the right day, whatever your device clock says. The Today / Yesterday toggle files late nights on the right day; submitted reports lock, and a founder can unlock a trapped day.`;

// ── docs ─────────────────────────────────────────────────────────────────────
const DOCS = [
// ═════════════════════════════ SETTERS ═════════════════════════════
{
  slug: "portal-guide-setters",
  title: "Portal Guide — Setters",
  category: "setting",
  role_visibility: ["setter"],
  pinned: true,
  sort_order: 0,
  content: `# Portal Guide — Setters

Your whole job in the portal: check your week, work your leads, file your EOD before **your** midnight, and lock in every set the moment it books.

${img("dashboard-setter", "Setter home")}

## Your home

Home shows **your** week, not the team's: seven day chips (green = KPI hit, amber = submitted but missed, red = missing), your streak, where you rank by sets, and your last-7-days totals. **Next actions** on the left is your queue — anything assigned to you lands there with a due date.

${EOD_RULES}

${img("setter-eod", "The EOD form")}

## Filing your EOD

**Work → My EOD**, every day, before your own midnight. Set your timezone on **Profile** once so the form always points at the right day. Zero is a valid answer; the narrative fields (wins, blockers, tomorrow) are for your team lead, not for show. Submitted reports lock — if a day gets stuck on the wrong date, a founder can unlock it for a clean resubmit.

## After you make a set

A set is not done when the calendar invite lands. It is done when the prospect **shows up**. Everything below happens the same day you book it:

1. **Make the group chat** with the prospect right away (Instagram or WhatsApp · wherever the conversation lives).
2. **Send the standard welcome message:**

> Hey, Salam alaikum! Great talking to you today · really excited for your call. Before then, go through the training videos so you get the most out of it. Any questions, drop them here anytime.

Adjust the wording to the conversation, but always include the salam, the call confirmation, and the training-videos ask.

3. **Log the set** — it goes in your EOD (calls booked), and add it on the **Calendar** page → *Log a set* for automatic reminders.
4. **Run the reminder cadence** — the portal reminds you at **2 days, 1 day, 3 hours, and 1 hour** before the call: confirm at each touch. No-shows are almost always a reminder failure, not a prospect failure.

${img("set-tracker", "Sets and reminders")}

## Calendar

${img("setter-calendar", "The week board")}

The Calendar opens on the week: every connected call as a chip with its time. The **Sets** tab tracks your booked sets and their reminder schedules — claim your sets so reminders come to you.

## Scripts and SOPs

${img("setting-process", "Setting Process")}

**Knowledge → Setting Process** is the whole system in one page: the guided workflow, the full script library (press / to search), and the DM mastery board. The **Simple Discovery Framework** covers the phone discovery call. The **EOD & Meetings Policy** and **CRM Hygiene Policy** at the top of Knowledge are the two rules that everything else builds on.

${img("setter-knowledge", "Knowledge hub")}

## Quick reference

| I need to… | Where |
|---|---|
| File today's report | **Work → My EOD** |
| See my week and streak | **Home** |
| Log or confirm a set | **Calendar → Sets** |
| Find a script mid-conversation | **Knowledge → Setting Process** → press / |
| See my assigned tasks | **Home → Next actions** or **Work → Action items** |
| Fix my timezone | **Profile** |
`,
},
// ═════════════════════════════ CLOSERS ═════════════════════════════
{
  slug: "portal-guide-closers",
  title: "Portal Guide — Closers",
  category: "closing",
  role_visibility: ["closer"],
  pinned: true,
  sort_order: 0,
  content: `# Portal Guide — Closers

Take the call, close, then make the money real in the portal the same day: log the close, set up the plan, and keep every installment honest against Whop.

${EOD_POLICY}

${img("money-in", "Money in · deals")}

## Money in

**Work → Money in** is your page. The **Deals** tab is your closes: cash collected (Whop net), booked value, deal count, and the trend. The **Payment plans** tab is every installment plan and its schedule.

${img("log-a-close", "Log a close")}

## Logging a close

**Log a close** the day it happens: student, total value, cash collected upfront, payment type. If the deal has a payment plan, build it right there — each installment with its own due date. Self-set deals (you set AND closed it) pay the 15% rate automatically.

${img("payment-plans", "Payment plans")}

## Payment plans and the Whop rule

Money only counts once it is **in Whop**. When you mark an installment paid, the portal checks Whop for a matching charge and warns you if there is none — only override for verified off-Whop money (e.g. a Wise transfer). Leaving paid status also clears the paid date, so nothing double-counts.

${img("closer-crm", "Close pipeline")}

## CRM

**Work → CRM** shows the Close pipeline summary and the outreach-compliance sweep (run it manually — it walks the whole CRM). Actual lead-working happens in Close itself; the portal is the scoreboard.

${img("closer-resources", "Closer resources")}

## Scripts

**Knowledge** carries the closing SOPs in the styled format: the **Objection Handling Playbook** (every objection and its path) and the **Think About It deep dive** (what actually sits behind the smokescreen). **Closer Resources** holds call recordings and reference material.

## Quick reference

| I need to… | Where |
|---|---|
| Log a close | **Money in** → Log a close |
| Build or edit a payment plan | **Money in → Payment plans** |
| Mark an installment paid | **Money in → Payment plans** (Whop-checked) |
| See the pipeline | **CRM** |
| Handle an objection | **Knowledge → Objection Handling Playbook** |
| File my EOD | **Work → My EOD** |
`,
},
// ═════════════════════════════ CSMs ═════════════════════════════
{
  slug: "portal-guide-csms",
  title: "Portal Guide — CSMs",
  category: "csm",
  role_visibility: ["csm"],
  pinned: true,
  sort_order: 0,
  content: `# Portal Guide — CSMs

Keep every student moving: cover the roster with check-ins, review looms, chase silence before it becomes churn, and log everything the day it happens.

${EOD_POLICY}

${img("csm-workspace", "CSM workspace")}

## Check-in coverage — start here every day

The CSM workspace opens with **Check-in coverage**: every active student sorted coldest-first. Red = 3+ days or never, amber = 2 days, done-today sinks to the bottom with the name of whoever handled it — so you never double up with the other CSM and nobody sits cold. One tap on **Check in** logs it. The header shows the math: covered today, who is due, and how fast the whole roster cycles at your combined daily targets (your KPI is your personal daily target — it is on your profile).

${img("students-csm", "Students roster")}

## Students

The roster shows phase (onboarding → training → applying → offer won), status, grade, and health. Open a student for the full picture:

${img("student-detail", "Student detail")}

- Approve looms → phase moves to **applying** (their daily target switches to 5 applications).
- Keep phase and status current — the risk logic reads them.
- Log notes and next actions; assign action items with due dates.

${img("student-success", "Student success")}

## Student success

The delivery-health view: who is at risk (missing EODs, no recent call, payment behind), interventions, and outcomes. Work the red rows first.

${img("action-items", "Action items")}

## Action items and testimonials

**Action items** is the shared task queue — assign to students or teammates, with due dates. **Testimonials**: the moment a student lands an offer, the collection flow starts there; a recorded win without a collected testimonial shows on the founder's home until it is done.

${img("testimonials", "Testimonials")}

## Quick reference

| I need to… | Where |
|---|---|
| See who needs a check-in | **CSM workspace → Check-in coverage** |
| Log a check-in | One tap on the student's row |
| Approve looms / move to applying | **Students →** student **→** phase |
| See who is at risk | **Student success** |
| Assign a task | **Action items** |
| File my EOD (with check-in count) | **Work → My EOD** |
`,
},
// ═════════════════════════════ COACHES ═════════════════════════════
{
  slug: "portal-guide-coaches",
  title: "Portal Guide — Coaches",
  category: "coaching",
  role_visibility: ["coach"],
  pinned: true,
  sort_order: 0,
  content: `# Portal Guide — Coaches

Run your 1-on-1s, rate every call, and leave a trail the whole team can act on.

${EOD_POLICY}

${img("calls", "1-on-1 calls")}

## 1-on-1 calls

**Customers → 1-on-1 calls** is your schedule and history. Every completed call gets logged **the same day**:

${img("log-call-modal", "Log a call")}

- Outcome notes: what you worked on, what changed.
- **Progress rating** (1–5) — unrated calls show on the admin console until you rate them.
- Action items for the student — they see them in their portal and tick them off.

${img("students-coach", "Students")}

## Your students

The roster filtered to your assignees: phase, health, last call, last EOD. A student in **training** with no call in 14 days flags as at-risk — book them before the system has to tell you.

## Quick reference

| I need to… | Where |
|---|---|
| Log a completed call | **1-on-1 calls** → the call → log |
| See my students | **Students** (assigned to you) |
| Assign homework | Student detail → action items |
| File my EOD | **Work → My EOD** |
`,
},
// ═════════════════════════════ CO-FOUNDERS ═════════════════════════════
{
  slug: "portal-guide-co-founders",
  title: "Portal Guide — Co-Founders (Faizan & Abu Bilal)",
  category: "team_ops",
  role_visibility: [],
  is_founder_only: true,
  pinned: true,
  sort_order: 0,
  content: `# Portal Guide — Co-Founders

You hold the founder view now: everything Abdulrahmane sees, you see. This is the daily loop.

${img("dashboard", "Founder home")}

## Home

The founder home is the morning brief: payout reminders when a period is unconfirmed, **cash collected (last 30 days, Whop net)**, the live **to-pay-out** for the current period, the Next-actions queue, and **EODs today** with the exception rows (calls scheduled, students needing attention, overdue installments, pending requests).

${img("performance", "Performance")}

## Performance

Leaders-only. The 7-day view, the activity trend, **Team week** (one card per member, seven KPI chips each — the untyped-setter dropdown lives on the card), and the accountability table. Exemptions set in Team admin apply everywhere at once.

${img("founder-money-in", "Money in")}

## Money · one head, three tabs

**Overview** (Finance) · **Money in** (deals + payment plans) · **Payouts** — same header, same width, only the content changes.

${img("finance", "Finance")}

- **Finance**: cash in vs expenses, profit split, scheduled installment revenue (paid stays counted), and the **Money flow** ledger — every row expands: edit an installment's amount/date/status, delete one, or delete it plus every later unpaid one for that student.
- **Payouts**: the period ledger with per-member confirmations — confirm each payment as you send it; the red banner on Home stays until you do.

${img("payouts", "Payouts")}

${img("team", "Team administration")}

## Team

The directory-style roster: roles, local time, onboarding, **active X ago** (from the activity log), EOD-exempt toggles, invites with statuses, and the **Activity log** at the bottom — every portal action, who did it, when, and exactly what changed.

${img("admin", "Admin console")}

## Admin and calendar

**Admin** holds the go-live checklist, compliance, commission rates, and portal settings (cash goal feeds the Finance pace line; group-call names feed the student weekly EOD). **Calendar** opens on the week board — one chip per call, colors per person, the team meeting shown once with member dots.

${img("admin-calendar", "Calendar week board")}

## Quick reference

| I need to… | Where |
|---|---|
| Confirm payouts | **Payouts** → per-member confirm |
| Fix an installment | **Finance → Money flow** → click the row |
| Exempt someone from EODs | **Team** → edit member |
| See who did what | **Team → Activity log** |
| Unlock a trapped EOD | **Performance → Team week** → day detail |
| Change the cash goal | **Admin → Portal settings** |
`,
},
];
console.log("Upserting docs…");
for (const d of DOCS) {
  const { error } = await sb.from("docs").upsert(
    { ...d, external_links: [], last_reviewed_at: new Date().toISOString().slice(0, 10) },
    { onConflict: "slug" },
  );
  if (error) throw error;
  console.log("  ✓", d.title);
}
console.log("\n✅ Portal guides seeded.");
