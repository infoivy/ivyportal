import SwiftUI

// Data phase (founder "go", 2026-08-17): the Mercury-clone screens read the
// REAL portal money domain through the existing PortalAPI + RLS session.
// Mapping: ledger = deal upfront cash + paid installments (in) and expenses
// (out); Move money = Log close / overdue / unconfirmed payouts / upcoming;
// Cards = the Whop wallet card. Signed-out DEBUG keeps the fixtures.

@MainActor
@Observable
final class BunStore {
    static let shared = BunStore()

    var signedIn: Bool { AuthStore.shared.isSignedIn }

    // Organizations (multi-tenant Phase 1)
    var orgs: [PortalAPI.BunOrg]?
    var activeOrgId: UUID?

    var activeOrg: PortalAPI.BunOrg? {
        guard let orgs else { return nil }
        return orgs.first { $0.id == activeOrgId } ?? orgs.first
    }

    /// Fixture-mode workspace selection (the org switcher works signed out
    /// too, so the preview has no dead taps).
    var fixtureOrgName = BunFixtures.orgName

    var orgName: String { activeOrg?.name ?? fixtureOrgName }

    /// Switch the active workspace and reload everything under it.
    /// (Org-scoped data reads land with Phase 2; today this switches the
    /// membership context and the header.)
    func switchOrg(_ id: UUID) {
        guard activeOrgId != id else { return }
        activeOrgId = id
        Task { await refreshAll() }
    }

    /// A signed-in account with no business and no legacy roles gets the
    /// create-your-business flow.
    var needsOrgSetup: Bool {
        signedIn && orgs != nil && orgs!.isEmpty
            && AuthStore.shared.rolesLoaded && AuthStore.shared.roles.isEmpty
    }

    func loadOrgs() async {
        guard signedIn, orgs == nil else { return }
        if !AuthStore.shared.rolesLoaded { await AuthStore.shared.loadRoles() }
        orgs = (try? await PortalAPI.shared.myOrgs()) ?? []
        if activeOrgId == nil { activeOrgId = orgs?.first?.id }
    }

    func createBusiness(named name: String) async throws {
        let id = try await PortalAPI.shared.createOrganization(name: name)
        orgs = nil
        await loadOrgs()
        activeOrgId = id
    }

    // Home
    var firstName: String?
    var rangeDays = 30
    var cashSeries: [PortalAPI.CashDay]?
    var monthIn: Double?
    var monthOut: Double?
    var paidOutPeriod: Double?
    var toPayPeriod: Double?

    // Ledger (Transactions + Home preview)
    var ledger: [BunTransaction]?
    var ledgerError: String?
    /// Session-local annotations on ledger rows (categorize / notes from the
    /// transaction detail; portal columns for these come later).
    var txCategory: [UUID: String] = [:]
    var txNote: [UUID: String] = [:]

    func setRange(_ days: Int) async {
        guard days != rangeDays || cashSeries == nil else { return }
        rangeDays = days
        if signedIn {
            cashSeries = nil
            cashSeries = try? await PortalAPI.shared.dailyCashSeries(days: days)
        } else {
            cashSeries = BunFixtures.cashDays(days: days)
        }
    }

    // Move money
    var overduePayments: [BunPlanItem]?
    var upcomingPayments: [BunPlanItem]?
    var unconfirmedPayouts: [BunPayoutItem]?
    var payoutPeriodStart: String?
    var payoutPeriodLabel: String?

    // Wallet
    var wallet: PortalAPI.WalletSummary?

    // Clients (students as accounts) + team
    var roster: [StudentRosterItem]?
    /// Completed 1:1 calls per student (web parity: calls used vs allotted).
    var callCounts: [UUID: Int]?
    var health: [UUID: StudentHealthResult]?
    var paidByStudent: [String: Double]?      // student name -> paid
    var totalByStudent: [String: Double]?     // student name -> plan total
    var teamSummary: PerformanceSummary?
    var teamRows: [TeamMemberRow]?
    /// Written EOD notes (wins/blockers) keyed by member and day.
    var teamNotes: [TeamEODNote]?
    var eodDue: Bool?
    var setterType: String?

    // Ops: check-ins, tallies, sets, docs
    var checkinStamps: [UUID: String]?
    var checkedNow: Set<UUID> = []
    var tallyCounts: [String: Int] = [:]
    var mySets: [PortalAPI.SetReminderFull]?
    var unclaimedSetCount: Int?
    var unclaimedSets: [PortalAPI.SetReminderFull]?
    var teamWeek: [(day: String, filed: Int, expected: Int)]?
    /// Categories the user added on top of the stock list.
    var customCategories: [String] = []
    var docs: [PortalAPI.Doc]?

    // Daily loop (2026-08-18): action items, 1:1 call history, my own EODs
    var actionItems: [ActionItemRow]?
    var callItems: [CallActionItemRow]?
    var teamMembers: [StaffProfile]?
    var staffNames: [UUID: String] = [:]
    var callsByStudent: [UUID: [StudentCall]] = [:]
    var myEODs: [PortalAPI.MyEOD]?
    /// Optimistic ticks, demo-mode ticks, demo-mode additions and removals.
    /// One layer serves both: signed out there is no server to reconcile with,
    /// signed in the override holds until the next load returns the truth.
    var taskDoneOverride: [String: Bool] = [:]
    var taskRemoved: Set<String> = []
    var localTasks: [BunTask] = []

    /// Whoever is filing: the signed-in id, or the demo person signed out.
    var meId: UUID { PortalAPI.shared.currentUserID ?? BunFixtures.meId }

    // Money depth (web Money in / Payment plans / Payouts)
    var deals: [PayoutDealRow]?
    var plans: [PlanHeader]?
    var planPayments: [PlanPayment]?
    var payoutOffset = 0
    var payoutData: PayoutLedgerData?
    var payoutError: String?

    /// Deals inside a window, newest first — the Money-in read.
    func deals(days: Int) -> [PayoutDealRow] {
        let from = Self.dayKey(Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date())
        return (deals ?? []).filter { $0.dealDate >= from }.sorted { $0.dealDate > $1.dealDate }
    }

