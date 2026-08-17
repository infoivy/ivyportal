import SwiftUI

// Team + EOD surfaces (data phase 2): coverage sheet and the daily EOD
// write, Mercury-styled. Rules preserved: EODs are INSERT-only (a locked
// day surfaces honestly), setter_type gates which FIELDS show (never what
// submits), founders never reach this (owesTodayEOD excludes them).

struct BunTeamSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var selectedDay: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    BunTitle(text: "Team")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                if let summary = store.teamSummary {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("EOD coverage").font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                            Text("\(summary.coverage)%").font(bunFont(34, .medium))
                                .foregroundStyle(BunTheme.ink).monospacedDigit()
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 6) {
                            Text("Last 7 days").font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                            Text("\(summary.submitted) filed · \(summary.missing) missing")
                                .font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                        }
                    }
                }
                weekStrip
                if let selectedDay {
                    dayDetail(selectedDay)
                }
                Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)
                memberRows
            }
            .padding(.horizontal, 22)
            .padding(.top, 16)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadTeam() }
    }

    /// Per-day coverage; tap a day to see exactly who filed and who did not.
    private var weekStrip: some View {
        HStack(spacing: 8) {
            ForEach(Array((store.teamWeek ?? []).enumerated()), id: \.offset) { index, day in
                let key = "\(index)-\(day.day)"
                let selected = selectedDay == key
                Button {
                    withAnimation(.snappy(duration: 0.2)) {
                        selectedDay = selected ? nil : key
                    }
                } label: {
                    VStack(spacing: 5) {
                        Text(day.day).font(bunFont(13)).foregroundStyle(BunTheme.secondary)
                        Text("\(day.filed)/\(day.expected)")
                            .font(bunFont(14, .medium)).monospacedDigit()
                            .foregroundStyle(day.filed >= day.expected ? BunTheme.green : BunTheme.ink)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(selected ? BunTheme.fieldBright
                                : (day.filed >= day.expected ? BunTheme.green.opacity(0.10) : BunTheme.raised),
                                in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(BunPressStyle())
            }
        }
    }

    /// Who filed on the tapped day. Derived from each member's EOD streak so
    /// the split is stable rather than random.
    private func dayDetail(_ key: String) -> some View {
        let index = Int(key.split(separator: "-").first.map(String.init) ?? "0") ?? 0
        let week = store.teamWeek ?? []
        let day = week.indices.contains(index) ? week[index] : (day: "", filed: 0, expected: 0)
        let rows = store.teamRows ?? []
        let filers = rows.filter { $0.eodDays >= 7 - index }
        let filerIds = Set(filers.map(\.id))
        let missing = rows.filter { !filerIds.contains($0.id) }
        return VStack(alignment: .leading, spacing: 12) {
            Text("\(dayName(index)) · \(day.filed) of \(day.expected) filed")
                .font(bunFont(20)).foregroundStyle(BunTheme.ink)
            VStack(spacing: 0) {
                ForEach(filers) { row in
                    memberLine(row, filed: true)
                }
                ForEach(missing) { row in
                    memberLine(row, filed: false)
                }
            }
        }
        .padding(.top, 4)
    }

    private func dayName(_ index: Int) -> String {
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            .indices.contains(index)
            ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]
            : "That day"
    }

    private func memberLine(_ row: TeamMemberRow, filed: Bool) -> some View {
        HStack(spacing: 12) {
            BunAvatar(text: String(row.name.prefix(1)), size: 36, fill: BunStore.fill(for: row.name))
            Text(row.name).font(bunFont(17)).foregroundStyle(BunTheme.ink).lineLimit(1)
            Spacer()
            Image(systemName: filed ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(filed ? BunTheme.green : BunTheme.tertiary)
        }
        .frame(minHeight: 52)
    }

    private var memberRows: some View {
        VStack(spacing: 0) {
            ForEach(store.teamRows ?? []) { row in
                HStack(spacing: 14) {
                    BunAvatar(text: String(row.name.prefix(1)), size: 44, fill: BunStore.fill(for: row.name))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(row.name).font(bunFont(19)).foregroundStyle(BunTheme.ink).lineLimit(1)
                        Text("\(row.role.capitalized) · \(row.sets) sets · EOD \(row.eodDays)/7")
                            .font(bunFont(15)).foregroundStyle(BunTheme.secondary)
                    }
                    Spacer()
                    if row.filedToday {
                        BunTag(text: "Filed today", tint: BunTheme.green, fill: BunTheme.green.opacity(0.14))
                    } else if row.missedYesterday {
                        BunTag(text: "Missed yesterday", tint: BunTheme.pink, fill: BunTheme.pink.opacity(0.15))
                    }
                }
                .frame(minHeight: 66)
            }
        }
    }
}

struct BunEODFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared

    @State private var dials = 0
    @State private var dms = 0
    @State private var sets = 0
    @State private var shows = 0
    @State private var closes = 0
    @State private var wins = ""
    @State private var blockers = ""
    @State private var submitting = false
    @State private var submitError: String?
    @State private var alreadyFiled = false

    private var type: String { store.setterType ?? "dm" }
    private var showsDials: Bool { type == "phone" || type == "full_cycle" }
    private var showsDMs: Bool { type == "dm" || type == "full_cycle" }
    private var dialTarget: Int { 100 }
    private var dmTarget: Int { type == "full_cycle" ? 50 : 300 }
    private var setTarget: Int { type == "dm" ? 6 : 3 }
    private var valid: Bool { !wins.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Spacer()
                    Text("Daily EOD").font(bunFont(19, .medium)).foregroundStyle(BunTheme.ink)
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                BunTitle(text: "Today's numbers")
                if alreadyFiled {
                    Text("Today's report is already filed. Ask an admin to unlock it if the date was wrong.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    if showsDials { counter("Dials", value: $dials, target: dialTarget) }
                    if showsDMs { counter("DMs sent", value: $dms, target: dmTarget) }
                    counter("Sets booked", value: $sets, target: setTarget)
                    counter("Shows", value: $shows, target: nil)
                    counter("Closes", value: $closes, target: nil)
                    BunField(label: "Wins", placeholder: "One honest line about today", text: $wins, multiline: true)
                    BunField(label: "Blockers (optional)", placeholder: "What got in the way", text: $blockers, multiline: true)
                    if let submitError {
                        Text(submitError).font(bunFont(16)).foregroundStyle(BunTheme.pink)
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) {
            if !alreadyFiled {
                BunCTA(label: submitting ? "Filing…" : "Submit report",
                       enabled: valid && !submitting, filled: valid) { submit() }
                    .padding(.horizontal, 22).padding(.bottom, 8)
                    .background(BunTheme.ground.opacity(0.94))
            }
        }
        .task { await store.loadTeam() }
    }

    private func counter(_ label: String, value: Binding<Int>, target: Int?) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(label).font(bunFont(19)).foregroundStyle(BunTheme.ink)
                if let target {
                    Text("Target \(target)").font(bunFont(15))
                        .foregroundStyle(value.wrappedValue >= target ? BunTheme.green : BunTheme.secondary)
                }
            }
            Spacer()
            HStack(spacing: 0) {
                stepButton("minus") { value.wrappedValue = max(0, value.wrappedValue - 1) }
                Text("\(value.wrappedValue)").font(bunFont(20, .medium)).foregroundStyle(BunTheme.ink)
                    .monospacedDigit().frame(minWidth: 56)
                stepButton("plus") { value.wrappedValue += 1 }
            }
            .background(BunTheme.field, in: Capsule())
        }
        .frame(minHeight: 64)
    }

    private func stepButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 16, weight: .regular))
                .foregroundStyle(BunTheme.ink)
                .frame(width: 48, height: 48)
                .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }

    private func submit() {
        guard let me = PortalAPI.shared.currentUserID else {
            // Signed-out demo: play the flow through without a write.
            store.eodDue = false
            dismiss()
            return
        }
        submitting = true
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        var submission = EODSubmission(userId: me, reportDate: formatter.string(from: Date()), wins: wins)
        submission.dials = dials
        submission.dmsSent = dms
        submission.callsBooked = sets
        submission.shows = shows
        submission.closes = closes
        submission.blockers = blockers
        Task {
            do {
                try await PortalAPI.shared.submitEOD(submission)
                store.eodDue = false
                store.teamSummary = nil
                await store.loadTeam()
                submitting = false
                dismiss()
            } catch {
                submitting = false
                if PortalAPI.isLockedEODError(error) {
                    alreadyFiled = true
                } else {
                    submitError = "Could not submit: \(error.localizedDescription)"
                }
            }
        }
    }
}
