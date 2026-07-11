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
const SIGN_IN = `## Signing in

1. Go to **[portal.ivysalesacademy.com](https://portal.ivysalesacademy.com)**.
2. Enter your work email and password, then press **Sign in**.
3. First time here? Press **Sign up** instead — an admin then approves your account and gives you your role. Until that happens you'll see a "pending approval" screen; that's normal.

> Tip: the sidebar on the left is your map. Everything in this guide lives there. On your phone, tap the ☰ button (top-left) to open it.`;

const EOD_POLICY = `## The EOD rule — read once, never break it

EODs are **7 days a week, for every role — you cannot miss a single one, ever.** Zero is a valid answer; silence is not.

- The amber **EOD due** pill in the top bar means you haven't filed today. When it disappears, you're done.
- Real emergency? Message a founder **before 23:59** — pre-approved is fine; explained the next morning is a miss.
- Misses escalate fast: **1st** = written warning · **2nd** (within 60 days) = PIP, bonuses paused · **3rd or any fabricated number** = disciplinary.
- Team meetings follow the same rule: **mandatory, on time**, absence pre-approved by a founder.

Full policy (read it once): **[EOD & Meetings Policy](/policies/eod-hygiene)**.`;

const EOD_RULES = `EODs are **7 days a week — there are no off days.** Zero is a valid answer; a missed report is not.

| Setter type | Daily target |
| --- | --- |
| Phone setter | 100 dials **and** 3 sets |
| DM setter | 125 leads contacted **and** 3 sets |
| Full-cycle | 100 dials **and** 50 leads outreached **and** 3 sets |`;

