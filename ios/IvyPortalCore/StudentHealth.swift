import Foundation

// Exact Swift port of the web student health score (src/lib/student-health.ts,
// 2026-08-15). Weights: EOD 35 · action items 15 · 1:1 cadence 15 · volume 15
// · placement momentum 20; payment behind −20; ghosting caps at 25. One of the
// FOUR distinct at-risk formulas — never unify them (founder rule).

public enum HealthBand: String, Sendable {
    case green, amber, red

    public var label: String {
        switch self {
        case .green: "Healthy"
        case .amber: "Watch"
        case .red: "At risk"
        }
    }
}

public struct StudentHealthResult: Sendable, Equatable {
    public let score: Int
    public let band: HealthBand
    public let reasons: [String]
    /// Days since the student's last EOD signal, when known.
    public let daysQuiet: Int?
    /// Still locked in Start Here — activity judgments do not apply yet.
    public let locked: Bool
}

public struct StudentHealthInputs: Sendable {
    public var status: String
    public var phase: String
    public var paymentState: String?
    /// yyyy-MM-dd report days, any order.
    public var eodDates: [String]
    public var roleplays14: Int
    public var looms14: Int
    public var apps14: Int
    public var overdueItems: Int
    public var openItems: Int
    /// yyyy-MM-dd of the last completed 1-on-1, if any.
    public var lastCallDate: String?
    /// Group-program students (0) are never judged on 1:1s.
    public var callsAllotted: Int
    public var placementStages: [String]
    public var placementActivity14: Bool
    public var interviewUpcoming: Bool
    public var eodExempt: Bool
    public var locked: Bool

    public init(status: String, phase: String, paymentState: String? = nil, eodDates: [String] = [],
                roleplays14: Int = 0, looms14: Int = 0, apps14: Int = 0,
                overdueItems: Int = 0, openItems: Int = 0, lastCallDate: String? = nil,
                callsAllotted: Int = 0, placementStages: [String] = [],
                placementActivity14: Bool = false, interviewUpcoming: Bool = false,
                eodExempt: Bool = false, locked: Bool = false) {
        self.status = status
        self.phase = phase
        self.paymentState = paymentState
        self.eodDates = eodDates
        self.roleplays14 = roleplays14
        self.looms14 = looms14
        self.apps14 = apps14
        self.overdueItems = overdueItems
        self.openItems = openItems
        self.lastCallDate = lastCallDate
        self.callsAllotted = callsAllotted
        self.placementStages = placementStages
        self.placementActivity14 = placementActivity14
        self.interviewUpcoming = interviewUpcoming
        self.eodExempt = eodExempt
        self.locked = locked
    }
}

