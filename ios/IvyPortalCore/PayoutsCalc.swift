import Foundation

// Exact Swift port of the web payout math (src/lib/payout-period.ts,
// payouts-calc.ts, revenue.ts — commit-of-record 2026-08-14). Business rules
// are founder-locked: any change here must mirror a web change, never lead it.

// MARK: - Semi-monthly periods

/// One pay period: 1st–15th or 16th–end of month. `monthStart/monthEnd` span
/// the whole calendar month because the co-founder caps need both halves.
public struct PayoutPeriod: Equatable, Sendable {
    public let start: String       // yyyy-MM-dd
    public let end: String
    public let monthStart: String
    public let monthEnd: String
    public let label: String       // "Aug 1–15, 2026"
    public let isSecondHalf: Bool

    public init(start: String, end: String, monthStart: String, monthEnd: String, label: String, isSecondHalf: Bool) {
        self.start = start
        self.end = end
        self.monthStart = monthStart
        self.monthEnd = monthEnd
        self.label = label
        self.isSecondHalf = isSecondHalf
    }
}

public enum PayoutPeriods {
    /// Commissions before Jul 16–31 2026 were paid outside the portal
    /// (founder-declared 2026-07-29): alerts never look earlier than this.
    public static let trackingFrom = "2026-07-16"

    private static let monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    /// Mirror of web `getPeriod(offset)`: halves are indexed absolutely
    /// (monthIndex × 2 + half) so offsets walk cleanly across month and year
    /// boundaries.
    public static func period(offset: Int = 0, now: Date = Date(), calendar: Calendar = .current) -> PayoutPeriod {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = calendar.timeZone
        let comps = cal.dateComponents([.year, .month, .day], from: now)
        let year = comps.year ?? 2026
        let month0 = (comps.month ?? 1) - 1
        let day = comps.day ?? 1

        let half = (year * 12 + month0) * 2 + (day <= 15 ? 0 : 1) + offset
        let monthAbs = half >= 0 ? half / 2 : (half - 1) / 2 // floored division
        let second = ((half % 2) + 2) % 2 != 0
        let y = monthAbs >= 0 ? monthAbs / 12 : (monthAbs - 11) / 12
        let m0 = ((monthAbs % 12) + 12) % 12
        let lastDay = daysInMonth(year: y, month0: m0)
        let startD = second ? 16 : 1
        let endD = second ? lastDay : 15
        let pad = { (n: Int) in String(format: "%02d", n) }
        return PayoutPeriod(
            start: "\(y)-\(pad(m0 + 1))-\(pad(startD))",
            end: "\(y)-\(pad(m0 + 1))-\(pad(endD))",
            monthStart: "\(y)-\(pad(m0 + 1))-01",
            monthEnd: "\(y)-\(pad(m0 + 1))-\(pad(lastDay))",
            label: "\(monthShort[m0]) \(startD)–\(endD), \(y)",
            isSecondHalf: second
        )
    }

    public static func daysInMonth(year: Int, month0: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let date = cal.date(from: DateComponents(year: year, month: month0 + 1, day: 1))!
        return cal.range(of: .day, in: .month, for: date)?.count ?? 30
    }

    /// Local yyyy-MM-dd, the web's `todayLocal()`.
    public static func todayLocal(now: Date = Date(), calendar: Calendar = .current) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = calendar.timeZone
        let c = cal.dateComponents([.year, .month, .day], from: now)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}

// MARK: - Inputs

public struct PayoutDeal: Sendable, Equatable {
    public let id: String
    public let studentName: String
    public let closerId: String?
    public let setterId: String?
    public let cashCollectedUpfront: Double
    public let dealDate: String // yyyy-MM-dd

    public init(id: String, studentName: String, closerId: String?, setterId: String?, cashCollectedUpfront: Double, dealDate: String) {
        self.id = id
        self.studentName = studentName
        self.closerId = closerId
        self.setterId = setterId
        self.cashCollectedUpfront = cashCollectedUpfront
        self.dealDate = dealDate
    }

    /// "Set + close" ONLY when the same person did both (web `isSelfSet`).
    public var isSelfSet: Bool { setterId != nil && setterId == closerId }
}

public struct PayoutPaymentEvent: Sendable, Equatable {
    public let id: String
    public let amount: Double
    public let paidAt: String? // ISO timestamp; day = prefix(10)
    public let installmentId: String

    public init(id: String, amount: Double, paidAt: String?, installmentId: String) {
        self.id = id
        self.amount = amount
        self.paidAt = paidAt
        self.installmentId = installmentId
    }

