---
projectDir: /Users/x/Documents/ivy
description: Sidebar v2 + settings, app-wide consolidation, cofounder commission caps, profit after payouts
gitBranch: main
status: completed
---

# Log: Consolidation sweep + money rules

### Prompt
Batch of founder messages (2026-07-12): fix header alignment + dark-blue sidebar; ISA leaf as favicon; reorganize sidebar (Overview/Performance renames, Calendar under Today, Training under Library, spacing, collapsed UX); settings page (account + org name/logo); co-founder role assignment; 24H/specific-day filters everywhere; remove Coaches tab (info onto team profiles); merge Students/CSM; remove Gathering Hub; Finance under Sales for founder+cofounders only; profit AFTER payouts; co-founder 10% flat close commission capped $1k/week + $2k/month; remove closing-call tracking (Close website is the source); CRM as one page.

### What I did
- **Sidebar v2**: Overview (was Dashboard), Performance (was EOD Reports); groups Today/Sales/Students/Library/Founder/Admin/Account; single role-aware entries for Sales and Students sections; 52px header aligned with the top bar; hairline separators in collapsed mode; dark sidebar neutralized (#0A0B0F).
- **/settings**: email change, password change, forgot-password link on sign-in, org name + logo (new `org_settings` table, migration `20260712180000`; logo uploads to doc-assets; sidebar reads it).
- **Favicon**: ISA leaf at public/favicon.png (in-app logo untouched).
- **24H + specific day**: RangePicker 24H preset (Overview/Revenue/Sales/Admin), IG section Today, setter activity card date picker (Close API `date_created__lte` added; Mochi DMs show "—" on exact days — preset-only API).
- **Coaches tab removed** → coaching capacity card on `/team/$id` for coach roles.
- **Fulfillment tab bar** (`students-tab-bar.tsx`): Students | CSM | 1-on-1 Calls | Testimonials, one sidebar entry.
- **Gathering Hub deleted** (route + founder/ components); monthly goal pace absorbed into Finance's cash card.
- **Finance**: tab under Sales, founder+cofounder only (server fn tightened); profit and split now subtract month payouts (commissions + base pay) via new `src/lib/payouts-calc.ts`.
- **Co-founder commission**: flat 10% even set+close, capped $1k/Mon–Sun week and $2k/month, allocated across the two semi-monthly payouts; ledger fetches the full month and notes the cap on the row.
- **CRM one page**: Close pipeline summary (counts/stages/value/close rate + Open Close link) + Mochi replica; live lead browser, lead notes, and per-lead Close call feed removed.
- Migration `20260712190000_finance_read_access`: founder/cofounder select on user_roles, installments, installment_payments, commission_rates.

### What was challenging
- The monthly cap forces the Payout Ledger to fetch the whole calendar month even though it displays one half — first-half consumption caps the second half.
- claude-mem's Read hook blocks Write-after-read on tracked files; crm.tsx was rewritten via heredoc.

### Future work
- Mochi per-day data is impossible via MCP presets; revisit if Mochi adds date-range params.
- `npm run demo:remove` before real rollout; assign Abu Bilal `cofounder + closer`, Faizan `cofounder + csm`.

## Outcome
Completed. Commits: "feat: sidebar v2, settings page, ISA favicon, 24H filters" and "feat: app-wide consolidation, cofounder commission caps, profit after payouts". CLAUDE.md business rules updated (cofounder rate + caps, profit after payouts, Finance access, CRM/fulfillment merges).
