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
    // Team-week detail (portal team-week.tsx): wins, blockers, closer/csm fields.
    let callsTaken: Int?
    let cashCollected: Double?
    let studentCheckins: Int?
    let loomsReviewed: Int?
    let wins: String?
    let blockers: String?

    enum CodingKeys: String, CodingKey {
        case id, userId = "user_id", reportDate = "report_date"
        case dials, leadsContacted = "leads_contacted", dmsSent = "dms_sent", convosStarted = "convos_started"
        case callsBooked = "calls_booked", callsScheduled = "calls_scheduled"
        case shows, noShows = "no_shows", closes
        case callsTaken = "calls_taken", cashCollected = "cash_collected"
        case studentCheckins = "student_checkins", loomsReviewed = "looms_reviewed"
        case wins, blockers
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

/// One member's written EOD for one day. Notes live on `eods`, never on the
/// money-free activity view.
struct TeamEODNote: Decodable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    let reportDate: String
    let wins: String?
    let blockers: String?

    enum CodingKeys: String, CodingKey {
        case id, userId = "user_id", reportDate = "report_date", wins, blockers
    }

    var hasNote: Bool {
        !(wins ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        || !(blockers ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
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
    let callsAllotted: Int?
    let archivedAt: String?
    /// "scholarship" pins a student to the bottom of the priority roster.
    let paymentState: String?
    // Delivery-picture columns: joined, onboarding finished, first win, and
    // whether the testimonial is already in.
    let createdAt: String?
    let onboardingCompletedAt: String?
    let firstWinAt: String?
    let testimonialCollected: Bool?

    enum CodingKeys: String, CodingKey {
        case id, fullName = "full_name", email, phase, status, coachId = "coach_id"
        case callsAllotted = "calls_allotted", archivedAt = "archived_at"
        case paymentState = "payment_state", createdAt = "created_at"
        case onboardingCompletedAt = "onboarding_completed_at"
        case firstWinAt = "first_win_at", testimonialCollected = "testimonial_collected"
    }

    /// Joined but still not through Start Here after a week.
    var stuckInOnboarding: Bool {
        (phase ?? "onboarding") == "onboarding" && onboardingCompletedAt == nil
            && (createdAt?.prefix(10)).map { String($0) < BunStore.dayKey(Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()) } == true
    }

    var testimonialReady: Bool { firstWinAt != nil && testimonialCollected == false }

    /// Program type derives from the coaching allowance (business rule).
    var isOneOnOne: Bool { (callsAllotted ?? 0) > 0 }
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
    // Call-history depth (web /calls parity): the rating a coach gave, what
    // the student owes next, and the recording.
    let coachId: UUID?
    let status: String?
    let progressRating: Int?
    let nextStep: String?
    let fathomUrl: String?
    let actionItemsJson: [CallActionItem]?

    enum CodingKeys: String, CodingKey {
        case id, studentId = "student_id", callDate = "call_date", coachNotes = "coach_notes"
        case coachId = "coach_id", status, progressRating = "progress_rating"
        case nextStep = "next_step", fathomUrl = "fathom_url"
        case actionItemsJson = "action_items_json"
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

    /// Team EOD notes — the wins/blockers people actually write.
    ///
    /// `eods_activity_real` is deliberately money-free AND note-free, so notes
    /// have to come off the base table, exactly as the web's team-week does.
    /// RLS is the wall: admins and closers get the team's rows, everyone else
    /// gets only their own, so this needs no client-side role gate.
    func teamEODNotes(days: Int = 7) async throws -> [TeamEODNote] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        let from = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        return try await client().from("eods")
            .select("id, user_id, report_date, wins, blockers")
            .eq("is_demo", value: false)
            .gte("report_date", value: formatter.string(from: from))
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
        // PostgREST returns objects ([{"role": "..."}]) — decode rows, not bare strings.
        let rows: [StaffRole] = try await client().from("user_roles")
            .select("user_id, role")
            .eq("user_id", value: userID)
            .execute()
            .value
        return rows.map(\.role)
    }

    // MARK: - Students, action items, payments

    func students() async throws -> [StudentRosterItem] {
        // Web conventions: demo rows and archived students never surface
        // (archived_at is the universal roster-removal flag).
        try await client().from("students")
            .select("id, full_name, email, phase, status, coach_id, calls_allotted, archived_at, payment_state, created_at, onboarding_completed_at, first_win_at, testimonial_collected")
            .eq("is_demo", value: false)
            .is("archived_at", value: nil)
            .order("full_name")
            .execute()
            .value
    }

    // MARK: - CSM workspace reads

    func studentCalls(studentId: UUID) async throws -> [StudentCall] {
        try await client().from("student_calls")
            .select("id, student_id, call_date, coach_notes, coach_id, status, progress_rating, next_step, fathom_url, action_items_json")
            .eq("student_id", value: studentId)
            .is("voided_at", value: nil)
            .order("call_date", ascending: false)
            .execute()
            .value
    }

    /// Completed (non-voided) 1:1 call count per student, for the Clients
    /// 1-on-1 "calls used" column (web calls_allotted vs student_calls).
    func studentCallCounts() async throws -> [UUID: Int] {
        struct Row: Decodable { let studentId: UUID
            enum CodingKeys: String, CodingKey { case studentId = "student_id" } }
        let rows: [Row] = try await client().from("student_calls")
            .select("student_id")
            .is("voided_at", value: nil)
            .execute()
            .value
        return rows.reduce(into: [:]) { $0[$1.studentId, default: 0] += 1 }
    }

    /// Raw EOD rows + display names for the Reports metric drill-downs.
    func activityDrilldown(days: Int = 7) async throws -> (rows: [EODActivity], names: [UUID: String]) {
        let rows = try await eodActivity(days: days)
        let people = try await profiles(ids: Array(Set(rows.map(\.userId))))
        return (rows, Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0.displayName ?? "Team member") }))
    }

    // MARK: - Bun organizations (multi-tenant Phase 1)

    struct BunOrg: Decodable, Identifiable, Sendable, Hashable {
        let id: UUID
        let name: String
        let slug: String?
        /// Profit split rows, a per-org setting (migration 20260818040000).
        /// The web still carries a hardcoded constant; this is the version
        /// that can ship to a second business.
        var profitSplit: [ProfitShare]?

        enum CodingKeys: String, CodingKey { case id, name, slug, profitSplit = "profit_split" }
    }

    struct ProfitShare: Codable, Sendable, Hashable, Identifiable {
        var name: String
        var pct: Double
        var id: String { name }
    }

    /// Orgs the signed-in account belongs to. Returns [] until the
    /// multi-tenant migration is applied (callers fall back gracefully).
    func myOrgs() async throws -> [BunOrg] {
        guard let me = currentUserID else { return [] }
        struct Row: Decodable {
            let orgs: BunOrg
        }
        let rows: [Row] = try await client().from("org_members")
            .select("orgs(id, name, slug, profit_split)")
            .eq("user_id", value: me)
            .execute().value
        return rows.map(\.orgs)
    }

    func createOrganization(name: String) async throws -> UUID {
        let id: UUID = try await client()
            .rpc("create_organization", params: ["org_name": name])
            .execute().value
        return id
    }

    /// Team invite. Stamps the org when known; the legacy (pre-migration)
    /// path inserts without org_id so Ivy admin invites keep working.
    func inviteTeammate(email: String, roles: [String], orgId: UUID?) async throws {
        if let orgId {
            struct Row: Encodable {
                let email: String
                let roles: [String]
                let orgId: UUID
                enum CodingKeys: String, CodingKey { case email, roles, orgId = "org_id" }
            }
            try await client().from("invitations")
                .insert(Row(email: email.lowercased(), roles: roles, orgId: orgId))
                .execute()
        } else {
            struct Row: Encodable {
                let email: String
                let roles: [String]
            }
            try await client().from("invitations")
                .insert(Row(email: email.lowercased(), roles: roles))
                .execute()
        }
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
        // Voided plans and demo/voided deals never count (web conventions).
        async let payments: [InstallmentPayment] = client().from("installment_payments")
            .select("id, amount, status, due_date, installments!inner(voided_at)")
            .is("installments.voided_at", value: nil)
            .execute()
            .value
        async let deals: [Deal] = client().from("deals")
            .select("id, name, value, status")
            .eq("is_demo", value: false)
            .is("voided_at", value: nil)
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
            .eq("is_demo", value: false)
            .is("voided_at", value: nil)
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
        // Joined-filter to non-demo, non-archived students (web convention).
        return try await client().from("student_eods")
            .select("id, student_id, report_date, applications_submitted, outreach_sent, replies, interviews, wins, blockers, students!inner(is_demo, archived_at)")
            .eq("students.is_demo", value: false)
            .is("students.archived_at", value: nil)
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
            .eq("is_demo", value: false)
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
            .eq("is_demo", value: false)
            .lt("due_date", value: today)
            .execute()
            .value
        async let overduePayments: [Int] = client().from("installment_payments")
            .select("id, installments!inner(voided_at)")
            .or("status.eq.late,status.eq.missed")
            .is("installments.voided_at", value: nil)
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
                // Readers take max(dms_sent, leads_contacted): historical rows
                // recorded outreach under leads_contacted (web rule 2026-07-11).
                dmsSent: userRows.reduce(0) { $0 + max($1.dmsSent ?? 0, $1.leadsContacted ?? 0) },
                filedToday: days.contains(today),
                missedYesterday: !excluded && !days.contains(yesterday)
            )
        }.sorted { $0.eodDays > $1.eodDays }

        let expectedReporters = max(staff.filter { $0.eodExempt != true }.count, 1)
        summary.missing = max(expectedReporters * days - summary.submitted, 0)

        return (summary, memberRows)
    }
}

// MARK: - Writes (Phase E1 — real mutations through the signed-in session + RLS)

/// One staff EOD row, all count fields sent explicitly zeroed like the web
/// form does (`_authenticated.eods.tsx`). INSERT-only; PG 23505 = locked.
struct EODSubmission: Encodable, Sendable {
    var userId: UUID
    var reportDate: String
    var dials = 0
    var leadsContacted = 0
    var dmsSent = 0
    var convosStarted = 0
    var callsBooked = 0
    var callsScheduled = 0
    var shows = 0
    var noShows = 0
    var callsTaken = 0
    var closes = 0
    // Closer money columns (web emptyForm parity — without these a closer's
    // phone EOD records $0 cash in every downstream report).
    var deposits = 0
    var cashCollected: Double = 0
    var deferredCash: Double = 0
    var followUpsDone = 0
    var loomsReviewed = 0
    var roleplaysReviewed = 0
    var studentCheckins = 0
    var escalationsResolved = 0
    var wins: String
    var blockers = ""
    var tomorrowFocus = ""
    var summary = ""

    enum CodingKeys: String, CodingKey {
        case userId = "user_id", reportDate = "report_date"
        case dials, leadsContacted = "leads_contacted", dmsSent = "dms_sent", convosStarted = "convos_started"
        case callsBooked = "calls_booked", callsScheduled = "calls_scheduled"
        case shows, noShows = "no_shows", callsTaken = "calls_taken", closes
        case deposits, cashCollected = "cash_collected", deferredCash = "deferred_cash"
        case followUpsDone = "follow_ups_done"
        case loomsReviewed = "looms_reviewed", roleplaysReviewed = "roleplays_reviewed"
        case studentCheckins = "student_checkins", escalationsResolved = "escalations_resolved"
        case wins, blockers, tomorrowFocus = "tomorrow_focus", summary
    }
}

struct NewActionItem: Encodable, Sendable {
    var studentId: UUID?
    var assigneeId: UUID?
    var createdBy: UUID
    var text: String
    var dueDate: String?
    var done = false

    enum CodingKeys: String, CodingKey {
        case studentId = "student_id", assigneeId = "assignee_id", createdBy = "created_by"
        case text, dueDate = "due_date", done
    }
}

/// One structured action item embedded on a call (web `action_items_json`
/// row shape — the student portal's toggle RPC operates on these).
struct CallActionItem: Codable, Sendable {
    var id: String = UUID().uuidString
    var text: String
    var done = false
    var due: String?
}

struct NewStudentCall: Encodable, Sendable {
    var studentId: UUID
    var coachId: UUID
    var callDate: String
    var status = "completed"
    var progressRating: Int
    var outcome: String?
    var coachNotes: String?
    var durationMin = 30
    // Web /calls modal parity: without these a phone-logged call gives the
    // student nothing to tick and breaks the CSM next-call cadence math.
    var actionItemsJson: [CallActionItem] = []
    var nextStep: String?
    var nextCallDate: String?
    var fathomUrl: String?

    enum CodingKeys: String, CodingKey {
        case studentId = "student_id", coachId = "coach_id", callDate = "call_date"
        case status, progressRating = "progress_rating", outcome
        case coachNotes = "coach_notes", durationMin = "duration_min"
        case actionItemsJson = "action_items_json", nextStep = "next_step"
        case nextCallDate = "next_call_date", fathomUrl = "fathom_url"
    }
}

extension PortalAPI {
    var currentUserID: UUID? { AuthStore.shared.session?.user.id }

    /// Whether a thrown Postgrest error is the duplicate-key lock (23505).
    static func isLockedEODError(_ error: Error) -> Bool {
        String(describing: error).contains("23505")
    }

    func submitEOD(_ submission: EODSubmission) async throws {
        try await client().from("eods").insert(submission).execute()
    }

    /// One row per target; broadcast assignment inserts many rows, exactly
    /// like the web action-items composer.
    func createActionItems(_ items: [NewActionItem]) async throws {
        try await client().from("student_action_items").insert(items).execute()
    }

    func setActionItemDone(id: UUID, done: Bool) async throws {
        let doneAt: AnyJSON = done ? .string(ISO8601DateFormatter().string(from: Date())) : .null
        try await client().from("student_action_items")
            .update(["done": AnyJSON.bool(done), "done_at": doneAt])
            .eq("id", value: id)
            .execute()
    }

    func logStudentCall(_ call: NewStudentCall) async throws {
        try await client().from("student_calls").insert(call).execute()
    }

    /// CSM tally: one-tap counters. Kinds: loom, roleplay, checkin, escalation.
    func addTally(kind: String, studentId: UUID? = nil, note: String? = nil) async throws {
        guard let userID = currentUserID else { return }
        struct Tally: Encodable {
            let userId: UUID, kind: String, studentId: UUID?, note: String?
            enum CodingKeys: String, CodingKey {
                case userId = "user_id", kind, studentId = "student_id", note
            }
        }
        try await client().from("csm_tally")
            .insert(Tally(userId: userID, kind: kind, studentId: studentId, note: note))
            .execute()
    }

