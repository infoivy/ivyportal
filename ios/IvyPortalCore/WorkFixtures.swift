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
    case actionItems, calendar, crm, money, myEOD, setTracker, paymentCalendar, expenses, teamChat, knowledge

    public var label: String {
        switch self {
        case .actionItems: "Actions"
        case .calendar: "Calendar"
        case .crm: "CRM"
        case .money: "Money"
        case .myEOD: "My EOD"
        case .setTracker: "Set tracker"
        case .paymentCalendar: "Payments"
        case .expenses: "Expenses"
        case .teamChat: "Chat"
        case .knowledge: "Knowledge"
        }
    }
}
