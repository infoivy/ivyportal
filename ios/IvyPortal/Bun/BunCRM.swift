import SwiftUI
import Charts

// CRM (founder 2026-08-18: "i need the crm data, just like what we had in
// ivyportal ios app and in the web portal, like the mochi app").
//
// Same two halves the web CRM page has: Mochi's Instagram funnel and money,
// and the Close pipeline. Both arrive through the `crm-summary` edge function,
// which holds the credentials so the phone never does.

struct BunCRMSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var period = 1

    private var mochi: CRMSummary.Mochi? { store.crm?.mochi }
    private var close: CRMSummary.Close? { store.crm?.close }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    BunTitle(text: "CRM")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                Text("Leads are worked in Mochi and Close. These are the numbers they report.")
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                BunSegment(options: PortalAPI.CRMPeriod.allCases.map(\.label), selection: $period)
                    .onChange(of: period) { _, index in
                        Task { await store.loadCRM(PortalAPI.CRMPeriod.allCases[index], force: true) }
                    }

                if let error = store.crmError {
                    Text(error).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }

                if store.crm == nil && store.crmError == nil {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 72)
                    }
                } else {
                    mochiBlock
                    edgeHairline
                    closeBlock
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadCRM(PortalAPI.CRMPeriod.allCases[period]) }
        .refreshable { await store.loadCRM(PortalAPI.CRMPeriod.allCases[period], force: true) }
    }

    // MARK: Mochi

    @ViewBuilder private var mochiBlock: some View {
        if let mochi, mochi.connected {
            VStack(alignment: .leading, spacing: 18) {
                Text("Instagram").font(BunType.section).foregroundStyle(BunTheme.ink)

                if let revenue = mochi.revenue, revenue.net != nil || revenue.gross != nil {
                    HStack(alignment: .top, spacing: 0) {
                        moneyStat("Collected", amount: revenue.net, tone: BunTheme.green)
                        moneyStat("Gross", amount: revenue.gross)
                        stat("Payments", value: revenue.count.map(String.init) ?? "–")
                    }
                }

                if let messages = mochi.messages {
                    HStack(alignment: .top, spacing: 0) {
                        stat("DMs out", value: "\(messages.outbound)")
                        stat("DMs in", value: "\(messages.inbound)")
                        stat("Active convos", value: "\(messages.activeConversations)")
                    }
                }

                if let totals = mochi.totals {
                    funnelBar(totals)
                }

                if let funnel = mochi.funnel, funnel.contains(where: { $0.newLeads > 0 || $0.booked > 0 }) {
                    leadChart(funnel)
                }

                if let sources = mochi.sources, !sources.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Where they came from").font(BunType.label).foregroundStyle(BunTheme.secondary)
                        VStack(spacing: 0) {
                            ForEach(sources.prefix(5)) { source in
                                HStack(spacing: 12) {
                                    Text(source.label).font(BunType.rowTitle)
                                        .foregroundStyle(BunTheme.ink).lineLimit(1)
                                    Spacer()
                                    Text("\(source.leads) leads · \(source.booked) booked")
                                        .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                        .lineLimit(1).minimumScaleFactor(0.8)
                                }
                                .frame(minHeight: 50)
                            }
                        }
                    }
                }

                if let members = mochi.members, !members.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("DMs by setter").font(BunType.label).foregroundStyle(BunTheme.secondary)
                        VStack(spacing: 0) {
                            ForEach(members.sorted { $0.outbound > $1.outbound }) { member in
                                HStack(spacing: 14) {
                                    BunAvatar(text: String(member.name.prefix(1)), size: 40,
                                              fill: BunStore.fill(for: member.name))
                                    Text(member.name).font(BunType.rowTitle)
                                        .foregroundStyle(BunTheme.ink).lineLimit(1)
                                    Spacer()
                                    Text("\(member.outbound)")
                                        .font(bunFont(17, .medium)).foregroundStyle(BunTheme.ink)
                                        .monospacedDigit()
                                }
                                .frame(minHeight: 58)
                            }
                        }
                    }
                }
            }
        } else if mochi != nil {
            VStack(alignment: .leading, spacing: 6) {
                Text("Instagram").font(BunType.section).foregroundStyle(BunTheme.ink)
                Text("Mochi is not connected. An admin connects it in Bun on the web.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// New leads → qualified → booked → won, as one bar with the drop-off
    /// visible rather than four numbers to compare by eye.
    private func funnelBar(_ totals: CRMSummary.Mochi.Totals) -> some View {
        let stages: [(String, Int, Color)] = [
            ("New", totals.newLeads, BunTheme.indigoLight),
            ("Qualified", totals.qualified, Color(red: 0.63, green: 0.53, blue: 0.97)),
            ("Booked", totals.booked, Color(red: 0.28, green: 0.75, blue: 0.70)),
            ("Won", totals.won, BunTheme.green),
        ]
        let peak = max(stages.map(\.1).max() ?? 1, 1)
        return VStack(alignment: .leading, spacing: 10) {
            Text("Funnel").font(BunType.label).foregroundStyle(BunTheme.secondary)
            ForEach(stages, id: \.0) { name, count, tone in
                HStack(spacing: 12) {
                    Text(name).font(BunType.caption).foregroundStyle(BunTheme.secondary)
                        .frame(width: 74, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(BunTheme.field).frame(height: 10)
                            Capsule().fill(tone)
                                .frame(width: max(6, geo.size.width * Double(count) / Double(peak)), height: 10)
                        }
                    }
                    .frame(height: 10)
                    Text("\(count)").font(bunFont(16, .medium))
                        .foregroundStyle(BunTheme.ink).monospacedDigit()
                        .frame(width: 44, alignment: .trailing)
                }
                .frame(height: 32)
            }
        }
    }

    private func leadChart(_ funnel: [CRMSummary.Mochi.Day]) -> some View {
        let peak = max(funnel.map(\.newLeads).max() ?? 1, 1)
        return VStack(alignment: .leading, spacing: 10) {
            Text("New leads by day").font(BunType.label).foregroundStyle(BunTheme.secondary)
            Chart {
                ForEach(funnel) { day in
                    BarMark(x: .value("Day", day.day), y: .value("Leads", day.newLeads),
                            width: .fixed(funnel.count > 14 ? 6 : 14))
                        .cornerRadius(4)
                        .foregroundStyle(BunTheme.indigo.opacity(0.35 + 0.65 * Double(day.newLeads) / Double(peak)))
                }
            }
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { _ in
                    AxisValueLabel().font(bunFont(12)).foregroundStyle(BunTheme.tertiary)
                    AxisGridLine().foregroundStyle(BunTheme.hairline)
                }
            }
            .frame(height: 130)
        }
    }

    // MARK: Close

    @ViewBuilder private var closeBlock: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Pipeline").font(BunType.section).foregroundStyle(BunTheme.ink)
            if let close, close.configured {
                if let error = close.error {
                    Text(error).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                } else {
                    HStack(alignment: .top, spacing: 0) {
                        stat("Leads", value: close.leads.map(String.init) ?? "–")
                        stat("Active", value: close.active.map(String.init) ?? "–")
                        stat("Won", value: close.won.map(String.init) ?? "–", tone: BunTheme.green)
                    }
                    HStack(alignment: .top, spacing: 0) {
                        moneyStat("In play", amount: close.pipeline)
                        stat("Close rate", value: close.closeRate.map { "\(Int($0.rounded()))%" } ?? "–")
                    }
                    if let stages = close.stages, !stages.isEmpty {
                        VStack(spacing: 0) {
                            ForEach(stages) { stage in
                                HStack(spacing: 12) {
                                    Text(stage.name).font(BunType.rowTitle)
                                        .foregroundStyle(BunTheme.ink).lineLimit(1)
                                    Spacer()
                                    Text("\(stage.count)").font(BunType.caption)
                                        .foregroundStyle(BunTheme.secondary)
                                    if stage.value > 0 {
                                        BunMoney(amount: stage.value, size: 16)
                                    }
                                }
                                .frame(minHeight: 52)
                            }
                        }
                    }
                }
            } else {
                Text("Close is not connected. An admin adds the API key in Bun on the web.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Shared

    private func stat(_ label: String, value: String, tone: Color = BunTheme.ink) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
                .lineLimit(1).minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(value).font(bunFont(24, .medium)).foregroundStyle(tone).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func moneyStat(_ label: String, amount: Double?, tone: Color = BunTheme.ink) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
                .lineLimit(1).minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let amount {
                BunMoney(amount: amount, size: 24, weight: .medium, color: tone)
            } else {
                Text("–").font(bunFont(24, .medium)).foregroundStyle(BunTheme.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var edgeHairline: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)
    }
}
