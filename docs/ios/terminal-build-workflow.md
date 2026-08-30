# iOS Build Knowledge: Terminal-Only Workflow (No Xcode GUI)

Codified 2026-08-30 from Claude Code's on-Mac ground truth, verified against `ios-bun`. This is the canonical way agents drive the Bun app on the Mac. Add to AGENTS.md context for any Mac-side session.

## The correction that matters

Xcode is needed as a TOOLCHAIN (compilers, iOS SDK, simulator runtime live in Xcode.app). Xcode is NOT needed as an interface. The app was built entirely from the terminal; nobody opened the GUI.

## Canonical terminal workflow (on the Mac)

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # required

# 1. Project file is GENERATED, never hand-edited
cd ios && xcodegen generate --spec project.yml

# 2. Build for simulator (scheme: IvyPortal)
xcodebuild -project IvyPortal.xcodeproj -scheme IvyPortal \
  -destination 'platform=iOS Simulator,name=Ivy Portal iPhone 17 Pro' build

# 3. Install + launch + screenshot without any GUI
xcrun simctl install booted <app path>
xcrun simctl launch booted com.ivysalesacademy.ivyportal -showPayments -moneyTab payouts
xcrun simctl io booted screenshot shot.png

# 4. Tests
swift test --package-path ios                                   # IvyPortalCore, no sim needed
xcodebuild ... build-for-testing test                            # app-hosted sim tests
```

## Verified facts (from repo, 2026-08-30)

- Bundle ID: `com.ivysalesacademy.ivyportal` (from project.yml; NOT the dev prefix in the old handoff doc)
- Sim name on Sair's Mac: "Ivy Portal iPhone 17 Pro"
- Launch presets actually consumed by BunShell: `-bunTab`, `-bunSheet`, plus money section args; `-showPayments`, `-moneyTab` also accepted
- Appearance: `@AppStorage("bunAppearance")` in IvyPortalApp.swift, default "dark"

## Gotchas

- `DEVELOPER_DIR` must point at Xcode.app (set on Sair's Mac)
- The app pins light/dark via `@AppStorage("bunAppearance")`, so `simctl ui appearance` does nothing. Flip it with:
  `xcrun simctl spawn <sim> defaults write com.ivysalesacademy.ivyportal bunAppearance light`
- Regenerate with xcodegen after ANY file add/remove, or the build ships stale sources

## Implication for agent architecture

Any agent ON the Mac (Claude Code, local Hermes) can fully build/run/screenshot the app via these commands. The remote Linux Arrodes cannot. Options: local Hermes as worker via fixed relay, or CI-based screenshots on GitHub macOS runners (no Mac needed at all, artifacts downloadable).