    func loadMoneyDepth() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        if deals == nil { deals = (try? await PortalAPI.shared.recentDeals(limit: 120)) ?? [] }
        if plans == nil, let (headers, payments) = try? await PortalAPI.shared.paymentPlans() {
            plans = headers
            planPayments = payments
        }
    }

    /// One payout period, walked with the arrows. Errors surface rather than
    /// leaving an empty ledger that reads like "nobody is owed anything".
    func loadPayouts(offset: Int? = nil) async {
        if let offset { payoutOffset = offset }
        guard signedIn else {
            seedFixturesIfNeeded()
            if payoutData == nil { payoutData = BunFixtures.payoutLedger }
            return
        }
        payoutData = nil
        do {
            payoutData = try await PortalAPI.shared.payoutLedger(offset: payoutOffset)
            payoutError = nil
        } catch {
            payoutError = "Could not load the ledger: \(error.localizedDescription)"
        }
    }

    func confirm(_ member: OwedMember) async throws {
        guard signedIn else {
            // Demo: the confirmation lands so the flow is not a dead end.
            if let data = payoutData {
                let row = PayoutConfirmationRow(periodStart: data.period.start,
                                                userId: UUID(uuidString: member.id) ?? UUID(),
                                                amountPaid: member.total,
                                                confirmedAt: Self.dayKey(Date()) + "T09:00:00Z", note: nil)
                payoutData = PayoutLedgerData(period: data.period, rows: data.rows, owed: data.owed,
                                              confirmations: data.confirmations + [row],
                                              adjustments: data.adjustments, teamIds: data.teamIds,
                                              names: data.names)
            }
            unconfirmedPayouts?.removeAll { $0.id == member.id }
            return
        }
        guard let start = payoutData?.period.start else { return }
        try await PortalAPI.shared.confirmPayout(periodStart: start, memberId: member.id, amount: member.total)
        unconfirmedPayouts?.removeAll { $0.id == member.id }
        await loadPayouts()
    }

    func addAdjustment(memberId: String, amount: Double, note: String) async throws {
        guard signedIn else {
            // Demo: fold the correction into the member's total in place.
            if let data = payoutData {
                let owed = data.owed.map { member -> OwedMember in
                    guard member.id == memberId else { return member }
                    var updated = member
                    updated.adjustment += amount
                    updated.total += amount
                    return updated
                }
                payoutData = PayoutLedgerData(period: data.period, rows: data.rows, owed: owed,
                                              confirmations: data.confirmations,
                                              adjustments: data.adjustments, teamIds: data.teamIds,
                                              names: data.names)
            }
            return
        }
        guard let start = payoutData?.period.start else { return }
        try await PortalAPI.shared.addPayoutAdjustment(memberId: memberId, periodStart: start,
                                                       amount: amount, note: note)
        await loadPayouts()
    }

    // Testimonials and team admin (web parity batch 2026-08-18)
    var testimonials: [PortalAPI.TestimonialRow]?
    var chat: [PortalAPI.ChatMessage]?
    var adminProfiles: [StaffProfile]?
    var adminRoles: [UUID: [String]] = [:]
    var pendingRequests: [PortalAPI.PendingSignup]?
    /// Local exempt toggles so the switch answers immediately.
    var exemptPatch: [UUID: Bool] = [:]

    func loadTestimonials() async {
        guard signedIn else {
            seedFixturesIfNeeded()
            if testimonials == nil { testimonials = BunFixtures.testimonials }
            return
        }
        guard testimonials == nil else { return }
        testimonials = (try? await PortalAPI.shared.testimonials()) ?? []
    }

    func setTestimonialStatus(_ row: PortalAPI.TestimonialRow, status: String) async throws {
        guard signedIn else {
            testimonials = (testimonials ?? []).map { existing in
                guard existing.id == row.id else { return existing }
                return PortalAPI.TestimonialRow(id: existing.id, studentId: existing.studentId,
                                                type: existing.type, title: existing.title,
                                                contentText: existing.contentText, filePath: existing.filePath,
                                                sourceUrl: existing.sourceUrl, status: status,
                                                collectedAt: existing.collectedAt, createdAt: existing.createdAt,
                                                students: existing.students)
            }
            return
        }
        try await PortalAPI.shared.setTestimonialStatus(id: row.id, status: status)
        testimonials = nil
        await loadTestimonials()
    }

    /// The channel only exists where an org owner switched it on.
    var chatEnabled: Bool {
        signedIn ? (activeOrg?.teamChatEnabled ?? false) : fixtureChatEnabled
    }

    /// Demo-mode toggle, so the switch does something signed out too.
    var fixtureChatEnabled = false

    /// Only an org owner/admin/founder may flip it (policy orgs_admin_update).
    var canSetOrgOptions: Bool {
        guard signedIn else { return true }
        let roles = Set(AuthStore.shared.roles)
        return roles.contains(.founder) || roles.contains(.admin) || roles.contains(.cofounder)
    }

    func setChatEnabled(_ enabled: Bool) async throws {
        guard signedIn, let org = activeOrg else {
            fixtureChatEnabled = enabled
            return
        }
        try await PortalAPI.shared.setTeamChat(orgId: org.id, enabled: enabled)
        orgs = nil
        await loadOrgs()
    }

    func loadChat() async {
        guard chatEnabled else { return }
        guard signedIn else {
            seedFixturesIfNeeded()
            if chat == nil { chat = BunFixtures.chat }
            return
        }
        guard chat == nil else { return }
        chat = (try? await PortalAPI.shared.teamChat()) ?? []
    }

    func post(_ body: String, kind: String) async throws {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard signedIn else {
            chat = (chat ?? []) + [PortalAPI.ChatMessage(
                id: UUID(), body: trimmed, kind: kind, author: BunFixtures.userFullName,
                authorId: meId, studentName: nil,
                createdAt: ISO8601DateFormatter().string(from: Date()))]
            return
        }
        try await PortalAPI.shared.postChat(body: trimmed, kind: kind)
        chat = nil
        await loadChat()
    }

    func loadTeamAdmin() async {
        guard signedIn else {
            seedFixturesIfNeeded()
            if adminProfiles == nil { adminProfiles = BunFixtures.teamMembers }
            if adminRoles.isEmpty { adminRoles = BunFixtures.adminRoles }
            if pendingRequests == nil { pendingRequests = [] }
            return
        }
        if adminProfiles == nil { adminProfiles = (try? await PortalAPI.shared.teamAdminProfiles()) ?? [] }
        if adminRoles.isEmpty { adminRoles = (try? await PortalAPI.shared.rolesByMember()) ?? [:] }
        if pendingRequests == nil { pendingRequests = (try? await PortalAPI.shared.pendingSignups()) ?? [] }
    }

    func isExempt(_ member: StaffProfile) -> Bool {
        exemptPatch[member.id] ?? (member.eodExempt ?? false)
    }

    func setExempt(_ member: StaffProfile, exempt: Bool) async throws {
        exemptPatch[member.id] = exempt
        guard signedIn else { return }
        do {
            try await PortalAPI.shared.setEodExempt(userId: member.id, exempt: exempt)
        } catch {
            exemptPatch[member.id] = !exempt
            throw error
        }
    }

    func approve(_ request: PortalAPI.PendingSignup, role: String) async throws {
        guard signedIn else {
            pendingRequests?.removeAll { $0.id == request.id }
            return
        }
        try await PortalAPI.shared.approveTeamMember(userId: request.id, role: role)
        pendingRequests = nil
        adminProfiles = nil
        adminRoles = [:]
        await loadTeamAdmin()
    }

    /// The org's profit split, and the write behind the settings editor.
    var profitSplit: [PortalAPI.ProfitShare] {
        signedIn ? (activeOrg?.profitSplit ?? []) : fixtureSplit
    }

    func saveProfitSplit(_ rows: [PortalAPI.ProfitShare]) async throws {
        guard signedIn, let org = activeOrg else {
            fixtureSplit = rows
            return
        }
        try await PortalAPI.shared.updateProfitSplit(orgId: org.id, rows: rows)
        orgs = nil
        await loadOrgs()
    }

    /// Demo-mode split, so the editor works signed out too.
    var fixtureSplit: [PortalAPI.ProfitShare] = BunFixtures.profitSplit

    /// Claim an unclaimed set: it leaves the pool and joins my calendar.
    func claim(_ set: PortalAPI.SetReminderFull) async throws {
        guard signedIn else {
            unclaimedSets?.removeAll { $0.id == set.id }
            unclaimedSetCount = unclaimedSets?.count ?? 0
            let mine = PortalAPI.SetReminderFull(
                id: set.id, prospect: set.prospect, eventStart: set.eventStart,
                ownerId: meId, status: set.status, confirmedAt: set.confirmedAt,
                notes: set.notes, reminderLog: set.reminderLog)
            mySets = ((mySets ?? []) + [mine]).sorted { $0.eventStart < $1.eventStart }
            return
        }
        try await PortalAPI.shared.claimSet(id: set.id)
        mySets = nil
        unclaimedSets = nil
        unclaimedSetCount = nil
        await loadSets()
    }

    // CSM workspace (web /csm)
    var csmFeed: [CSMFeedNote]?

    /// The web gates the workspace to the fulfillment roles; signed out the
    /// demo shows it, because that is the product being sold.
    var canSeeCSM: Bool {
        guard signedIn else { return true }
        let roles = Set(AuthStore.shared.roles)
        return !roles.isDisjoint(with: [.admin, .founder, .cofounder, .coach, .csm])
    }

    func loadCSM() async {
        guard signedIn else {
            seedFixturesIfNeeded()
            if csmFeed == nil { csmFeed = BunFixtures.csmFeed }
        if testimonials == nil { testimonials = BunFixtures.testimonials }
            return
        }
        guard canSeeCSM, csmFeed == nil else { return }
        csmFeed = (try? await PortalAPI.shared.latestCSMNotes()) ?? []
    }

    /// Client output by day over the loaded window: what the whole roster
    /// actually did, which is the number a CSM is judged on.
    var clientOutput: [(day: String, value: Int)] {
        guard let eods = studentEODs else { return [] }
        var totals: [String: Int] = [:]
        for eod in eods {
            totals[eod.reportDate, default: 0] += eod.applicationsSubmitted + eod.outreachSent + eod.interviews
        }
        return (0..<14).reversed().map { back in
            let date = Calendar.current.date(byAdding: .day, value: -back, to: Date()) ?? Date()
            let key = Self.dayKey(date)
            return (day: key, value: totals[key] ?? 0)
        }
    }

    // The client record (web /students/$id)
    var studentEODsBy: [UUID: [StudentEOD]] = [:]
    var weeklyEODsBy: [UUID: [PortalAPI.WeeklyEOD]] = [:]
    var notesBy: [UUID: [CSMNote]] = [:]
    var placementsBy: [UUID: [PortalAPI.Placement]] = [:]
    var coachList: [StaffProfile]?
    /// Local phase/coach patches so a change shows before the roster reloads.
    var phasePatch: [UUID: String] = [:]
    var coachPatch: [UUID: UUID?] = [:]

    func phase(of student: StudentRosterItem) -> String {
        phasePatch[student.id] ?? (student.phase == "coaching_1on1" ? "training" : (student.phase ?? "onboarding"))
    }

    func coachId(of student: StudentRosterItem) -> UUID? {
        coachPatch[student.id] ?? student.coachId
    }

    func loadClientRecord(_ id: UUID) async {
        guard signedIn else {
            seedFixturesIfNeeded()
            if studentEODsBy[id] == nil { studentEODsBy[id] = (studentEODs ?? []).filter { $0.studentId == id } }
            if weeklyEODsBy[id] == nil { weeklyEODsBy[id] = BunFixtures.weeklyEODs }
            if notesBy[id] == nil { notesBy[id] = BunFixtures.csmNotes(for: id) }
            if placementsBy[id] == nil { placementsBy[id] = BunFixtures.placements }
            if coachList == nil { coachList = BunFixtures.teamMembers }
            return
        }
        if coachList == nil { coachList = try? await PortalAPI.shared.coaches() }
        if studentEODsBy[id] == nil {
            studentEODsBy[id] = (try? await PortalAPI.shared.studentEODs(studentId: id)) ?? []
        }
        if weeklyEODsBy[id] == nil {
            weeklyEODsBy[id] = (try? await PortalAPI.shared.weeklyEODs(studentId: id)) ?? []
        }
        if notesBy[id] == nil {
            notesBy[id] = (try? await PortalAPI.shared.csmNotes(studentId: id)) ?? []
        }
        if placementsBy[id] == nil {
            placementsBy[id] = (try? await PortalAPI.shared.placements(studentId: id)) ?? []
        }
    }

    func setPhase(_ student: StudentRosterItem, to phase: String) async throws {
        phasePatch[student.id] = phase
        guard signedIn else { return }
        do {
            try await PortalAPI.shared.updateStudentPhase(id: student.id, phase: phase)
            roster = nil
            await loadClients()
        } catch {
            phasePatch[student.id] = nil
            throw error
        }
    }

    func setCoach(_ student: StudentRosterItem, to coachId: UUID?) async throws {
        coachPatch[student.id] = coachId
        guard signedIn else { return }
        do {
            try await PortalAPI.shared.assignCoach(studentId: student.id, coachId: coachId)
            roster = nil
            await loadClients()
        } catch {
            coachPatch[student.id] = nil
            throw error
        }
    }

    func addNote(_ student: StudentRosterItem, note: String) async throws {
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard signedIn else {
            let row = CSMNote(id: UUID(), studentId: student.id, note: trimmed,
                              createdAt: ISO8601DateFormatter().string(from: Date()))
            notesBy[student.id, default: []].insert(row, at: 0)
            return
        }
        try await PortalAPI.shared.addCSMNote(studentId: student.id, note: trimmed)
        notesBy[student.id] = nil
        await loadClientRecord(student.id)
    }

    // Card ledgers (web /cards)
    var cardLedgers: [CardLedger]?

    func loadCards() async {
        guard signedIn else {
            seedFixturesIfNeeded()
            if cardLedgers == nil { cardLedgers = BunFixtures.cardLedgers }
        if csmFeed == nil { csmFeed = BunFixtures.csmFeed }
            return
        }
        guard cardLedgers == nil else { return }
        cardLedgers = (try? await PortalAPI.shared.cardLedgers()) ?? []
    }

    /// Load, spend, or correct. A correction is written as its own entry, so
    /// the ledger stays a history rather than becoming an edit log.
    func cardEntry(ledgerId: UUID, kind: String, amount: Double, note: String) async throws {
        guard signedIn else {
            guard var ledger = cardLedgers?.first(where: { $0.id == ledgerId }) else { return }
            let resolved: (kind: String, amount: Double, note: String)
            switch kind {
            case "set":
                let delta = amount - ledger.balance
                guard abs(delta) > 0.004 else { return }
                resolved = (delta > 0 ? "credit" : "spend", abs(delta),
                            "Balance correction · set to \(ivyMoney(amount))")
            default:
                resolved = (kind, amount, note)
            }
            let entry = PortalAPI.WalletEntry(id: UUID(), entryDate: Self.dayKey(Date()),
                                              kind: resolved.kind, amount: resolved.amount, note: resolved.note)
            ledger.entries.insert(entry, at: 0)
            if resolved.kind == "credit" { ledger.loaded += resolved.amount } else { ledger.spent += resolved.amount }
            cardLedgers = (cardLedgers ?? []).map { $0.id == ledgerId ? ledger : $0 }
            if ledgerId == meId { wallet = PortalAPI.WalletSummary(loaded: ledger.loaded, spent: ledger.spent, recent: Array(ledger.entries.prefix(6))) }
            return
        }
        if kind == "set" {
            let current = cardLedgers?.first { $0.id == ledgerId }?.balance ?? 0
            try await PortalAPI.shared.setCardBalance(userId: ledgerId, to: amount, current: current)
        } else if ledgerId == meId {
            try await PortalAPI.shared.addWalletEntry(kind: kind, amount: amount, note: note)
        } else {
            // Another person's card: same append-only write, their user id.
            try await PortalAPI.shared.setCardBalance(
                userId: ledgerId,
                to: (cardLedgers?.first { $0.id == ledgerId }?.balance ?? 0) + (kind == "credit" ? amount : -amount),
                current: cardLedgers?.first { $0.id == ledgerId }?.balance ?? 0)
        }
        cardLedgers = nil
        csmFeed = nil
        testimonials = nil
        chat = nil
        adminProfiles = nil
        adminRoles = [:]
        pendingRequests = nil
        exemptPatch = [:]
        studentEODsBy = [:]
        weeklyEODsBy = [:]
        notesBy = [:]
        placementsBy = [:]
        coachList = nil
        phasePatch = [:]
        coachPatch = [:]
        wallet = nil
        await loadCards()
        wallet = try? await PortalAPI.shared.myWallet()
    }

    // Finance (founder + co-founder only, RLS is the wall)
    var finance: FinanceRead?
    var financeError: String?

    /// Only leadership reads the business's own numbers. Signed out the demo
    /// workspace shows them, because the whole point is to sell the product.
    var canSeeFinance: Bool {
        guard signedIn else { return true }
        let roles = Set(AuthStore.shared.roles)
        return roles.contains(.founder) || roles.contains(.cofounder)
    }

    func loadFinance() async {
        guard signedIn else {
            seedFixturesIfNeeded()
            if finance == nil { finance = BunFixtures.finance }
        if cardLedgers == nil { cardLedgers = BunFixtures.cardLedgers }
            return
        }
        guard canSeeFinance, finance == nil else { return }
        do {
            finance = try await PortalAPI.shared.finance()
            financeError = nil
        } catch {
            financeError = "Could not load finance: \(error.localizedDescription)"
        }
    }

    func addExpense(name: String, amount: Double, recurring: Bool, dueDay: Int?) async throws {
        guard signedIn else {
            // Demo: the expense lands in the month immediately.
            if var read = finance {
                read.expenseRows.append(BusinessExpense(id: UUID(), name: name, amount: amount,
                                                        recurring: recurring, dueDay: dueDay,
                                                        oneOffDate: recurring ? nil : Self.dayKey(Date()),
                                                        category: nil))
                read.expenses += amount
                finance = read
            }
            return
        }
        try await PortalAPI.shared.addExpense(
            PortalAPI.NewExpense(name: name, amount: amount, recurring: recurring,
                                 dueDay: dueDay, oneOffDate: recurring ? nil : Self.dayKey(Date()),
                                 category: nil))
        finance = nil
        await loadFinance()
    }

    func deleteExpense(_ expense: BusinessExpense) async throws {
        guard signedIn else {
            if var read = finance {
                read.expenseRows.removeAll { $0.id == expense.id }
                read.expenses -= expense.amount
                finance = read
            }
            return
        }
        try await PortalAPI.shared.deleteExpense(id: expense.id)
        finance = nil
        await loadFinance()
    }

    // Performance (web /performance: range, one canonical graph, drilldown)
    var perfDays = 7
    var perfActivity: [EODActivity]?

    /// The one graph's metric, same list the web's picker offers.
    enum PerfMetric: String, CaseIterable, Sendable {
        case booked, shows, closes, dials, dms, convos

        var label: String {
            switch self {
            case .booked: "Calls booked"
            case .shows: "Shows"
            case .closes: "Closes"
            case .dials: "Dials"
            case .dms: "DMs sent"
            case .convos: "Convos started"
            }
        }

        func value(_ row: EODActivity) -> Int {
            switch self {
            case .booked: row.callsBooked ?? 0
            case .shows: row.shows ?? 0
            case .closes: row.closes ?? 0
            case .dials: row.dials ?? 0
            // Leads contacted folded into DMs sent — old rows keep the old
            // column, so the larger of the two is the honest number.
            case .dms: max(row.dmsSent ?? 0, row.leadsContacted ?? 0)
            case .convos: row.convosStarted ?? 0
            }
        }
    }

    var perfMetric: PerfMetric = .booked

    var perfRangeLabel: String { perfDays == 7 ? "Last 7 days" : "Last \(perfDays) days" }

    /// The metric by day, oldest first, with empty days filled in so the
    /// graph shows a real week rather than only the days someone filed.
    var perfSeries: [(day: String, value: Int)] {
        guard let rows = perfActivity else { return [] }
        var totals: [String: Int] = [:]
        for row in rows { totals[row.reportDate, default: 0] += perfMetric.value(row) }
        return (0..<perfDays).reversed().map { back in
            let date = Calendar.current.date(byAdding: .day, value: -back, to: Date()) ?? Date()
            let key = Self.dayKey(date)
            return (day: key, value: totals[key] ?? 0)
        }
    }

    func setPerfRange(_ days: Int) async {
        guard days != perfDays else { return }
        perfDays = days
        teamSummary = nil
        teamRows = nil
        perfActivity = nil
        await loadTeam()
    }

    /// One member's days in the range, newest first.
    func perfDays(for memberId: UUID) -> [EODActivity] {
        (perfActivity ?? []).filter { $0.userId == memberId }
            .sorted { $0.reportDate > $1.reportDate }
    }

    // Home pictures (web home-sales-picture / home-fulfillment-picture)
    var sales: SalesPicture?
    /// Client self-reports, last 14 days — filed-today and quiet-14 come off
    /// the same rows the web counts.
    var studentEODs: [StudentEOD]?
    var scheduledCalls: Int?
    var clientFilter: ClientFilter = .all

    // Movement (4 months, oldest first)
    var movementIn: [(label: String, amount: Double)]?
    var movementOut: [(label: String, amount: Double)]?
    var movementSources: [(name: String, amount: Double)]?

    struct BunPlanItem: Identifiable, Sendable {
        let id: UUID
        let student: String
        let amount: Double
        let due: String
        let overdue: Bool
    }

    struct BunPayoutItem: Identifiable, Sendable {
        let id: String       // member id
        let name: String
        let amount: Double
    }

    // MARK: - Loads (each degrades to an honest empty/error state)

    func loadHome() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        await loadOrgs()
        if firstName == nil, let profile = try? await PortalAPI.shared.myProfile() {
            firstName = profile.displayName?.split(separator: " ").first.map(String.init)
        }
        if cashSeries == nil { cashSeries = try? await PortalAPI.shared.dailyCashSeries(days: rangeDays) }
        if monthIn == nil { monthIn = try? await PortalAPI.shared.collectedCashMonth() }
        if paidOutPeriod == nil, let tile = try? await PortalAPI.shared.payoutTile() {
            paidOutPeriod = tile.paidSum
            toPayPeriod = tile.allPaid ? 0 : tile.remaining
        }
        if monthOut == nil, let expenses = try? await PortalAPI.shared.businessExpenses() {
            // Month out = this month's recurring load + payouts already paid.
            let recurring = expenses.filter(\.recurring).reduce(0) { $0 + $1.amount }
            monthOut = recurring + (paidOutPeriod ?? 0)
        }
        if wallet == nil { wallet = try? await PortalAPI.shared.myWallet() }
        if movementIn == nil { await loadMovement() }
    }

    /// Four calendar months of money in (collected cash) and money out
    /// (one-off expenses that month + the recurring monthly load).
    func loadMovement() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM"
        let keyFormatter = DateFormatter()
        keyFormatter.locale = Locale(identifier: "en_US_POSIX")
        keyFormatter.dateFormat = "yyyy-MM"

        let months: [Date] = (0..<4).reversed().compactMap {
            calendar.date(byAdding: .month, value: -$0, to: Date())
        }
        let monthKeys = months.map { keyFormatter.string(from: $0) }

        var inByMonth: [String: Double] = [:]
        if let series = try? await PortalAPI.shared.dailyCashSeries(days: 120) {
            for day in series {
                let key = String(day.id.prefix(7))
                inByMonth[key, default: 0] += day.amount
            }
        }
        var outByMonth: [String: Double] = [:]
        var sources: [String: Double] = [:]
        if let expenses = try? await PortalAPI.shared.businessExpenses() {
            let recurring = expenses.filter(\.recurring).reduce(0) { $0 + $1.amount }
            for key in monthKeys { outByMonth[key] = recurring }
            for expense in expenses {
                if let oneOff = expense.oneOffDate {
                    let key = String(oneOff.prefix(7))
                    outByMonth[key, default: 0] += expense.amount
                }
                sources[expense.name, default: 0] += expense.amount
            }
        }
        movementIn = zip(months, monthKeys).map { (formatter.string(from: $0), inByMonth[$1] ?? 0) }
        movementOut = zip(months, monthKeys).map { (formatter.string(from: $0), -(outByMonth[$1] ?? 0)) }
        movementSources = sources.sorted { $0.value > $1.value }.prefix(6).map { ($0.key, -$0.value) }
    }

    func loadLedger() async {
        guard signedIn, ledger == nil else { return }
        do {
            async let dealsQ = PortalAPI.shared.recentDeals(limit: 60)
            async let plansQ = PortalAPI.shared.paymentPlans()
            let deals = try await dealsQ
            let (plans, payments) = try await plansQ
            let studentByPlan = Dictionary(uniqueKeysWithValues: plans.map { ($0.id, $0.studentName) })

            var rows: [(date: Date, tx: BunTransaction)] = []
            for deal in deals where (deal.cashCollectedUpfront ?? 0) > 0 {
                guard let date = Self.parseDay(deal.dealDate) else { continue }
                rows.append((date, BunTransaction(
                    counterparty: deal.studentName,
                    method: "Deal · \(deal.paymentType?.uppercased() ?? "CASH") upfront",
                    amount: deal.cashCollectedUpfront ?? 0,
                    day: Self.dayLabel(date), tag: nil, category: deal.programType,
                    avatarFill: Self.fill(for: deal.studentName))))
            }
            for payment in payments where payment.status == "paid" {
                guard let stamp = payment.paidAt,
                      let date = PortalAPI.parseTimestamp(stamp) ?? Self.parseDay(String(stamp.prefix(10))) else { continue }
                let student = studentByPlan[payment.installmentId] ?? "Installment"
                rows.append((date, BunTransaction(
                    counterparty: student,
                    method: "Installment\(payment.sequence.map { " · #\($0)" } ?? "")",
                    amount: payment.amount,
                    day: Self.dayLabel(date), tag: nil, category: nil,
                    avatarFill: Self.fill(for: student))))
            }
            if let expenses = try? await PortalAPI.shared.businessExpenses() {
                for expense in expenses {
                    guard let oneOff = expense.oneOffDate, let date = Self.parseDay(oneOff) else { continue }
                    rows.append((date, BunTransaction(
                        counterparty: expense.name,
                        method: "Expense\(expense.category.map { " · \($0.capitalized)" } ?? "")",
                        amount: -expense.amount,
                        day: Self.dayLabel(date), tag: nil, category: expense.category,
                        avatarFill: Self.fill(for: expense.name))))
                }
            }
            ledger = rows.sorted { $0.date > $1.date }.map(\.tx)
            ledgerError = nil
        } catch {
            ledgerError = "Could not load the ledger."
        }
    }

    func loadMove() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        if overduePayments == nil, let (plans, payments) = try? await PortalAPI.shared.paymentPlans() {
            let studentByPlan = Dictionary(uniqueKeysWithValues: plans.map { ($0.id, $0.studentName) })
            func item(_ payment: PlanPayment, overdue: Bool) -> BunPlanItem {
                BunPlanItem(id: payment.id,
                            student: studentByPlan[payment.installmentId] ?? "Installment",
                            amount: payment.amount,
                            due: Self.friendlyDue(payment.dueDate),
                            overdue: overdue)
            }
            overduePayments = payments.filter { $0.status == "late" || $0.status == "missed" }.map { item($0, overdue: true) }
            upcomingPayments = payments.filter { $0.status == "upcoming" }.prefix(20).map { item($0, overdue: false) }
        }
        if unconfirmedPayouts == nil, let ledgerData = try? await PortalAPI.shared.payoutLedger(offset: 0) {
            payoutPeriodStart = ledgerData.period.start
            payoutPeriodLabel = ledgerData.period.label
            let confirmed = Set(ledgerData.confirmations.map { $0.userId.uuidString })
            unconfirmedPayouts = ledgerData.owed
                .filter { $0.total > 0 && !confirmed.contains($0.id) }
                .map { BunPayoutItem(id: $0.id, name: $0.name, amount: $0.total) }
        }
    }

    // MARK: - Writes

    func markPaid(_ item: BunPlanItem) async throws {
        if signedIn {
            try await PortalAPI.shared.markInstallmentPaid(id: item.id)
            overduePayments?.removeAll { $0.id == item.id }
            upcomingPayments?.removeAll { $0.id == item.id }
            ledger = nil
            await loadLedger()
        } else {
            // Demo: the collected installment lands in the ledger instantly.
            overduePayments?.removeAll { $0.id == item.id }
            upcomingPayments?.removeAll { $0.id == item.id }
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "MMM d, yyyy"
            ledger?.insert(BunTransaction(
                counterparty: item.student, method: "Installment · collected",
                amount: item.amount, day: formatter.string(from: Date()),
                tag: nil, category: nil,
                avatarFill: BunStore.fill(for: item.student)), at: 0)
            monthIn = (monthIn ?? 0) + item.amount
        }
    }

    func confirmPayout(_ item: BunPayoutItem) async throws {
        if signedIn {
            guard let start = payoutPeriodStart else { return }
            try await PortalAPI.shared.confirmPayout(periodStart: start, memberId: item.id, amount: item.amount)
        }
        unconfirmedPayouts?.removeAll { $0.id == item.id }
    }

    func loadClients() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        if roster == nil {
            roster = try? await PortalAPI.shared.students()
        }
        if health == nil {
            health = try? await PortalAPI.shared.studentHealthMap()
        }
        if callCounts == nil {
            callCounts = try? await PortalAPI.shared.studentCallCounts()
        }
        if paidByStudent == nil, let (plans, payments) = try? await PortalAPI.shared.paymentPlans() {
            let nameByPlan = Dictionary(uniqueKeysWithValues: plans.map { ($0.id, $0.studentName) })
            var paid: [String: Double] = [:]
            var totals: [String: Double] = [:]
            for plan in plans { totals[plan.studentName, default: 0] += plan.totalAmount }
            for payment in payments where payment.status == "paid" {
                if let name = nameByPlan[payment.installmentId] {
                    paid[name, default: 0] += payment.amount
                }
            }
            paidByStudent = paid
            totalByStudent = totals
        }
    }

    /// Roster in the founder's priority order: struggling 1:1 first,
    /// scholarship last (ClientPriority, unchanged core rule).
    var prioritizedRoster: [StudentRosterItem] {
        (roster ?? []).sorted { a, b in
            ClientPriority.areInIncreasingOrder(
                lhsRank: ClientPriority.rank(isOneOnOne: a.isOneOnOne, phase: a.phase,
                                             paymentState: a.paymentState, band: health?[a.id]?.band),
                lhsScore: health?[a.id]?.score, lhsName: a.fullName,
                rhsRank: ClientPriority.rank(isOneOnOne: b.isOneOnOne, phase: b.phase,
                                             paymentState: b.paymentState, band: health?[b.id]?.band),
                rhsScore: health?[b.id]?.score, rhsName: b.fullName
            )
        }
    }

    func loadOps() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        if checkinStamps == nil {
            checkinStamps = (try? await PortalAPI.shared.latestCheckins()) ?? [:]
        }
    }

    func loadSets() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        if mySets == nil {
            mySets = (try? await PortalAPI.shared.myUpcomingSets()) ?? []
        }
        if unclaimedSetCount == nil {
            unclaimedSets = (try? await PortalAPI.shared.unclaimedUpcomingSets()) ?? []
            unclaimedSetCount = unclaimedSets?.count ?? 0
        }
    }

    func loadDocs() async {
        guard signedIn, docs == nil else { return }
        docs = (try? await PortalAPI.shared.docs()) ?? []
    }

    func daysSinceCheckin(_ studentId: UUID) -> Int? {
        guard let stamp = checkinStamps?[studentId],
              let date = PortalAPI.parseTimestamp(stamp) else { return nil }
        return Int(floor(Date().timeIntervalSince(date) / 86_400))
    }

    /// Coldest-first check-in queue: active, not graduated, worst gap first.
    var checkinQueue: [StudentRosterItem] {
        let graduated: Set<String> = ["offer_won", "testimonial", "graduated"]
        return (roster ?? [])
            .filter { student in
                let phase = student.phase == "coaching_1on1" ? "training" : (student.phase ?? "onboarding")
                return student.status == "active" && !graduated.contains(phase)
            }
            .sorted { (daysSinceCheckin($0.id) ?? Int.max) > (daysSinceCheckin($1.id) ?? Int.max) }
    }

    func quickCheckin(_ student: StudentRosterItem) async throws {
        checkedNow.insert(student.id)
        do {
            try await PortalAPI.shared.logCheckin(studentId: student.id)
        } catch {
            checkedNow.remove(student.id)
            throw error
        }
    }

    func tally(_ kind: String) async throws {
        tallyCounts[kind, default: 0] += 1
        do {
            try await PortalAPI.shared.addTally(kind: kind)
        } catch {
            tallyCounts[kind, default: 1] -= 1
            throw error
        }
    }

    func undoTally(_ kind: String) async throws {
        guard tallyCounts[kind, default: 0] > 0 else { return }
        tallyCounts[kind, default: 1] -= 1
        do {
            try await PortalAPI.shared.undoLastTally(kind: kind)
        } catch {
            tallyCounts[kind, default: 0] += 1
            throw error
        }
    }

    func confirmSet(_ set: PortalAPI.SetReminderFull) async throws {
        try await PortalAPI.shared.confirmSet(id: set.id)
        mySets = nil
        await loadSets()
    }

    func loadTeam() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        // Roles gate the EOD-due check (founders never owe EODs).
        if !AuthStore.shared.rolesLoaded {
            await AuthStore.shared.loadRoles()
        }
        if teamSummary == nil, let result = try? await PortalAPI.shared.performanceSummary(days: perfDays) {
            teamSummary = result.summary
            teamRows = result.rows
        }
        if teamNotes == nil {
            // RLS decides what comes back; non-admins simply see their own.
            teamNotes = (try? await PortalAPI.shared.teamEODNotes(days: 7)) ?? []
        }
        if perfActivity == nil {
            perfActivity = (try? await PortalAPI.shared.eodActivity(days: perfDays)) ?? []
        }
        if eodDue == nil {
            eodDue = await PortalAPI.shared.owesTodayEOD(roles: AuthStore.shared.roles)
        }
        if setterType == nil {
            setterType = try? await PortalAPI.shared.mySetterType()
        }
    }

    // MARK: - The delivery picture

    /// Every tile on the Clients tab is one of these, and tapping it filters
    /// the roster to exactly the people it counted (founder's exact-element
    /// rule — a number must land on its own rows).
    enum ClientFilter: String, CaseIterable, Sendable {
        case all, atRisk, needsCheckin, quiet, onboarding, testimonial

        var label: String {
            switch self {
            case .all: "All clients"
            case .atRisk: "At risk"
            case .needsCheckin: "Needs a check-in"
            case .quiet: "Quiet 14 days"
            case .onboarding: "Stuck in onboarding"
            case .testimonial: "Testimonial ready"
            }
        }
    }

    struct Delivery: Sendable {
        var active = 0
        var newThisWeek = 0
        var atRisk = 0
        var watch = 0
        var checkedToday = 0
        var dueCheckin = 0
        var filedToday = 0
        var quiet14 = 0
        var stuck = 0
        var testimonialsReady = 0
        var callsWeek = 0
        var openItems = 0
        var overdueItems = 0
    }

    private var activeClients: [StudentRosterItem] {
        (roster ?? []).filter { $0.status == "active" && $0.archivedAt == nil }
    }

    /// Working phases only — the same set the check-in queue covers.
    private var coverageClients: [StudentRosterItem] {
        activeClients.filter { ["onboarding", "training", "coaching_1on1", "applying"].contains($0.phase ?? "onboarding") }
    }

    private var reportedRecently: Set<UUID> {
        Set((studentEODs ?? []).map(\.studentId))
    }

    var delivery: Delivery {
        var out = Delivery()
        let active = activeClients
        let today = Self.dayKey(Date())
        out.active = active.count
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        let weekStart = Self.dayKey(calendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date())
        out.newThisWeek = active.filter { ($0.createdAt.map { String($0.prefix(10)) } ?? "9999") >= weekStart }.count
        for client in active {
            switch health?[client.id]?.band {
            case .red: out.atRisk += 1
            case .amber: out.watch += 1
            default: break
            }
        }
        out.checkedToday = coverageClients.filter { daysSinceCheckin($0.id) == 0 || checkedNow.contains($0.id) }.count
        out.dueCheckin = coverageClients.filter { (daysSinceCheckin($0.id) ?? 99) >= 2 }.count
        let reported = reportedRecently
        out.filedToday = Set((studentEODs ?? []).filter { $0.reportDate == today }.map(\.studentId)).count
        out.quiet14 = studentEODs == nil ? 0 : active.filter { !reported.contains($0.id) }.count
        out.stuck = active.filter(\.stuckInOnboarding).count
        out.testimonialsReady = active.filter(\.testimonialReady).count
        out.callsWeek = scheduledCalls ?? 0
        let clientTasks = tasks.filter { $0.isClient && !$0.done }
        out.openItems = clientTasks.count
        out.overdueItems = clientTasks.filter(\.isOverdue).count
        return out
    }

    /// The rows behind one tile.
    func clients(for filter: ClientFilter) -> [StudentRosterItem] {
        let reported = reportedRecently
        return prioritizedRoster.filter { client in
            switch filter {
            case .all: true
            case .atRisk: health?[client.id]?.band == .red
            case .needsCheckin: (daysSinceCheckin(client.id) ?? 99) >= 2
            case .quiet: client.status == "active" && !reported.contains(client.id) && studentEODs != nil
            case .onboarding: client.stuckInOnboarding
            case .testimonial: client.testimonialReady
            }
        }
    }

    func loadPictures() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        if sales == nil { sales = try? await PortalAPI.shared.salesPicture() }
        if studentEODs == nil { studentEODs = (try? await PortalAPI.shared.allStudentEODs(days: 14)) ?? [] }
        if scheduledCalls == nil { scheduledCalls = try? await PortalAPI.shared.scheduledCallsCount() }
    }

    // MARK: - Action items (the two sources the web hub merges)

    /// One row in the action queue, whichever table it came from.
    struct BunTask: Identifiable, Sendable {
        enum Source: Sendable, Equatable {
            case adhoc(UUID)
            case call(UUID, Int)
        }
        let id: String
        let text: String
        let done: Bool
        let due: String?
        /// Client name for a client item, member name for a team item.
        let subject: String
        let isClient: Bool
        let ownerId: UUID?
        let source: Source
        let canDelete: Bool

        var isOverdue: Bool {
            guard !done, let due else { return false }
            let today = BunStore.dayKey(Date())
            return due < today
        }
    }

    func loadActionItems() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        if teamMembers == nil {
            let members = (try? await PortalAPI.shared.teamMembers()) ?? []
            teamMembers = members
            for member in members { staffNames[member.id] = member.displayName ?? "Team member" }
        }
        if roster == nil { roster = try? await PortalAPI.shared.students() }
        if actionItems == nil { actionItems = (try? await PortalAPI.shared.actionItems()) ?? [] }
        if callItems == nil { callItems = (try? await PortalAPI.shared.callActionItems()) ?? [] }
    }

    /// Both sources merged, overrides applied, open first then soonest due.
    var tasks: [BunTask] {
        let names = Dictionary(uniqueKeysWithValues: (roster ?? []).map { ($0.id, $0.fullName) })
        var out: [BunTask] = []

        for row in actionItems ?? [] {
            let id = "adhoc-\(row.id.uuidString)"
            let client = row.studentId.flatMap { names[$0] }
            out.append(BunTask(
                id: id,
                text: row.text,
                done: taskDoneOverride[id] ?? row.done,
                due: row.dueDate,
                subject: client ?? staffNames[row.assigneeId ?? row.createdBy] ?? "Team",
                isClient: row.studentId != nil,
                ownerId: row.ownerId,
                source: .adhoc(row.id),
                canDelete: row.createdBy == meId
            ))
        }

        for row in callItems ?? [] {
            let id = row.id
            out.append(BunTask(
                id: id,
                text: row.item.text,
                done: taskDoneOverride[id] ?? row.item.done,
                due: row.item.due,
                subject: names[row.studentId] ?? "Client",
                isClient: true,
                ownerId: row.coachId,
                source: .call(row.callId, row.index),
                canDelete: false
            ))
        }

        out.append(contentsOf: localTasks)

        return out
            .filter { !taskRemoved.contains($0.id) }
            .sorted { a, b in
                if a.done != b.done { return !a.done }
                let left = a.due ?? "9999-99-99"
                let right = b.due ?? "9999-99-99"
                if left != right { return left < right }
                return a.text < b.text
            }
    }

    var myOpenTasks: [BunTask] { tasks.filter { !$0.done && $0.ownerId == meId } }

    /// Tick optimistically, then write. A failed write puts the tick back.
    func setTaskDone(_ task: BunTask, done: Bool) async throws {
        taskDoneOverride[task.id] = done
        guard signedIn else { return }
        do {
            switch task.source {
            case .adhoc(let id):
                try await PortalAPI.shared.setActionItemDone(id: id, done: done)
            case .call(let callId, let index):
                try await PortalAPI.shared.setCallActionItemDone(callId: callId, index: index, done: done)
            }
        } catch {
            taskDoneOverride[task.id] = !done
            throw error
        }
    }

    func deleteTask(_ task: BunTask) async throws {
        guard case .adhoc(let id) = task.source else { return }
        taskRemoved.insert(task.id)
        localTasks.removeAll { $0.id == task.id }
        guard signedIn else { return }
        do {
            try await PortalAPI.shared.deleteActionItem(id: id)
        } catch {
            taskRemoved.remove(task.id)
            throw error
        }
    }

    /// One row per target, exactly like the web composer's broadcast insert.
    func addTasks(text: String, due: String?, students: [StudentRosterItem], members: [StaffProfile]) async throws {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard signedIn, let me = PortalAPI.shared.currentUserID else {
            // Demo workspace: the composer still has to produce a real row.
            for student in students {
                localTasks.append(BunTask(id: "local-\(UUID().uuidString)", text: trimmed, done: false,
                                          due: due, subject: student.fullName, isClient: true,
                                          ownerId: meId, source: .adhoc(UUID()), canDelete: true))
            }
            for member in members {
                localTasks.append(BunTask(id: "local-\(UUID().uuidString)", text: trimmed, done: false,
                                          due: due, subject: member.displayName ?? "Team member",
                                          isClient: false, ownerId: member.id,
                                          source: .adhoc(UUID()), canDelete: true))
            }
            return
        }
        var rows: [NewActionItem] = students.map {
            NewActionItem(studentId: $0.id, assigneeId: nil, createdBy: me, text: trimmed, dueDate: due)
        }
        rows += members.map {
            NewActionItem(studentId: nil, assigneeId: $0.id, createdBy: me, text: trimmed, dueDate: due)
        }
        guard !rows.isEmpty else { return }
        try await PortalAPI.shared.createActionItems(rows)
        actionItems = nil
        await loadActionItems()
    }

    // MARK: - 1:1 calls and my own EOD history

    func loadCalls(for studentId: UUID) async {
        guard signedIn else {
            seedFixturesIfNeeded()
            if callsByStudent[studentId] == nil { callsByStudent[studentId] = [] }
            return
        }
        guard callsByStudent[studentId] == nil else { return }
        callsByStudent[studentId] = (try? await PortalAPI.shared.studentCalls(studentId: studentId)) ?? []
    }

    func logCall(_ call: NewStudentCall) async throws {
        guard signedIn else {
            // Demo: show the call immediately so the flow is not a dead end.
            let fake = StudentCall(id: UUID(), studentId: call.studentId, callDate: call.callDate,
                                   coachNotes: call.coachNotes, coachId: call.coachId, status: call.status,
                                   progressRating: call.progressRating, nextStep: call.nextStep,
                                   fathomUrl: call.fathomUrl, actionItemsJson: call.actionItemsJson)
            callsByStudent[call.studentId, default: []].insert(fake, at: 0)
            callCounts?[call.studentId, default: 0] += 1
            return
        }
        try await PortalAPI.shared.logStudentCall(call)
        callsByStudent[call.studentId] = nil
        callCounts = nil
        callItems = nil
        await loadCalls(for: call.studentId)
        callCounts = try? await PortalAPI.shared.studentCallCounts()
    }

    func loadMyEODs() async {
        guard signedIn else { seedFixturesIfNeeded(); return }
        if myEODs == nil { myEODs = (try? await PortalAPI.shared.myEODs(days: 7)) ?? [] }
    }

    /// Fresh sign-in: pull everything.
    private func clearAll() {
        firstName = nil
        cashSeries = nil
        monthIn = nil
        monthOut = nil
        paidOutPeriod = nil
        toPayPeriod = nil
        wallet = nil
        movementIn = nil
        movementOut = nil
        movementSources = nil
        ledger = nil
        ledgerError = nil
        overduePayments = nil
        upcomingPayments = nil
        unconfirmedPayouts = nil
        payoutPeriodLabel = nil
        payoutPeriodStart = nil
        orgs = nil
        roster = nil
        callCounts = nil
        health = nil
        paidByStudent = nil
        totalByStudent = nil
        teamSummary = nil
        teamRows = nil
        teamNotes = nil
        setterType = nil
        eodDue = nil
        checkinStamps = nil
        checkedNow = []
        tallyCounts = [:]
        mySets = nil
        unclaimedSetCount = nil
        unclaimedSets = nil
        teamWeek = nil
        docs = nil
        actionItems = nil
        callItems = nil
        teamMembers = nil
        staffNames = [:]
        callsByStudent = [:]
        myEODs = nil
        taskDoneOverride = [:]
        taskRemoved = []
        localTasks = []
        perfActivity = nil
        deals = nil
        plans = nil
        planPayments = nil
        payoutData = nil
        payoutError = nil
        payoutOffset = 0
        finance = nil
        financeError = nil
        cardLedgers = nil
        sales = nil
        studentEODs = nil
        scheduledCalls = nil
        clientFilter = .all
    }

    func refreshAll() async {
        clearAll()
        guard signedIn else { seedFixturesIfNeeded(); return }
        await loadHome()
        await loadLedger()
        await loadMove()
        await loadClients()
        await loadTeam()
        await loadActionItems()
        await loadPictures()
    }

    // MARK: - Fixture seeding (signed-out demo workspace)

    /// Pour the Acme Coaching demo into the store so every surface renders
    /// exactly like live. Idempotent; only applies while signed out.
    func seedFixturesIfNeeded() {
        guard !signedIn else { return }
        // Field by field: a pull-to-refresh nils individual slices, so every
        // missing piece refills rather than requiring a full reset.
        if firstName == nil { firstName = BunFixtures.userName }
        if cashSeries == nil { cashSeries = BunFixtures.cashDays(days: rangeDays) }
        if monthIn == nil { monthIn = BunFixtures.monthMoneyIn }
        if monthOut == nil { monthOut = -BunFixtures.monthMoneySpent }
        if paidOutPeriod == nil { paidOutPeriod = -BunFixtures.range30Out }
        if toPayPeriod == nil { toPayPeriod = 1_860.00 }
        if wallet == nil { wallet = BunFixtures.wallet }
        if movementIn == nil { movementIn = BunFixtures.movementInMonths }
        if movementOut == nil {
            movementOut = BunFixtures.movementMonths.map { (label: $0.label, amount: $0.spent) }
        }
        if movementSources == nil { movementSources = BunFixtures.movementSources }
        if ledger == nil { ledger = BunFixtures.transactions }
        if overduePayments == nil { overduePayments = BunFixtures.overduePayments }
        if upcomingPayments == nil { upcomingPayments = BunFixtures.upcomingPayments }
        if unconfirmedPayouts == nil { unconfirmedPayouts = BunFixtures.unconfirmedPayouts }
        if payoutPeriodLabel == nil { payoutPeriodLabel = BunFixtures.payoutPeriodLabel }
        if roster == nil { roster = BunFixtures.roster }
        if callCounts == nil { callCounts = BunFixtures.callCounts }
        if health == nil { health = BunFixtures.health }
        if paidByStudent == nil { paidByStudent = BunFixtures.paidByStudent }
        if totalByStudent == nil { totalByStudent = BunFixtures.totalByStudent }
        if teamSummary == nil { teamSummary = BunFixtures.teamSummary }
        if teamRows == nil { teamRows = BunFixtures.teamRows }
        if teamNotes == nil { teamNotes = BunFixtures.teamNotes }
        if setterType == nil { setterType = "dm" }
        if eodDue == nil { eodDue = false }   // admin view: never owes an EOD
        if checkinStamps == nil { checkinStamps = BunFixtures.checkinStamps }
        if tallyCounts.isEmpty { tallyCounts = BunFixtures.tallyCounts }
        if mySets == nil { mySets = BunFixtures.sets }
        if unclaimedSets == nil { unclaimedSets = BunFixtures.unclaimedSets }
        if unclaimedSetCount == nil { unclaimedSetCount = 1 }
        if teamWeek == nil { teamWeek = BunFixtures.teamWeek }
        if docs == nil { docs = BunFixtures.docs }
        if actionItems == nil { actionItems = BunFixtures.actionItems }
        if callItems == nil { callItems = BunFixtures.callItems }
        if teamMembers == nil { teamMembers = BunFixtures.teamMembers }
        if staffNames.isEmpty { staffNames = BunFixtures.staffNames }
        if myEODs == nil { myEODs = BunFixtures.myEODs }
        if callsByStudent.isEmpty { callsByStudent = BunFixtures.callsByStudent }
        if perfActivity == nil { perfActivity = BunFixtures.perfActivity(days: perfDays) }
        if deals == nil { deals = BunFixtures.deals }
        if finance == nil { finance = BunFixtures.finance }
        if plans == nil {
            plans = BunFixtures.plans
            planPayments = BunFixtures.planPayments
        }
        if sales == nil { sales = BunFixtures.sales }
        if studentEODs == nil { studentEODs = BunFixtures.studentEODs }
        if scheduledCalls == nil { scheduledCalls = 4 }
    }

    /// Sign-out path: drop live data and restore the demo workspace.
    func resetToFixtures() {
        clearAll()
        seedFixturesIfNeeded()
    }

    func refreshAfterClose() async {
        ledger = nil
        cashSeries = nil
        monthIn = nil
        await loadLedger()
        await loadHome()
    }

    // MARK: - Helpers

    /// "yyyy-MM-dd" in the device calendar — the key every due-date compare
    /// and EOD day uses.
    nonisolated static func dayKey(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    nonisolated static func parseDay(_ day: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(day.prefix(10)))
    }

    /// Today / Yesterday / weekday / "Last Friday", and only beyond two weeks
    /// a short "Jul 10" — the same rule the web enforces everywhere.
    nonisolated static func friendlyDay(_ date: Date) -> String {
        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date),
                                           to: calendar.startOfDay(for: Date())).day ?? 0
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        switch days {
        case 0: return "Today"
        case 1: return "Yesterday"
        case 2...6:
            formatter.dateFormat = "EEEE"
            return formatter.string(from: date)
        case 7...13:
            formatter.dateFormat = "EEEE"
            return "Last \(formatter.string(from: date))"
        // Scheduled money reads forward as well; the no-raw-dates rule covers
        // the next two weeks exactly as it covers the last two.
        case -1: return "Tomorrow"
        case (-6)...(-2):
            formatter.dateFormat = "EEEE"
            return formatter.string(from: date)
        case (-13)...(-7):
            formatter.dateFormat = "EEEE"
            return "Next \(formatter.string(from: date))"
        default:
            formatter.dateFormat = abs(days) > 300 ? "MMM d, yyyy" : "MMM d"
            return formatter.string(from: date)
        }
    }

    nonisolated static func dayLabel(_ date: Date) -> String { friendlyDay(date) }

    nonisolated static func friendlyDue(_ day: String) -> String {
        guard let date = parseDay(day) else { return "Due soon" }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()),
                                                   to: Calendar.current.startOfDay(for: date)).day ?? 0
        if days < 0 { return "Overdue \(-days)d" }
        if days == 0 { return "Due today" }
        if days == 1 { return "Due tomorrow" }
        return "Due in \(days)d"
    }

    static func fill(for name: String) -> Color {
        let palette: [Color] = [
            Color(red: 0.23, green: 0.33, blue: 0.42), Color(red: 0.27, green: 0.30, blue: 0.44),
            Color(red: 0.18, green: 0.34, blue: 0.32), Color(red: 0.36, green: 0.27, blue: 0.42),
            Color(red: 0.40, green: 0.30, blue: 0.24), Color(red: 0.25, green: 0.28, blue: 0.42),
        ]
        var hash = 0
        for scalar in name.unicodeScalars { hash = (hash &* 31 &+ Int(scalar.value)) }
        return palette[abs(hash) % palette.count]
    }
}
