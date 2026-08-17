import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class ClientPriorityTests: XCTestCase {
    private func rank(_ oneOnOne: Bool, _ phase: String?, _ pay: String? = nil, _ band: HealthBand?) -> Int {
        ClientPriority.rank(isOneOnOne: oneOnOne, phase: phase, paymentState: pay, band: band)
    }

    func testOneOnOneAtRiskLeadsEverything() {
        let stuck = rank(true, "training", nil, .red)
        XCTAssertLessThan(stuck, rank(true, "training", nil, .amber))
        XCTAssertLessThan(stuck, rank(true, "applying", nil, .green))
        XCTAssertLessThan(stuck, rank(false, "training", nil, .red))
        XCTAssertLessThan(stuck, rank(true, "offer_won", nil, .green))
    }

    func testActiveOneOnOneBeatsActiveGroup() {
        XCTAssertLessThan(rank(true, "applying", nil, .green), rank(false, "onboarding", nil, .red))
    }

    func testOfferWonDropsBelowActiveRoster() {
        // A 1:1 student who already won sits under every active student, but
        // above the group winners and the scholarship tail.
        let won = rank(true, "offer_won", nil, .green)
        XCTAssertGreaterThan(won, rank(false, "training", nil, .green))
        XCTAssertLessThan(won, rank(false, "offer_won", nil, .green))
        XCTAssertLessThan(won, rank(false, "training", "scholarship", .red))
    }

    func testLegacyGraduatedPhasesReadAsWon() {
        XCTAssertEqual(rank(true, "testimonial", nil, .green), rank(true, "offer_won", nil, .green))
        XCTAssertEqual(rank(false, "graduated", nil, .green), rank(false, "offer_won", nil, .green))
    }

    func testScholarshipIsBottomOfTheBarrel() {
        let scholar = rank(true, "training", "scholarship", .red)
        XCTAssertGreaterThan(scholar, rank(false, "offer_won", nil, .green))
        // Inside the tail the same hierarchy holds: struggling 1:1 first.
        XCTAssertLessThan(scholar, rank(false, "training", "scholarship", .red))
        XCTAssertLessThan(scholar, rank(true, "training", "scholarship", .green))
    }

    func testLegacyCoachingPhaseIsActive() {
        XCTAssertEqual(rank(true, "coaching_1on1", nil, .red), rank(true, "training", nil, .red))
    }

    func testTieBreaksWorstHealthThenName() {
        XCTAssertTrue(ClientPriority.areInIncreasingOrder(lhsRank: 0, lhsScore: 12, lhsName: "Zed",
                                                          rhsRank: 0, rhsScore: 30, rhsName: "Amy"))
        XCTAssertTrue(ClientPriority.areInIncreasingOrder(lhsRank: 0, lhsScore: 12, lhsName: "amy",
                                                          rhsRank: 0, rhsScore: 12, rhsName: "Zed"))
        // Unknown health sorts after known within the same bucket.
        XCTAssertTrue(ClientPriority.areInIncreasingOrder(lhsRank: 0, lhsScore: 40, lhsName: "Zed",
                                                          rhsRank: 0, rhsScore: nil, rhsName: "Amy"))
    }
}
