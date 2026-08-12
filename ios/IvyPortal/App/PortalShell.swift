import SwiftUI

#if DEBUG
enum DemoScenario: String, CaseIterable, Identifiable {
    case loaded, loading, empty, unavailable, failed
    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    static var launchScenario: DemoScenario {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "-demoScenario"), arguments.indices.contains(index + 1) else {
            return .loaded
        }
        return DemoScenario(rawValue: arguments[index + 1]) ?? .loaded
    }
}
#endif

struct PortalShell: View {
    private let roles: [PortalRole] = [.founder]
    @State private var selection: RootDestination = {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "-demoDestination"), arguments.indices.contains(index + 1) else {
            return .home
        }
        return RootDestination(rawValue: arguments[index + 1]) ?? .home
    }()
    @State private var detailPresented = ProcessInfo.processInfo.arguments.contains("-showKPIDetail")
    @State private var upcomingPresented = false
    #if DEBUG
    @State private var scenario = DemoScenario.launchScenario
    #endif

    private var destinations: [RootDestination] {
        RoleDestinationPolicy.destinations(for: roles)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()
            destinationContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .safeAreaPadding(.bottom, 88)
            floatingTabBar
        }
        .sheet(isPresented: $detailPresented) {
            KPIDetailSheet()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationBackground(ivySurface)
        }
        .sheet(isPresented: $upcomingPresented) {
            UpcomingEventSheet()
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
                .presentationBackground(ivySurface)
        }
        .tint(.white)
    }

    @ViewBuilder private var destinationContent: some View {
        switch selection {
        case .home:
            #if DEBUG
            HomeView(scenario: $scenario, onAction: handleHomeAction)
            #else
            HomeView(onAction: handleHomeAction)
            #endif
        case .work: WorkView()
        case .performance: PerformanceView(showDetail: { detailPresented = true })
        case .customers: CustomersView()
        case .more: MoreView(entries: RoleDestinationPolicy.moreEntries(for: roles))
        }
    }

    private func handleHomeAction(_ action: HomeAction) {
        if let destination = action.destination {
            withAnimation(.snappy(duration: 0.24)) { selection = destination }
        } else if action.detail == .upcomingEvent {
            upcomingPresented = true
        }
    }

    private var floatingTabBar: some View {
        HStack(spacing: 2) {
            ForEach(destinations, id: \.self) { destination in
                Button {
                    withAnimation(.snappy(duration: 0.24)) { selection = destination }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: destination.symbol)
                            .font(.system(size: 17, weight: .semibold))
                        Text(destination.shortTitle)
                            .font(.caption2.weight(.semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(selection == destination ? .white : .secondary)
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background(selection == destination ? Color.white.opacity(0.1) : .clear, in: Capsule())
                    .contentShape(Capsule())
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel(destination.shortTitle)
            }
        }
        .padding(6)
        .frame(maxWidth: 390)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.13), lineWidth: 1))
        .padding(.horizontal, 20)
        .padding(.bottom, 10)
    }
}

private struct UpcomingEventSheet: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Text("Founder review").font(.title2.bold())
                Spacer()
                Button("Done") { dismiss() }.frame(minHeight: 48)
            }
            Label("Today · 5:00 PM to 5:45 PM", systemImage: "clock.fill")
            Label("Riyadh", systemImage: "location.fill")
            Label("Review weekly performance and open actions", systemImage: "text.bubble.fill")
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(24)
    }
}

private extension RootDestination {
    var shortTitle: String {
        switch self {
        case .home: "Home"
        case .work: "Work"
        case .performance: "Pulse"
        case .customers: "Clients"
        case .more: "More"
        }
    }

    var symbol: String {
        switch self {
        case .home: "square.grid.2x2.fill"
        case .work: "checklist"
        case .performance: "chart.xyaxis.line"
        case .customers: "person.2.fill"
        case .more: "ellipsis"
        }
    }
}

struct PressableButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.82 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.09), value: configuration.isPressed)
    }
}
