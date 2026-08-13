import SwiftUI
import Charts

struct PerformanceView: View {
    let showDetail: (PerformanceMetric) -> Void
    @State private var teamScope = "All members"
    @State private var period = "This week"
    @State private var section: PerformanceSection = .weeklyReport
    @State private var sectionMenuPresented = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack {
                    Button { sectionMenuPresented = true } label: {
                        Image(systemName: "line.3.horizontal").font(.subheadline.bold()).frame(width: 40, height: 40).background(ivySurface, in: Circle())
                    }
                    .buttonStyle(PressableButtonStyle())
                    .accessibilityLabel("Performance menu")
                    Spacer()
                }
                ScreenHeader(title: section.title, subtitle: section.subtitle)
                sectionContent
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $sectionMenuPresented) {
            PerformanceMenuSheet(selected: section) { picked in
                withAnimation(.snappy(duration: 0.24)) { section = picked }
                sectionMenuPresented = false
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.hidden)
            .presentationBackground(.clear)
            .presentationCornerRadius(28)
        }
    }

    @ViewBuilder private var sectionContent: some View {
        switch section {
        case .weeklyReport:
            filters
            reportGrid
            funnel
            activitySection
            repliesCard
            scriptCard
            Text("Source: real-only submitted EOD activity · Updated just now")
                .font(.caption).foregroundStyle(.tertiary)
        case .crm:
            crmSection
        case .eods:
            eodsSection
        case .team:
            teamSection
        }
    }

    private var crmSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Close phone and Mochi DM sources, kept separate").font(.subheadline).foregroundStyle(.secondary)
            SurfaceCard {
                VStack(spacing: 0) {
                    MenuRow(title: "Close CRM", detail: "Phone pipeline and leads", symbol: "phone.fill", color: .blue) { }
                    Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 56)
                    MenuRow(title: "Mochi", detail: "DM conversations and replies", symbol: "message.fill", color: .purple) { }
                }
            }
        }
    }

    private var eodsSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("End-of-day reporting per team member").font(.subheadline).foregroundStyle(.secondary)
            SurfaceCard {
                VStack(spacing: 0) {
                    ForEach(TeammateMetric.replies.prefix(4)) { teammate in
                        HStack(spacing: 12) {
                            AvatarBadge(name: teammate.name, color: teammate.color)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(teammate.name).font(.headline).lineLimit(1)
                                Text("EODs filed this week").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("5/7").font(.subheadline.bold()).monospacedDigit()
                        }.frame(minHeight: 62)
                        if teammate.id != TeammateMetric.replies.prefix(4).last?.id { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                    }
                }
            }
            Button { } label: {
                Label("Submit my EOD", systemImage: "square.and.pencil").frame(maxWidth: .infinity, minHeight: 48)
                    .background(.white, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.black).fontWeight(.semibold)
            }.buttonStyle(PressableButtonStyle())
        }
    }

    private var teamSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("All team members and roles").font(.subheadline).foregroundStyle(.secondary)
            SurfaceCard {
                VStack(spacing: 0) {
                    ForEach(TeammateMetric.replies) { teammate in
                        HStack(spacing: 12) {
                            AvatarBadge(name: teammate.name, color: teammate.color)
                            Text(teammate.name).font(.headline).lineLimit(1)
                            Spacer()
                            Text("Setter").font(.caption).foregroundStyle(.secondary)
                        }.frame(minHeight: 62)
                        if teammate.id != TeammateMetric.replies.last?.id { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                    }
                }
            }
        }
    }

    private var filters: some View {
        HStack(spacing: 10) {
            Menu {
                Picker("Member", selection: $teamScope) {
                    Text("All members").tag("All members")
                    Text("Setters").tag("Setters")
                    Text("Closers").tag("Closers")
                }
            } label: { FilterChip(title: teamScope, symbol: "person.2") }
            Menu {
                Picker("Period", selection: $period) {
                    Text("This week").tag("This week")
                    Text("30 days").tag("30 days")
                    Text("90 days").tag("90 days")
                }
            } label: { FilterChip(title: period, symbol: "calendar") }
        }
    }

    private var reportGrid: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                SplitMetricCard(
                    title: "Total messages sent", value: "601", symbol: "bubble.left.and.bubble.right.fill",
                    accent: .purple, left: "373 outreach", right: "228 inbound"
                ) { showDetail(.totalMessages) }
                SplitMetricCard(
                    title: "Total replies received", value: "476", symbol: "arrowshape.turn.up.left.fill",
                    accent: ivyTeal, left: "229 outreach", right: "247 inbound"
                ) { showDetail(.totalReplies) }
            }
            HStack(spacing: 12) {
                CompactPerformanceMetric(title: "Follow-ups", value: "289", context: "This week", symbol: "arrow.trianglehead.2.clockwise.rotate.90", accent: .pink) { showDetail(.followUps) }
                CompactPerformanceMetric(title: "Links sent", value: "0", context: "No verified links", symbol: "link", accent: .orange) { showDetail(.linksSent) }
                CompactPerformanceMetric(title: "Booked calls", value: "18", context: "12 shows", symbol: "phone.fill", accent: .blue) { showDetail(.bookedCalls) }
            }
        }
    }

    private var funnel: some View {
        SurfaceCard {
            VStack(spacing: 0) {
                FunnelRow(symbol: "person.crop.circle.badge.plus", color: .pink, title: "New leads", value: "101")
                Divider().overlay(Color.white.opacity(0.08))
                FunnelRow(symbol: "star.fill", color: .orange, title: "Qualified", value: "1")
                Divider().overlay(Color.white.opacity(0.08))
                FunnelRow(symbol: "dollarsign", color: ivyGreen, title: "Won", value: "0")
            }
        }
    }

    private var activitySection: some View {
        Button { showDetail(.activeHours) } label: {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Active hours").font(.title3)
                            Text("When the team sends messages").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                    }
                    Chart(HourActivity.points) { point in
                        BarMark(x: .value("Hour", point.label), y: .value("Messages", point.value))
                            .foregroundStyle(Color.cyan.opacity(0.8))
                            .cornerRadius(4)
                    }
                    .chartYAxis { AxisMarks(position: .trailing) }
                    .frame(height: 190)
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var repliesCard: some View {
        Button { showDetail(.setterReplies) } label: {
            SurfaceCard {
                HStack {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Setter replies").font(.title3)
                        HStack(spacing: 24) {
                            VStack(alignment: .leading, spacing: 4) { Text("70%").font(.system(size: 40, weight: .semibold, design: .rounded)).monospacedDigit(); Text("Overall reply rate").font(.caption).foregroundStyle(.secondary) }
                            VStack(alignment: .leading, spacing: 4) { Text("28m").font(.system(size: 40, weight: .semibold, design: .rounded)).monospacedDigit(); Text("Median reply time").font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var scriptCard: some View {
        Button { showDetail(.scriptAnalysis) } label: {
            SurfaceCard {
                HStack {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Script analysis").font(.title3)
                        Text("0").font(.system(size: 44, weight: .semibold, design: .rounded)).monospacedDigit()
                        Text("Messages analyzed").foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
    }
}

private enum PerformanceSection: String, CaseIterable, Hashable {
    case weeklyReport, crm, eods, team
    var title: String {
        switch self {
        case .weeklyReport: "Performance"
        case .crm: "CRM"
        case .eods: "EODs"
        case .team: "Team"
        }
    }
    var subtitle: String {
        switch self {
        case .weeklyReport: "Weekly Report"
        case .crm: "Close and Mochi sources"
        case .eods: "End-of-day reports"
        case .team: "Members and roles"
        }
    }
}

private struct PerformanceMenuSheet: View {
    @Environment(\.dismiss) private var dismiss
    let selected: PerformanceSection
    let select: (PerformanceSection) -> Void

    private let items: [(PerformanceSection, String, String)] = [
        (.weeklyReport, "chart.bar.fill", "Weekly Report"),
        (.crm, "phone.fill", "CRM"),
        (.eods, "doc.text.fill", "EODs"),
        (.team, "person.2.fill", "Team"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Text("Performance").font(.largeTitle.bold())
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.subheadline.bold()).frame(width: 40, height: 40).background(ivySurface, in: Circle())
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel("Close navigation")
            }
            VStack(spacing: 2) {
                ForEach(items, id: \.0) { section, symbol, title in
                    Button { select(section) } label: {
                        HStack(spacing: 16) {
                            Image(systemName: symbol).font(.system(size: 17, weight: .semibold)).frame(width: 40, height: 40)
                                .background(selected == section ? Color.white.opacity(0.14) : ivySurface, in: Circle())
                                .foregroundStyle(selected == section ? .white : .secondary)
                            Text(title).font(.body.weight(selected == section ? .semibold : .regular))
                                .foregroundStyle(selected == section ? .white : .secondary)
                            Spacer()
                            if selected == section { Image(systemName: "checkmark").font(.caption.bold()) }
                        }
                        .padding(.horizontal, 16).frame(minHeight: 60)
                        .background(selected == section ? Color.white.opacity(0.06) : .clear, in: RoundedRectangle(cornerRadius: 16))
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

private struct MenuRow: View {
    let title, detail, symbol: String
    let color: Color
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: symbol).font(.system(size: 15, weight: .semibold)).frame(width: 42, height: 42).background(color.opacity(0.18), in: Circle()).foregroundStyle(color)
                VStack(alignment: .leading, spacing: 3) { Text(title).font(.headline); Text(detail).font(.caption).foregroundStyle(.secondary) }
                Spacer()
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
            }.frame(minHeight: 68).contentShape(Rectangle())
        }.buttonStyle(PressableButtonStyle())
    }
}


private struct CompactPerformanceMetric: View {
    let title, value, context, symbol: String
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            SurfaceCard(padding: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: symbol)
                            .font(.system(size: 11, weight: .bold))
                            .frame(width: 22, height: 22)
                            .background(accent, in: RoundedRectangle(cornerRadius: 7))
                        Text(title)
                            .font(.system(.caption2, weight: .medium))
                            .foregroundStyle(ivyMuted)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Spacer(minLength: 0)
                    }
                    Spacer(minLength: 0)
                    Text(value).font(.system(.title2, design: .rounded, weight: .semibold)).monospacedDigit()
                    Text(context).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.85)
                }
                .frame(minHeight: 96, alignment: .top)
            }
        }
        .buttonStyle(PressableButtonStyle())
    }
}

private struct SplitMetricCard: View {
    let title: String, value: String, symbol: String
    let accent: Color
    let left: String, right: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        Text(title).font(.subheadline).foregroundStyle(ivyMuted).multilineTextAlignment(.leading)
                        Spacer(minLength: 4)
                        Image(systemName: symbol).font(.caption.bold()).frame(width: 30, height: 30).background(accent, in: RoundedRectangle(cornerRadius: 9))
                    }
                    Text(value).font(.system(.title, design: .rounded, weight: .semibold)).monospacedDigit()
                    GeometryReader { geometry in
                        HStack(spacing: 1) {
                            Capsule().fill(accent).frame(width: geometry.size.width * 0.58)
                            Capsule().fill(accent.opacity(0.42))
                        }
                    }.frame(height: 5)
                    HStack(spacing: 8) {
                        Text(left).lineLimit(1).minimumScaleFactor(0.8)
                        Spacer(minLength: 2)
                        Text(right).lineLimit(1).minimumScaleFactor(0.8)
                    }.font(.system(size: 11)).foregroundStyle(.secondary)
                }
                .frame(minHeight: 138, alignment: .top)
            }
        }.buttonStyle(PressableButtonStyle())
    }
}

