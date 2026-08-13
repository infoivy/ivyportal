import SwiftUI
import Charts

// MARK: - Set tracker (setter_daily_logs)

struct SetTrackerView: View {
    @State private var logs: [SetterDailyLog]?
    @State private var loading = false
    @State private var loadError: String?
    @State private var days = 14

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if signedIn {
                liveContent
            } else {
                StatusCard(symbol: "chart.xyaxis.line", title: "Set tracker", message: "Sign in to load the real set tracker: dials, inbounds, outbounds, replies, follow-ups, calls proposed, calendly sent, bookings, shows, closes, and cash.")
            }
        }
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        guard signedIn, logs == nil else { return }
        loading = true
        defer { loading = false }
        do {
            logs = try await PortalAPI.shared.setterDailyLogs(days: days)
            loadError = nil
        } catch {
            loadError = "Could not load the set tracker."
        }
    }

    @ViewBuilder private var liveContent: some View {
        if let logs {
            if logs.isEmpty {
                StatusCard(symbol: "chart.xyaxis.line", title: "No logs", message: "No setter daily logs in this window yet.")
            } else {
                let totals = TrackerTotals(logs: logs)
                HStack(spacing: 12) {
                    PerformanceStatCard(title: "Calls booked", value: "\(totals.booked)", context: "inbound + outbound", color: .blue) { }
                    PerformanceStatCard(title: "Sets closed", value: "\(totals.closed)", context: "won", color: ivyGreen) { }
                }
                HStack(spacing: 12) {
                    PerformanceStatCard(title: "Outbounds", value: "\(totals.outbounds)", context: "sent", color: .purple) { }
                    PerformanceStatCard(title: "Replies", value: "\(totals.replies)", context: "inbound + outbound", color: .orange) { }
                }
                sectionHeader("Daily log", detail: "\(logs.count) days")
                SurfaceCard {
                    VStack(spacing: 0) {
                        HStack(spacing: 8) {
                            Text("Date").frame(maxWidth: .infinity, alignment: .leading)
                            Text("Booked").frame(width: 56, alignment: .trailing)
                            Text("Shows").frame(width: 50, alignment: .trailing)
                            Text("Closes").frame(width: 50, alignment: .trailing)
                            Text("Cash").frame(width: 60, alignment: .trailing)
                        }.font(.caption2.bold()).foregroundStyle(.secondary).frame(minHeight: 34)
                        ForEach(Array(logs.enumerated()), id: \.element.id) { index, log in
                            HStack(spacing: 8) {
                                Text(log.logDate.prefix(10)).frame(maxWidth: .infinity, alignment: .leading)
                                Text("\(log.callsBookedInbound + log.callsBookedOutbound)").monospacedDigit().frame(width: 56, alignment: .trailing)
                                Text("\(log.callsShowed)").monospacedDigit().frame(width: 50, alignment: .trailing)
                                Text("\(log.setsClosed)").monospacedDigit().frame(width: 50, alignment: .trailing)
                                Text(log.cashCollected.formatted(.currency(code: "USD").precision(.fractionLength(0)))).monospacedDigit().frame(width: 60, alignment: .trailing)
                            }.font(.subheadline).frame(minHeight: 42)
                            if index < logs.count - 1 { Divider().overlay(Color.white.opacity(0.08)) }
                        }
                    }
                }
                sectionHeader("Booked per day", detail: "Graph")
                SurfaceCard {
                    Chart(logs.sorted { $0.logDate < $1.logDate }) { log in
                        BarMark(x: .value("Date", String(log.logDate.suffix(5))), y: .value("Booked", log.callsBookedInbound + log.callsBookedOutbound))
                            .foregroundStyle(Color.blue.gradient).cornerRadius(5)
                    }
                    .frame(height: 170)
                }
                Text("Source: real setter_daily_logs via your portal session").font(.caption).foregroundStyle(.tertiary)
            }
        } else if loading {
            SkeletonCards(count: 4, height: 96)
        } else {
            StatusCard(symbol: "exclamationmark.triangle", title: "Set tracker unavailable", message: loadError ?? "Sign in to load the set tracker.", retry: { logs = nil; Task { await loadIfNeeded() } })
        }
    }

    private func sectionHeader(_ title: String, detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.title3.bold())
            Spacer()
            Text(detail).font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct TrackerTotals {
    var booked = 0, closed = 0, outbounds = 0, replies = 0
    init(logs: [SetterDailyLog]) {
        for log in logs {
            booked += log.callsBookedInbound + log.callsBookedOutbound
            closed += log.setsClosed
            outbounds += log.outboundsSent
            replies += log.ibReplies + log.obReplies
        }
    }
}

