# Ivy Portal iOS → TestFlight

The app is wired to the production Supabase project (`ivy-portal-eu`,
`hlfeshzkfbzkvlullqnb.supabase.co`) with the same publishable key the web
portal uses. Everyone signs in with their existing portal account; roles,
students, deals, EODs, payouts — all the same rows the web reads.

## One-time setup (founder, ~15 minutes)

1. **Apple Developer Program**: enroll (or confirm membership) at
   developer.apple.com with the Ivy Sales Academy Apple ID ($99/yr).
   Note the **Team ID** (Membership page, 10 characters).
2. **App Store Connect API key**: App Store Connect → Users and Access →
   Integrations → App Store Connect API → Team Keys → Generate. Role:
   **App Manager**. Download the `.p8` once; note the **Key ID** and
   **Issuer ID** (shown at the top of that page).
3. **Google sign-in allowlist** (only needed for the Google button; email +
   password works with zero config): Supabase Dashboard → project
   `ivy-portal-eu` → Authentication → URL Configuration → Redirect URLs →
   add `ivyportal://auth-callback`.

## Upload (every build)

```bash
cd ios
TEAM_ID=XXXXXXXXXX \
ASC_KEY_ID=ABC123DEFG \
ASC_ISSUER_ID=12345678-aaaa-bbbb-cccc-1234567890ab \
ASC_KEY_PATH=$HOME/keys/AuthKey_ABC123DEFG.p8 \
./scripts/testflight.sh
```

The script regenerates the Xcode project, archives Release with automatic
signing (`-allowProvisioningUpdates` registers the bundle id
`com.ivysalesacademy.ivyportal` and creates profiles on first run), stamps a
unique timestamp build number, and uploads straight to App Store Connect.

First upload only:
- App Store Connect creates the app record; set the app name there if asked.
- TestFlight → Internal Testing → create a group, add team emails.
  Internal testers need no review; builds are installable minutes after
  processing. (Export compliance is pre-answered via
  `ITSAppUsesNonExemptEncryption=false`.)

## What a signed-in build contains (2026-08-15)

Live against production: role-gated tabs and Home pictures, money strip,
notifications bell (6 alert families), Payments sheet (payout ledger +
confirmations + adjustments, deals + log-a-close, plans + mark-paid/waive/
refund), EOD submit, action items, knowledge docs, set tracker, expenses,
student roster with health scores + manage writes, CSM tallies, 1-on-1 call
log, team week, profile editing (display name, phone, timezone).

Web-first for now (by design): Finance/Whop reconciliation, Mochi analytics
drilldowns, CRM replica, IG content planning, team chat, set claim/cancel
(server-function-mediated), student portal.

Alternative to the script: open `ios/IvyPortal.xcodeproj` in Xcode, sign in
with the Apple ID (Settings → Accounts), select the team on the IvyPortal
target, then Product → Archive → Distribute App → TestFlight.
