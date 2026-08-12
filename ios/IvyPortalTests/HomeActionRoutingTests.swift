import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class HomeActionRoutingTests: XCTestCase {
    func testOverdueActionsOpenWork() {
        XCTAssertEqual(HomeAction.reviewOverdue.destination, .work)
    }

    func testLeadershipMetricsOpenPulse() {
        XCTAssertEqual(HomeAction.openCalls.destination, .performance)
        XCTAssertEqual(HomeAction.reviewCoverage.destination, .performance)
        XCTAssertNil(HomeAction.openPayments.destination)
    }

    func testUpcomingEventUsesDetailInsteadOfChangingTab() {
        XCTAssertNil(HomeAction.openUpcoming.destination)
        XCTAssertEqual(HomeAction.openUpcoming.detail, .upcomingEvent)
    }
}
