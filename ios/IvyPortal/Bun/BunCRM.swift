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
                if let health = mochi.health { healthBanner(health) }

                Text("Instagram").font(BunType.section).foregroundStyle(BunTheme.ink)

                // One hero, one context line, then a table. Twelve numbers in
                // a 3-wide grid read as noise (founder 2026-08-18: "so
                // messy") — rows scan, tiles do not.
                if let revenue = mochi.revenue, revenue.net != nil || revenue.gross != nil {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Collected").font(BunType.label).foregroundStyle(BunTheme.secondary)
                        BunMoney(amount: revenue.net ?? revenue.gross ?? 0,
                                 size: BunType.Money.hero, color: BunTheme.green)
                        Text(revenueCaption(revenue))
                            .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                }

                if let account = mochi.account {
                    Text(accountLine(account, messages: mochi.messages))
                        .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                        .lineLimit(1).minimumScaleFactor(0.75)
                }

                outreachTable(mochi)

                if let pipeline = mochi.pipeline {
                    pipelineBar(pipeline, conversion: mochi.conversion)
                }

                if let hours = mochi.hours, hours.contains(where: { $0.count > 0 }) {
                    activeHours(hours, peak: mochi.peakHourUTC)
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

                // Per setter: what they sent AND what came back, because
                // volume without replies is not performance.
                if let members = mochi.replies?.members, !members.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("By setter").font(BunType.label).foregroundStyle(BunTheme.secondary)
                        VStack(spacing: 0) {
                            ForEach(members.sorted { $0.messages > $1.messages }) { member in
                                HStack(spacing: 14) {
                                    BunAvatar(text: String(member.name.prefix(1)), size: 40,
                                              fill: BunStore.fill(for: member.name))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(member.name).font(BunType.rowTitle)
                                            .foregroundStyle(BunTheme.ink).lineLimit(1)
                                        Text("\(member.messages) sent · \(member.replies) replied")
                                            .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                            .lineLimit(1).minimumScaleFactor(0.85)
                                    }
                                    Spacer()
                                    Text(member.rate.map { Self.percent($0) } ?? "–")
                                        .font(bunFont(17, .medium))
                                        .foregroundStyle((member.rate ?? 0) >= 0.5 ? BunTheme.green : BunTheme.ink)
                                        .monospacedDigit()
                                }
                                .frame(minHeight: 62)
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

    private func revenueCaption(_ revenue: CRMSummary.Mochi.Revenue) -> String {
        var bits: [String] = []
        if let gross = revenue.gross, gross > 0 { bits.append("\(ivyMoney(gross)) gross") }
        if let count = revenue.count, count > 0 { bits.append("\(count) payment\(count == 1 ? "" : "s")") }
        return bits.isEmpty ? "in this window" : bits.joined(separator: " · ")
    }

    private func accountLine(_ account: CRMSummary.Mochi.Account,
                             messages: CRMSummary.Mochi.Messages?) -> String {
        var bits: [String] = []
        if let total = account.totalLeads { bits.append("\(Self.count(total)) leads") }
        if let new = account.newLeads30 { bits.append("\(Self.count(new)) new in 30 days") }
        if let convos = messages?.activeConversations, convos > 0 {
            bits.append("\(convos) live conversations")
        }
        return bits.joined(separator: " · ")
    }

    /// Mercury's anatomy: label left, value right, hairline between. Reads as
    /// a table rather than a grid of boxes.
    private func outreachTable(_ mochi: CRMSummary.Mochi) -> some View {
        var rows: [(String, String, Color)] = []
        if let messages = mochi.messages {
            rows.append(("DMs sent", Self.count(messages.outbound), BunTheme.ink))
            if let replies = mochi.replies, let rate = replies.rate {
                rows.append(("Replies", "\(Self.count(messages.inbound)) · \(Self.percent(rate))",
                             rate >= 0.5 ? BunTheme.green : BunTheme.ink))
            } else {
                rows.append(("Replies", Self.count(messages.inbound), BunTheme.ink))
            }
        }
        if let response = mochi.response {
            if let median = response.medianMinutes {
                rows.append(("Median reply", Self.duration(median), BunTheme.ink))
            }
            if let qualified = response.qualified {
                rows.append(("Qualified", Self.count(qualified), BunTheme.ink))
            }
            if let booked = response.callsBooked {
                rows.append(("Calls booked", Self.count(booked), BunTheme.ink))
            }
        }
        return VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                HStack {
                    Text(row.0).font(BunType.rowTitle).foregroundStyle(BunTheme.secondary)
                    Spacer()
                    Text(row.1).font(bunFont(19, .medium)).foregroundStyle(row.2).monospacedDigit()
                }
                .frame(minHeight: 54)
                if index < rows.count - 1 {
                    Rectangle().fill(BunTheme.hairline).frame(height: 1)
                }
            }
        }
    }

    /// The live stage census, which is what Mochi's Default Funnel shows.
    /// Conversion is stated separately because a snapshot is never a rate —
    /// Mochi is explicit about that and the app should not blur it.
    private func pipelineBar(_ pipeline: CRMSummary.Mochi.Pipeline,
                             conversion: CRMSummary.Mochi.Conversion?) -> some View {
        let stages: [(String, Int, Color)] = [
            ("New", pipeline.newLeads, BunTheme.indigoLight),
            ("In contact", pipeline.inContact, Color(red: 0.63, green: 0.53, blue: 0.97)),
            ("Qualified", pipeline.qualified, Color(red: 0.28, green: 0.75, blue: 0.70)),
            ("Booked", pipeline.bookedCall, Color(red: 0.95, green: 0.72, blue: 0.35)),
            ("Won", pipeline.won, BunTheme.green),
            ("Unqualified", pipeline.unqualified, BunTheme.secondary),
        ]
        let peak = max(stages.map(\.1).max() ?? 1, 1)
        return VStack(alignment: .leading, spacing: 10) {
            Text("Pipeline now").font(BunType.label).foregroundStyle(BunTheme.secondary)
            ForEach(stages, id: \.0) { name, count, tone in
                HStack(spacing: 12) {
                    Text(name).font(BunType.caption).foregroundStyle(BunTheme.secondary)
                        .frame(width: 88, alignment: .leading)
                        .lineLimit(1).minimumScaleFactor(0.8)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(BunTheme.field).frame(height: 10)
                            Capsule().fill(tone)
                                .frame(width: max(6, geo.size.width * Double(count) / Double(peak)), height: 10)
                        }
                    }
                    .frame(height: 10)
                    Text(Self.count(count)).font(bunFont(16, .medium))
                        .foregroundStyle(BunTheme.ink).monospacedDigit()
                        .frame(width: 48, alignment: .trailing)
                }
                .frame(height: 32)
            }
            if let conversion, let cohort = conversion.cohort, cohort > 0 {
                Text("Of \(cohort) new leads this window: "
                     + [conversion.newToQualified.map { "\(Self.percent($0)) qualified" },
                        conversion.newToBooked.map { "\(Self.percent($0)) booked" },
                        conversion.newToWon.map { "\(Self.percent($0)) won" }]
                        .compactMap { $0 }.joined(separator: " · "))
                    .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// When leads are actually messaging, in the reader's own timezone rather
    /// than the UTC the API answers in.
    private func activeHours(_ hours: [CRMSummary.Mochi.Hour], peak: Int?) -> some View {
        let offset = TimeZone.current.secondsFromGMT() / 3600
        let shifted = hours.map { hour -> (label: Int, count: Int) in
            (label: ((hour.hour + offset) % 24 + 24) % 24, count: hour.count)
        }.sorted { $0.label < $1.label }
        let top = max(shifted.map(\.count).max() ?? 1, 1)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("When leads message").font(BunType.label).foregroundStyle(BunTheme.secondary)
                Spacer()
                if let peak {
                    let local = ((peak + offset) % 24 + 24) % 24
                    Text("busiest \(Self.hourLabel(local))")
                        .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                }
            }
            Chart {
                ForEach(shifted, id: \.label) { point in
                    BarMark(x: .value("Hour", point.label), y: .value("Messages", point.count), width: .fixed(9))
                        .cornerRadius(3)
                        .foregroundStyle(BunTheme.indigo.opacity(0.35 + 0.65 * Double(point.count) / Double(top)))
                }
            }
            .chartXAxis {
                AxisMarks(values: [0, 6, 12, 18]) { value in
                    AxisValueLabel {
                        if let hour = value.as(Int.self) {
                            Text(Self.hourLabel(hour)).font(bunFont(12)).foregroundStyle(BunTheme.tertiary)
                        }
                    }
                }
            }
            .chartYAxis(.hidden)
            .frame(height: 110)
        }
    }

    private static func hourLabel(_ hour: Int) -> String {
        switch hour {
        case 0: "12am"
        case 12: "12pm"
        case let h where h < 12: "\(h)am"
        default: "\(hour - 12)pm"
        }
    }

    private static func percent(_ value: Double) -> String {
        "\(Int((value * 100).rounded()))%"
    }

    /// "22m", "3h 15m" — the shape Mochi shows for reply time.
    private static func duration(_ minutes: Double) -> String {
        let total = Int(minutes.rounded())
        if total < 60 { return "\(total)m" }
        let hours = total / 60
        let rest = total % 60
        return rest == 0 ? "\(hours)h" : "\(hours)h \(rest)m"
    }

    /// Healthy / warning / restricted, with the send numbers behind it. This
    /// is the first thing Mochi shows and the first thing that matters.
    private func healthBanner(_ health: CRMSummary.Mochi.Health) -> some View {
        let status = (health.status ?? "unknown").lowercased()
        let tone: Color = switch status {
        case "healthy", "ok": BunTheme.green
        case "warning", "at_risk", "at risk": Color(red: 0.95, green: 0.72, blue: 0.35)
        case "critical", "restricted": BunTheme.pink
        default: BunTheme.secondary
        }
        let label = switch status {
        case "healthy", "ok": "Healthy"
        case "warning": "At risk"
        case "critical": "Restricted"
        default: status.capitalized
        }
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Circle().fill(tone).frame(width: 9, height: 9)
                Text(label).font(BunType.rowTitle).foregroundStyle(tone)
                if let username = health.username {
                    Text("@\(username)").font(BunType.caption).foregroundStyle(BunTheme.secondary)
                        .lineLimit(1)
                }
                Spacer()
                if (health.activeFlags ?? 0) > 0 {
                    BunTag(text: "\(health.activeFlags ?? 0) flag\((health.activeFlags ?? 0) == 1 ? "" : "s")",
                           tint: tone, fill: tone.opacity(0.14))
                }
            }
            Text(sendLine(health))
                .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tone.opacity(0.10), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func sendLine(_ health: CRMSummary.Mochi.Health) -> String {
        if health.sendPaused == true { return "Sending is paused on this account." }
        if health.isConnected == false { return "Instagram is disconnected. Reconnect it on the web." }
        guard let sends = health.sends24h else { return health.message ?? "" }
        let failed = health.failed24h ?? 0
        return failed == 0
            ? "\(sends) messages sent in 24 hours, none failed"
            : "\(sends) sent in 24 hours · \(failed) failed"
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
                        stat("Leads", value: Self.count(close.leads))
                        stat("Active", value: Self.count(close.active))
                        stat("Won", value: Self.count(close.won), tone: BunTheme.green)
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

    /// Four-figure counts read as dates without a separator (1484 vs 1,484).
    static func count(_ value: Int?) -> String {
        guard let value else { return "–" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        // en_US_POSIX deliberately drops locale formatting, grouping included,
        // so the separator has to be set explicitly rather than inherited.
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.usesGroupingSeparator = true
        formatter.groupingSeparator = ","
        formatter.groupingSize = 3
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

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
