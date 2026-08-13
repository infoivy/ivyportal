import Foundation
import Supabase

struct EODActivity: Decodable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    let reportDate: String
    let dials: Int?
    let leadsContacted: Int?
    let dmsSent: Int?
    let convosStarted: Int?
    let callsBooked: Int?
    let callsScheduled: Int?
    let shows: Int?
    let noShows: Int?
    let closes: Int?

    enum CodingKeys: String, CodingKey {
        case id, userId = "user_id", reportDate = "report_date"
        case dials, leadsContacted = "leads_contacted", dmsSent = "dms_sent", convosStarted = "convos_started"
        case callsBooked = "calls_booked", callsScheduled = "calls_scheduled"
        case shows, noShows = "no_shows", closes
    }
}

struct StaffProfile: Decodable, Identifiable, Sendable {
    let id: UUID
    let displayName: String?
    let eodExempt: Bool?
    let setterType: String?

    enum CodingKeys: String, CodingKey {
        case id, displayName = "display_name", eodExempt = "eod_exempt", setterType = "setter_type"
    }
}

struct StaffRole: Decodable, Sendable {
    let userId: UUID
    let role: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id", role
    }
}

struct PerformanceSummary: Sendable {
    var callsBooked = 0
    var submitted = 0
    var missing = 0
    var coverage: Int { submitted + missing == 0 ? 0 : Int((Double(submitted) / Double(submitted + missing) * 100).rounded()) }
}

struct TeamMemberRow: Identifiable, Sendable {
    let id: UUID
    let name: String
    let role: String
    let sets: Int
    let eodDays: Int
    let booked: Int
    let shows: Int
    let closes: Int
    let dials: Int
    let dmsSent: Int
    let filedToday: Bool
    let missedYesterday: Bool
}

struct StudentRosterItem: Decodable, Identifiable, Sendable {
    let id: UUID
    let fullName: String
    let email: String?
    let phase: String?
    let status: String?
    let coachId: UUID?

    enum CodingKeys: String, CodingKey {
        case id, fullName = "full_name", email, phase, status, coachId = "coach_id"
    }
}

struct StudentActionItem: Decodable, Identifiable, Sendable {
    let id: UUID
    let studentId: UUID
    let text: String
    let dueDate: String?
    let done: Bool

    enum CodingKeys: String, CodingKey {
        case id, studentId = "student_id", text, dueDate = "due_date", done
    }
}

struct HomeQueue: Sendable {
    var activeStudents = 0
    var flaggedStudents = 0
    var overdueActions = 0
    var overduePayments = 0
}

// MARK: - CSM workspace models

struct StudentCall: Decodable, Identifiable, Sendable {
    let id: UUID
    let studentId: UUID
    let callDate: String
    let coachNotes: String?

    enum CodingKeys: String, CodingKey {
        case id, studentId = "student_id", callDate = "call_date", coachNotes = "coach_notes"
    }
}

struct CSMNote: Decodable, Identifiable, Sendable {
    let id: UUID
    let studentId: UUID
    let note: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, studentId = "student_id", note, createdAt = "created_at"
    }
}

struct StudentEOD: Decodable, Identifiable, Sendable {
    let id: UUID
    let studentId: UUID
    let reportDate: String
    let applicationsSubmitted: Int
    let outreachSent: Int
    let replies: Int
    let interviews: Int
    let wins: String?
    let blockers: String?

    enum CodingKeys: String, CodingKey {
        case id, studentId = "student_id", reportDate = "report_date"
        case applicationsSubmitted = "applications_submitted", outreachSent = "outreach_sent"
        case replies, interviews, wins, blockers
    }
}

// MARK: - Money / CRM models

struct InstallmentPayment: Decodable, Identifiable, Sendable {
    let id: UUID
    let amount: Double
    let status: String
    let dueDate: String?

    enum CodingKeys: String, CodingKey {
        case id, amount, status, dueDate = "due_date"
    }
}

struct Deal: Decodable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let value: Double?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id, name, value, status
    }
}

struct MoneySummary: Sendable {
    var collected: Double = 0
    var overdue: Double = 0
    var upcoming: Double = 0
    var deals = 0
}

// MARK: - Set tracker, expenses, output

struct SetterDailyLog: Decodable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    let logDate: String
    let inbounds: Int
    let outboundsSent: Int
    let ibReplies: Int
    let obReplies: Int
    let followUpsSent: Int
    let callsProposed: Int
    let calendlySent: Int
    let callsBookedInbound: Int
    let callsBookedOutbound: Int
    let qualifiedBookings: Int
    let callsOnCalendar: Int
    let callsShowed: Int
    let setsClosed: Int
    let cashCollected: Double
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id, userId = "user_id", logDate = "log_date"
        case inbounds, outboundsSent = "outbounds_sent", ibReplies = "ib_replies", obReplies = "ob_replies"
        case followUpsSent = "follow_ups_sent", callsProposed = "calls_proposed", calendlySent = "calendly_sent"
        case callsBookedInbound = "calls_booked_inbound", callsBookedOutbound = "calls_booked_outbound"
        case qualifiedBookings = "qualified_bookings", callsOnCalendar = "calls_on_calendar"
        case callsShowed = "calls_showed", setsClosed = "sets_closed", cashCollected = "cash_collected", notes
    }
}

