import SwiftUI
import Charts

struct PerformanceView: View {
    let showDetail: (PerformanceMetric) -> Void
    @State private var teamScope = "All members"
    @State private var period = "This week"
    @State private var section: PerformanceSection = .weeklyReport
    @State private var realSummary: PerformanceSummary?
    @State private var realRows: [TeamMemberRow] = []
    @State private var realLoading = false
    @State private var realError: String?
    @State private var realDays = 7

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                ScreenHeader(title: section.title, subtitle: section.subtitle)
                sectionPicker
                if signedIn { realSectionContent } else { fixtureSectionContent }
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .task { await loadRealIfNeeded() }
    }

    private func loadRealIfNeeded() async {
        guard signedIn, realSummary == nil else { return }
        realLoading = true
        defer { realLoading = false }
        do {
            let result = try await PortalAPI.shared.performanceSummary(days: realDays)
            realSummary = result.summary
            realRows = result.rows
            realError = nil
        } catch {
            realError = "Could not load Performance from the portal."
        }
    }

    @ViewBuilder private var fixtureSectionContent: some View {
        sectionContent
            .transition(.opacity)
            .id(section)
    }

    @ViewBuilder private var realSectionContent: some View {
        switch section {
        case .weeklyReport:
            realWeeklyReport
        case .crm:
            crmSection
        case .eods:
            realEODs
        case .team:
            realTeam
        }
    }

    private var realWeeklyReport: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 8) {
                ForEach([7, 30, 90], id: \.self) { days in
                    Button { realDays = days; realSummary = nil } label: {
                        Text("\(days)D").font(.subheadline.bold()).padding(.horizontal, 14).padding(.vertical, 7)
                            .background(realDays == days ? .white.opacity(0.16) : .clear, in: Capsule())
                            .foregroundStyle(realDays == days ? .white : .secondary)
                    }.buttonStyle(PressableButtonStyle())
                }
                Spacer()
                Text("All team · EOD activity").font(.caption).foregroundStyle(.tertiary)
            }
            .onChange(of: realDays) { _ in Task { await loadRealIfNeeded() } }
            if let summary = realSummary {
                HStack(spacing: 12) {
                    PerformanceStatCard(title: "Calls booked", value: "\(summary.callsBooked)", context: "from submitted EODs", color: ivyGreen) { showDetail(.bookedCalls) }
                    PerformanceStatCard(title: "EOD coverage", value: "\(summary.coverage)%", context: "\(summary.submitted) submitted · \(summary.missing) missing", color: summary.coverage >= 80 ? ivyGreen : .orange) { showDetail(.activeHours) }
                }
                HStack(spacing: 12) {
                    PerformanceStatCard(title: "Dials", value: "\(realRows.reduce(0) { $0 + $1.dials })", context: "phone outreach", color: .blue) { showDetail(.activeHours) }
                    PerformanceStatCard(title: "DMs sent", value: "\(realRows.reduce(0) { $0 + $1.dmsSent })", context: "Mochi outreach", color: .purple) { showDetail(.totalMessages) }
                }
                HStack(spacing: 12) {
                    PerformanceStatCard(title: "Shows", value: "\(realRows.reduce(0) { $0 + $1.shows })", context: "verified", color: .cyan) { showDetail(.bookedCalls) }
                    PerformanceStatCard(title: "Closes", value: "\(realRows.reduce(0) { $0 + $1.closes })", context: "won deals", color: ivyGreen) { showDetail(.bookedCalls) }
                }
                sectionHeader("Team week", detail: "\(realRows.count) members")
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(realRows.enumerated()), id: \.element.id) { index, row in
                            HStack(spacing: 12) {
                                AvatarBadge(name: row.name, color: .purple)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(row.name).font(.headline).lineLimit(1)
                                    HStack(spacing: 6) {
                                        StatusPill(title: row.role, color: .blue)
                                        if row.filedToday { StatusPill(title: "Filed today", color: ivyGreen) }
                                        if row.missedYesterday { StatusPill(title: "Missed yesterday", color: .red) }
                                    }
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("\(row.sets) sets").font(.subheadline.bold()).monospacedDigit()
                                    Text("EOD \(row.eodDays)/7").font(.caption2).foregroundStyle(.secondary)
                                }
                            }.frame(minHeight: 66).contentShape(Rectangle())
                            if index < realRows.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                        }
                    }
                }
                sectionHeader("Submission & outcome", detail: "Per member")
                SurfaceCard {
                    VStack(spacing: 0) {
                        HStack(spacing: 8) {
                            Text("Member").frame(maxWidth: .infinity, alignment: .leading)
                            Text("EOD").frame(width: 44, alignment: .trailing)
                            Text("Booked").frame(width: 52, alignment: .trailing)
                            Text("Shows").frame(width: 46, alignment: .trailing)
                            Text("Closes").frame(width: 46, alignment: .trailing)
                        }.font(.caption2.bold()).foregroundStyle(.secondary).frame(minHeight: 34)
                        ForEach(Array(realRows.enumerated()), id: \.element.id) { index, row in
                            HStack(spacing: 8) {
                                Text(row.name).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                                Text("\(row.eodDays)").monospacedDigit().frame(width: 44, alignment: .trailing)
                                Text("\(row.booked)").monospacedDigit().frame(width: 52, alignment: .trailing)
                                Text("\(row.shows)").monospacedDigit().frame(width: 46, alignment: .trailing)
                                Text("\(row.closes)").monospacedDigit().frame(width: 46, alignment: .trailing)
                            }.font(.subheadline).frame(minHeight: 44)
                            if index < realRows.count - 1 { Divider().overlay(Color.white.opacity(0.08)) }
                        }
                    }
                }
                Text("Source: real eods_activity_real, profiles, and user_roles via your portal session. Demo, Revenue, and CRM data are never mixed in.").font(.caption).foregroundStyle(.tertiary)
            } else if realLoading {
                SkeletonCards(count: 4, height: 120)
            } else {
                StatusCard(symbol: "exclamationmark.triangle", title: "Performance unavailable", message: realError ?? "Sign in to load verified performance data.", retry: { realSummary = nil; Task { await loadRealIfNeeded() } })
            }
        }
    }

    private var realEODs: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("End-of-day reporting per team member · real data").font(.subheadline).foregroundStyle(.secondary)
            if let summary = realSummary {
                HStack(spacing: 12) {
                    PerformanceStatCard(title: "Submitted", value: "\(summary.submitted)", context: "EODs this window", color: ivyGreen) { }
                    PerformanceStatCard(title: "Missing", value: "\(summary.missing)", context: "expected days", color: .orange) { }
                }
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(realRows.enumerated()), id: \.element.id) { index, row in
                            HStack(spacing: 12) {
                                AvatarBadge(name: row.name, color: .blue)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(row.name).font(.headline).lineLimit(1)
                                    Text("\(row.role)").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(row.eodDays)/7").font(.subheadline.bold()).monospacedDigit()
                            }.frame(minHeight: 62)
                            if index < realRows.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                        }
                    }
                }
            } else if realLoading {
                SkeletonCards(count: 3, height: 96)
            } else {
                StatusCard(symbol: "exclamationmark.triangle", title: "EODs unavailable", message: realError ?? "Sign in to load verified EODs.", retry: { realSummary = nil; Task { await loadRealIfNeeded() } })
            }
        }
    }

    private var realTeam: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("All team members and roles · real data").font(.subheadline).foregroundStyle(.secondary)
            if !realRows.isEmpty {
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(realRows.enumerated()), id: \.element.id) { index, row in
                            HStack(spacing: 12) {
                                AvatarBadge(name: row.name, color: .blue)
                                Text(row.name).font(.headline).lineLimit(1)
                                Spacer()
                                StatusPill(title: row.role, color: .blue)
                            }.frame(minHeight: 62)
                            if index < realRows.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                        }
                    }
                }
            } else if realLoading {
                SkeletonCards(count: 3, height: 96)
            } else {
                StatusCard(symbol: "exclamationmark.triangle", title: "Team unavailable", message: realError ?? "Sign in to load verified team.", retry: { realSummary = nil; Task { await loadRealIfNeeded() } })
            }
        }
    }

    private func sectionHeader(_ title: String, detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.title3.bold())
            Spacer()
            Text(detail).font(.caption).foregroundStyle(.secondary)
        }
    }

    private var sectionPicker: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(PerformanceSection.allCases, id: \.self) { option in
                    Button(option.pickerLabel) {
                        withAnimation(ivySpring) { section = option }
                    }
                    .font(.subheadline.bold()).padding(.horizontal, 16).frame(minHeight: 42)
                    .background(section == option ? Color.white.opacity(0.22) : ivySurface, in: Capsule())
                    .foregroundStyle(section == option ? .white : .secondary)
                }
            }
        }.scrollIndicators(.hidden)
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
                FunnelRow(title: "New leads", value: "101", symbol: "person.crop.circle.badge.plus", color: .pink)
                Divider().overlay(Color.white.opacity(0.08))
                FunnelRow(title: "Qualified", value: "1", symbol: "star.fill", color: .orange)
                Divider().overlay(Color.white.opacity(0.08))
                FunnelRow(title: "Won", value: "0", symbol: "dollarsign", color: ivyGreen)
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
    var pickerLabel: String {
        switch self {
        case .weeklyReport: "Weekly Report"
        default: title
        }
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


struct PerformanceStatCard: View {
    let title, value, context: String
    let color: Color
    var action: (() -> Void)?

    var body: some View {
        Button { action?() } label: {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 10) {
                    Circle().fill(color).frame(width: 8, height: 8)
                    Text(title).font(.caption).foregroundStyle(.secondary)
                    Text(value).font(.title2.bold()).monospacedDigit()
                    Text(context).font(.caption2).foregroundStyle(color).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
            }
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(action == nil)
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