    /// Undo: delete my most recent tally of this kind from today.
    func undoLastTally(kind: String) async throws {
        guard let userID = currentUserID else { return }
        struct TallyRow: Decodable { let id: UUID }
        let startOfDay = ISO8601DateFormatter().string(from: Calendar.current.startOfDay(for: Date()))
        let rows: [TallyRow] = try await client().from("csm_tally")
            .select("id")
            .eq("user_id", value: userID)
            .eq("kind", value: kind)
            .gte("created_at", value: startOfDay)
            .order("created_at", ascending: false)
            .limit(1)
            .execute()
            .value
        guard let last = rows.first else { return }
        try await client().from("csm_tally").delete().eq("id", value: last.id).execute()
    }

    /// Coaches for the call-log picker: profiles holding coach or admin roles.
    func coaches() async throws -> [StaffProfile] {
        let roles = try await staffRoles()
        let coachIDs = Array(Set(roles.filter { $0.role == "coach" || $0.role == "admin" }.map(\.userId)))
        guard !coachIDs.isEmpty else { return [] }
        return try await profiles(ids: coachIDs)
    }
}

// MARK: - Payouts (Phase E2 — the web payout ledger, computed natively)

struct PayoutDealRow: Decodable, Identifiable, Sendable {
    let id: UUID
    let studentId: UUID?
    let studentName: String
    let closerId: UUID?
    let setterId: UUID?
    let programType: String?
    let totalValue: Double?
    let cashCollectedUpfront: Double?
    let paymentType: String?
    let dealDate: String
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id, studentId = "student_id", studentName = "student_name"
        case closerId = "closer_id", setterId = "setter_id", programType = "program_type"
        case totalValue = "total_value", cashCollectedUpfront = "cash_collected_upfront"
        case paymentType = "payment_type", dealDate = "deal_date", notes
    }

    var payoutDeal: PayoutDeal {
        PayoutDeal(id: id.uuidString, studentName: studentName, closerId: closerId?.uuidString,
                   setterId: setterId?.uuidString, cashCollectedUpfront: cashCollectedUpfront ?? 0, dealDate: dealDate)
    }
}

struct PayoutConfirmationRow: Decodable, Sendable {
    let periodStart: String
    let userId: UUID
    let amountPaid: Double
    let confirmedAt: String
    let note: String?

    enum CodingKeys: String, CodingKey {
        case periodStart = "period_start", userId = "user_id", amountPaid = "amount_paid"
        case confirmedAt = "confirmed_at", note
    }
}

/// Everything the Payouts tab needs for one semi-monthly period, computed
/// with the exact web math (IvyPortalCore/PayoutsCalc.swift).
struct PayoutLedgerData: Sendable {
    let period: PayoutPeriod
    let rows: PayoutRows
    let owed: [OwedMember]
    let confirmations: [PayoutConfirmationRow]
    let adjustments: [PayoutAdjustmentEntry]
    let teamIds: [String]
    let names: [String: String]
    var periodEnded: Bool { PayoutPeriods.todayLocal() > period.end }
    var confirmedByUser: [String: PayoutConfirmationRow] {
        Dictionary(uniqueKeysWithValues: confirmations.map { ($0.userId.uuidString, $0) })
    }
}

extension PortalAPI {
    private struct RateRow: Decodable {
        let key: String
        let rate: Double
    }
    private struct PayProfileRow: Decodable {
        let id: UUID
        let displayName: String?
        let commissionCapPct: Double?
        let basePayMonthly: Double?
        let basePayDay: Int?
        let startedOn: String?
        enum CodingKeys: String, CodingKey {
            case id, displayName = "display_name", commissionCapPct = "commission_cap_pct"
            case basePayMonthly = "base_pay_monthly", basePayDay = "base_pay_day", startedOn = "started_on"
        }
        var info: PayoutProfileInfo {
            PayoutProfileInfo(id: id.uuidString, displayName: displayName ?? String(id.uuidString.prefix(8)),
                              commissionCapPct: commissionCapPct, basePayMonthly: basePayMonthly,
                              basePayDay: basePayDay, startedOn: startedOn)
        }
    }
    private struct PaidPaymentRow: Decodable {
        let id: UUID
        let amount: Double
        let paidAt: String?
        let installmentId: UUID
        enum CodingKeys: String, CodingKey {
            case id, amount, paidAt = "paid_at", installmentId = "installment_id"
        }
    }
    private struct PlanRefRow: Decodable {
        let id: UUID
        let setterId: UUID?
        let closerId: UUID?
        let studentName: String
        enum CodingKeys: String, CodingKey {
            case id, setterId = "setter_id", closerId = "closer_id", studentName = "student_name"
        }
    }
    private struct AdjustmentRow: Decodable {
        let id: UUID
        let userId: UUID
        let periodStart: String
        let amount: Double
        let note: String
        let createdAt: String
        enum CodingKeys: String, CodingKey {
            case id, userId = "user_id", periodStart = "period_start", amount, note, createdAt = "created_at"
        }
        var entry: PayoutAdjustmentEntry {
            PayoutAdjustmentEntry(id: id.uuidString, userId: userId.uuidString, periodStart: periodStart,
                                  amount: amount, note: note, createdAt: createdAt)
        }
    }

    /// One period's full ledger: month-wide reads (the co-founder caps need
    /// both halves), rows scoped to the half — identical to the web page.
    func payoutLedger(offset: Int) async throws -> PayoutLedgerData {
        let period = PayoutPeriods.period(offset: offset)
        async let dealsQ: [PayoutDealRow] = client().from("deals")
            .select("id, student_id, student_name, closer_id, setter_id, program_type, total_value, cash_collected_upfront, payment_type, deal_date, notes")
            .eq("is_demo", value: false)
            .is("voided_at", value: nil)
            .gte("deal_date", value: period.monthStart)
            .lte("deal_date", value: period.monthEnd)
            .execute().value
        async let profilesQ: [PayProfileRow] = client().from("profiles")
            .select("id, display_name, commission_cap_pct, base_pay_monthly, base_pay_day, started_on")
            .eq("is_demo", value: false)
            .execute().value
        async let ratesQ: [RateRow] = client().from("commission_rates")
            .select("key, rate")
            .eq("active", value: true)
            .execute().value
        async let paymentsQ: [PaidPaymentRow] = client().from("installment_payments")
            .select("id, amount, paid_at, installment_id, installments!inner(students!inner(is_demo))")
            .eq("installments.students.is_demo", value: false)
            .eq("status", value: "paid")
            .gte("paid_at", value: period.monthStart + "T00:00:00")
            .lte("paid_at", value: period.monthEnd + "T23:59:59")
            .not("paid_at", operator: .is, value: "null")
            .execute().value
        async let plansQ: [PlanRefRow] = client().from("installments")
            .select("id, setter_id, closer_id, student_name, students!inner(is_demo)")
            .eq("students.is_demo", value: false)
            .execute().value
        async let rolesQ: [StaffRole] = client().from("user_roles")
            .select("user_id, role")
            .execute().value
        async let confirmationsQ: [PayoutConfirmationRow] = client().from("payout_confirmations")
            .select("period_start, user_id, amount_paid, confirmed_at, note")
            .eq("period_start", value: period.start)
            .execute().value
        async let adjustmentsQ: [AdjustmentRow] = client().from("payout_adjustments")
            .select("id, user_id, period_start, amount, note, created_at")
            .eq("period_start", value: period.start)
            .order("created_at", ascending: true)
            .execute().value

        var rates = CommissionRateSet.defaults
        for row in try await ratesQ { rates.apply(key: row.key, rate: row.rate) }
        let profileInfos = try await profilesQ.map(\.info)
        let profiles = Dictionary(uniqueKeysWithValues: profileInfos.map { ($0.id, $0) })
        let allRoles = try await rolesQ
        let cofounderIds = Set(allRoles.filter { $0.role == "cofounder" }.map(\.userId.uuidString))
        let staffRoleNames: Set<String> = ["admin", "founder", "cofounder", "closer", "setter", "coach", "csm"]
        let teamIds = Array(Set(allRoles.filter { staffRoleNames.contains($0.role) }.map(\.userId.uuidString)))

        let rows = PayoutsCalc.buildRows(
            deals: try await dealsQ.map(\.payoutDeal),
            payments: try await paymentsQ.map { PayoutPaymentEvent(id: $0.id.uuidString, amount: $0.amount, paidAt: $0.paidAt, installmentId: $0.installmentId.uuidString) },
            plans: try await plansQ.map { PayoutPlanRef(id: $0.id.uuidString, setterId: $0.setterId?.uuidString, closerId: $0.closerId?.uuidString, studentName: $0.studentName) },
            profiles: profiles,
            rates: rates,
            cofounderIds: cofounderIds,
            period: period
        )
        let adjustments = try await adjustmentsQ.map(\.entry)
        let owed = PayoutsCalc.memberTotals(rows: rows, profiles: profiles, period: period, adjustments: adjustments)
        return PayoutLedgerData(
            period: period,
            rows: rows,
            owed: owed,
            confirmations: try await confirmationsQ,
            adjustments: adjustments,
            teamIds: teamIds,
            names: profiles.mapValues(\.displayName)
        )
    }

    /// Confirm one member's payout: upsert with the computed total snapshot,
    /// exactly like the web (`amount_paid` survives later ledger edits).
    func confirmPayout(periodStart: String, memberId: String, amount: Double) async throws {
        guard let me = currentUserID, let member = UUID(uuidString: memberId) else { return }
        struct Confirmation: Encodable {
            let periodStart: String
            let userId: UUID
            let amountPaid: Double
            let confirmedBy: UUID
            let confirmedAt: String
            enum CodingKeys: String, CodingKey {
                case periodStart = "period_start", userId = "user_id", amountPaid = "amount_paid"
                case confirmedBy = "confirmed_by", confirmedAt = "confirmed_at"
            }
        }
        let row = Confirmation(
            periodStart: periodStart,
            userId: member,
            amountPaid: (amount * 100).rounded() / 100,
            confirmedBy: me,
            confirmedAt: ISO8601DateFormatter().string(from: Date())
        )
        try await client().from("payout_confirmations").upsert(row).execute()
    }

    func unconfirmPayout(periodStart: String, memberId: String) async throws {
        guard let member = UUID(uuidString: memberId) else { return }
        try await client().from("payout_confirmations")
            .delete()
            .eq("period_start", value: periodStart)
            .eq("user_id", value: member)
            .execute()
    }

    /// Signed payout correction; note is mandatory (DB check enforces ≥3 chars).
    func addPayoutAdjustment(memberId: String, periodStart: String, amount: Double, note: String) async throws {
        guard let me = currentUserID, let member = UUID(uuidString: memberId) else { return }
        struct Adjustment: Encodable {
            let userId: UUID
            let periodStart: String
            let amount: Double
            let note: String
            let createdBy: UUID
            enum CodingKeys: String, CodingKey {
                case userId = "user_id", periodStart = "period_start", amount, note, createdBy = "created_by"
            }
        }
        let row = Adjustment(userId: member, periodStart: periodStart,
                             amount: (amount * 100).rounded() / 100,
                             note: note.trimmingCharacters(in: .whitespacesAndNewlines), createdBy: me)
        try await client().from("payout_adjustments").insert(row).execute()
    }

    func deletePayoutAdjustment(id: String) async throws {
        guard let uuid = UUID(uuidString: id) else { return }
        try await client().from("payout_adjustments").delete().eq("id", value: uuid).execute()
    }
}

// MARK: - Deals + payment plans (Phase E2 — the money writes)

struct PlanHeader: Decodable, Identifiable, Sendable {
    let id: UUID
    let studentId: UUID?
    let studentName: String
    let totalAmount: Double
    let currency: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, studentId = "student_id", studentName = "student_name"
        case totalAmount = "total_amount", currency, createdAt = "created_at"
    }
}

struct PlanPayment: Decodable, Identifiable, Sendable {
    let id: UUID
    let installmentId: UUID
    let sequence: Int?
    let amount: Double
    let currency: String
    let dueDate: String
    let status: String
    let paidAt: String?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id, installmentId = "installment_id", sequence, amount, currency
        case dueDate = "due_date", status, paidAt = "paid_at", notes
    }
}

/// What the Log-a-close composer produced; mirrors the web form payload.
struct NewClose: Sendable {
    var existingStudentId: UUID?
    var newStudentName: String?
    var closerId: UUID
    var setterId: UUID?
    var programType: String   // "1:1 Pathway" | "Group Expertise"
    var totalValue: Double
    var cashUpfront: Double
    var paymentType: String   // pif | deposit | split
    var dealDate: String      // yyyy-MM-dd
    var notes: String?
    var plan: PlanSpec?

    struct PlanSpec: Sendable {
        enum Frequency: String, CaseIterable, Sendable { case monthly, biweekly, weekly }
        enum Mode: Sendable {
            case even(count: Int, firstDue: String, frequency: Frequency)
            case custom(rows: [(amount: Double, dueDate: String)])
        }
        var mode: Mode
    }
}

extension PortalAPI {
    func recentDeals(limit: Int = 60) async throws -> [PayoutDealRow] {
        try await client().from("deals")
            .select("id, student_id, student_name, closer_id, setter_id, program_type, total_value, cash_collected_upfront, payment_type, deal_date, notes")
            .eq("is_demo", value: false)
            .is("voided_at", value: nil)
            .order("deal_date", ascending: false)
            .limit(limit)
            .execute().value
    }

    func paymentPlans() async throws -> (plans: [PlanHeader], payments: [PlanPayment]) {
        async let plansQ: [PlanHeader] = client().from("installments")
            .select("id, student_id, student_name, total_amount, currency, created_at, students!inner(is_demo)")
            .eq("students.is_demo", value: false)
            .is("voided_at", value: nil)
            .order("created_at", ascending: false)
            .execute().value
        async let paymentsQ: [PlanPayment] = client().from("installment_payments")
            .select("id, installment_id, sequence, amount, currency, due_date, status, paid_at, notes, installments!inner(students!inner(is_demo))")
            .eq("installments.students.is_demo", value: false)
            .order("due_date", ascending: true)
            .execute().value
        return (try await plansQ, try await paymentsQ)
    }