// MARK: - EOD submission

struct MyEODView: View {
    @State private var history: [SetterDailyLog]?
    @State private var loading = false
    @State private var loadError: String?

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if signedIn {
                liveContent
            } else {
                StatusCard(symbol: "square.and.pencil", title: "My EOD", message: "Sign in to submit and review your end-of-day report: dials, DMs, calls booked, shows, closes, and notes.")
            }
        }
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        guard signedIn, history == nil else { return }
        loading = true
        defer { loading = false }
        do {
            history = try await PortalAPI.shared.setterDailyLogs(days: 7)
            loadError = nil
        } catch {
            loadError = "Could not load your EOD history."
        }
    }

    @ViewBuilder private var liveContent: some View {
        if let history {
            VStack(alignment: .leading, spacing: 16) {
                Text("Submitting writes to the portal's EOD table via the server; the iOS submit form is next. Your recent reports:").font(.subheadline).foregroundStyle(.secondary)
                if history.isEmpty {
                    StatusCard(symbol: "doc.text", title: "No recent EODs", message: "You have no end-of-day reports in the last 7 days.")
                } else {
                    SurfaceCard {
                        VStack(spacing: 0) {
                            ForEach(Array(history.enumerated()), id: \.element.id) { index, log in
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(String(log.logDate.prefix(10))).font(.headline)
                                        Text("\(log.callsBookedInbound + log.callsBookedOutbound) booked · \(log.setsClosed) closed").font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    StatusPill(title: log.callsShowed > 0 ? "Shows \(log.callsShowed)" : "No shows", color: log.callsShowed > 0 ? ivyGreen : .secondary)
                                }.frame(minHeight: 56).contentShape(Rectangle())
                                if index < history.count - 1 { Divider().overlay(Color.white.opacity(0.08)) }
                            }
                        }
                    }
                }
                Text("Source: real setter_daily_logs via your portal session").font(.caption).foregroundStyle(.tertiary)
            }
        } else if loading {
            SkeletonCards(count: 3, height: 96)
        } else {
            StatusCard(symbol: "exclamationmark.triangle", title: "EOD unavailable", message: loadError ?? "Sign in to load your EODs.", retry: { history = nil; Task { await loadIfNeeded() } })
        }
    }
}

// MARK: - Expenses

struct ExpensesView: View {
    @State private var expenses: [BusinessExpense]?
    @State private var loading = false
    @State private var loadError: String?

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if signedIn {
                liveContent
            } else {
                StatusCard(symbol: "creditcard", title: "Expenses", message: "Sign in to load business expenses (founder-only).")
            }
        }
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        guard signedIn, expenses == nil else { return }
        loading = true
        defer { loading = false }
        do {
            expenses = try await PortalAPI.shared.businessExpenses()
            loadError = nil
        } catch {
            loadError = "Could not load expenses."
        }
    }

    @ViewBuilder private var liveContent: some View {
        if let expenses {
            let total = expenses.reduce(0) { $0 + $1.amount }
            HStack(spacing: 12) {
                PerformanceStatCard(title: "Total expenses", value: total.formatted(.currency(code: "USD").precision(.fractionLength(0))), context: "\(expenses.count) items", color: .orange) { }
                PerformanceStatCard(title: "Recurring", value: "\(expenses.filter(\.recurring).count)", context: "monthly", color: .blue) { }
            }
            if expenses.isEmpty {
                StatusCard(symbol: "checkmark.circle", title: "No expenses", message: "No business expenses on record.")
            } else {
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(expenses.enumerated()), id: \.element.id) { index, expense in
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(expense.name).font(.headline)
                                    Text(expense.recurring ? "Recurring · day \(expense.dueDay ?? 1)" : (expense.oneOffDate ?? "One-off")).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(expense.amount.formatted(.currency(code: "USD").precision(.fractionLength(0)))).font(.headline).monospacedDigit()
                            }.frame(minHeight: 58).contentShape(Rectangle())
                            if index < expenses.count - 1 { Divider().overlay(Color.white.opacity(0.08)) }
                        }
                    }
                }
                Text("Source: real business_expenses via your portal session").font(.caption).foregroundStyle(.tertiary)
            }
        } else if loading {
            SkeletonCards(count: 3, height: 96)
        } else {
            StatusCard(symbol: "exclamationmark.triangle", title: "Expenses unavailable", message: loadError ?? "Sign in to load expenses.", retry: { expenses = nil; Task { await loadIfNeeded() } })
        }
    }
}

