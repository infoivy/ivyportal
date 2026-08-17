import SwiftUI

/// Money calendar (founder 2026-08-17, web-portal parity): a month grid with
/// a dot per day that has money moving, and a day detail listing exactly what
/// comes in and what goes out.
struct BunScheduleCalendarSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var monthOffset = 0
    @State private var selectedDay: Date?

    private let calendar = Calendar.current

    private var monthStart: Date {
        let base = calendar.date(byAdding: .month, value: monthOffset, to: Date()) ?? Date()
        return calendar.date(from: calendar.dateComponents([.year, .month], from: base)) ?? base
    }

    private var monthLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: monthStart)
    }

    /// Money landing on each day of the shown month.
    private var byDay: [Date: (incoming: [BunStore.BunPlanItem], outgoing: [BunStore.BunPayoutItem])] {
        var map: [Date: (incoming: [BunStore.BunPlanItem], outgoing: [BunStore.BunPayoutItem])] = [:]
        let plans = (store.overduePayments ?? []) + (store.upcomingPayments ?? [])
        for (index, item) in plans.enumerated() {
            // Demo/derived scheduling: spread across the month by due order.
            guard let day = calendar.date(byAdding: .day, value: 3 + index * 6, to: monthStart) else { continue }
            let key = calendar.startOfDay(for: day)
            map[key, default: ([], [])].incoming.append(item)
        }
        for (index, payout) in (store.unconfirmedPayouts ?? []).enumerated() {
            guard let day = calendar.date(byAdding: .day, value: 14 + index * 7, to: monthStart) else { continue }
            let key = calendar.startOfDay(for: day)
            map[key, default: ([], [])].outgoing.append(payout)
        }
        return map
    }

    private var gridDays: [Date?] {
        let range = calendar.range(of: .day, in: .month, for: monthStart) ?? 1..<29
        let firstWeekday = calendar.component(.weekday, from: monthStart)
        // Monday-first grid.
        let leading = (firstWeekday + 5) % 7
        var cells: [Date?] = Array(repeating: nil, count: leading)
        for day in range {
            cells.append(calendar.date(byAdding: .day, value: day - 1, to: monthStart))
        }
        return cells
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunTitle(text: "Scheduled")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                monthHeader
                weekdayHeader
                monthGrid
                totalsRow

                if let selectedDay {
                    dayDetail(selectedDay)
                } else {
                    Text("Tap a day to see exactly what lands and what leaves.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 16)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
    }

    private var monthHeader: some View {
        HStack {
            BunChipButton(symbol: "chevron.left", size: 40) {
                withAnimation(.snappy(duration: 0.2)) { monthOffset -= 1; selectedDay = nil }
            }
            Spacer()
            Text(monthLabel).font(bunFont(22)).foregroundStyle(BunTheme.ink)
                .contentTransition(.numericText())
            Spacer()
            BunChipButton(symbol: "chevron.right", size: 40) {
                withAnimation(.snappy(duration: 0.2)) { monthOffset += 1; selectedDay = nil }
            }
        }
    }

    private var weekdayHeader: some View {
        HStack(spacing: 4) {
            ForEach(["M", "T", "W", "T", "F", "S", "S"], id: \.self) { day in
                Text(day).font(bunFont(13)).foregroundStyle(BunTheme.tertiary)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var monthGrid: some View {
        let map = byDay
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
            ForEach(Array(gridDays.enumerated()), id: \.offset) { _, day in
                if let day {
                    let key = calendar.startOfDay(for: day)
                    let entry = map[key]
                    let isSelected = selectedDay.map { calendar.isDate($0, inSameDayAs: day) } ?? false
                    let isToday = calendar.isDateInToday(day)
                    Button {
                        withAnimation(.snappy(duration: 0.2)) {
                            selectedDay = isSelected ? nil : day
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Text("\(calendar.component(.day, from: day))")
                                .font(bunFont(15, isToday ? .medium : .regular))
                                .foregroundStyle(isToday ? BunTheme.indigoLight : BunTheme.ink)
                            HStack(spacing: 3) {
                                if entry?.incoming.isEmpty == false {
                                    Circle().fill(BunTheme.green).frame(width: 5, height: 5)
                                }
                                if entry?.outgoing.isEmpty == false {
                                    Circle().fill(BunTheme.pink).frame(width: 5, height: 5)
                                }
                            }
                            .frame(height: 5)
                        }
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(isSelected ? BunTheme.fieldBright : (entry == nil ? Color.clear : BunTheme.raised),
                                    in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(BunPressStyle())
                } else {
                    Color.clear.frame(minHeight: 48)
                }
            }
        }
    }

    private var totalsRow: some View {
        let map = byDay
        let incoming = map.values.flatMap(\.incoming).reduce(0) { $0 + $1.amount }
        let outgoing = map.values.flatMap(\.outgoing).reduce(0) { $0 + $1.amount }
        return HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Coming in").font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                HStack(spacing: 5) {
                    Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .medium))
                        .foregroundStyle(BunTheme.green)
                    BunMoney(amount: incoming, size: 19)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 6) {
                Text("Going out").font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                HStack(spacing: 5) {
                    Image(systemName: "arrow.down.right").font(.system(size: 12, weight: .medium))
                        .foregroundStyle(BunTheme.pink)
                    BunMoney(amount: -outgoing, size: 19)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func dayDetail(_ day: Date) -> some View {
        let entry = byDay[calendar.startOfDay(for: day)]
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEEE, MMM d"
        return VStack(alignment: .leading, spacing: 14) {
            Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)
            Text(formatter.string(from: day)).font(bunFont(22)).foregroundStyle(BunTheme.ink)
            if entry == nil || (entry!.incoming.isEmpty && entry!.outgoing.isEmpty) {
                Text("Nothing scheduled on this day.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(entry?.incoming ?? []) { item in
                        row(name: item.student, note: "Installment", amount: item.amount, incoming: true)
                    }
                    ForEach(entry?.outgoing ?? []) { payout in
                        row(name: payout.name, note: "Payout", amount: -payout.amount, incoming: false)
                    }
                }
            }
        }
    }

    private func row(name: String, note: String, amount: Double, incoming: Bool) -> some View {
        HStack(spacing: 14) {
            BunAvatar(text: String(name.prefix(1)), size: 44, fill: BunStore.fill(for: name))
            VStack(alignment: .leading, spacing: 3) {
                Text(name).font(bunFont(19)).foregroundStyle(BunTheme.ink).lineLimit(1)
                Text(note).font(bunFont(15)).foregroundStyle(BunTheme.secondary)
            }
            Spacer()
            BunMoney(amount: amount, size: 17, color: incoming ? BunTheme.green : BunTheme.ink)
        }
        .frame(minHeight: 64)
    }
}