    public var paidDay: String { String((paidAt ?? "").prefix(10)) }
}

public struct PayoutPlanRef: Sendable, Equatable {
    public let id: String
    public let setterId: String?
    public let closerId: String?
    public let studentName: String

    public init(id: String, setterId: String?, closerId: String?, studentName: String) {
        self.id = id
        self.setterId = setterId
        self.closerId = closerId
        self.studentName = studentName
    }
}

public struct PayoutProfileInfo: Sendable, Equatable {
    public let id: String
    public let displayName: String
    public let commissionCapPct: Double?
    public let basePayMonthly: Double?
    public let basePayDay: Int?
    public let startedOn: String? // yyyy-MM-dd

    public init(id: String, displayName: String, commissionCapPct: Double? = nil, basePayMonthly: Double? = nil, basePayDay: Int? = nil, startedOn: String? = nil) {
        self.id = id
        self.displayName = displayName
        self.commissionCapPct = commissionCapPct
        self.basePayMonthly = basePayMonthly
        self.basePayDay = basePayDay
        self.startedOn = startedOn
    }
}

public struct CommissionRateSet: Sendable, Equatable {
    public var newClose: Double
    public var setClose: Double
    public var setterBase: Double

    public init(newClose: Double = 0.10, setClose: Double = 0.15, setterBase: Double = 0.075) {
        self.newClose = newClose
        self.setClose = setClose
        self.setterBase = setterBase
    }

    public static let defaults = CommissionRateSet()

    /// Apply a `commission_rates` table row (key, rate) over the defaults.
    public mutating func apply(key: String, rate: Double) {
        switch key {
        case "new_close": newClose = rate
        case "set_close": setClose = rate
        case "setter_base": setterBase = rate
        default: break
        }
    }
}

public struct PayoutAdjustmentEntry: Sendable, Equatable {
    public let id: String
    public let userId: String
    public let periodStart: String
    public let amount: Double
    public let note: String
    public let createdAt: String

    public init(id: String, userId: String, periodStart: String, amount: Double, note: String, createdAt: String) {
        self.id = id
        self.userId = userId
        self.periodStart = periodStart
        self.amount = amount
        self.note = note
        self.createdAt = createdAt
    }
}

// MARK: - Outputs

public struct PayoutLine: Sendable, Equatable, Identifiable {
    public enum Kind: Sendable { case deal, installment, adjustment }
    public let kind: Kind
    public let refId: String
    public let student: String
    public let date: String
    public let detail: String
    public let cash: Double
    public let rate: Double?
    public let commission: Double?

    public var id: String { refId }
}

public struct SetterPayoutRow: Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let deals: Int
    public let cash: Double
    public let commission: Double
    public let weekBonus: Bool
    public let installmentCash: Double
    public let installmentCommission: Double
    public let total: Double
    public let lines: [PayoutLine]
}

public struct CloserPayoutRow: Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let deals: Int
    public let cash: Double
    public let commission: Double
    public let installmentCash: Double
    public let installmentCommission: Double
    public let total: Double
    public let capNote: String?
    public let lines: [PayoutLine]
}

public struct OwedMember: Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public var commission: Double
    public var basePay: Double
    public var adjustment: Double
    public var adjustmentLines: [PayoutLine]
    public var total: Double
}

public struct PayoutRows: Sendable {
    public let setterRows: [SetterPayoutRow]
    public let closerRows: [CloserPayoutRow]
    public let periodDeals: [PayoutDeal]
    public let periodPayments: [PayoutPaymentEvent]
}

// MARK: - Co-founder caps (payouts-calc.ts)

public enum CofounderCommission {
    public static let rate = 0.10
    public static let periodCap = 1000.0
    public static let monthCap = 2000.0

    public struct CappedResult: Equatable, Sendable {
        public let total: Double
        public let firstHalf: Double
        public let secondHalf: Double
        public let raw: Double
        public let capped: Bool
    }

    public struct Event: Equatable, Sendable {
        public let date: String
        public let cash: Double
        public init(date: String, cash: Double) {
            self.date = date
            self.cash = cash
        }
    }

