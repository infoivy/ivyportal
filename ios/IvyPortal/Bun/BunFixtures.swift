import Foundation
import SwiftUI

// Demo workspace for the signed-out preview (founder 2026-08-17: "add fake
// data everywhere for every single thing"). One coherent story: Acme
// Coaching, a healthy info business in August 2026. BunStore.seedFixtures()
// pours this into the store so every surface renders exactly like live.

struct BunAccount: Identifiable {
    let id = UUID()
    let name: String
    let last4: String
    let balance: Double
}

struct BunTransaction: Identifiable {
    let id = UUID()
    let counterparty: String
    let method: String        // "Deal · PIF" / "Installment 2 of 4" / "Expense · Card ••1509"
    let amount: Double        // negative = out
    let day: String           // "Aug 17, 2026"
    let tag: String?          // "Pending" / "Failed"
    let category: String?
    let avatarFill: Color
    var account: String = "Checking ••6997"
}

struct BunCard: Identifiable {
    let id = UUID()
    let holder: String
    let last4: String
    let kind: String          // "Physical Debit" / "Virtual Debit"
}

enum BunFixtures {
    static let orgName = "Acme Coaching"
    static let workspaces = ["Acme Coaching", "Acme Media"]
    static let userName = "Alex"
    static let userInitials = "AD"
    static let userFullName = "Alex Doe"
    static let userEmail = "alex@acmecoaching.com"

    static let accounts = [
        BunAccount(name: "Checking", last4: "6997", balance: 186_483.64),
        BunAccount(name: "Savings", last4: "7021", balance: 15_500.00),
    ]

    static var totalBalance: Double { accounts.reduce(0) { $0 + $1.balance } }

    static let cards = [
        BunCard(holder: "Alex's Debit Card", last4: "1509", kind: "Physical Debit"),
        BunCard(holder: "Alex's Debit Card", last4: "5121", kind: "Virtual Debit"),
    ]

    private static let softwareFill = Color(red: 0.23, green: 0.33, blue: 0.42)
    private static let clientFill = Color(red: 0.18, green: 0.38, blue: 0.32)
    private static let adsFill = Color(red: 0.27, green: 0.30, blue: 0.44)
    private static let peopleFill = Color(red: 0.42, green: 0.29, blue: 0.25)

    /// n days back, rendered the way every other surface renders a day.
    static func dayBack(_ days: Int) -> String {
        BunStore.friendlyDay(Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date())
    }

    static let transactions = [
        BunTransaction(counterparty: "Jordan Blake", method: "Deal · PIF", amount: 5_800.00, day: dayBack(1), tag: nil, category: nil, avatarFill: clientFill),
        BunTransaction(counterparty: "Marcus Reed", method: "Installment 2 of 4", amount: 550.00, day: dayBack(1), tag: nil, category: nil, avatarFill: clientFill),
        BunTransaction(counterparty: "Meta Ads", method: "Expense · Card ••1509", amount: -248.60, day: dayBack(2), tag: nil, category: "Marketing & Advertising", avatarFill: adsFill),
        BunTransaction(counterparty: "Tariq Aziz", method: "Deal · Split close", amount: 1_450.00, day: dayBack(2), tag: nil, category: nil, avatarFill: clientFill),
        BunTransaction(counterparty: "Leila Hassan", method: "Deal · PIF", amount: 2_900.00, day: dayBack(3), tag: nil, category: nil, avatarFill: clientFill),
        BunTransaction(counterparty: "Nadia Osman", method: "Installment 1 of 6", amount: 550.00, day: dayBack(3), tag: "Pending", category: nil, avatarFill: clientFill),
        BunTransaction(counterparty: "Ava Contractor Payroll", method: "Expense · Payroll", amount: -1_200.00, day: dayBack(4), tag: nil, category: "Payroll", avatarFill: peopleFill),
        BunTransaction(counterparty: "Zapier", method: "Expense · Card ••1509", amount: -96.00, day: dayBack(4), tag: nil, category: "Software", avatarFill: softwareFill),
        BunTransaction(counterparty: "Stripe Payout", method: "Deal · payout", amount: 0, day: dayBack(5), tag: "Failed", category: nil, avatarFill: softwareFill),
        BunTransaction(counterparty: "Google Workspace", method: "Expense · Card ••1509", amount: -39.99, day: dayBack(5), tag: nil, category: "Software", avatarFill: softwareFill, account: "Savings ••7021"),
        BunTransaction(counterparty: "Sami Idris", method: "Deal · PIF", amount: 4_200.00, day: dayBack(6), tag: nil, category: nil, avatarFill: clientFill),
        BunTransaction(counterparty: "Twilio", method: "Expense · Card ••1509", amount: -19.95, day: dayBack(6), tag: nil, category: "Software", avatarFill: Color(red: 0.75, green: 0.22, blue: 0.25)),
        BunTransaction(counterparty: "Render", method: "Expense · Card ••1509", amount: -44.00, day: dayBack(7), tag: nil, category: "Software", avatarFill: softwareFill),
        BunTransaction(counterparty: "Marcus Reed", method: "Installment 1 of 4", amount: 550.00, day: dayBack(8), tag: nil, category: nil, avatarFill: clientFill),
    ]