// MARK: - Payment calendar

struct PaymentCalendarView: View {
    @State private var summary: MoneySummary?
    @State private var loading = false
    @State private var loadError: String?

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if signedIn {
                liveContent
            } else {
                StatusCard(symbol: "calendar", title: "Payment calendar", message: "Sign in to load the cash-in calendar: collected, expected, and money out per day.")
            }
        }
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        guard signedIn, summary == nil else { return }
        loading = true
        defer { loading = false }
        do {
            summary = try await PortalAPI.shared.moneySummary()
            loadError = nil
        } catch {
            loadError = "Could not load the payment calendar."
        }
    }

    @ViewBuilder private var liveContent: some View {
        if let summary {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    PerformanceStatCard(title: "Collected", value: summary.collected.formatted(.currency(code: "USD").precision(.fractionLength(0))), context: "this period", color: ivyGreen) { }
                    PerformanceStatCard(title: "Expected", value: summary.upcoming.formatted(.currency(code: "USD").precision(.fractionLength(0))), context: "scheduled", color: .blue) { }
                }
                PerformanceStatCard(title: "Overdue", value: summary.overdue.formatted(.currency(code: "USD").precision(.fractionLength(0))), context: "late or missed", color: summary.overdue > 0 ? .red : ivyGreen) { }
                Text("The day-by-day cash-in calendar (collected / expected / money out per date) builds on this summary. Source: real installment_payments via your portal session.").font(.caption).foregroundStyle(.tertiary)
            }
        } else if loading {
            SkeletonCards(count: 3, height: 96)
        } else {
            StatusCard(symbol: "exclamationmark.triangle", title: "Calendar unavailable", message: loadError ?? "Sign in to load the payment calendar.", retry: { summary = nil; Task { await loadIfNeeded() } })
        }
    }
}

// MARK: - Student output graph

struct StudentOutputView: View {
    @State private var points: [StudentOutputPoint]?
    @State private var loading = false
    @State private var loadError: String?

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if signedIn {
                liveContent
            } else {
                StatusCard(symbol: "chart.bar.fill", title: "Student output", message: "Sign in to load student output graphs: applications, outreach, replies, and interviews per day.")
            }
        }
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        guard signedIn, points == nil else { return }
        loading = true
        defer { loading = false }
        do {
            points = try await PortalAPI.shared.studentOutput(days: 14)
            loadError = nil
        } catch {
            loadError = "Could not load student output."
        }
    }

    @ViewBuilder private var liveContent: some View {
        if let points {
            if points.isEmpty {
                StatusCard(symbol: "chart.bar", title: "No output", message: "No student EOD output in this window yet.")
            } else {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Applications per day").font(.headline)
                        Chart(points) { point in
                            BarMark(x: .value("Date", String(point.date.suffix(5))), y: .value("Applications", point.applications))
                                .foregroundStyle(Color.blue.gradient).cornerRadius(5)
                        }.frame(height: 170)
                    }
                }
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Outreach per day").font(.headline)
                        Chart(points) { point in
                            BarMark(x: .value("Date", String(point.date.suffix(5))), y: .value("Outreach", point.outreach))
                                .foregroundStyle(Color.purple.gradient).cornerRadius(5)
                        }.frame(height: 170)
                    }
                }
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Interviews per day").font(.headline)
                        Chart(points) { point in
                            BarMark(x: .value("Date", String(point.date.suffix(5))), y: .value("Interviews", point.interviews))
                                .foregroundStyle(ivyGreen.gradient).cornerRadius(5)
                        }.frame(height: 170)
                    }
                }
                Text("Source: real student_eods via your portal session").font(.caption).foregroundStyle(.tertiary)
            }
        } else if loading {
            SkeletonCards(count: 3, height: 170)
        } else {
            StatusCard(symbol: "exclamationmark.triangle", title: "Output unavailable", message: loadError ?? "Sign in to load student output.", retry: { points = nil; Task { await loadIfNeeded() } })
        }
    }
}
