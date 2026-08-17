import SwiftUI

/// Money movement sheet, cloned from the Mercury reference: segmented
/// Money in / Money spent, month bars, source rows, month pager.
struct BunMovementSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var segment: Int
    /// Which of the four months is selected (pager); default = latest.
    @State private var monthIndex = 3

    init(initialSegment: Int = 1) {
        _segment = State(initialValue: initialSegment)
    }

    private var months: [(label: String, spent: Double)] {
        let source = showingSpent ? store.movementOut : store.movementIn
        return (source ?? []).map { (label: $0.label, spent: $0.amount) }
    }
    private var showingSpent: Bool { segment == 1 }
    private var selectedMonth: (label: String, spent: Double)? {
        months.indices.contains(monthIndex) ? months[monthIndex] : months.last
    }

    private var currentAmount: Double { selectedMonth?.spent ?? 0 }
    private var threeMonthAverage: Double {
        let earlier = months.dropLast()
        guard !earlier.isEmpty else { return 0 }
        return earlier.reduce(0) { $0 + $1.spent } / Double(earlier.count)
    }
    /// Spent: expense sources. Money in: top clients by cash collected.
    private var sources: [(name: String, amount: Double)] {
        if showingSpent { return store.movementSources ?? [] }
        return (store.paidByStudent ?? [:])
            .filter { $0.value > 0 }
            .sorted { $0.value > $1.value }
            .prefix(6)
            .map { (name: $0.key, amount: $0.value) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack {
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                BunTitle(text: "Money movement")
                BunSegment(options: ["Money in", "Money spent"], selection: $segment)

                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(showingSpent ? "Money spent" : "Money in")
                            .font(bunFont(19)).foregroundStyle(BunTheme.secondary)
                        BunMoney(amount: currentAmount, size: 26, weight: .medium)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 6) {
                        Text("Last 3 month average").font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                        BunMoney(amount: threeMonthAverage, size: 17)
                    }
                }

                bars

                Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)

                if !sources.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(sources.enumerated()), id: \.offset) { _, source in
                            HStack {
                                Text(source.name).font(bunFont(19)).foregroundStyle(BunTheme.ink)
                                Spacer()
                                BunMoney(amount: source.amount, size: 19,
                                         color: showingSpent ? BunTheme.ink : BunTheme.green)
                            }
                            .frame(minHeight: 62)
                        }
                    }
                } else {
                    VStack(spacing: 10) {
                        Text(showingSpent ? "No spend yet" : "No money in").font(bunFont(22)).foregroundStyle(BunTheme.ink)
                        Text(showingSpent ? "Expenses land here as they are logged."
                                          : "Money in lands here as it arrives.")
                            .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 28)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 110)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) {
            HStack {
                BunChipButton(symbol: "chevron.left", size: 42) {
                    if monthIndex > 0 { withAnimation(.snappy(duration: 0.2)) { monthIndex -= 1 } }
                }
                .opacity(monthIndex > 0 ? 1 : 0.35)
                Spacer()
                Text(monthPagerLabel).font(bunFont(22)).foregroundStyle(BunTheme.ink)
                    .contentTransition(.numericText())
                Spacer()
                BunChipButton(symbol: "chevron.right", size: 42) {
                    if monthIndex < months.count - 1 { withAnimation(.snappy(duration: 0.2)) { monthIndex += 1 } }
                }
                .opacity(monthIndex < months.count - 1 ? 1 : 0.35)
            }
            .padding(.horizontal, 22).padding(.bottom, 6)
            .background(BunTheme.ground.opacity(0.94))
        }
    }

    private var monthPagerLabel: String {
        let calendar = Calendar.current
        let back = (months.count - 1) - monthIndex
        let date = calendar.date(byAdding: .month, value: -back, to: Date()) ?? Date()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }

    private var bars: some View {
        let peak = max(months.map { abs($0.spent) }.max() ?? 1, 1)
        return HStack(alignment: .bottom, spacing: 14) {
            ForEach(Array(months.enumerated()), id: \.offset) { index, month in
                VStack(spacing: 8) {
                    UnevenRoundedRectangle(topLeadingRadius: 8, topTrailingRadius: 8)
                        .fill(LinearGradient(colors: [BunTheme.indigo.opacity(index == monthIndex ? 0.55 : 0.25),
                                                      BunTheme.indigo.opacity(0.05)],
                                             startPoint: .top, endPoint: .bottom))
                        .overlay(alignment: .top) {
                            Rectangle().fill(BunTheme.chartLine.opacity(index == monthIndex ? 1 : 0.45)).frame(height: 2)
                        }
                        .frame(height: max(CGFloat(abs(month.spent) / peak) * 130, 6))
                    BunMoney(amount: month.spent, size: 17)
                    Text(month.label).font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture { withAnimation(.snappy(duration: 0.2)) { monthIndex = index } }
            }
        }
        .animation(.snappy(duration: 0.3), value: segment)
    }
}
