### Prompt
Continue the Apple-style redesign (Commits 9–13) — full visual restyle + perf pass across Ivy Portal.

### Issue
Portal needed a comprehensive Apple-style redesign: light/dark themes, kill all uppercase tracking labels and rainbow stat colors, SF Pro font stack, frosted top bar, Apple Settings sidebar, iOS SegmentedControl for tabs, one accent color (ISA emerald), and a perf pass. Previous context ran out mid-task at Commit 12 investigation.

### What I did
**Commit 12 (perf/bundle):**
- Added `preload="intent"` to the single sidebar `<Link>` in `app-sidebar.tsx` — TanStack Router now prefetches route data/JS on hover, making nav feel instant

**Commit 13 (perf/rendering):**
- Narrowed `select("*")` → explicit column list in `dashboard.tsx` (both current + compare eods queries) — matches the `EodRow` type (9 columns instead of ~20+)
- Same narrowing in `analytics.tsx` (both current + compare eods queries) — matches the `Row` type
- These are the two highest-frequency eods queries; they fire on every date-range/filter change

**Pushed all 6 commits** (d854856 → 1370ef7) to origin/main.

### How I did it
- `preload="intent"`: single attribute on `<Link to={item.url}>` at app-sidebar.tsx:132
- Select narrowing: replaced `select("*")` with `select("id, user_id, report_date, dms_sent, convos_started, calls_booked, calls_scheduled, shows, no_shows")` matching the TypeScript types already defined in each file
- Verified Sparkline/recharts is NOT in the dashboard bundle (Vite already tree-shakes it into per-route chunks)
- Skipped `@tanstack/react-virtual` (not installed, EOD list max ~200 rows grouped, not worth the dep)
- Skipped `React.memo` on FeedCard (would need `useCallback` on `deleteEod` which has complex deps including other uncached functions — risk > reward for this tool)

### What was challenging
- Verifying that recharts was already code-split correctly before deciding not to lazy-load it
- `React.memo` without `useCallback` on the parent's `deleteEod` would be a no-op, and adding `useCallback` required auditing all its deps (`existingId`, `canViewTeam`, `loadMine`, `loadTeam`)

### Future work
- `React.memo` + `useCallback` on EOD list components if profiling shows render time is a real bottleneck
- `@tanstack/react-virtual` for EOD feed if the list grows beyond ~300 rows
- `npm run supabase:verify` to confirm zero schema changes across the full redesign run
- Consider narrowing more `select("*")` calls (revenue.tsx deals query, installments queries)
