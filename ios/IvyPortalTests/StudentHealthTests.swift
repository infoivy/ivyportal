import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class StudentHealthTests: XCTestCase {
    private func date(_ iso: String) -> Date {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f.date(from: iso)!
    }

    private var utc: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }

    // Noon UTC keeps day arithmetic away from midnight edges.
    private let now = { () -> Date in
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f.date(from: "2026-08-15T12:00:00")!
    }()

    /// Every day filed for 14 days + fresh EOD + placement placed = a top score.
    func testFullyEngagedStudentIsGreen() {
        let days = (0..<14).map { StudentHealthCalc.localDay(daysBack: $0, now: now, calendar: utc) }
        let result = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "applying", eodDates: days,
            roleplays14: 42, looms14: 0, apps14: 70,
            lastCallDate: StudentHealthCalc.localDay(daysBack: 2, now: now, calendar: utc),
            callsAllotted: 10,
            placementStages: ["placed"], placementActivity14: true
        ), now: now, calendar: utc)
        XCTAssertEqual(result.score, 100)
        XCTAssertEqual(result.band, .green)
    }

    func testLockedStudentScoresZeroAmberAndSkipsActivityJudgments() {
        let result = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "onboarding", locked: true
        ), now: now, calendar: utc)
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.band, .amber)
        XCTAssertTrue(result.locked)
        XCTAssertTrue(result.reasons.contains { $0.contains("Start Here") })
    }

    func testLockedWithPaymentBehindIsRed() {
        let result = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "onboarding", paymentState: "behind", locked: true
        ), now: now, calendar: utc)
        XCTAssertEqual(result.band, .red)
    }

    func testGraduatedStudentOnlyJudgedOnPaymentAndGhosting() {
        let clean = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "offer_won"
        ), now: now, calendar: utc)
        XCTAssertEqual(clean.score, 100)
        XCTAssertTrue(clean.reasons.isEmpty)

        let behind = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "offer_won", paymentState: "behind"
        ), now: now, calendar: utc)
        XCTAssertEqual(behind.score, 80)
        XCTAssertEqual(behind.band, .green)
    }

    func testGhostingCapsAtTwentyFive() {
        let days = (0..<14).map { StudentHealthCalc.localDay(daysBack: $0, now: now, calendar: utc) }
        let result = StudentHealthCalc.compute(StudentHealthInputs(
            status: "ghosting", phase: "applying", eodDates: days,
            roleplays14: 42, apps14: 70, callsAllotted: 0,
            placementStages: ["placed"]
        ), now: now, calendar: utc)
        XCTAssertLessThanOrEqual(result.score, 25)
        XCTAssertEqual(result.band, .red)
        XCTAssertEqual(result.reasons.first, "Marked ghosting")
    }

    func testNeverSubmittedEODZeroesTheEODComponent() {
        let result = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "training", callsAllotted: 0
        ), now: now, calendar: utc)
        // 0 (eod) + 15 (items) + 15 (calls skipped for group) + 0 (volume) + 0 (placement)
        XCTAssertEqual(result.score, 30)
        XCTAssertEqual(result.band, .red)
        XCTAssertTrue(result.reasons.contains("Never submitted an EOD"))
    }

    func testStaleEODCapsRecencyAndReports() {
        let result = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "training",
            eodDates: [StudentHealthCalc.localDay(daysBack: 6, now: now, calendar: utc)],
            callsAllotted: 0
        ), now: now, calendar: utc)
        XCTAssertTrue(result.reasons.contains("No EOD in 6 days"))
        XCTAssertEqual(result.daysQuiet, 6)
    }

    func testEODExemptGetsFullEODAndVolumeCredit() {
        let result = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "training", callsAllotted: 0, eodExempt: true
        ), now: now, calendar: utc)
        // 35 + 15 + 15 + 15 + 0 placement
        XCTAssertEqual(result.score, 80)
        XCTAssertFalse(result.reasons.contains("Never submitted an EOD"))
    }

    func testGroupStudentNeverJudgedOnCalls() {
        let group = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "training", callsAllotted: 0, eodExempt: true
        ), now: now, calendar: utc)
        XCTAssertFalse(group.reasons.contains { $0.contains("1-on-1") })

        let oneOnOne = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "training", callsAllotted: 10, eodExempt: true
        ), now: now, calendar: utc)
        XCTAssertTrue(oneOnOne.reasons.contains("No 1-on-1 on record"))
        XCTAssertEqual(oneOnOne.score, group.score - 11) // 15 → 4
    }

    func testOverdueItemsSubtractFivePerItem() {
        let base = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "training", callsAllotted: 0, eodExempt: true
        ), now: now, calendar: utc)
        let overdue = StudentHealthCalc.compute(StudentHealthInputs(
            status: "active", phase: "training", overdueItems: 2, openItems: 3,
            callsAllotted: 0, eodExempt: true
        ), now: now, calendar: utc)
        XCTAssertEqual(base.score - overdue.score, 10)
        XCTAssertTrue(overdue.reasons.contains("2 overdue action items"))
    }

    func testPlacementLadder() {
        func score(stages: [String], interview: Bool = false, activity: Bool = false) -> Int {
            StudentHealthCalc.compute(StudentHealthInputs(
                status: "active", phase: "applying", callsAllotted: 0,
                placementStages: stages, placementActivity14: activity, interviewUpcoming: interview,
                eodExempt: true
            ), now: now, calendar: utc).score
        }
        let none = score(stages: [])
        XCTAssertEqual(score(stages: ["placed"]) - none, 20)
        XCTAssertEqual(score(stages: ["applied"], interview: true) - none, 16)
        XCTAssertEqual(score(stages: ["trial"]) - none, 16)
        XCTAssertEqual(score(stages: ["interviewing"]) - none, 12)
        XCTAssertEqual(score(stages: ["applied"], activity: true) - none, 8)
        XCTAssertEqual(score(stages: ["applied"]) - none, 5)
    }
}
