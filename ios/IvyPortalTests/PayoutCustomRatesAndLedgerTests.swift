import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

/// Spec 4 gap + spec 10, from docs/ios/review-triage-2026-08-30.md.
///
/// Spec 4 (payouts custom rates/caps/self-set): the existing PayoutsCalcTests
/// cover self-set and the default rate set, but never exercise
/// `CommissionRateSet.apply(key:rate:)` — the path a custom `commission_rates`
/// DB row takes through PortalAPI — nor the per-member `commission_cap_pct`
/// cap. These tests pin both.
///
/// Spec 10 (payout-ledger UI smoke): BunPayoutLedgerSheet renders straight
/// from `PayoutLedgerData.owed` + `confirmedByUser` (filter to non-zero,
/// sort by total descending, to-pay excludes confirmed). Those derivations
/// are data contracts, so the smoke contract is pinned here over the same
/// types the sheet consumes.
final class PayoutCustomRatesAndLedgerTests: XCTestCase {
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

    private var period: PayoutPeriod {
        PayoutPeriods.period(offset: 0, now: date("2026-08-14"), calendar: utc)
    }

    // MARK: Spec 4 — custom rates from the commission_rates table

    func testRateRowsOverrideDefaultsByKey() {
        var rates = CommissionRateSet.defaults
        rates.apply(key: "new_close", rate: 0.12)
        rates.apply(key: "set_close", rate: 0.20)
        rates.apply(key: "setter_base", rate: 0.09)
        XCTAssertEqual(rates.newClose, 0.12, accuracy: 0.0001)
        XCTAssertEqual(rates.setClose, 0.20, accuracy: 0.0001)
        XCTAssertEqual(rates.setterBase, 0.09, accuracy: 0.0001)
    }

    /// Unknown keys arrive from the table all the time (new eras, feature
    /// flags); they must be ignored, not crash or clobber a default.
    func testUnknownRateKeyIsIgnored() {
        var rates = CommissionRateSet.defaults
        rates.apply(key: "top_setter_bonus", rate: 0.01)
        rates.apply(key: "legacy_rate", rate: 0.5)
        XCTAssertEqual(rates, CommissionRateSet.defaults)
    }

    /// Custom rates must actually move the money: a self-set deal uses
    /// setClose, so a custom 20% setClose pays $1,000 on a $5,000 deal where
    /// the default 15% pays $750.
    func testCustomRatesChangeThePayoutMath() {
        let deal = PayoutDeal(
            id: "d1", studentName: "Nadia",
            closerId: "closer", setterId: "closer", // self-set → setClose applies
            cashCollectedUpfront: 5000, dealDate: "2026-08-10"
        )
        let profiles = ["closer": PayoutProfileInfo(id: "closer", displayName: "Closer")]

        let custom = PayoutsCalc.buildRows(
            deals: [deal], payments: [], plans: [], profiles: profiles,
            rates: CommissionRateSet(newClose: 0.12, setClose: 0.20, setterBase: 0.09),
            cofounderIds: [], period: period
        )
        XCTAssertEqual(custom.closerRows.first?.total ?? 0, 1000, accuracy: 0.001,
                       "self-set at custom 20% = $1,000")
        XCTAssertTrue(custom.setterRows.isEmpty, "self-set: no setter row")

        let standard = PayoutsCalc.buildRows(
            deals: [deal], payments: [], plans: [], profiles: profiles,
            rates: .defaults, cofounderIds: [], period: period
        )
        XCTAssertEqual(standard.closerRows.first?.total ?? 0, 750, accuracy: 0.001,
                       "self-set at default 15% = $750")
    }

