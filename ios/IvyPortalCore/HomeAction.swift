public enum HomeDetail: Equatable, Sendable {
    case upcomingEvent
}

public enum HomeAction: Equatable, Sendable {
    case reviewOverdue
    case reviewCoverage
    case openCalls
    case openPayments
    case openUpcoming

    public var destination: RootDestination? {
        switch self {
        case .reviewOverdue:
            return .work
        case .reviewCoverage, .openCalls:
            return .performance
        case .openPayments, .openUpcoming:
            return nil
        }
    }

    public var detail: HomeDetail? {
        switch self {
        case .openUpcoming:
            return .upcomingEvent
        default:
            return nil
        }
    }
}
