import SwiftUI

// Students as Mercury "accounts" (data phase 2, founder "continue"):
// priority-ordered roster rows and an account-style detail sheet. Business
// rules ride the core: ClientPriority order, StudentHealth bands, group
// students never gain 1:1 surfaces.

struct BunClientRow: View {
    let student: StudentRosterItem
    let health: StudentHealthResult?
    let paid: Double
    let total: Double
    let action: () -> Void

    private var bandColor: Color {
        switch health?.band {
        case .red: BunTheme.pink
        case .amber: Color(red: 0.95, green: 0.72, blue: 0.35)
        case .green: BunTheme.green
        case nil: BunTheme.secondary
        }
    }

    private var caption: String {
        if student.paymentState == "scholarship" { return "Scholarship" }
        if total > 0 { return "\(ivyMoney(paid)) of \(ivyMoney(total)) paid" }
        return student.isOneOnOne ? "1:1 pathway" : "Group pathway"
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Circle().fill(bandColor.opacity(0.16)).frame(width: 44, height: 44)
                    .overlay {
                        if let score = health.flatMap({ $0.locked ? nil : $0.score }) {
                            Text("\(score)").font(bunFont(15, .medium)).foregroundStyle(bandColor)
                        } else {
                            Text(String(student.fullName.prefix(1)))
                                .font(bunFont(16, .medium)).foregroundStyle(BunTheme.secondary)
                        }
                    }
                VStack(alignment: .leading, spacing: 3) {
                    Text(student.fullName).font(bunFont(19)).foregroundStyle(BunTheme.ink).lineLimit(1)
                    Text(caption).font(bunFont(15)).foregroundStyle(BunTheme.secondary).lineLimit(1)
                }
                Spacer()
                BunTag(text: BunClientSheet.phaseLabel(student.phase),
                       tint: BunClientSheet.phaseTint(student.phase),
                       fill: BunClientSheet.phaseTint(student.phase).opacity(0.14))
            }
            .frame(minHeight: 66)
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }
}