    /// Apply the per-period + monthly caps chronologically over one month.
    public static func capped(_ events: [Event]) -> CappedResult {
        let sorted = events.sorted { $0.date < $1.date }
        var monthUsed = 0.0, firstHalf = 0.0, secondHalf = 0.0, raw = 0.0
        for ev in sorted {
            let r = ev.cash * rate
            raw += r
            let dayField = ev.date.count >= 10 ? Int(ev.date[ev.date.index(ev.date.startIndex, offsetBy: 8)..<ev.date.index(ev.date.startIndex, offsetBy: 10)]) ?? 1 : 1
            let inFirstHalf = dayField <= 15
            let periodUsed = inFirstHalf ? firstHalf : secondHalf
            let granted = max(0, min(r, periodCap - periodUsed, monthCap - monthUsed))
            monthUsed += granted
            if inFirstHalf { firstHalf += granted } else { secondHalf += granted }
        }
        return CappedResult(total: monthUsed, firstHalf: firstHalf, secondHalf: secondHalf, raw: raw, capped: monthUsed < raw)
    }
}

// MARK: - The one payout computation (payout-period.ts)

public enum PayoutsCalc {
    /// Closer commission for one deal (web `commissionForDeal`): 15% only when
    /// self-set, 10% otherwise, per-profile cap applied on top.
    public static func closerCommission(for deal: PayoutDeal, rates: CommissionRateSet, capPct: Double?) -> Double {
        let baseRate = deal.isSelfSet ? rates.setClose : rates.newClose
        let rate = capPct.map { min(baseRate, $0) } ?? baseRate
        return deal.cashCollectedUpfront * rate
    }

    /// Setters who earned the +1% $5k Mon–Sun week bonus in the deal list.
    public static func setterWeekBonusIds(_ deals: [PayoutDeal]) -> Set<String> {
        var weekTotals: [String: Double] = [:]
        for d in deals {
            guard let setter = d.setterId, !d.isSelfSet else { continue }
            let key = "\(setter)::\(mondayOfWeek(containing: d.dealDate))"
            weekTotals[key, default: 0] += d.cashCollectedUpfront
        }
        var ids: Set<String> = []
        for (key, total) in weekTotals where total >= 5000 {
            ids.insert(String(key.split(separator: ":").first ?? ""))
        }
        return ids
    }

