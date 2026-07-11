# Log: Perf investigation + design-skills audit (impeccable / taste / layers / Refactoring UI)

### Prompt
1. "app feels kinda slow and laggy" — investigate.
2. Go through the design skills from the tweet (emilkowalski/skills, impeccable.style, tasteskill.dev, layers.jamiemill.com, gnurio/refactoring-ui-plugin) and apply what improves the portal's design.

### Issue
Perceived slowness needed diagnosis before touching anything; and the portal had never been audited against an external design-craft rulebook since the 2026-07-10 redesign.

### What I did
**Perf (measured, production build, Playwright + CDP throttling):**
- Login → dashboard first paint 682ms; fully settled 2.2s; SPA navs 98–182ms; zero long tasks >130ms even at 4x CPU throttle. The app itself is fast.
- Found the real costs: landing fires 32 Supabase queries in one parallel wave with duplicates (profiles ×5, eods ×5, student_calls ×3, installment_payments ×3); auth restore is a 3-step serial waterfall (token → user/roles/profile → page queries); Supabase REST is ~150ms/req from here (worse from Riyadh). Deployed TTFB 684ms.
- Conclusion: latency-bound waterfall + duplicate fetches, not rendering. Reported; query dedup left as proposed follow-up (touches many dashboard widgets).

**Design audit (screenshots of 13 page/theme/viewport combos as demo setter):**
- Knowledge Hub: migration-stub docs rendered admin remediation text ("paste the document body here. Admin: go to…") + amber warnings to non-admins → card previews now detect stubs (`isStubDoc`) and show quiet italic "Content coming soon."
- Mobile EOD bug: KPI label and value collided ("Calls booked (sets)6 / 3") → `gap-3` + truncate label + `shrink-0` value in `KpiBar`.
- Calendar: empty-state guidance was below the 24h grid (invisible without scrolling) → centered pointer-events-none overlay on the grid.
- Training: search input shown with zero videos + copy duplicated between subtitle and empty card + admin instructions shown to setters → search hidden when empty, subtitle stable, copy branches on `isAdmin`.
- Testimonials: TEXT/Trustpilot type badges used success-green/warning-amber — the same colors STATUS_META uses for approved/requested states on the same card → type badges now neutral; color = state only.

### How I did it
Perf: `node .output/server/index.mjs` preview + Playwright (`channel: "chrome"`) with `Emulation.setCPUThrottlingRate`, PerformanceObserver longtask capture, and supabase request waterfall logging. Demo login required re-running `npm run demo:seed` (users had been removed; seed v2 logins are `bilal…adam@isa.demo`).
Design: cloned all five repos, distilled Refactoring UI's 10 checks + impeccable's product register + layers' surface checks, screenshotted dark/light/desktop/mobile, vetted each finding at file:line before editing.
Files: `src/routes/_authenticated.{eods,knowledge.index,training,calendar,testimonials}.tsx`. Verified with tsc, build, and re-screenshots of all five fixed pages.

### What was challenging
- A stale preview server kept serving an old build after rebuild — new hashed assets 404'd through the old process and the login flow hung; kill-by-port and restart fixed it.
- "Laggy" could not be reproduced locally against the prod build — the honest answer is the network waterfall (and possibly dev mode), not the UI. Resisted fixing invented problems.
- Most Refactoring UI checks PASS — the 2026-07-10 design language already covers hierarchy, shadows, spacing. The real finds were audience/register issues (admin copy leaking to setters) that pure visual review would miss.

### Future work
- Dedupe the dashboard's duplicate queries (share `profiles`/`eods` query keys across widgets) — biggest measured perf win available (~40% fewer requests on landing).
- Consider skeletons instead of centered `Loader2` spinners on sales/payouts/training/student-success (skeletons.tsx already exists; impeccable: "skeletons, not spinners in content").
- Demo data is seeded in the production DB for verification — run `npm run demo:remove` when no longer needed.
- Ask the user where the lag is felt (dev vs deployed, which page, wifi vs cellular) to close the loop.
