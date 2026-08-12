# Ivy Portal iOS Mac build handoff

## Purpose

This is the execution brief for a Hermes session running locally on Abdurrahman's Mac. Do not begin Xcode work unless the live tool host reports macOS.

The goal is a native SwiftUI Ivy Portal client that shares the existing Portal and Supabase backend. It must reach the craft level of the private Mochi reference without copying Mochi's product structure or weakening Ivy's authorization and data truth.

## Mandatory host check

Before editing app code, run:

```bash
uname -s
xcodebuild -version
xcrun simctl list runtimes
```

Proceed only when:

- `uname -s` returns `Darwin`
- Xcode and an iOS Simulator runtime are installed
- the repository is the canonical `infoivy/ivyportal` checkout
- `git fetch origin main` succeeds

If the host is Linux, stop. That session cannot build or verify an iOS application.

## Canonical boundaries

- Repository: `infoivy/ivyportal`
- Web production: `https://portal.ivysalesacademy.com`
- Backend: the existing Supabase project and RLS policies
- Native project root: `ios/`
- iOS app name: `Ivy Portal`
- Initial bundle identifier: use a reversible development identifier until the Apple Developer Team and final identifier are verified locally
- Distribution: Simulator first, then a real iPhone, then TestFlight

Do not create another CRM, analytics store, payment store, customer database, or team-operations backend.

## Security rules

- Never put `SUPABASE_SERVICE_ROLE_KEY` in the iOS project, app bundle, logs, tests, fixtures, or documentation.
- Use only the Supabase URL and publishable or anon client key in the native client.
- RLS and server functions remain the enforcement layer. Hiding a native screen is not authorization.
- Store the authenticated session using the Supabase Swift client's supported secure persistence. Do not invent a plaintext token file.
- Use synthetic data for visual QA until authenticated role behavior is intentionally tested.
- Keep private lead, student, payment, and conversation data out of screenshots and committed fixtures.
- Outbound messages and consequential actions retain their existing approval and authorization gates.

## Source contracts to inspect before implementation

Read these files from the current checkout:

- `AGENTS.md`
- `src/lib/portal-navigation.ts`
- `src/lib/auth-context.ts`
- `src/routes/_authenticated.dashboard.tsx`
- `src/routes/_authenticated.work.tsx`
- `src/routes/_authenticated.performance.tsx`
- `src/integrations/supabase/types.ts`
- `docs/DATABASE.md`
- the latest effective migrations for every table or function touched

The current web implementation establishes these important rules:

- Staff roles include `admin`, `founder`, `cofounder`, `closer`, `setter`, `coach`, and `csm`.
- Performance is currently a leadership surface for `admin`, `founder`, and `cofounder`.
- Representatives see their own relevant pulse on Home, not team-wide Performance.
- Home is action-first, not a passive analytics wall.
- Work is a role-aware directory or direct daily queue.
- Unknown, unavailable, failed, and genuine zero are different states.
- Portal and its Supabase database remain canonical.

Do not rely on `docs/DATABASE.md` alone when a migration has changed behavior. Inspect effective schema and policies.

## Private design reference

The private narrated Mochi recording and derived materials are deliberately not stored in git.

Before visual implementation, the local Mac session should receive the already prepared package named:

`ivy-portal-ios-design-reference-v1.zip`

Expected package contents:

- Ivy iOS design source of truth
- complete timestamped transcript
- provenance manifest
- representative overview
- 20 original-resolution reference keyframes

Keep the extracted package outside the repository, preferably:

`~/Library/Application Support/IvyPortalDesignReference/`

Do not upload it to GBrain, GitHub, public image hosting, or another external service. Do not commit its screenshots, transcript, names, or source link.

If the package is not present locally, ask Abdurrahman to download the attachment from the hosted Arrodes chat or drag it into the local session. Do not substitute memory for the source.

## Approved design direction

Build native SwiftUI. Do not use a `WKWebView` wrapper.

