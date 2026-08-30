# Review Wave Triage: Bun iOS App

2026-08-30. Review + test-gap swarm ran on `ios-bun` (56 files, ~20.7k lines). Every P1 claim was re-verified against the web portal's canonical business code before acting. Full subagent reports: `/opt/data/cache/delegation/subagent-summary-{0,1}-20260830_202431_*.txt`.

## Accepted and being fixed

1. **Weekly bonus threshold** (PayoutsCalc.swift): iOS used $5,000, which MATCHES web parity (`src/lib/revenue.ts` says $5,000 Mon-Sun week). The review's $7,500 claim cited stale AGENTS.md text. VERDICT: iOS is correct with the web; AGENTS.md line itself is stale. No code change to the threshold; AGENTS.md needs the business-rule doc updated instead.
2. **DM KPI 300/6 vs 125/3** (BunTeam.swift, PortalAPI.swift): iOS matches the web's founder-approved era (300 DMs / 6 sets effective 2026-07-29, commit 656232b, plus the kpi_targets era system). VERDICT: iOS is correct; not a bug. Gap: iOS hardcodes eras instead of reading kpi_targets from the DB - the web reads the table first. BACKLOG: wire kpiTargets to the DB rules with hardcoded eras as fallback (parity with web use-kpi-rules).
3. **Top-setter 14-day +1% bonus missing**: TRUE on both platforms - web revenue.ts has no top-setter implementation either. This is a real doctrine-vs-implementation gap, but changing commission logic requires founder approval per AGENTS.md change discipline. ESCALATED TO FOUNDER, not auto-fixed.
4. **Committed Supabase publishable key** (PortalConfig.swift tracked): TRUE - the file is tracked despite the AGENTS.md rule. The key is publishable/anon class (safe by Supabase design, always public in web bundles) but the repo's own rule says config must be gitignored. Fix: move to gitignored PortalConfig + tracked PortalConfig.example, rotate not required (publishable key is not a secret), but history cleanup optional.

## Rejected (review claims that did not survive verification)

- "Weekly bonus contradicts doctrine at $5,000": rejected, web parity confirmed $5,000.
- "DM KPI is wrong at 300/6": rejected, founder-approved era confirmed.

## Real correctness findings (accepted)

5. **Stale async range overwrite** (BunHome cashSeries): rapid range switching can render the wrong range's data. Fix: generation token on load tasks. SCHEDULED.
6. **Org switch does not clear org-scoped state** (BunStore.switchOrg): stale prior-org data can display. Fix: clear state before refreshAll. SCHEDULED.

## Craft (P2) - scheduled as a batch

Dynamic Type (Typography.swift), Reduce Motion (BunComponents/BunWelcome/TimelineView), Reduce Transparency (glass fallbacks), VoiceOver labels on icon-only controls, chart accessibility summaries, hardcoded literal colors -> BunTheme tokens.

## Test-gap top-10 (subagent 2)

Adopted order: 1 (Home-action routing contract), 2 (role x hard-gate matrix), 3 (student-health boundaries), 4 (payouts custom rates/caps/self-set), 10 (payout ledger UI smoke). Then 5-9 (date edges, action queue, calendar state machine, EOD form, preset parser extraction).

## Documentation drift found

ios/README.md documents legacy presets (-demoScenario etc.) that no longer exist in code; current presets are -bunTab/-bunMoneySection/-bunSheet. README needs updating when preset parser is extracted.
