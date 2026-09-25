# Log: Old Setting Process retired, DM Setter Playbook is the main DM script

### Prompt
Founder, after the playbook shipped (PR #11): "Remove the old setting process and all the video links and all that stuff. We're going to do that through Mochi." Then: "push it dude i dont see it in knowledge in the portal. remove the old setter workflow. make this the main script for dm setting". He also asked to change the DM setter EOD target "to 5 sets a day or 3 sets a day, still".

### Issue
The playbook wasn't live yet (PR #11 open), so it wasn't in Knowledge. The old Setting Process page (guided workflow, script library, DM mastery board) still sat next to it and contradicted it: it said never qualify by country and used the Green/Amber/Red lanes. A public `/print` route served its one-pager to anyone. The setters' portal guide doc still sent people to it.

### What I did
- Merged PR #11 once CI was green and confirmed production served the merge build (all 46 live assets present in the local build of `47d8e60`).
- Retired the old page. `/sops/isa-setting-process` and `/sops/dm-setting-mastery` now redirect to `/sops/dm-setter-playbook`, and the old `/knowledge/<slug>` bookmarks map there too. Deleted `dm-mastery-board.tsx`, `src/data/sections.tsx`, `src/data/content.ts`, the public `src/routes/print.tsx`, and the `--tab-*` canvas colours only that page used.
- Knowledge Hub: the "Setting Process" card is gone. The playbook card says it's the main script for DM setting, and the page badge reads "Main script".
- Playbook: no video link placeholders left. Scripts say a video is coming and the context line says to send it from Mochi. The toolkit drops "free videos" and "pre-call video", and the Mochi item now covers sending videos.
- Live DB: updated the `portal-guide-setters` doc to point to the DM Setter Playbook (the old screenshot line, the paragraph and the quick-reference row). `scripts/seed-portal-guides.mjs` matches it, so a re-seed won't bring the old text back, and `shoot-guide-assets.mjs` now shoots the playbook.
- Tests: removed the two suites that pinned the old page's text and the old page's lines in the reliability contract. Added `tests/dm-setter-playbook.test.mjs`: the playbook is first in Setting, the old routes redirect, students are gated out, the fairness, money and outbound rules stay, there are no video link placeholders and no em dashes.
- CLAUDE.md and AGENTS.md: KPI targets now point to the `kpi_targets` table as the live source, with the current rows.

### How I did it
Branch `feat/retire-setting-process` off `origin/main` (`47d8e60`). Supabase MCP for the read-only checks and the one guide-doc `UPDATE` (a targeted `replace()`, verified: no "Setting Process" left). `npm run verify`: 83/83 tests, lint 0 errors, build clean.

### What was challenging
- The KPI ask rested on a wrong number from me. CLAUDE.md said DM setters target 300 DMs and 6 sets, but `kpi_targets` has had a DM row since 2026-08-20 at 100 DMs and 3 sets, changed in Admin. So "5" would raise the target, not lower it. I left the live target alone and asked the founder. The docs now say to query the table first.
- "All the video links and all that stuff" was ambiguous. I applied it to the video links only. The booking-link placeholders stay, because the WhatsApp link message needs them.

### Future work
- The founder's decision on DM sets: stay at 3 (live) or raise to 5 (Admin → Setter KPIs, or a new `kpi_targets` row).
- The `eod-kpi.ts` fallback eras still stop at 300/6 and don't include the 2026-08-20 rows. They only matter if the table fails to load, but they should match.
- `react-zoom-pan-pinch` is now unused (only the old page used it). Drop it in a dependency cleanup.
- Re-run the guide screenshot pipeline so the setters guide gets a playbook screenshot.