    /// Closer/setter pickers, exactly the web's role mix: closers are
    /// closer/coach/admin holders; setters are setter/admin holders.
    func dealPeople() async throws -> (closers: [StaffProfile], setters: [StaffProfile]) {
        let roles = try await staffRoles()
        let closerIDs = Array(Set(roles.filter { ["closer", "coach", "admin"].contains($0.role) }.map(\.userId)))
        let setterIDs = Array(Set(roles.filter { ["setter", "admin"].contains($0.role) }.map(\.userId)))
        let all = try await profiles(ids: Array(Set(closerIDs + setterIDs)))
        let byId = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })
        return (closerIDs.compactMap { byId[$0] }.sorted { ($0.displayName ?? "") < ($1.displayName ?? "") },
                setterIDs.compactMap { byId[$0] }.sorted { ($0.displayName ?? "") < ($1.displayName ?? "") })
    }

    /// The revenue write: optional student create/update, the deal insert,
    /// and the installment plan — same order and column semantics as the web
    /// (`_authenticated.revenue.tsx` submit). Plan failures surface without
    /// rolling back the deal, mirroring the web flow.
    func logClose(_ input: NewClose) async throws {
        guard let me = currentUserID else { throw URLError(.userAuthenticationRequired) }
        struct IDOnly: Decodable { let id: UUID }

        // Pathway drives the coaching allowance: 1:1 gets ten calls.
        let callsAllotted = input.programType == "1:1 Pathway" ? 10 : 0
        var studentId = input.existingStudentId
        var studentName = input.newStudentName?.trimmingCharacters(in: .whitespaces) ?? ""

        if let existing = input.existingStudentId {
            struct NameRow: Decodable {
                let fullName: String
                enum CodingKeys: String, CodingKey { case fullName = "full_name" }
            }
            let row: NameRow = try await client().from("students")
                .select("full_name").eq("id", value: existing).single().execute().value
            studentName = row.fullName
            struct StudentPatch: Encodable {
                let paymentState: String
                let callsIncluded: Int
                let callsAllotted: Int
                enum CodingKeys: String, CodingKey {
                    case paymentState = "payment_state", callsIncluded = "calls_included", callsAllotted = "calls_allotted"
                }
            }
            try await client().from("students")
                .update(StudentPatch(paymentState: input.paymentType == "pif" ? "paid_in_full" : "installments",
                                     callsIncluded: callsAllotted, callsAllotted: callsAllotted))
                .eq("id", value: existing)
                .execute()
        } else if !studentName.isEmpty {
            struct NewStudent: Encodable {
                let fullName: String
                let phase = "onboarding"
                let status = "active"
                let paymentState: String
                let callsIncluded: Int
                let callsAllotted: Int
                enum CodingKeys: String, CodingKey {
                    case fullName = "full_name", phase, status
                    case paymentState = "payment_state", callsIncluded = "calls_included", callsAllotted = "calls_allotted"
                }
            }
            let created: IDOnly = try await client().from("students")
                .insert(NewStudent(fullName: studentName,
                                   paymentState: input.paymentType == "pif" ? "paid_in_full" : "installments",
                                   callsIncluded: callsAllotted, callsAllotted: callsAllotted))
                .select("id").single().execute().value
            studentId = created.id
        }

        struct DealInsert: Encodable {
            let studentId: UUID?
            let studentName: String
            let closerId: UUID
            let setterId: UUID?
            let programType: String
            let totalValue: Double
            let cashCollectedUpfront: Double
            let paymentType: String
            let dealDate: String
            let notes: String?
            let createdBy: UUID
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", studentName = "student_name"
                case closerId = "closer_id", setterId = "setter_id", programType = "program_type"
                case totalValue = "total_value", cashCollectedUpfront = "cash_collected_upfront"
                case paymentType = "payment_type", dealDate = "deal_date", notes, createdBy = "created_by"
            }
        }
        let _: IDOnly = try await client().from("deals")
            .insert(DealInsert(studentId: studentId, studentName: studentName,
                               closerId: input.closerId, setterId: input.setterId,
                               programType: input.programType, totalValue: input.totalValue,
                               cashCollectedUpfront: input.cashUpfront, paymentType: input.paymentType,
                               dealDate: input.dealDate, notes: input.notes, createdBy: me))
            .select("id").single().execute().value

        // Installment plan (never for PIF; needs a linked student, like the web).
        guard let plan = input.plan, let planStudent = studentId else { return }
        let remaining = max(0, input.totalValue - input.cashUpfront)
        guard remaining > 0 else { return }
        struct PlanInsert: Encodable {
            let studentId: UUID
            let studentName: String
            let closerId: UUID
            let setterId: UUID?
            let totalAmount: Double
            let currency = "USD"
            let createdBy: UUID
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", studentName = "student_name"
                case closerId = "closer_id", setterId = "setter_id"
                case totalAmount = "total_amount", currency, createdBy = "created_by"
            }
        }
        let planRow: IDOnly = try await client().from("installments")
            .insert(PlanInsert(studentId: planStudent, studentName: studentName,
                               closerId: input.closerId, setterId: input.setterId,
                               totalAmount: remaining, createdBy: me))
            .select("id").single().execute().value

        struct PaymentInsert: Encodable {
            let installmentId: UUID
            let sequence: Int
            let amount: Double
            let currency = "USD"
            let dueDate: String
            let status = "upcoming"
            enum CodingKeys: String, CodingKey {
                case installmentId = "installment_id", sequence, amount, currency
                case dueDate = "due_date", status
            }
        }
        var rows: [PaymentInsert] = []
        switch plan.mode {
        case let .even(count, firstDue, frequency):
            let n = max(1, min(24, count))
            let per = remaining / Double(n)
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(identifier: "UTC")
            formatter.dateFormat = "yyyy-MM-dd"
            let start = formatter.date(from: firstDue) ?? Date()
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = TimeZone(identifier: "UTC")!
            rows = (0..<n).map { i in
                let due: Date
                switch frequency {
                case .monthly: due = cal.date(byAdding: .month, value: i, to: start) ?? start
                case .biweekly: due = cal.date(byAdding: .day, value: i * 14, to: start) ?? start
                case .weekly: due = cal.date(byAdding: .day, value: i * 7, to: start) ?? start
                }
                return PaymentInsert(installmentId: planRow.id, sequence: i + 1, amount: per, dueDate: formatter.string(from: due))
            }
        case let .custom(customRows):
            rows = customRows
                .filter { $0.amount > 0 }
                .sorted { $0.dueDate < $1.dueDate }
                .enumerated()
                .map { i, r in PaymentInsert(installmentId: planRow.id, sequence: i + 1, amount: r.amount, dueDate: r.dueDate) }
        }
        guard !rows.isEmpty else { return }
        try await client().from("installment_payments").insert(rows).execute()
    }

    /// Mark an installment collected. The web checks Whop first via a server
    /// function; that check is server-only, so iOS records the payment and
    /// lets Finance reconciliation flag any mismatch (the web's fallback path).
    func markInstallmentPaid(id: UUID) async throws {
        try await client().from("installment_payments")
            .update(["status": AnyJSON.string("paid"), "paid_at": .string(ISO8601DateFormatter().string(from: Date()))])
            .eq("id", value: id)
            .execute()
    }

    /// Waive a scheduled payment (never a paid one) with a mandatory reason;
    /// the row is preserved, notes keep the receipt.
    func waiveInstallment(id: UUID, existingNotes: String?, reason: String) async throws {
        let notes = [existingNotes, "Waived: \(reason)"].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "\n")
        try await client().from("installment_payments")
            .update(["status": AnyJSON.string("waived"), "paid_at": .null, "notes": .string(notes)])
            .eq("id", value: id)
            .execute()
    }

    /// The one sanctioned way OFF "paid": a documented refund. Money stops
    /// counting as cash and commission; notes keep the original paid date.
    func refundInstallmentPayment(id: UUID, existingNotes: String?, originallyPaid: String?, reason: String) async throws {
        let today = PayoutPeriods.todayLocal()
        let paidDay = (originallyPaid?.prefix(10)).map(String.init) ?? "unknown"
        let line = "Refunded \(today) (originally paid \(paidDay)): \(reason)"
        let notes = [existingNotes, line].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "\n")
        try await client().from("installment_payments")
            .update(["status": AnyJSON.string("refunded"), "paid_at": .null, "notes": .string(notes)])
            .eq("id", value: id)
            .execute()
    }

    struct RefundResult: Decodable, Sendable {
        let deals: Int?
        let dealsCash: Double?
        let plans: Int?
        let paidPayments: Int?
        let paidCash: Double?
        let waived: Int?
        enum CodingKeys: String, CodingKey {
            case deals, dealsCash = "deals_cash", plans
            case paidPayments = "paid_payments", paidCash = "paid_cash", waived
        }
    }

    /// One-shot student refund via the `refund_student_money` RPC: voids all
    /// active deals and plans, waives unpaid rows, flips paid ones to
    /// refunded, archives the student by default. Admin/closer only (RLS).
    func refundStudentMoney(studentId: UUID, reason: String, archive: Bool = true) async throws -> RefundResult {
        struct Params: Encodable {
            let pStudentId: UUID
            let pReason: String
            let pArchive: Bool
            enum CodingKeys: String, CodingKey {
                case pStudentId = "p_student_id", pReason = "p_reason", pArchive = "p_archive"
            }
        }
        return try await client()
            .rpc("refund_student_money", params: Params(pStudentId: studentId, pReason: reason, pArchive: archive))
            .execute().value
    }
}

// MARK: - Notifications (Phase E2 — the web bell computed natively)

/// One bell row. Families and triggers mirror `notifications-bell.tsx`.
struct PortalAlert: Identifiable, Sendable {
    enum Family: Sendable { case payout, signup, unclaimedSet, setNudge, student, installment }
    enum Tone: Sendable { case danger, warning, neutral, positive }
    let id: String
    let family: Family
    let tone: Tone
    let title: String
    let detail: String
}

struct PortalAlerts: Sendable {
    var alerts: [PortalAlert] = []
    /// Web badge tone: red while anything urgent is open, amber otherwise.
    var badgeIsUrgent = false
    var count: Int { alerts.count }
}

extension PortalAPI {
    /// Whether this role set can ever see a bell family (web gate mirror).
    static func bellApplies(to roles: [PortalRole]) -> Bool {
        let set = Set(roles)
        return !set.isDisjoint(with: [.admin, .founder, .cofounder, .coach, .csm, .closer, .setter])
    }

    /// Compute every alert family this account can see, concurrently; a
    /// failed family contributes nothing (the web's empty-query behavior).
    func portalAlerts(roles: [PortalRole]) async -> PortalAlerts {
        let set = Set(roles)
        let isAdmin = set.contains(.admin)
        let isCoach = set.contains(.coach)
        let isSetter = set.contains(.setter)
        let seesPayouts = !set.isDisjoint(with: [.admin, .founder, .cofounder])
        let canApprove = !set.isDisjoint(with: [.admin, .closer, .csm, .founder, .cofounder])
        let isFulfillment = !set.isDisjoint(with: [.admin, .csm, .coach, .cofounder])

        async let payouts = seesPayouts ? (try? payoutAlerts()) ?? [] : []
        async let signups = canApprove ? (try? pendingSignupCount()) ?? 0 : 0
        async let unclaimed = isSetter ? (try? unclaimedSets()) ?? [] : []
        async let nudges = (try? setNudges()) ?? []
        async let students = isFulfillment ? (try? studentAlerts()) ?? [] : []
        async let reminders = (isAdmin || isCoach) ? (try? installmentReminders(adminScope: isAdmin)) ?? [] : []

        let payoutList = await payouts
        let signupCount = await signups
        let unclaimedList = await unclaimed
        let nudgeList = await nudges
        let studentList = await students
        let reminderList = await reminders

        var out = PortalAlerts()
        out.alerts += payoutList
        if signupCount > 0 {
            out.alerts.append(PortalAlert(
                id: "signups", family: .signup, tone: .warning,
                title: signupCount == 1 ? "1 signup waiting for approval" : "\(signupCount) signups waiting for approval",
                detail: "New portal accounts with no role yet"
            ))
        }
        out.alerts += unclaimedList
        out.alerts += nudgeList
        out.alerts += studentList
        out.alerts += reminderList

        out.badgeIsUrgent = !payoutList.isEmpty
            || reminderList.contains { $0.tone == .danger }
            || !nudgeList.isEmpty
            || !unclaimedList.isEmpty
            || studentList.contains { $0.tone == .danger }
        return out
    }

    /// The two most recently ENDED periods with unconfirmed nonzero payouts
    /// (payout dates are sacred: the alert stays until every member is marked).
    private func payoutAlerts() async throws -> [PortalAlert] {
        var alerts: [PortalAlert] = []
        for offset in [-2, -1] {
            let period = PayoutPeriods.period(offset: offset)
            if period.start < PayoutPeriods.trackingFrom { continue } // settled pre-portal
            if PayoutPeriods.todayLocal() <= period.end { continue }  // payout date not reached
            let ledger = try await payoutLedger(offset: offset)
            let confirmed = Set(ledger.confirmations.map { $0.userId.uuidString })
            let unconfirmed = ledger.owed.filter { !confirmed.contains($0.id) }
            guard !unconfirmed.isEmpty else { continue }
            alerts.append(PortalAlert(
                id: "payout-\(period.start)", family: .payout, tone: .danger,
                title: unconfirmed.count == 1
                    ? "1 payout not confirmed · \(period.label)"
                    : "\(unconfirmed.count) payouts not confirmed · \(period.label)",
                detail: unconfirmed.map(\.name).joined(separator: ", ") + " · mark each one paid"
            ))
        }
        return alerts
    }

    private func pendingSignupCount() async throws -> Int {
        struct Row: Decodable { let id: UUID }
        let rows: [Row] = try await client().rpc("pending_signups").execute().value
        return rows.count
    }

    private struct SetReminderRow: Decodable {
        let id: UUID
        let prospect: String
        let eventStart: String
        let reminderLog: [String: AnyJSON]?
        enum CodingKeys: String, CodingKey {
            case id, prospect, eventStart = "event_start", reminderLog = "reminder_log"
        }
    }

