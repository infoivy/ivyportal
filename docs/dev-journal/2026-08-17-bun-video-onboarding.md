# Log: Bun onboarding copied from reference video

### Prompt
"what I have is a video of an onboarding process that I want you to copy... I also want you to copy the animations... Go through every frame, look at the logo animation and the logo size... as soon as somebody opens the app, this is what they see." Bun is paid, not free; do not show the result, just build it.

### Issue
Replace the free self-serve signup entry with the reference recording's onboarding (RPReplay_Final1786938234.MOV, 39s @60fps, Mercury iOS): splash with logo and caption, background warming into a mauve haze while the logo floats up, welcome cards, pitch carousel, application-style name and account screens, all-set screen.

### What I did
- Analyzed all 39s frame by frame (2fps contact sheets + 12fps intro burst + full-res keys; exact colors sampled per screen: splash #14131d, haze top #877d9c, mid #4f4854, low #1f1d1e, forms #111018).
- New `IvyPortal/Bun/BunWelcome.swift`: `BunWelcomeFlow` with the full choreography. Timings copied from the recording: caption fade-in 0.4s after 0.15s, hold 1.5s, gradient crossfade + logo rise (0.44 → 0.21 of screen height) 1.4s easeInOut, welcome stack fade 0.5s with 12pt rise. Screens: welcome (Learn more about Bun, Business/Team cards, Log in pill), pitch pages 1 and 2 (back chip + Log in chip, headline, live-rendered hero mock of the Bun home, feature cards, ring-padlock illustration, paid-subscription footnote, dots capsule, Get started), "What's your name?" (bare fields, application copy, Start application), "Create your account" (bare fields, eye toggle, green "Minimum 10 characters" check, spinner in the Next pill, "That email is already taken." alert), "You're all set up." with "Continue your application".
- Signup passes `full_name` metadata so `handle_new_user` names the profile.
- Root rewired: signed-out launches open the flow; signed-in launches get a 1.1s `BunLaunchSplash`; `-bunTab` pins the fixture shell for tests. Old steam `SplashView` deleted. `UILaunchScreen` now uses a `LaunchGround` (#14131d) color asset, killing the white launch flash.
- Tests rewritten for the new flow (`BunOnboardingDemo` part 1 walks welcome → pitch → name → account → post-signup, part 2 walks welcome → Log in → workspace). All green plus the 4 smoke tests.

### How I did it
ffmpeg frame extraction and 1px color sampling; simulator video recordings of the built flow compared against the reference sheets; two verification recordings (first caught a stale Release build, second confirmed the choreography); UI-test screenshots for interior screens (fixed emoji-presentation arrows to SF Symbols).

### What was challenging
- The recording compresses colors (welcome top read #514f5f on video but #7e7693 on a direct screenshot), so gradient tuning had to be done against screenshots, not recordings.
- The mauve haze needed a raised mid-stop (0.62) plus a wider top-left radial to match the reference's hazy midfield.
- The reference's hero is a photograph of a hand holding a phone; substituted a live-rendered miniature of the Bun home, which reads on-brand without a photo asset.

### Future work
- In-app signup still blocked by the missing custom SMTP (email confirmation cannot send); the flow handles it honestly and works end to end once SMTP is configured.
- The paid gate is framed in copy (application, subscription footnote); actual payment (Stripe/Whop) plugs in at "Continue your application" when a provider is chosen.
- Business vs Team welcome cards currently open the same pitch; differentiate copy per path later.

## Addendum: polish round (founder feedback, same day)

- Splash logo 52pt → 58pt; palette desaturated from purple toward Mercury's grey-taupe haze.
- The background is now a MOVING gradient: 3x3 `MeshGradient` under `TimelineView(.animation)` with slowly drifting control points (30fps, paused until the splash warms in).
- Liquid-glass rims: gradient hairline strokes (white 30% → 3%, top-leading light) on the welcome cards, Log in pill, pitch feature cards, and pitch top-bar chips.
- Login rebuilt to the founder's reference: SOLID brand header (medallion + "B U N" wordmark + "2FA codes" chip) that content scrolls under with a fade; back chip when pushed from onboarding; "Forgot password?" wired to `resetPasswordForEmail`; a true multicolor Google G (Canvas-drawn arcs to brand geometry); 2FA codes chip opens an honest info sheet (code entry activates with enrollment; no dead fields).
- App icon regenerated Mercury-style: mark scale 0.64 → 0.78, light = navy mark on lavender-white gradient tile, dark = lavender mark on charcoal gradient, tinted kept (`scratchpad/bunicon2.swift`).
- Diagnosed "Continue with Google opens Ivy Portal": the app passes `redirect_to=ivyportal://auth-callback` correctly, but that scheme is not in the Supabase Auth redirect allowlist, so GoTrue falls back to the Site URL (the web portal). Fix is dashboard-only: Authentication → URL Configuration → add `ivyportal://auth-callback` to Redirect URLs.

## Addendum 2: liquid glass + full fixture workspace

- Glass surfaces are now REAL Apple Liquid Glass on iOS 26 (`.glassEffect(.regular.tint(_).interactive(), in:)` via `bunGlassSurface` in BunComponents) with the static gradient-rim fallback below 26. Applied to welcome cards, Log in pill, pitch cards/chips, Google button, 2FA chip.
- Root cause of the founder's "everything is $0 and glitched": the sim was signed in as the EMPTY demo2 account, so live loads returned a bare workspace. Fixtures now live in the STORE: `BunFixtures` grew a full Acme Coaching dataset (ledger with Deal/Installment/Expense rows, 90-day cash walk, sets, team summary+rows, roster+health+paid maps, docs, wallet+entries, payments in/out, movement months/sources, tallies, check-in stamps) and `BunStore.seedFixturesIfNeeded()/resetToFixtures()` pour it in whenever signed out. Views unified onto store reads; BunHome sets/team/EOD sections and the Accounts CSM hub + client list now render signed out.
- Dead taps fixed: org chip opens a new `BunOrgSwitcherSheet` (live: real org memberships + New business; fixture: demo workspaces), Settings profile row pushes a read-only `BunProfileScreen`, Transactions "Accounts" chip cycles an account filter, Referral "Share my Link" is a real ShareLink and "Terms" shows terms, EOD flow plays through in fixture mode.
- Chart fixed: domain padding `low−0.35span…high+0.15span` and a believable up-trending cash walk; range menu (7/30/90D) now reslices fixture data signed out.
- Transaction detail no longer hardcodes card/date/account; uses the row's method/day/account.
- All 65 unit tests + 4 smoke tests green. Sim left running on the seeded demo workspace (`-bunTab home`, signed out).

## Addendum 3: admin-view restructure (founder batch, same evening)

- Nav: Home · Money · People · Accounts · Cards. Money = Move money + Transactions merged (chips, Up next installments with demo "Came in" that writes a ledger row, Payments lists, links, embedded feed). People = Team (coverage, per-day week strip, member rows) / Clients (tally + check-in queue + prioritized roster) — moved off Accounts, which is pure banking again. Home lost the Cards section and the EOD banner (admin view; employee view later).
- Chart rebuilt to the founder's reference: designed rolling curve (BunFixtures.curveShape), catmullRom, bright periwinkle line + glow, deep gradient fill, tappable scrubber with day/value pill.
- Sets rows show which closer the call is booked with; the "unclaimed" tag opens BunUnclaimedSetsSheet.
- Categorize can add new categories on the fly (BunStore.customCategories).
- Warm-launch splash animates (logo spring + caption) and dissolves into Home with a slight zoom. Sticky demo workspace via @AppStorage("bunDemoWorkspace"); "Leave demo workspace" in Settings; -signOut clears it.
- Onboarding: welcome copy generalized, mesh gradient livelier (~7s orbits + breathing glow), pitch pages got illustrations (framed-phone hero, EOD-filed pill, growth curves, padlock).
- Smoke tests updated to the new tabs; 65 unit + 5 smoke green. VSL player restored and live on ivysalesacademy.com.

## Addendum 4: tab consolidation, banking merge, light mode

- Tabs are now four: Home · Money · Studio · Banking. `BunBanking` merges the old Accounts + Cards (total balance, Bun accounts, Mercury-style card faces with the footer band, card detail with Number/Apple Wallet/Freeze chips, card facts, daily spending meter with posted/pending/available, activity). Linked external accounts removed. `BunAccounts.swift`/`BunCards.swift` deleted.
- `BunStudioPage` (was People): Performance (funnel sets→showed→closes with rates, setter rows with dials/DMs, closer rows) + Students (tally, check-in queue, prioritized roster). Team roster moved back to Home → Team, and that sheet now has clickable EOD days showing exactly who filed and who did not.
- Money: payment links removed; Scheduled opens `BunScheduleCalendarSheet` — month grid with green (in) / pink (out) dots per day, month totals, and a day detail listing each installment and payout.
- Transaction detail gained "View client", opening the matched student's profile.
- Light mode: every BunTheme token is now trait-adaptive (UIColor dynamic provider) and Settings → Appearance is a real Light / Dark / System picker with sun, moon, and half-circle tiles, stored in @AppStorage("bunAppearance") and applied at the app root. Onboarding and auth stay dark on purpose.
- Startup splash: rotation removed, plain fade in/out like the onboarding.
- Smoke tests updated for four tabs; 65 unit + 5 smoke green.

## Addendum 5: refinement pass

- **Fixture data vanished after pull-to-refresh** (founder: "add the fake data back"): every `.refreshable` nils its slice of the store, and each loader did `guard signedIn else { return }`, so signed-out the data never came back. `seedFixturesIfNeeded()` is now field-by-field idempotent (refills any nil slice) and every loader plus `refreshAll()` re-seeds when signed out.
- **Nav bar zoomed on tap**: `.glassEffect(...).interactive()` swells under touch. `bunGlassSurface` took an `interactive` flag; the tab bar now uses non-interactive glass (cards/chips keep the interactive swell).
- **Light mode verified** on all four tabs; chart colors moved to adaptive tokens (`chartStroke/chartGlow/chartFillTop/chartFillBottom`) because the periwinkle line was invisible on a light ground, the scrub rule/dot follow `ink`/`chartStroke`, and the white card art gained a hairline so it keeps its edge on a light page.
- 65 unit + 5 smoke tests green.
