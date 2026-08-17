import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class PayoutsCalcTests: XCTestCase {
    private func date(_ iso: String) -> Date {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: iso)!
    }

    private var utc: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }

    // MARK: Period math

    func testFirstHalfPeriod() {
        let p = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        XCTAssertEqual(p.start, "2026-08-01")
        XCTAssertEqual(p.end, "2026-08-15")
        XCTAssertEqual(p.monthStart, "2026-08-01")
        XCTAssertEqual(p.monthEnd, "2026-08-31")
        XCTAssertFalse(p.isSecondHalf)
        XCTAssertEqual(p.label, "Aug 1–15, 2026")
    }

    func testSecondHalfPeriodAndMonthLength() {
        let p = PayoutPeriods.period(offset: 0, now: date("2026-02-20"), calendar: utc)
        XCTAssertEqual(p.start, "2026-02-16")
        XCTAssertEqual(p.end, "2026-02-28") // 2026 is not a leap year
        XCTAssertTrue(p.isSecondHalf)
    }

    func testOffsetsWalkAcrossMonthAndYearBoundaries() {
        let now = date("2026-01-05")
        XCTAssertEqual(PayoutPeriods.period(offset: -1, now: now, calendar: utc).start, "2025-12-16")
        XCTAssertEqual(PayoutPeriods.period(offset: -2, now: now, calendar: utc).start, "2025-12-01")
        XCTAssertEqual(PayoutPeriods.period(offset: 1, now: now, calendar: utc).start, "2026-01-16")
        XCTAssertEqual(PayoutPeriods.period(offset: 2, now: now, calendar: utc).start, "2026-02-01")
    }

    // MARK: Co-founder caps

    func testCofounderPeriodCapAppliesChronologically() {
        // $8k on the 3rd (raw $800), $4k on the 10th (raw $400): the second
        // event hits the $1,000 period cap and only $200 is granted.
        let result = CofounderCommission.capped([
            .init(date: "2026-08-10", cash: 4000),
            .init(date: "2026-08-03", cash: 8000),
        ])
        XCTAssertEqual(result.firstHalf, 1000, accuracy: 0.001)
        XCTAssertEqual(result.secondHalf, 0, accuracy: 0.001)
        XCTAssertEqual(result.raw, 1200, accuracy: 0.001)
        XCTAssertTrue(result.capped)
    }

    func testCofounderMonthCapSpansBothHalves() {
        // $1k granted in each half fills the $2k month cap; the third close
        // in the second half gets nothing.
        let result = CofounderCommission.capped([
            .init(date: "2026-08-02", cash: 10000),
            .init(date: "2026-08-20", cash: 10000),
            .init(date: "2026-08-25", cash: 5000),
        ])
        XCTAssertEqual(result.firstHalf, 1000, accuracy: 0.001)
        XCTAssertEqual(result.secondHalf, 1000, accuracy: 0.001)
        XCTAssertEqual(result.total, 2000, accuracy: 0.001)
        XCTAssertTrue(result.capped)
    }

    // MARK: Commission rules

    func testSelfSetDealPaysCloserFifteenAndNoSetterRow() {
        let deal = PayoutDeal(id: "d1", studentName: "Amina", closerId: "u1", setterId: "u1", cashCollectedUpfront: 2000, dealDate: "2026-08-05")
        let period = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        let rows = PayoutsCalc.buildRows(
            deals: [deal], payments: [], plans: [],
            profiles: ["u1": .init(id: "u1", displayName: "Haroon")],
            rates: .defaults, cofounderIds: [], period: period
        )
        XCTAssertTrue(rows.setterRows.isEmpty, "self-set carries no setter credit")
        XCTAssertEqual(rows.closerRows.count, 1)
        XCTAssertEqual(rows.closerRows[0].total, 300, accuracy: 0.001) // 15%
    }

    func testSeparateSetterGetsBaseAndCloserGetsTen() {
        let deal = PayoutDeal(id: "d1", studentName: "Amina", closerId: "closer", setterId: "setter", cashCollectedUpfront: 2000, dealDate: "2026-08-05")
        let period = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        let rows = PayoutsCalc.buildRows(
            deals: [deal], payments: [], plans: [],
            profiles: [:], rates: .defaults, cofounderIds: [], period: period
        )
        XCTAssertEqual(rows.setterRows.first?.total ?? 0, 150, accuracy: 0.001) // 7.5%
        XCTAssertEqual(rows.closerRows.first?.total ?? 0, 200, accuracy: 0.001) // 10%
    }

    func testFiveKWeekBonusAddsOnePercent() {
        // Two deals in the same Mon–Sun week totalling $5k → base becomes 8.5%.
        let deals = [
            PayoutDeal(id: "d1", studentName: "A", closerId: "c", setterId: "s", cashCollectedUpfront: 3000, dealDate: "2026-08-03"),
            PayoutDeal(id: "d2", studentName: "B", closerId: "c", setterId: "s", cashCollectedUpfront: 2000, dealDate: "2026-08-09"),
        ]
        XCTAssertEqual(PayoutsCalc.mondayOfWeek(containing: "2026-08-03"), "2026-08-03") // Monday
        XCTAssertEqual(PayoutsCalc.mondayOfWeek(containing: "2026-08-09"), "2026-08-03") // Sunday same week
        let period = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        let rows = PayoutsCalc.buildRows(deals: deals, payments: [], plans: [], profiles: [:], rates: .defaults, cofounderIds: [], period: period)
        let setter = rows.setterRows.first
        XCTAssertEqual(setter?.weekBonus, true)
        XCTAssertEqual(setter?.total ?? 0, 5000 * 0.085, accuracy: 0.001)
    }

    func testSplitWeeksDoNotEarnBonus() {
        // $5k split across two Mon–Sun weeks → no bonus.
        let deals = [
            PayoutDeal(id: "d1", studentName: "A", closerId: "c", setterId: "s", cashCollectedUpfront: 3000, dealDate: "2026-08-09"),
            PayoutDeal(id: "d2", studentName: "B", closerId: "c", setterId: "s", cashCollectedUpfront: 2000, dealDate: "2026-08-10"),
        ]
        let period = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        let rows = PayoutsCalc.buildRows(deals: deals, payments: [], plans: [], profiles: [:], rates: .defaults, cofounderIds: [], period: period)
        XCTAssertEqual(rows.setterRows.first?.weekBonus, false)
    }

    func testInstallmentPaymentPaysBothSides() {
        let plan = PayoutPlanRef(id: "p1", setterId: "s", closerId: "c", studentName: "Yusuf")
        let pay = PayoutPaymentEvent(id: "ip1", amount: 1000, paidAt: "2026-08-10T14:00:00Z", installmentId: "p1")
        let period = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        let rows = PayoutsCalc.buildRows(deals: [], payments: [pay], plans: [plan], profiles: [:], rates: .defaults, cofounderIds: [], period: period)
        XCTAssertEqual(rows.setterRows.first?.total ?? 0, 75, accuracy: 0.001)   // 7.5%
        XCTAssertEqual(rows.closerRows.first?.total ?? 0, 100, accuracy: 0.001)  // 10% (not self-set)
    }

    func testPaymentOutsideHalfIsExcluded() {
        let plan = PayoutPlanRef(id: "p1", setterId: nil, closerId: "c", studentName: "Yusuf")
        let pay = PayoutPaymentEvent(id: "ip1", amount: 1000, paidAt: "2026-08-20T14:00:00Z", installmentId: "p1")
        let firstHalf = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        let rows = PayoutsCalc.buildRows(deals: [], payments: [pay], plans: [plan], profiles: [:], rates: .defaults, cofounderIds: [], period: firstHalf)
        XCTAssertTrue(rows.closerRows.isEmpty)
        XCTAssertTrue(rows.periodPayments.isEmpty)
    }

    // MARK: Base pay

    func testBasePayDayClampsToMonthLength() {
        let profile = PayoutProfileInfo(id: "u", displayName: "CSM", basePayMonthly: 500, basePayDay: 31)
        XCTAssertEqual(PayoutsCalc.basePayDate(for: profile, monthStart: "2026-02-01"), "2026-02-28")
    }

    func testBasePayNeedsAFullMonthWorked() {
        // Started June 30 → first payment July 30 (founder rule).
        let profile = PayoutProfileInfo(id: "u", displayName: "CSM", basePayMonthly: 500, basePayDay: 30, startedOn: "2026-06-30")
        XCTAssertFalse(PayoutsCalc.basePayEligible(profile, on: "2026-06-30"))
        XCTAssertFalse(PayoutsCalc.basePayEligible(profile, on: "2026-07-29"))
        XCTAssertTrue(PayoutsCalc.basePayEligible(profile, on: "2026-07-30"))
    }

    func testBasePayLandsOnlyInTheHalfContainingTheDay() {
        let profile = PayoutProfileInfo(id: "u", displayName: "CSM", basePayMonthly: 500, basePayDay: 20, startedOn: "2026-05-20")
        let firstHalf = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        let secondHalf = PayoutPeriods.period(offset: 1, now: date("2026-08-14"), calendar: utc)
        let empty = PayoutRows(setterRows: [], closerRows: [], periodDeals: [], periodPayments: [])
        let first = PayoutsCalc.memberTotals(rows: empty, profiles: ["u": profile], period: firstHalf)
        let second = PayoutsCalc.memberTotals(rows: empty, profiles: ["u": profile], period: secondHalf)
        XCTAssertTrue(first.isEmpty)
        XCTAssertEqual(second.first?.basePay ?? 0, 500, accuracy: 0.001)
        XCTAssertEqual(second.first?.total ?? 0, 500, accuracy: 0.001)
    }

    // MARK: Member totals + adjustments

    func testAdjustmentsAddSignedLinesToTotals() {
        let period = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        let deal = PayoutDeal(id: "d1", studentName: "A", closerId: "c", setterId: nil, cashCollectedUpfront: 1000, dealDate: "2026-08-05")
        let rows = PayoutsCalc.buildRows(deals: [deal], payments: [], plans: [], profiles: [:], rates: .defaults, cofounderIds: [], period: period)
        let adj = PayoutAdjustmentEntry(id: "a1", userId: "c", periodStart: period.start, amount: -40, note: "Wise fee correction", createdAt: "2026-08-12T09:00:00Z")
        let other = PayoutAdjustmentEntry(id: "a2", userId: "c", periodStart: "2026-07-16", amount: 500, note: "wrong period", createdAt: "2026-08-12T09:00:00Z")
        let owed = PayoutsCalc.memberTotals(rows: rows, profiles: [:], period: period, adjustments: [adj, other])
        XCTAssertEqual(owed.count, 1)
        XCTAssertEqual(owed[0].commission, 100, accuracy: 0.001)
        XCTAssertEqual(owed[0].adjustment, -40, accuracy: 0.001)
        XCTAssertEqual(owed[0].total, 60, accuracy: 0.001)
        XCTAssertEqual(owed[0].adjustmentLines.count, 1)
    }

    func testCofounderRowUsesCappedSliceInTotals() {
        let period = PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
        // $30k self-set close: raw 10% = $3k, but the period cap holds it at $1k.
        let deal = PayoutDeal(id: "d1", studentName: "A", closerId: "cof", setterId: "cof", cashCollectedUpfront: 30000, dealDate: "2026-08-05")
        let rows = PayoutsCalc.buildRows(deals: [deal], payments: [], plans: [], profiles: [:], rates: .defaults, cofounderIds: ["cof"], period: period)
        XCTAssertEqual(rows.closerRows.first?.total ?? 0, 1000, accuracy: 0.001)
        XCTAssertNotNil(rows.closerRows.first?.capNote)
        let owed = PayoutsCalc.memberTotals(rows: rows, profiles: [:], period: period)
        XCTAssertEqual(owed.first?.total ?? 0, 1000, accuracy: 0.001)
    }
}
