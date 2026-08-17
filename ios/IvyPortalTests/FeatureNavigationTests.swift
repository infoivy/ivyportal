import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class FeatureNavigationTests: XCTestCase {
    func testLeadershipMenuIncludesOverviewPerformanceAndPayments() {
        XCTAssertEqual(
            FeatureNavigationPolicy.menuFeatures(for: [.founder]),
            [.overview, .performance, .payments, .work, .students]
        )
    }

    func testSetterMenuOmitsLeadershipFeatures() {
        XCTAssertEqual(FeatureNavigationPolicy.menuFeatures(for: [.setter]), [.overview, .work])
    }

    func testFeatureRoutesToExistingRootOrNativePaymentsSurface() {
        XCTAssertEqual(PortalFeature.overview.rootDestination, .home)
        XCTAssertEqual(PortalFeature.performance.rootDestination, .performance)
        XCTAssertNil(PortalFeature.payments.rootDestination)
    }

    func testMoneyTabsUseStableOrder() {
        // Clients + Costs folded in from the removed standalone Payments
        // screen (2026-08-14); Payouts added by Phase E2 right after
        // Overview. The chip order is part of the founder's layout.
        XCTAssertEqual(MoneyInTab.allCases, [.overview, .payouts, .deals, .paymentPlans, .setters, .clients, .costs, .expenses])
    }

    func testMetricDrilldownsExposeExpectedPresentationType() {
        XCTAssertEqual(PerformanceMetric.totalReplies.detailKind, .dailyAndTeammates)
        XCTAssertEqual(PerformanceMetric.activeHours.detailKind, .hourlyActivity)
        XCTAssertEqual(PerformanceMetric.setterReplies.detailKind, .replyPerformance)
    }
}