    /// Closing calls nobody has claimed — every setter is pinged until one does.
    private func unclaimedSets() async throws -> [PortalAlert] {
        let rows: [SetReminderRow] = try await client().from("set_reminders")
            .select("id, prospect, event_start")
            .is("owner_id", value: nil)
            .eq("status", value: "active")
            .gte("event_start", value: ISO8601DateFormatter().string(from: Date()))
            .order("event_start")
            .limit(20)
            .execute().value
        return rows.map { row in
            PortalAlert(
                id: "unclaimed-\(row.id.uuidString)", family: .unclaimedSet, tone: .danger,
                title: "New set · \(row.prospect)",
                detail: "\(Self.friendlyEventTime(row.eventStart)) · nobody owns it yet"
            )
        }
    }

    /// My claimed sets with an open, unticked reminder window (48h/24h/3h/1h)
    /// or an unlogged keep-warm touch for today.
    private func setNudges() async throws -> [PortalAlert] {
        guard let me = currentUserID else { return [] }
        let rows: [SetReminderRow] = try await client().from("set_reminders")
            .select("id, prospect, event_start, reminder_log")
            .eq("owner_id", value: me)
            .eq("status", value: "active")
            .gte("event_start", value: ISO8601DateFormatter().string(from: Date()))
            .order("event_start")
            .limit(30)
            .execute().value
        let windows: [(key: String, minutes: Double)] = [("48h", 48 * 60), ("24h", 24 * 60), ("3h", 3 * 60), ("1h", 60)]
        let now = Date()
        let todayKey = "warm:" + PayoutPeriods.todayLocal()
        var out: [PortalAlert] = []
        for row in rows {
            guard let start = Self.parseTimestamp(row.eventStart) else { continue }
            let msLeft = start.timeIntervalSince(now)
            let log = row.reminderLog ?? [:]
            let due = windows.filter { msLeft <= $0.minutes * 60 && log[$0.key] == nil }
            if let window = due.last {
                out.append(PortalAlert(
                    id: "nudge-\(row.id.uuidString)", family: .setNudge, tone: .warning,
                    title: "Remind \(row.prospect)",
                    detail: "\(window.key) window open · call \(Self.friendlyEventTime(row.eventStart))"
                ))
            } else if msLeft > 48 * 3600, log[todayKey] == nil {
                let days = Int((msLeft / 86_400).rounded())
                out.append(PortalAlert(
                    id: "nudge-\(row.id.uuidString)", family: .setNudge, tone: .warning,
                    title: "Remind \(row.prospect)",
                    detail: "keep warm · call in \(days)d"
                ))
            }
        }
        return out
    }

    /// Computed fulfillment alerts, same trigger set as the web bell: fresh
    /// Start Here completions, stuck onboarding, missed student EODs, payment
    /// behind, stale 1:1 cadence, interviews inside 48h.
    private func studentAlerts() async throws -> [PortalAlert] {
        struct AlertStudent: Decodable {
            let id: UUID
            let fullName: String
            let phase: String?
            let paymentState: String?
            let eodExempt: Bool?
            let onboardingCompletedAt: String?
            let createdAt: String?
            let callsAllotted: Int?
            enum CodingKeys: String, CodingKey {
                case id, fullName = "full_name", phase, paymentState = "payment_state"
                case eodExempt = "eod_exempt", onboardingCompletedAt = "onboarding_completed_at"
                case createdAt = "created_at", callsAllotted = "calls_allotted"
            }
        }
        struct EODStamp: Decodable {
            let studentId: UUID
            let reportDate: String
            enum CodingKeys: String, CodingKey { case studentId = "student_id", reportDate = "report_date" }
        }
        struct CallStamp: Decodable {
            let studentId: UUID
            let callDate: String
            enum CodingKeys: String, CodingKey { case studentId = "student_id", callDate = "call_date" }
        }
        struct PlacementRow: Decodable {
            let studentId: UUID
            let businessName: String
            let interviewAt: String?
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", businessName = "business_name", interviewAt = "interview_at"
            }
        }
        struct GuideStepRow: Decodable {
            let studentId: UUID
            let stepKey: String
            let doneAt: String?
            enum CodingKeys: String, CodingKey { case studentId = "student_id", stepKey = "step_key", doneAt = "done_at" }
        }

        let day: TimeInterval = 86_400
        let now = Date()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        let thirty = formatter.string(from: now.addingTimeInterval(-30 * day))
        let sixty = formatter.string(from: now.addingTimeInterval(-60 * day))

        async let studentsQ: [AlertStudent] = client().from("students")
            .select("id, full_name, phase, payment_state, eod_exempt, onboarding_completed_at, created_at, calls_allotted")
            .eq("is_demo", value: false)
            .eq("status", value: "active")
            .is("archived_at", value: nil)
            .execute().value
        async let eodsQ: [EODStamp] = client().from("student_eods")
            .select("student_id, report_date, students!inner(is_demo, archived_at)")
            .eq("students.is_demo", value: false)
            .is("students.archived_at", value: nil)
            .gte("report_date", value: thirty)
            .execute().value
        async let callsQ: [CallStamp] = client().from("student_calls")
            .select("student_id, call_date, students!inner(is_demo, archived_at)")
            .eq("students.is_demo", value: false)
            .is("students.archived_at", value: nil)
            .is("voided_at", value: nil)
            .eq("status", value: "completed")
            .gte("call_date", value: sixty)
            .execute().value
        async let placementsQ: [PlacementRow] = client().from("student_placements")
            .select("student_id, business_name, interview_at, students!inner(is_demo, archived_at)")
            .eq("students.is_demo", value: false)
            .is("students.archived_at", value: nil)
            .is("voided_at", value: nil)
            .not("interview_at", operator: .is, value: "null")
            .execute().value
        async let stepsQ: [GuideStepRow] = client().from("student_guide_steps")
            .select("student_id, step_key, done_at, students!inner(is_demo, archived_at)")
            .eq("students.is_demo", value: false)
            .is("students.archived_at", value: nil)
            .execute().value

        // Same required-step list as the web Start Here checklist.
        let startHereSteps: [(key: String, shortLabel: String)] = [
            ("typeform", "Onboarding form"),
            ("offer_board", "Join offer board"),
            ("offer_board_loom", "Offer board Loom"),
            ("skool_training", "Skool training"),
            ("offer_board_course", "Offer board course"),
        ]
        let requiredKeys = startHereSteps.map(\.key)

        var lastEOD: [UUID: String] = [:]
        for e in try await eodsQ where e.reportDate > (lastEOD[e.studentId] ?? "") { lastEOD[e.studentId] = e.reportDate }
        var lastCall: [UUID: String] = [:]
        for c in try await callsQ where c.callDate > (lastCall[c.studentId] ?? "") { lastCall[c.studentId] = c.callDate }
        var stepsDone: [UUID: [String]] = [:]
        var lastStepAt: [UUID: String] = [:]
        for g in try await stepsQ {
            if requiredKeys.contains(g.stepKey) { stepsDone[g.studentId, default: []].append(g.stepKey) }
            if let done = g.doneAt, done > (lastStepAt[g.studentId] ?? "") { lastStepAt[g.studentId] = done }
        }

        let daysSince = { (stamp: String) -> Int? in
            guard let date = Self.parseTimestamp(stamp) ?? formatter.date(from: String(stamp.prefix(10))) else { return nil }
            return Int(floor(now.timeIntervalSince(date) / day))
        }

