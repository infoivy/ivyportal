# Log: DM Setter Playbook added to the Knowledge Hub

### Prompt
Founder: "add this to the Ivy portal (the website that we have: portal.ivysales.com). Add it in the resources." "This" is the DM Setter Playbook built in the same session as a standalone page (v4) for two new DM setters restarting after the Instagram unban.

### Issue
The playbook lived only as a private claude.ai artifact. Setters work from the portal, so it needed to sit in Knowledge next to the other setting SOPs, in the portal's own design system (tokens, dark mode, DocShell), not as an embedded HTML page.

### What I did
- `src/components/dm-setter-playbook.tsx`: native React port of the v4 content. 24 sections in conversation order (Parts 1 to 5, plus the paused Outbound section at the bottom). Every script has a copy button. The toolkit and day-one checklists and the 12-question check (pass mark 11) save to localStorage only (`isa-dm-playbook-ticks`, `isa-dm-playbook-check`), loaded in an effect so SSR and hydration match.
- `src/routes/_authenticated.sops.dm-setter-playbook.tsx`: DocShell page at `/sops/dm-setter-playbook`. Students are redirected to `/knowledge` with the same gate as `StyledSopPage`. No student allowlist change.
- `src/routes/_authenticated.knowledge.index.tsx`: "DM Setter Playbook" pinned first in the Setting section (setters and admins).
- Design-system pass (second commit): the portal type tokens only (`text-body`, `text-caption`, `text-micro`, `text-title`, `text-metric`), no arbitrary px sizes. `StatusPill` for the soft link, hard link, not-a-fit and paused labels. Highlights are neutral fills with a slim inset rail (quiz answers, the warning boxes, the paused banner), per the founder's feedback that loud colored borders and fills look unprofessional. Color stays only where it means something: WhatsApp bubbles, do/don't icons, right/wrong.
- `src/components/doc-shell.tsx`: nav is now `sticky top-[68px]` so it clears the 52px frosted top bar (it used to slide under it), capped at the viewport height with its own scroll, and it keeps the active item in view by scrolling the nav only, never the page.

### How I did it
Branch `feat/dm-setter-playbook` off `origin/main` (28fc67c). Checked the port against the v4 HTML with a script that looked for every bubble, lead, tip and quiz string in the TSX: nothing was missing apart from one deliberate wording change ("the table below" is now "the list below", since it's a list in the port). `npm run verify`: 86/86 tests, lint 0 errors (1 existing warning in `home-setter-week.tsx`), typecheck and build clean. Visual QA through a temporary unauthenticated preview route on `vite dev` at 1280px and 375px, in light and dark: no horizontal scroll, no console errors. The preview route was deleted and the route tree regenerated before committing. Commit 9956672, PR infoivy/ivyportal#11.

### What was challenging
- 24 sections overflow the DocShell nav on a laptop screen, which is why the nav fix went in.
- Inset left rails on rounded quiz options looked like brackets, so the quiz uses inset rings instead.
- The setting KPIs are pinned elsewhere. EOD targets for DM setters are 300 DMs and 6 sets a day (founder, 2026-07-28), while the playbook asks for 3 kept bookings a day and has outbound paused. I left the KPIs alone, since they need written approval.

### Future work
- Reconcile the playbook targets with the DM setter EOD targets once the founder decides.
- The older "Setting Process" SOP (the DM mastery board) still says to never qualify by country and uses the Green/Amber/Red flow, which contradicts the playbook. `tests/dm-qualification-sop.test.mjs` pins that text. Retire or rewrite it with the founder's OK.
- Fill the placeholders once the links exist: [free video link], [pre-call video], [soft or hard link], [closer], and the keyword list.
- If the playbook changes often, move its content into data (or the knowledge tables) so it can be edited without a deploy.