/// The client record (web /students/$id, founder "go ahead with all"
/// 2026-08-18). Overview carries the standing and the controls; the rest of
/// the record sits behind a segment so one screen is never a wall. Group
/// clients never grow 1:1 surfaces — the coaching allowance gates them.
struct BunClientSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var testimonialRequested = false
    @State private var requestError: String?
    @State private var showLogCall = false
    @State private var tab = 0
    @State private var newNote = ""
    let student: StudentRosterItem

    private var offerWon: Bool {
        ["offer_won", "testimonial", "graduated"].contains(store.phase(of: student))
    }

    private var health: StudentHealthResult? { store.health?[student.id] }
    private var callsUsed: Int { store.callCounts?[student.id] ?? 0 }
    private var callsAllotted: Int { student.callsAllotted ?? 0 }
    private var eods: [StudentEOD] { store.studentEODsBy[student.id] ?? [] }
    private var weekly: [PortalAPI.WeeklyEOD] { store.weeklyEODsBy[student.id] ?? [] }
    private var notes: [CSMNote] { store.notesBy[student.id] ?? [] }
    private var placements: [PortalAPI.Placement] { store.placementsBy[student.id] ?? [] }
    private var paid: Double { store.paidByStudent?[student.fullName] ?? 0 }
    private var total: Double { store.totalByStudent?[student.fullName] ?? 0 }
    private var transactions: [BunTransaction] {
        (store.ledger ?? []).filter { $0.counterparty == student.fullName }
    }

    private var tabs: [String] {
        student.isOneOnOne ? ["Overview", "Calls", "Reports", "Notes", "Money"]
                           : ["Overview", "Reports", "Notes", "Money"]
    }

    /// The segment index maps to a name, so adding or removing the Calls tab
    /// for group clients can never shift the wrong pane into view.
    private var pane: String { tabs.indices.contains(tab) ? tabs[tab] : "Overview" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                BunSegment(options: tabs, selection: $tab)
                switch pane {
                case "Calls": callsPane
                case "Reports": reportsPane
                case "Notes": notesPane
                case "Money": moneyPane
                default: overviewPane
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $showLogCall) {
            BunLogCallFlow(student: student)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .task { await store.loadClientRecord(student.id) }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Spacer()
                BunChipButton(symbol: "xmark") { dismiss() }
            }
            HStack(spacing: 14) {
                BunAvatar(text: String(student.fullName.prefix(1)), size: 52,
                          fill: BunStore.fill(for: student.fullName))
                VStack(alignment: .leading, spacing: 6) {
                    Text(student.fullName).font(bunFont(24)).foregroundStyle(BunTheme.ink)
                    HStack(spacing: 8) {
                        BunTag(text: Self.phaseLabel(store.phase(of: student)),
                               tint: Self.phaseTint(store.phase(of: student)),
                               fill: Self.phaseTint(store.phase(of: student)).opacity(0.14))
                        BunTag(text: student.isOneOnOne ? "1:1" : "Group")
                        if student.paymentState == "scholarship" { BunTag(text: "Scholarship") }
                    }
                }
            }
            if let health, !health.locked, health.band == .red {
                riskBanner(health)
            }
        }
    }

    /// The at-risk line the web puts at the top of the record: the score and
    /// the reasons, not a colour alone.
    private func riskBanner(_ health: StudentHealthResult) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("At risk · health \(health.score)/100")
                .font(BunType.rowTitle).foregroundStyle(BunTheme.pink)
            if !health.reasons.isEmpty {
                Text(health.reasons.prefix(3).joined(separator: " · "))
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BunTheme.pink.opacity(0.10), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    // MARK: Overview

    private var overviewPane: some View {
        VStack(alignment: .leading, spacing: 24) {
            statusStrip
            controls
            if total > 0 || paid > 0 { paidBlock }
            if offerWon { testimonialRow }
            if !placements.isEmpty { placementsBlock }
            graduationBlock
            if let reasons = health?.reasons, !reasons.isEmpty, health?.band != .red {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Signals").font(BunType.section).foregroundStyle(BunTheme.ink)
                    ForEach(reasons.prefix(3), id: \.self) { reason in
                        Text(reason).font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                    }
                }
            }
        }
    }

    /// Status, coaching burn-down, and the two recency numbers the founder
    /// judges a client on.
    private var statusStrip: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 0) {
                stat("Status", value: Self.statusLabel(student.status), dot: Self.statusTint(student.status))
                if student.isOneOnOne {
                    stat("1:1 calls", value: "\(callsUsed) of \(callsAllotted)")
                }
                stat("Health", value: health.flatMap { $0.locked ? nil : "\($0.score)" } ?? "–")
            }
            HStack(alignment: .top, spacing: 0) {
                stat("Last report", value: lastEODLine)
                stat("Last check-in", value: lastCheckinLine)
            }
        }
    }

    private var lastEODLine: String {
        guard let latest = eods.map(\.reportDate).max(), let date = BunStore.parseDay(latest) else {
            return store.studentEODsBy[student.id] == nil ? "…" : "never"
        }
        return BunStore.friendlyDay(date)
    }

    private var lastCheckinLine: String {
        if store.checkedNow.contains(student.id) { return "Today" }
        guard let days = store.daysSinceCheckin(student.id) else { return "never" }
        return days == 0 ? "Today" : (days == 1 ? "Yesterday" : "\(days)d ago")
    }

    /// Phase, coach and the check-in, the three things staff actually change
    /// from a phone.
    private var controls: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Menu {
                    ForEach(["onboarding", "training", "applying", "offer_won", "paused"], id: \.self) { phase in
                        Button("\(Self.phaseLabel(phase))\(store.phase(of: student) == phase ? " ✓" : "")") {
                            Task { try? await store.setPhase(student, to: phase) }
                        }
                    }
                } label: {
                    controlChip(symbol: "arrow.triangle.branch", label: Self.phaseLabel(store.phase(of: student)))
                }
                // A coach on a group client would be a 1:1 surface, so the
                // picker only exists for the 1:1 pathway.
                if student.isOneOnOne {
                    Menu {
                        Button("Unassigned") { Task { try? await store.setCoach(student, to: nil) } }
                        ForEach(store.coachList ?? []) { coach in
                            Button("\(coach.displayName ?? "Coach")\(store.coachId(of: student) == coach.id ? " ✓" : "")") {
                                Task { try? await store.setCoach(student, to: coach.id) }
                            }
                        }
                    } label: {
                        controlChip(symbol: "person", label: coachName)
                    }
                }
            }
            HStack(spacing: 10) {
                let checked = store.checkedNow.contains(student.id) || store.daysSinceCheckin(student.id) == 0
                BunPillChip(symbol: checked ? "checkmark" : "message.badge",
                            label: checked ? "Checked in today" : "Log a check-in",
                            tint: checked ? BunTheme.green : BunTheme.indigoLight) {
                    guard !checked else { return }
                    Task { try? await store.quickCheckin(student) }
                }
                if student.isOneOnOne {
                    BunPillChip(symbol: "phone", label: "Log a call") { showLogCall = true }
                }
            }
            if store.phase(of: student) == "training" {
                Text("Approving their looms moves them to applying.")
                    .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
            }
        }
    }

    private var coachName: String {
        guard let id = store.coachId(of: student) else { return "No coach" }
        return (store.coachList ?? []).first { $0.id == id }?.displayName ?? "Coach"
    }

    private func controlChip(symbol: String, label: String) -> some View {
        HStack(spacing: 7) {
            Image(systemName: symbol).font(.system(size: 13, weight: .regular))
            Text(label).font(bunFont(16))
            Image(systemName: "arrowtriangle.down.fill")
                .font(.system(size: 7, weight: .regular)).foregroundStyle(BunTheme.secondary)
        }
        .foregroundStyle(BunTheme.ink)
        .padding(.horizontal, 14).frame(height: 42)
        .background(BunTheme.raised, in: Capsule())
    }

    private var paidBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Paid").font(BunType.label).foregroundStyle(BunTheme.secondary)
            BunMoney(amount: paid, size: BunType.Money.hero)
            Text("of \(ivyMoney(total)) · \(ivyMoney(max(total - paid, 0))) open")
                .font(BunType.caption).foregroundStyle(BunTheme.secondary)
        }
    }

    private var testimonialRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            BunPillChip(symbol: testimonialRequested ? "checkmark" : "quote.bubble",
                        label: testimonialRequested ? "Testimonial requested" : "Request testimonial") {
                guard !testimonialRequested else { return }
                Task {
                    do {
                        try await PortalAPI.shared.requestTestimonial(studentId: student.id, type: "video", note: nil)
                        testimonialRequested = true
                        requestError = nil
                    } catch {
                        requestError = "Could not request: \(error.localizedDescription)"
                    }
                }
            }
            if let requestError {
                Text(requestError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
            }
        }
    }

    private var placementsBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Placements").font(BunType.section).foregroundStyle(BunTheme.ink)
            VStack(spacing: 0) {
                ForEach(placements) { placement in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(placement.businessName).font(BunType.rowTitle)
                                .foregroundStyle(BunTheme.ink).lineLimit(1)
                            if let interview = placement.interviewAt,
                               let date = PortalAPI.parseTimestamp(interview) {
                                Text("interview \(BunStore.friendlyDay(date).lowercased())")
                                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                            }
                        }
                        Spacer()
                        BunTag(text: (placement.stage ?? "lead").capitalized)
                    }
                    .frame(minHeight: 56)
                }
            }
        }
    }

    /// The three things that close a client out, ticked or not.
    private var graduationBlock: some View {
        let offerLanded = offerWon
        let testimonial = student.testimonialCollected == true
        return VStack(alignment: .leading, spacing: 10) {
            Text("Graduation").font(BunType.section).foregroundStyle(BunTheme.ink)
            VStack(spacing: 0) {
                graduationRow("Offer landed", done: offerLanded)
                graduationRow("First win recorded", done: student.firstWinAt != nil)
                graduationRow("Testimonial collected", done: testimonial)
            }
        }
    }

    private func graduationRow(_ label: String, done: Bool) -> some View {
        HStack(spacing: 12) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 19, weight: .regular))
                .foregroundStyle(done ? BunTheme.green : BunTheme.tertiary)
            Text(label).font(BunType.rowTitle)
                .foregroundStyle(done ? BunTheme.ink : BunTheme.secondary)
            Spacer()
        }
        .frame(minHeight: 48)
    }

    // MARK: Calls

    private var callsPane: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("1:1 calls").font(BunType.section).foregroundStyle(BunTheme.ink)
                Spacer()
                BunPillChip(symbol: "plus", label: "Log a call") { showLogCall = true }
            }
            Text("\(callsUsed) of \(callsAllotted) used · \(max(callsAllotted - callsUsed, 0)) left")
                .font(BunType.caption).foregroundStyle(BunTheme.secondary)
            BunCallHistory(student: student)
        }
    }

    // MARK: Reports

    private var reportsPane: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Daily").font(BunType.section).foregroundStyle(BunTheme.ink)
                if store.studentEODsBy[student.id] == nil {
                    RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 54)
                } else if eods.isEmpty {
                    Text("No daily reports yet.").font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(eods.sorted { $0.reportDate > $1.reportDate }.prefix(10)) { eod in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(BunStore.parseDay(eod.reportDate).map { BunStore.friendlyDay($0) } ?? "Recently")
                                        .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                                    Spacer()
                                    Text(dailyLine(eod)).font(BunType.caption)
                                        .foregroundStyle(BunTheme.secondary).monospacedDigit()
                                        .lineLimit(1).minimumScaleFactor(0.8)
                                }
                                if let wins = eod.wins, !wins.isEmpty {
                                    Text(wins).font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                if let blockers = eod.blockers, !blockers.isEmpty {
                                    Text(blockers).font(BunType.caption).foregroundStyle(BunTheme.pink)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 10)
                        }
                    }
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("Weekly").font(BunType.section).foregroundStyle(BunTheme.ink)
                if weekly.isEmpty {
                    Text("No weekly reports yet.").font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(weekly) { week in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text("Week of \(BunStore.parseDay(week.weekStart).map { BunStore.friendlyDay($0) } ?? week.weekStart)")
                                        .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                                        .lineLimit(1).minimumScaleFactor(0.85)
                                    Spacer()
                                    Text(weeklyLine(week)).font(BunType.caption)
                                        .foregroundStyle(BunTheme.secondary).lineLimit(1)
                                }
                                Text(week.implementation).font(BunType.caption)
                                    .foregroundStyle(BunTheme.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                                if let blocker = week.biggestBlocker, !blocker.isEmpty {
                                    Text(blocker).font(BunType.caption).foregroundStyle(BunTheme.pink)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 10)
                        }
                    }
                }
            }
        }
    }

    private func dailyLine(_ eod: StudentEOD) -> String {
        var bits: [String] = []
        if eod.applicationsSubmitted > 0 { bits.append("\(eod.applicationsSubmitted) apps") }
        if eod.outreachSent > 0 { bits.append("\(eod.outreachSent) outreach") }
        if eod.interviews > 0 { bits.append("\(eod.interviews) interviews") }
        return bits.isEmpty ? "filed" : bits.joined(separator: " · ")
    }

    private func weeklyLine(_ week: PortalAPI.WeeklyEOD) -> String {
        var bits = ["\(week.groupCallsAttended) group calls"]
        if let calls = week.oneOnOneCalls, calls > 0 { bits.append("\(calls) 1:1") }
        return bits.joined(separator: " · ")
    }

    // MARK: Notes

    private var notesPane: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Notes").font(BunType.section).foregroundStyle(BunTheme.ink)
            BunField(label: "Add a note", placeholder: "What happened, what is next", text: $newNote, multiline: true)
            BunCTA(label: "Save note",
                   enabled: !newNote.trimmingCharacters(in: .whitespaces).isEmpty, filled: true) {
                let text = newNote
                newNote = ""
                Task { try? await store.addNote(student, note: text) }
            }
            if notes.isEmpty {
                Text("No notes on this client yet.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(notes) { note in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(PortalAPI.parseTimestamp(note.createdAt).map { BunStore.friendlyDay($0) } ?? "Recently")
                                .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                            Text(note.note).font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 12)
                    }
                }
            }
        }
    }

    // MARK: Money

    private var moneyPane: some View {
        VStack(alignment: .leading, spacing: 16) {
            if total > 0 || paid > 0 { paidBlock }
            Text("Transactions").font(BunType.section).foregroundStyle(BunTheme.ink)
            if transactions.isEmpty {
                Text("No money movement for this client yet.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(transactions) { transaction in
                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(transaction.method).font(bunFont(17))
                                    .foregroundStyle(BunTheme.ink).lineLimit(1)
                                Text(transaction.day).font(bunFont(15)).foregroundStyle(BunTheme.secondary)
                            }
                            Spacer()
                            BunMoney(amount: transaction.amount, size: 17,
                                     color: transaction.amount > 0 ? BunTheme.green : BunTheme.ink)
                        }
                        .frame(minHeight: 58)
                    }
                }
            }
        }
    }

    // MARK: Shared

    private func stat(_ label: String, value: String, dot: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
                .lineLimit(1).minimumScaleFactor(0.8)
            HStack(spacing: 7) {
                if let dot { Circle().fill(dot).frame(width: 8, height: 8) }
                Text(value).font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private static func statusLabel(_ status: String?) -> String {
        switch status {
        case "active": "Active"
        case "paused": "Paused"
        case "ghosting": "Ghosting"
        case "refunded": "Refunded"
        case let other?: other.replacingOccurrences(of: "_", with: " ").capitalized
        case nil: "Unknown"
        }
    }

    private static func statusTint(_ status: String?) -> Color {
        switch status {
        case "active": BunTheme.green
        case "paused": BunTheme.secondary
        case "ghosting", "refunded": BunTheme.pink
        default: BunTheme.tertiary
        }
    }

    static func phaseLabel(_ raw: String?) -> String {
        switch raw == "coaching_1on1" ? "training" : (raw ?? "onboarding") {
        case "onboarding": "Onboarding"
        case "training": "Training"
        case "applying": "Applying"
        case "offer_won": "Offer won"
        case "paused": "Paused"
        case let other: other.capitalized
        }
    }

    static func phaseTint(_ raw: String?) -> Color {
        switch raw == "coaching_1on1" ? "training" : (raw ?? "onboarding") {
        case "onboarding": BunTheme.indigoLight
        case "training": Color(red: 0.63, green: 0.53, blue: 0.97)
        case "applying": Color(red: 0.28, green: 0.75, blue: 0.70)
        case "offer_won": BunTheme.green
        default: BunTheme.secondary
        }
    }
}
