# Log: Requests queue visible to closers/CSMs (pending_signups fix)

### Prompt
"student requests dont come in in the portal" → investigate; then "ship" the proposed fix.

### Issue
New portal signups (access requests) were piling up unseen. The Students → Requests page and its badge computed pending = active profiles minus everyone with a `user_roles` row, both read client-side. RLS only lets admin/founder/cofounder read other users' `user_roles` rows, so non-admin closers/CSMs — the roles the feature was built for — saw ~24 bogus "pending" entries (every account except themselves) and real requests drowned. Evidence: five July 14 signups sat ~1.5 days before being bulk-approved manually on July 15 at 13:47 UTC; two more (Zaheer Tahir, Yusuf A) were waiting at diagnosis time.

### What I did
- New migration `20260715210000_pending_signups_fn.sql`: security-definer `public.pending_signups()` returning role-less active profiles (id, display_name, created_at), gated inside to admin/closer/csm/founder/cofounder via `has_role`, EXECUTE revoked from anon.
- `_authenticated.students.requests.tsx` and `students-tab-bar.tsx` now call `supabase.rpc("pending_signups")` instead of reading `profiles` + `user_roles` raw.
- Badge query enabled for founder/cofounder too (tab was already visible to them).
- Added the function to `src/integrations/supabase/types.ts` (matched generator output exactly).

### How I did it
Diagnosed by emulating real user JWTs against production with `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = ...`: founder saw 25 profiles/30 role rows (correct, 2 pending), CSM saw 25 profiles/1 role row (24 bogus pending). Confirmed the deployed bundle contained the Requests route (feature was live, not undeployed). Applied migration via Supabase MCP `apply_migration` (same version as the local file so `db push` stays in sync). Verified function per-persona: CSM → 2 rows, role-less user → 0 rows. `npx tsc --noEmit`, `npm run build`, `npm run supabase:verify` all green. Committed `ead1e6e`, pushed to main (Vercel auto-deploys).

### What was challenging
The symptom ("nothing comes in") didn't match either failure mode directly — founder view worked, CSM view showed too *many*. The tell was the manual bulk-approval backlog in the data. Deliberately chose a narrow security-definer function over widening `user_roles` SELECT to avoid exposing the full role map to closers/CSMs (role-gate change, founder-approved via "ship").

### Future work
- No notification for new signups beyond the badge inside the Students tab bar — consider a bell alert for approver roles.
- Regenerate `types.ts` wholesale next time the schema changes (this edit was surgical).
- Two pending requests (Zaheer Tahir, Yusuf A) still need human approval in Students → Requests.
