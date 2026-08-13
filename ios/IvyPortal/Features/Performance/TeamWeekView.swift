import SwiftUI

/// Portal Team Week (team-week.tsx), native: a Today ops strip, then one card
/// per member with seven colored day chips (green = KPI hit, amber = submitted
/// but missed, red = missing). Tapping a card expands each day's EOD numbers
/// with wins and blockers, exactly like the portal.
struct TeamWeekView: View {
    let days: [String]                 // last 7 dates, ISO yyyy-MM-dd, oldest first
    let members: [MemberWeek]          // roster with per-day EODs

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            opsStrip
            ForEach(members) { member in
                MemberWeekCard(member: member, days: days)
            }
        }
    }

    private var opsStrip: some View {
        let filedToday = members.filter { $0.eod(on: days.last ?? "").map { _ in true } ?? false }.count
        let missedYesterday = members.filter { $0.eod(on: days.dropLast().last ?? "") == nil }.count
        return HStack(spacing: 10) {
            opsCell("\(members.count)", "Active")
            opsCell("\(filedToday)/\(members.count)", "Filed today")
            opsCell("\(missedYesterday)", "Missed yest", alert: missedYesterday > 0)
        }
    }

    private func opsCell(_ value: String, _ label: String, alert: Bool = false) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.title3.bold()).monospacedDigit().foregroundStyle(alert ? ivyRed : .white)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 62)
        .background(ivySurface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Member card

private struct MemberWeekCard: View {
    let member: MemberWeek
    let days: [String]
    @State private var open = false

    private var weekStatus: DayStatus {
        // Worst status across the week drives the header dot.
        let statuses = days.map { member.status(on: $0) }
        if statuses.contains(.missing) { return .missing }
        if statuses.contains(.missed) { return .missed }
        return .hit
    }

    var body: some View {
        SurfaceCard(padding: 18) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    AvatarBadge(name: member.name, color: member.color)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(member.name).font(.headline)
                        Text(member.roleLabel).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Circle().fill(weekStatus.color).frame(width: 10, height: 10)
                    Button { withAnimation(.snappy(duration: 0.24)) { open.toggle() } } label: {
                        HStack(spacing: 3) { Text(open ? "Hide" : "Detail"); Image(systemName: open ? "chevron.down" : "chevron.right") }
                            .font(.caption.bold()).foregroundStyle(.secondary)
                    }.buttonStyle(PressableButtonStyle())
                }
                Text(member.todayLine).font(.subheadline).foregroundStyle(.secondary)
                // Seven colored day chips
                HStack(spacing: 6) {
                    ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                        let status = member.status(on: day)
                        VStack(spacing: 3) {
                            Text(Self.weekday(day)).font(.system(size: 9, weight: .semibold)).foregroundStyle(status == .missing ? Color.secondary : Color.white.opacity(0.9))
                            Text(Self.dayNum(day)).font(.system(size: 11, weight: .bold)).monospacedDigit().foregroundStyle(status == .missing ? Color.secondary : Color.white)
                        }
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(status.fill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                if !member.weeklyValue.isEmpty {
                    HStack(spacing: 4) { Text(member.weeklyLabel + ":").foregroundStyle(.secondary); Text(member.weeklyValue).fontWeight(.semibold) }
                        .font(.subheadline)
                }
                if open { dayDetail }
            }
        }
    }

    private var dayDetail: some View {
        VStack(alignment: .leading, spacing: 14) {
            Divider().overlay(Color.white.opacity(0.08))
            ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                let status = member.status(on: day)
                HStack(alignment: .top, spacing: 10) {
                    Circle().fill(status.color).frame(width: 8, height: 8).padding(.top, 5)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(Self.longDay(day)).font(.caption).foregroundStyle(.secondary)
                        if let eod = member.eod(on: day) {
                            Text(member.daySummary(eod)).font(.caption)
                            if let wins = eod.wins, !wins.isEmpty { Text("Wins: \(wins)").font(.caption).foregroundStyle(ivyMint) }
                            if let blockers = eod.blockers, !blockers.isEmpty { Text("Blockers: \(blockers)").font(.caption).foregroundStyle(ivyOrange) }
                        } else {
                            Text("No EOD").font(.caption).foregroundStyle(ivyRed)
                        }
                    }
                    Spacer()
                }
            }
        }
    }

    private static func weekday(_ iso: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: iso) else { return "" }
        let o = DateFormatter(); o.dateFormat = "EEE"; return o.string(from: d)
    }
    private static func dayNum(_ iso: String) -> String { String(iso.suffix(2)) }
    private static func longDay(_ iso: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: iso) else { return iso }
        let o = DateFormatter(); o.dateFormat = "EEE, MMM d"; return o.string(from: d)
    }
}

// MARK: - Model

enum DayStatus { case hit, missed, missing
    var color: Color { switch self { case .hit: ivyMint; case .missed: ivyOrange; case .missing: ivyRed } }
    var fill: Color { switch self { case .hit: ivyMint.opacity(0.85); case .missed: ivyOrange.opacity(0.85); case .missing: ivySurface } }
}

struct MemberWeek: Identifiable {
    let id: UUID
    let name: String
    let color: Color
    let role: String             // setter | closer | coach | csm
    let setterType: String?      // phone | dm | full_cycle
    let eods: [EODActivity]      // this member's EODs in the window
    let weeklyLabel: String
    let weeklyValue: String

    var roleLabel: String {
        if role == "setter" {
            switch setterType { case "phone": return "Phone Setter"; case "dm": return "DM Setter"; case "full_cycle": return "Full Cycle Setter"; default: return "Setter" }
        }
        return role.capitalized
    }

    func eod(on day: String) -> EODActivity? { eods.first { $0.reportDate == day } }

    var todayLine: String { "" }

    func status(on day: String) -> DayStatus {
        guard let e = eod(on: day) else { return .missing }
        return hitKPI(e) ? .hit : .missed
    }

    private func hitKPI(_ e: EODActivity) -> Bool {
        switch role {
        case "setter":
            let primary = (setterType == "dm") ? (e.dmsSent ?? e.leadsContacted ?? 0) : (e.dials ?? 0)
            let target = (setterType == "dm") ? 125 : 100
            return primary >= target && (e.callsBooked ?? 0) >= 3
        case "closer", "coach": return (e.callsTaken ?? 0) > 0
        case "csm": return (e.studentCheckins ?? 0) > 0
        default: return true
        }
    }

    func daySummary(_ e: EODActivity) -> String {
        switch role {
        case "setter":
            let vol = (setterType == "dm") ? "\(e.dmsSent ?? e.leadsContacted ?? 0) DMs" : "\(e.dials ?? 0) dials"
            return "\(vol), \(e.callsBooked ?? 0) sets"
        case "closer", "coach":
            return "\(e.callsTaken ?? 0) calls, \(e.closes ?? 0) closes, $\(Int(e.cashCollected ?? 0))"
        case "csm":
            return "\(e.studentCheckins ?? 0) check-ins, \(e.loomsReviewed ?? 0) looms"
        default: return ""
        }
    }
}
