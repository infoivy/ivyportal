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
    case openMyEOD            // submit today's EOD (personal picture)
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
    case openStudentSuccess   // student EODs today / CSM overview
    case openAtRisk           // at-risk tiles land on the roster's At-risk filter
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
        case .reviewOverdue, .openMyEOD:
            return .work
        case .reviewCoverage, .openSalesPerformance:
            return .performance
        case .openUpcoming:
            return nil
        case .openSalesCalendar:
            return .work
        // Money surfaces present the leader-only Payments sheet over Home
        // (founder-directed 2026-08-14: money moved out of the Work hub).
        case .openMoneyStrip, .openPayouts, .openCards,
             .openSalesRevenue, .openLeadershipPayments, .openSalesCRM:
            return nil
        case .openStudents, .openStudentSuccess, .openCSM, .openAtRisk,
             .openTestimonials, .openCalls,
             .openLeadershipStudents, .openLeadershipCalls, .openLeadershipTestimonials:
            return .customers
        }
    }

    /// Secondary routing inside a destination (Work tab / Clients tab / detail sheet).
    public var workTab: WorkTab? {
        switch self {
        case .reviewOverdue: return .actionItems
        case .openMyEOD: return .myEOD
        case .openUpcoming, .openSalesCalendar: return .calendar
        default: return nil
        }
    }

    /// Which Clients section a fulfillment tile lands on — tiles route to the
    /// section they describe, never dumping the member on the default tab.
    public var clientsTab: CSMTab? {
        switch self {
        case .openStudents, .openLeadershipStudents, .openAtRisk: return .students
        case .openStudentSuccess, .openCSM: return .csm
        case .openCalls, .openLeadershipCalls: return .oneOnOne
        case .openTestimonials, .openLeadershipTestimonials: return .testimonials
        default: return nil
        }
    }

    /// Money tiles open the leader-only Payments sheet instead of a Work tab.
    public var opensPayments: Bool {
        switch self {
        case .openMoneyStrip, .openPayouts, .openCards,
             .openSalesRevenue, .openLeadershipPayments, .openSalesCRM:
            return true
        default:
            return false
        }
    }

    /// Which Payments-sheet tab a money tile lands on: the payouts tile goes
    /// straight to Payouts, revenue tiles to Deals, installment tiles to Plans.
    public var moneyTab: MoneyInTab? {
        switch self {
        case .openPayouts: return .payouts
        case .openSalesRevenue: return .deals
        case .openLeadershipPayments: return .paymentPlans
        case .openMoneyStrip, .openCards, .openSalesCRM: return .overview
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
