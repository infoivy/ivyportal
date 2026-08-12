public enum HomeDetail: Equatable, Sendable {
    case upcomingEvent
}

public enum HomeAction: Equatable, Sendable {
    case reviewOverdue
    case reviewCoverage
    case openCalls
    case openCash
    case openUpcoming

    public var destination: RootDestination? {
        switch self {
        case .reviewOverdue:
            return .work
        case .reviewCoverage, .openCalls, .openCash:
            return .performance
        case .openUpcoming:
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
