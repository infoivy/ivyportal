# Log: iOS home slimdown, client priority roster, liquid glass bar

### Prompt
Founder feedback round (2026-08-15): personal Home shows "Review your action items" and "Your items" which are the same thing — keep the top one, banner-slim, pulsating icon. Overview must drop "Good evening", the date line, and "Today's picture". Clients roster must be a priority hierarchy for CSMs (1:1 first, at-risk first, offer-won lower, scholarship last). Copy Mochi's navbar icons for leads/settings and give our bar the iOS liquid-glass look Mochi has.

### Issue
Duplicate action-item affordances on personal Home; header text bloat; roster sorted alphabetically instead of by CSM priority; tab bar used old `ultraThinMaterial` blur (no Liquid Glass edge) and person.2/gearshape glyphs instead of Mochi's.

### What I did
- Personal Home (live + DEBUG): one slim 72pt "Review your action items" pill with the translucent orange circle icon pulsating (`symbolEffect(.pulse)`); removed the duplicate "Your items" banner on Personal only (leaders keep it).
- Home header: removed greeting + date (ScreenHeader now skips an empty title); Overview picture header is kicker-only, "Today's picture" gone (live + DEBUG).
- New `IvyPortalCore/ClientPriority.swift`: rank buckets 1:1 red → 1:1 amber → 1:1 green → group red/amber/green → offer-won (1:1 then group) → scholarship last (keeps internal order); tiebreak worst health score then name. Applied to the live Students roster and the fixture roster in CustomersView.
- `StudentRosterItem` now selects/decodes `payment_state` (scholarship detection).
- Tab bar: Clients `person.3`/`person.3.fill`, Settings `gear`; bar background is `glassEffect(.regular, in: Capsule())` on iOS 26+ with the old material as pre-26 fallback.

### How I did it
Files: `IvyPortal/Features/Home/HomeView.swift`, `IvyPortal/Features/Clients/CustomersView.swift`, `IvyPortal/App/PortalShell.swift`, `IvyPortal/Core/DesignSystem/Components.swift`, `IvyPortal/Data/PortalAPI.swift`, new `IvyPortalCore/ClientPriority.swift` + `IvyPortalTests/ClientPriorityTests.swift`. Regenerated with `xcodegen`, built with Xcode 26.5 SDK, ran unit tests (62 pass) and UI tests on the booted iPhone 17 Pro simulator; verified personal/overview/clients by screenshot.

### What was challenging
Deciding where 1:1 offer-won sits: founder said it's "something else" — placed below all active students (they need no CSM work; a struggling group payer does) but above scholarship. Scholarship pins to the bottom regardless of pathway, per "bottom of the barrel".

### Future work
- DEBUG sales fixture still titles itself "Today's picture" (live says "This week") — align if he flags it.
- Locked (Start Here) students rank as amber with score 0, so they lead the amber bucket; watch whether he wants them treated differently.
