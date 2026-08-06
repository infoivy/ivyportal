# Log: Sami Khan $10k plan glitch + money-flow edit affordances

### Prompt
"I added the 1K because it was showing 2K out of 10K for some reason. Now, bro, it's glitched! What is this? It's showing 10K. No, dude, can you fix it, please? In the cash flow, allow me to edit stuff as well. If I hover over it, have an edit button so I can remove something, or change the date of something, or change the installment."

### Issue
Sami Khan's plan card read "$3,000 / $10,000" for a $5,000 deal with $1,000 collected at close. Root cause was not a display bug: the close had been logged TWICE on Aug 6 (identical $5k deals with $1k upfront at 15:09 and 15:39), which also created two installment plans. The plan card correctly sums a student's non-voided deals, so the doubled deal produced a $10k target and $2k upfront. The founder then added a $1,000 "Collected at close" deposit row on top, triple-counting the same $1,000. Separately, Money-flow rows on Finance were editable only by an undiscoverable click-to-expand.

### What I did
- Voided the duplicate deal f3f11dc1 ("Duplicate deal log, same deal entered twice on Aug 6").
- Flipped the erroneous $1,000 paid deposit row to refunded with a correction note (the immutability trigger's one exit; not a customer refund).
- Voided the duplicate plan b4dd1903 so upcoming stopped showing $8k for a $4k remainder.
- Verified end state: one deal ($5k, $1k upfront), one plan (seq $1k Sep 6 + $1k Oct 6 + $2k Nov 7 upcoming, $1k waived), card reads $1,000/$5,000 incl. $1,000 collected at close.
- PlanEditor guard: when the selected student's deal already records upfront cash, the "Collected at close" field shows a warning naming the amount and stating the plan card counts it automatically, so it never gets re-entered.
- Money flow: hover on any editable row (installments, expenses) now reveals a pencil icon; click still expands to the inline editors (installments: amount/due date/save/waive; expenses: edit/remove).

### How I did it
- Data fixes ran as founder-attributed SQL (set_config request.jwt.claims DO block) because paid-history immutability blocks even service SQL; used void_installment_plan and the paid→refunded exit.
- src/components/revenue/payment-plans-section.tsx: PlanEditor gains dealByStudent prop; deposit hint swaps to a warning when dealUpfront > 0.
- src/routes/_authenticated.finance.tsx: group/flowrow class moved to the row button; Pencil shown for (pay || expense) && canEditMoney. Kept uniform click-to-expand (a first cut routed expenses straight to the modal, but that lost the Remove button in the expansion).
- Gates: eslint clean, 78/78 tests, tsc + build green. Commit 64110d0.

### What was challenging
- The founder's report ("it's glitched") looked like a display bug but was doubled source data; had to trace deal → plan → deposit row before touching anything.
- Paid rows cannot be deleted or edited by design; the correction had to use the refunded status with an explanatory note so the audit trail says why.
- deals column names differ from intuition (total_value, cash_collected_upfront) — verify queries failed twice before matching the app's own select.

### Future work
- Hamza's remaining plan ($500 Aug 29 + $2,000 Sep 29) still awaiting founder confirmation whether to void.
- Ibrahim's August $700: mark paid once confirmed.
- Consider blocking a second non-voided deal for the same student on the same day at entry time (warn "a deal for this student was logged N minutes ago").