// ── docs ─────────────────────────────────────────────────────────────────────
const DOCS = [
// ═════════════════════════════ SETTERS ═════════════════════════════
{
  slug: "portal-guide-setters",
  title: "Portal Guide — Setters",
  category: "setting",
  role_visibility: ["setter"],
  is_founder_only: false,
  pinned: true,
  sort_order: 1,
  content: `# Portal Guide — Setters

Your daily loop in the portal takes about **3 minutes**: log your EOD, check your scorecard, claim your sets. This guide walks through each step.

${SIGN_IN}

## 1. Submit your EOD (every day)

${img("setter-eod", "EOD Reports page with the daily form")}

1. Click **EOD Reports** in the sidebar.
2. The form at the top shows **today's KPI** for your setter type:

${EOD_RULES}

3. Fill in your numbers with the **+ / −** steppers or type them directly.
4. Write your **Wins / summary** (required) — one or two honest sentences.
5. Press **Submit**. Done before **23:59** — missed days hurt the team's rolling average and your streak.

> The form **autosaves a draft** as you type ("Draft saved ✓" next to the heading). If you close the tab and come back — even on your phone — your numbers are still there.
> Already submitted? Open the same page and press **Update** to correct today's numbers.
> The **My history** tab shows every report you've filed, and the streak card at the top shows your run — protect it.

${EOD_POLICY}

## 2. Check where you stand — Sales page

${img("sales-today", "Sales page — today's compliance and scorecards")}

Click **Sales** in the sidebar. One scrolling page shows:

- **Today's submission status** — who has filed, who hit KPI, who is missing.
- **Trends** — the funnel over any date range: DMs → Convos → Booked → Shows → Closed Rate. Use the **7D / 30D / 90D** buttons or pick a custom range, and press **Compare** to see the previous period as a shadow line.
- **Scorecards** — your per-setter totals and show rate. **CSV** exports the table.

## 3. Claim your sets — Calendar

${img("calendar", "Calendar page with the Set reminders list")}

1. Click **Calendar** in the sidebar.
2. Bookings made through Calendly appear automatically in the **Set reminders** list as **Unclaimed**.
3. Press **Claim** on a set you booked. It becomes yours, and if your Google Calendar is connected you'll get reminders **2 days, 1 day, 3 hours, and 1 hour** before the call.
4. To connect your Google Calendar, press **Connect Google Calendar** at the top of the page (one-time, ~20 seconds).
5. The timezone picker above the grid lets you view everything in your own timezone.

## 4. After you set a call

1. Send the prospect the group-chat/salam message per the setting SOP (see **Knowledge → Setting**).
2. Make sure the set shows in the Set reminders list and is claimed by you.
3. Log the set in today's EOD under **Calls booked (sets)**.

## 5. Your money — Revenue

${img("revenue-setter", "Revenue page — deals and commissions")}

Click **Revenue** to see deals, cash collected, and your commissions:

- You earn your **base setter percentage** on deals you set.
- **+1%** for the **top setter** of each 14-day period.
- **+1%** in any Mon–Sun week where **you personally** collect **$5,000+ cash** (individual, not team).
- Setters don't close — if you somehow set *and* closed the same deal, that's paid as one 15% "set + close", not base + 10%.

## 6. Everything else you'll touch

- **Action Items** — tasks assigned to you, and tasks you assign to teammates (yes, setters can assign to each other — the item shows who it came from). Tick them off here; overdue ones turn red.
- **Testimonials** — when a student posts a win in the community, drop the screenshot/video here the same day so marketing can use it.
- **Training** — course material and recordings for setters.
- **Notes** — your personal scratchpad (switch to Team to see shared notes).
- **Dashboard** — the team-wide funnel and the weekly cash + setter leaderboards. Your name on that board is the goal.
- **Profile** — set your display name and avatar so the leaderboards and feeds show *you*.
- **⌘K / Ctrl-K** — search from anywhere: pages, students, docs.
- **Knowledge** — every SOP, including the full **ISA Setting Process** (the 8-stage system) and both policies.
- Dark/light mode: the moon/sun button in the top bar.

## If something looks wrong

- A set in the Set reminders list isn't yours → leave it; only claim sets you booked.
- You submitted wrong numbers → open **EOD Reports** and press **Update** (same day only — backfilling later days isn't allowed, see the policy).
- You can't see a page you think you need → ask a founder; pages are role-gated on purpose.
`,
},
// ═════════════════════════════ CLOSERS ═════════════════════════════
{
  slug: "portal-guide-closers",
  title: "Portal Guide — Closers",
  category: "closing",
  role_visibility: ["closer"],
  is_founder_only: false,
  pinned: true,
  sort_order: 1,
  content: `# Portal Guide — Closers

Two things pay you: closing calls and logging them properly. This guide covers your daily EOD, logging a close (so revenue, installments, and your commission all track automatically), payment links, and chasing installments.

${SIGN_IN}

## 1. Submit your EOD (every day)

1. Click **EOD Reports** in the sidebar.
2. Fill in **calls taken, closes, deposits, cash collected, deferred cash, follow-ups** — zero is a valid answer.
3. Write your **Wins / summary** and press **Submit** before **23:59**. Seven days a week, no off days.

Field notes: **deposits** = partial payments taken today; **cash collected** = money that actually landed today; **deferred cash** = signed but not yet collected (e.g. a split's later payments). Your EOD numbers must match the Revenue log — they're audited against each other.

The form autosaves a draft as you type, so nothing is lost if you get pulled into a call. The **My history** tab shows every report you've filed.

${EOD_POLICY}

## 2. Log a close — the most important 60 seconds

${img("log-a-close", "The Log a close dialog on the Revenue page")}

1. Click **Revenue** in the sidebar, then the green **+ Log a close** button.
2. **Student** — pick an existing student, or choose **New student** and type their name; the student record is created for you.
3. **Setter (optional)** — attribute the setter who booked the call. This pays them their commission, so don't skip it.
4. **Pathway** — pick what they bought. This matters:
   - **1:1 Pathway** — the student gets **10 one-on-one coaching calls** (their call allowance is set automatically).
   - **Group Expertise Pathway** — **group coaching only, no 1:1 calls**. Their 1:1 allowance is set to zero, so they never appear in the "needs a 1:1" radar.
5. Fill in **Total value ($)** and **Cash upfront ($)**, and pick the **Payment type**:
   - **PIF** — paid in full today.
   - **Deposit** — partial cash now, the rest on a plan.
   - **Split** — installments from day one.
6. Add the **Contract URL** and **Fathom URL** if you have them, then press **Log close**.

That one entry drives everything: the Revenue dashboard, the Installments tracker, the student's record and coaching allowance, and your commission — no double entry anywhere.

**Commission rules:** you earn **10%** on a close. If **you yourself** also set the call (you = setter **and** closer), it's **15% total** instead — not 10% + setter base.

## 3. Installment plans — even split or custom schedule

${img("log-a-close-schedule", "Custom installment schedule inside Log a close — $5,000 as $2,000 + $2,000 + $1,000")}

When the payment type is **Deposit** or **Split**, the plan builder appears in the dialog. Leave **"Create installment plan for the remaining balance"** ticked and choose a schedule:

- **Even split** — set the number of payments, the first due date, and the frequency (monthly / biweekly / weekly). The per-payment amount is calculated for you.
- **Custom schedule** — for deals that don't split evenly. Example: a **$5,000** close paid as **$2,000 + $2,000 + $1,000** over three months — add a row per payment with its own amount, due date, and (optionally) payment method. The counter at the bottom right must read **"matches remaining"** in green before you can save; if it shows *unallocated* or *over*, your rows don't add up to the remaining balance.

Every payment lands in **Revenue → Installments** with its own due date, and the follow-up queue chases them automatically.

## 4. Student signed themselves up? Close them from their page

${img("student-setup-payment", "A self-signed-up student — no payment on file yet, with the Set up payment button")}

Some students create their portal account **before** any money changes hands (they sign up, an admin approves them as a student). They exist on the **Students** page but have **no payment on file**. When you close them:

1. Click **Students** in the sidebar and open their name (or ⌘K → type it).
2. Their page shows a **Set up payment** button — press it.

${img("payment-setup-dialog", "The Set up payment dialog — same pathway, PIF/installments, and custom schedule options")}

3. The dialog is the same flow as Log a close: **pathway** (1:1 vs Group Expertise), total value, **PIF or installments**, and the same **even/custom schedule** builder.
4. Press **Create deal & plan**. The deal, the installment schedule, and your commission are recorded exactly as if you'd used Log a close — Revenue and Installments update automatically.

Rule of thumb: **already in the Students list → close from their page. Not in the list → Log a close with "New student".** Never do both — that would double-log the deal.

## 5. Payment links — Closer Resources

${img("closer-resources", "Closer Resources — payment links by gateway")}

Click **Closer Resources**. Every live payment link, grouped by gateway (Whop, Wise USD, Wise EUR, bank):

- **Copy link** puts the raw checkout URL on your clipboard.
- **Copy message** copies a ready-to-send message with the link inside — paste it straight into the chat while on the call.
- The section list on the left follows you as you scroll; click a gateway to jump.

## 6. Chasing installments

${img("installments", "Installments tab — follow-up queue")}

Click **Revenue → Installments** tab:

- The cards at the top show what's **overdue** and what's **due in 1–3 days**.
- The **Follow-up queue** lists exactly who to message today. After you reach out, press **Followed up**; when money lands, press **Mark paid**.

## 7. Fixing and finding deals

- Made a typo in a deal? Open **Revenue**, find the deal in the table, click it, correct, save. Deals are operational records — fix mistakes the day you spot them, never "adjust" history to change a number.
- The **Payouts** tab shows commission per person for the period — that's where your 10% / 15% math is visible.

## 8. Everything else you'll touch

- **Calendar** — connect your Google Calendar once (**Connect Google Calendar** button). Every closer's calendar shows in one grid, in your timezone; Calendly sets appear in the Set reminders list.
- **Sales** — the funnel trends and Closed Rate for any date range; your submission status is on this page too.
- **Students** — look up any student before a call: payment state, phase, history.
- **Testimonials** — a client win crosses your DMs? Drop it here the same day.
- **Training** — closer course material and recordings.
- **Notes** — personal scratchpad; Team tab for shared notes.
- **Profile** — display name + avatar.
- **⌘K / Ctrl-K** — search anything from anywhere.
`,
},
// ═════════════════════════════ CSMs ═════════════════════════════
{
  slug: "portal-guide-csms",
  title: "Portal Guide — CSMs",
  category: "csm",
  role_visibility: ["csm"],
  is_founder_only: false,
  pinned: true,
  sort_order: 1,
  content: `# Portal Guide — CSMs

Your home base is the **CSM Workspace** — tally your work as you do it, keep students accountable, and log notes. This guide covers the daily loop plus the Student Success radar.

${SIGN_IN}

## 1. Your daily loop — CSM Workspace

${img("csm-workspace", "CSM Workspace — tally, student list, accountability panel")}

Click **CSM** in the sidebar.

**a) Tally as you work.** The four cards at the top are counters: **Loom reviewed, Roleplay reviewed, Check-in done, Escalation**. Every time you finish one, tap the card once (+1). Don't batch it at the end of the day — tap as you go and the numbers stay honest.

**b) Submit to Team Reports.** At the end of your day, press the green **Submit to Team Reports** button. That files your EOD using today's tallies — you don't fill a separate form. This is your daily EOD and follows the same zero-miss rule as everyone else's.

**c) Work the student list.** Search or scroll the list on the left, click a student, and the **Accountability panel** shows their open action items, last student EOD, and your review counts for them (14 days).

**d) Assign ad-hoc action items.** In the panel, type a task in **New action item…**, optionally pick a due date, press **Add**. The student sees it at the top of their own portal and ticks it off there — you'll see it update here.

${img("action-item-new", "Adding an ad-hoc action item from the Action Items hub — multiple students or team members at once")}

For bigger sweeps, use **Action Items → + Add ad-hoc item**: pick **several students at once** (or team members — they'll see it at the top of their dashboard with your name on it), one task, one due date, done.

**e) Log CSM notes.** Bottom of the panel: write risk signals, follow-ups, or progress notes, tag them (e.g. \`#progress\`, \`#check-in\`), press **Save note**. Notes are visible to coaches and admins on the student's record.

## 2. The radar — Student Success

${img("student-success", "Student Success — at-risk flags and pipeline")}

Click **Student Success**. This page answers "who needs me today":

- **At-risk students** — each card shows *why* (No call in 14d, No EOD, Ghosting, Payment late). Only students still in the active journey (Onboarding → 1:1 Coaching → Applying) can be flagged; students who finished coaching aren't false alarms.
- **This week's 1:1s** — the coaching schedule at a glance.
- **Testimonials pipeline** — students who won but haven't given a testimonial yet. Press **Request →** to open their record.
- **Weekly digest** — new students, offers won, calls, and notes this week.

## 3. Action Items hub

${img("action-items", "Action Items hub")}

Click **Action Items** for every open item in one place — from coach calls and ad-hoc ones. Filter by **Open / All / Mine / Overdue**, or by owner. You can also add items for **multiple students at once** (or team members) with **+ Add ad-hoc item**.

## 4. Testimonials library

${img("testimonials", "Testimonials library")}

Click **Testimonials**: upload video/image/text proof, set the status (**Requested → Received → Approved → Published**), and filter by student or type. When a student sends proof in the group chat, drop it here the same day.

${EOD_POLICY}

## 5. Escalations — the one flow that must never stall

When a student is angry, stuck beyond your reach, or talking about refunds:

1. Tap **Escalation +1** on the workspace (so it's counted).
2. Write a CSM note on the student tagged **#escalation** with what happened, in their words.
3. Message the coach (and Faizan if it's payment- or refund-related) the same hour — the note is the record, the message is the alarm.

## 6. Everything else you'll touch

${img("student-detail", "A student's full record — timeline, EODs, milestones, installments, CSM notes")}

- **1-on-1 Calls** — read the coach's call log for any student: ratings, notes, and the action items they set. Use it before check-ins so you never ask a question the coach already answered.
- **Students** — the full list with journey phases (Onboarding → 1:1 Coaching → Applying → Offer Won → Testimonial). Open a student for their timeline, EODs, milestones, and your CSM notes tab (pictured above).
- **Calendar** — the team calendar in your timezone; connect your Google Calendar with one click if you take calls.
- **Notes** — personal scratchpad; Team tab for shared notes.
- **Profile** — display name + avatar.
- **⌘K / Ctrl-K** — jump to any student or page instantly.

## 7. What you won't see

Money pages (Dashboard, Sales, Revenue, Closer Resources) are outside the CSM role on purpose — your world is students, not deals. If you need a number from those, ask Faizan.
`,
},
// ═════════════════════════════ COACHES ═════════════════════════════
{
  slug: "portal-guide-coaches",
  title: "Portal Guide — Coaches",
  category: "coaching",
  role_visibility: ["coach"],
  is_founder_only: false,
  pinned: true,
  sort_order: 1,
  content: `# Portal Guide — Coaches

Everything revolves around one habit: **log every 1-on-1 right after it ends.** The rating, notes, and action items you enter drive the at-risk radar, the student's portal, and your capacity view.

${SIGN_IN}

## 1. Log a 1-on-1 call

${img("calls", "1-on-1 Calls page")}

1. Click **1-on-1 Calls** in the sidebar, then the green **+ Log call** button.

${img("log-call-modal", "Log 1-on-1 call dialog")}

2. Pick the **student** and check the **date** (a future date books it as *scheduled*; today or earlier saves as *completed*).
3. Set the **progress rating (1–5)** — required for completed calls. 1 = stuck, 5 = crushing it. Be honest; this feeds the at-risk radar.
4. Write the **outcome** and any **coach notes**.
5. Add **action items** — each one appears at the top of the student's own portal, highlighted, and they tick it off there.
6. If the student didn't show, log the call with status **no-show** — that pattern is exactly what the radar needs to catch.
7. Press **Save**.

Use the **table/kanban** toggle to see calls by status, and the coach filter chips to see just your calls.

## 2. Know your roster — Students

${img("students", "Students list with journey phases")}

Click **Students**. Every student sits in a journey phase:

**Onboarding → 1:1 Coaching → Applying → Offer Won → Testimonial** (plus Paused).

- Move a student's phase with the dropdown on their row as they progress.
- The **At risk** filter shows students who need attention, with the reason on each (no call in 14d, no EODs, ghosting, payment late). The "no call in 14 days" rule only applies while they're in **1:1 Coaching** — finished students won't nag you.
- Click a student to open their full record: timeline, their daily EODs (roleplays + applications), milestones to tick off, installments, and CSM notes.

## 3. Your capacity — Coaches tab

${img("coaches-tab", "The Coaches capacity view — load, rating, and stale students")}

On the 1-on-1 Calls page, switch to the **Coaches** tab: active roster count, average rating, calls done, and a list of your students who are **>14 days since their last 1:1** — clear them first each week.

One thing to know about pathways: **Group Expertise Pathway** students have a 1:1 allowance of **zero** — they're coached in group calls only and will never appear in your stale-1:1 list. **1:1 Pathway** students get **10 one-on-one calls**; their remaining allowance shows on their record.

## 4. Your own EOD

You file one too — 7 days a week. **EOD Reports** in the sidebar: check-ins done, sessions, wins, blockers. Takes a minute, autosaves as you type, works on your phone.

${EOD_POLICY}

## 5. Milestones and the student's record

${img("student-detail", "A student's record — timeline, EODs, milestones, installments, notes")}

Open any student (from **Students** or ⌘K) and you get the full picture in tabs: **timeline** of every touch, their daily **EODs** (roleplays + applications — the same numbers the at-risk radar reads), **milestones** to tick off as they hit them, **installments**, and **CSM notes**. Tick milestones the moment they happen — first win especially, since it feeds the testimonial pipeline.

Forgot to rate a call? It shows up in **Admin's unrated calls** queue and you'll get chased — rate as you log and you'll never hear about it.

## 6. Everything else you'll touch

- **Student Success** — the team-wide radar: at-risk (with reasons), this week's 1:1s, testimonials pipeline, weekly digest.
- **Action Items** — everything you've assigned across calls and ad-hoc, with overdue flags. You can assign to multiple students at once with **+ Add ad-hoc item**.
- **Revenue** — read access so you can see a student's deal/payment context before a call.
- **Testimonials** — when a student you coach sends proof of a win, upload it here the same day.
- **Calendar** — connect Google Calendar once; the team's calls in your timezone.
- **Notes** — personal scratchpad; Team tab for shared notes.
- **Profile** — display name + avatar.
- **⌘K / Ctrl-K** — jump to any student or page instantly.
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

This is the full tour — written simply, one step at a time. You can't break anything by clicking around. When in doubt, press **⌘K** (Mac) or **Ctrl-K** (Windows) and type what you're looking for; the portal will take you there.

${SIGN_IN}

## 1. Your morning: read the Dashboard (2 minutes)

${img("dashboard", "The Dashboard")}

Click **Dashboard** in the sidebar. Read it top to bottom:

1. **The big number** = cash collected this month. Click **View revenue →** to see the deals behind it.
2. **The four cards** (DMs, Booked, Shows, Show Rate) = this period's sales activity. The **7D / 30D / 90D** buttons change the period. **Compare** shows the previous period as a faint line behind the current one.
3. **The ops strip** = today's problems: **at-risk students, overdue payments, payments due soon, testimonials pending**. Each one is clickable and takes you to the page where you fix it.
4. **Click any number card** to open a breakdown by person and by day.
5. Further down: the funnel (how DMs become closes), the volume trend, and the leaderboards.

**Faizan:** your daily flow is Dashboard → **Sales** (who filed EODs, who missed — the *missed yesterday* card has a **Copy nudge** button that writes the chase message for you) → **Student Success** (who's at-risk).
**Abu Bilal:** your daily flow is Dashboard → **Revenue** (deals + installments due) → **Sales** trends.

## 1b. Enforcing the EOD rule (2 minutes, every morning)

The team policy is simple: **nobody misses an EOD, ever** — 7 days a week, every role, zeros allowed, silence not. The portal does the policing for you:

1. Open **Sales** before 10:00. The *submission status* list shows exactly who filed, who hit KPI, and who is **missing**.
2. For anyone on the *missed yesterday* card, press **Copy nudge** — a ready-made chase message lands on your clipboard; paste it in their DM.
3. A silent miss = an instance, logged the same day: 1st = written warning, 2nd within 60 days = PIP with bonuses paused, 3rd or fabricated numbers = disciplinary.
4. The only exception is an emergency cleared with **you** before 23:59 the day of.
5. The full policy the team reads: **[EOD & Meetings Policy](/policies/eod-hygiene)** (in Knowledge, next to the [CRM Hygiene Policy](/policies/crm-hygiene)). Meetings follow the same rule — attendance is mandatory unless pre-approved by you.

## 2. When someone new signs up — approve them (Team page)

${img("team", "Team page — members and pending approvals")}

New sign-ups wait in a **pending approval** queue at the top of **Team**:

- **It's a student** → press **Approve as student**. The portal creates their student record and takes you straight to it, with the **payment setup** window already open — fill in what they bought (paid in full or installments) and press save. Revenue and Installments update by themselves.
- **It's a team member** → press **Set up as team member** and tick their role(s): setter, closer, coach, CSM, admin.

That's the whole flow. No one gets access until you approve them.

## 3. Adding a student yourself

${img("add-student", "Add student dialog")}

**Students → + Add student**: name, email (use the same email they'll sign up with — the portal links their login automatically), package, and payment plan. If they pay in installments, the schedule is created for you and shows up in **Revenue → Installments** with due dates.

Students move through phases as they progress — change it on their row:

**Onboarding → 1:1 Coaching → Applying → Offer Won → Testimonial**

## 4. Money — Revenue page

- **+ Log a close** records a deal (usually the closer does this — see the Closers guide).
- **Overview** — cash, booked value, payment types, the trend, and each closer's totals.
- **Installments** — who owes what and when; a follow-up queue for late payers.
- **Payouts** — commission per person. The rules the portal applies: closer **10%**; if the same person set *and* closed it's **15%**; setters get their base % plus **+1%** for the top setter each 14 days and **+1%** for a $5,000+ personal collection week.

## 5. The controls — Admin page

${img("admin", "Admin page — goals, rates, checklist")}

**Admin** in the sidebar is where the knobs live:

- **Monthly cash goal** and **quarterly goals** (these drive the Dashboard progress).
- **Commission rates** — change a % here and every future calculation uses it.
- **Role management** — give or remove roles for anyone.
- **Go-live checklist** — one-time setup items; work through them until 8/8.
- **Unrated calls** — coach calls missing a 1–5 rating; chase these.

## 6. Founder-only rooms

These two are visible **only to you two** — not admins, not the team:

${img("gathering-hub", "Gathering Hub")}

- **Gathering Hub** — the weekly command view: cash vs goal, weekly review, SOPs & playbooks.

${img("content", "Content planner")}

- **Content** — the content planner (TOF posts Monday–Thursday, MOF Friday–Sunday, recorded in two-week batches — Thursday is recording day) and Instagram analytics (log a snapshot once a month).

## 6b. Calendar & booked sets

- **Calendar** in the sidebar shows every connected team calendar in one grid. Press **Connect Google Calendar** once for your own (about 20 seconds).
- Sets booked through **Calendly appear automatically** in the *Set reminders* list. Setters claim their own; whoever claims gets automatic reminders 2 days / 1 day / 3 hours / 1 hour before the call.
- Use the timezone picker to view in Riyadh, Amsterdam, or anywhere else.

## 6c. Weekly rhythm

- **Gathering Hub → Weekly review** — cash vs goal, funnel, EOD compliance, milestones, and testimonials for the week; read it before the team meeting.
- **Content → Instagram** — on the 1st of each month, log the IG snapshot (followers, reach, top reels). The dashboard reminds you if it's missing.
- **Sunday**: spot-check EOD numbers against the CRM ([CRM Hygiene Policy](/policies/crm-hygiene) has the audit steps).

## 7. The library — Knowledge

${img("knowledge", "Knowledge Hub")}

**Knowledge** holds every SOP: the setting process, closing resources, CSM/coach guides (including the role guides that pair with this one), and policies. Press **+ New doc** to write a new one — pick who can see it with the role checkboxes. Docs are plain text with simple formatting; edit anytime with the pencil.

## 8. Quick answers

| I want to… | Go to |
| --- | --- |
| See today's money | **Dashboard** (big number) |
| See who didn't file an EOD | **Sales** → submission status |
| Chase a late payment | **Revenue → Installments** → follow-up queue |
| Check on a student | **⌘K / Ctrl-K** → type their name |
| Approve a new sign-up | **Team** → pending queue |
| Change a commission % | **Admin** → commission rates |
| Change the cash goal | **Admin** → portal settings |
| Assign a task | **Action Items** → + Add ad-hoc item |
| See who's at risk | **Student Success** |
| Plan content | **Content** (founders only) |
| Read the EOD rules | **Knowledge → EOD & Meetings Policy** |
| See a coach's call quality | **Admin** → unrated calls · **1-on-1 Calls** → Coaches tab |
| Remove the demo data | **Admin** → go-live checklist → run \`npm run demo:remove\` |

> One habit to keep the whole machine honest: **everything gets logged the day it happens** — closes, calls, EODs, testimonials. The dashboard is only as truthful as the logging.
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
