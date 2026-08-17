import SwiftUI

enum BunTab: String, CaseIterable {
    case home, money, people, banking

    var symbol: String {
        switch self {
        case .home: "house"
        case .money: "arrow.left.arrow.right"
        case .people: "person.2"
        case .banking: "building.columns"
        }
    }
    var title: String {
        switch self {
        case .home: "Home"
        case .money: "Money"
        case .people: "Studio"
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
        case .people: BunStudioPage()
        case .banking: BunBanking(tab: $tab)
        }
    }

    private var bar: some View {
        HStack(spacing: 0) {
            ForEach(BunTab.allCases, id: \.self) { item in
                // Plain tap gesture, not Button: the bar floats over live
                // ScrollViews and UIKit's scroll touch delays can swallow
                // rapid Button taps (observed as flaky switches).
                Image(systemName: item.symbol)
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(tab == item ? BunTheme.indigoLight : BunTheme.secondary)
                    .frame(maxWidth: .infinity, minHeight: 58)
                    .background {
                        if tab == item {
                            Capsule().fill(BunTheme.barActive)
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
        .padding(6)
        .bunGlassSurface(Capsule(), tint: BunTheme.barBg, interactive: false)
        .padding(.horizontal, 12)
    }
}
