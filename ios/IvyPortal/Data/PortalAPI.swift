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
