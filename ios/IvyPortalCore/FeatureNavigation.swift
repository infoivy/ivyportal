public enum PortalFeature: String, CaseIterable, Hashable, Sendable {
    case overview, performance, payments

    public var rootDestination: RootDestination? {
        switch self {
        case .overview: .home
        case .performance: .performance
        case .payments: nil
        }
    }
}

public enum PaymentsTab: String, CaseIterable, Hashable, Sendable {
    case overview, clients, costs
}

public enum MetricDetailKind: Hashable, Sendable {
    case dailyAndTeammates
    case hourlyActivity
    case replyPerformance
}

public enum PerformanceMetric: String, CaseIterable, Hashable, Sendable, Identifiable {
    case totalMessages, totalReplies, followUps, linksSent, bookedCalls
    case activeHours, setterReplies, scriptAnalysis

    public var id: String { rawValue }

    public var detailKind: MetricDetailKind {
        switch self {
        case .activeHours: .hourlyActivity
        case .setterReplies: .replyPerformance
        default: .dailyAndTeammates
        }
    }
}

public enum FeatureNavigationPolicy {
    private static let leadership: Set<PortalRole> = [.admin, .founder, .cofounder]
    private static let finance: Set<PortalRole> = [.founder, .cofounder]

    public static func menuFeatures(for roles: [PortalRole]) -> [PortalFeature] {
        let roleSet = Set(roles)
        return PortalFeature.allCases.filter { feature in
            switch feature {
            case .overview: true
            case .performance: !leadership.isDisjoint(with: roleSet)
            case .payments: !finance.isDisjoint(with: roleSet)
            }
        }
    }
}
