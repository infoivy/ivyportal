public enum PortalFeature: String, CaseIterable, Hashable, Sendable {
    case overview, performance, payments, work, students

    public var rootDestination: RootDestination? {
        switch self {
        case .overview: .home
        case .performance: .performance
        case .work: .work
        case .students: .customers
        case .payments: nil
        }
    }
}

/// Clients (fulfillment) sections. Lives in Core so HomeAction and the shell
/// can deep-route into a specific tab (tiles + tab-icon long-press jumps).
public enum CSMTab: String, CaseIterable, Hashable, Sendable {
    case students, csm, oneOnOne, testimonials, requests

    public var label: String {
        switch self {
        case .students: "Students"
        case .csm: "CSM"
        case .oneOnOne: "1-on-1"
        case .testimonials: "Testimonials"
        case .requests: "Requests"
        }
    }

    public var subtitle: String {
        switch self {
        case .students: "Roster, health, and records"
        case .csm: "Check-ins and coverage"
        case .oneOnOne: "Coaching calls and follow-up"
        case .testimonials: "Collect student proof"
        case .requests: "Pending access requests"
        }
    }

    public var symbol: String {
        switch self {
        case .students: "graduationcap.fill"
        case .csm: "person.2.fill"
        case .oneOnOne: "phone.fill"
        case .testimonials: "quote.bubble.fill"
        case .requests: "envelope.fill"
        }
    }
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
            case .work: true
            case .students: !roleSet.isDisjoint(with: [.admin, .founder, .cofounder, .coach, .csm])
            case .payments: !finance.isDisjoint(with: roleSet)
            }
        }
    }
}
