import SwiftUI

/// Money page (founder 2026-08-17): Move money and Transactions merged.
/// Action chips, what's due next, the payments lists, and the full feed.
struct BunMoneyPage: View {
    @State private var store = BunStore.shared
    @State private var listKind: BunPaymentListSheet.Kind?
    @State private var showCalendar = false
    @State private var showLogClose = false
    @State private var emptyListTitle: String?
    @State private var showSend = false
    @State private var showTransfer = false
    @State private var showDeposit = false
    @State private var showRequest = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                BunTitle(text: "Money")

                actionChips

                upNextSection

                paymentsSection

                edgeHairline

                BunTransactions(embedded: true)
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 96)
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $showSend) {
            BunSendFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showTransfer) {
            BunTransferFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showDeposit) {
            BunDepositFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showRequest) {
            BunRequestFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(item: $emptyListTitle) { title in
            BunEmptyListSheet(title: title)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
                .presentationDetents([.medium])
        }
        .sheet(isPresented: Binding(get: { listKind != nil }, set: { if !$0 { listKind = nil } })) {
            BunPaymentListSheet(kind: listKind ?? .inbox)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showLogClose) {
            BunLogCloseFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showCalendar) {
            BunScheduleCalendarSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .task { await store.loadMove() }
        .refreshable {
            store.overduePayments = nil
            store.upcomingPayments = nil
            store.unconfirmedPayouts = nil
            await store.loadMove()
        }
    }

    private var actionChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 10) {
                BunActionChip(symbol: "paperplane.fill",
                              label: store.signedIn ? "Log close" : "Send",
                              filled: true) {
                    if store.signedIn { showLogClose = true } else { showSend = true }
                }
                BunActionChip(symbol: "arrow.left.and.right", label: "Transfer") {
                    showTransfer = true
                }
                BunActionChip(symbol: "plus", label: "Deposit") {
                    showDeposit = true
                }
                BunActionChip(symbol: "arrow.left.to.line", label: "Request") {
                    showRequest = true
                }
            }
            .padding(.horizontal, 22)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -22)
    }

    private var inboxSubtitle: String {
        guard let overdue = store.overduePayments else { return "…" }
        return "\(overdue.count) overdue item\(overdue.count == 1 ? "" : "s")"
    }

    private var approvalsSubtitle: String {
        guard let payouts = store.unconfirmedPayouts else { return "…" }
        return "\(payouts.count) payout\(payouts.count == 1 ? "" : "s")"
    }

    private var scheduledSubtitle: String {
        guard let upcoming = store.upcomingPayments else { return "…" }
        return "\(upcoming.count) payment\(upcoming.count == 1 ? "" : "s")"
    }

    /// The lists read seeded data signed out, so they open in both modes.
    /// Scheduled opens the money calendar (web-portal parity).
    private func open(_ kind: BunPaymentListSheet.Kind) {
        if kind == .scheduled {
            showCalendar = true
        } else {
            listKind = kind
        }
    }

    private var edgeHairline: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1)
            .padding(.horizontal, -22)
    }

    /// The closest money: overdue first, then the next scheduled.
    private var upNextSection: some View {
        let items = Array(((store.overduePayments ?? []) + (store.upcomingPayments ?? [])).prefix(3))
        return Group {
            if !items.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Up next")
                        .font(bunFont(26))
                        .foregroundStyle(BunTheme.ink)
                    VStack(spacing: 0) {
                        ForEach(items) { item in
                            HStack(spacing: 14) {
                                BunAvatar(text: String(item.student.prefix(1)), size: 44,
                                          fill: BunStore.fill(for: item.student))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.student).font(bunFont(19)).foregroundStyle(BunTheme.ink).lineLimit(1)
                                    Text(item.due).font(bunFont(15))
                                        .foregroundStyle(item.overdue ? BunTheme.pink : BunTheme.secondary)
                                }
                                Spacer()
                                BunMoney(amount: item.amount, size: 17)
                                Button {
                                    Task { try? await store.markPaid(item) }
                                } label: {
                                    Text("Came in")
                                        .font(bunFont(15, .medium)).foregroundStyle(.white)
                                        .padding(.horizontal, 14).frame(height: 38)
                                        .background(BunTheme.indigo, in: Capsule())
                                }
                                .buttonStyle(BunPressStyle())
                            }
                            .frame(minHeight: 66)
                        }
                    }
                }
            }
        }
    }

    private var paymentsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Payments")
                .font(bunFont(26))
                .foregroundStyle(BunTheme.ink)
            VStack(spacing: 6) {
                BunIconRow(symbol: "envelope", title: "Inbox", subtitle: inboxSubtitle) { open(.inbox) }
                BunIconRow(symbol: "checklist", title: "Needs approval", subtitle: approvalsSubtitle) { open(.approvals) }
                BunIconRow(symbol: "calendar", title: "Scheduled", subtitle: scheduledSubtitle) { open(.scheduled) }
            }
        }
    }

}


extension String: @retroactive Identifiable {
    public var id: String { self }
}

/// Honest empty state for the payments lists (no dead taps).
private struct BunEmptyListSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Spacer()
                BunChipButton(symbol: "xmark") { dismiss() }
            }
            BunTitle(text: title)
            Text("Nothing here right now. Items land in this list as they come in.")
                .font(bunFont(19)).foregroundStyle(BunTheme.secondary)
            Spacer()
        }
        .padding(.horizontal, 22)
        .padding(.top, 14)
    }
}
