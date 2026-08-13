import SwiftUI

#if DEBUG
enum DemoScenario: String, CaseIterable, Identifiable {
    case loaded, loading, empty, unavailable, failed
    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    static var launchScenario: DemoScenario {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "-demoScenario"), arguments.indices.contains(index + 1) else { return .loaded }
        return DemoScenario(rawValue: arguments[index + 1]) ?? .loaded
    }
}
#endif

private enum PortalSurface: Equatable {
    case root(RootDestination)
    case payments
}

struct PortalShell: View {
    private let roles: [PortalRole] = [.founder]
    @State private var surface: PortalSurface = {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "-demoDestination"), arguments.indices.contains(index + 1) else {
            return .root(.home)
        }
        let value = arguments[index + 1]
        if value == "payments" { return .payments }
        return .root(RootDestination(rawValue: value) ?? .home)
    }()
    @State private var menuPresented = false
    @State private var performanceMetric: PerformanceMetric?
    @State private var upcomingPresented = false
    @State private var workTab: WorkTab = .actionItems
    #if DEBUG
    @State private var scenario = DemoScenario.launchScenario
    #endif

    private var rootSelection: RootDestination {
        if case let .root(destination) = surface { destination } else { .work }
    }

    private var destinations: [RootDestination] { RoleDestinationPolicy.destinations(for: roles) }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()
            destinationContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .safeAreaPadding(.bottom, 88)
                .environment(\.openPortalMenu) { menuPresented = true }
            floatingTabBar
        }
        .sheet(isPresented: $menuPresented) {
            PortalMenuSheet(
                features: FeatureNavigationPolicy.menuFeatures(for: roles),
                selected: selectedFeature,
                select: selectFeature
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.hidden)
            .presentationBackground(.clear)
            .presentationCornerRadius(28)
        }
        .sheet(item: $performanceMetric) { metric in
            PerformanceDetailSheet(metric: metric)
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

    private var selectedFeature: PortalFeature {
        switch surface {
        case .payments: .payments
        case .root(.performance): .performance
        default: .overview
        }
    }

    @ViewBuilder private var destinationContent: some View {
        switch surface {
        case .payments:
            PaymentsView()
        case let .root(selection):
            switch selection {
            case .home:
                #if DEBUG
                HomeView(scenario: $scenario, onAction: handleHomeAction)
                #else
                HomeView(onAction: handleHomeAction)
                #endif
            case .work:
                WorkHubView(tab: $workTab, onOpenPulse: { source in
                    surface = .root(.performance)
                    performanceMetric = source == .close ? .bookedCalls : .totalMessages
                })
            case .performance: PerformanceView(showDetail: { performanceMetric = $0 })
            case .customers: CustomersView()
            case .more: MoreView(entries: RoleDestinationPolicy.moreEntries(for: roles))
            }
        }
    }

    private func selectFeature(_ feature: PortalFeature) {
        withAnimation(.snappy(duration: 0.24)) {
            if let root = feature.rootDestination { surface = .root(root) } else { surface = .payments }
            menuPresented = false
        }
    }

    private func handleHomeAction(_ action: HomeAction) {
        if action == .openPayments {
            withAnimation(.snappy(duration: 0.24)) { surface = .payments }
        } else if let destination = action.destination {
            withAnimation(.snappy(duration: 0.24)) { surface = .root(destination) }
        } else if action.detail == .upcomingEvent {
            upcomingPresented = true
        }
    }

    private var floatingTabBar: some View {
        HStack(spacing: 2) {
            ForEach(destinations, id: \.self) { destination in
                Button {
                    withAnimation(.snappy(duration: 0.24)) { surface = .root(destination) }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: destination.symbol).font(.system(size: 16, weight: .semibold))
                        Text(destination.shortTitle).font(.caption2.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
                    }
                    .foregroundStyle(surface == .root(destination) ? .white : .secondary)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(surface == .root(destination) ? Color.white.opacity(0.1) : .clear, in: Capsule())
                    .contentShape(Capsule())
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel(destination.shortTitle)
            }
        }
        .padding(6)
        .frame(maxWidth: 370)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.16), lineWidth: 1))
        .padding(.horizontal, 20)
        .padding(.bottom, 10)
    }
}

private struct PortalMenuSheet: View {
    @Environment(\.dismiss) private var dismiss
    let features: [PortalFeature]
    let selected: PortalFeature
    let select: (PortalFeature) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Text("Home").font(.largeTitle.bold())
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.subheadline.bold()).frame(width: 40, height: 40).background(ivySurface, in: Circle())
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel("Close navigation")
            }
            VStack(spacing: 2) {
                ForEach(features, id: \.self) { feature in
                    Button { select(feature) } label: {
                        HStack(spacing: 16) {
                            Image(systemName: feature.symbol).font(.system(size: 17, weight: .semibold)).frame(width: 40, height: 40)
                                .background(selected == feature ? Color.white.opacity(0.14) : ivySurface, in: Circle())
                                .foregroundStyle(selected == feature ? .white : .secondary)
                            Text(feature.title).font(.body.weight(selected == feature ? .semibold : .regular))
                                .foregroundStyle(selected == feature ? .white : .secondary)
                            Spacer()
                            if selected == feature { Image(systemName: "checkmark").font(.caption.bold()) }
                        }
                        .padding(.horizontal, 16).frame(minHeight: 60)
                        .background(selected == feature ? Color.white.opacity(0.06) : .clear, in: RoundedRectangle(cornerRadius: 16))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 24).padding(.bottom, 8)
        .background(Color.black.ignoresSafeArea())
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
            Label("Review weekly performance and open actions", systemImage: "text.bubble.fill").foregroundStyle(.secondary)
            Spacer()
        }
        .padding(24)
    }
}

private extension PortalFeature {
    var title: String {
        switch self {
        case .overview: "Overview"
        case .performance: "Performance"
        case .payments: "Money"
        case .work: "Work"
        case .students: "Students"
        }
    }
    var subtitle: String {
        switch self {
        case .overview: "Priorities and funnel health"
        case .performance: "Team activity and accountability"
        case .payments: "Revenue, matching, and costs"
        case .work: "EOD, actions, calendar, and CRM"
        case .students: "Students, CSM, and coaching"
        }
    }
    var symbol: String {
        switch self {
        case .overview: "square.grid.2x2.fill"
        case .performance: "chart.pie.fill"
        case .payments: "dollarsign.circle.fill"
        case .work: "checklist"
        case .students: "graduationcap.fill"
        }
    }
}

private extension RootDestination {
    var shortTitle: String {
        switch self { case .home: "Home"; case .work: "Work"; case .performance: "Performance"; case .customers: "Clients"; case .more: "More" }
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
