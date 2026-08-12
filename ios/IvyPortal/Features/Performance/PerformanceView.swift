import SwiftUI
import Charts

struct PerformanceView: View {
    let showDetail: () -> Void
    @State private var teamScope = "All team"
    @State private var period = "7 days"
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ScreenHeader(title: "Pulse", subtitle: "Verified team performance")
                HStack(spacing: 10) {
                    Menu {
                        Picker("Team", selection: $teamScope) {
                            Text("All team").tag("All team")
                            Text("Setters").tag("Setters")
                            Text("Closers").tag("Closers")
                        }
                    } label: { filterLabel(teamScope, "person.2") }
                    Menu {
                        Picker("Period", selection: $period) {
                            Text("7 days").tag("7 days")
                            Text("30 days").tag("30 days")
                            Text("This month").tag("This month")
                        }
                    } label: { filterLabel(period, "calendar") }
                }
                VStack(alignment: .leading, spacing: 12) {
                    Text("Weekly report").font(.title2.bold())
                    HStack(spacing: 12) {
                        MetricCard(title: "Calls booked", value: "18", context: "12 shows", symbol: "phone.fill", accent: .blue, action: showDetail)
                        MetricCard(title: "Closes", value: "4", context: "33% of shows", symbol: "checkmark.seal.fill", accent: ivyGreen, action: showDetail)
                    }
                    HStack(spacing: 12) {
                        MetricCard(title: "Dials", value: "642", context: "Verified EODs", symbol: "phone.arrow.up.right.fill", accent: .purple, action: showDetail)
                        MetricCard(title: "Coverage", value: "86%", context: "36 of 42 EODs", symbol: "person.3.fill", accent: .orange, action: showDetail)
                    }
                }
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Calls booked trend").font(.headline)
                        Chart(DemoMetric.points) { point in
                            LineMark(x: .value("Day", point.label), y: .value("Calls", point.value))
                                .interpolationMethod(.catmullRom)
                                .foregroundStyle(.blue)
                            AreaMark(x: .value("Day", point.label), y: .value("Calls", point.value))
                                .foregroundStyle(.linearGradient(colors: [.blue.opacity(0.3), .clear], startPoint: .top, endPoint: .bottom))
                        }
                        .chartYAxis(.hidden)
                        .frame(height: 150)
                    }
                }
                Text("Source: submitted EOD activity · Updated just now")
                    .font(.caption).foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 112)
        }.scrollIndicators(.hidden)
    }

    private func filterLabel(_ text: String, _ symbol: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: symbol)
            Text(text)
            Image(systemName: "chevron.down").font(.caption2.bold()).foregroundStyle(.secondary)
        }
        .font(.subheadline.weight(.semibold))
        .frame(minHeight: 48)
        .padding(.horizontal, 14)
        .background(ivySurface, in: Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.08)))
    }
}

private struct DemoMetric: Identifiable {
    let id = UUID()
    let label: String
    let value: Int
    static let points = [
        DemoMetric(label: "Thu", value: 2), DemoMetric(label: "Fri", value: 4),
        DemoMetric(label: "Sat", value: 1), DemoMetric(label: "Sun", value: 3),
        DemoMetric(label: "Mon", value: 2), DemoMetric(label: "Tue", value: 5),
        DemoMetric(label: "Wed", value: 1),
    ]
}

struct KPIDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Calls booked").font(.title2.bold())
                        Text("All team · Last 7 days").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Done") { dismiss() }.frame(minHeight: 48)
                }
                Text("18").font(.system(size: 46, weight: .semibold, design: .rounded)).monospacedDigit()
                Chart(DemoMetric.points) { point in
                    BarMark(x: .value("Day", point.label), y: .value("Calls", point.value))
                        .foregroundStyle(.blue.gradient)
                        .cornerRadius(4)
                }
                .chartYAxis { AxisMarks(position: .trailing) }
                .frame(height: 210)
                VStack(spacing: 0) {
                    ForEach(DemoMetric.points) { point in
                        HStack {
                            Text(point.label).foregroundStyle(.secondary)
                            Spacer()
                            Text("\(point.value)").font(.headline).monospacedDigit()
                        }
                        .frame(minHeight: 54)
                        if point.id != DemoMetric.points.last?.id { Divider().overlay(Color.white.opacity(0.08)) }
                    }
                }
                Text("Source: submitted EOD activity · Scope: all active reporters · Updated just now")
                    .font(.caption).foregroundStyle(.tertiary)
            }.padding(20)
        }
    }
}