private struct FunnelRow: View {
    let symbol: String
    let color: Color
    let title, value: String
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol).foregroundStyle(.white).frame(width: 30, height: 30).background(color, in: RoundedRectangle(cornerRadius: 9))
            Text(title).font(.headline)
            Spacer()
            Text(value).font(.title2.bold()).monospacedDigit()
        }.frame(minHeight: 64)
    }
}

private struct ReplyStat: View {
    let value, label: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.system(.largeTitle, design: .rounded, weight: .semibold)).monospacedDigit()
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct HourActivity: Identifiable {
    let id = UUID()
    let label: String
    let value: Int
    static let points = [
        HourActivity(label: "12a", value: 28), HourActivity(label: "3a", value: 163),
        HourActivity(label: "6a", value: 25), HourActivity(label: "9a", value: 122),
        HourActivity(label: "12p", value: 82), HourActivity(label: "3p", value: 15),
        HourActivity(label: "6p", value: 21), HourActivity(label: "9p", value: 64),
    ]
}

private struct DayMetric: Identifiable {
    let id = UUID()
    let day, date: String
    let value: Int?
    static let replies = [
        DayMetric(day: "Mon", date: "10", value: 202), DayMetric(day: "Tue", date: "11", value: 199),
        DayMetric(day: "Wed", date: "12", value: 75), DayMetric(day: "Thu", date: "13", value: nil),
        DayMetric(day: "Fri", date: "14", value: nil), DayMetric(day: "Sat", date: "15", value: nil),
        DayMetric(day: "Sun", date: "16", value: nil),
    ]
}