    /// Monday (yyyy-MM-dd) of the Mon–Sun week containing the given day.
    /// Fixed UTC calendar: grouping must not shift with the device timezone.
    public static func mondayOfWeek(containing day: String) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = cal.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: day) else { return day }
        let weekday = cal.component(.weekday, from: date) // 1 Sun … 7 Sat
        let sinceMonday = (weekday + 5) % 7
        let monday = cal.date(byAdding: .day, value: -sinceMonday, to: date) ?? date
        return formatter.string(from: monday)
    }

    /// Web `buildPayoutRows`: data spans the whole month, rows scope to the
    /// period half. Same shapes, same exclusions, same sort.
    public static func buildRows(
        deals: [PayoutDeal],
        payments: [PayoutPaymentEvent],
        plans: [PayoutPlanRef],
        profiles: [String: PayoutProfileInfo],
        rates: CommissionRateSet,
        cofounderIds: Set<String>,
        period: PayoutPeriod
    ) -> PayoutRows {
        var planById: [String: PayoutPlanRef] = [:]
        for p in plans { planById[p.id] = p }

        let periodDeals = deals.filter { $0.dealDate >= period.start && $0.dealDate <= period.end }
        let periodPayments = payments.filter { $0.paidDay >= period.start && $0.paidDay <= period.end }
        let name = { (id: String) in profiles[id]?.displayName ?? String(id.prefix(8)) }

        // Setter rows — self-set carries no setter credit (closer's 15% covers it).
        let weekBonusIds = setterWeekBonusIds(periodDeals)
        var setterDeals: [String: [PayoutDeal]] = [:]
        for d in periodDeals {
            guard let setter = d.setterId, !d.isSelfSet else { continue }
            setterDeals[setter, default: []].append(d)
        }
        var setterInstPays: [String: [(PayoutPaymentEvent, PayoutPlanRef)]] = [:]
        for ip in periodPayments {
            guard let plan = planById[ip.installmentId], let setter = plan.setterId, setter != plan.closerId else { continue }
            setterInstPays[setter, default: []].append((ip, plan))
        }
        let setterRows = Set(setterDeals.keys).union(setterInstPays.keys).map { sid -> SetterPayoutRow in
            let myDeals = setterDeals[sid] ?? []
            let dealsCash = myDeals.reduce(0) { $0 + $1.cashCollectedUpfront }
            let weekBonus = weekBonusIds.contains(sid)
            let baseRate = rates.setterBase + (weekBonus ? 0.01 : 0)
            let iPays = setterInstPays[sid] ?? []
            let iCash = iPays.reduce(0) { $0 + $1.0.amount }
            let lines: [PayoutLine] = (
                myDeals.map { d in
                    PayoutLine(kind: .deal, refId: d.id, student: d.studentName, date: d.dealDate, detail: "deal upfront",
                               cash: d.cashCollectedUpfront, rate: baseRate, commission: d.cashCollectedUpfront * baseRate)
                } + iPays.map { ip, plan in
                    PayoutLine(kind: .installment, refId: ip.id, student: plan.studentName, date: ip.paidDay, detail: "installment marked paid",
                               cash: ip.amount, rate: baseRate, commission: ip.amount * baseRate)
                }
            ).sorted { $0.date < $1.date }
            return SetterPayoutRow(
                id: sid, name: name(sid), deals: myDeals.count, cash: dealsCash,
                commission: dealsCash * baseRate, weekBonus: weekBonus,
                installmentCash: iCash, installmentCommission: iCash * baseRate,
                total: dealsCash * baseRate + iCash * baseRate, lines: lines
            )
        }.sorted { $0.total > $1.total }

        // Closer rows
        var closerDeals: [String: [PayoutDeal]] = [:]
        for d in periodDeals {
            guard let closer = d.closerId else { continue }
            closerDeals[closer, default: []].append(d)
        }
        var closerInstPays: [String: [(PayoutPaymentEvent, PayoutPlanRef)]] = [:]
        var closerSelfSetInstallment: Set<String> = []
        for ip in periodPayments {
            guard let plan = planById[ip.installmentId], let closer = plan.closerId else { continue }
            closerInstPays[closer, default: []].append((ip, plan))
            if let setter = plan.setterId, setter == closer { closerSelfSetInstallment.insert(closer) }
        }

        // Co-founder caps run over the WHOLE month so each half shows its slice.
        var cofounderEvents: [String: [CofounderCommission.Event]] = [:]
        for d in deals {
            guard let closer = d.closerId, cofounderIds.contains(closer) else { continue }
            cofounderEvents[closer, default: []].append(.init(date: d.dealDate, cash: d.cashCollectedUpfront))
        }
        for ip in payments {
            guard let plan = planById[ip.installmentId], let closer = plan.closerId,
                  cofounderIds.contains(closer), ip.paidAt != nil else { continue }
            cofounderEvents[closer, default: []].append(.init(date: ip.paidDay, cash: ip.amount))
        }

        let closerRows = Set(closerDeals.keys).union(closerInstPays.keys).map { cid -> CloserPayoutRow in
            let profile = profiles[cid]
            let myDeals = closerDeals[cid] ?? []
            let dealsCash = myDeals.reduce(0) { $0 + $1.cashCollectedUpfront }
            let iPays = closerInstPays[cid] ?? []
            let iCash = iPays.reduce(0) { $0 + $1.0.amount }

            if cofounderIds.contains(cid) {
                let capped = CofounderCommission.capped(cofounderEvents[cid] ?? [])
                let owed = period.isSecondHalf ? capped.secondHalf : capped.firstHalf
                let lines: [PayoutLine] = (
                    myDeals.map { d in
                        PayoutLine(kind: .deal, refId: d.id, student: d.studentName, date: d.dealDate, detail: "deal upfront",
                                   cash: d.cashCollectedUpfront, rate: CofounderCommission.rate, commission: nil)
                    } + iPays.map { ip, plan in
                        PayoutLine(kind: .installment, refId: ip.id, student: plan.studentName, date: ip.paidDay, detail: "installment marked paid",
                                   cash: ip.amount, rate: CofounderCommission.rate, commission: nil)
                    }
                ).sorted { $0.date < $1.date }
                let capNote = "co-founder · 10% flat · capped $1k per payout period · $2k/mo" + (capped.capped ? " · cap hit" : "")
                return CloserPayoutRow(
                    id: cid, name: name(cid), deals: myDeals.count, cash: dealsCash,
                    commission: owed, installmentCash: iCash, installmentCommission: 0,
                    total: owed, capNote: capNote, lines: lines
                )
            }

            let dealCommission = myDeals.reduce(0) { $0 + closerCommission(for: $1, rates: rates, capPct: profile?.commissionCapPct) }
            let iBaseRate = closerSelfSetInstallment.contains(cid) ? rates.setClose : rates.newClose
            let iRate = profile?.commissionCapPct.map { min(iBaseRate, $0) } ?? iBaseRate
            let lines: [PayoutLine] = (
                myDeals.map { d in
                    let comm = closerCommission(for: d, rates: rates, capPct: profile?.commissionCapPct)
                    return PayoutLine(kind: .deal, refId: d.id, student: d.studentName, date: d.dealDate,
                                      detail: d.isSelfSet ? "deal upfront · set + close" : "deal upfront",
                                      cash: d.cashCollectedUpfront,
                                      rate: d.cashCollectedUpfront > 0 ? comm / d.cashCollectedUpfront : nil,
                                      commission: comm)
                } + iPays.map { ip, plan in
                    PayoutLine(kind: .installment, refId: ip.id, student: plan.studentName, date: ip.paidDay, detail: "installment marked paid",
                               cash: ip.amount, rate: iRate, commission: ip.amount * iRate)
                }
            ).sorted { $0.date < $1.date }
            return CloserPayoutRow(
                id: cid, name: name(cid), deals: myDeals.count, cash: dealsCash,
                commission: dealCommission, installmentCash: iCash, installmentCommission: iCash * iRate,
                total: dealCommission + iCash * iRate, capNote: nil, lines: lines
            )
        }.sorted { $0.total > $1.total }

        return PayoutRows(setterRows: setterRows, closerRows: closerRows, periodDeals: periodDeals, periodPayments: periodPayments)
    }

    /// A member's base pay lands once a month on their own day (anchored to
    /// their start date), clamped to the month's length.
    public static func basePayDate(for profile: PayoutProfileInfo, monthStart: String) -> String {
        let parts = monthStart.split(separator: "-").compactMap { Int($0) }
        guard parts.count >= 2 else { return monthStart }
        let daysInMonth = PayoutPeriods.daysInMonth(year: parts[0], month0: parts[1] - 1)
        let day = min(max(profile.basePayDay ?? 1, 1), daysInMonth)
        return "\(monthStart.prefix(7))-\(String(format: "%02d", day))"
    }

    /// Base pay is owed only after a FULL month worked (started June 30 →
    /// first payment July 30). Without a start date it is always eligible.
    public static func basePayEligible(_ profile: PayoutProfileInfo, on payDate: String) -> Bool {
        guard let startedOn = profile.startedOn else { return true }
        let parts = startedOn.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return true }
        var year = parts[0]
        var month0 = parts[1] - 1 + 1 // next month
        if month0 > 11 { month0 -= 12; year += 1 }
        let clampedDay = min(parts[2], PayoutPeriods.daysInMonth(year: year, month0: month0))
        let firstIso = String(format: "%04d-%02d-%02d", year, month0 + 1, clampedDay)
        return payDate >= firstIso
    }

    /// Web `memberPayoutTotals`: commissions + base pay landing in the period
    /// + signed adjustments. This is the unit one payout confirmation covers.
    public static func memberTotals(
        rows: PayoutRows,
        profiles: [String: PayoutProfileInfo],
        period: PayoutPeriod,
        adjustments: [PayoutAdjustmentEntry] = []
    ) -> [OwedMember] {
        var map: [String: OwedMember] = [:]
        let blank = { (id: String, name: String) in
            OwedMember(id: id, name: name, commission: 0, basePay: 0, adjustment: 0, adjustmentLines: [], total: 0)
        }
        let bump = { (id: String, name: String, commission: Double) in
            var cur = map[id] ?? blank(id, name)
            cur.commission += commission
            map[id] = cur
        }
        for r in rows.setterRows { bump(r.id, r.name, r.total) }
        for r in rows.closerRows { bump(r.id, r.name, r.total) }
        for p in profiles.values {
            guard (p.basePayMonthly ?? 0) > 0 else { continue }
            let payDate = basePayDate(for: p, monthStart: period.monthStart)
            guard payDate >= period.start, payDate <= period.end else { continue }
            guard basePayEligible(p, on: payDate) else { continue }
            var cur = map[p.id] ?? blank(p.id, p.displayName)
            cur.basePay = p.basePayMonthly ?? 0
            map[p.id] = cur
        }
        for a in adjustments where a.periodStart == period.start {
            let memberName = profiles[a.userId]?.displayName ?? String(a.userId.prefix(8))
            var cur = map[a.userId] ?? blank(a.userId, memberName)
            cur.adjustment += a.amount
            cur.adjustmentLines.append(PayoutLine(
                kind: .adjustment, refId: a.id, student: "", date: String(a.createdAt.prefix(10)),
                detail: a.note, cash: 0, rate: nil, commission: a.amount
            ))
            map[a.userId] = cur
        }
        return map.values
            .map { m in
                var out = m
                out.total = m.commission + m.basePay + m.adjustment
                return out
            }
            .filter { abs($0.total) >= 0.01 || $0.adjustment != 0 }
            .sorted { $0.total > $1.total }
    }
}
