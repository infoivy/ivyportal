import SwiftUI

/// Five tabs (founder 2026-08-18, second pass). Banking folded into Money —
/// accounts, cards and the wallet are the same money as the payments above
/// them — and the freed slot became Work, the person's own daily queue with
/// room for the surfaces still coming over from the web portal.
enum BunTab: String, CaseIterable {
    case home, money, team, clients, work

    /// SF Symbol name, or nil where the glyph is drawn (see BunIcons).
    /// Founder 2026-08-18: Money carries the bank glyph now that it holds the
    /// accounts and cards, Team takes the list, Clients the two-person glyph.
    var symbol: String? {
        switch self {
        case .home, .money, .team: nil
        case .clients: "person.2"
        case .work: "checkmark.circle"
        }
    }
    var title: String {
        switch self {
        case .home: "Home"
        case .money: "Money"
        case .team: "Team"
        case .clients: "Clients"
        case .work: "Work"
        }
    }
}

/// The Bun shell: near-black ground + the Mercury floating capsule bar —
/// five thin icons, the active one inside a raised pill (reference exact).
struct BunShell: View {
    @State private var tab: BunTab = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-bunTab"), args.indices.contains(i + 1),
              let t = BunTab(rawValue: args[i + 1]) else { return .home }
        return t
    }()
    @Namespace private var barNamespace
    @State private var store = BunStore.shared
    /// Screenshot/UI-test presets:
    /// `-bunSheet actions|eod|logClose|client|logCall|moneyIn|plans|payouts`
    /// opens one surface straight from launch, the same trick the older shell
    /// used for the payments sheet.
    @State private var launchSheet: String?

    private static var launchSheetArg: String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-bunSheet"), args.indices.contains(i + 1) else { return nil }
        return args[i + 1]
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            BunTheme.ground.ignoresSafeArea()
            // Instant content swap (Mercury does not crossfade tabs); the
            // animated matchedGeometry pill carries the motion. A .id +
            // .transition swap here proved flaky under rapid re-taps.
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .safeAreaPadding(.bottom, 84)
            bar
        }
        .sensoryFeedback(.selection, trigger: tab)
        .sheet(item: $launchSheet) { kind in
            launchSheetView(kind)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .task {
            store.seedFixturesIfNeeded()
            // Present after the first frame: a sheet asked for during the
            // very first render is dropped.
            if let kind = Self.launchSheetArg, launchSheet == nil {
                try? await Task.sleep(for: .milliseconds(400))
                launchSheet = kind
            }
        }
        .onChange(of: store.signedIn) { _, signedIn in
            if !signedIn { store.resetToFixtures() }
        }
    }

    @ViewBuilder private func launchSheetView(_ kind: String) -> some View {
        switch kind {
        case "actions": BunActionItemsSheet()
        case "eod": BunEODFlow()
        case "logClose": BunLogCloseFlow()
        case "moneyIn": BunMoneyInSheet()
        case "plans": BunPaymentPlansSheet()
        case "payouts": BunPayoutLedgerSheet()
        case "csm": BunCSMSheet()
        case "client", "logCall":
            if let student = store.prioritizedRoster.first(where: \.isOneOnOne) {
                if kind == "client" { BunClientSheet(student: student) }
                else { BunLogCallFlow(student: student) }
            }
        default: EmptyView()
        }
    }

    @ViewBuilder private var content: some View {
        switch tab {
        case .home: BunHome(tab: $tab)
        case .money: BunMoneyPage()
        case .team: BunTeamPage()
        case .clients: BunClientsPage()
        case .work: BunWorkPage()
        }
    }

    // Bar metrics re-measured on a reference screen with an EMPTY area behind
    // the bar (Cards), because on a busy screen the glass blurs page content
    // into the edges and inflates the read. Clean values at @3x:
    //   bar   y 2373..2558 -> 62pt tall, x 63..1142 -> 360pt (21pt margins)
    //   pill  y 2385..2546 -> 54pt tall, 77pt wide, so 4pt inset top/bottom
    //   fills bar #141416, pill #353538
    // The earlier 58/50 came from the contaminated read.
    private var bar: some View {
        HStack(spacing: 0) {
            ForEach(BunTab.allCases, id: \.self) { item in
                // Plain tap gesture, not Button: the bar floats over live
                // ScrollViews and UIKit's scroll touch delays can swallow
                // rapid Button taps (observed as flaky switches).
                glyph(item)
                    .foregroundStyle(tab == item ? BunTheme.barIconActive : BunTheme.barIcon)
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background {
                        if tab == item {
                            Capsule().fill(BunTheme.barActive)
                                .frame(width: 77, height: 54)
                                .matchedGeometryEffect(id: "activeBunTab", in: barNamespace)
                        }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        withAnimation(.snappy(duration: 0.25)) { tab = item }
                    }
                    .accessibilityAddTraits(.isButton)
                    .accessibilityLabel(item.title)
                    .accessibilityIdentifier("tab-\(item.rawValue)")
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 8)
        // Real Liquid Glass, not a painted imitation. The reference has it too
        // — the uneven rim the founder spotted (faded at bottom-left and top
        // right) is the specular highlight tracking the device's gyroscope, so
        // a static gradient would be wrong the moment the phone tilts.
        //
        // NOTE: that highlight does NOT render correctly in the Simulator, so
        // simulator screenshots cannot be used to judge this; it needs a device
        // or TestFlight build.
        //
        // The tint carries the measured #141416 so the glass reads as the
        // reference's near-opaque surface rather than the strong sheen we had.
        .bunGlassSurface(Capsule(), tint: BunTheme.barBg, interactive: false)
        .padding(.horizontal, 21)
    }

    /// Every glyph sits in the same box with its ink centred, so the row
    /// shares one optical centre line.
    @ViewBuilder private func glyph(_ item: BunTab) -> some View {
        // Sizes tuned so each glyph's INK height matches the reference
        // (house 57px, transfers 55, list 47, bank 57 at @3x), not so their
        // boxes match — box-matching is what left them different sizes.
        Group {
            switch item {
            case .home: BunHouseIcon(size: 21.5)
            case .money: BunBankIcon(size: 19.6)
            case .team: BunListIcon(size: 18.2)
            case .clients, .work:
                // SF's glyphs sit ~0.5pt proud of the drawn ones.
                Image(systemName: item.symbol ?? "circle")
                    .font(.system(size: 18, weight: .regular))
                    .offset(y: 0.5)
            }
        }
        .frame(width: 26, height: 26)
    }
}
