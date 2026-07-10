# Log: Full front-end redesign — Apple-calm, minimal, role-first

### Prompt
Rebuild the entire front end's design from scratch: Apple-level calm, craft, clarity, light + dark mode, professional and minimal — color rare and meaningful (charts colorful, chrome neutral). Full authority to restructure navigation, merge/delete pages, rebuild components. Hard rules: every capability stays reachable for every role; data layer, RLS, and business rules untouched. Judge: each person opens their screen and immediately knows what matters today.

### Issue
The app worked but looked assembled: 45 routes, hardcoded palette colors in 41 files, 8-color sidebar icon squares, gradients, a 9-color training tab palette, three overlapping founder dashboards, Sales vs Sales-HQ duplication, financial pages scattered, docs split across three sections, ad-hoc type sizes/radii/borders — and `bg-popover`/`bg-accent` utilities that silently generated no CSS because they were never mapped in the Tailwind theme.

### What I did
1. **Tokens** (`src/styles.css`): formal type scale (display/metric/title/body/caption/micro) as the only sizes; semantic status tokens (success/warning/danger, fg+bg) as the only non-neutral chrome colors; theme-tuned `--chart-1..6` palette; mapped the previously-unmapped shadcn color utilities; stronger ease-out curve; `.pressable` press feedback.
2. **IA**: `/command` = Founder HQ Overview + Weekly Review tabs; new `/content` = content planner + IG analytics (marketing founder's home); `/sales-hq` and `/analytics` folded into `/sales`; Calls ↔ Coaches URL-tab bar; CRM Hygiene policy pinned into the Knowledge hub. Six old routes are redirect stubs preserving bookmarks + tab. Closer sign-in lands on `/sales`.
3. **Shell**: monochrome sidebar (Today/Sales/Students/Library/Founder/Admin groups, colored icon squares removed); topbar page-context label; EOD-due chip on warning tokens; avatar opens an account menu (was: instant sign-out on click); command palette rebuilt for the new IA.
4. **Components**: new `StatusPill` (single source of status color); button press feedback; input/table/badge/skeleton off invisible white-opacity borders; stat-card/page-header/empty-state on the type scale; `PageShell` container.
5. **Pages**: all ~40 route files + feature components decolorized to semantic tokens via `scripts/decolorize.py` (ordered regex rules: greens→success, ambers→warning, reds→danger, decorative accents→neutral); every gradient removed (training thumbnails and calendar events keep identity color as flat tints); all inline Recharts hexes on chart tokens.
6. **Bug fixes found en route**: role-based landing after sign-in never fired (layout mounts after the SIGNED_IN event) — fixed with a one-shot sessionStorage flag; dead hover states and colored focus rings from earlier passes.

### How I did it
Phased commits, each gated on `npx tsc --noEmit` + `npm run build`: tokens → IA/shell → shared components → reps daily → sales ops → student success → founder → edges → verification. Founder inner components moved to `src/components/founder|content/` before stubbing their routes (command.tsx imported them cross-route). Demo data seeded via `npm run demo:seed` (baseline: $90,000 revenue / $72,500 cash / 12 deals / 163 EODs / 8 students). Verified visually with headless Chrome + Playwright (channel: chrome, no browser download) signing in as each demo persona in both themes and at 375px.

### What was challenging
- Keeping every capability reachable while deleting six routes: redirect stubs with explicit `search` params (TanStack requires them when the target has `validateSearch`).
- The decolorizer had to be ordered (opacity-suffixed classes before bare ones) and produced two artifact classes (`hover:bg-muted` on `bg-muted`, orphaned colored rings) that needed a follow-up pass.
- `/analytics` was reachable by coach/csm but folds into `/sales` (admin/closer/setter): equivalent charts exist in `/eods` Graphs for those roles; noted as an accepted trade-off.
- Chrome-only verification of the auth race: the layout's `onAuthStateChange` never sees SIGNED_IN because sign-in happens on `/auth` before it mounts — likely broken for a while, invisible without end-to-end login testing.

### Future work
- Deeper layout rethink of `/students` table density and `/csm` composer once real usage feedback lands.
- Consider promoting the Revenue/Installments/Payouts URL-tab bar into a shared component with the Calls/Coaches one.
- `npm run demo:remove` before real use; screenshots in /tmp/ivy-*.png.
- Inkdrop was unreachable (fetch failed) — this file is the fallback log.

## Outcome

Completed and pushed (b640e78..6d306c5, 9 commits). Notes:

- All four demo personas verified end-to-end in headless Chrome: correct role
  landing, both themes, 375px mobile. All old-URL redirects land on the right
  page and tab.
- Demo data left seeded so populated screens can be judged; run
  `npm run demo:remove` before real use.
- Deviations from plan: Revenue/Installments/Payouts kept as URL-tabs (the
  pattern already existed) instead of physical page merges; /analytics folds
  into /sales (coach/csm keep equivalent charts in EODs Graphs).
- Found and fixed two latent bugs: unmapped shadcn color utilities (popovers
  were transparent by accident) and the sign-in role landing that never fired.

## Feedback round 2 (same day)

Implemented the founder's follow-up list: team-assignable action items (migration:
nullable student_id) with Students/Team sections; one chart language (EODs funnel on
VolumeAreaChart, tooltip rows in series colors, funnel gains Booked→Closed + conversion
percentages); editable quarterly goals in Admin (founder_settings.quarterly_goals),
goals panel admin/founder-only; CSM nav slimmed (no Dashboard/Sales/Revenue/Training),
cash leaderboard + next-due gated; Sales page single view (Pipeline removed, Trends
inline); Command → Gathering Hub; DocShell (CRM-Hygiene style) for knowledge docs +
closer resources; Start Here checklists per business role incl. admins; role changes
refresh the session live (verified end-to-end); admin Go-Live checklist rows navigate;
"Log a set" creates Google Calendar events with 3d/1d/3h reminders (scope now
calendar.events — existing connections prompt to reconnect); seeded "After You Make a
Set" SOP doc.

Bugs found and fixed: SOP canvas rendered blank (route wrapper's enter animation
retained a transform → zero-height containing block; content was never lost — word-for-
word intact in src/data/sections.tsx); the "role doesn't stick" report was two UI gaps,
not a data bug; @tailwindcss/typography was referenced but never installed, so all
markdown docs rendered unstyled since day one; revenue's per-tier "Team bonus $" figures
were not a real commission rule — removed (Payouts owns the per-person ledger).
