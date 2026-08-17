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
        if teamSummary == nil, let result = try? await PortalAPI.shared.performanceSummary(days: 7) {
            teamSummary = result.summary
            teamRows = result.rows
        }
        if teamNotes == nil {
            // RLS decides what comes back; non-admins simply see their own.
            teamNotes = (try? await PortalAPI.shared.teamEODNotes(days: 7)) ?? []
        }
        if eodDue == nil {
            eodDue = await PortalAPI.shared.owesTodayEOD(roles: AuthStore.shared.roles)
        }
        if setterType == nil {
            setterType = try? await PortalAPI.shared.mySetterType()
        }
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
    }

    func refreshAll() async {
        clearAll()
        guard signedIn else { seedFixturesIfNeeded(); return }
        await loadHome()
        await loadLedger()
        await loadMove()
        await loadClients()
        await loadTeam()
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

    static func parseDay(_ day: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(day.prefix(10)))
    }

    static func dayLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: date)
    }

    static func friendlyDue(_ day: String) -> String {
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
