# Log: Students kanban editing, payment at a glance, student EOD pulse, CSM notes on home

### Prompt
Founder (2026-07-31 evening): kanban should be the standard Students view with the same editing the list has; he wants all student EODs visible somewhere with a graph "just like the CSM EOD graphs"; group-program students should lose 1:1 surfaces and the assigned coach; the roster's payment cell should show how much was paid and link to the student's payments; and the fulfillment home should surface the CSM notes ("who's actually adding notes and who's not · add a table for that").

### Issue
Kanban cards were read-only links (drag only); the table was the only editable surface. Payment on the roster was a bare state chip. Student EODs existed only per-student. Group students carried meaningless coach/1:1 UI. CSM notes were buried in per-student tabs.

### What I did
- Students view defaults to kanban, persisted per browser (`students.view`); cards gained a pencil quick-edit (phase, status, coach, next action — identical to the table's editors) while dragging still works; the name links to the detail page.
- Group-program rule (calls_allotted = 0): no coach select anywhere (table shows "Group", card editor hides coach, detail chip hidden), no 1:1s tab or Since-last-1:1 stat, a dedicated "Group program" lane on the by-coach board, and drops onto coach lanes are refused with a toast.
- Pay column: paid-vs-total sub-line ("$1,000 of $3,000 paid", green when settled) computed from deals + paid installments (RLS silently hides it from CSMs), and the whole cell deep-links to the student's Installments tab via a new `?tab=` search param on the detail route.
- `student-eod-pulse.tsx` on Student success: weekly ComposedChart in the CSM graph language (stacked roleplays/looms/applications bars + EODs-filed line, 8 weeks) and the full latest-first feed of every student EOD with a name filter, rows linking to the student.
- Fulfillment home: "Latest CSM notes" feed (CSM · student · date · note, student links) and a Notes column in the CSM week table with zero highlighted — who writes notes is one glance.

### How I did it
All client-side; no migrations. `students.$id` route gained `validateSearch` tab param. Roster money query keyed `["page","student","roster-money"]` so existing deals/installments invalidation fanouts refresh it. Commit `8337114`; gates tsc/eslint/78 tests/build/verify; CI green; deploy asset-verified.

### What was challenging
StudentCard had to stop being one big `<Link>` (selects inside an anchor navigate on click) — restructured as a div with a linked name row; drag disabled while editing so text selection works.

### Future work
- The EOD pulse caps the feed at 60 rows / 8 weeks; add pagination if the roster grows.
- The quick-edit could gain payment_state if the founder asks (kept to the table's exact field set for now).
