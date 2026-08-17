# Ivy Portal iOS

Native staff app for the Ivy Sales Academy portal. Same Supabase project, same
RLS, same business rules as the web portal at `~/ivyportal` — the web repo's
`CLAUDE.md` rules (roles, commissions, EOD KPIs, data history) apply here too.

## Build

- `xcodegen generate --spec project.yml` regenerates `IvyPortal.xcodeproj`.
  Run it after ANY file add/remove or the build silently ships stale sources.
- Supabase credentials: see `IvyPortal/Config/README.md` (gitignored config file).
- TestFlight: `scripts/testflight.sh` + `TESTFLIGHT.md`.

## Launch arguments (DEBUG previews, screenshots, UI tests)

All state presets are plain launch arguments, consumed once at startup:

| Argument | Values | Presets |
| --- | --- | --- |
| `-demoScenario <s>` | `loaded` `loading` `empty` `unavailable` `failed` | Signed-out DEBUG data scenario |
| `-demoDestination <d>` | `home` `work` `performance` `customers` `more` | Root tab |
| `-workTab <t>` | `myEOD` `calendar` `actionItems` `knowledge` | Work hub chip |
| `-csmTab <t>` | `students` `csm` `oneOnOne` `testimonials` `requests` | Clients section |
| `-moneyTab <t>` | `overview` `deals` `paymentPlans` `payouts` `expenses` | Payments sheet tab |
| `-homePicture <p>` | `sales` `fulfillment` `leadership` `personal` | Home picture (also marks it user-chosen) |
| `-showMenu` | flag | Home drawer open |
| `-showPayments` | flag | Payments sheet presented |
| `-showBell` | flag | Notifications sheet presented |
| `-showActivity` | flag | Activity feed sheet presented |
| `-showComposer` | flag | Action-item composer presented (signed-out preview) |

Example: screenshot the Payouts ledger directly:

```sh
xcrun simctl launch booted com.ivysalesacademy.ivyportal -showPayments -moneyTab payouts
```

## Layout

- `IvyPortalCore/` — platform-free policy + math (role gates, routing,
  payouts, KPIs, student health). Unit-tested in `IvyPortalTests`.
- `IvyPortal/Features/` — SwiftUI surfaces by feature area.
- `IvyPortal/Data/PortalAPI.swift` — all Supabase reads/writes (web column
  semantics, `is_demo`/`voided`/`archived` filters everywhere).
- `IvyPortal/Resources/SOPs/` — the portal's built-in knowledge pages
  (Foundations policies + Core SOPs), verbatim markdown; regenerate from the
  web repo when those pages change.
