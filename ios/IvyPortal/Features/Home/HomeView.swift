import SwiftUI

struct HomeView: View {
    let onAction: (HomeAction) -> Void

    #if DEBUG
    @Binding var scenario: DemoScenario
    init(scenario: Binding<DemoScenario>, onAction: @escaping (HomeAction) -> Void) {
        _scenario = scenario
        self.onAction = onAction
    }
    #else
    init(onAction: @escaping (HomeAction) -> Void) {
        self.onAction = onAction
    }
    #endif

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                ScreenHeader(title: "Good afternoon", subtitle: "Wednesday, 12 August")
                #if DEBUG
                scenarioContent
                #else
                loadedContent
                #endif
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .background(Color.black)
    }

    #if DEBUG
    @ViewBuilder private var scenarioContent: some View {
        switch scenario {
        case .loaded: loadedContent
        case .loading: skeletonContent
        case .empty:
            StatusCard(symbol: "checkmark.circle", title: "You’re clear", message: "No urgent actions are assigned right now.")
        case .unavailable:
            StatusCard(symbol: "questionmark.circle", title: "Pulse unavailable", message: "The source has no verified answer for this scope.")
        case .failed:
            StatusCard(symbol: "exclamationmark.triangle", title: "Home could not load", message: "The reporting source did not respond.", retry: { scenario = .loading })
        }
    }
    #endif

    private var loadedContent: some View {
        VStack(alignment: .leading, spacing: 30) {
            focusSection
            pulseSection
            upcomingSection
            Text("Verified in Ivy Portal · Updated just now")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    private var focusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Today", detail: "2 priorities")
            SurfaceCard {
                VStack(spacing: 0) {
                    HomeActionRow(
                        symbol: "exclamationmark.circle.fill",
                        symbolColor: .orange,
                        title: "Review overdue items",
                        detail: "2 assigned to you · oldest due yesterday",
                        value: "2"
                    ) { onAction(.reviewOverdue) }
                    Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 48)
                    HomeActionRow(
                        symbol: "person.3.fill",
                        symbolColor: .white,
                        title: "Check team reporting",
                        detail: "36 of 42 EODs submitted",
                        value: "86%"
                    ) { onAction(.reviewCoverage) }
                }
            }
        }
    }

    private var pulseSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Pulse", detail: "Last 7 days")
            HStack(spacing: 12) {
                HomeMetricButton(title: "Calls booked", value: "18", trend: "+3 vs prior", accent: .blue) {
                    onAction(.openCalls)
                }
                HomeMetricButton(title: "Cash collected", value: "$12.5K", trend: "4 verified deals", accent: ivyGreen) {
                    onAction(.openPayments)
                }
            }
        }
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Next up", detail: "Today")
            Button { onAction(.openUpcoming) } label: {
                SurfaceCard {
                    HStack(spacing: 14) {
                        VStack(spacing: 2) {
                            Text("5:00").font(.headline).monospacedDigit()
                            Text("PM").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        }
                        .frame(width: 48, height: 48)
                        .background(ivyRaised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Founder review").font(.headline)
                            Text("Riyadh · 45 minutes").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                    }
                }
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityHint("Opens meeting details")
        }
    }

    private func sectionHeader(_ title: String, detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.title3.bold())
            Spacer()
            Text(detail).font(.caption.weight(.medium)).foregroundStyle(.secondary)
        }
    }

    private var skeletonContent: some View {
        VStack(alignment: .leading, spacing: 30) {
            ForEach([168.0, 150.0, 104.0], id: \.self) { height in
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        RoundedRectangle(cornerRadius: 5).fill(ivyRaised).frame(width: 92, height: 20)
                        Spacer()
                        RoundedRectangle(cornerRadius: 5).fill(ivyRaised).frame(width: 70, height: 14)
                    }
                    RoundedRectangle(cornerRadius: 22).fill(ivySurface).frame(height: height)
                }
            }
        }
        .redacted(reason: .placeholder)
        .accessibilityLabel("Loading Home")
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
                Image(systemName: symbol)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(symbolColor)
                    .frame(width: 34, height: 34)
                    .background(symbolColor.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.headline)
                    Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
                Spacer(minLength: 8)
                Text(value).font(.subheadline.bold()).monospacedDigit()
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
            }
            .frame(minHeight: 64)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
    }
}

private struct HomeMetricButton: View {
    let title: String
    let value: String
    let trend: String
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Circle().fill(accent).frame(width: 7, height: 7)
                        Text(title).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption2.bold()).foregroundStyle(.tertiary)
                    }
                    Text(value)
                        .font(.system(.title2, design: .rounded, weight: .semibold))
                        .monospacedDigit()
                    Text(trend).font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityHint("Opens Pulse")
    }
}
