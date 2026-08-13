import SwiftUI

/// Role-driven Home (portal `_authenticated.dashboard.tsx`): leaders see a
/// money strip, card tile, and one or more "pictures" chosen by grantable
/// sales/fulfillment view roles. Non-leaders see a personal "Your day" panel.
/// Debug scenarios let you preview each role without signing in.
struct HomeView: View {
    let onAction: (HomeAction) -> Void
    @State private var queue: HomeQueue?
    @State private var queueLoading = false
    @State private var queueError: String?

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    #if DEBUG
    @Binding var scenario: DemoScenario
    @Binding var debugPicture: HomePicture
    init(scenario: Binding<DemoScenario>, picture: Binding<HomePicture>, onAction: @escaping (HomeAction) -> Void) {
        _scenario = scenario
        _debugPicture = picture
        self.onAction = onAction
    }
    #else
    init(onAction: @escaping (HomeAction) -> Void) {
        self.onAction = onAction
    }
    #endif

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                ScreenHeader(title: "Good afternoon", subtitle: "Thursday, 13 August", showsMenu: true)
                if signedIn {
                    liveContent
                } else {
                    #if DEBUG
                    scenarioContent
                    #else
                    StatusCard(symbol: "lock.shield.fill", title: "Connect Ivy Portal", message: "Sign in to load verified actions, students, Performance, and Money In data.")
                    #endif
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .background(Color.black)
        .task { await loadQueueIfNeeded() }
    }

    #if DEBUG
    /// The active Home picture. Chosen from the burger menu (not an on-screen
    /// picker); the launch arg `-homePicture` presets it for screenshots.
    #endif

    private func loadQueueIfNeeded() async {
        guard signedIn, queue == nil else { return }
        queueLoading = true
        defer { queueLoading = false }
        do {
            queue = try await PortalAPI.shared.homeQueue()
            queueError = nil
        } catch {
            queueError = "Could not load the home queue."
        }
    }

    // MARK: - Live (signed in)

    @ViewBuilder private var liveContent: some View {
        if let queue {
            VStack(alignment: .leading, spacing: 26) {
                liveFocus(queue)
                Text("Source: real portal data · students, action items, installments").font(.caption).foregroundStyle(.tertiary)
            }
        } else if queueLoading {
            skeletonContent
        } else {
            StatusCard(symbol: "exclamationmark.triangle", title: "Home unavailable", message: queueError ?? "Sign in to load verified data.", retry: { queue = nil; Task { await loadQueueIfNeeded() } })
        }
    }

