import SwiftUI
import Charts

struct PaymentsView: View {
    @State private var tab: PaymentsTab = .overview
    @State private var period = "This month"
    @State private var search = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ScreenHeader(title: "Payments", subtitle: "")
                HStack {
                    Text("Track every payment and where revenue goes")
                        .font(.subheadline).foregroundStyle(.secondary)
                        .frame(maxWidth: 185, alignment: .leading)
                    Spacer()
                    Menu {
                        Picker("Period", selection: $period) {
                            Text("This month").tag("This month")
                            Text("30 days").tag("30 days")
                            Text("90 days").tag("90 days")
                        }
                    } label: { FilterChip(title: period, symbol: "calendar") }
                }
                SegmentedPicker(selection: $tab) { $0.title }
                switch tab {
                case .overview: PaymentsOverview()
                case .clients: PaymentClients()
                case .costs: PaymentCosts()
                }
                Text("Synthetic Debug data · Live finance source not connected in this native shell")
                    .font(.caption).foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .searchable(text: $search, prompt: tab.searchPrompt)
    }
}

private struct PaymentsOverview: View {
    @State private var selected: PaymentDetail?

    var body: some View {
        VStack(spacing: 22) {
            Button { selected = .gross } label: {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Gross volume").font(.title3).foregroundStyle(ivyMuted)
                        Text("$4,500.00").font(.system(size: 42, weight: .semibold, design: .rounded)).monospacedDigit()
                        Text("3 payments").foregroundStyle(.secondary)
                        Chart(PaymentPoint.points) { point in
                            LineMark(x: .value("Date", point.label), y: .value("Revenue", point.value))
                                .foregroundStyle(.blue).interpolationMethod(.linear)
                            AreaMark(x: .value("Date", point.label), y: .value("Revenue", point.value))
                                .foregroundStyle(.linearGradient(colors: [.blue.opacity(0.3), .clear], startPoint: .top, endPoint: .bottom))
                        }
                        .chartYAxis(.hidden)
                        .frame(height: 180)
                    }
                }
            }.buttonStyle(PressableButtonStyle())

            HStack(spacing: 12) {
                PaymentMetric(title: "Net revenue", value: "$4.3K", symbol: "dollarsign.circle.fill") { selected = .net }
                PaymentMetric(title: "Total costs", value: "$0", symbol: "banknote.fill") { selected = .costs }
            }
            HStack(spacing: 12) {
                PaymentMetric(title: "You keep", value: "$4.3K", symbol: "tray.fill") { selected = .net }
                PaymentMetric(title: "Leads matched", value: "0", detail: "3 unmatched", symbol: "person.2.fill") { selected = .matching }
            }
            RevenueBreakdownCard()
            ProviderCard()
        }
        .sheet(item: $selected) { PaymentDetailSheet(detail: $0) }
    }
}

private struct PaymentClients: View {
    @State private var match = "Any match"
    @State private var sort = "Net desc"
    @State private var detail: ClientPayment?

    var body: some View {
        VStack(spacing: 22) {
            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 12) {
                PaymentMetric(title: "Clients", value: "3", symbol: "person.2.fill") {}
                PaymentMetric(title: "Matched", value: "0", symbol: "checkmark.circle.fill") {}
                PaymentMetric(title: "Unmatched", value: "3", symbol: "exclamationmark.circle.fill") {}
                PaymentMetric(title: "Avg value", value: "$1,500", symbol: "dollarsign.circle.fill") {}
            }
            HStack(spacing: 10) {
                Menu { Picker("Match", selection: $match) { Text("Any match").tag("Any match"); Text("Unmatched").tag("Unmatched") } } label: { FilterChip(title: match, symbol: "person.badge.questionmark") }
                Menu { Picker("Sort", selection: $sort) { Text("Net desc").tag("Net desc"); Text("Newest").tag("Newest") } } label: { FilterChip(title: sort, symbol: "arrow.up.arrow.down") }
            }
            SurfaceCard {
                VStack(alignment: .leading, spacing: 0) {
                    HStack { Text("Clients").font(.title2.bold()); Spacer(); Text("3").foregroundStyle(.secondary) }.padding(.bottom, 14)
                    ForEach(Array(ClientPayment.samples.enumerated()), id: \.element.id) { index, client in
                        Button { detail = client } label: { ClientPaymentRow(client: client) }
                            .buttonStyle(PressableButtonStyle())
                        if index < ClientPayment.samples.count - 1 { Divider().overlay(Color.white.opacity(0.08)) }
                    }
                }
            }
        }
        .sheet(item: $detail) { ClientPaymentSheet(client: $0) }
    }
}

private struct PaymentCosts: View {
    @State private var match = "Any match"
    @State private var status = "Any status"
    @State private var detail: CostRow?