        var alerts: [PortalAlert] = []
        let students = try await studentsQ
        for st in students {
            // Fresh unlock (real completions only, not backfills).
            if let completed = st.onboardingCompletedAt, st.createdAt != completed,
               let completedDate = Self.parseTimestamp(completed),
               now.timeIntervalSince(completedDate) <= 3 * day {
                alerts.append(PortalAlert(id: "onb-\(st.id.uuidString)", family: .student, tone: .positive,
                                          title: st.fullName, detail: "Completed Start Here onboarding · portal unlocked"))
            }
            // Locked and not moving: no Start Here progress in 3+ days.
            if st.onboardingCompletedAt == nil {
                let lastActivity = lastStepAt[st.id] ?? st.createdAt ?? ""
                if let stuckDays = (lastActivity.isEmpty ? nil : daysSince(lastActivity)), stuckDays >= 3 {
                    let doneKeys = stepsDone[st.id] ?? []
                    let next = startHereSteps.first { !doneKeys.contains($0.key) }
                    let progress = "\(doneKeys.count)/\(requiredKeys.count)" + (next.map { " · on: \($0.shortLabel)" } ?? "")
                    alerts.append(PortalAlert(id: "stuck-\(st.id.uuidString)", family: .student,
                                              tone: stuckDays >= 7 ? .danger : .warning,
                                              title: st.fullName, detail: "Stuck in Start Here \(stuckDays)d (\(progress))"))
                }
            }
            // Missed student EODs — never while exempt, locked, or graduated.
            let graduated = ["offer_won", "testimonial", "graduated"].contains(st.phase ?? "")
            if st.eodExempt != true, st.onboardingCompletedAt != nil, !graduated {
                if let eodDate = lastEOD[st.id] {
                    if let days = daysSince(eodDate), days >= 3 {
                        alerts.append(PortalAlert(id: "eod-\(st.id.uuidString)", family: .student,
                                                  tone: days >= 5 ? .danger : .warning,
                                                  title: st.fullName, detail: "No EOD in \(days) days"))
                    }
                } else {
                    alerts.append(PortalAlert(id: "eod-\(st.id.uuidString)", family: .student, tone: .danger,
                                              title: st.fullName, detail: "No EOD in the last 30 days"))
                }
            }
            if st.paymentState == "behind" {
                alerts.append(PortalAlert(id: "pay-\(st.id.uuidString)", family: .student, tone: .danger,
                                          title: st.fullName, detail: "Payment behind"))
            }
            // 1:1 cadence: unlocked, 1:1 pathway, active coaching phases only.
            if st.onboardingCompletedAt != nil, (st.callsAllotted ?? 0) > 0,
               ["training", "coaching_1on1", "applying"].contains(st.phase ?? "") {
                let callDays = lastCall[st.id].flatMap(daysSince)
                if callDays == nil || callDays! > 14 {
                    alerts.append(PortalAlert(id: "call-\(st.id.uuidString)", family: .student, tone: .warning,
                                              title: st.fullName,
                                              detail: callDays.map { "No 1-on-1 in \($0) days" } ?? "No 1-on-1 on record"))
                }
            }
        }
        let nameById = Dictionary(uniqueKeysWithValues: students.map { ($0.id, $0.fullName) })
        for pl in try await placementsQ {
            guard let stamp = pl.interviewAt, let t = Self.parseTimestamp(stamp) else { continue }
            let interval = t.timeIntervalSince(now)
            if interval > 0, interval <= 48 * 3600 {
                let hours = max(1, Int((interval / 3600).rounded()))
                alerts.append(PortalAlert(id: "int-\(pl.studentId.uuidString)-\(stamp)", family: .student, tone: .positive,
                                          title: nameById[pl.studentId] ?? "Student",
                                          detail: "Interview at \(pl.businessName) in \(hours)h"))
            }
        }
        // Worst first: time-sensitive positives on top, then reds, then ambers.
        let rank = { (a: PortalAlert) -> Int in
            if a.id.hasPrefix("int-") || a.id.hasPrefix("onb-") { return 0 }
            return a.tone == .danger ? 1 : 2
        }
        return Array(alerts.sorted { rank($0) < rank($1) }.prefix(30))
    }

    /// Installments due inside 3 days (or overdue while still "upcoming");
    /// coaches see only their own plans, admins see all — the web scope.
    private func installmentReminders(adminScope: Bool) async throws -> [PortalAlert] {
        struct ReminderRow: Decodable {
            let id: UUID
            let amount: Double
            let currency: String
            let dueDate: String
            let installments: Inst
            struct Inst: Decodable {
                let students: Stu
                struct Stu: Decodable {
                    let fullName: String
                    enum CodingKeys: String, CodingKey { case fullName = "full_name" }
                }
            }
            enum CodingKeys: String, CodingKey {
                case id, amount, currency, dueDate = "due_date", installments
            }
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let to = formatter.string(from: Date().addingTimeInterval(3 * 86_400))
        var query = try client().from("installment_payments")
            .select("id, amount, currency, due_date, installments!inner(coach_id, student_id, students!inner(full_name, is_demo))")
            .eq("installments.students.is_demo", value: false)
            .eq("status", value: "upcoming")
            .lte("due_date", value: to)
        if !adminScope, let me = currentUserID {
            query = query.eq("installments.coach_id", value: me)
        }
        let rows: [ReminderRow] = try await query
            .order("due_date", ascending: true)
            .limit(50)
            .execute().value
        let cal = Calendar.current
        let todayDate = cal.startOfDay(for: Date())
        return rows.map { row in
            let due = formatter.date(from: row.dueDate).map { cal.startOfDay(for: $0) }
            let days = due.map { Int(($0.timeIntervalSince(todayDate) / 86_400).rounded()) } ?? 0
            let bucket: (text: String, urgent: Bool)
            switch days {
            case ..<0: bucket = ("overdue \(abs(days))d", true)
            case 0: bucket = ("due today", false)
            case 1: bucket = ("due tomorrow", false)
            default: bucket = ("due in \(days)d", false)
            }
            let amount = row.amount.formatted(.currency(code: row.currency.isEmpty ? "USD" : row.currency).locale(Locale(identifier: "en_US")).precision(.fractionLength(0)))
            return PortalAlert(
                id: "inst-\(row.id.uuidString)", family: .installment,
                tone: bucket.urgent ? .danger : .warning,
                title: row.installments.students.fullName,
                detail: "\(amount) \(bucket.text)"
            )
        }
    }

    // MARK: - Money strip (web home-money-strip.tsx, Phase E3)

    /// Cash collected this month: logged deals upfront + installments PAID in
    /// the window — the ONLY collected-cash definition (cofounder-directed
    /// 2026-07-27). Whop-net needs the server; iOS ships the logged fallback
    /// with the web's own honest label.
    func collectedCashMonth() async throws -> Double {
        let today = PayoutPeriods.todayLocal()
        let monthStart = String(today.prefix(8)) + "01"
        struct DealCash: Decodable {
            let cashCollectedUpfront: Double?
            enum CodingKeys: String, CodingKey { case cashCollectedUpfront = "cash_collected_upfront" }
        }
        struct PaidCash: Decodable { let amount: Double }
        async let dealsQ: [DealCash] = client().from("deals")
            .select("cash_collected_upfront, deal_date")
            .eq("is_demo", value: false)
            .is("voided_at", value: nil)
            .gte("deal_date", value: monthStart)
            .lte("deal_date", value: today)
            .execute().value
        async let paidQ: [PaidCash] = client().from("installment_payments")
            .select("amount, installments!inner(students!inner(is_demo))")
            .eq("installments.students.is_demo", value: false)
            .eq("status", value: "paid")
            .gte("paid_at", value: monthStart + "T00:00:00Z")
            .lte("paid_at", value: today + "T23:59:59Z")
            .execute().value
        let dealCash = try await dealsQ.reduce(0) { $0 + ($1.cashCollectedUpfront ?? 0) }
        let paidCash = try await paidQ.reduce(0) { $0 + $1.amount }
        return dealCash + paidCash
    }

    /// One day of collected cash for the Mercury balance chart.
    struct CashDay: Identifiable, Sendable {
        let id: String      // yyyy-MM-dd
        let amount: Double
    }

    /// Daily collected cash for the last `days` days — the same money truth
    /// as collectedCashMonth (deal upfront by deal_date + paid installments
    /// by paid_at), bucketed per local day for the Home balance chart.
    func dailyCashSeries(days: Int = 30) async throws -> [CashDay] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        let start = calendar.date(byAdding: .day, value: -(days - 1), to: today) ?? today
        let startDay = f.string(from: start)
        let todayDay = f.string(from: today)

        struct DealCash: Decodable {
            let cashCollectedUpfront: Double?
            let dealDate: String
            enum CodingKeys: String, CodingKey {
                case cashCollectedUpfront = "cash_collected_upfront", dealDate = "deal_date"
            }
        }
        struct PaidCash: Decodable {
            let amount: Double
            let paidAt: String?
            enum CodingKeys: String, CodingKey { case amount, paidAt = "paid_at" }
        }
        async let dealsQ: [DealCash] = client().from("deals")
            .select("cash_collected_upfront, deal_date")
            .eq("is_demo", value: false)
            .is("voided_at", value: nil)
            .gte("deal_date", value: startDay)
            .lte("deal_date", value: todayDay)
            .execute().value
        async let paidQ: [PaidCash] = client().from("installment_payments")
            .select("amount, paid_at, installments!inner(students!inner(is_demo))")
            .eq("installments.students.is_demo", value: false)
            .eq("status", value: "paid")
            .gte("paid_at", value: startDay + "T00:00:00Z")
            .execute().value

        var byDay: [String: Double] = [:]
        for deal in try await dealsQ {
            byDay[String(deal.dealDate.prefix(10)), default: 0] += deal.cashCollectedUpfront ?? 0
        }
        for payment in try await paidQ {
            guard let stamp = payment.paidAt else { continue }
            let day: String
            if let date = PortalAPI.parseTimestamp(stamp) {
                day = f.string(from: date)
            } else {
                day = String(stamp.prefix(10))
            }
            byDay[day, default: 0] += payment.amount
        }
        return (0..<days).compactMap { back -> CashDay? in
            guard let date = calendar.date(byAdding: .day, value: -(days - 1 - back), to: today) else { return nil }
            let key = f.string(from: date)
            return CashDay(id: key, amount: byDay[key] ?? 0)
        }
    }

    struct PayoutTile: Sendable {
        let periodLabel: String
        let remaining: Double
        let paidSum: Double
        let allPaid: Bool
    }

    /// "Left to pay out" for the CURRENT period, truth-first: confirmed
    /// members drop out; a fully settled period reports what was paid.
    func payoutTile() async throws -> PayoutTile {
        let ledger = try await payoutLedger(offset: 0)
        let confirmed = ledger.confirmedByUser
        let remaining = ledger.owed.filter { confirmed[$0.id] == nil }.reduce(0) { $0 + $1.total }
        let paidSum = ledger.confirmations.reduce(0) { $0 + $1.amountPaid }
        let allPaid = !ledger.confirmations.isEmpty && ledger.owed.allSatisfy { confirmed[$0.id] != nil }
        return PayoutTile(periodLabel: ledger.period.label, remaining: remaining, paidSum: paidSum, allPaid: allPaid)
    }

    // MARK: - Knowledge (docs, Phase E3)

    struct Doc: Decodable, Identifiable, Sendable {
        let id: UUID
        let title: String
        let slug: String
        let category: String
        let content: String
        let pinned: Bool?
        let updatedAt: String
        let externalLinks: [ExternalLink]?

        struct ExternalLink: Decodable, Sendable, Hashable {
            let label: String
            let url: String
        }

        enum CodingKeys: String, CodingKey {
            case id, title, slug, category, content, pinned
            case updatedAt = "updated_at", externalLinks = "external_links"
        }
    }

    /// Team docs; RLS scopes rows to the reader's roles via role_visibility,
    /// so this query is identical to the web's.
    func docs() async throws -> [Doc] {
        try await client().from("docs")
            .select("id, title, slug, category, content, pinned, updated_at, external_links")
            .eq("is_founder_only", value: false)
            .order("pinned", ascending: false)
            .order("sort_order", ascending: true)
            .order("updated_at", ascending: false)
            .execute().value
    }

    // MARK: - Student health (web use-student-health.ts, Phase E3)

    /// One fetch, health for every active student — the same five reads and
    /// aggregation the web hook performs, scored by the ported formula.
    func studentHealthMap() async throws -> [UUID: StudentHealthResult] {
        struct HealthStudent: Decodable {
            let id: UUID
            let status: String?
            let phase: String?
            let paymentState: String?
            let eodExempt: Bool?
            let onboardingCompletedAt: String?
            let callsAllotted: Int?
            enum CodingKeys: String, CodingKey {
                case id, status, phase, paymentState = "payment_state"
                case eodExempt = "eod_exempt", onboardingCompletedAt = "onboarding_completed_at"
                case callsAllotted = "calls_allotted"
            }
        }
        struct HealthEOD: Decodable {
            let studentId: UUID
            let reportDate: String
            let roleplays: Int?
            let loomsSent: Int?
            let applicationsSubmitted: Int?
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", reportDate = "report_date"
                case roleplays, loomsSent = "looms_sent", applicationsSubmitted = "applications_submitted"
            }
        }
        struct HealthItem: Decodable {
            let studentId: UUID?
            let dueDate: String?
            enum CodingKeys: String, CodingKey { case studentId = "student_id", dueDate = "due_date" }
        }
        struct HealthCall: Decodable {
            let studentId: UUID
            let callDate: String
            enum CodingKeys: String, CodingKey { case studentId = "student_id", callDate = "call_date" }
        }
        struct HealthPlacement: Decodable {
            let studentId: UUID
            let stage: String?
            let updatedAt: String?
            let interviewAt: String?
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", stage, updatedAt = "updated_at", interviewAt = "interview_at"
            }
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let sixty = formatter.string(from: Date().addingTimeInterval(-59 * 86_400))
        let fourteen = formatter.string(from: Date().addingTimeInterval(-13 * 86_400))
        let today = PayoutPeriods.todayLocal()

        async let studentsQ: [HealthStudent] = client().from("students")
            .select("id, status, phase, payment_state, eod_exempt, onboarding_completed_at, calls_allotted")
            .eq("is_demo", value: false)
            .is("archived_at", value: nil)
            .execute().value
        async let eodsQ: [HealthEOD] = client().from("student_eods")
            .select("student_id, report_date, roleplays, looms_sent, applications_submitted, students!inner(is_demo)")
            .eq("students.is_demo", value: false)
            .gte("report_date", value: sixty)
            .execute().value
        async let itemsQ: [HealthItem] = client().from("student_action_items")
            .select("student_id, due_date, students!inner(is_demo)")
            .eq("is_demo", value: false)
            .eq("students.is_demo", value: false)
            .eq("done", value: false)
            .execute().value
        async let callsQ: [HealthCall] = client().from("student_calls")
            .select("student_id, call_date, students!inner(is_demo)")
            .eq("students.is_demo", value: false)
            .is("voided_at", value: nil)
            .eq("status", value: "completed")
            .gte("call_date", value: sixty)
            .execute().value
        async let placementsQ: [HealthPlacement] = client().from("student_placements")
            .select("student_id, stage, updated_at, interview_at, students!inner(is_demo)")
            .eq("students.is_demo", value: false)
            .is("voided_at", value: nil)
            .execute().value

        var eodsBy: [UUID: [HealthEOD]] = [:]
        for e in try await eodsQ { eodsBy[e.studentId, default: []].append(e) }
        var itemsBy: [UUID: (overdue: Int, open: Int)] = [:]
        for item in try await itemsQ {
            guard let sid = item.studentId else { continue }
            var row = itemsBy[sid] ?? (0, 0)
            row.open += 1
            if let due = item.dueDate, due < today { row.overdue += 1 }
            itemsBy[sid] = row
        }
        var lastCallBy: [UUID: String] = [:]
        for c in try await callsQ where c.callDate > (lastCallBy[c.studentId] ?? "") { lastCallBy[c.studentId] = c.callDate }
        var placementsBy: [UUID: [HealthPlacement]] = [:]
        for p in try await placementsQ { placementsBy[p.studentId, default: []].append(p) }

        let nowISO = ISO8601DateFormatter().string(from: Date())
        var map: [UUID: StudentHealthResult] = [:]
        for s in try await studentsQ {
            let es = eodsBy[s.id] ?? []
            let recent14 = es.filter { $0.reportDate >= fourteen }
            let pls = placementsBy[s.id] ?? []
            let items = itemsBy[s.id] ?? (0, 0)
            map[s.id] = StudentHealthCalc.compute(StudentHealthInputs(
                status: s.status ?? "active",
                phase: s.phase ?? "onboarding",
                paymentState: s.paymentState,
                eodDates: es.map(\.reportDate),
                roleplays14: recent14.reduce(0) { $0 + ($1.roleplays ?? 0) },
                looms14: recent14.reduce(0) { $0 + ($1.loomsSent ?? 0) },
                apps14: recent14.reduce(0) { $0 + ($1.applicationsSubmitted ?? 0) },
                overdueItems: items.overdue,
                openItems: items.open,
                lastCallDate: lastCallBy[s.id],
                callsAllotted: s.callsAllotted ?? 0,
                placementStages: pls.compactMap(\.stage),
                placementActivity14: pls.contains { ($0.updatedAt ?? "") >= fourteen },
                interviewUpcoming: pls.contains { ($0.interviewAt ?? "") > nowISO },
                eodExempt: s.eodExempt ?? false,
                locked: s.onboardingCompletedAt == nil
            ))
        }
        return map
    }

    // MARK: - Student writes (canManage = admin/coach/csm, Phase E3)

    func updateStudentPhase(id: UUID, phase: String) async throws {
        try await client().from("students").update(["phase": phase]).eq("id", value: id).execute()
    }

    func assignCoach(studentId: UUID, coachId: UUID?) async throws {
        let value: AnyJSON = coachId.map { .string($0.uuidString) } ?? .null
        try await client().from("students").update(["coach_id": value]).eq("id", value: studentId).execute()
    }

    /// Archive removes the student from every roster while preserving money
    /// and EOD history; restore clears the flag and reactivates. The web sets
    /// BOTH status and archived_at — status-filtered reads must agree.
    func archiveStudent(id: UUID) async throws {
        try await client().from("students")
            .update(["archived_at": AnyJSON.string(ISO8601DateFormatter().string(from: Date())), "status": .string("inactive")])
            .eq("id", value: id)
            .execute()
    }

    /// One-tap student check-in (`student_checkins` — the table the founder's
    /// coverage tiles and coldest-student lists read; csm_tally alone never
    /// moves them).
    func logCheckin(studentId: UUID, note: String? = nil) async throws {
        guard let me = currentUserID else { return }
        struct Checkin: Encodable {
            let studentId: UUID
            let csmId: UUID
            let note: String?
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", csmId = "csm_id", note
            }
        }
        try await client().from("student_checkins")
            .insert(Checkin(studentId: studentId, csmId: me, note: note))
            .execute()
    }

    /// CSM note on a student — renders verbatim on the founder's fulfillment
    /// Home and counts toward per-CSM weekly activity.
    func addCSMNote(studentId: UUID, note: String) async throws {
        guard let me = currentUserID else { return }
        struct Note: Encodable {
            let studentId: UUID
            let userId: UUID
            let note: String
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", userId = "user_id", note
            }
        }
        try await client().from("csm_student_notes")
            .insert(Note(studentId: studentId, userId: me, note: note))
            .execute()
    }

    func restoreStudent(id: UUID) async throws {
        try await client().from("students")
            .update(["archived_at": AnyJSON.null, "status": .string("active")])
            .eq("id", value: id)
            .execute()
    }

    // MARK: - My profile (Phase E3)

    struct MyProfile: Decodable, Sendable {
        let displayName: String?
        let phone: String?
        let timezone: String?
        enum CodingKeys: String, CodingKey {
            case displayName = "display_name", phone, timezone
        }
    }

    func myProfile() async throws -> MyProfile {
        guard let me = currentUserID else { throw URLError(.userAuthenticationRequired) }
        return try await client().from("profiles")
            .select("display_name, phone, timezone")
            .eq("id", value: me)
            .single()
            .execute().value
    }

    func updateMyDisplayName(_ name: String) async throws {
        guard let me = currentUserID else { return }
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let value: AnyJSON = clean.isEmpty ? .null : .string(clean)
        try await client().from("profiles").update(["display_name": value]).eq("id", value: me).execute()
    }

    func updateMyPhone(_ phone: String) async throws {
        guard let me = currentUserID else { return }
        let clean = phone.trimmingCharacters(in: .whitespaces)
        let value: AnyJSON = clean.isEmpty ? .null : .string(clean)
        try await client().from("profiles").update(["phone": value]).eq("id", value: me).execute()
    }

    /// The signed-in member's own staff EODs (the `eods` table — NOT
    /// setter_daily_logs, which is the Mochi set tracker). Feeds the EOD
    /// tab's week card and recent-reports list.
    struct MyEOD: Decodable, Identifiable, Sendable {
        let id: UUID
        let reportDate: String
        let dials: Int?
        let dmsSent: Int?
        let leadsContacted: Int?
        let convosStarted: Int?
        let callsBooked: Int?
        let shows: Int?
        let noShows: Int?
        let closes: Int?

        enum CodingKeys: String, CodingKey {
            case id, reportDate = "report_date", dials, dmsSent = "dms_sent"
            case leadsContacted = "leads_contacted", convosStarted = "convos_started"
            case callsBooked = "calls_booked", shows, noShows = "no_shows", closes
        }
    }

    func myEODs(days: Int = 7) async throws -> [MyEOD] {
        guard let me = currentUserID else { return [] }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        let from = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        return try await client().from("eods")
            .select("id, report_date, dials, dms_sent, leads_contacted, convos_started, calls_booked, shows, no_shows, closes")
            .eq("user_id", value: me)
            .gte("report_date", value: formatter.string(from: from))
            .order("report_date", ascending: false)
            .execute()
            .value
    }

    /// Whether the signed-in member still owes TODAY's EOD (web topbar nag).
    /// Filers = operating roles minus founder accounts and eod_exempt
    /// profiles; the report day follows `profiles.timezone` when set. Errors
    /// return false — never nag on unverified data.
    func owesTodayEOD(roles: [PortalRole]) async -> Bool {
        guard let me = currentUserID else { return false }
        guard !roles.isEmpty, !roles.contains(.founder) else { return false }
        let filing: Set<PortalRole> = [.admin, .cofounder, .closer, .setter, .csm, .coach]
        guard !filing.isDisjoint(with: Set(roles)) else { return false }
        struct ProfileRow: Decodable {
            let eodExempt: Bool?
            let timezone: String?
            enum CodingKeys: String, CodingKey { case eodExempt = "eod_exempt", timezone }
        }
        guard let profile: ProfileRow = try? await client().from("profiles")
            .select("eod_exempt, timezone").eq("id", value: me).single().execute().value
        else { return false }
        if profile.eodExempt == true { return false }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        if let tz = profile.timezone, let zone = TimeZone(identifier: tz) { formatter.timeZone = zone }
        struct EODRow: Decodable { let id: UUID }
        guard let rows: [EODRow] = try? await client().from("eods")
            .select("id").eq("user_id", value: me)
            .eq("report_date", value: formatter.string(from: Date()))
            .execute().value
        else { return false }
        return rows.isEmpty
    }

    /// Setter type lives on the profile (web parity: it drives the daily KPI
    /// on every surface, so it can never be a device-local preference).
    func mySetterType() async throws -> String? {
        guard let me = currentUserID else { return nil }
        struct Row: Decodable { let setterType: String?; enum CodingKeys: String, CodingKey { case setterType = "setter_type" } }
        let row: Row = try await client().from("profiles")
            .select("setter_type")
            .eq("id", value: me)
            .single()
            .execute().value
        return row.setterType
    }

    func updateMySetterType(_ type: String) async throws {
        guard let me = currentUserID else { return }
        try await client().from("profiles").update(["setter_type": type]).eq("id", value: me).execute()
    }

    /// Timezone is load-bearing: the EOD form day follows it when set.
    func updateMyTimezone(_ timezone: String) async throws {
        guard let me = currentUserID else { return }
        try await client().from("profiles").update(["timezone": timezone]).eq("id", value: me).execute()
    }

    // MARK: - Access defaults, sets, payment links, wallet (gap batch 2026-08-15)

    /// Admin-managed page/money visibility rows (web `role_access`).
    func roleAccess() async throws -> [RoleAccessRow] {
        struct Row: Decodable {
            let role: String
            let hiddenPages: [String]
            let grantedPages: [String]
            let hideMoney: Bool
            enum CodingKeys: String, CodingKey {
                case role, hiddenPages = "hidden_pages", grantedPages = "granted_pages", hideMoney = "hide_money"
            }
        }
        let rows: [Row] = try await client().from("role_access")
            .select("role, hidden_pages, granted_pages, hide_money")
            .execute().value
        return rows.map { RoleAccessRow(role: $0.role, hiddenPages: $0.hiddenPages, grantedPages: $0.grantedPages, hideMoney: $0.hideMoney) }
    }

    struct SetReminderFull: Decodable, Identifiable, Sendable {
        let id: UUID
        let prospect: String
        let eventStart: String
        let ownerId: UUID?
        let status: String
        let confirmedAt: String?
        let notes: String?
        let reminderLog: [String: AnyJSON]?

        enum CodingKeys: String, CodingKey {
            case id, prospect, eventStart = "event_start", ownerId = "owner_id"
            case status, confirmedAt = "confirmed_at", notes, reminderLog = "reminder_log"
        }

        func ticked(_ window: String) -> Bool { reminderLog?[window] != nil }
    }

    /// My upcoming claimed sets (owner-scoped RLS).
    func myUpcomingSets() async throws -> [SetReminderFull] {
        guard let me = currentUserID else { return [] }
        return try await client().from("set_reminders")
            .select("id, prospect, event_start, owner_id, status, confirmed_at, notes, reminder_log")
            .eq("owner_id", value: me)
            .eq("status", value: "active")
            .gte("event_start", value: ISO8601DateFormatter().string(from: Date()))
            .order("event_start")
            .limit(20)
            .execute().value
    }

    /// Upcoming sets nobody owns yet — visible so setters know they exist;
    /// claiming stays on the web (its server flow also syncs the calendar).
    func unclaimedUpcomingSets() async throws -> [SetReminderFull] {
        try await client().from("set_reminders")
            .select("id, prospect, event_start, owner_id, status, confirmed_at, notes, reminder_log")
            .is("owner_id", value: nil)
            .eq("status", value: "active")
            .gte("event_start", value: ISO8601DateFormatter().string(from: Date()))
            .order("event_start")
            .limit(20)
            .execute().value
    }

    /// Tick one reminder window (48h/24h/3h/1h or a keep-warm day key) on my
    /// own set. reminder_log is replaced wholesale, so merge before writing —
    /// pure tracking columns; no calendar side effects (RLS: own rows only).
    func tickSetReminder(_ set: SetReminderFull, window: String) async throws {
        var log = set.reminderLog ?? [:]
        log[window] = .string(ISO8601DateFormatter().string(from: Date()))
        try await client().from("set_reminders")
            .update(["reminder_log": AnyJSON.object(log)])
            .eq("id", value: set.id)
            .execute()
    }

    /// Confirm the prospect for my set (confirmed_at stamp, web semantics).
    func confirmSet(id: UUID) async throws {
        try await client().from("set_reminders")
            .update(["confirmed_at": ISO8601DateFormatter().string(from: Date())])
            .eq("id", value: id)
            .execute()
    }

    struct PaymentLink: Decodable, Identifiable, Sendable {
        let id: UUID
        let label: String
        let currency: String
        let amount: Double?
        let url: String?
        let method: String
        let notes: String?

        enum CodingKeys: String, CodingKey {
            case id, label, currency, amount, url, method, notes
        }
    }

    /// Active payment links, web sort — the closer's mid-call copy list.
    func paymentLinks() async throws -> [PaymentLink] {
        try await client().from("payment_links")
            .select("id, label, currency, amount, url, method, notes")
            .eq("active", value: true)
            .order("sort_order", ascending: true)
            .execute().value
    }

    struct WalletSummary: Sendable {
        var loaded: Double = 0
        var spent: Double = 0
        var balance: Double { loaded - spent }
        var recent: [WalletEntry] = []
    }

    struct WalletEntry: Decodable, Identifiable, Sendable {
        let id: UUID
        let entryDate: String
        let kind: String   // credit | spend
        let amount: Double
        let note: String

        enum CodingKeys: String, CodingKey {
            case id, entryDate = "entry_date", kind, amount, note
        }
    }

    /// My card ledger (web home-card-tile): balance = credits − spends.
    func myWallet() async throws -> WalletSummary {
        guard let me = currentUserID else { return WalletSummary() }
        let rows: [WalletEntry] = try await client().from("wallet_entries")
            .select("id, entry_date, kind, amount, note")
            .eq("user_id", value: me)
            .order("entry_date", ascending: false)
            .order("created_at", ascending: false)
            .limit(120)
            .execute().value
        var summary = WalletSummary()
        summary.loaded = rows.filter { $0.kind == "credit" }.reduce(0) { $0 + $1.amount }
        summary.spent = rows.filter { $0.kind == "spend" }.reduce(0) { $0 + $1.amount }
        summary.recent = Array(rows.prefix(6))
        return summary
    }

    /// Latest check-in per student (feeds the CSM coldest-first queue).
    func latestCheckins(days: Int = 45) async throws -> [UUID: String] {
        struct Stamp: Decodable {
            let studentId: UUID
            let checkedAt: String
            enum CodingKeys: String, CodingKey { case studentId = "student_id", checkedAt = "checked_at" }
        }
        let since = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-Double(days) * 86_400))
        let rows: [Stamp] = try await client().from("student_checkins")
            .select("student_id, checked_at, students!inner(is_demo, archived_at)")
            .eq("students.is_demo", value: false)
            .is("students.archived_at", value: nil)
            .gte("checked_at", value: since)
            .execute().value
        var latest: [UUID: String] = [:]
        for row in rows where row.checkedAt > (latest[row.studentId] ?? "") {
            latest[row.studentId] = row.checkedAt
        }
        return latest
    }

    /// Log spend / load card, the founder's swipe-moment write.
    func addWalletEntry(kind: String, amount: Double, note: String) async throws {
        guard let me = currentUserID else { return }
        struct Entry: Encodable {
            let userId: UUID
            let entryDate: String
            let kind: String
            let amount: Double
            let note: String
            let createdBy: UUID
            enum CodingKeys: String, CodingKey {
                case userId = "user_id", entryDate = "entry_date", kind, amount, note, createdBy = "created_by"
            }
        }
        try await client().from("wallet_entries")
            .insert(Entry(userId: me, entryDate: PayoutPeriods.todayLocal(),
                          kind: kind, amount: (amount * 100).rounded() / 100,
                          note: note, createdBy: me))
            .execute()
    }

    // MARK: - Testimonials, requests, student depth (finish batch 2026-08-15)

    struct TestimonialRow: Decodable, Identifiable, Sendable {
        let id: UUID
        let studentId: UUID?
        let type: String        // video | image | text | trustpilot
        let title: String?
        let contentText: String?
        let filePath: String?
        let sourceUrl: String?
        let status: String      // requested | received | approved | published
        let collectedAt: String?
        let createdAt: String
        let students: Stu?

        struct Stu: Decodable, Sendable {
            let fullName: String
            enum CodingKeys: String, CodingKey { case fullName = "full_name" }
        }

        enum CodingKeys: String, CodingKey {
            case id, studentId = "student_id", type, title, contentText = "content_text"
            case filePath = "file_path", sourceUrl = "source_url", status
            case collectedAt = "collected_at", createdAt = "created_at", students
        }

        var studentName: String { students?.fullName ?? "Unlinked" }
    }

    func testimonials() async throws -> [TestimonialRow] {
        try await client().from("testimonials")
            .select("id, student_id, type, title, content_text, file_path, source_url, status, collected_at, created_at, students(full_name)")
            .order("created_at", ascending: false)
            .limit(80)
            .execute().value
    }

    /// Short-lived viewing URL for a stored testimonial file (web parity).
    func testimonialSignedURL(path: String) async throws -> URL {
        try await client().storage.from("testimonials").createSignedURL(path: path, expiresIn: 3600)
    }

    /// Upload a camera-roll capture and record it as a received testimonial —
    /// the web's exact path convention (`{studentId}/{uuid}.{ext}`) and row.
    func uploadTestimonial(studentId: UUID, data: Data, fileExtension: String, contentType: String, type: String, title: String?) async throws {
        guard let me = currentUserID else { throw URLError(.userAuthenticationRequired) }
        let path = "\(studentId.uuidString)/\(UUID().uuidString).\(fileExtension)"
        _ = try await client().storage.from("testimonials")
            .upload(path, data: data, options: FileOptions(contentType: contentType))
        struct Row: Encodable {
            let studentId: UUID
            let type: String
            let title: String?
            let filePath: String
            let collectedBy: UUID
            let collectedAt: String
            let status = "received"
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", type, title, filePath = "file_path"
                case collectedBy = "collected_by", collectedAt = "collected_at", status
            }
        }
        try await client().from("testimonials")
            .insert(Row(studentId: studentId, type: type, title: title, filePath: path,
                        collectedBy: me, collectedAt: ISO8601DateFormatter().string(from: Date())))
            .execute()
    }

    /// Text or Trustpilot testimonial (no file).
    func addTextTestimonial(studentId: UUID, type: String, contentText: String, sourceUrl: String?, title: String?) async throws {
        guard let me = currentUserID else { throw URLError(.userAuthenticationRequired) }
        struct Row: Encodable {
            let studentId: UUID
            let type: String
            let title: String?
            let contentText: String
            let sourceUrl: String?
            let collectedBy: UUID
            let collectedAt: String
            let status = "received"
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", type, title, contentText = "content_text"
                case sourceUrl = "source_url", collectedBy = "collected_by"
                case collectedAt = "collected_at", status
            }
        }
        try await client().from("testimonials")
            .insert(Row(studentId: studentId, type: type, title: title, contentText: contentText,
                        sourceUrl: sourceUrl, collectedBy: me,
                        collectedAt: ISO8601DateFormatter().string(from: Date())))
            .execute()
    }

    /// Flag a student for a testimonial (web request dialog).
    func requestTestimonial(studentId: UUID, type: String, note: String?) async throws {
        guard let me = currentUserID else { throw URLError(.userAuthenticationRequired) }
        struct Row: Encodable {
            let studentId: UUID
            let type: String
            let status = "requested"
            let collectedBy: UUID
            let title = "Requested"
            let contentText: String?
            enum CodingKeys: String, CodingKey {
                case studentId = "student_id", type, status
                case collectedBy = "collected_by", title, contentText = "content_text"
            }
        }
        try await client().from("testimonials")
            .insert(Row(studentId: studentId, type: type, collectedBy: me, contentText: note))
            .execute()
    }

    struct PendingSignup: Decodable, Identifiable, Sendable {
        let id: UUID
        let displayName: String?
        let createdAt: String
        enum CodingKeys: String, CodingKey {
            case id, displayName = "display_name", createdAt = "created_at"
        }
    }

    /// The approval queue (SECURITY DEFINER RPC — role-gated server-side).
    func pendingSignups() async throws -> [PendingSignup] {
        try await client().rpc("pending_signups").execute().value
    }

    /// Approve a signup as a TEAM member: the plain user_roles insert the web
    /// uses. Approve-as-student stays on the web (server flow creates the
    /// student + payment setup).
    func approveTeamMember(userId: UUID, role: String) async throws {
        struct Grant: Encodable {
            let userId: UUID
            let role: String
            enum CodingKeys: String, CodingKey { case userId = "user_id", role }
        }
        try await client().from("user_roles").insert(Grant(userId: userId, role: role)).execute()
    }

    struct WeeklyEOD: Decodable, Identifiable, Sendable {
        let id: UUID
        let weekStart: String
        let groupCallsAttended: Int
        let oneOnOneCalls: Int?
        let implementation: String
        let biggestWin: String?
        let biggestBlocker: String?
        let nextWeekCommitment: String

        enum CodingKeys: String, CodingKey {
            case id, weekStart = "week_start", groupCallsAttended = "group_calls_attended"
            case oneOnOneCalls = "one_on_one_calls", implementation
            case biggestWin = "biggest_win", biggestBlocker = "biggest_blocker"
            case nextWeekCommitment = "next_week_commitment"
        }
    }

    func weeklyEODs(studentId: UUID) async throws -> [WeeklyEOD] {
        try await client().from("student_weekly_eods")
            .select("id, week_start, group_calls_attended, one_on_one_calls, implementation, biggest_win, biggest_blocker, next_week_commitment")
            .eq("student_id", value: studentId)
            .order("week_start", ascending: false)
            .limit(12)
            .execute().value
    }

    struct Placement: Decodable, Identifiable, Sendable {
        let id: UUID
        let businessName: String
        let stage: String?
        let interviewAt: String?
        enum CodingKeys: String, CodingKey {
            case id, businessName = "business_name", stage, interviewAt = "interview_at"
        }
    }

    func placements(studentId: UUID) async throws -> [Placement] {
        try await client().from("student_placements")
            .select("id, business_name, stage, interview_at")
            .eq("student_id", value: studentId)
            .is("voided_at", value: nil)
            .order("updated_at", ascending: false)
            .execute().value
    }

    // MARK: helpers

    /// Supabase timestamps come with or without fractional seconds.
    static func parseTimestamp(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: raw) { return date }
        let plain = ISO8601DateFormatter()
        return plain.date(from: raw)
    }

    /// "Thu 4:30 PM"-style event phrasing, never a raw date.
    static func friendlyEventTime(_ raw: String) -> String {
        guard let date = parseTimestamp(raw) else { return "soon" }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Action items and 1:1 call logging (daily loop, 2026-08-18)

/// One ad-hoc action item with its attribution. Same row the web hub reads
/// (`_authenticated.action-items.tsx`): `student_id` set = a client item the
/// whole team sees, `assignee_id` set = a team item.
struct ActionItemRow: Decodable, Identifiable, Sendable {
    let id: UUID
    let studentId: UUID?
    let assigneeId: UUID?
    let createdBy: UUID
    let text: String
    let dueDate: String?
    let done: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, studentId = "student_id", assigneeId = "assignee_id"
        case createdBy = "created_by", text, dueDate = "due_date", done
        case createdAt = "created_at"
    }

    /// Owner is the assignee when there is one, else whoever wrote it — the
    /// same rule the web hub sorts and filters on.
    var ownerId: UUID { assigneeId ?? createdBy }
}

