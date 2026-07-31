# Log: Whop card wallets + payouts paid-amount truth

### Prompt
Founder (2026-07-31, follow-up to the July settlement): the settled Payouts rows still looked "glitched / weird" (they showed computed totals, not what he actually paid: Aalian $337.50, Abu Bilal $170 with $247 sent earlier, Faizan $1,755, his own profit share $2,995.20). And he wants to track the three founders' Whop cards: each card is loaded monthly with commissions + profit share, spending draws it down, unspent carries into next month; he needs everybody's balance, what's been used, and for his own card how much he leaves in the business.

### Issue
`payout_confirmations.amount_paid` stored the truth but the UI led with the computed figure, so settled rows contradicted reality. There was no concept of the card wallets at all; Faizan's spending lived in the founder's head ($2,400-ish used, $668 remaining).

### What I did
- New `wallet_entries` table (kind credit/spend, positive amount, mandatory note, RLS founder+cofounder only, audit trigger) and a **Cards** tab under Money (`/cards`, founder/cofounder): one card per founder role holder with balance, loaded/spent totals, this-month movement, month-grouped entry list with delete, and inline "Load card" / "Log spend" forms. The signed-in founder's own card labels its balance "Kept in the business".
- Payouts confirmed rows now lead with the stored paid amount; when it differs from the computed total by $1+ a muted "ledger computed $X" line shows underneath. The header's "confirmed paid" sum also uses stored amounts.
- Seeds (founder-attributed SQL): Faizan credit $1,755 (July commissions) + $693.26 (profit share) − $1,780.26 consolidated spend = **$668** balance; founder credit **$2,995.20** (July profit share, 70%); Abu Bilal's card starts empty (no numbers given). Abu Bilal's July confirmation note now records the $247-sent-earlier + $170 detail (amount stays $170 per founder decision).
- `scripts/verify-supabase.mjs` expectedTables list had gone stale at 34 tables, silently skipping 21 newer ones; now checks all 55.

### How I did it
Migration `20260731090821_wallet_entries` (MCP apply → local file). `src/routes/_authenticated.cards.tsx` (new, payouts-style role gate + MoneyShell), `src/components/revenue-tab-bar.tsx` TABS + `src/lib/portal-navigation.ts` WORK_NAV_ITEMS (nav-pages derives automatically), `src/lib/query-keys.ts` (cardsPage key, wallet_entries fanout), `src/routes/_authenticated.payouts.tsx` (paid chip + paidSum). Build regenerates routeTree for the new route. Gates: tsc, eslint, 78/78 tests, build, supabase:verify (55). Commit `ec15ce6`.

### What was challenging
Faizan's narrated numbers didn't reconcile ("used $2,400" vs "credit was 2448, balance 668"); anchored on his two most-specific facts (credits $1,755 + $693.26, balance $668) and consolidated the difference into one labeled spend entry, flagged in the summary for a one-edit fix.

### Future work
- If the founder wants the monthly card limit auto-suggested, the Payouts confirmations (amount_paid) + Finance split could prefill the "Load card" form next cycle.
- Profit split percentages remain hardcoded in finance.tsx SPLIT (70/15/15).

## Addendum · truth-first money surfaces (same day)

Founder: "the overview still says to pay out... Aalian owed 413, which is incorrect... even the profit split is incorrect. I just gave you all the data." Root cause: Finance Overview ran `calcMonthPayouts`, a forked month-wide aggregate that ignored `payout_confirmations` entirely (and summed every `base_pay_monthly` regardless of eligibility, counting Emre's ineligible $2,000); the home strip's "To pay out" ignored confirmations the same way; the profit split led with PROJECTED profit (incl. expected future installments), which read as "my split".

Fixes (commit `415ba11`): Finance computes each semi-monthly period through the shared `buildPayoutRows` + `memberPayoutTotals`, then overlays confirmations — confirmed members count at stored `amount_paid` (including confirmed payments the computation shows nothing for, like Faizan's cumulative $1,755), unconfirmed at computed. `calcMonthPayouts` deleted. Profit split leads with banked profit after real payouts; projection demoted to a footnote. Home strip subtracts confirmed members and flips to "Paid out · every payout confirmed" when settled. Cards: per-month "carried in · loaded · spent · carries out" summary rows (carry-over computed, not remembered); header simplified to all-time loaded/spent. Abu Bilal's card seeded with a $1,000 opening credit marked as a founder estimate. `payout_confirmations`/`payout_adjustments` writes now also invalidate the Finance page cache.