    var body: some View {
        VStack(spacing: 22) {
            ProviderCard()
            CommissionCard(title: "Setters")
            CommissionCard(title: "Closers")
            HStack(spacing: 10) {
                Menu { Picker("Match", selection: $match) { Text("Any match").tag("Any match"); Text("Unmatched").tag("Unmatched") } } label: { FilterChip(title: match, symbol: "person.badge.questionmark") }
                Menu { Picker("Status", selection: $status) { Text("Any status").tag("Any status"); Text("Succeeded").tag("Succeeded") } } label: { FilterChip(title: status, symbol: "checklist") }
            }
            SurfaceCard {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Cost rows").font(.title2.bold()).padding(.bottom, 12)
                    ForEach(Array(CostRow.samples.enumerated()), id: \.element.id) { index, row in
                        Button { detail = row } label: {
                            HStack(spacing: 12) {
                                AvatarBadge(name: row.name, color: .red)
                                VStack(alignment: .leading, spacing: 4) { Text(row.name).font(.headline); Text(row.program).font(.caption).foregroundStyle(.secondary) }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 5) { Text(row.amount).font(.headline).monospacedDigit(); StatusPill(title: "Unmatched", color: .red) }
                                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                            }.frame(minHeight: 74).contentShape(Rectangle())
                        }.buttonStyle(PressableButtonStyle())
                        if index < CostRow.samples.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                    }
                }
            }
        }
        .sheet(item: $detail) { CostDetailSheet(row: $0) }
    }
}

private struct PaymentMetric: View {
    let title, value: String
    var detail: String = ""
    let symbol: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack { Text(title).font(.subheadline).foregroundStyle(ivyMuted); Spacer(); Image(systemName: symbol).foregroundStyle(ivyMuted).frame(width: 28, height: 28).background(Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 8)) }
                    Text(value).font(.system(.title, design: .rounded, weight: .semibold)).monospacedDigit()
                    if !detail.isEmpty { Text(detail).font(.caption).foregroundStyle(.secondary) }
                }.frame(minHeight: 104, alignment: .top)
            }
        }.buttonStyle(PressableButtonStyle())
    }
}

private struct RevenueBreakdownCard: View {
    private let rows = [("You keep", "$4.3K", "100%", Color.green), ("Processing fees", "$0", "0%", Color.orange), ("Commissions", "$0", "0%", Color.blue), ("Refunds", "$0", "0%", Color.red)]
    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) { VStack(alignment: .leading) { Text("Revenue breakdown").font(.title2.bold()); Text("Gross less fees, commissions, refunds").font(.caption).foregroundStyle(.secondary) }; Spacer(); VStack(alignment: .trailing) { Text("You keep").foregroundStyle(.secondary); Text("$4,300.00").font(.title2.bold()).monospacedDigit() } }
                Capsule().fill(ivyGreen).frame(height: 12)
                ForEach(rows, id: \.0) { row in HStack { Circle().fill(row.3).frame(width: 10, height: 10); Text(row.0); Spacer(); Text(row.1).monospacedDigit(); StatusPill(title: row.2, color: row.3) } }
            }
        }
    }
}

private struct ProviderCard: View {
    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 18) {
                Text("Processing fees by provider").font(.title2.bold())
                HStack(spacing: 14) {
                    RoundedRectangle(cornerRadius: 12).fill(Color.orange.opacity(0.22)).frame(width: 48, height: 48).overlay(Image(systemName: "w.circle.fill").foregroundStyle(.orange).font(.title2))
                    VStack(alignment: .leading, spacing: 4) { Text("Whop").font(.headline); Text("3 transactions · $4.5K volume").font(.caption).foregroundStyle(.secondary) }
                    Spacer()
                    VStack(alignment: .trailing) { Text("Total fees").foregroundStyle(.secondary); Text("$0.00").font(.title2.bold()).monospacedDigit() }
                }
            }
        }
    }
}

private struct CommissionCard: View {
    let title: String
    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 18) {
                HStack { Text(title).font(.title2.bold()); Spacer(); VStack(alignment: .trailing) { Text("Commission").foregroundStyle(.secondary); Text("$0.00").font(.title2.bold()).monospacedDigit() } }
                HStack(spacing: 10) { MiniStat(label: "Rate", value: "–"); MiniStat(label: "Deals", value: "0"); MiniStat(label: "Revenue", value: "$0") }
                Divider().overlay(Color.white.opacity(0.08))
                Text("No attributed deals in this period.").foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 52)
            }
        }
    }
}

private struct MiniStat: View {
    let label, value: String
    var body: some View { VStack(alignment: .leading, spacing: 4) { Text(label).font(.caption).foregroundStyle(.secondary); Text(value).font(.headline).monospacedDigit() }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(ivyRaised, in: RoundedRectangle(cornerRadius: 12)) }
}

