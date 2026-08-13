import Foundation

public enum PortalRole: String, Hashable, Sendable {
    case admin, founder, cofounder, closer, setter, coach, csm
}

/// Grantable Home "view" roles (founder-directed 2026-07-31): independent of
/// the operating roles above. Holding `sales` opens the sales picture (Abu
/// Bilal), `fulfillment` opens the delivery picture (Faizan), both shows both,
/// neither falls back to the leadership brief. Founder can grant a view to
/// anyone or preview on a second account.
public enum HomeViewRole: String, CaseIterable, Hashable, Sendable {
    case sales, fulfillment
}

/// Which Home picture a member sees, derived from leadership + view roles.
public enum HomePicture: String, CaseIterable, Hashable, Sendable {
    case sales, fulfillment, leadership, personal
}

public enum HomePicturePolicy {
    private static let leadership: Set<PortalRole> = [.admin, .founder, .cofounder]

    public static func isLeader(_ roles: [PortalRole]) -> Bool {
        !leadership.isDisjoint(with: Set(roles))
    }

    /// The pictures a leader's Home shows, in order. Non-leaders get `.personal`.
    public static func pictures(for roles: [PortalRole], views: [HomeViewRole]) -> [HomePicture] {
        guard isLeader(roles) else { return [.personal] }
        let viewSet = Set(views)
        var result: [HomePicture] = []
        if viewSet.contains(.sales) { result.append(.sales) }
        if viewSet.contains(.fulfillment) { result.append(.fulfillment) }
        if result.isEmpty { result = [.leadership] }
        return result
    }
}

public enum RootDestination: String, CaseIterable, Hashable, Sendable {
    case home, work, performance, customers, more
}

public enum MoreEntry: String, CaseIterable, Hashable, Sendable {
    case knowledge, profile, teamAdministration, admin, integrations, finance, cards, signOut
}

public enum RoleDestinationPolicy {
    private static let leadership: Set<PortalRole> = [.admin, .founder, .cofounder]

    public static func destinations(for roles: [PortalRole]) -> [RootDestination] {
        let roleSet = Set(roles)
        return RootDestination.allCases.filter { destination in
            destination != .performance || !leadership.isDisjoint(with: roleSet)
        }
    }

    public static func moreEntries(for roles: [PortalRole]) -> [MoreEntry] {
        let roleSet = Set(roles)
        return MoreEntry.allCases.filter { entry in
            switch entry {
            case .knowledge, .profile, .signOut:
                return true
            case .teamAdministration, .admin, .integrations:
                return roleSet.contains(.admin)
            case .finance, .cards:
                return !Set([PortalRole.founder, .cofounder]).isDisjoint(with: roleSet)
            }
        }
    }
}
