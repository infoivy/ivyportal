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
            [.overview, .performance, .payments]
        )
    }

    func testSetterMenuOmitsLeadershipFeatures() {
        XCTAssertEqual(FeatureNavigationPolicy.menuFeatures(for: [.setter]), [.overview])
    }

    func testFeatureRoutesToExistingRootOrNativePaymentsSurface() {
        XCTAssertEqual(PortalFeature.overview.rootDestination, .home)
        XCTAssertEqual(PortalFeature.performance.rootDestination, .performance)
        XCTAssertNil(PortalFeature.payments.rootDestination)
    }

    func testPaymentsTabsUseStableOrder() {
        XCTAssertEqual(PaymentsTab.allCases, [.overview, .clients, .costs])
    }

    func testMetricDrilldownsExposeExpectedPresentationType() {
        XCTAssertEqual(PerformanceMetric.totalReplies.detailKind, .dailyAndTeammates)
        XCTAssertEqual(PerformanceMetric.activeHours.detailKind, .hourlyActivity)
        XCTAssertEqual(PerformanceMetric.setterReplies.detailKind, .replyPerformance)
    }
}
