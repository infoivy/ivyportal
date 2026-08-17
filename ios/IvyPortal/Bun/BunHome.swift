import SwiftUI
import Charts

/// Home — clone of the Mercury "Welcome" reference screen.
struct BunHome: View {
    @Binding var tab: BunTab
    @State private var showSettings = false
    @State private var showMovement = false
    @State private var selectedTransaction: BunTransaction?
    @State private var store = BunStore.shared
    @State private var showTeam = false
    @State private var showEOD = false
    @State private var showOrgSwitcher = false
    @State private var scrub: Int?
    @State private var showUnclaimed = false

    // MARK: Live-or-fixture values (signed-in reads real portal money)

    private var live: Bool { store.signedIn }
    private var loadingLive: Bool { live && store.cashSeries == nil }

    private var welcomeName: String { store.firstName ?? "there" }

    /// Cumulative cash over the selected range (the demo walk is designed
    /// to roll like the reference chart; catmullRom does the smoothing).
    private var series: [Double] {
        guard let days = store.cashSeries else { return [] }
        var running = 0.0
        return days.map { running += $0.amount; return running }
    }

    /// Cash collected: inflow days only (spend days chart as dips).
    private var headlineAmount: Double {
        store.cashSeries?.reduce(0) { $0 + max($1.amount, 0) } ?? 0
    }

    private var range30In: Double { headlineAmount }

    private var range30Out: Double { -(store.paidOutPeriod ?? 0) }

