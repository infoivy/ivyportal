# Log: Mobile native-app pass · pill tab bar, swipe kanban, thumb targets

### Prompt
Founder (2026-07-31 evening): optimize the entire portal for phone (iPhone + Samsung) and iPad — "look and feel like a native app", two CSMs work fully from phones; free rein to move things and replace buttons. Followed by a reference screenshot of a floating pill bottom tab bar with "would be beautiful but it might be ios only?"

### Issue
The staff bottom nav was an edge-to-edge bar; the students kanban squeezed 6 lanes into 2 cramped columns at 390px; chat's `100vh` fixed height fought mobile browser chrome and the nav; the CSM accountability stat strip wrapped values at 2-up; the today-queue's primary Check-in/Item buttons were 28px tall.

### What I did
- **Floating pill tab bar** (`staff-bottom-nav.tsx`): detached rounded capsule (`w-[min(100%-1.5rem,26rem)]`, frosted, shadow, safe-area-inset bottom offset), active tab gets a filled pill. Pure CSS — identical on Android/Samsung, NOT iOS-only. Global clearance `pb-20 → pb-24` in `_authenticated.tsx` (test pin updated deliberately).
- **Swipe kanban**: all three Students boards (phase, coach, graduation) become horizontal snap lanes on phones (`flex overflow-x-auto snap-x snap-mandatory`, lanes `w-[80%] snap-start`, edge-bleed `-mx-4 px-4`) and return to grids from `sm:` up.
- **Chat**: `calc(100dvh-148px)` below md (pill + header clearance), `calc(100dvh-52px)` above — composer always reachable, no URL-bar jump.
- **CSM strip**: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`. **Today-queue buttons**: `h-9` on phones, `sm:h-7` desktop density.
- Audit findings that needed NO fix: CSM/student-success/action-items/calls/testimonials are card layouts (no tables); every modal is `w-full max-w-*` with scroll; base `grid-cols-3` instances are segmented controls or 7-day calendars (intentional); money tables scroll in wrappers by design.

### How I did it
Manual anti-pattern audit (the Explore agent returned garbage with zero tool calls — did the sweep by grep instead): unresponsive base grids, missing overflow wrappers, fixed heights vs bottom nav, sub-40px tap targets in primary flows, dialog widths. Commit `6e2b7ab`; 78/78 tests (one pin updated), CI green, deploy asset-verified.

### What was challenging
Tailwind base-vs-`sm:p-6` padding override ordering makes per-page bottom padding fragile — the single `main`-level clearance in `_authenticated.tsx` is the right chokepoint, so pages never manage nav clearance themselves.

### Future work
- The reference screenshot also shows an avatar bubble beside the pill; add if the founder asks.
- Real-device screenshot pass (Playwright demo cast) once demo accounts are next seeded.