/// An action item living inside a logged call's JSON array, flattened so the
/// hub can queue call items and ad-hoc items together.
struct CallActionItemRow: Identifiable, Sendable {
    let callId: UUID
    let index: Int
    let studentId: UUID
    let coachId: UUID?
    let callDate: String
    let item: CallActionItem

    var id: String { "\(callId.uuidString)-\(index)" }
}

extension PortalAPI {
    /// Every ad-hoc item, open and done. RLS decides whose rows come back —
    /// team items stay founder + assignee by policy, so nothing is re-gated
    /// here on top of the server's answer.
    func actionItems() async throws -> [ActionItemRow] {
        try await client().from("student_action_items")
            .select("id, student_id, assignee_id, created_by, text, due_date, done, created_at")
            .eq("is_demo", value: false)
            .order("created_at", ascending: false)
            .limit(400)
            .execute()
            .value
    }

    /// Action items coaches wrote onto calls. The web hub lists these beside
    /// ad-hoc ones; without them the open count on the phone would undercount.
    func callActionItems() async throws -> [CallActionItemRow] {
        struct Row: Decodable {
            let id: UUID
            let studentId: UUID
            let coachId: UUID?
            let callDate: String
            let actionItemsJson: [CallActionItem]?

            enum CodingKeys: String, CodingKey {
                case id, studentId = "student_id", coachId = "coach_id"
                case callDate = "call_date", actionItemsJson = "action_items_json"
            }
        }
        let rows: [Row] = try await client().from("student_calls")
            .select("id, student_id, coach_id, call_date, action_items_json")
            .is("voided_at", value: nil)
            .order("call_date", ascending: false)
            .limit(400)
            .execute()
            .value
        return rows.flatMap { row in
            (row.actionItemsJson ?? []).enumerated().map { index, item in
                CallActionItemRow(callId: row.id, index: index, studentId: row.studentId,
                                  coachId: row.coachId, callDate: row.callDate, item: item)
            }
        }
    }