The reference quality comes from one coherent system:

- layout-preserving skeleton loading
- calm near-black surfaces and restrained semantic color
- San Francisco typography and Dynamic Type
- 16 pt primary horizontal inset and consistent spacing rhythm
- quiet opaque analytical cards
- glass reserved for functional floating chrome
- immediate touch-down feedback
- interruptible, spatially coherent navigation and sheets
- compact member and date filters
- tappable KPI cards that open one reusable detail-sheet pattern
- source and update context on operational metrics

Use iOS 26 Liquid Glass APIs only when the installed SDK supports them. Keep a high-quality material fallback for earlier supported iOS versions. Do not make glass the wallpaper and do not stack translucent analytical cards.

## Native information architecture

Root destinations:

1. Home
2. Work
3. Performance, only for currently authorized roles
4. Customers
5. More

### Home

Order:

1. ranked exceptions and next actions
2. personal or leadership pulse
3. upcoming calls and time-sensitive ownership
4. small linked summaries

### Work

Role-aware entries can include:

- My EOD
- action items
- Calendar and booked sets
- CRM queues and conversations
- Money in
- payouts or finance where authorized
- team chat

If a role has one dominant daily workflow, open it directly instead of showing an unnecessary directory.

### Performance

Keep one canonical analytical surface:

- one selectable trend
- one compact funnel or conversion story
- one accountability or teammate comparison
- date and member filters
- one reusable KPI detail sheet
- explicit source, scope, and update context

Do not widen team Performance beyond the current role contract.

### Customers

Use native cards and list patterns for students, calls, coaching, CSM workflows, and testimonials. Do not compress desktop tables onto iPhone.

### More

Contains role-specific secondary destinations such as Knowledge, Profile, Team, Admin, Integrations, Finance, Cards, and Sign out. Omit unavailable destinations.

## Project architecture

Create the native project under `ios/` and keep Xcode project generation reproducible. Prefer XcodeGen or another text-defined project generator over hand-maintaining a large opaque `project.pbxproj`, provided the tool is installed and verified on the Mac.

Suggested source layout:

```text
ios/
  project.yml
  Config/
    Debug.example.xcconfig
  IvyPortal/
    App/
    Core/
      Auth/
      Data/
      DesignSystem/
      Models/
    Features/
      Authentication/
      Home/
      Work/
      Performance/
      Customers/
      More/
    PreviewSupport/
    Resources/
  IvyPortalTests/
```

Use dependency injection so previews and tests can run with synthetic repositories while the production implementation uses Supabase.

Recommended foundations:

- SwiftUI
- `NavigationStack`
- Observation with `@Observable` where appropriate
- async/await
- Supabase Swift through Swift Package Manager
- native charts when the installed deployment target supports the required interaction
- `OSLog` with privacy-safe messages
- no third-party design system

## State contract

Every network-backed screen must represent:

- idle
- loading with known geometry
- loaded with verified data
- loaded with a genuine empty state
- unavailable because the source has no verified answer
- failed with a retry path
- refreshing while retaining the last verified state

A missing value must never silently become zero.

## Strict implementation order

Follow test-driven development. For each production behavior, write one failing test, run it and confirm the expected failure, implement the minimum code, rerun the focused test, then run the wider suite.

### Tracer 1: role-aware root destinations

Write a failing unit test for a pure role-to-destination policy. Verify:

- leadership receives Performance
- an ordinary setter does not receive team Performance
- unauthorized More entries are omitted
- multiple roles union capabilities without creating duplicate destinations

Then implement the smallest policy needed to pass.

### Tracer 2: truthful load states

Write a failing test for the generic load-state model. Verify that genuine zero, unavailable, failure, initial loading, and refresh-with-stale-data remain distinct.

Then implement the smallest typed state model needed to pass.

### Tracer 3: app shell

Build the native shell with:

