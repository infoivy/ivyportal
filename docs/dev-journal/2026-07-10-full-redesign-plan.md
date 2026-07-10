# Ivy Portal — Full Front-End Redesign

## Context

The portal works but looks assembled, not designed — previous passes only polished the same template. The brief: rebuild the entire front-end design as a world-class product designer would. Apple-level calm, craft, and clarity; light and dark mode; **professional and minimal — color is rare and means something** (charts may be colorful, chrome may not). Full authority to restructure navigation, merge/delete pages, rebuild components. Two hard rules: every existing capability stays reachable for every role, and the data layer (Supabase schema, RLS, `src/lib` business logic, CLAUDE.md business rules) is untouched. Judge: each person — setter, coach, non-technical co-founder — opens their screen and immediately knows what matters today.

Current state (verified): 45 routes (~19k lines), 7 roles, Tailwind 4 tokens in `src/styles.css` with working light/dark class toggle, Geist font, 65 shadcn/Radix components, Recharts, TanStack Query + direct supabase + `createServerFn`. Problems: hardcoded palette colors in 41 files, 8-color sidebar icon squares, gradients, 9-color training tabs, ad-hoc radii/borders/type sizes, three overlapping founder dashboards, Sales vs Sales-HQ duplication, financial pages scattered across 3 routes, docs split across Knowledge/Policies/SOPs.

## Step 0 — Setup (first execution actions)

1. `npx skills@latest add emilkowalski/skills` — then lean on `emil-design-eng` for design decisions and `review-animations` for any motion.
2. Create Inkdrop plan note in `Claude Plans` notebook (status `active`), per global note-taking rule.
3. `npm run demo:seed` — populate screens; record baseline numbers (cash MTD, deal count, KPI hit counts) that must be identical after every phase.

## Design language (Phase 1 — tokens in `src/styles.css`)

- **Typography**: keep Geist. Formal scale as `@theme` tokens — display 32/semibold/-0.02em (page titles), metric 28/tabular (stat values), title 17/semibold, body 14 (the one UI size), caption 12/muted, micro 11. Kill all ad-hoc `text-[13px]`-style sizes. Tabular nums on tables/metrics.
- **Neutrals**: keep both canvases (light `#F5F5F7`/white cards; dark `#08090D`/`#0E0F14` cards). Light = soft shadows, dark = hairlines + inset highlight — enforce via `.card-surface` as the only card treatment.
- **One accent**: emerald `--primary`, permitted only for: primary button, active nav indicator, focus ring, links, selection. Never decorative.
- **Semantic status tokens** (the core of de-colorizing): `--success/--warning/--danger` each with fg/bg variants. These are the ONLY non-neutral chrome colors, reserved for meaning: KPI hit/miss, paid/due-soon/overdue, at-risk, deal won. All 41 files with `text-green-400`/`text-blue-500`/etc. migrate to these or to neutral. Blue/violet/rose/sky/teal leave the chrome entirely.
- **Charts stay colorful**: `--chart-1…6` tokens (theme-tuned), consumed by `chart.tsx`, `volume-area-chart.tsx`, `sparkline.tsx`, `breakdown-bar.tsx`, and inline Recharts strokes/fills.
- **Delete**: 8-color sidebar icon palette, all gradients (auth, training, student portal), 9-color `--tab-*` training palette, `rounded-[7px]`-style ad-hoc radii, `border-white/[0.07]`-style ad-hoc borders.
- **Motion**: keep existing 150/200/400ms + ease-out tokens, CSS-only (no framer-motion), `motion-safe` respected; run `review-animations` on anything added.

## Information architecture (Phase 2)

### Merges — old routes become 6-line redirect stubs (`throw redirect({ to, search })`), bookmarks keep working

| New route | Absorbs | Notes |
|---|---|---|
| `/sales` — tabs: Today, Pipeline, Scorecards, **Team** | `/sales-hq`, `/analytics` trends | sales-hq KPI grid moves to `src/components/sales/`; Abu Bilal's team view |
| `/revenue` — tabs: Overview, Deals, **Installments**, **Payouts** | `/installments`, `/payouts` | bodies extracted to `src/components/revenue/*`; closer/admin gates preserved per tab |
| `/command` — tabs: Overview, **Weekly Review** | `/founder-hq`, `/weekly-review` | founder-hq inner already imported by command.tsx — move to `src/components/founder/` FIRST, then stub routes |
| `/content` (new) — tabs: Plan, Recording, Hooks, **Instagram** | `/founder`, `/instagram` | the marketing founder's home; TOF Mon–Thu / MOF Fri–Sun cadence displayed, Thursday recording day highlighted |
| `/knowledge` hub | `/policies` index, `/sops` index | three collections (Articles, Policies, SOPs); authored detail pages keep URLs |
| `/calls` — adds **Coaches** tab | `/coaches` | one fewer top-level item |

⚠️ Cross-route imports: `_authenticated.command.tsx:4-5` imports `FounderHQInner` and `FounderPageContent` from the founder-hq/founder route files. Move those inner components into `src/components/founder|content/` before stubbing, or the build breaks.