struct BusinessExpense: Decodable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let amount: Double
    let recurring: Bool
    let dueDay: Int?
    let oneOffDate: String?
    let category: String?

    enum CodingKeys: String, CodingKey {
        case id, name, amount, recurring, dueDay = "due_day", oneOffDate = "one_off_date", category
    }
}

struct StudentOutputPoint: Identifiable, Sendable {
    let id: String
    let date: String
    var applications: Int
    var outreach: Int
    var replies: Int
    var interviews: Int
}

@MainActor
final class PortalAPI {
    static let shared = PortalAPI()

    private init() {}

    private func client() throws -> SupabaseClient {
        AuthStore.shared.client
    }

    /// Real-only EOD activity for the last `days` days (portal's canonical analytics source).
    func eodActivity(days: Int) async throws -> [EODActivity] {
        let from = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        let iso = ISO8601DateFormatter()
        let start = iso.string(from: from)
        return try await client().from("eods_activity_real")
            .select()
            .gte("report_date", value: start)
            .order("report_date", ascending: false)
            .execute()
            .value
    }

    func profiles(ids: [UUID]) async throws -> [StaffProfile] {
        guard !ids.isEmpty else { return [] }
        return try await client().from("profiles")
            .select("id, display_name, eod_exempt, setter_type")
            .in("id", values: ids)
            .execute()
            .value
    }

    func staffRoles() async throws -> [StaffRole] {
        try await client().from("user_roles")
            .select("user_id, role")
            .execute()
            .value
    }

    func myRoles() async throws -> [String] {
        guard let userID = AuthStore.shared.session?.user.id else { return [] }
        return try await client().from("user_roles")
            .select("role")
            .eq("user_id", value: userID)
            .execute()
            .value
    }

    // MARK: - Students, action items, payments

    func students() async throws -> [StudentRosterItem] {
        try await client().from("students")
            .select("id, full_name, email, phase, status, coach_id")
            .order("full_name")
            .execute()
            .value
    }

    // MARK: - CSM workspace reads

    func studentCalls(studentId: UUID) async throws -> [StudentCall] {
        try await client().from("student_calls")
            .select("id, student_id, call_date, coach_notes")
            .eq("student_id", value: studentId)
            .order("call_date", ascending: false)
            .execute()
            .value
    }

