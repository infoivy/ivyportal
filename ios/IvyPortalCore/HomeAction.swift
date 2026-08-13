public enum HomeDetail: Equatable, Sendable {
    case upcomingEvent
}

/// Every tappable Home affordance. Each maps to a real destination; Home
/// tiles route into Work / Performance / Clients / More rather than dead-ending.
public enum HomeAction: Equatable, Sendable {
    // Command queue / personal
    case reviewOverdue
    case reviewCoverage
    case openUpcoming
    // Money strip + card tile
    case openMoneyStrip       // cash collected -> finance
    case openPayouts          // left to pay out
    case openCards            // my card
    // Sales picture (Abu Bilal)
    case openSalesCalendar    // sets this week / show rate / unclaimed
    case openSalesPerformance // volume yesterday / setter table
    case openSalesRevenue     // cash this week / closes this period
    case openSalesCRM         // pipeline in Close
    // Fulfillment picture (Faizan)
    case openStudents         // active students / stuck onboarding / new this week
    case openStudentSuccess   // at risk / EODs today
    case openCSM              // checked in today / CSM table
    case openTestimonials     // testimonials ready
    case openCalls            // 1-on-1 calls next 7 days
    // Leadership brief
    case openLeadershipStudents
    case openLeadershipCalls
    case openLeadershipPayments
    case openLeadershipTestimonials

    public var destination: RootDestination? {
        switch self {
        case .reviewOverdue:
            return .work
        case .reviewCoverage, .openSalesPerformance:
            return .performance
        case .openUpcoming:
            return nil
        case .openSalesCalendar, .openSalesCRM:
            return .work
        case .openMoneyStrip, .openPayouts, .openCards,
             .openSalesRevenue, .openLeadershipPayments:
            return .work
        case .openStudents, .openStudentSuccess, .openCSM,
             .openTestimonials, .openCalls,
             .openLeadershipStudents, .openLeadershipCalls, .openLeadershipTestimonials:
            return .customers
        }
    }

    /// Secondary routing inside a destination (Work tab / Clients tab / detail sheet).
    public var workTab: WorkTab? {
        switch self {
        case .reviewOverdue: return .actionItems
        case .openUpcoming, .openSalesCalendar: return .calendar
        case .openSalesCRM: return .crm
        case .openMoneyStrip, .openCards: return .expenses
        case .openPayouts, .openSalesRevenue, .openLeadershipPayments: return .money
        default: return nil
        }
    }

    public var detail: HomeDetail? {
        switch self {
        case .openUpcoming: return .upcomingEvent
        default: return nil
        }
    }
}
