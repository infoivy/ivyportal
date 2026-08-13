// Shared Work/CRM fixtures used by the Work hub and Performance CRM.

public enum CRMChannel: String, Hashable, Sendable {
    case phone, dm
}

public enum CRMSource: String, CaseIterable, Hashable, Sendable {
    case close, mochi

    public var channel: CRMChannel {
        switch self {
        case .close: .phone
        case .mochi: .dm
        }
    }
}

public enum MoneyInTab: String, CaseIterable, Hashable, Sendable {
    case overview, deals, paymentPlans, setters
}

public enum WorkTab: String, CaseIterable, Hashable, Sendable {
    case actionItems, calendar, crm, money
}
