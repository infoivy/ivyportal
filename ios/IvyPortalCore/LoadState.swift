public enum LoadState<Value: Sendable>: Sendable {
    case idle
    case loading
    case loaded(Value)
    case empty
    case unavailable(reason: String)
    case failed(message: String)
    case refreshing(stale: Value)

    public var verifiedValue: Value? {
        switch self {
        case .loaded(let value), .refreshing(let value): value
        case .idle, .loading, .empty, .unavailable, .failed: nil
        }
    }

    public var isInitialLoading: Bool {
        if case .loading = self { return true }
        return false
    }

    public var isRefreshing: Bool {
        if case .refreshing = self { return true }
        return false
    }

    public var isUnavailable: Bool {
        if case .unavailable = self { return true }
        return false
    }

    public var failureMessage: String? {
        if case .failed(let message) = self { return message }
        return nil
    }
}
