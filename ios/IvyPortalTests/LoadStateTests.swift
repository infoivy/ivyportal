import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class LoadStateTests: XCTestCase {
    func testInitialLoadingHasNoFabricatedValue() {
        let state = LoadState<Int>.loading
        XCTAssertNil(state.verifiedValue)
        XCTAssertTrue(state.isInitialLoading)
    }

    func testGenuineZeroRemainsLoadedData() {
        let state = LoadState.loaded(0)
        XCTAssertEqual(state.verifiedValue, 0)
        XCTAssertFalse(state.isUnavailable)
    }

    func testUnavailableIsDistinctFromZeroAndFailure() {
        let unavailable = LoadState<Int>.unavailable(reason: "Source has no verified answer")
        XCTAssertTrue(unavailable.isUnavailable)
        XCTAssertNil(unavailable.verifiedValue)
        XCTAssertNil(unavailable.failureMessage)
    }

    func testFailureCarriesRetryableMessageWithoutValue() {
        let state = LoadState<Int>.failed(message: "Reporting source timed out")
        XCTAssertEqual(state.failureMessage, "Reporting source timed out")
        XCTAssertNil(state.verifiedValue)
        XCTAssertFalse(state.isUnavailable)
    }

    func testRefreshRetainsLastVerifiedData() {
        let state = LoadState.refreshing(stale: 0)
        XCTAssertEqual(state.verifiedValue, 0)
        XCTAssertTrue(state.isRefreshing)
    }
}
