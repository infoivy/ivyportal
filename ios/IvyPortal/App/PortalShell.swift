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

private enum PortalSurface: Hashable {
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
    @State private var homePicture: HomePicture = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-homePicture"), args.indices.contains(i + 1),
              let p = HomePicture(rawValue: args[i + 1]) else { return .sales }
        return p
    }()
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
                .transition(.opacity)
                .id(surface)
            floatingTabBar
        }
        .sheet(isPresented: $menuPresented) {
            PortalMenuSheet(
                selectView: { picture in
                    withAnimation(ivySpring) {
                        #if DEBUG
                        homePicture = picture
                        #endif
                        surface = .root(.home)
                        menuPresented = false
                    }
                },
                selectDestination: { destination in
                    withAnimation(ivySpring) { surface = .root(destination); menuPresented = false }
                },
                currentPicture: {
                    #if DEBUG
                    return homePicture
                    #else
                    return .leadership
                    #endif
                }()
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

    @ViewBuilder private var destinationContent: some View {
        switch surface {
        case .payments:
            PaymentsView()
        case let .root(selection):
            switch selection {
            case .home:
                #if DEBUG
                HomeView(scenario: $scenario, picture: $homePicture, onAction: handleHomeAction)
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

    private func handleHomeAction(_ action: HomeAction) {
        if let detail = action.detail, detail == .upcomingEvent {
            upcomingPresented = true
            return
        }
        if let tab = action.workTab {
            workTab = tab
            withAnimation(ivySpring) { surface = .root(.work) }
        } else if let destination = action.destination {
            withAnimation(ivySpring) { surface = .root(destination) }
        }
    }

    private var floatingTabBar: some View {
        HStack(spacing: 2) {
            ForEach(destinations, id: \.self) { destination in
                Button {
                    withAnimation(ivySpring) { surface = .root(destination) }
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
    /// The burger menu holds ONLY views that are not on the bottom navbar:
    /// department pictures (sales/fulfillment) plus secondary destinations.
    /// Navbar tabs (Work/Performance/Clients/More) are never repeated here.
    let selectView: (HomePicture) -> Void
    let selectDestination: (RootDestination) -> Void
    let currentPicture: HomePicture

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
            VStack(alignment: .leading, spacing: 18) {
                Text("VIEWS").font(.caption.bold()).tracking(1.2).foregroundStyle(.secondary)
                VStack(spacing: 2) {
                    menuRow(icon: "chart.line.uptrend.xyaxis", title: "Sales", subtitle: "Sets, show rate, cash, pipeline", active: currentPicture == .sales) { selectView(.sales) }
                    menuRow(icon: "heart.text.square.fill", title: "Fulfillment", subtitle: "Delivery, CSM, student health", active: currentPicture == .fulfillment) { selectView(.fulfillment) }
                    menuRow(icon: "square.grid.2x2.fill", title: "Leadership", subtitle: "Operating picture and money", active: currentPicture == .leadership) { selectView(.leadership) }
                    menuRow(icon: "person.fill", title: "Personal", subtitle: "Your day and targets", active: currentPicture == .personal) { selectView(.personal) }
                }
            }
            VStack(alignment: .leading, spacing: 18) {
                Text("GO TO").font(.caption.bold()).tracking(1.2).foregroundStyle(.secondary)
                VStack(spacing: 2) {
                    menuRow(icon: "banknote.fill", title: "Money in", subtitle: "Deals, plans, setter attribution") { selectDestination(.work) }
                    menuRow(icon: "creditcard.fill", title: "Cards", subtitle: "Profit-share card balances") { selectDestination(.work) }
                    menuRow(icon: "calendar", title: "Calendar", subtitle: "Calls, sets, confirmations") { selectDestination(.work) }
                    menuRow(icon: "book.closed.fill", title: "Knowledge", subtitle: "SOPs, scripts, policies") { selectDestination(.more) }
                }
            }
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 24).padding(.bottom, 8)
        .background(Color.black.ignoresSafeArea())
        .transition(.move(edge: .leading).combined(with: .opacity))
    }

    private func menuRow(icon: String, title: String, subtitle: String, active: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon).font(.system(size: 16, weight: .semibold)).frame(width: 40, height: 40)
                    .background(active ? Color.white.opacity(0.16) : ivySurface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .foregroundStyle(active ? .white : .secondary)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.body.weight(active ? .semibold : .regular)).foregroundStyle(active ? .white : .primary)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                if active { Image(systemName: "checkmark").font(.caption.bold()).foregroundStyle(.white) }
                else { Image(systemName: "chevron.right").font(.caption2.bold()).foregroundStyle(.tertiary) }
            }
            .padding(.horizontal, 14).frame(minHeight: 62)
            .background(active ? Color.white.opacity(0.08) : .clear, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
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
