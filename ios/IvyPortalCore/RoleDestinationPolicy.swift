import Foundation

public enum PortalRole: String, Hashable, Sendable {
    case admin, founder, cofounder, closer, setter, coach, csm
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