    func csmNotes(studentId: UUID) async throws -> [CSMNote] {
        try await client().from("csm_student_notes")
            .select("id, student_id, note, created_at")
            .eq("student_id", value: studentId)
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    func studentEODs(studentId: UUID) async throws -> [StudentEOD] {
        try await client().from("student_eods")
            .select("id, student_id, report_date, applications_submitted, outreach_sent, replies, interviews, wins, blockers")
            .eq("student_id", value: studentId)
            .order("report_date", ascending: false)
            .execute()
            .value
    }

    func studentActionItems(studentId: UUID) async throws -> [StudentActionItem] {
        try await client().from("student_action_items")
            .select("id, student_id, text, due_date, done")
            .eq("student_id", value: studentId)
            .order("due_date", ascending: true)
            .execute()
            .value
    }

    // MARK: - Money / CRM reads

    func moneySummary() async throws -> MoneySummary {
        async let payments: [InstallmentPayment] = client().from("installment_payments")
            .select("id, amount, status, due_date")
            .execute()
            .value
        async let deals: [Deal] = client().from("deals")
            .select("id, name, value, status")
            .execute()
            .value
        let all = try await payments
        let dealRows = try await deals
        var summary = MoneySummary()
        summary.collected = all.filter { $0.status == "paid" }.reduce(0) { $0 + $1.amount }
        summary.overdue = all.filter { $0.status == "late" || $0.status == "missed" }.reduce(0) { $0 + $1.amount }
        summary.upcoming = all.filter { $0.status == "upcoming" }.reduce(0) { $0 + $1.amount }
        summary.deals = dealRows.count
        return summary
    }

    func deals() async throws -> [Deal] {
        try await client().from("deals")
            .select("id, name, value, status")
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    // MARK: - Set tracker, expenses, output, and the rest

    func setterDailyLogs(days: Int = 14) async throws -> [SetterDailyLog] {
        let from = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        let start = ISO8601DateFormatter().string(from: from)
        return try await client().from("setter_daily_logs")
            .select()
            .gte("log_date", value: start)
            .order("log_date", ascending: false)
            .execute()
            .value
    }

    func businessExpenses() async throws -> [BusinessExpense] {
        try await client().from("business_expenses")
            .select("id, name, amount, recurring, due_day, one_off_date, category")
            .order("amount", ascending: false)
            .execute()
            .value
    }

    func allStudentEODs(days: Int = 14) async throws -> [StudentEOD] {
        let from = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        let start = ISO8601DateFormatter().string(from: from)
        return try await client().from("student_eods")
            .select("id, student_id, report_date, applications_submitted, outreach_sent, replies, interviews, wins, blockers")
            .gte("report_date", value: start)
            .order("report_date", ascending: false)
            .execute()
            .value
    }

    /// Student output over time (applications/outreach/replies/interviews per day) for the CSM graphs.
    func studentOutput(days: Int = 14) async throws -> [StudentOutputPoint] {
        let rows = try await allStudentEODs(days: days)
        var byDate: [String: StudentOutputPoint] = [:]
        for row in rows {
            var point = byDate[row.reportDate] ?? StudentOutputPoint(id: row.reportDate, date: row.reportDate, applications: 0, outreach: 0, replies: 0, interviews: 0)
            point.applications += row.applicationsSubmitted
            point.outreach += row.outreachSent
            point.replies += row.replies
            point.interviews += row.interviews
            byDate[row.reportDate] = point
        }
        return byDate.values.sorted { $0.date < $1.date }
    }

    func openActionItems() async throws -> [StudentActionItem] {
        try await client().from("student_action_items")
            .select("id, student_id, text, due_date, done")
            .eq("done", value: false)
            .order("due_date", ascending: true)
            .execute()
            .value
    }

    /// Live home queue: real counts straight from the portal tables.
    func homeQueue() async throws -> HomeQueue {
        var queue = HomeQueue()
        async let roster = students()
        let today = ISO8601DateFormatter().string(from: Date())
        async let overdueActions: [StudentActionItem] = client().from("student_action_items")
            .select("id")
            .eq("done", value: false)
            .lt("due_date", value: today)
            .execute()
            .value
        async let overduePayments: [Int] = client().from("installment_payments")
            .select("id")
            .or("status.eq.late,status.eq.missed")
            .execute()
            .value
        let all = try await roster
        queue.activeStudents = all.filter { $0.status == "active" }.count
        queue.flaggedStudents = all.filter { $0.status == "ghosting" }.count
        queue.overdueActions = (try await overdueActions).count
        queue.overduePayments = (try await overduePayments).count
        return queue
    }

    // MARK: - Performance (portal shape)

    /// Aggregate real EOD rows into the portal's Performance shape.
    func performanceSummary(days: Int = 7) async throws -> (summary: PerformanceSummary, rows: [TeamMemberRow]) {
        let rows = try await eodActivity(days: days)
        let staffRoles = try await staffRoles()
        let staffIDs = Array(Set(staffRoles.map(\.userId)))
        let staff = try await profiles(ids: staffIDs)
        let userIds = Array(Set(rows.map(\.userId) + staffIDs))
        let allProfiles = try await profiles(ids: userIds)

        var summary = PerformanceSummary()
        summary.callsBooked = rows.compactMap(\.callsBooked).reduce(0, +)
        summary.submitted = rows.count

        let nameByID = Dictionary(uniqueKeysWithValues: allProfiles.map { ($0.id, $0.displayName ?? "Team member") })
        let roleByUser = Dictionary(grouping: staffRoles, by: \.userId).mapValues { $0.map(\.role) }
        let calendar = Calendar.current
        let iso = ISO8601DateFormatter()

        var perUser: [UUID: [EODActivity]] = [:]
        for row in rows { perUser[row.userId, default: []].append(row) }

        let today = calendar.startOfDay(for: Date())
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today) ?? today
        let dayOf: (String) -> Date? = { iso.date(from: $0).map { calendar.startOfDay(for: $0) } }

        let memberRows = staffIDs.map { userID -> TeamMemberRow in
            let userRows = perUser[userID] ?? []
            let days = Set(userRows.compactMap { dayOf($0.reportDate) })
            let excluded = staff.first { $0.id == userID }?.eodExempt ?? false
            return TeamMemberRow(
                id: userID,
                name: nameByID[userID] ?? "Team member",
                role: roleByUser[userID]?.first ?? "staff",
                sets: userRows.compactMap(\.callsBooked).reduce(0, +),
                eodDays: days.count,
                booked: userRows.compactMap(\.callsBooked).reduce(0, +),
                shows: userRows.compactMap(\.shows).reduce(0, +),
                closes: userRows.compactMap(\.closes).reduce(0, +),
                dials: userRows.compactMap(\.dials).reduce(0, +),
                dmsSent: userRows.compactMap(\.dmsSent).reduce(0, +),
                filedToday: days.contains(today),
                missedYesterday: !excluded && !days.contains(yesterday)
            )
        }.sorted { $0.eodDays > $1.eodDays }

        let expectedReporters = max(staff.filter { $0.eodExempt != true }.count, 1)
        summary.missing = max(expectedReporters * days - summary.submitted, 0)

        return (summary, memberRows)
    }
}