    static var transactionDays: [String] {
        var seen: Set<String> = []
        return transactions.compactMap { seen.insert($0.day).inserted ? $0.day : nil }
    }

    /// Control points for 90 days of balance: a rising wave. Cosine
    /// interpolation between them rounds every crest and trough, so the
    /// drawn line rolls like the reference chart instead of sawtoothing.
    private static let curveControls: [Double] = [
        0.06, 0.03, 0.16, 0.10, 0.06, 0.20, 0.14, 0.27, 0.19, 0.34,
        0.26, 0.41, 0.31, 0.28, 0.44, 0.36, 0.52, 0.43, 0.57, 0.50,
        0.66, 0.58, 0.74, 0.68, 0.84, 0.92,
    ]

    private static func curveValue(at position: Double) -> Double {
        let scaled = position * Double(curveControls.count - 1)
        let index = min(Int(scaled), curveControls.count - 2)
        let t = scaled - Double(index)
        let mu = (1 - cos(t * .pi)) / 2
        return curveControls[index] * (1 - mu) + curveControls[index + 1] * mu
    }

    private static let walkDeltas: [Double] = {
        let scale = 62_000.0
        let values = (0..<90).map { curveValue(at: Double($0) / 89.0) * scale }
        var previous = values[0] - 420
        return values.map { value in
            defer { previous = value }
            return value - previous
        }
    }()

    static func balanceSeries(days: Int) -> [Double] {
        let deltas = walkDeltas.suffix(days)
        let end = totalBalance
        let sum = deltas.reduce(0, +)
        var value = end - sum
        return deltas.map { value += $0; return value }
    }

    static var balanceSeries: [Double] { balanceSeries(days: 30) }

    static let monthLabel = "August 2026"
    static let monthMoneyIn = 46_250.00
    static let monthMoneySpent = -8_940.25
    static let range30In = 52_730.00
    static let range30Out = -9_410.62

    static let movementMonths: [(label: String, spent: Double)] = [
        ("May", -7_210.40), ("Jun", -8_054.90), ("Jul", -9_882.75), ("Aug", -8_940.25),
    ]
    static let movementInMonths: [(label: String, amount: Double)] = [
        ("May", 38_400.00), ("Jun", 41_900.00), ("Jul", 44_120.00), ("Aug", 46_250.00),
    ]
    static let movementSources: [(name: String, amount: Double)] = [
        ("Meta Ads", -3_720.00), ("Contractor payroll", -2_400.00),
        ("Software", -940.60), ("Amazon Web Services", -406.30),
        ("Google Workspace", -239.94), ("Twilio", -119.70),
    ]

    static let categories = [
        "Bank Fees", "Business Meals", "COGS", "Credit & Loan Payments",
        "Employee Benefits", "Entertainment", "Financing Proceeds", "Insurance",
        "Interest Earned", "Inventory & Materials", "Legal & Professional Services",
        "Marketing & Advertising", "Office Supplies & Equipment",
        "Payment Processing Fees", "Payroll", "Rent & Utilities",
    ]

    // MARK: - Seeded live-shaped data (poured into BunStore signed out)

