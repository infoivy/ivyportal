import SwiftUI
import Charts

/// Setter Activity detail (portal "Active hours" drill-down), Mochi-style:
/// big total, period/member filter pills, an hourly bar chart, and a
/// per-member × per-hour grid. A source toggle splits Mochi (DM) from Close CRM
/// (phone) so you can see when setters are active by channel — never merged.
struct SetterActivityDetail: View {
    @State private var source: ActivitySource = .mochi

    private var data: ActivityDataset { ActivityDataset.fixture(source) }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            // Big number + label
            VStack(alignment: .leading, spacing: 6) {
                Text(data.total).font(.system(size: 56, weight: .semibold, design: .rounded)).monospacedDigit()
                Text(data.unitLabel).foregroundStyle(.secondary)
            }
            // Source toggle: Mochi (DM) vs Close (phone)
            HStack(spacing: 8) {
                ForEach(ActivitySource.allCases, id: \.self) { s in
                    Button { withAnimation(.snappy(duration: 0.22)) { source = s } } label: {
                        HStack(spacing: 7) {
                            Image(systemName: s.symbol).font(.caption.bold())
                            Text(s.label).font(.subheadline.bold())
                        }
                        .padding(.horizontal, 16).frame(minHeight: 42)
                        .background(source == s ? s.color.opacity(0.25) : ivySurface, in: Capsule())
                        .foregroundStyle(source == s ? .white : .secondary)
                        .overlay(Capsule().stroke(source == s ? s.color.opacity(0.5) : Color.clear, lineWidth: 1))
                    }
                    .buttonStyle(PressableButtonStyle())
                }
                Spacer()
            }
            // Filter pills
            HStack { FilterChip(title: "This week", symbol: "calendar"); FilterChip(title: "All members", symbol: "person.2") }
            // Hourly bar chart
            Chart(data.hourly) { point in
                BarMark(x: .value("Hour", point.label), y: .value("Count", point.value))
                    .foregroundStyle(source.color.gradient).cornerRadius(4)
            }
            .chartYAxis { AxisMarks(position: .trailing) }
            .frame(height: 220)
            // Per-member × per-hour grid
            memberGrid
            Text("Source: \(source.sourceNote) · Debug fixture").font(.caption).foregroundStyle(.tertiary)
        }
    }

    private var memberGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("BY MEMBER · BY HOUR").font(.caption.bold()).tracking(1).foregroundStyle(ivyMuted)
            ScrollView(.horizontal) {
                VStack(spacing: 0) {
                    // header row
                    HStack(spacing: 0) {
                        Text("").frame(width: 52, alignment: .leading)
                        ForEach(data.members) { m in
                            VStack(spacing: 4) {
                                Circle().fill(m.color.opacity(0.9)).frame(width: 26, height: 26)
                                    .overlay(Text(m.name.prefix(1)).font(.caption2.bold()).foregroundStyle(.white))
                                Text(m.shortName).font(.caption2.weight(.semibold)).lineLimit(1)
                            }
                            .frame(width: 76)
                        }
                    }
                    .padding(.vertical, 10)
                    Divider().overlay(Color.white.opacity(0.1))
                    ForEach(Array(data.hours.enumerated()), id: \.offset) { hi, hour in
                        HStack(spacing: 0) {
                            Text(hour).font(.caption2).foregroundStyle(.secondary).frame(width: 52, alignment: .leading)
                            ForEach(data.members) { m in
                                Text("\(data.value(member: m.id, hour: hi))")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(data.value(member: m.id, hour: hi) > 0 ? .white : .secondary)
                                    .frame(width: 76)
                            }
                        }
                        .padding(.vertical, 9)
                        if hi < data.hours.count - 1 { Divider().overlay(Color.white.opacity(0.06)) }
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
    }
}

// MARK: - Model + fixtures

enum ActivitySource: String, CaseIterable {
    case mochi, close
    var label: String { self == .mochi ? "Mochi · DM" : "Close · Phone" }
    var symbol: String { self == .mochi ? "message.fill" : "phone.fill" }
    var color: Color { self == .mochi ? ivyPurple : ivyBlue }
    var sourceNote: String { self == .mochi ? "Mochi DM activity" : "Close CRM phone activity" }
}

struct HourPoint: Identifiable { let id = UUID(); let label: String; let value: Int }
struct ActivityMember: Identifiable { let id: String; let name: String; let color: Color; var shortName: String { String(name.split(separator: " ").first ?? Substring(name)) } }

struct ActivityDataset {
    let total: String
    let unitLabel: String
    let hourly: [HourPoint]
    let hours: [String]
    let members: [ActivityMember]
    let grid: [String: [Int]]   // memberId -> per-hour counts

    func value(member: String, hour: Int) -> Int { grid[member]?[hour] ?? 0 }

    static func fixture(_ source: ActivitySource) -> ActivityDataset {
        let hours = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"]
        let members = [
            ActivityMember(id: "haroon", name: "Haroon Quraishi", color: ivyPurple),
            ActivityMember(id: "masood", name: "Masood Ali", color: ivyPink),
            ActivityMember(id: "aalian", name: "Aalian Khan", color: ivyBlue),
            ActivityMember(id: "abdel", name: "Abdelmalik", color: ivyMint),
        ]
        switch source {
        case .mochi:
            let vals = [30, 250, 12, 105, 98, 24, 40, 110]
            return ActivityDataset(
                total: "811", unitLabel: "Messages sent",
                hourly: hours.enumerated().map { HourPoint(label: $0.element, value: vals[$0.offset]) },
                hours: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"],
                members: members,
                grid: [
                    "haroon": [7, 2, 0, 0, 0, 5, 0, 12],
                    "masood": [4, 98, 12, 1, 2, 2, 2, 40],
                    "aalian": [4, 102, 13, 0, 2, 9, 2, 38],
                    "abdel":  [2, 48, 6, 1, 1, 4, 1, 20],
                ]
            )
        case .close:
            let vals = [0, 8, 40, 180, 210, 90, 120, 60]
            return ActivityDataset(
                total: "642", unitLabel: "Dials made",
                hourly: hours.enumerated().map { HourPoint(label: $0.element, value: vals[$0.offset]) },
                hours: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"],
                members: members,
                grid: [
                    "haroon": [0, 0, 12, 60, 70, 30, 40, 18],
                    "masood": [0, 2, 10, 50, 60, 25, 35, 14],
                    "aalian": [0, 1, 8, 40, 50, 20, 30, 16],
                    "abdel":  [0, 0, 4, 30, 30, 15, 15, 12],
                ]
            )
        }
    }
}
