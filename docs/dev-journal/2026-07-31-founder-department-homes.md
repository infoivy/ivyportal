# Log: Per-founder department homes + my-card tile

### Prompt
Founder (2026-07-31): a different home per founder. Faizan (runs fulfillment) opens on detailed CSM/student-success data: check-ins, phases, active students, "is everyone being looked after". Abu Bilal (runs sales) opens on the day's few most important sales facts in a LARGE easy-read layout (he gets confused by clutter; keep the clean current theming, 6-7 elements fine). Both plus the founder get their card balance with quick log-spend/load-card and a log-a-close shortcut on home, so no trip to Cards.

### Issue
The founder home was one-size-fits-all: the generic Operating picture (4 tiles) regardless of which department a founder runs. Card actions lived only on /cards.

### What I did
- `profiles.home_focus` ('sales' | 'fulfillment' | NULL) column; Faizan = fulfillment, Abu Bilal = sales, founder NULL (default home unchanged).
- Dashboard branches at the LeadershipBrief slot on `ownProfile.home_focus`; banner, money strip, command queue, EODs aside stay for all leaders. Zero new supabase reads in dashboard.tsx (contract ban respected; only the profiles select gained the column).
- `home-fulfillment-picture.tsx`: 6 tiles (active students, at-risk from useStudentHealth bands, checked-in-today with due-2+days sub, student EODs today with quiet-14d sub, action items open/overdue, 1:1 calls next 7d), a phase strip (Onboarding/Training/Applying/Offer won/Paused counts), and a per-CSM activity table (check-ins today/week, looms, roleplays this week from student_checkins + csm_tally).
- `home-sales-picture.tsx`: six LARGE tiles: sets this week (live, cancelled excluded), show rate (tracker-sheet rule), volume yesterday vs kpiTargetsFor-summed targets with "N short", closes this period (+cash), Close pipeline via listCloseLeads (fail-soft "not connected"), unclaimed sets; below, a one-line "short on volume yesterday: names" coaching strip linking Performance.
- `home-card-tile.tsx`: balance + loaded/spent, inline Log spend / Load card (wallet_entries insert), Log a close → /revenue, Open cards → /cards. Rendered for founder/cofounder role.
- TABLE_KEYS: wallet_entries/student_checkins/csm_tally now also invalidate the home prefix.

### How I did it
Migration `20260731094702_profiles_home_focus` (MCP apply → local file). New components follow the Operating-picture tile grid (`grid min-h-16 grid-cols-[28px_1fr_auto_18px]`, sales variant min-h-20 + text-2xl values). Gates: tsc, eslint, 78/78, build (routeTree unchanged — no new routes), supabase:verify 55. Commit `d723349`; CI Verify green; deploy asset-verified.

### What was challenging
student_checkins keys are `csm_id`/`checked_at` (not user_id/created_at); csm_tally needs the generic + student-scoped double read (demo filter only joins on student rows). Sales volume math re-uses kpiTargetsFor per setter type per report date so yesterday's judgment matches Performance exactly.

### Future work
- home_focus is admin-invisible; if more founders/depts appear, expose it on Team administration.
- The sales picture could take Mochi DM funnel numbers once the founder wants IG volume next to dials.