    /// Daily collected cash, 90 days back from today.
    static func cashDays(days: Int) -> [PortalAPI.CashDay] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let deltas = walkDeltas.suffix(days)
        return deltas.enumerated().map { offset, delta in
            let date = calendar.date(byAdding: .day, value: offset - (days - 1), to: today)!
            return PortalAPI.CashDay(id: formatter.string(from: date), amount: delta)
        }
    }

    static func isoTime(hoursFromNow hours: Double) -> String {
        ISO8601DateFormatter().string(from: Date().addingTimeInterval(hours * 3600))
    }

    static var sets: [PortalAPI.SetReminderFull] {
        [
            .init(id: UUID(), prospect: "Yusuf Rahman", eventStart: isoTime(hoursFromNow: 2.5),
                  ownerId: nil, status: "booked", confirmedAt: isoTime(hoursFromNow: -3), notes: "with Ray Ortega", reminderLog: nil),
            .init(id: UUID(), prospect: "Dana Whitfield", eventStart: isoTime(hoursFromNow: 5),
                  ownerId: nil, status: "booked", confirmedAt: nil, notes: "with Ray Ortega", reminderLog: nil),
            .init(id: UUID(), prospect: "Omar Diallo", eventStart: isoTime(hoursFromNow: 26),
                  ownerId: nil, status: "booked", confirmedAt: isoTime(hoursFromNow: -1), notes: "with Alex Doe", reminderLog: nil),
            .init(id: UUID(), prospect: "Priya Nair", eventStart: isoTime(hoursFromNow: 29.5),
                  ownerId: nil, status: "booked", confirmedAt: nil, notes: "with Ray Ortega", reminderLog: nil),
        ]
    }

    /// The set nobody has claimed yet.
    static var unclaimedSets: [PortalAPI.SetReminderFull] {
        [
            .init(id: UUID(), prospect: "Hamid Farouk", eventStart: isoTime(hoursFromNow: 8),
                  ownerId: nil, status: "booked", confirmedAt: nil, notes: "needs an owner", reminderLog: nil),
        ]
    }

    /// Per-day EOD coverage for the team week strip (Mon..Sun).
    // Expected matches the six people in `teamRows` — a strip that promises
    // seven filers against a six-person roster reads as broken.
    static let teamWeek: [(day: String, filed: Int, expected: Int)] = [
        ("M", 6, 6), ("T", 5, 6), ("W", 6, 6), ("T", 4, 6),
        ("F", 5, 6), ("S", 6, 6), ("S", 5, 6),
    ]

    static let teamSummary = PerformanceSummary(callsBooked: 23, submitted: 6, missing: 1)

    static let teamRows: [TeamMemberRow] = [
        TeamMemberRow(id: UUID(), name: "Sofia Marin", role: "setter", sets: 8, eodDays: 7, booked: 8, shows: 5, closes: 0, dials: 0, dmsSent: 1840, filedToday: true, missedYesterday: false),
        TeamMemberRow(id: UUID(), name: "Danny Cole", role: "setter", sets: 6, eodDays: 6, booked: 6, shows: 4, closes: 0, dials: 640, dmsSent: 0, filedToday: true, missedYesterday: false),
        TeamMemberRow(id: UUID(), name: "Ray Ortega", role: "closer", sets: 0, eodDays: 7, booked: 9, shows: 7, closes: 4, dials: 0, dmsSent: 0, filedToday: true, missedYesterday: false),
        TeamMemberRow(id: UUID(), name: "Mia Chen", role: "csm", sets: 0, eodDays: 7, booked: 0, shows: 0, closes: 0, dials: 0, dmsSent: 0, filedToday: false, missedYesterday: false),
        TeamMemberRow(id: UUID(), name: "Ibrahim Sy", role: "setter", sets: 5, eodDays: 5, booked: 5, shows: 3, closes: 0, dials: 512, dmsSent: 260, filedToday: false, missedYesterday: true),
        TeamMemberRow(id: UUID(), name: "Grace Okafor", role: "coach", sets: 0, eodDays: 6, booked: 0, shows: 0, closes: 0, dials: 0, dmsSent: 0, filedToday: true, missedYesterday: false),
    ]

    /// What the demo team actually wrote in their EODs, so the notes surface
    /// has something honest to render signed out.
    static let teamNotes: [TeamEODNote] = {
        func day(_ back: Int) -> String {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter.string(from: Calendar.current.date(byAdding: .day, value: -back, to: Date()) ?? Date())
        }
        let written: [(Int, Int, String, String?)] = [
            (0, 0, "1,840 DMs out and 8 sets. Best day this cycle.", nil),
            (0, 1, "Hit 640 dials. Two sets booked for Thursday.", "Dialler dropped ~40 minutes mid-afternoon."),
            (0, 2, "4 closes, $18.4k in. Two were self-set.", nil),
            (0, 3, "Checked in with every red-band student.", "Two have not posted in 6 days."),
            (0, 5, "Reviewed 9 looms, 4 students moved to applying.", nil),
            (1, 0, "6 sets, ran the new opener on every conversation.", "Getting a lot of price questions before the call."),
            (1, 1, "580 dials, 3 sets. Follow-up list is clean.", nil),
            (1, 2, "2 closes and one deposit collected.", nil),
            (1, 4, "5 sets off 512 dials.", "Struggling to get past the first objection on cold."),
            (1, 5, "Ran two group calls, attendance was 80%.", nil),
            (2, 0, "Cleared the whole inbox before noon.", nil),
            (2, 2, "3 closes. Best show rate of the week.", nil),
            (2, 3, "Six check-ins, two escalations raised.", "Nadia is behind on payment and not replying."),
            (2, 5, "Loom review queue is empty.", nil),
        ]
        return written.compactMap { back, member, wins, blockers in
            guard teamRows.indices.contains(member) else { return nil }
            return TeamEODNote(id: UUID(), userId: teamRows[member].id,
                               reportDate: day(back), wins: wins, blockers: blockers)
        }
    }()

    static var wallet: PortalAPI.WalletSummary {
        PortalAPI.WalletSummary(loaded: 2_995.00, spent: 2_650.62, recent: [
            .init(id: UUID(), entryDate: "2026-08-16", kind: "spend", amount: 248.60, note: "Meta Ads"),
            .init(id: UUID(), entryDate: "2026-08-14", kind: "spend", amount: 96.00, note: "Zapier annual"),
            .init(id: UUID(), entryDate: "2026-08-12", kind: "credit", amount: 500.00, note: "Card top-up"),
            .init(id: UUID(), entryDate: "2026-08-11", kind: "spend", amount: 44.00, note: "Render"),
            .init(id: UUID(), entryDate: "2026-08-10", kind: "spend", amount: 39.99, note: "Google Workspace"),
        ])
    }

    // Stable ids so health/check-in maps line up with the roster.
    private static let rosterIds = (0..<8).map { _ in UUID() }

    /// Completed 1:1 calls per demo student, keyed to the roster ids.
    /// Group students (0 allotted) never appear — they own no 1:1 surfaces.
    static let callCounts: [UUID: Int] = {
        let used = [0: 6, 1: 3, 4: 9]     // Marcus, Leila, Tariq
        return used.reduce(into: [:]) { map, pair in
            guard rosterIds.indices.contains(pair.key) else { return }
            map[rosterIds[pair.key]] = pair.value
        }
    }()

    static var roster: [StudentRosterItem] {
        let rows: [(String, String, Int, String?)] = [
            ("Marcus Reed", "applying", 10, nil),
            ("Leila Hassan", "training", 10, nil),
            ("Jordan Blake", "onboarding", 0, nil),
            ("Nadia Osman", "training", 0, "behind"),
            ("Tariq Aziz", "applying", 10, nil),
            ("Sami Idris", "offer_won", 0, nil),
            ("Dahlia Krum", "onboarding", 0, "scholarship"),
            ("Elias Vance", "training", 0, nil),
        ]
        return rows.enumerated().map { index, row in
            StudentRosterItem(id: rosterIds[index], fullName: row.0,
                              email: row.0.lowercased().replacingOccurrences(of: " ", with: "."),
                              phase: row.1, status: "active", coachId: nil,
                              callsAllotted: row.2, archivedAt: nil, paymentState: row.3)
        }
    }

    static var health: [UUID: StudentHealthResult] {
        let bands: [(HealthBand, Int, [String], Int?, Bool)] = [
            (.green, 88, [], 0, false),
            (.green, 82, [], 1, false),
            (.amber, 55, ["Still in Start Here"], nil, true),
            (.red, 31, ["Payment behind", "No EOD in 6 days"], 6, false),
            (.green, 79, [], 1, false),
            (.green, 95, [], 0, false),
            (.amber, 48, ["Quiet for 4 days"], 4, false),
            (.amber, 58, ["Low volume this week"], 2, false),
        ]
        var out: [UUID: StudentHealthResult] = [:]
        for (index, band) in bands.enumerated() {
            out[rosterIds[index]] = StudentHealthResult(score: band.1, band: band.0,
                                                        reasons: band.2, daysQuiet: band.3, locked: band.4)
        }
        return out
    }

    static let paidByStudent: [String: Double] = [
        "Marcus Reed": 1_100, "Leila Hassan": 2_900, "Jordan Blake": 5_800,
        "Nadia Osman": 550, "Tariq Aziz": 2_800, "Sami Idris": 4_200,
        "Dahlia Krum": 0, "Elias Vance": 3_000,
    ]
    static let totalByStudent: [String: Double] = [
        "Marcus Reed": 2_200, "Leila Hassan": 2_900, "Jordan Blake": 5_800,
        "Nadia Osman": 3_300, "Tariq Aziz": 2_800, "Sami Idris": 4_200,
        "Dahlia Krum": 0, "Elias Vance": 3_000,
    ]

    static var checkinStamps: [UUID: String] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let calendar = Calendar.current
        func day(_ back: Int) -> String {
            formatter.string(from: calendar.date(byAdding: .day, value: -back, to: Date())!)
        }
        return [
            rosterIds[0]: day(0), rosterIds[1]: day(1), rosterIds[4]: day(2),
            rosterIds[5]: day(0), rosterIds[7]: day(3),
        ]
    }

    static let tallyCounts: [String: Int] = [
        "loom": 3, "roleplay": 2, "checkin": 5, "escalation": 1,
    ]

    static var docs: [PortalAPI.Doc] {
        let entries: [(String, String, String, Bool)] = [
            ("Objection handling playbook", "Sales",
             "Price, partner, and time objections with the exact reframes the top closers use. Lead with the cost of staying stuck, never discount first.", true),
            ("Setter DM scripts", "Sales",
             "Opening, follow-up, and revival scripts for cold and warm DMs. Rotate openers weekly and log reply rates in your EOD.", true),
            ("Onboarding checklist", "Fulfillment",
             "Every step from signed contract to first coaching call: portal invite, welcome call within 24 hours, timezone confirmation, Start Here walkthrough.", false),
            ("Refund and pause policy", "Operations",
             "When a pause is offered, when a refund applies, and who signs off. Escalate anything outside policy to the founder before replying.", false),
            ("EOD standards", "Operations",
             "What a complete end-of-day report includes per role, with examples of great and unacceptable submissions.", false),
            ("Client escalation flow", "Fulfillment",
             "Red-flag signals, who owns the save call, and the 48-hour follow-up cadence after any escalation.", false),
        ]
        return entries.enumerated().map { index, entry in
            PortalAPI.Doc(id: UUID(), title: entry.0,
                          slug: "fixture-doc-\(index)", category: entry.1,
                          content: entry.2, pinned: entry.3,
                          updatedAt: "2026-08-\(10 + index)T09:00:00Z", externalLinks: nil)
        }
    }

    /// Due phrasing for a day n days from now ("Overdue 3d" / "Due in 6d").
    static func dueIn(_ days: Int) -> String {
        let date = Calendar.current.date(byAdding: .day, value: days, to: Date()) ?? Date()
        return BunStore.friendlyDue(BunStore.dayKey(date))
    }

    static var overduePayments: [BunStore.BunPlanItem] {
        [
            .init(id: UUID(), student: "Nadia Osman", amount: 550, due: dueIn(-6), overdue: true),
            .init(id: UUID(), student: "Marcus Reed", amount: 550, due: dueIn(-3), overdue: true),
        ]
    }

    static var upcomingPayments: [BunStore.BunPlanItem] {
        [
            .init(id: UUID(), student: "Marcus Reed", amount: 550, due: dueIn(6), overdue: false),
            .init(id: UUID(), student: "Nadia Osman", amount: 550, due: dueIn(10), overdue: false),
            .init(id: UUID(), student: "Tariq Aziz", amount: 700, due: dueIn(14), overdue: false),
        ]
    }

    static var unconfirmedPayouts: [BunStore.BunPayoutItem] {
        [
            .init(id: "fixture-payout-ray", name: "Ray Ortega", amount: 1_240.00),
            .init(id: "fixture-payout-sofia", name: "Sofia Marin", amount: 620.00),
        ]
    }

    static let payoutPeriodLabel = "Aug 16–31"

    // MARK: - Daily loop (action items, 1:1 calls, my EOD history)

    /// The demo operator. Signed out there is no auth id, so "mine" filters
    /// and ownership need one stable stand-in.
    static let meId = UUID()

    private static let staffIds = (0..<4).map { _ in UUID() }

    static var teamMembers: [StaffProfile] {
        let rows: [(UUID, String, String?)] = [
            (meId, userFullName, "dm"),
            (staffIds[0], "Sofia Marin", "dm"),
            (staffIds[1], "Danny Cole", "phone"),
            (staffIds[2], "Ray Ortega", nil),
            (staffIds[3], "Mia Chen", nil),
        ]
        return rows.map { StaffProfile(id: $0.0, displayName: $0.1, eodExempt: false, setterType: $0.2) }
    }

    static var staffNames: [UUID: String] {
        Dictionary(uniqueKeysWithValues: teamMembers.map { ($0.id, $0.displayName ?? "Team member") })
    }

    /// Ad-hoc items: some on clients, some on the team, one already overdue.
    static var actionItems: [ActionItemRow] {
        func day(_ offset: Int) -> String {
            BunStore.dayKey(Calendar.current.date(byAdding: .day, value: offset, to: Date()) ?? Date())
        }
        let rows: [(UUID?, UUID?, String, String?, Bool)] = [
            (rosterIds[3], nil, "Call Nadia about the missed installment", day(-2), false),
            (nil, meId, "Approve Leila's looms so she can start applying", day(0), false),
            (rosterIds[2], nil, "Chase Jordan on Start Here, still on step 2", day(1), false),
            (nil, staffIds[0], "Rewrite the DM opener for the new offer", day(3), false),
            (rosterIds[6], nil, "Book Dahlia's first roleplay", day(-5), true),
        ]
        return rows.map { row in
            ActionItemRow(id: UUID(), studentId: row.0, assigneeId: row.1, createdBy: meId,
                          text: row.2, dueDate: row.3, done: row.4,
                          createdAt: day(-7) + "T09:00:00Z")
        }
    }

    /// Items a coach wrote onto a call — the other half of the queue.
    static var callItems: [CallActionItemRow] {
        let callId = UUID()
        return [
            CallActionItemRow(callId: callId, index: 0, studentId: rosterIds[0], coachId: staffIds[3],
                              callDate: "2026-08-14",
                              item: CallActionItem(text: "Send 5 applications before Friday", done: false, due: nil)),
            CallActionItemRow(callId: callId, index: 1, studentId: rosterIds[0], coachId: staffIds[3],
                              callDate: "2026-08-14",
                              item: CallActionItem(text: "Rewrite the portfolio intro", done: true, due: nil)),
        ]
    }

    static var callsByStudent: [UUID: [StudentCall]] {
        let notes = [
            "Portfolio is close. Wants help framing the offer.",
            "Reset the weekly cadence, energy is back.",
            "Looms are getting sharper, one more round to approval.",
            "Went through the first two objections line by line.",
            "Slow week. Agreed on three applications a day.",
        ]
        var out: [UUID: [StudentCall]] = [:]
        for (studentId, used) in callCounts where used > 0 {
            out[studentId] = (0..<used).map { index in
                let date = Calendar.current.date(byAdding: .day, value: -7 * index - 1, to: Date()) ?? Date()
                return StudentCall(id: UUID(), studentId: studentId,
                                   callDate: BunStore.dayKey(date),
                                   coachNotes: notes[index % notes.count],
                                   coachId: staffIds[3], status: "completed",
                                   progressRating: 3 + (index % 3 == 0 ? 1 : 0),
                                   nextStep: index == 0 ? "Five applications before Friday" : nil,
                                   fathomUrl: nil, actionItemsJson: nil)
            }
        }
        return out
    }

    /// My own last week of reports, for the EOD history strip.
    static var myEODs: [PortalAPI.MyEOD] {
        let numbers: [(Int, Int, Int, Int, Int)] = [
            (0, 310, 7, 4, 1), (1, 288, 6, 3, 0), (2, 301, 6, 5, 2),
            (3, 264, 4, 2, 0), (4, 322, 8, 6, 1),
        ]
        return numbers.map { offset, dms, sets, shows, closes in
            let date = Calendar.current.date(byAdding: .day, value: -offset, to: Date()) ?? Date()
            return PortalAPI.MyEOD(id: UUID(), reportDate: BunStore.dayKey(date), dials: 0,
                                   dmsSent: dms, leadsContacted: 0, convosStarted: 0,
                                   callsBooked: sets, shows: shows, noShows: 0, closes: closes)
        }
    }
}
