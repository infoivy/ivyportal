import SwiftUI
import UIKit

/// Money page (founder 2026-08-17): Move money and Transactions merged.
/// Action chips, what's due next, the payments lists, and the full feed.
struct BunMoneyPage: View {
    @State private var store = BunStore.shared
    @State private var listKind: BunPaymentListSheet.Kind?
    @State private var showCalendar = false
    @State private var emptyListTitle: String?
    @State private var showLogClose = false
    @State private var showMoneyIn = false
    @State private var showPlans = false
    @State private var showPayouts = false
    @State private var showLinks = false
    /// Founder 2026-08-18: accounts and cards are their own tab inside Money.
    /// `-bunMoneySection accounts|finance` opens straight there for screenshots.
    @State private var section: Int = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-bunMoneySection"), args.indices.contains(i + 1) else { return 0 }
        return ["money": 0, "accounts": 1, "finance": 2][args[i + 1]] ?? 0
    }()

    /// Finance is leadership-only, so the tab itself only exists for them.
    private var sections: [String] {
        store.canSeeFinance ? ["Money", "Accounts", "Finance"] : ["Money", "Accounts"]
    }
    /// Rows showing the "collected" confirmation before they animate out.
    @State private var settled: Set<UUID> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack {
                    BunTitle(text: "Money")
                    Spacer()
                    // Logging a close is the one money WRITE the business
                    // depends on; it lost its home when the bank-style chips
                    // went, so it lives on the title row now.
                    BunPillChip(symbol: "plus", label: "Log close") { showLogClose = true }
                }

                BunSegment(options: sections, selection: $section)

                if section == 2 {
                    BunFinanceView()
                } else if section == 0 {
                    upNextSection

                    paymentsSection

                    edgeHairline

                    BunTransactions(embedded: true)
                } else {
                    // Accounts and cards together (founder 2026-08-18), one
                    // tab away from the payments rather than below them.
                    BunBanking(embedded: true)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 96)
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $showLogClose) {
            BunLogCloseFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showMoneyIn) {
            BunMoneyInSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showPlans) {
            BunPaymentPlansSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showLinks) {
            BunPaymentLinksSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showPayouts) {
            BunPayoutLedgerSheet()
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
        .sheet(isPresented: $showCalendar) {
            BunScheduleCalendarSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .task {
            await store.loadMove()
            await store.loadMoneyDepth()
            await store.loadPaymentLinks()
        }
        .refreshable {
            store.overduePayments = nil
            store.upcomingPayments = nil
            store.unconfirmedPayouts = nil
            await store.loadMove()
        }
    }

    private var inboxSubtitle: String {
        guard let overdue = store.overduePayments else { return "…" }
        return "\(overdue.count) overdue item\(overdue.count == 1 ? "" : "s")"
    }

    private var approvalsSubtitle: String {
        guard let payouts = store.unconfirmedPayouts else { return "…" }
        return payouts.isEmpty ? "all confirmed" : "\(payouts.count) to confirm"
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
                        .font(BunType.section)
                        .foregroundStyle(BunTheme.ink)
                    VStack(spacing: 0) {
                        ForEach(items) { item in
                            upNextRow(item)
                                .transition(.asymmetric(
                                    insertion: .opacity,
                                    removal: .opacity.combined(with: .scale(scale: 0.94, anchor: .leading))))
                        }
                    }
                    // Keyed on the ids so a settled row slides out instead of
                    // blinking away the instant the store drops it.
                    .animation(.smooth(duration: 0.42), value: items.map(\.id))
                }
            }
        }
    }

    /// Collecting money should FEEL collected: the button flips to a green
    /// check, the amount turns green, a success haptic fires, and only then
    /// does the row leave. Previously the row vanished mid-tap with no
    /// acknowledgement, which read as a glitch (founder 2026-08-18).
    private func upNextRow(_ item: BunStore.BunPlanItem) -> some View {
        let done = settled.contains(item.id)
        return HStack(spacing: 14) {
            BunAvatar(text: String(item.student.prefix(1)), size: 44,
                      fill: BunStore.fill(for: item.student))
            VStack(alignment: .leading, spacing: 3) {
                Text(item.student).font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                Text(done ? "Collected" : item.due)
                    .font(BunType.caption)
                    .foregroundStyle(done ? BunTheme.green
                                     : (item.overdue ? BunTheme.pink : BunTheme.secondary))
            }
            Spacer()
            BunMoney(amount: item.amount, size: BunType.Money.chip,
                     color: done ? BunTheme.green : BunTheme.ink)
            Button {
                collect(item)
            } label: {
                Group {
                    if done {
                        Image(systemName: "checkmark")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(.white)
                    } else {
                        Text("Came in")
                            .font(bunFont(15, .medium)).foregroundStyle(.white)
                    }
                }
                .padding(.horizontal, done ? 0 : 14)
                .frame(width: done ? 38 : nil, height: 38)
                .background(done ? BunTheme.green : BunTheme.indigo, in: Capsule())
            }
            .buttonStyle(BunPressStyle())
            .disabled(done)
        }
        .frame(minHeight: 66)
        .animation(.spring(response: 0.32, dampingFraction: 0.72), value: done)
    }

    private func collect(_ item: BunStore.BunPlanItem) {
        guard !settled.contains(item.id) else { return }
        settled.insert(item.id)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        Task {
            // Hold the confirmed state long enough to read, then write and let
            // the row animate out.
            try? await Task.sleep(for: .seconds(0.75))
            try? await store.markPaid(item)
            settled.remove(item.id)
        }
    }

    private var dealsSubtitle: String {
        guard store.deals != nil else { return "…" }
        let count = store.deals(days: 30).count
        return "\(count) close\(count == 1 ? "" : "s") in 30 days"
    }

    private var linksSubtitle: String {
        guard let links = store.paymentLinks else { return "…" }
        return links.isEmpty ? "none set up yet" : "\(links.count) ready to send"
    }

    private var plansSubtitle: String {
        guard let plans = store.plans else { return "…" }
        return "\(plans.count) plan\(plans.count == 1 ? "" : "s") running"
    }

    /// Rows sat on 6pt of air and read as one cramped block (founder
    /// 2026-08-18). Each row now owns its own height and the gaps are real.
    private var paymentsSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Payments")
                .font(BunType.section)
                .foregroundStyle(BunTheme.ink)
            VStack(spacing: 14) {
                BunIconRow(symbol: "envelope", title: "Inbox", subtitle: inboxSubtitle) { open(.inbox) }
                    .frame(minHeight: 60)
                BunIconRow(symbol: "wallet.bifold", title: "Payouts", subtitle: approvalsSubtitle) { showPayouts = true }
                    .frame(minHeight: 60)
                BunIconRow(symbol: "calendar", title: "Scheduled", subtitle: scheduledSubtitle) { open(.scheduled) }
                    .frame(minHeight: 60)
                BunIconRow(symbol: "arrow.down.left", title: "Money in", subtitle: dealsSubtitle) { showMoneyIn = true }
                    .frame(minHeight: 60)
                BunIconRow(symbol: "chart.bar.doc.horizontal", title: "Payment plans", subtitle: plansSubtitle) { showPlans = true }
                    .frame(minHeight: 60)
                BunIconRow(symbol: "link", title: "Payment links", subtitle: linksSubtitle) { showLinks = true }
                    .frame(minHeight: 60)
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