    private func liveFocus(_ queue: HomeQueue) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Command queue", detail: "Live priorities")
            SurfaceCard {
                VStack(spacing: 0) {
                    HomeActionRow(symbol: "exclamationmark.circle.fill", symbolColor: .orange, title: "Review overdue items", detail: "\(queue.overdueActions) open action items", value: "\(queue.overdueActions)") { onAction(.reviewOverdue) }
                    Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 48)
                    HomeActionRow(symbol: "person.3.fill", symbolColor: .white, title: "Check team reporting", detail: "\(queue.flaggedStudents) students flagged · \(queue.overduePayments) overdue installments", value: "\(queue.flaggedStudents + queue.overduePayments)") { onAction(.reviewCoverage) }
                }
            }
        }
    }

    // MARK: - Debug scenarios

    #if DEBUG
    @ViewBuilder private var scenarioContent: some View {
        switch scenario {
        case .loaded: loadedContent
        case .loading: skeletonContent
        case .empty:
            StatusCard(symbol: "checkmark.circle", title: "You’re clear", message: "No urgent actions are assigned right now.")
        case .unavailable:
            StatusCard(symbol: "questionmark.circle", title: "Picture unavailable", message: "The source has no verified answer for this scope.")
        case .failed:
            StatusCard(symbol: "exclamationmark.triangle", title: "Home could not load", message: "The reporting source did not respond.", retry: { scenario = .loading })
        }
    }
    #endif

    #if DEBUG
    @ViewBuilder private var loadedContent: some View {
        switch debugPicture {
        case .sales:
            salesPicture
        case .fulfillment:
            fulfillmentPicture
        case .leadership:
            leadershipPicture
        case .personal:
            personalPicture
        }
        commandQueueSection
        Text("Debug fixture · Preview as \(debugPicture.label). Tap any tile.")
            .font(.caption).foregroundStyle(.tertiary)
    }
    #endif

    // MARK: Sales picture (Abu Bilal)

    #if DEBUG
    private var salesPicture: some View {
        VStack(alignment: .leading, spacing: 26) {
            pictureHeader("Sales", title: "Today's picture")
            // Money strip → hero-level stat tiles
            HStack(spacing: 14) {
                StatTile(label: "Cash collected · Aug", value: "$18.4K", symbol: "banknote.fill", valueColor: ivyMint) { onAction(.openMoneyStrip) }
                StatTile(label: "Left to pay out", value: "$2.3K", symbol: "wallet.pass.fill") { onAction(.openPayouts) }
            }
            // The load-bearing sales numbers as a 2-col grid
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 14) {
                StatTile(label: "Sets this week", value: "18", symbol: "calendar.badge.checkmark") { onAction(.openSalesCalendar) }
                StatTile(label: "Show rate", value: "80%", symbol: "eye.fill", valueColor: ivyTeal) { onAction(.openSalesCalendar) }
                StatTile(label: "Closes this period", value: "7", symbol: "hand.coins.fill") { onAction(.openSalesRevenue) }
                StatTile(label: "Pipeline in Close", value: "23", symbol: "target", valueColor: ivyBlue) { onAction(.openSalesCRM) }
            }
            // Yesterday's volume vs target → colored daily strip
            VStack(alignment: .leading, spacing: 12) {
                sectionHeader("Volume yesterday", detail: "2 short of target")
                DailyStrip(days: [
                    .init(label: "Dials", value: "96", active: true),
                    .init(label: "DMs", value: "41", active: true),
                    .init(label: "Sets", value: "5", active: true),
                    .init(label: "Target", value: "100", active: false),
                    .init(label: "Target", value: "50", active: false),
                    .init(label: "Target", value: "3", active: false),
                ], color: ivyOrange)
                Text("Short on volume yesterday: Aalian K., Abdelmalik").font(.caption).foregroundStyle(ivyOrange)
            }
            myCardTile
            setterWeekTable
        }
    }

    private var setterWeekTable: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("Setters this week").font(.title3.bold()); Spacer(); Button("Performance") { onAction(.openSalesPerformance) }.font(.caption.bold()).foregroundStyle(.secondary) }
            SurfaceCard(padding: 6) {
                VStack(spacing: 0) {
                    EntityRow(name: "Haroon Quraishi", value: "6 sets", color: ivyPurple, subtitle: "83% show · 104 dials yest") { onAction(.openSalesPerformance) }
                    tileDivider
                    EntityRow(name: "Masood Ali", value: "5 sets", color: ivyPink, subtitle: "80% show · 96 dials yest") { onAction(.openSalesPerformance) }
                    tileDivider
                    EntityRow(name: "Aalian Khan", value: "4 sets", color: ivyBlue, subtitle: "100% show · no report yest") { onAction(.openSalesPerformance) }
                    tileDivider
                    EntityRow(name: "Abdelmalik", value: "3 sets", color: ivyMint, subtitle: "67% show · 41 DMs yest") { onAction(.openSalesPerformance) }
                }
            }
        }
    }
    #endif

    // MARK: Fulfillment picture (Faizan)

    #if DEBUG
    private var fulfillmentPicture: some View {
        VStack(alignment: .leading, spacing: 26) {
            pictureHeader("Fulfillment", title: "Delivery picture")
            // Delivery truth leads: a 2-col grid of the load-bearing numbers
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 14) {
                StatTile(label: "Active students", value: "47", symbol: "person.2.fill") { onAction(.openStudents) }
                StatTile(label: "At risk", value: "2", symbol: "heart.fill", valueColor: ivyRed) { onAction(.openStudentSuccess) }
                StatTile(label: "Checked in today", value: "9", symbol: "message.fill", valueColor: ivyTeal) { onAction(.openCSM) }
                StatTile(label: "Student EODs today", value: "31", symbol: "doc.text.fill") { onAction(.openStudentSuccess) }
                StatTile(label: "Stuck in onboarding", value: "3", symbol: "hourglass", valueColor: ivyOrange) { onAction(.openStudents) }
                StatTile(label: "Testimonials ready", value: "5", symbol: "sparkles", valueColor: ivyPurple) { onAction(.openTestimonials) }
            }
            // Phase mix as a Mochi breakdown bar
            BreakdownBar(
                title: "Phase mix",
                subtitle: "Active students by delivery phase",
                keptLabel: "Applying",
                keptValue: "15",
                segments: [
                    .init(label: "Onboarding", value: "8", percent: 17, color: ivyBlue),
                    .init(label: "Training", value: "19", percent: 40, color: ivyPurple),
                    .init(label: "Applying", value: "15", percent: 32, color: ivyTeal),
                    .init(label: "Offer won", value: "5", percent: 11, color: ivyMint),
                ]
            )
            csmTable
            latestNotes
        }
    }

    private var csmTable: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("CSM activity this week").font(.title3.bold()); Spacer(); Button("Open workspace") { onAction(.openCSM) }.font(.caption.bold()).foregroundStyle(.secondary) }
            SurfaceCard(padding: 6) {
                VStack(spacing: 0) {
                    EntityRow(name: "Faizan", value: "18 wk", color: ivyPurple, subtitle: "4 today · 6 looms · 9 notes") { onAction(.openCSM) }
                    tileDivider
                    EntityRow(name: "Sara", value: "14 wk", color: ivyPink, subtitle: "3 today · 4 looms · 7 notes") { onAction(.openCSM) }
                    tileDivider
                    EntityRow(name: "Maryam", value: "11 wk", color: ivyBlue, subtitle: "2 today · 2 looms · no notes") { onAction(.openCSM) }
                }
            }
        }
    }

    private var latestNotes: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Latest CSM notes").font(.headline)
            SurfaceCard {
                VStack(alignment: .leading, spacing: 14) {
                    noteRow("Faizan", on: "Amina H.", when: "2h ago", text: "Roleplay went well. Needs to tighten the close on the 1:1 pathway offer.")
                    Divider().overlay(Color.white.opacity(0.08))
                    noteRow("Sara", on: "Yusuf K.", when: "5h ago", text: "Follow-up booked for Thursday. Sent the onboarding checklist again.")
                    Divider().overlay(Color.white.opacity(0.08))
                    noteRow("Faizan", on: "Maryam A.", when: "Yesterday", text: "First interview landed. Testimonial ready once the offer is signed.")
                }
            }
        }
    }

    private func noteRow(_ csm: String, on student: String, when: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) { Text(csm).font(.caption.bold()); Text("on").font(.caption).foregroundStyle(.secondary); Text(student).font(.caption.bold()); Spacer(); Text(when).font(.caption2).foregroundStyle(.tertiary) }
            Text(text).font(.caption).foregroundStyle(.secondary).lineLimit(2)
        }
    }
    #endif

    // MARK: Leadership brief (default leader view)

    #if DEBUG
    private var leadershipPicture: some View {
        VStack(alignment: .leading, spacing: 26) {
            pictureHeader("Leadership", title: "Operating picture")
            HStack(spacing: 14) {
                StatTile(label: "Cash collected · Aug", value: "$18.4K", symbol: "banknote.fill", valueColor: ivyMint) { onAction(.openMoneyStrip) }
                StatTile(label: "Left to pay out", value: "$2.3K", symbol: "wallet.pass.fill") { onAction(.openPayouts) }
            }
            myCardTile
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 14) {
                StatTile(label: "Active students", value: "47", symbol: "person.2.fill") { onAction(.openLeadershipStudents) }
                StatTile(label: "Calls next 7 days", value: "11", symbol: "phone.fill", valueColor: ivyBlue) { onAction(.openLeadershipCalls) }
                StatTile(label: "Payments due · 3d", value: "6", symbol: "creditcard.fill", valueColor: ivyOrange) { onAction(.openLeadershipPayments) }
                StatTile(label: "Testimonials ready", value: "5", symbol: "graduationcap.fill", valueColor: ivyPurple) { onAction(.openLeadershipTestimonials) }
            }
        }
    }
    #endif

    // MARK: Personal (non-leader)

    #if DEBUG
    private var personalPicture: some View {
        VStack(alignment: .leading, spacing: 26) {
            pictureHeader("Personal", title: "Your day")
            // Hero: today's progress as the big Mochi number
            SurfaceCard(padding: 24) {
                VStack(spacing: 20) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("72%").font(.system(size: 64, weight: .medium, design: .rounded)).monospacedDigit().tracking(-2)
                        Spacer()
                        StatusPill(title: "Pending EOD", color: ivyOrange)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(ivyRaised).frame(height: 8)
                            Capsule().fill(Color.white).frame(width: geo.size.width * 0.72, height: 8)
                        }
                    }
                    .frame(height: 8)
                    Text("100 dials · 3 sets target").font(.subheadline).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                StatTile(label: "Dials", value: "72", symbol: "phone.fill")
                StatTile(label: "DMs", value: "18", symbol: "message.fill", valueColor: ivyPurple)
                StatTile(label: "Booked", value: "2", symbol: "calendar.badge.checkmark", valueColor: ivyMint)
            }
        }
    }
    #endif

    // MARK: Shared blocks

    #if DEBUG
    private var myCardTile: some View {
        Button { onAction(.openCards) } label: {
            SurfaceCard {
                HStack(spacing: 14) {
                    Image(systemName: "creditcard.fill").font(.system(size: 18, weight: .semibold)).foregroundStyle(.white).frame(width: 46, height: 46).background(ivyBlue, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("My card · kept in the business").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Text("$3,150").font(.system(size: 24, weight: .semibold, design: .rounded)).monospacedDigit()
                        Text("$5,000 loaded · $1,850 spent").font(.caption2).foregroundStyle(.tertiary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                }
            }
        }.buttonStyle(PressableButtonStyle())
    }

    private var commandQueueSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            myItemsBanner
            activityFeed
        }
    }

    /// Mochi "At Risk"-style compact banner: one wide, short, tappable card.
    private var myItemsBanner: some View {
        Button { onAction(.reviewOverdue) } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(ivyOrange).frame(width: 44, height: 44)
                    Image(systemName: "exclamationmark").font(.system(size: 18, weight: .bold)).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text("Your items").font(.headline).foregroundStyle(ivyOrange)
                    Text("2 assigned · oldest due yesterday").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                Text("2").font(.title3.bold()).monospacedDigit()
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 16).frame(minHeight: 72)
            .background(ivySurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
    }

    /// Mochi "Latest activity" full-width feed.
    private var activityFeed: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Latest activity").font(.title3.bold())
                Spacer()
                Button("See all") { onAction(.reviewOverdue) }.font(.caption.bold()).foregroundStyle(ivyTeal)
            }
            SurfaceCard(padding: 6) {
                VStack(spacing: 0) {
                    activityRow(avatar: "H", color: ivyPink, title: "@ahmed became a lead", sub: "Setter Haroon marked lead made contact", time: "1h")
                    feedDivider
                    activityRow(avatar: "Y", color: ivyPurple, title: "@yusuf is in contact", sub: "Lead replied to DM", time: "2h")
                    feedDivider
                    activityRow(avatar: "A", color: ivyBlue, title: "@amina was handed over", sub: "Originally assigned to Abdelmalik", time: "2h")
                    feedDivider
                    activityRow(avatar: "M", color: ivyMint, title: "@maryam booked a call", sub: "Set for tomorrow 4:00 PM", time: "3h")
                }
            }
        }
    }

    private func activityRow(avatar: String, color: Color, title: String, sub: String, time: String) -> some View {
        HStack(spacing: 12) {
            Circle().fill(color.opacity(0.9)).frame(width: 40, height: 40)
                .overlay(Text(avatar).font(.subheadline.bold()).foregroundStyle(.white))
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold)).lineLimit(1)
                Text(sub).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Text(time).font(.caption).foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 12).frame(minHeight: 60)
    }

    private var feedDivider: some View { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 64) }
    #endif

    #if DEBUG
    private func pictureHeader(_ kicker: String, title: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(kicker.uppercased()).font(.caption.bold()).tracking(1.2).foregroundStyle(.secondary)
            Text(title).font(.title2.bold())
        }
    }
    #endif

    private var tileDivider: some View { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 48) }

    private func sectionHeader(_ title: String, detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) { Text(title).font(.title3.bold()); Spacer(); Text(detail).font(.caption.weight(.medium)).foregroundStyle(.secondary) }
    }

    private var skeletonContent: some View {
        VStack(alignment: .leading, spacing: 30) {
            ForEach([168.0, 150.0, 104.0], id: \.self) { height in
                VStack(alignment: .leading, spacing: 12) {
                    HStack { RoundedRectangle(cornerRadius: 5).fill(ivyRaised).frame(width: 92, height: 20); Spacer(); RoundedRectangle(cornerRadius: 5).fill(ivyRaised).frame(width: 70, height: 14) }
                    SkeletonBlock(height: height)
                }
            }
        }
        .accessibilityLabel("Loading Home")
    }
}

// MARK: - Tiles

private struct HomeActionRow: View {
    let symbol: String
    let symbolColor: Color
    let title: String
    let detail: String
    let value: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: symbol).font(.system(size: 17, weight: .semibold)).foregroundStyle(symbolColor).frame(width: 34, height: 34).background(symbolColor.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 3) { Text(title).font(.headline); Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(2) }
                Spacer(minLength: 8)
                Text(value).font(.subheadline.bold()).monospacedDigit()
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
            }
            .frame(minHeight: 64).contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
    }
}

private extension HomePicture {
    var label: String {
        switch self {
        case .sales: "Sales"
        case .fulfillment: "Fulfillment"
        case .leadership: "Leadership"
        case .personal: "Personal"
        }
    }
}
