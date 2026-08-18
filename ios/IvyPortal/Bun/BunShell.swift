import SwiftUI

/// Five tabs (founder 2026-08-18). Studio was two jobs behind a segment and
/// team coverage was buried in a Home sheet, so both of the surfaces the
/// founder reads daily were several taps down. Split so each tab does one
/// thing: Team owns coverage + performance, Clients owns the client book.
enum BunTab: String, CaseIterable {
    case home, money, team, clients, banking

    /// SF Symbol name, or nil where the glyph is drawn (see BunIcons).
    /// Founder 2026-08-18: Money takes Mercury's transfers arrows, Team takes
    /// the list, Clients takes the two-person glyph.
    var symbol: String? {
        switch self {
        case .home, .money, .team, .banking: nil
        case .clients: "person.2"
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
        // Matte, not glass. Liquid Glass put a specular sheen on the bar and
        // let page content bleed through it; the reference is a flat, opaque
        // capsule with a hairline rim (founder: "why is our navbar so shiny").
        .background {
            Capsule()
                .fill(BunTheme.barBg)
                .overlay(Capsule().strokeBorder(BunTheme.barStroke, lineWidth: 1))
        }
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
            case .home: BunHouseIcon(size: 20.8)
            case .money: BunTransferIcon(size: 18.3)
            case .team: BunListIcon(size: 18.2)
            case .banking: BunBankIcon(size: 19.6)
            case .clients:
                // SF's person.2 sits ~0.5pt proud of the drawn glyphs.
                Image(systemName: item.symbol ?? "circle")
                    .font(.system(size: 18, weight: .regular))
                    .offset(y: 0.5)
            }
        }
        .frame(width: 26, height: 26)
    }
}