    private var monthLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: Date())
    }

    private var monthIn: Double { store.monthIn ?? 0 }
    private var monthOut: Double { -(store.monthOut ?? 0) }

    private var previewTransactions: [BunTransaction] {
        Array((store.ledger ?? []).prefix(3))
    }

    var body: some View {
        if live && store.needsOrgSetup {
            BunCreateBusinessView()
        } else {
            homeBody
        }
    }

    private var homeBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                topRow
                    .padding(.top, 8)

                Text("Welcome, \(welcomeName)")
                    .font(BunType.headline)
                    .foregroundStyle(BunTheme.ink)
                    .padding(.top, 26)

                BunMoney(amount: headlineAmount, size: BunType.Money.hero)
                    .redacted(reason: loadingLive ? .placeholder : [])
                    .padding(.top, 8)

                rangeRow
                    .padding(.top, 14)

                if store.eodDue == true {
                    eodBanner
                        .padding(.top, 18)
                }

                balanceChart
                    .padding(.top, 4)

                hairline

                monthBlock
                    .padding(.top, 26)

                hairline
                    .padding(.top, 26)

                transactionsSection
                    .padding(.top, 26)

                if !(store.mySets ?? []).isEmpty {
                    hairline
                        .padding(.top, 26)
                    setsSection
                        .padding(.top, 26)
                }
                hairline
                    .padding(.top, 26)
                teamSection
                    .padding(.top, 26)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .task {
            await store.loadHome()
            await store.loadLedger()
            await store.loadTeam()
            await store.loadSets()
        }
        .refreshable {
            store.cashSeries = nil
            store.monthIn = nil
            store.monthOut = nil
            store.paidOutPeriod = nil
            store.ledger = nil
            await store.loadHome()
            await store.loadLedger()
        }
        .sheet(isPresented: $showSettings) {
            BunSettingsSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(item: $selectedTransaction) { transaction in
            BunTransactionDetail(transaction: transaction)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showMovement) {
            BunMovementSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showTeam) {
            BunTeamSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showEOD) {
            BunEODFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showOrgSwitcher) {
            BunOrgSwitcherSheet()
                .presentationDetents([.medium])
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showUnclaimed) {
            BunUnclaimedSetsSheet()
                .presentationDetents([.medium])
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
    }

    // MARK: Top row — org chip left, avatar right

    private var topRow: some View {
        HStack(spacing: 0) {
            Button { showOrgSwitcher = true } label: {
                HStack(spacing: 11) {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(Color(red: 0.20, green: 0.32, blue: 0.34))
                        .frame(width: 40, height: 40)
                        .overlay(
                            Text(String(store.orgName.prefix(1)))
                                .font(bunFont(18, .medium))
                                .foregroundStyle(BunTheme.ink)
                        )
                    Text(store.orgName)
                        .font(bunFont(17, .medium))
                        .foregroundStyle(BunTheme.ink)
                    Image(systemName: "arrowtriangle.down.fill")
                        .font(.system(size: 8, weight: .regular))
                        .foregroundStyle(BunTheme.secondary)
                }
            }
            .buttonStyle(BunPressStyle())
            .accessibilityLabel("Workspace")

            Spacer()

            Button { showSettings = true } label: {
                BunAvatar(
                    text: BunFixtures.userInitials,
                    size: 44,
                    fill: Color(red: 0.23, green: 0.36, blue: 0.36)
                )
            }
            .buttonStyle(BunPressStyle())
            .accessibilityLabel("Account")
        }
    }

    // MARK: Range row — 30D ⌄ · ↗ in · ↘ out

    private var rangeRow: some View {
        HStack(spacing: 16) {
            Menu {
                ForEach([7, 30, 90], id: \.self) { days in
                    Button("\(days)D\(store.rangeDays == days ? " ✓" : "")") {
                        Task { await store.setRange(days) }
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Text("\(store.rangeDays)D")
                        .font(BunType.chip)
                        .foregroundStyle(BunTheme.ink)
                    Image(systemName: "arrowtriangle.down.fill")
                        .font(.system(size: 8, weight: .regular))
                        .foregroundStyle(BunTheme.secondary)
                }
            }

            HStack(spacing: 5) {
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(BunTheme.green)
                BunMoney(amount: range30In, size: BunType.Money.chip)
            }

            HStack(spacing: 5) {
                Image(systemName: "arrow.down.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(BunTheme.pink)
                BunMoney(amount: range30Out, size: BunType.Money.chip)
            }
        }
    }

    // MARK: Balance chart — full bleed, stepped line

    /// Reference proportions: the walk sits in the upper ~60% of the plot with
    /// a sliver of headroom above the peak and open ground below the trough.
    private var chartDomain: ClosedRange<Double> {
        let low = series.min() ?? 0
        let high = series.max() ?? 1
        let span = max(high - low, 1)
        return (low - span * 0.72)...(high + span * 0.05)
    }

    /// Day label for the scrubber ("Aug 12").
    private func scrubLabel(_ index: Int) -> String {
        guard let days = store.cashSeries, days.indices.contains(index),
              let date = BunStore.parseDay(days[index].id) else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private var balanceChart: some View {
        Chart {
            ForEach(Array(series.enumerated()), id: \.offset) { point in
                // yStart pins the fill to the domain floor. Plain `y:` would
                // fill only down to zero in DATA space, which on a cumulative
                // series cuts the wash off with a hard horizontal edge.
                AreaMark(
                    x: .value("Day", point.offset),
                    yStart: .value("Base", chartDomain.lowerBound),
                    yEnd: .value("Balance", point.element)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(
                    LinearGradient(
                        colors: [BunTheme.chartFillTop, BunTheme.chartFillBottom],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                // One crisp hairline, no glow — the reference line is thin.
                LineMark(
                    x: .value("Day", point.offset),
                    y: .value("Balance", point.element)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(BunTheme.chartStroke)
                .lineStyle(StrokeStyle(lineWidth: 1.5, lineCap: .round))
            }
            if let scrub, series.indices.contains(scrub) {
                RuleMark(x: .value("Day", scrub))
                    .foregroundStyle(BunTheme.ink.opacity(0.22))
                    .lineStyle(StrokeStyle(lineWidth: 1))
                PointMark(x: .value("Day", scrub), y: .value("Balance", series[scrub]))
                    .symbolSize(70)
                    .foregroundStyle(BunTheme.chartStroke)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartYScale(domain: chartDomain)
        .chartOverlay { proxy in
            GeometryReader { geo in
                Rectangle().fill(.clear).contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                guard let plotFrame = proxy.plotFrame else { return }
                                let x = value.location.x - geo[plotFrame].origin.x
                                if let day: Int = proxy.value(atX: x) {
                                    scrub = max(0, min(series.count - 1, day))
                                }
                            }
                            .onEnded { _ in
                                Task {
                                    try? await Task.sleep(for: .seconds(2))
                                    withAnimation(.easeOut(duration: 0.3)) { scrub = nil }
                                }
                            }
                    )
            }
        }
        .overlay(alignment: .topLeading) {
            if let scrub, series.indices.contains(scrub) {
                HStack(spacing: 8) {
                    Text(scrubLabel(scrub)).font(bunFont(14)).foregroundStyle(BunTheme.secondary)
                    BunMoney(amount: series[scrub], size: 15, weight: .medium)
                }
                .padding(.horizontal, 12).frame(height: 34)
                .background(BunTheme.raised, in: Capsule())
                .padding(.leading, 22)
                .transition(.opacity)
            }
        }
        .frame(height: 190)
        .padding(.horizontal, -22)
        .animation(.easeOut(duration: 0.12), value: scrub)
    }

    // MARK: Month block — "December 2025 ›" + money in / money spent

    private var monthBlock: some View {
        VStack(alignment: .leading, spacing: 20) {
            Button { showMovement = true } label: {
                HStack(spacing: 8) {
                    Text(monthLabel)
                        .font(BunType.section)
                        .foregroundStyle(BunTheme.ink)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(BunTheme.secondary)
                }
            }
            .buttonStyle(BunPressStyle())

            HStack(alignment: .top, spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Money in")
                        .font(BunType.label)
                        .foregroundStyle(BunTheme.secondary)
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 13, weight: .regular))
                            .foregroundStyle(BunTheme.green)
                        BunMoney(amount: monthIn, size: BunType.Money.value)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Money spent")
                        .font(BunType.label)
                        .foregroundStyle(BunTheme.secondary)
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.down.right")
                            .font(.system(size: 13, weight: .regular))
                            .foregroundStyle(BunTheme.pink)
                        BunMoney(amount: monthOut, size: BunType.Money.value)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    /// Mercury banner-block pattern for the daily nag: file today's EOD.
    private var eodBanner: some View {
        Button { showEOD = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(BunTheme.indigoLight)
                    .frame(width: 44, height: 44)
                    .background(BunTheme.field, in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text("EOD due").font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                    Text("File today's numbers").font(BunType.caption).foregroundStyle(BunTheme.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .regular)).foregroundStyle(BunTheme.secondary)
            }
            .padding(16)
            .background(BunTheme.raised, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(BunPressStyle())
    }

    /// My claimed sets: prospect, time, one-tap confirm (set_reminders).
    private var setsSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 8) {
                Text("Upcoming sets").font(BunType.section).foregroundStyle(BunTheme.ink)
                Spacer()
                if let unclaimed = store.unclaimedSetCount, unclaimed > 0 {
                    Button { showUnclaimed = true } label: {
                        BunTag(text: "\(unclaimed) unclaimed", tint: BunTheme.pink, fill: BunTheme.pink.opacity(0.15))
                    }
                    .buttonStyle(BunPressStyle())
                }
            }
            VStack(spacing: 0) {
                ForEach(store.mySets ?? []) { set in
                    HStack(spacing: 14) {
                        BunAvatar(text: String(set.prospect.prefix(1)), size: 44, fill: BunStore.fill(for: set.prospect))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(set.prospect).font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                            Text(PortalAPI.friendlyEventTime(set.eventStart)
                                 + (set.notes.map { " · \($0)" } ?? ""))
                                .font(BunType.caption).foregroundStyle(BunTheme.secondary).lineLimit(1)
                        }
                        Spacer()
                        if set.confirmedAt != nil {
                            BunTag(text: "Confirmed", tint: BunTheme.green, fill: BunTheme.green.opacity(0.14))
                        } else {
                            Button {
                                Task { try? await store.confirmSet(set) }
                            } label: {
                                Text("Confirm").font(bunFont(15, .medium)).foregroundStyle(.white)
                                    .padding(.horizontal, 14).frame(height: 38)
                                    .background(BunTheme.indigo, in: Capsule())
                            }
                            .buttonStyle(BunPressStyle())
                        }
                    }
                    .frame(minHeight: 64)
                }
            }
        }
    }

    private var teamSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionHeader("Team") { showTeam = true }
            HStack(alignment: .top, spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("EOD coverage").font(BunType.label).foregroundStyle(BunTheme.secondary)
                    Text(store.teamSummary.map { "\($0.coverage)%" } ?? "…")
                        .font(bunFont(19, .medium)).foregroundStyle(BunTheme.ink).monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Sets · 7 days").font(BunType.label).foregroundStyle(BunTheme.secondary)
                    Text(store.teamRows.map { "\($0.reduce(0) { $0 + $1.sets })" } ?? "…")
                        .font(bunFont(19, .medium)).foregroundStyle(BunTheme.ink).monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: Transactions

    private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: 22) {
            sectionHeader("Transactions") { tab = .money }
            VStack(alignment: .leading, spacing: 22) {
                ForEach(previewTransactions) { transaction in
                    Button { selectedTransaction = transaction } label: {
                        transactionRow(transaction)
                    }
                    .buttonStyle(BunPressStyle())
                }
            }
        }
    }

    private func transactionRow(_ transaction: BunTransaction) -> some View {
        let failed = transaction.tag == "Failed"
        return HStack(spacing: 16) {
            BunAvatar(
                text: String(transaction.counterparty.prefix(1)),
                size: 44,
                fill: transaction.avatarFill
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.counterparty)
                    .font(BunType.rowTitle)
                    .foregroundStyle(BunTheme.ink)
                HStack(spacing: 8) {
                    Text(transaction.method)
                        .font(BunType.caption)
                        .foregroundStyle(BunTheme.secondary)
                    if let tag = transaction.tag {
                        BunTag(text: tag, tint: BunTheme.pink, fill: BunTheme.pink.opacity(0.15))
                    }
                }
            }
            Spacer()
            if failed {
                BunMoney(amount: transaction.amount, size: BunType.Money.row, color: BunTheme.secondary)
                    .strikethrough()
            } else {
                BunMoney(
                    amount: transaction.amount,
                    size: BunType.Money.row,
                    color: transaction.amount > 0 ? BunTheme.green : BunTheme.ink
                )
            }
        }
    }

    // MARK: Shared bits

    /// Section header routes to its tab — no dead chevrons.
    private func sectionHeader(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title)
                    .font(BunType.section)
                    .foregroundStyle(BunTheme.ink)
                Image(systemName: "chevron.right")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(BunTheme.secondary)
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }

    private var hairline: some View {
        Rectangle()
            .fill(BunTheme.hairline)
            .frame(height: 1)
            .padding(.horizontal, -22)
    }
}