private struct TeammateMetric: Identifiable {
    let id = UUID()
    let name: String
    let value: String
    let color: Color
    static let replies = [
        TeammateMetric(name: "Haroon Quraishi", value: "179", color: .purple),
        TeammateMetric(name: "Masood Ali", value: "107", color: .pink),
        TeammateMetric(name: "Aalian Khan", value: "49", color: .indigo),
        TeammateMetric(name: "Abdelmalik Abu Abdurrahman", value: "41", color: ivyGreen),
    ]
}

struct PerformanceDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let metric: PerformanceMetric

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack {
                    Text(metric.title).font(.title2.bold())
                    Spacer()
                    Button("Done") { dismiss() }.frame(minHeight: 48)
                }
                switch metric.detailKind {
                case .dailyAndTeammates: dailyDetail
                case .hourlyActivity: activityDetail
                case .replyPerformance: replyDetail
                }
            }.padding(24)
        }
    }

    private var dailyDetail: some View {
        VStack(alignment: .leading, spacing: 28) {
            VStack(spacing: 12) {
                Image(systemName: metric.symbol).font(.title).frame(width: 58, height: 58).background(metric.color, in: RoundedRectangle(cornerRadius: 16))
                Text(metric.value).font(.system(size: 56, weight: .semibold, design: .rounded)).monospacedDigit()
            }.frame(maxWidth: .infinity)
            Text("DAILY BREAKDOWN").font(.caption.bold()).tracking(1).foregroundStyle(ivyMuted)
            HStack(spacing: 6) {
                ForEach(DayMetric.replies) { day in
                    VStack(spacing: 7) {
                        Text(day.day).font(.caption2).foregroundStyle(.secondary)
                        VStack(spacing: 8) {
                            Text(day.date).font(.caption2).foregroundStyle(.secondary)
                            Text(day.value.map(String.init) ?? "–").font(.caption.bold()).monospacedDigit()
                        }
                        .frame(maxWidth: .infinity, minHeight: 68)
                        .background(day.value == nil ? metric.color.opacity(0.1) : metric.color.opacity(0.65), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }.padding(14).background(ivyRaised, in: RoundedRectangle(cornerRadius: 18))
            Text("BY TEAMMATE").font(.caption.bold()).tracking(1).foregroundStyle(ivyMuted)
            SurfaceCard {
                VStack(spacing: 0) {
                    ForEach(Array(TeammateMetric.replies.enumerated()), id: \.element.id) { index, teammate in
                        HStack(spacing: 12) {
                            AvatarBadge(name: teammate.name, color: teammate.color)
                            Text(teammate.name).font(.headline).lineLimit(1)
                            Spacer()
                            Text(teammate.value).font(.title3.bold()).monospacedDigit()
                        }.frame(minHeight: 62)
                        if index < TeammateMetric.replies.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                    }
                }
            }
        }
    }

    private var activityDetail: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text("543").font(.system(size: 52, weight: .semibold, design: .rounded)).monospacedDigit()
            Text("Messages sent").foregroundStyle(.secondary)
            HStack { FilterChip(title: "This week", symbol: "calendar"); FilterChip(title: "All members", symbol: "person.2") }
            Chart(HourActivity.points) { point in
                BarMark(x: .value("Hour", point.label), y: .value("Messages", point.value)).foregroundStyle(.blue.gradient).cornerRadius(4)
            }.chartYAxis { AxisMarks(position: .trailing) }.frame(height: 230)
            SurfaceCard {
                VStack(spacing: 0) {
                    ForEach(HourActivity.points.prefix(6)) { point in
                        HStack { Text(point.label).foregroundStyle(.secondary); Spacer(); Text("\(point.value)").font(.headline).monospacedDigit() }.frame(minHeight: 52)
                        Divider().overlay(Color.white.opacity(0.08))
                    }
                }
            }
        }
    }

    private var replyDetail: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack { ReplyStat(value: "70%", label: "Overall reply rate"); Spacer(); ReplyStat(value: "28m", label: "Median reply time") }
            HStack { FilterChip(title: "This week", symbol: "calendar"); FilterChip(title: "All members", symbol: "person.2") }
            VStack(spacing: 0) {
                HStack { Text("Person"); Spacer(); Text("Reply rate"); Text("Median").frame(width: 92, alignment: .trailing) }
                    .font(.caption.bold()).foregroundStyle(.secondary).padding(.vertical, 14)
                ForEach(TeammateMetric.replies) { teammate in
                    HStack(spacing: 12) {
                        AvatarBadge(name: teammate.name, color: teammate.color)
                        Text(teammate.name).lineLimit(1)
                        Spacer()
                        Text(teammate.name == "Aalian Khan" ? "65%" : "70%").monospacedDigit()
                        Text(teammate.name == "Aalian Khan" ? "5h 23m" : "28m").monospacedDigit().frame(width: 92, alignment: .trailing)
                    }.frame(minHeight: 68)
                    Divider().overlay(Color.white.opacity(0.08))
                }
            }
        }
    }
}

private extension PerformanceMetric {
    var title: String {
        switch self {
        case .totalMessages: "Total Messages Sent"; case .totalReplies: "Total Replies Received"
        case .followUps: "Follow-ups Sent"; case .linksSent: "Links Sent"; case .bookedCalls: "Booked Calls"
        case .activeHours: "Setter Activity"; case .setterReplies: "Setter Replies"; case .scriptAnalysis: "Script Analysis"
        }
    }
    var value: String {
        switch self { case .totalMessages: "601"; case .totalReplies: "476"; case .followUps: "289"; case .bookedCalls: "18"; default: "0" }
    }
    var symbol: String {
        switch self { case .totalReplies: "arrowshape.turn.up.left.fill"; case .followUps: "arrow.trianglehead.2.clockwise.rotate.90"; case .bookedCalls: "phone.fill"; default: "bubble.left.and.bubble.right.fill" }
    }
    var color: Color {
        switch self { case .totalReplies: ivyTeal; case .followUps: .pink; case .bookedCalls: .blue; default: .purple }
    }
}
