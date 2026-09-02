# Log: Bun iOS — real org switching and per-org roles

### Prompt
"bun multiple org and bun app finish" (continued after the web-side migrations were applied).

### Issue
The iOS Bun app was org-aware in only four call sites. `switchOrg` fired a detached task and the sheet dismissed at once, so a prior org's tables sat under the new org's name; `clearAll` left 21 org-scoped slices untouched and their loaders guard on nil, so CRM, Testimonials, Chat, Team admin, Alerts, Payment links, CSM and client records stayed pinned to the first org for the whole session. The active org was never persisted and `myOrgs()` had no ORDER BY, so a two-business account landed on a random workspace each launch. Roles came only from the global `user_roles`, so a fresh business owner (who holds none) was locked out of Finance, CRM, CSM, the profit split and the team-chat toggle in their own org. The invite sheet's `orgId == nil` branch silently enrolled invitees into the default (Ivy) org.

### What I did
- `IvyPortalCore/OrgRolePolicy.swift` (new): membership-first role derivation. `owner` → admin + founder inside that org; `student` and unknown tokens gate nothing; legacy `user_roles` are the fallback when the membership is silent. Home views follow the same rule. Verified against production first: all 49 Ivy members' `org_members.roles` equal their `user_roles` (zero drift), so Ivy staff see no change.
- `PortalAPI.myMemberships()`: returns roles + org, ordered by `org_members.created_at`; `myOrgs()` wraps it.
- `AuthStore`: keeps legacy roles/views separately, `applyMembershipRoles(_:)` recomputes `roles`/`homeViews`; cleared on sign-out.
- `BunStore`: `activeOrgId` persists in UserDefaults (`bunActiveOrg`) and is reconciled against real memberships on load; `switchOrg` is `async`, guarded by `isSwitchingOrg`, re-derives roles, then awaits `refreshAll`; `clearAll` resets the 21 missing slices and marks orgs stale instead of nil-ing them (no fixture-name flash mid-reload); `createBusiness` selects the new org before reloading.
- `BunOrgSwitcherSheet`: awaits the switch with a "Switching workspace…" row, ignores taps while in flight, dismisses after.
- `BunCreateBusinessView` dismisses on success; `BunInviteSheet` refuses without an active workspace.
- `IvyPortalTests/OrgRolePolicyTests.swift`: 7 tests. Triage doc item 6 marked fixed.

### How I did it
Recreated the gitignored `ios/IvyPortal/Config/PortalConfig.swift` from `.env` (removed by PR #8). Python patch script with exact-match asserts, `xcodegen generate`, `xcodebuild … build` (succeeded), `swift test --package-path ios` (75/75), app-hosted `IvyPortalTests` on the simulator, launch smoke with `-bunTab home` and `-signOut` screenshots.

### What was challenging
- No demo credentials on this Mac (`BUN_DEMO_EMAIL/PASSWORD` unset, and resetting a test user's password in production is classifier-blocked), so the signed-in switch → reload → roles path is verified by build + unit tests, not by a live session.
- The role decision: membership-first is Phase-2-correct but depends on `org_members.roles` staying in sync for Ivy. Today the web admin UI writes only `user_roles`; if that drifts, Ivy staff gating would follow the stale membership row. Recorded as a follow-up.

### Future work
- Web admin (portal + bun-web) should write `org_members.roles` alongside `user_roles`, or Phase 2 should make `org_members` the only source.
- Data reads are still not org-filtered on the client (~125 call sites); isolation for a second business still relies on the missing Phase-2 RLS.
- Money surfaces (`BunBanking`, `BunFlows`) render fixtures when signed in; per-tenant integrations (Mochi/Instagram/Close) have no in-app setup.
- Live verification with a two-org account once credentials exist.
