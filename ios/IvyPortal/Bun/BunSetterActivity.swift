import SwiftUI
import Charts

// Setter activity (founder 2026-08-18: "when I click on the times that people
// message, I wanna be able to see, per setter, what time they messaged and how
// many messages, just like what Mochi has").
//
// What Mochi's API actually exposes, and therefore what this shows honestly:
// per-setter TOTALS (messages sent, replies, reply rate) and per-setter ACTIVE
// WINDOWS (time online, days active, average day), plus the hour-of-day and
// day-of-week distributions for the whole team. Mochi's own app draws a
// setter-by-hour grid, but no tool returns that cross-tab — so rather than
// invent a split, this shows the real per-setter numbers beside the team's
// hours, and says where each number comes from.

struct BunSetterActivitySheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared

    private var mochi: CRMSummary.Mochi? { store.crm?.mochi }

    private var offset: Int { TimeZone.current.secondsFromGMT() / 3600 }

    /// The API answers in UTC; a setter reads their own clock.
    private var localHours: [(hour: Int, count: Int)] {
        (mochi?.hours ?? []).map { (hour: (($0.hour + offset) % 24 + 24) % 24, count: $0.count) }
            .sorted { $0.hour < $1.hour }
    }

    private var totalMessages: Int {
        mochi?.hourTotal ?? localHours.reduce(0) { $0 + $1.count }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    BunTitle(text: "Setter activity")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(BunCRMSheet.count(totalMessages))
                        .font(bunFont(34, .medium)).foregroundStyle(BunTheme.ink).monospacedDigit()
                    Text("messages in this window")
                        .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                }

                hourBlock
                edgeHairline
                weekdayBlock
                edgeHairline
                setterBlock
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        // Opened straight from a deep link it has no data of its own; the
        // store keeps the window the CRM sheet was last on.
        .task { await store.loadCRM(store.crmPeriod) }
    }

    // MARK: Hours

    @ViewBuilder private var hourBlock: some View {
        let hours = localHours
        if hours.contains(where: { $0.count > 0 }) {
            let peak = max(hours.map(\.count).max() ?? 1, 1)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("By hour").font(BunType.section).foregroundStyle(BunTheme.ink)
                    Spacer()
                    if let peakUTC = mochi?.peakHourUTC {
                        Text("busiest \(BunCRMSheet.hourLabel(((peakUTC + offset) % 24 + 24) % 24))")
                            .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                    }
                }
                Chart {
                    ForEach(hours, id: \.hour) { point in
                        BarMark(x: .value("Hour", point.hour), y: .value("Messages", point.count), width: .fixed(11))
                            .cornerRadius(3)
                            .foregroundStyle(BunTheme.indigo.opacity(0.35 + 0.65 * Double(point.count) / Double(peak)))
                    }
                }
                .chartXAxis {
                    AxisMarks(values: [0, 3, 6, 9, 12, 15, 18, 21]) { value in
                        AxisValueLabel {
                            if let hour = value.as(Int.self) {
                                Text(BunCRMSheet.hourLabel(hour))
                                    .font(bunFont(11)).foregroundStyle(BunTheme.tertiary)
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { _ in
                        AxisValueLabel().font(bunFont(11)).foregroundStyle(BunTheme.tertiary)
                        AxisGridLine().foregroundStyle(BunTheme.hairline)
                    }
                }
                .frame(height: 150)
                Text("Your clock, not the API's UTC.")
                    .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
            }
        }
    }

    // MARK: Weekdays

    @ViewBuilder private var weekdayBlock: some View {
        let days = mochi?.weekdays ?? []
        if days.contains(where: { $0.count > 0 }) {
            let peak = max(days.map(\.count).max() ?? 1, 1)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("By day").font(BunType.section).foregroundStyle(BunTheme.ink)
                    Spacer()
                    if let busiest = mochi?.peakWeekday {
                        Text("busiest \(busiest.lowercased())")
                            .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                    }
                }
                VStack(spacing: 0) {
                    ForEach(days) { day in
                        HStack(spacing: 12) {
                            Text(String(day.day.prefix(3)))
                                .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                .frame(width: 44, alignment: .leading)
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(BunTheme.field).frame(height: 10)
                                    Capsule().fill(BunTheme.indigo)
                                        .frame(width: max(6, geo.size.width * Double(day.count) / Double(peak)), height: 10)
                                }
                            }
                            .frame(height: 10)
                            Text(BunCRMSheet.count(day.count))
                                .font(bunFont(16, .medium)).foregroundStyle(BunTheme.ink)
                                .monospacedDigit().frame(width: 56, alignment: .trailing)
                        }
                        .frame(height: 34)
                    }
                }
            }
        }
    }

    // MARK: Per setter

    @ViewBuilder private var setterBlock: some View {
        let setters = mochi?.setters ?? []
        VStack(alignment: .leading, spacing: 12) {
            Text("Per setter").font(BunType.section).foregroundStyle(BunTheme.ink)
            if setters.isEmpty {
                Text("No setter activity in this window.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(setters) { setter in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 14) {
                                BunAvatar(text: String(setter.name.prefix(1)), size: 44,
                                          fill: BunStore.fill(for: setter.name))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(setter.name).font(BunType.rowTitle)
                                        .foregroundStyle(BunTheme.ink).lineLimit(1)
                                    Text(activityLine(setter))
                                        .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                        .lineLimit(1).minimumScaleFactor(0.8)
                                }
                                Spacer()
                                Text(BunCRMSheet.count(setter.messages))
                                    .font(bunFont(19, .medium)).foregroundStyle(BunTheme.ink)
                                    .monospacedDigit()
                            }
                            // Reply rate as a bar: the eye compares lengths
                            // faster than it compares percentages.
                            if let rate = setter.rate {
                                HStack(spacing: 10) {
                                    GeometryReader { geo in
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(BunTheme.field).frame(height: 6)
                                            Capsule().fill(rate >= 0.5 ? BunTheme.green : BunTheme.indigo)
                                                .frame(width: max(4, geo.size.width * min(rate, 1)), height: 6)
                                        }
                                    }
                                    .frame(height: 6)
                                    Text(BunCRMSheet.percent(rate))
                                        .font(BunType.caption)
                                        .foregroundStyle(rate >= 0.5 ? BunTheme.green : BunTheme.secondary)
                                        .frame(width: 44, alignment: .trailing)
                                }
                            }
                        }
                        .padding(.vertical, 12)
                    }
                }
                Text("Mochi reports each setter's totals and time online, not a message count per hour, so the hours above are the whole team's.")
                    .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// Replies, time online, days worked — whichever Mochi actually returned.
    private func activityLine(_ setter: CRMSummary.Mochi.Setter) -> String {
        var bits = ["\(BunCRMSheet.count(setter.replies)) replies"]
        if let daily = setter.avgDailyMinutes, daily > 0 {
            bits.append("\(BunCRMSheet.duration(daily))/day")
        }
        if let days = setter.daysActive, days > 0 {
            bits.append("\(days) day\(days == 1 ? "" : "s") active")
        }
        return bits.joined(separator: " · ")
    }

    private var edgeHairline: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)
    }
}
