# Log: Full portal sweep · defects, Inter, SOP consolidation, portal guides

### Prompt
Founder ordered a nose-to-tail pass over the entire portal: every page, redirect, and spacing decision; fix named defects (stale Founder HQ copy, admin spacing, finance number rhythm); consider a more professional font; merge the two setting SOPs into one "Setting Process"; delete four stub docs; restyle Simple Discovery Framework and the objection SOPs into the EOD-policy look; de-brand Grow Acquisition; then rebuild all portal guides with fresh dark-mode screenshots. Full autonomy, multiple runs.

### What I did
**Run 1** (bd6d349): Inter replaces Geist (Google Fonts link + --font-sans). Admin: dead "Founder HQ command view" copy now points at Finance; group-calls editor got real vertical rhythm. Finance headline number aligned to the stat rhythm. Dead code: /mochi → redirect stub, unused CONTENT_PLAN_URL and three never-called onboarding exports removed. Migration 20260729120000 deletes the four stub docs and makes Setting Framework Script student-only; DocShell collapses its empty nav rail for section-less (embed) docs — the "loads on the right side" bug. Four divergent h1s normalized to text-display. Mobile: Performance trend chart is responsive (height, tick thinning, no dots), Mochi funnel wraps, calendar cells compact.

**Run 2** (038c609 + merge commit): DM Setting Mastery board extracted to a component and mounted as a third mode of the Setting Process page (Workflow · Script Library · DM Board), old route redirects, Knowledge shows one card. New StyledSopPage renders DocShell chrome over verbatim content with a transcript-aware formatter (prospect quotes, numbered steps, sub-headers, coaching notes); Simple Discovery Framework, Objection Handling Playbook, and Objection · Think About It became styled /sops routes; their DB rows retired by migration 20260729123000 with in-app slug redirects. World-Class Client Delivery dropped its Grow Acquisition case-study line.

**Run 3** (38af6ca): screenshot pipeline refreshed for the current IA, forced dark theme, 29 shots via temp accounts + is_demo rows (auto-cleaned, verified zero residue). All five portal guides rewritten against today's portal; setters absorb the after-you-make-a-set doc (row retired); co-founders guide covers their new full-founder view. Docs table now 13 real rows.

### Verification
Per run: tsc, eslint, 78 tests, build, supabase:verify (34 tables), pathspec commits, fetch-first pushes, prod asset-rotation checks (Inter confirmed in live HTML). Student RLS unchanged paths probed earlier in the day.

### Future work
- The two policy pages could migrate onto DocShell for code (not visual) dedup.
- Guide screenshots inflate expected-EOD counts slightly (temp accounts existed at shoot time) — cosmetic.
- mobcrawl.mjs/dpcheck.mjs root scripts are stale utilities; delete when convenient.