- five conceptual destinations
- role-aware visibility
- custom floating visual treatment without replacing native navigation semantics
- at least 48 pt touch targets
- safe-area-aware placement
- Dynamic Type and VoiceOver labels
- iOS 26 glass when available, material fallback otherwise

Use a Debug-only synthetic signed-in state so the shell can be reviewed without production credentials. The Release build must not expose a demo login or synthetic private data.

### Tracer 4: authentication

Add real Supabase email/password authentication and secure session restoration. Load the signed-in user's `profiles` row and own `user_roles` rows through RLS. Model loading, no-role, failure, and sign-out explicitly.

Do not implement admin role assignment in the first slice.

### Tracer 5: Home vertical slice

Implement one real Home repository that reads only existing authorized contracts. Start with the smallest useful action queue and pulse, not the entire web Home query.

Minimum first-pass behavior:

- own missing EOD exception when applicable
- own assigned action items
- personal pulse for a representative or compact leadership pulse for an authorized leader
- skeleton, empty, unavailable, failure, refresh, and retry

Preserve source truth. If a web query depends on a view or function not proven suitable for the native role, inspect its effective RLS and grants before use.

### Tracer 6: one Performance card and detail sheet

For authorized roles only:

- one period filter
- one member-scope filter
- one verified KPI card
- one reusable detail sheet with chart, daily breakdown, source, scope, and update time

A non-authorized account must be blocked by both UI policy and existing database authorization.

## Build and test gates

Discover an installed simulator rather than assuming a device name:

```bash
xcrun simctl list devices available
```

Then run the equivalent of:

```bash
xcodegen generate --spec ios/project.yml
xcodebuild \
  -project ios/IvyPortal.xcodeproj \
  -scheme IvyPortal \
  -destination 'platform=iOS Simulator,id=<AVAILABLE_UDID>' \
  -derivedDataPath ios/.derivedData \
  test
```

Also run a clean build for the same simulator. Do not report success from source inspection alone.

## Visual verification gate

After the first shell builds:

1. Boot an available recent iPhone simulator.
2. Install and launch the Debug app.
3. Capture screenshots of Home, Work, Performance, More, skeleton loading, an empty state, an error state, and the KPI detail sheet.
4. Compare them side by side with the private reference keyframes.
5. Verify dark appearance, large Dynamic Type, Reduce Motion, and Reduce Transparency.
6. Check every primary touch target and VoiceOver label.
7. Inspect console output and fix warnings or runtime errors.
8. Rerun build and tests after the final visual edit because earlier evidence becomes stale.

Do not claim Mochi-level craft without rendered screenshot evidence from the exact final tree.

## First-session completion definition

The first local Mac session is complete only when all of these are true:

- a reproducible native project exists under `ios/`
- the role destination tests were observed failing, then passing
- the truthful state tests were observed failing, then passing
- the app shell builds in an installed iOS Simulator
- Home, Work, Performance, Customers, and More navigation renders with correct role visibility
- skeleton, empty, unavailable, and failure states can be exercised with synthetic Debug repositories
- screenshots were captured and reviewed against the private reference
- no service-role key, private fixture, source recording, or reference screenshot entered git
- `git diff` contains only intentional files
- the web Portal verification still passes if shared repository files changed

Do not push a broken generated project. Once the complete gate passes, commit and push under the standing Ivy Portal permission and verify the remote commit.

## Local Hermes instruction

Once Hermes is running on the Mac with this repository as its working directory, use this task instruction:

> Continue the Ivy Portal native iOS build from `docs/ios/MAC_BUILD_HANDOFF.md`. First prove the tool host is Darwin and Xcode plus an iOS Simulator runtime are available. Locate the private `ivy-portal-ios-design-reference-v1.zip` outside git and inspect it before visual implementation. Then execute the strict tracer sequence. Do not stop at a scaffold or plan. Build and test the exact app in Simulator, launch it, capture and review screenshots, fix defects, rerun the final gates, and only then commit and push verified work.