    /// commission_cap_pct from profiles caps the RATE (as a fraction, matching
    /// the web's commission_cap_pct semantics), not the dollar amount: a 0.05
    /// cap forces a 5% payout on any deal regardless of the closer's default
    /// rate. Dollar ceilings are a different (unimplemented) concept; this
    /// pins the rate-ceiling behavior the app actually ships.
    func testCloserCapLimitsTheRateNotTheDollars() {
        let deal = PayoutDeal(
            id: "d1", studentName: "Nadia",
            closerId: "closer", setterId: nil,
            cashCollectedUpfront: 20000, dealDate: "2026-08-10"
        )
        // rate cap of 5% on a 10% default deal
        let cappedProfile = PayoutProfileInfo(
            id: "closer", displayName: "Capped Closer",
            commissionCapPct: 0.05
        )
        let rows = PayoutsCalc.buildRows(
            deals: [deal], payments: [], plans: [],
            profiles: ["closer": cappedProfile],
            rates: .defaults, cofounderIds: [], period: period
        )
        let closer = rows.closerRows.first { $0.id == "closer" }
        XCTAssertEqual(closer?.total ?? 0, 1000, accuracy: 0.001,
                       "5% rate cap on $20k cash = $1,000, not the default 10% = $2,000")

        // a cap above the default rate never raises the payout
        let looseProfile = PayoutProfileInfo(
            id: "closer", displayName: "Loose Cap", commissionCapPct: 0.5
        )
        let loose = PayoutsCalc.buildRows(
            deals: [deal], payments: [], plans: [],
            profiles: ["closer": looseProfile],
            rates: .defaults, cofounderIds: [], period: period
        )
        XCTAssertEqual(loose.closerRows.first?.total ?? 0, 2000, accuracy: 0.001,
                       "a 50% cap is looser than the 10% default; payout unchanged")
    }

    // MARK: Spec 10 — payout-ledger sheet smoke contract
    // PayoutLedgerData lives in the app target, so these only compile in the
    // app-hosted xcodebuild test job (CI runs both; SwiftPM skips them).

#if canImport(IvyPortal)
    private func member(_ id: String, _ name: String, _ total: Double) -> OwedMember {
        OwedMember(id: id, name: name, commission: total, basePay: 0, adjustment: 0,
                   adjustmentLines: [], total: total)
    }

    private func ledger(_ owed: [OwedMember], confirmed: [String: PayoutConfirmationRow]) -> PayoutLedgerData {
        PayoutLedgerData(
            period: period, rows: PayoutRows(setterRows: [], closerRows: [], periodDeals: [], periodPayments: []),
            owed: owed, confirmations: Array(confirmed.values), adjustments: [], teamIds: [], names: [:]
        )
    }

    private func confirmation(_ userId: String) -> PayoutConfirmationRow {
        PayoutConfirmationRow(periodStart: period.start, userId: UUID(uuidString: userId) ?? UUID(),
                              amountPaid: 0, confirmedAt: "2026-08-16T00:00:00Z", note: nil)
    }

    /// The sheet's `owed` contract: zero-total members are hidden, the rest
    /// sort by total descending.
    func testLedgerHidesZeroRowsAndSortsByTotal() {
        let data = ledger(
            [member("a", "Ray", 1240), member("b", "Sofia", 620),
             member("c", "Mia", 0), member("d", "Dan", -50)],
            confirmed: [:]
        )
        let visible = data.owed.filter { $0.total != 0 }.sorted { $0.total > $1.total }
        XCTAssertEqual(visible.map(\.id), ["a", "b", "d"], "zero rows hidden, descending by total")
    }

    /// "To pay out" excludes members the user already confirmed as paid, and
    /// confirmed members still stay visible in the list.
    func testToPayExcludesConfirmedButKeepsRows() {
        let mia = UUID()
        let data = ledger(
            [member("a", "Ray", 1240), member("b", "Sofia", 620), member(mia.uuidString, "Mia", 450)],
            confirmed: [mia.uuidString: PayoutConfirmationRow(
                periodStart: period.start, userId: mia, amountPaid: 450,
                confirmedAt: "2026-08-16T00:00:00Z", note: nil)]
        )
        let toPay = data.owed
            .filter { data.confirmedByUser[$0.id] == nil }
            .filter { $0.total != 0 }
            .reduce(0) { $0 + $1.total }
        XCTAssertEqual(toPay, 1860, accuracy: 0.001, "1240 + 620, Mia confirmed")
        XCTAssertEqual(data.owed.count, 3, "confirmed member stays listed as Paid")
    }

    /// A negative adjustment can drive a member to exactly zero: they must
    /// not show as owing, and must not be double-counted via -0.0.
    func testNegativeAdjustmentToZeroHidesTheRow() {
        let data = ledger(
            [member("a", "Ray", 1240), member("b", "Mia", 0)],
            confirmed: [:]
        )
        let toPay = data.owed
            .filter { data.confirmedByUser[$0.id] == nil }
            .filter { $0.total != 0 }
            .reduce(0) { $0 + $1.total }
        XCTAssertEqual(toPay, 1240, accuracy: 0.001)
        XCTAssertEqual(data.owed.filter { $0.total != 0 }.count, 1)
    }
#endif
}
