# Log: Apply emilkowalski/skills improve-animations audit to the portal

### Prompt
Go through all the skills at github.com/emilkowalski/skills, especially the new /improve-animations, and apply to the portal.

### Issue
The portal's motion layer was partly aligned with Emil Kowalski's animation philosophy (strong easing tokens, `.pressable` press feedback, gated page transitions already existed), but the shadcn/ui primitives shipped with defaults that violate the audit rules: `ease-in-out` + 500ms on the mobile nav sheet, `ease-linear` on the sidebar collapse, `transition-all` in nine places, weak default `ease` on all overlay entrances, and no `prefers-reduced-motion` handling for the tw-animate-css enter/exit animations.

### What I did
- Read all five skills (improve-animations, review-animations, emil-design-eng, apple-design, animation-vocabulary) and ran the improve-animations workflow: recon → audit against the eight categories → vet → apply.
- Added `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` (iOS drawer curve) to the motion tokens.
- Sheet (mobile nav, highest frequency): `ease-in-out`/500ms open/300ms close → drawer curve, 300ms open, 200ms close.
- Sidebar collapse: `ease-linear` → strong `--ease-out` in four spots, plus `motion-safe:` gating.
- Killed `transition-all` everywhere (tabs trigger, progress indicator, sidebar rail, five inline progress bars, dashboard KPI card hover) → specific properties (`width`, `filter`, `transform`, `color,background-color,box-shadow`).
- Wired live overlay primitives (popover, dropdown-menu, select, tooltip, dialog) to `ease-(--ease-out)` instead of the weak default `ease`; dialog exit now 150ms (faster than the 200ms enter).
- Added a global reduced-motion rule that neutralizes tw-animate translate/scale vars while keeping opacity fades (gentler, not zero).
- Training page play button: hover `scale-110` → `scale-105` with `transition-transform`.

### How I did it
Files changed: `src/styles.css`, `src/components/ui/{sheet,tabs,progress,sidebar,popover,dropdown-menu,select,tooltip,dialog}.tsx`, `src/components/{onboarding-panel,recording-day}.tsx`, `src/routes/_authenticated.{students.$id,dashboard,training}.tsx`.
Verified `--tw-enter-*`/`--tw-ease` variable names against `node_modules/tw-animate-css/dist/tw-animate.css` before writing the reduced-motion override (uses `[class*="animate-in"]` attribute selectors because variant-prefixed utility classes like `data-[state=open]:animate-in` don't match a bare `.animate-in` selector). Ran `npx tsc --noEmit` (clean) and `npm run build` (clean), then grepped the built CSS to confirm every new utility was generated and that the project's strong `--ease-out` declaration wins over Tailwind's built-in default of the same name (later declaration, same `:root`).

### What was challenging
- Tailwind silently drops unknown classes, so mechanical verification had to include grepping the built CSS, not just a passing build.
- The project's `--ease-out` token shadows Tailwind v4's default theme variable of the same name — this turned out to be a feature (existing `ease-out` classes upgrade for free) but had to be confirmed by declaration order in the output.
- Skipped by-design motion: confetti `ease-in` (correct physics for falling), route-progress shuttle `ease-in-out` (indeterminate loader), modal `transform-origin: center` (exempt per the audit), `animate-pulse` on live calendar items (state indication).
- Unused primitives (accordion, menubar, navigation-menu, context-menu, input-otp, hover-card) were left untouched to keep the diff meaningful.

### Future work
- Feel-check on a real phone: open the mobile nav sheet repeatedly and confirm the drawer curve reads right; DevTools Animations panel at 10% speed for dialog enter/exit asymmetry.
- Missed opportunities identified but not implemented (additive, need approval): number-ticker on dashboard KPI values, 30–80ms stagger on dashboard card grid entrance, blur-masked crossfade on segmented-control content swaps.
- Sheet still uses keyframes (not interruptible mid-flight); fine for occasional use, but a Vaul-style spring drawer would be the next tier for the mobile nav.
