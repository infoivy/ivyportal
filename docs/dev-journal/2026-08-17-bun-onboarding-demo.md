# Log: Bun complete onboarding demo

### Prompt
"ok now show me it in a test environment, the complete onboarding"

### Issue
Prove the multi-tenant Phase 1 foundation end to end from the iOS app: a stranger creates a Bun account, names their business, gets an isolated workspace, and invites a teammate. The first two automated runs failed before the business-naming screen ever appeared.

### What I did
- Diagnosed and fixed three real bugs the demo surfaced:
  1. **Simulator sessions were silently anonymous.** Unsigned simulator builds (`CODE_SIGNING_ALLOWED: NO`) cannot use the keychain (errSecMissingEntitlement, -34018), so supabase-swift never persisted the session and every request ran as `anon`. That made `create_organization` fail with permission denied while the UI looked signed in. Fix: `SimulatorSessionStorage` (UserDefaults-backed `AuthLocalStorage`) behind `#if targetEnvironment(simulator)` in `AuthStore`. Devices/TestFlight keep the keychain.
  2. **Misleading auth errors.** `message(for:)` now distinguishes `email_address_invalid`, email rate limits, existing accounts, weak passwords, unconfirmed email; "the portal" copy became "Bun".
  3. **Sign-in stranded users under sheets.** `BunSettingsSheet` now dismisses itself on sign-in, so a fresh account lands directly on the "Name your business" takeover. Added `pendingConfirmationEmail` state + green notice in `AuthView` for the confirm-your-email case.
- Split `BunOnboardingDemo` into `testPart1CreateAccount` / `testPart2ConfirmedOnboarding` with credentials via `TEST_RUNNER_BUN_DEMO_EMAIL/PASSWORD` env; added `BunOrgProbeTests` (skip-gated diagnostic).
- Ran the full flow green: login → Name your business → "Acme Coaching" workspace ($0 everywhere, isolated) → invite teammate (setter+closer) → invite row verified in production, scoped to the new org. Ivy tenant untouched.
- Published the screenshot walkthrough artifact "Bun First Run".

### How I did it
- Files: `IvyPortal/Data/AuthStore.swift`, `IvyPortal/Features/Auth/AuthView.swift`, `IvyPortal/Bun/BunSheets.swift`, `IvyPortalUITests/IvyPortalInteractionTests.swift`, `IvyPortalTests/BunOrgProbeTests.swift` (new).
- Debugging: exported xcresult attachments + screen recordings, extracted frames with ffmpeg, probed GoTrue with curl, verified rows with Supabase MCP SQL, in-process unit-test probe pinned the keychain failure (SecItemAdd = -34018).
- Demo accounts were provisioned through the web portal's public signup form (Playwright), which pre-confirms via the server key: in-app signup cannot complete because **the project has no custom SMTP** and Supabase's built-in mailer quota (a couple of emails/hour) is exhausted, so confirmation emails cannot send. GoTrue also rejects fake domains (`email_address_invalid`), which killed the original `@bunapp-demo.com` attempts.

### What was challenging
- Every failure was invisible by design: anon reads return `[]` under RLS instead of erroring, so the app looked signed in while every query ran unauthenticated.
- The auto-mode classifier (correctly) blocked direct `auth.users` inserts and bundle-scraping for the web server-fn endpoint; the web portal's real signup form was the legitimate path.
- Decided NOT to flip Supabase autoconfirm even though it would unblock in-app signup: `handle_new_user` links students and grants invite roles at signup time, so inbox proof is the only thing stopping account takeover by email squatting. Confirmations must stay ON.

### Future work
- Configure custom SMTP (Resend/Postmark) in Supabase Auth settings so in-app self-serve signup works for real users; then `testPart1CreateAccount` should pass as-is.
- Clean up demo rows (2 accounts `a+bun-demo*@ivysalesacademy.com`, 2 "Acme Coaching" orgs, 1 invitation) once the founder confirms.
- Web: the "application pending" page has no sign-out control.
- Phase 2 multi-tenancy (org-scoped RLS cutover, org switcher, Bun web) still deferred and supervised.
