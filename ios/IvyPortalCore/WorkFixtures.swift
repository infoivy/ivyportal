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
    case overview, payouts, deals, paymentPlans, setters, clients, costs, expenses

    /// Payouts mirrors the web page gate (admin or co-founder); every other
    /// tab rides the Payments sheet's own leader gating.
    public static func tabs(for roles: [PortalRole]) -> [MoneyInTab] {
        allCases.filter { $0 != .payouts || !Set(roles).isDisjoint(with: [.admin, .cofounder]) }
    }
}

/// Consolidated 2026-08-14 (founder feedback: "a million tabs"): Set tracker
/// lives inside Calendar; CRM, the redundant Payments summary, and Team chat
/// were removed; the money surface moved out of Work into the leader-only
/// Payments sheet opened from Home tiles.
public enum WorkTab: String, CaseIterable, Hashable, Sendable {
    // Order IS the chip order (founder-directed 2026-08-14: End of day first).
    case myEOD, calendar, actionItems, knowledge

    public var label: String {
        switch self {
        case .myEOD: "End of day"
        case .calendar: "Calendar"
        case .actionItems: "Actions"
        case .knowledge: "Knowledge"
        }
    }
}