### Role homes
No new per-role dashboard routes. Keep existing sign-in redirects (student→portal, setter→eods, closer→sales, csm→csm, coach→calls, admin/founder→dashboard) — only change: closer `/sales-hq` → `/sales` in `_authenticated.tsx`. Each landing page's first viewport becomes a designed "Today" strip: setter = today's targets vs actuals; closer = today's calls + cash; coach/csm = today's 1:1s + at-risk students; admin/founder = business pulse (cash MTD, missing EODs, overdue installments, at-risk).

### New sidebar (monochrome icons; active = foreground text + subtle pill)
```
TODAY     Home · EODs · Action Items
SALES     Sales · Revenue · Training · Calendar (+Closer Resources, +CRM gated)
STUDENTS  Students · Calls · Student Success · CSM · Testimonials (role-filtered)
LIBRARY   Knowledge · Notes
FOUNDER   Command · Content            (founder/admin only)
ADMIN     Admin · Team                 (admin only)
ACCOUNT   Profile
Student:  My Portal · Profile (mobile bottom nav preserved)
```
Update `command-palette.tsx` in the same commit as every IA change.

## Execution phases (one commit per phase; `npx tsc --noEmit && npm run build` green at each boundary)

1. **Tokens** — rewrite `src/styles.css` (type scale, semantic status, chart palette, prune); update `chart.tsx` to new vars. No page breaks: old classes still resolve.
2. **IA + shell** — move cross-imported founder components; create merged routes + redirect stubs; rebuild `app-sidebar.tsx` (monochrome, new grouping), topbar in `_authenticated.tsx` (breadcrumb context, warning-token EOD chip, proper avatar dropdown replacing click-to-signout), new `src/components/ui/page-shell.tsx` (standard gutters/max-width); update command palette; closer redirect change.
3. **Shared components** — rebuild: `stat-card`, `page-header`, `empty-state`, `skeletons`, `table`, `tabs`/`segmented-control` (one neutral style), new `status-pill.tsx` (the single component for KPI hit/miss, payment status, deal stage — kills most ad-hoc color), chart family. Retouch (token sweep only): button, badge, card, dialog, sheet, input, select, form, toasts, tooltip, filter-toolbar.
4. **Reps daily** — `/eods` (rebuild layout, **form logic untouched**: Today status first, targets as StatusPills, then history), `/sales` merged page, `/action-items`, `/notes`, `/calendar`, `/training` + `/closer-resources` (kill colored tabs/gradients → calm reading surfaces).
5. **Sales ops (Abu Bilal — must be obvious)** — `/dashboard` rebuild as admin/founder pulse (cash MTD, EODs missing, overdue installments, at-risk — each drills down), `/revenue` merged (Overview: this week's cash + who's owed what; `src/lib/revenue.ts` untouched), `/team`, `/admin` retouch.
6. **Student success (Faizan)** — `/student-success` rebuild (at-risk first, wins, testimonial queue), `/students` + `/students/$id` (calm table + StatusPills; detail as clean timeline), `/calls` (+Coaches tab), `/csm`, `/testimonials`.
7. **Founder/content** — `/command` merged, `/content` new merged page.
8. **Students + edges** — `/student-portal` (strip gradients, keep tab bus + bottom-nav bridge keys identical), `/knowledge` hub + collections, `/profile`, `/auth` (single calm card), `/crm` (chrome only, drag-drop untouched), `/print` untouched.
9. **Final sweep + ship** — grep audits at zero; full persona walkthrough; push.

## Verification (per phase and final)

- `npx tsc --noEmit` + `npm run build` green at every phase boundary.
- Both themes via toggle (localStorage `isa-theme`), at 375px / 768px / 1280px.
- Demo-data walkthrough per persona login; seeded numbers (cash MTD, deals, KPI hits) must match the pre-redesign baseline exactly — proves visual-only changes.
- Grep exit criteria per swept area: zero matches for `text-(green|blue|amber|red|violet|rose|sky|teal)-[0-9]`, `gradient`, `rounded-\[`, `border-white/\[` (outside token definitions).
- Redirect stubs: hit each old URL, confirm landing + correct tab.
- End: update Inkdrop note to `completed` with outcome; dev-journal entry; `git push` when the whole thing holds together.

## Risks & isolation rules

| Risk | Rule |
|---|---|
| EOD form KPIs/validation (`eods.tsx`, 1219 lines) | JSX/className changes only; handlers, state, queries byte-identical |
| Commission math (`src/lib/revenue.ts`) | Never edited; revenue page render code cut-pasted into `src/components/revenue/*` with imports unchanged |
| CRM kanban drag-drop | Restyle cards/columns; DnD handlers untouched |
| Cross-route imports (command ← founder-hq/founder) | Move inner components before stubbing routes |
| Student portal tab bus / bottom-nav bridge | Tab keys identical |
| Role landing redirects | Only closer `/sales-hq`→`/sales` changes |
| Historical EOD/revenue records | Zero new write paths added |
| RLS/role gates | UI gates preserved per tab after merges (e.g. installments/payouts tabs stay closer/admin) |