    /// Tick a call-embedded item: read the array, flip one entry, write it
    /// back — the web does exactly this (the array has no row identity).
    func setCallActionItemDone(callId: UUID, index: Int, done: Bool) async throws {
        struct Row: Decodable {
            let actionItemsJson: [CallActionItem]?
            enum CodingKeys: String, CodingKey { case actionItemsJson = "action_items_json" }
        }
        let row: Row = try await client().from("student_calls")
            .select("action_items_json")
            .eq("id", value: callId)
            .single()
            .execute()
            .value
        var items = row.actionItemsJson ?? []
        guard items.indices.contains(index) else { return }
        items[index].done = done
        try await client().from("student_calls")
            .update(["action_items_json": items])
            .eq("id", value: callId)
            .execute()
    }

    /// Only the author or an admin may delete; RLS enforces it, this is the
    /// call the row's delete action makes.
    func deleteActionItem(id: UUID) async throws {
        try await client().from("student_action_items").delete().eq("id", value: id).execute()
    }

    /// Staff profiles for the assignee picker and for naming owners.
    func teamMembers() async throws -> [StaffProfile] {
        let roles = try await staffRoles()
        let staff: Set<String> = ["admin", "founder", "cofounder", "closer", "setter", "coach", "csm"]
        let ids = Array(Set(roles.filter { staff.contains($0.role) }.map(\.userId)))
        guard !ids.isEmpty else { return [] }
        return try await profiles(ids: ids)
            .sorted { ($0.displayName ?? "") < ($1.displayName ?? "") }
    }
}

// MARK: - Home pictures (web home-sales-picture / home-fulfillment-picture)

/// The sales read: this week's sets and show rate, yesterday's volume against
/// the targets that applied, and the period's closes.
struct SalesPicture: Sendable {
    var setsWeek = 0
    var setsToday = 0
    var showed = 0
    var noShows = 0
    var unclaimed = 0
    var dialsYesterday = 0
    var dmsYesterday = 0
    var setsYesterday = 0
    var dialTarget = 0
    var dmTarget = 0
    var setsTarget = 0
    var shortYesterday: [String] = []
    var closesPeriod = 0
    var cashWeek: Double = 0
    var periodLabel = ""

    /// nil when nothing has been marked either way — never render 0%.
    var showRate: Int? {
        let den = showed + noShows
        guard den > 0 else { return nil }
        return Int((Double(showed) / Double(den) * 100).rounded())
    }

    /// One honest line: what the setters actually did yesterday.
    var volumeLine: String {
        var bits: [String] = []
        if dialTarget > 0 { bits.append("\(dialsYesterday) of \(dialTarget) dials") }
        if dmTarget > 0 { bits.append("\(dmsYesterday) of \(dmTarget) DMs") }
        bits.append("\(setsYesterday) of \(setsTarget) sets")
        return bits.joined(separator: " · ")
    }
}

extension PortalAPI {
    /// Daily KPI targets by setter type. Same numbers the EOD form judges on
    /// (founder-directed 2026-07-28: DM setters run 300 DMs and 6 sets).
    nonisolated static func kpiTargets(for setterType: String) -> (dials: Int, dms: Int, sets: Int) {
        switch setterType {
        case "phone": (100, 0, 3)
        case "full_cycle": (100, 50, 3)
        default: (0, 300, 6)
        }
    }

    private nonisolated static func day(_ offset: Int) -> String {
        let date = Calendar.current.date(byAdding: .day, value: offset, to: Date()) ?? Date()
        return BunStore.dayKey(date)
    }

    /// Monday of the current week, the week every "this week" figure uses.
    private nonisolated static func weekStart() -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        let start = calendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()
        return BunStore.dayKey(start)
    }

    func salesPicture() async throws -> SalesPicture {
        struct SetRow: Decodable {
            let ownerId: UUID?
            let status: String
            let attendanceStatus: String?
            let eventStart: String
            enum CodingKeys: String, CodingKey {
                case ownerId = "owner_id", status
                case attendanceStatus = "attendance_status", eventStart = "event_start"
            }
        }
        struct EODRow: Decodable {
            let userId: UUID
            let dials: Int?
            let dmsSent: Int?
            let leadsContacted: Int?
            let callsBooked: Int?
            enum CodingKeys: String, CodingKey {
                case userId = "user_id", dials, dmsSent = "dms_sent"
                case leadsContacted = "leads_contacted", callsBooked = "calls_booked"
            }
        }
        struct DealRow: Decodable {
            let cashCollectedUpfront: Double?
            let dealDate: String
            enum CodingKeys: String, CodingKey {
                case cashCollectedUpfront = "cash_collected_upfront", dealDate = "deal_date"
            }
        }

        let today = Self.day(0)
        let yesterday = Self.day(-1)
        let week = Self.weekStart()
        let period = PayoutPeriods.period()

        async let setsTask: [SetRow] = client().from("set_reminders")
            .select("owner_id, status, attendance_status, event_start")
            .gte("event_start", value: week + "T00:00:00")
            .execute().value
        async let eodsTask: [EODRow] = client().from("eods")
            .select("user_id, dials, dms_sent, leads_contacted, calls_booked")
            .eq("report_date", value: yesterday)
            .execute().value
        async let dealsTask: [DealRow] = client().from("deals")
            .select("cash_collected_upfront, deal_date")
            .eq("is_demo", value: false)
            .is("voided_at", value: nil)
            .gte("deal_date", value: min(week, period.start))
            .lte("deal_date", value: period.end)
            .execute().value
        async let rolesTask = staffRoles()

        var picture = SalesPicture()
        picture.periodLabel = period.label

        let live = (try await setsTask).filter { $0.status != "cancelled" }
        picture.setsWeek = live.count
        picture.setsToday = live.filter { $0.eventStart.prefix(10) == today }.count
        picture.showed = live.filter { $0.attendanceStatus == "showed" }.count
        picture.noShows = live.filter { $0.attendanceStatus == "no_show" }.count
        picture.unclaimed = live.filter { $0.ownerId == nil }.count

        let roles = try await rolesTask
        let setterIDs = Set(roles.filter { $0.role == "setter" }.map(\.userId))
        let setters = try await profiles(ids: Array(setterIDs)).filter { $0.setterType != nil }
        let eods = try await eodsTask
        for setter in setters {
            let targets = Self.kpiTargets(for: setter.setterType ?? "dm")
            let mine = eods.filter { $0.userId == setter.id }
            let dials = mine.reduce(0) { $0 + ($1.dials ?? 0) }
            // "Leads contacted" folded into DMs sent — old rows kept the old
            // column, so readers take whichever is larger (founder 2026-07-11).
            let dms = mine.reduce(0) { $0 + max($1.dmsSent ?? 0, $1.leadsContacted ?? 0) }
            let sets = mine.reduce(0) { $0 + ($1.callsBooked ?? 0) }
            picture.dialsYesterday += dials
            picture.dmsYesterday += dms
            picture.setsYesterday += sets
            picture.dialTarget += targets.dials
            picture.dmTarget += targets.dms
            picture.setsTarget += targets.sets
            let short = mine.isEmpty || dials < targets.dials || dms < targets.dms || sets < targets.sets
            if short { picture.shortYesterday.append(setter.displayName ?? "Team member") }
        }

        let deals = try await dealsTask
        picture.closesPeriod = deals.filter { $0.dealDate >= period.start }.count
        picture.cashWeek = deals.filter { $0.dealDate >= week }
            .reduce(0) { $0 + ($1.cashCollectedUpfront ?? 0) }
        return picture
    }

    /// Coaching calls on the books for the next `days` days.
    func scheduledCallsCount(days: Int = 7) async throws -> Int {
        struct Row: Decodable { let id: UUID }
        let rows: [Row] = try await client().from("student_calls")
            .select("id")
            .is("voided_at", value: nil)
            .eq("status", value: "scheduled")
            .gte("call_date", value: Self.day(0))
            .lte("call_date", value: Self.day(days))
            .execute().value
        return rows.count
    }
}

// MARK: - Finance (web /finance, founder + co-founder only)

/// The month's money: what came in, what leaves, and what is still scheduled.
/// Profit is computed AFTER team payouts, never just after expenses — the
/// founder-locked rule the web page carries.
struct FinanceRead: Sendable {
    var monthLabel = ""
    var cashIn: Double = 0
    var goal: Double?
    var expenses: Double = 0
    var payouts: Double = 0
    var expectedRest: Double = 0
    var installmentCollected: Double = 0
    var installmentDue: Double = 0
    var processorBalance: Double?
    var flow: [FinanceFlowRow] = []
    var expenseRows: [BusinessExpense] = []

    var profitSoFar: Double { cashIn - expenses - payouts }
    var profitProjected: Double { cashIn + expectedRest - expenses - payouts }

    /// Where the month should land at today's rate, so a goal reads as on or
    /// off pace rather than just short.
    var pace: Double {
        let calendar = Calendar(identifier: .gregorian)
        let day = calendar.component(.day, from: Date())
        let total = calendar.range(of: .day, in: .month, for: Date())?.count ?? 30
        guard day > 0 else { return cashIn }
        return cashIn / Double(day) * Double(total)
    }
}

struct FinanceFlowRow: Identifiable, Sendable {
    let id: String
    let date: String
    let label: String
    let amount: Double
    /// true = money in, false = money out.
    let incoming: Bool
}

extension PortalAPI {
    struct FounderSettings: Decodable, Sendable {
        let id: UUID
        let processorBalance: Double?
        let monthlyCashGoal: Double?
        let basePayDay: Int?

        enum CodingKeys: String, CodingKey {
            case id, processorBalance = "processor_balance"
            case monthlyCashGoal = "monthly_cash_goal", basePayDay = "base_pay_day"
        }
    }

