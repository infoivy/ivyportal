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
                #if DEBUG
                picturePicker
                #endif
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
    /// Preview each Home picture without an account (matches the portal's
    /// grantable view roles). Only in DEBUG.
    private var picturePicker: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(HomePicture.allCases, id: \.self) { picture in
                    Button(picture.label) { withAnimation(.snappy(duration: 0.24)) { debugPicture = picture } }
                        .font(.caption.bold()).padding(.horizontal, 14).frame(minHeight: 34)
                        .background(debugPicture == picture ? Color.white.opacity(0.2) : ivySurface, in: Capsule())
                        .foregroundStyle(debugPicture == picture ? .white : .secondary)
                }
            }
            .padding(.trailing, 20)
        }
        .scrollIndicators(.hidden)
        .accessibilityLabel("Preview Home by role")
    }
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
                upcomingSection
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
        myItemsSection
        commandQueueSection
        Text("Debug fixture · Preview as \(debugPicture.label). Tap any tile.")
            .font(.caption).foregroundStyle(.tertiary)
    }
    #endif

    // MARK: Sales picture (Abu Bilal)

    #if DEBUG
    private var salesPicture: some View {
        VStack(alignment: .leading, spacing: 12) {
            pictureHeader("Sales", title: "Today's picture")
            moneyStrip
            cardTile
            SurfaceCard(padding: 0) {
                VStack(spacing: 0) {
                    SalesTile(icon: "calendar.badge.checkmark", label: "Sets this week", detail: "3 booked for today", value: "18", tone: .neutral) { onAction(.openSalesCalendar) }
                    tileDivider
                    SalesTile(icon: "eye.fill", label: "Show rate this week", detail: "12 showed · 3 did not show", value: "80%", tone: .neutral) { onAction(.openSalesCalendar) }
                    tileDivider
                    SalesTile(icon: "phone.fill", label: "Volume yesterday", detail: "96 dials of 100 · 41 DMs of 50 · 5 sets of 3", value: "2 short", tone: .warning) { onAction(.openSalesPerformance) }
                    tileDivider
                    SalesTile(icon: "banknote.fill", label: "Cash collected this week", detail: "$4.2K upfront · $1.8K installments", value: "$6.0K", tone: .neutral) { onAction(.openSalesRevenue) }
                    tileDivider
                    SalesTile(icon: "hand.coins.fill", label: "Closes this period", detail: "Aug 11 – Sep 11", value: "7", tone: .neutral) { onAction(.openSalesRevenue) }
                    tileDivider
                    SalesTile(icon: "target", label: "Pipeline in Close", detail: "Active leads being worked", value: "23", tone: .neutral) { onAction(.openSalesCRM) }
                    tileDivider
                    SalesTile(icon: "person.fill.questionmark", label: "Unclaimed sets", detail: "Booked calls waiting for an owner", value: "2", tone: .warning) { onAction(.openSalesCalendar) }
                }
            }
            setterWeekTable
        }
    }

    private var setterWeekTable: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { Text("Setters this week").font(.headline); Spacer(); Button("Performance") { onAction(.openSalesPerformance) }.font(.caption.bold()).foregroundStyle(.secondary) }
            SurfaceCard(padding: 0) {
                VStack(spacing: 0) {
                    setterRow("Haroon Q.", sets: 6, showed: 5, noShow: 1, rate: "83%", yesterday: "104 dials · 3 sets", short: false)
                    tileDivider
                    setterRow("Masood A.", sets: 5, showed: 4, noShow: 1, rate: "80%", yesterday: "96 dials · 2 sets", short: false)
                    tileDivider
                    setterRow("Aalian K.", sets: 4, showed: 3, noShow: 0, rate: "100%", yesterday: "no report", short: true)
                    tileDivider
                    setterRow("Abdelmalik", sets: 3, showed: 2, noShow: 1, rate: "67%", yesterday: "41 DMs · 1 set", short: true)
                }
            }
            Text("Short on volume yesterday: Aalian K., Abdelmalik").font(.caption).foregroundStyle(.orange)
        }
    }

    private func setterRow(_ name: String, sets: Int, showed: Int, noShow: Int, rate: String, yesterday: String, short: Bool) -> some View {
        HStack(spacing: 10) {
            Text(name).font(.subheadline.weight(.medium)).frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 1) { Text("\(sets)").font(.subheadline.bold()).monospacedDigit(); Text("sets").font(.system(size: 9)).foregroundStyle(.secondary) }.frame(width: 34)
            VStack(alignment: .trailing, spacing: 1) { Text(rate).font(.subheadline.bold()).monospacedDigit(); Text("show").font(.system(size: 9)).foregroundStyle(.secondary) }.frame(width: 40)
            Text(yesterday).font(.caption2).foregroundStyle(short ? .orange : .secondary).frame(width: 92, alignment: .trailing).lineLimit(2).multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 16).frame(minHeight: 52)
    }
    #endif

    // MARK: Fulfillment picture (Faizan)

    #if DEBUG
    private var fulfillmentPicture: some View {
        VStack(alignment: .leading, spacing: 12) {
            pictureHeader("Fulfillment", title: "Delivery picture")
            SurfaceCard(padding: 0) {
                VStack(spacing: 0) {
                    FulfillTile(icon: "person.2.fill", label: "Active students", detail: "4 joined this week", value: "47") { onAction(.openStudents) }
                    tileDivider
                    FulfillTile(icon: "heart.fill", label: "At risk", detail: "3 more to watch", value: "2", tone: .danger) { onAction(.openStudentSuccess) }
                    tileDivider
                    FulfillTile(icon: "message.fill", label: "Checked in today", detail: "5 due a check-in (2+ days)", value: "9", tone: .warning) { onAction(.openCSM) }
                    tileDivider
                    FulfillTile(icon: "doc.text.fill", label: "Student EODs today", detail: "6 quiet for 14+ days", value: "31") { onAction(.openStudentSuccess) }
                    tileDivider
                    FulfillTile(icon: "hourglass", label: "Stuck in onboarding", detail: "7+ days without finishing Start Here", value: "3", tone: .warning) { onAction(.openStudents) }
                    tileDivider
                    FulfillTile(icon: "checklist", label: "Action items open", detail: "4 overdue", value: "12", tone: .warning) { onAction(.reviewOverdue) }
                    tileDivider
                    FulfillTile(icon: "sparkles", label: "Testimonials ready", detail: "First win recorded, not collected", value: "5") { onAction(.openTestimonials) }
                    tileDivider
                    FulfillTile(icon: "phone.fill", label: "1-on-1 calls next 7 days", detail: "Scheduled coaching and support", value: "11") { onAction(.openCalls) }
                }
            }
            Text("Onboarding 8 · Training 19 · Applying 15 · Offer won 5").font(.caption).foregroundStyle(.secondary)
            csmTable
            latestNotes
        }
    }

    private var csmTable: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { Text("CSM activity this week").font(.headline); Spacer(); Button("Open workspace") { onAction(.openCSM) }.font(.caption.bold()).foregroundStyle(.secondary) }
            SurfaceCard(padding: 0) {
                VStack(spacing: 0) {
                    csmRow("Faizan", today: 4, week: 18, looms: 6, roleplays: 3, notes: 9, escalations: 1)
                    tileDivider
                    csmRow("Sara", today: 3, week: 14, looms: 4, roleplays: 5, notes: 7, escalations: 0)
                    tileDivider
                    csmRow("Maryam", today: 2, week: 11, looms: 2, roleplays: 2, notes: 0, escalations: 2)
                }
            }
        }
    }

    private func csmRow(_ name: String, today: Int, week: Int, looms: Int, roleplays: Int, notes: Int, escalations: Int) -> some View {
        HStack(spacing: 8) {
            Text(name).font(.subheadline.weight(.medium)).frame(maxWidth: .infinity, alignment: .leading)
            csmStat("\(today)", "today")
            csmStat("\(week)", "week")
            csmStat("\(looms)", "looms")
            csmStat("\(notes)", "notes", warn: notes == 0)
        }
        .padding(.horizontal, 16).frame(minHeight: 50)
    }

    private func csmStat(_ value: String, _ label: String, warn: Bool = false) -> some View {
        VStack(alignment: .trailing, spacing: 1) { Text(value).font(.subheadline.bold()).monospacedDigit().foregroundStyle(warn ? .orange : .primary); Text(label).font(.system(size: 9)).foregroundStyle(.secondary) }.frame(width: 40)
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
        VStack(alignment: .leading, spacing: 12) {
            pictureHeader("Leadership", title: "Operating picture")
            moneyStrip
            cardTile
            SurfaceCard(padding: 0) {
                VStack(spacing: 0) {
                    FulfillTile(icon: "person.2.fill", label: "Active students", detail: "Current delivery roster", value: "47") { onAction(.openLeadershipStudents) }
                    tileDivider
                    FulfillTile(icon: "phone.fill", label: "Calls next 7 days", detail: "Scheduled coaching and support", value: "11") { onAction(.openLeadershipCalls) }
                    tileDivider
                    FulfillTile(icon: "creditcard.fill", label: "Payments due next 3 days", detail: "Upcoming installment follow-up", value: "6") { onAction(.openLeadershipPayments) }
                    tileDivider
                    FulfillTile(icon: "graduationcap.fill", label: "Testimonials ready", detail: "First win recorded, not collected", value: "5") { onAction(.openLeadershipTestimonials) }
                }
            }
        }
    }
    #endif

    // MARK: Personal (non-leader)

    #if DEBUG
    private var personalPicture: some View {
        VStack(alignment: .leading, spacing: 12) {
            pictureHeader("Personal", title: "Your day")
            SurfaceCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 4) { Text("72%").font(.system(size: 34, weight: .bold, design: .rounded)).monospacedDigit(); Text("100 dials · 3 sets target").font(.caption).foregroundStyle(.secondary) }
                        Spacer()
                        StatusPill(title: "Pending EOD", color: .orange)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(ivyRaised).frame(height: 6)
                            Capsule().fill(Color.white).frame(width: geo.size.width * 0.72, height: 6)
                        }
                    }
                    .frame(height: 6)
                    HStack(spacing: 0) {
                        miniMetric("Dials", "72"); Spacer(); miniMetric("DMs", "18"); Spacer(); miniMetric("Booked", "2")
                    }
                    .padding(.top, 4)
                }
            }
        }
    }

    private func miniMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(value).font(.headline).monospacedDigit(); Text(label).font(.caption2).foregroundStyle(.secondary) }
    }
    #endif

    // MARK: Shared blocks

    #if DEBUG
    private var moneyStrip: some View {
        HStack(spacing: 12) {
            Button { onAction(.openMoneyStrip) } label: {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Cash collected · Aug", systemImage: "hand.coins.fill").font(.caption2.bold()).foregroundStyle(.secondary)
                        Text("$18.4K").font(.system(size: 24, weight: .semibold, design: .rounded)).monospacedDigit()
                        Text("Whop net, after fees").font(.caption2).foregroundStyle(.tertiary)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
            }.buttonStyle(PressableButtonStyle())
            Button { onAction(.openPayouts) } label: {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Left to pay out", systemImage: "wallet.pass.fill").font(.caption2.bold()).foregroundStyle(.secondary)
                        Text("$2.3K").font(.system(size: 24, weight: .semibold, design: .rounded)).monospacedDigit()
                        Text("$5.9K already confirmed paid").font(.caption2).foregroundStyle(.tertiary)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
            }.buttonStyle(PressableButtonStyle())
        }
    }

    private var cardTile: some View {
        Button { onAction(.openCards) } label: {
            SurfaceCard {
                HStack(spacing: 14) {
                    Image(systemName: "creditcard.fill").font(.system(size: 18, weight: .semibold)).foregroundStyle(.white).frame(width: 40, height: 40).background(ivyRaised, in: RoundedRectangle(cornerRadius: 12))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("My card · kept in the business").font(.caption2.bold()).foregroundStyle(.secondary)
                        Text("$3,150").font(.system(size: 22, weight: .semibold, design: .rounded)).monospacedDigit()
                        Text("$5,000 loaded · $1,850 spent").font(.caption2).foregroundStyle(.tertiary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                }
            }
        }.buttonStyle(PressableButtonStyle())
    }

    private var myItemsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("Your action items").font(.title3.bold()); Spacer(); Button("All items") { onAction(.reviewOverdue) }.font(.caption.bold()).foregroundStyle(.secondary) }
            SurfaceCard {
                VStack(spacing: 0) {
                    myItem("Send updated onboarding plan", sub: "Amina H. · overdue", done: false)
                    Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 36)
                    myItem("Review roleplay recording", sub: "Yusuf K. · due today", done: false)
                }
            }
        }
    }

    private func myItem(_ title: String, sub: String, done: Bool) -> some View {
        HStack(spacing: 12) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle").foregroundStyle(done ? ivyGreen : .secondary).font(.title3)
            VStack(alignment: .leading, spacing: 3) { Text(title).font(.subheadline.weight(.medium)); Text(sub).font(.caption).foregroundStyle(.secondary) }
            Spacer()
        }.frame(minHeight: 50).contentShape(Rectangle())
    }

    private var commandQueueSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Next actions", detail: "Today")
            SurfaceCard {
                VStack(spacing: 0) {
                    HomeActionRow(symbol: "exclamationmark.circle.fill", symbolColor: .orange, title: "Review overdue items", detail: "2 assigned to you · oldest due yesterday", value: "2") { onAction(.reviewOverdue) }
                    Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 48)
                    HomeActionRow(symbol: "person.3.fill", symbolColor: .white, title: "Check team reporting", detail: "36 of 42 EODs submitted", value: "86%") { onAction(.reviewCoverage) }
                }
            }
            upcomingSection
        }
    }
    #endif

    private var upcomingSection: some View {
        Button { onAction(.openUpcoming) } label: {
            SurfaceCard {
                HStack(spacing: 14) {
                    VStack(spacing: 2) { Text("5:00").font(.headline).monospacedDigit(); Text("PM").font(.caption2.weight(.semibold)).foregroundStyle(.secondary) }
                        .frame(width: 48, height: 48).background(ivyRaised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) { Text("Founder review").font(.headline); Text("Riyadh · 45 minutes").font(.subheadline).foregroundStyle(.secondary) }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityHint("Opens meeting details")
    }

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

private struct SalesTile: View {
    enum Tone { case neutral, warning, danger }
    let icon, label, detail, value: String
    let tone: Tone
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.system(size: 15, weight: .semibold)).foregroundStyle(.secondary).frame(width: 32, height: 32).background(ivyRaised, in: RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 3) { Text(label).font(.subheadline.weight(.medium)); Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                Spacer(minLength: 8)
                Text(value).font(.title3.bold()).monospacedDigit().foregroundStyle(tone == .danger ? .red : tone == .warning ? .orange : .primary)
                Image(systemName: "chevron.right").font(.caption2.bold()).foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 16).frame(minHeight: 64).contentShape(Rectangle())
        }.buttonStyle(PressableButtonStyle())
    }
}

private struct FulfillTile: View {
    enum Tone { case neutral, warning, danger }
    let icon, label, detail, value: String
    var tone: Tone = .neutral
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary).frame(width: 30, height: 30).background(ivyRaised, in: RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 3) { Text(label).font(.subheadline.weight(.medium)); Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                Spacer(minLength: 8)
                Text(value).font(.headline).monospacedDigit().foregroundStyle(tone == .danger ? .red : tone == .warning ? .orange : .primary)
                Image(systemName: "chevron.right").font(.caption2.bold()).foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 16).frame(minHeight: 58).contentShape(Rectangle())
        }.buttonStyle(PressableButtonStyle())
    }
}

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
