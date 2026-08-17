import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class HomeActionRoutingTests: XCTestCase {
    func testOverdueActionsOpenWorkActionItems() {
        XCTAssertEqual(HomeAction.reviewOverdue.destination, .work)
        XCTAssertEqual(HomeAction.reviewOverdue.workTab, .actionItems)
    }

    func testCoverageAndSalesPerformanceOpenPerformance() {
        XCTAssertEqual(HomeAction.reviewCoverage.destination, .performance)
        XCTAssertEqual(HomeAction.openSalesPerformance.destination, .performance)
    }

    func testSalesCalendarTileRoutesIntoWork() {
        XCTAssertEqual(HomeAction.openSalesCalendar.destination, .work)
        XCTAssertEqual(HomeAction.openSalesCalendar.workTab, .calendar)
    }

    func testMoneyTilesPresentThePaymentsSheet() {
        for action in [HomeAction.openMoneyStrip, .openCards, .openPayouts, .openSalesRevenue, .openSalesCRM, .openLeadershipPayments] {
            XCTAssertTrue(action.opensPayments)
            XCTAssertNil(action.destination)
            XCTAssertNil(action.workTab)
        }
        XCTAssertFalse(HomeAction.reviewOverdue.opensPayments)
    }

    func testFulfillmentTilesRouteIntoCustomers() {
        XCTAssertEqual(HomeAction.openStudents.destination, .customers)
        XCTAssertEqual(HomeAction.openStudentSuccess.destination, .customers)
        XCTAssertEqual(HomeAction.openCSM.destination, .customers)
        XCTAssertEqual(HomeAction.openTestimonials.destination, .customers)
        XCTAssertEqual(HomeAction.openCalls.destination, .customers)
        XCTAssertEqual(HomeAction.openAtRisk.destination, .customers)
    }

    /// Exact-element landing (founder 2026-08-15): every fulfillment tile
    /// opens the Clients SECTION it describes, never the default tab.
    func testFulfillmentTilesPresetTheirClientsSection() {
        XCTAssertEqual(HomeAction.openStudents.clientsTab, .students)
        XCTAssertEqual(HomeAction.openLeadershipStudents.clientsTab, .students)
        XCTAssertEqual(HomeAction.openAtRisk.clientsTab, .students)
        XCTAssertEqual(HomeAction.openStudentSuccess.clientsTab, .csm)
        XCTAssertEqual(HomeAction.openCSM.clientsTab, .csm)
        XCTAssertEqual(HomeAction.openCalls.clientsTab, .oneOnOne)
        XCTAssertEqual(HomeAction.openLeadershipCalls.clientsTab, .oneOnOne)
        XCTAssertEqual(HomeAction.openTestimonials.clientsTab, .testimonials)
        XCTAssertEqual(HomeAction.openLeadershipTestimonials.clientsTab, .testimonials)
        // Non-Clients actions never carry a Clients section.
        XCTAssertNil(HomeAction.reviewOverdue.clientsTab)
        XCTAssertNil(HomeAction.openSalesPerformance.clientsTab)
    }

    func testUpcomingEventUsesDetailInsteadOfChangingTab() {
        XCTAssertNil(HomeAction.openUpcoming.destination)
        XCTAssertEqual(HomeAction.openUpcoming.detail, .upcomingEvent)
    }

    func testMoneyTilesPresetTheirPaymentsTab() {
        XCTAssertEqual(HomeAction.openPayouts.moneyTab, .payouts)
        XCTAssertEqual(HomeAction.openSalesRevenue.moneyTab, .deals)
        XCTAssertEqual(HomeAction.openLeadershipPayments.moneyTab, .paymentPlans)
        XCTAssertEqual(HomeAction.openMoneyStrip.moneyTab, .overview)
        XCTAssertNil(HomeAction.reviewOverdue.moneyTab)
    }

    func testPayoutsTabRequiresAdminOrCofounder() {
        XCTAssertTrue(MoneyInTab.tabs(for: [.admin]).contains(.payouts))
        XCTAssertTrue(MoneyInTab.tabs(for: [.cofounder, .closer]).contains(.payouts))
        // The web /payouts page gates on admin | cofounder specifically; a
        // bare founder role does not open it there and must not here.
        XCTAssertFalse(MoneyInTab.tabs(for: [.founder]).contains(.payouts))
        XCTAssertFalse(MoneyInTab.tabs(for: [.closer]).contains(.payouts))
        XCTAssertEqual(MoneyInTab.tabs(for: [.closer]).count, MoneyInTab.allCases.count - 1)
    }
}