    func founderSettings() async throws -> FounderSettings? {
        let rows: [FounderSettings] = try await client().from("founder_settings")
            .select("id, processor_balance, monthly_cash_goal, base_pay_day")
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func updateProcessorBalance(id: UUID, amount: Double) async throws {
        try await client().from("founder_settings")
            .update(["processor_balance": AnyJSON.double(amount),
                     "processor_balance_updated_at": .string(ISO8601DateFormatter().string(from: Date()))])
            .eq("id", value: id)
            .execute()
    }

    struct NewExpense: Encodable, Sendable {
        var name: String
        var amount: Double
        var recurring: Bool
        var dueDay: Int?
        var oneOffDate: String?
        var category: String?

        enum CodingKeys: String, CodingKey {
            case name, amount, recurring, dueDay = "due_day"
            case oneOffDate = "one_off_date", category
        }
    }

    func addExpense(_ expense: NewExpense) async throws {
        try await client().from("business_expenses").insert(expense).execute()
    }

    func deleteExpense(id: UUID) async throws {
        try await client().from("business_expenses").delete().eq("id", value: id).execute()
    }

    /// One month of finance. Cash in is collected cash (deal upfront + paid
    /// instalments); payouts are the month's two semi-monthly ledgers.
    func finance() async throws -> FinanceRead {
        struct PaymentRow: Decodable {
            let amount: Double
            let dueDate: String
            let status: String
            let paidAt: String?
            let installments: Parent?
            struct Parent: Decodable {
                let studentName: String?
                enum CodingKeys: String, CodingKey { case studentName = "student_name" }
            }
            enum CodingKeys: String, CodingKey {
                case amount, dueDate = "due_date", status, paidAt = "paid_at", installments
            }
        }
        struct DealRow: Decodable {
            let studentName: String
            let cashCollectedUpfront: Double?
            let dealDate: String
            enum CodingKeys: String, CodingKey {
                case studentName = "student_name", cashCollectedUpfront = "cash_collected_upfront"
                case dealDate = "deal_date"
            }
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let now = Date()
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
        let lastDay = calendar.range(of: .day, in: .month, for: now)?.count ?? 30
        let monthEnd = calendar.date(byAdding: .day, value: lastDay - 1, to: monthStart) ?? now
        let startKey = BunStore.dayKey(monthStart)
        let endKey = BunStore.dayKey(monthEnd)
        let today = BunStore.dayKey(now)

        async let paymentsTask: [PaymentRow] = client().from("installment_payments")
            .select("amount, due_date, status, paid_at, installments!inner(student_name, students!inner(is_demo))")
            .eq("installments.students.is_demo", value: false)
            .gte("due_date", value: startKey)
            .lte("due_date", value: endKey)
            .execute().value
        async let dealsTask: [DealRow] = client().from("deals")
            .select("student_name, cash_collected_upfront, deal_date")
            .eq("is_demo", value: false)
            .is("voided_at", value: nil)
            .gte("deal_date", value: startKey)
            .lte("deal_date", value: endKey)
            .execute().value
        async let expensesTask = businessExpenses()
        async let settingsTask = founderSettings()
        // Both halves of the month: profit is after the whole month's payouts.
        async let firstHalfTask = payoutLedger(offset: PayoutPeriods.period().isSecondHalf ? -1 : 0)
        async let secondHalfTask = payoutLedger(offset: PayoutPeriods.period().isSecondHalf ? 0 : 1)

        var read = FinanceRead()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMMM yyyy"
        read.monthLabel = formatter.string(from: now)

        let payments = try await paymentsTask
        let deals = try await dealsTask
        let paidPayments = payments.filter { $0.status == "paid" }
        read.installmentCollected = paidPayments.reduce(0) { $0 + $1.amount }
        // Waived and refunded money is not owed and never lands.
        let stillDue = payments.filter { !["paid", "waived", "refunded"].contains($0.status) }
        read.installmentDue = stillDue.reduce(0) { $0 + $1.amount }
        read.expectedRest = stillDue.filter { $0.dueDate >= today }.reduce(0) { $0 + $1.amount }
        read.cashIn = deals.reduce(0) { $0 + ($1.cashCollectedUpfront ?? 0) } + read.installmentCollected

        let expenses = try await expensesTask
        read.expenseRows = expenses
        read.expenses = expenses.reduce(0) { total, expense in
            if expense.recurring { return total + expense.amount }
            guard let day = expense.oneOffDate, day >= startKey, day <= endKey else { return total }
            return total + expense.amount
        }

        let settings = (try? await settingsTask) ?? nil
        read.goal = settings?.monthlyCashGoal
        read.processorBalance = settings?.processorBalance

        let halves = [try? await firstHalfTask, try? await secondHalfTask].compactMap { $0 }
        read.payouts = halves.reduce(0) { total, half in
            total + half.owed.reduce(0) { $0 + $1.total }
        }

        // The flow: what still lands, and what still leaves, before month end.
        var flow: [FinanceFlowRow] = stillDue.filter { $0.dueDate >= today }.map { payment in
            FinanceFlowRow(id: "in-\(payment.dueDate)-\(payment.amount)-\(payment.installments?.studentName ?? "")",
                           date: payment.dueDate,
                           label: payment.installments?.studentName ?? "Instalment",
                           amount: payment.amount, incoming: true)
        }
        for expense in expenses {
            let day: String?
            if expense.recurring, let dueDay = expense.dueDay {
                let clamped = min(max(dueDay, 1), lastDay)
                day = BunStore.dayKey(calendar.date(byAdding: .day, value: clamped - 1, to: monthStart) ?? monthStart)
            } else {
                day = expense.oneOffDate
            }
            guard let day, day >= today, day <= endKey else { continue }
            flow.append(FinanceFlowRow(id: "out-\(expense.id.uuidString)", date: day,
                                       label: expense.name, amount: expense.amount, incoming: false))
        }
        read.flow = flow.sorted { $0.date < $1.date }
        return read
    }
}

// MARK: - Card ledgers (web /cards, founder + co-founder)

/// One person's card: everything loaded, everything spent, and the entries
/// grouped by month with what carried in and what carries out — the web's
/// ledger, which is how the founder reads whose money is still sitting there.
struct CardLedger: Identifiable, Sendable {
    let id: UUID
    let name: String
    var loaded: Double = 0
    var spent: Double = 0
    var entries: [PortalAPI.WalletEntry] = []
    var balance: Double { loaded - spent }

    /// Newest month first; each month knows what it opened and closed with.
    var months: [CardMonth] {
        let calendar = Calendar(identifier: .gregorian)
        let grouped = Dictionary(grouping: entries) { entry -> String in
            String(entry.entryDate.prefix(7))
        }
        let keys = grouped.keys.sorted()
        var running = 0.0
        var out: [CardMonth] = []
        for key in keys {
            let rows = (grouped[key] ?? []).sorted { $0.entryDate > $1.entryDate }
            let loaded = rows.filter { $0.kind == "credit" }.reduce(0) { $0 + $1.amount }
            let spent = rows.filter { $0.kind == "spend" }.reduce(0) { $0 + $1.amount }
            let carriedIn = running
            running += loaded - spent
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM"
            let label: String
            if let date = formatter.date(from: key) {
                formatter.dateFormat = calendar.component(.year, from: date) == calendar.component(.year, from: Date())
                    ? "MMMM" : "MMMM yyyy"
                label = formatter.string(from: date)
            } else {
                label = key
            }
            out.append(CardMonth(id: key, label: label, loaded: loaded, spent: spent,
                                 carriedIn: carriedIn, carriedOut: running, entries: rows))
        }
        return out.reversed()
    }
}

struct CardMonth: Identifiable, Sendable {
    let id: String
    let label: String
    let loaded: Double
    let spent: Double
    let carriedIn: Double
    let carriedOut: Double
    let entries: [PortalAPI.WalletEntry]
}

extension PortalAPI {
    /// Every card the reader is allowed to see. RLS decides that: leadership
    /// gets the team's, everyone else gets their own, and the caller does not
    /// have to know which happened.
    func cardLedgers() async throws -> [CardLedger] {
        struct Row: Decodable {
            let id: UUID
            let userId: UUID
            let entryDate: String
            let kind: String
            let amount: Double
            let note: String

            enum CodingKeys: String, CodingKey {
                case id, userId = "user_id", entryDate = "entry_date", kind, amount, note
            }
        }
        let rows: [Row] = try await client().from("wallet_entries")
            .select("id, user_id, entry_date, kind, amount, note")
            .order("entry_date", ascending: false)
            .order("created_at", ascending: false)
            .limit(600)
            .execute().value
        guard !rows.isEmpty else { return [] }
        let people = try await profiles(ids: Array(Set(rows.map(\.userId))))
        let nameById = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0.displayName ?? "Team member") })

        return Dictionary(grouping: rows, by: \.userId).map { userId, entries in
            var ledger = CardLedger(id: userId, name: nameById[userId] ?? "Team member")
            ledger.loaded = entries.filter { $0.kind == "credit" }.reduce(0) { $0 + $1.amount }
            ledger.spent = entries.filter { $0.kind == "spend" }.reduce(0) { $0 + $1.amount }
            ledger.entries = entries.map {
                WalletEntry(id: $0.id, entryDate: $0.entryDate, kind: $0.kind, amount: $0.amount, note: $0.note)
            }
            return ledger
        }
        .sorted { $0.balance > $1.balance }
    }

    /// A correction, not an edit: the ledger is append-only, so setting a
    /// balance writes the difference as its own entry (web semantics).
    func setCardBalance(userId: UUID, to target: Double, current: Double) async throws {
        let delta = target - current
        guard abs(delta) > 0.004 else { return }
        struct Entry: Encodable {
            let userId: UUID
            let entryDate: String
            let kind: String
            let amount: Double
            let note: String
            enum CodingKeys: String, CodingKey {
                case userId = "user_id", entryDate = "entry_date", kind, amount, note
            }
        }
        try await client().from("wallet_entries").insert(Entry(
            userId: userId,
            entryDate: BunStore.dayKey(Date()),
            kind: delta > 0 ? "credit" : "spend",
            amount: abs(delta),
            note: "Balance correction · set to \(ivyMoney(target))"
        )).execute()
    }
}

// MARK: - CSM workspace (web /csm)

/// A note with the two names it needs to be readable in a team feed: who
/// wrote it and who it is about.
struct CSMFeedNote: Identifiable, Sendable {
    let id: UUID
    let studentId: UUID
    let studentName: String
    let author: String
    let note: String
    let createdAt: String
}

extension PortalAPI {
    /// The team's latest CSM notes. RLS decides whose are visible.
    func latestCSMNotes(limit: Int = 20) async throws -> [CSMFeedNote] {
        struct Row: Decodable {
            let id: UUID
            let studentId: UUID
            let userId: UUID?
            let note: String
            let createdAt: String
            enum CodingKeys: String, CodingKey {
                case id, studentId = "student_id", userId = "user_id", note, createdAt = "created_at"
            }
        }
        let rows: [Row] = try await client().from("csm_student_notes")
            .select("id, student_id, user_id, note, created_at")
            .order("created_at", ascending: false)
            .limit(limit)
            .execute().value
        guard !rows.isEmpty else { return [] }
        async let peopleTask = profiles(ids: Array(Set(rows.compactMap(\.userId))))
        async let rosterTask = students()
        let names = Dictionary(uniqueKeysWithValues: (try await peopleTask).map { ($0.id, $0.displayName ?? "Team member") })
        let clients = Dictionary(uniqueKeysWithValues: (try await rosterTask).map { ($0.id, $0.fullName) })
        return rows.map {
            CSMFeedNote(id: $0.id, studentId: $0.studentId,
                        studentName: clients[$0.studentId] ?? "Client",
                        author: $0.userId.flatMap { names[$0] } ?? "Team member",
                        note: $0.note, createdAt: $0.createdAt)
        }
    }
}

// MARK: - Org settings, testimonials, sets, team admin (2026-08-18)

extension PortalAPI {
    /// The org's profit split. Only an owner/admin/founder of that org may
    /// write it (policy `orgs_admin_update`).
    func updateProfitSplit(orgId: UUID, rows: [ProfitShare]) async throws {
        try await client().from("orgs")
            .update(["profit_split": rows])
            .eq("id", value: orgId)
            .execute()
    }

    /// Testimonial pipeline: requested → received → approved → published.
    func setTestimonialStatus(id: UUID, status: String) async throws {
        var patch: [String: AnyJSON] = ["status": .string(status)]
        if status != "requested" {
            patch["collected_at"] = .string(ISO8601DateFormatter().string(from: Date()))
        }
        try await client().from("testimonials").update(patch).eq("id", value: id).execute()
    }

    /// Record a booked call. The web version also writes a Google Calendar
    /// event through a server function; from the phone this records the set
    /// itself, which is what every set surface in the app reads.
    func logSet(prospect: String, start: Date, durationMin: Int = 30, notes: String?) async throws {
        guard let me = currentUserID else { return }
        struct Row: Encodable {
            let ownerId: UUID
            let prospect: String
            let eventStart: String
            let durationMin: Int
            let notes: String?
            let source: String
            enum CodingKeys: String, CodingKey {
                case ownerId = "owner_id", prospect, eventStart = "event_start"
                case durationMin = "duration_min", notes, source
            }
        }
        try await client().from("set_reminders").insert(Row(
            ownerId: me, prospect: prospect,
            eventStart: ISO8601DateFormatter().string(from: start),
            durationMin: durationMin, notes: notes, source: "app"
        )).execute()
    }

    /// Admin toggle: an exempt member disappears from every expected-filer
    /// surface (founder-directed rule, enforced the same way as the web).
    func setEodExempt(userId: UUID, exempt: Bool) async throws {
        try await client().from("profiles")
            .update(["eod_exempt": exempt])
            .eq("id", value: userId)
            .execute()
    }

    /// Roles per member, for the team admin list.
    func rolesByMember() async throws -> [UUID: [String]] {
        Dictionary(grouping: try await staffRoles(), by: \.userId).mapValues { $0.map(\.role).sorted() }
    }

    /// Profiles with the admin columns the team list shows.
    func teamAdminProfiles() async throws -> [StaffProfile] {
        let roles = try await staffRoles()
        let ids = Array(Set(roles.map(\.userId)))
        guard !ids.isEmpty else { return [] }
        return try await profiles(ids: ids).sorted { ($0.displayName ?? "") < ($1.displayName ?? "") }
    }
}
