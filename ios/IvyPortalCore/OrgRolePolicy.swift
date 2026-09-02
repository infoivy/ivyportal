import Foundation

/// Which operating roles apply inside the ACTIVE workspace.
///
/// Two role sources coexist during the multi-tenant transition:
/// - `org_members.roles` — per organization. `create_organization` grants the
///   creator owner/admin/founder of their NEW org only; the Ivy backfill
///   (2026-08-17) copied every member's `user_roles` in, and on 2026-09-02 the
///   two still matched row for row (49/49, zero drift).
/// - `user_roles` — the legacy global table every RLS policy still keys on.
///
/// Rule: the active org's membership decides whenever it says anything; the
/// legacy roles are the fallback. That is what unlocks Finance, CRM, the
/// profit split and the team-chat toggle for a business owner who holds no
/// legacy row, without changing anything for Ivy staff.
public enum OrgRolePolicy {
    /// Membership tokens that are not operating roles (never gate anything).
    private static let ignored: Set<String> = ["student"]

    /// `owner` is a Bun membership concept, not a portal role: inside that org
    /// it carries admin + founder gating. Unknown tokens are dropped, order is
    /// kept, duplicates collapse.
    public static func portalRoles(fromMembership raw: [String]) -> [PortalRole] {
        var out: [PortalRole] = []
        for token in raw.map({ $0.lowercased() }) where !ignored.contains(token) {
            let mapped: [PortalRole]
            if token == "owner" {
                mapped = [.admin, .founder]
            } else if let role = PortalRole(rawValue: token) {
                mapped = [role]
            } else {
                mapped = []
            }
            for role in mapped where !out.contains(role) { out.append(role) }
        }
        return out
    }

    /// Grantable Home views (sales/fulfillment) ride on the same membership row.
    public static func homeViews(fromMembership raw: [String]) -> [HomeViewRole] {
        var out: [HomeViewRole] = []
        for token in raw.map({ $0.lowercased() }) {
            if let view = HomeViewRole(rawValue: token), !out.contains(view) { out.append(view) }
        }
        return out
    }

    /// Effective operating roles: membership first, legacy fallback.
    public static func effectiveRoles(membership: [String], legacy: [PortalRole]) -> [PortalRole] {
        let fromOrg = portalRoles(fromMembership: membership)
        return fromOrg.isEmpty ? legacy : fromOrg
    }

    /// Effective Home views. When the org says nothing about operating roles
    /// it says nothing about views either, so the legacy grant stands.
    public static func effectiveHomeViews(membership: [String], legacy: [HomeViewRole]) -> [HomeViewRole] {
        portalRoles(fromMembership: membership).isEmpty ? legacy : homeViews(fromMembership: membership)
    }
}