public enum StudentHealthCalc {
    /// Local calendar day of `now` shifted back `daysBack` days (report_date
    /// is a local-day string; UTC conversion would shift near midnight).
    static func localDay(daysBack: Int, now: Date, calendar: Calendar) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = calendar.timeZone
        let date = now.addingTimeInterval(-Double(daysBack) * 86_400)
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func daysSince(_ day: String?, now: Date) -> Int? {
        guard let day, !day.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: String(day.prefix(10))) else { return nil }
        return Int(floor(now.timeIntervalSince(date) / 86_400))
    }

    public static func compute(_ i: StudentHealthInputs, now: Date = Date(), calendar: Calendar = .current) -> StudentHealthResult {
        var reasons: [String] = []

        // Locked in Start Here: nothing could have happened yet; the stuck
        // bell alert owns this population instead of a red flood.
        if i.locked {
            if i.paymentState == "behind" { reasons.append("Payment behind") }
            reasons.append("In Start Here onboarding · portal locked")
            return StudentHealthResult(score: 0, band: i.paymentState == "behind" ? .red : .amber,
                                       reasons: reasons, daysQuiet: nil, locked: true)
        }

        // Offer landed: only payment/ghosting can pull them down.
        if ["offer_won", "testimonial", "graduated"].contains(i.phase) {
            var gScore = 100
            if i.paymentState == "behind" { gScore -= 20; reasons.append("Payment behind") }
            if i.status == "ghosting" { gScore = min(gScore, 25); reasons.insert("Marked ghosting", at: 0) }
            let gBand: HealthBand = gScore >= 70 ? .green : gScore >= 40 ? .amber : .red
            return StudentHealthResult(score: gScore, band: gBand, reasons: reasons, daysQuiet: nil, locked: false)
        }

        // EOD consistency (35) — exempt students get full credit.
        let recent = i.eodDates.map { String($0.prefix(10)) }.sorted(by: >)
        let lastEodDays = recent.first.flatMap { daysSince($0, now: now) }
        var eodScore: Double
        if i.eodExempt {
            eodScore = 35
        } else {
            let cutoff14 = localDay(daysBack: 13, now: now, calendar: calendar)
            let submitted14 = Set(recent.filter { $0 >= cutoff14 }).count
            eodScore = Double(submitted14) / 14 * 25
            if lastEodDays == nil {
                eodScore = 0
                reasons.append("Never submitted an EOD")
            } else if let days = lastEodDays, days >= 5 {
                eodScore = min(eodScore, 5)
                reasons.append("No EOD in \(days) days")
            } else if let days = lastEodDays, days >= 3 {
                eodScore = min(eodScore, 12)
                reasons.append("No EOD in \(days) days")
            } else {
                eodScore += 10 // recent = full recency credit
            }
            eodScore = min(35, eodScore)
        }

        // Action items (15)
        var itemScore = 15.0
        if i.overdueItems > 0 {
            itemScore = max(0, 15 - Double(i.overdueItems) * 5)
            reasons.append("\(i.overdueItems) overdue action item\(i.overdueItems > 1 ? "s" : "")")
        }

        // 1-on-1 cadence (15) — coaching phases only, never for group students.
        var callScore = 15.0
        let callDays = daysSince(i.lastCallDate, now: now)
        if i.callsAllotted > 0, ["training", "coaching_1on1", "applying"].contains(i.phase) {
            if callDays == nil {
                callScore = 4
                reasons.append("No 1-on-1 on record")
            } else if let days = callDays, days > 14 {
                callScore = 4
                reasons.append("No 1-on-1 in \(days) days")
            } else if let days = callDays, days > 9 {
                callScore = 10
            }
        }

        // Work volume (15): 3 roleplays/day + the stage metric (3 looms/day
        // pre-approval, 5 applications/day once applying).
        var volumeScore = 15.0
        if !i.eodExempt {
            let applying = ["applying", "offer_won", "testimonial"].contains(i.phase)
            let targetRoleplays = 3.0 * 14
            let stageDone = Double(applying ? i.apps14 : i.looms14)
            let stageTarget = Double(applying ? 5 : 3) * 14
            let volumeRatio = min(1, (Double(i.roleplays14) / targetRoleplays + stageDone / stageTarget) / 2)
            volumeScore = (volumeRatio * 15).rounded()
            if volumeRatio < 0.3, let days = lastEodDays, days < 5 {
                reasons.append(applying ? "Roleplay/application volume far below target" : "Roleplay/loom volume far below target")
            }
        }

        // Placement momentum (20)
        var placementScore = 0.0
        if i.placementStages.contains("placed") { placementScore = 20 }
        else if i.interviewUpcoming { placementScore = 16 }
        else if i.placementStages.contains("trial") { placementScore = 16 }
        else if i.placementStages.contains("interviewing") { placementScore = 12 }
        else if i.placementActivity14 { placementScore = 8 }
        else if !i.placementStages.isEmpty { placementScore = 5 }
        if ["applying", "training", "coaching_1on1"].contains(i.phase), i.placementStages.isEmpty {
            reasons.append("No placement opportunities in play")
        }

        var score = Int((eodScore + itemScore + callScore + volumeScore + placementScore).rounded())

        if i.paymentState == "behind" { score -= 20; reasons.append("Payment behind") }
        if i.status == "ghosting" { score = min(score, 25); reasons.insert("Marked ghosting", at: 0) }
        score = max(0, min(100, score))

        let band: HealthBand = score >= 70 ? .green : score >= 40 ? .amber : .red
        return StudentHealthResult(score: score, band: band, reasons: reasons, daysQuiet: lastEodDays, locked: false)
    }
}
