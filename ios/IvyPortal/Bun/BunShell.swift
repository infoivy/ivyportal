import SwiftUI

/// Five tabs (founder 2026-08-18). Studio was two jobs behind a segment and
/// team coverage was buried in a Home sheet, so both of the surfaces the
/// founder reads daily were several taps down. Split so each tab does one
/// thing: Team owns coverage + performance, Clients owns the client book.
enum BunTab: String, CaseIterable {
    case home, money, team, clients, banking

    /// SF Symbol name, or nil where the reference glyph is drawn (see
    /// BunIcons): the house and the list are traced from Mercury.
    var symbol: String? {
        switch self {
        case .home: nil
        case .money: nil
        case .team: "person.2"
        case .clients: "person.3"
        case .banking: "building.columns"
        }
    }
    var title: String {
        switch self {
        case .home: "Home"
        case .money: "Money"
        case .team: "Team"
        case .clients: "Clients"
        case .banking: "Banking"
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
        .task { store.seedFixturesIfNeeded() }
        .onChange(of: store.signedIn) { _, signedIn in
            if !signedIn { store.resetToFixtures() }
        }
    }

    @ViewBuilder private var content: some View {
        switch tab {
        case .home: BunHome(tab: $tab)
        case .money: BunMoneyPage()
        case .team: BunTeamPage()
        case .clients: BunClientsPage()
        case .banking: BunBanking(tab: $tab)
        }
    }

    // Bar metrics measured off the reference at @3x: capsule 360x58pt with
    // 21pt side margins, five ~69pt cells, and an active pill 77x50 that is
    // wider than its cell and inset from the bar's top and bottom. Icons sit
    // at 20pt, not 22.
    private var bar: some View {
        HStack(spacing: 0) {
            ForEach(BunTab.allCases, id: \.self) { item in
                // Plain tap gesture, not Button: the bar floats over live
                // ScrollViews and UIKit's scroll touch delays can swallow
                // rapid Button taps (observed as flaky switches).
                glyph(item)
                    .foregroundStyle(tab == item ? BunTheme.barIconActive : BunTheme.barIcon)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background {
                        if tab == item {
                            Capsule().fill(BunTheme.barActive)
                                .frame(width: 77, height: 50)
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
        .bunGlassSurface(Capsule(), tint: BunTheme.barBg, interactive: false)
        .padding(.horizontal, 21)
    }

    @ViewBuilder private func glyph(_ item: BunTab) -> some View {
        switch item {
        case .home: BunHouseIcon(size: 21)
        case .money: BunListIcon(size: 19)
        default:
            Image(systemName: item.symbol ?? "circle")
                .font(.system(size: 20, weight: .regular))
        }
    }
}
