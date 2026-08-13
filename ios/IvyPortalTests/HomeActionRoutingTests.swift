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

    func testSalesTilesRouteIntoWorkTabs() {
        XCTAssertEqual(HomeAction.openSalesCalendar.workTab, .calendar)
        XCTAssertEqual(HomeAction.openSalesCRM.workTab, .crm)
        XCTAssertEqual(HomeAction.openSalesRevenue.workTab, .money)
    }

    func testMoneyStripAndCardRouteIntoWork() {
        XCTAssertEqual(HomeAction.openMoneyStrip.workTab, .expenses)
        XCTAssertEqual(HomeAction.openCards.workTab, .expenses)
        XCTAssertEqual(HomeAction.openPayouts.workTab, .money)
    }

    func testFulfillmentTilesRouteIntoCustomers() {
        XCTAssertEqual(HomeAction.openStudents.destination, .customers)
        XCTAssertEqual(HomeAction.openStudentSuccess.destination, .customers)
        XCTAssertEqual(HomeAction.openCSM.destination, .customers)
        XCTAssertEqual(HomeAction.openTestimonials.destination, .customers)
        XCTAssertEqual(HomeAction.openCalls.destination, .customers)
    }

    func testUpcomingEventUsesDetailInsteadOfChangingTab() {
        XCTAssertNil(HomeAction.openUpcoming.destination)
        XCTAssertEqual(HomeAction.openUpcoming.detail, .upcomingEvent)
    }
}