private struct PaymentPoint: Identifiable { let id = UUID(); let label: String; let value: Int; static let points = [PaymentPoint(label: "Aug 6", value: 2000), PaymentPoint(label: "Aug 7", value: 3500), PaymentPoint(label: "Aug 11", value: 4500)] }

private enum PaymentDetail: String, Identifiable { case gross, net, costs, matching; var id: String { rawValue } }

private struct PaymentDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let detail: PaymentDetail
    var body: some View { VStack(alignment: .leading, spacing: 22) { HStack { Text(detail.title).font(.title2.bold()); Spacer(); Button("Done") { dismiss() }.frame(minHeight: 48) }; Text(detail.message).foregroundStyle(.secondary); RevenueBreakdownCard(); Spacer() }.padding(24).presentationDetents([.large]).presentationDragIndicator(.visible).presentationBackground(ivySurface) }
}

private struct ClientPayment: Identifiable { let id = UUID(); let name, email, amount, recency: String; static let samples = [ClientPayment(name: "Hisham Khan", email: "hisham.khan.socials13@…", amount: "$2,000", recency: "1 payment · 1 day ago"), ClientPayment(name: "Adise", email: "adise.welcome@…", amount: "$1,500", recency: "1 payment · 4 days ago"), ClientPayment(name: "Samim", email: "samim@…", amount: "$1,000", recency: "1 payment · 6 days ago")] }

private struct ClientPaymentRow: View {
    let client: ClientPayment
    var body: some View { HStack(spacing: 12) { AvatarBadge(name: client.name, color: .red); VStack(alignment: .leading, spacing: 4) { HStack { Text(client.name).font(.headline).lineLimit(1); StatusPill(title: "Unmatched", color: .red) }; Text(client.email).font(.caption).foregroundStyle(.secondary) }; Spacer(); VStack(alignment: .trailing, spacing: 4) { Text(client.amount).font(.headline).monospacedDigit(); Text(client.recency).font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.trailing) }; Image(systemName: "chevron.right").foregroundStyle(.tertiary) }.frame(minHeight: 78).contentShape(Rectangle()) }
}

private struct ClientPaymentSheet: View {
    @Environment(\.dismiss) private var dismiss; let client: ClientPayment
    var body: some View { VStack(alignment: .leading, spacing: 22) { HStack { Text(client.name).font(.title2.bold()); Spacer(); Button("Done") { dismiss() } }; Text(client.email).foregroundStyle(.secondary); HStack { MiniStat(label: "Gross", value: client.amount); MiniStat(label: "Refunded", value: "$0.00") }; StatusPill(title: "Unmatched", color: .red); Button("Match client") {}.buttonStyle(.borderedProminent).tint(.white).foregroundStyle(.black).frame(minHeight: 48); Spacer() }.padding(24).presentationDetents([.medium]).presentationBackground(ivySurface) }
}

private struct CostRow: Identifiable { let id = UUID(); let name, program, amount: String; static let samples = [CostRow(name: "Hisham Khan", program: "ISA · 1-on-1 Pathway", amount: "$0.00"), CostRow(name: "Adise", program: "ISA · 1-on-1 Pathway", amount: "$0.00")] }
private struct CostDetailSheet: View { @Environment(\.dismiss) private var dismiss; let row: CostRow; var body: some View { VStack(alignment: .leading, spacing: 22) { HStack { Text(row.name).font(.title2.bold()); Spacer(); Button("Done") { dismiss() } }; Text(row.program).foregroundStyle(.secondary); HStack { MiniStat(label: "Revenue", value: "$2,000"); MiniStat(label: "Fees", value: row.amount) }; StatusPill(title: "Unmatched", color: .red); Button("Match attribution") {}.buttonStyle(.borderedProminent).tint(.white).foregroundStyle(.black).frame(minHeight: 48); Spacer() }.padding(24).presentationDetents([.medium]).presentationBackground(ivySurface) } }

private extension PaymentsTab {
    var title: String { switch self { case .overview: "Overview"; case .clients: "Clients"; case .costs: "Costs" } }
    var searchPrompt: String { switch self { case .overview: "Search payments"; case .clients: "Search clients"; case .costs: "Search costs" } }
}
private extension PaymentDetail {
    var title: String { switch self { case .gross: "Gross volume"; case .net: "Net revenue"; case .costs: "Total costs"; case .matching: "Lead matching" } }
    var message: String { switch self { case .gross: "Three verified payments total $4,500 gross."; case .net: "Net revenue after verified costs is $4,300."; case .costs: "No processing fees, commissions, or refunds are verified in this Debug fixture."; case .matching: "Three payment clients remain unmatched to Portal records." } }
}
