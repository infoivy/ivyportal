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

/// Mercury account page for one student: tags, money standing, and their
/// slice of the ledger.
struct BunClientSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var testimonialRequested = false
    @State private var requestError: String?
    @State private var showLogCall = false
    let student: StudentRosterItem

    private var offerWon: Bool {
        ["offer_won", "testimonial", "graduated"].contains(student.phase ?? "")
    }

    private var health: StudentHealthResult? { store.health?[student.id] }
    private var callsUsed: Int { store.callCounts?[student.id] ?? 0 }
    private var callsAllotted: Int { student.callsAllotted ?? 0 }

    /// Status and coaching-call burn-down, the two things the founder wants to
    /// read the moment a client opens (2026-08-18). Group students never show
    /// a call line — they own no 1:1 surfaces.
    private var statusStrip: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Status").font(BunType.label).foregroundStyle(BunTheme.secondary)
                HStack(spacing: 7) {
                    Circle()
                        .fill(Self.statusTint(student.status))
                        .frame(width: 8, height: 8)
                    Text(Self.statusLabel(student.status))
                        .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if student.isOneOnOne {
                VStack(alignment: .leading, spacing: 6) {
                    Text("1:1 calls").font(BunType.label).foregroundStyle(BunTheme.secondary)
                    Text("\(callsUsed) of \(callsAllotted)")
                        .font(BunType.rowTitle).foregroundStyle(BunTheme.ink).monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
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
    private var paid: Double { store.paidByStudent?[student.fullName] ?? 0 }
    private var total: Double { store.totalByStudent?[student.fullName] ?? 0 }
    private var transactions: [BunTransaction] {
        (store.ledger ?? []).filter { $0.counterparty == student.fullName }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
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
                            BunTag(text: Self.phaseLabel(student.phase),
                                   tint: Self.phaseTint(student.phase),
                                   fill: Self.phaseTint(student.phase).opacity(0.14))
                            BunTag(text: student.isOneOnOne ? "1:1" : "Group")
                            if student.paymentState == "scholarship" { BunTag(text: "Scholarship") }
                            if let band = health?.band, band == .red { BunTag(text: "At risk", tint: BunTheme.pink, fill: BunTheme.pink.opacity(0.15)) }
                        }
                    }
                }
                statusStrip

                if total > 0 {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Paid").font(BunType.label).foregroundStyle(BunTheme.secondary)
                        BunMoney(amount: paid, size: BunType.Money.hero)
                        Text("of \(ivyMoney(total)) · \(ivyMoney(max(total - paid, 0))) open")
                            .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    }
                }
                if offerWon {
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
                if let reasons = health?.reasons, !reasons.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Signals").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                        ForEach(reasons.prefix(3), id: \.self) { reason in
                            Text(reason).font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                        }
                    }
                }
                // 1:1 surfaces are gated on the coaching allowance — a group
                // client never grows a call history or a log button.
                if student.isOneOnOne {
                    Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)
                    HStack {
                        Text("1:1 calls").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                        Spacer()
                        BunPillChip(symbol: "plus", label: "Log a call") { showLogCall = true }
                    }
                    BunCallHistory(student: student)
                }

                Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)
                Text("Transactions").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                if transactions.isEmpty {
                    Text("No money movement for this client yet.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(transactions) { transaction in
                            HStack(spacing: 14) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(transaction.method).font(bunFont(17)).foregroundStyle(BunTheme.ink)
                                    .lineLimit(1)
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
