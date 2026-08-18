import SwiftUI

// The closer's calendar (founder 2026-08-18: "add the closer calendar thing
// and then they claim sets"). Setters book, closers take. Sets arrive in the
// pool unowned — from Calendly, from the web, from a setter's own booking —
// and this is where a closer sees the week and claims one.
//
// Claiming is a plain row update; the database decides who may (policy
// "Sales staff claim unclaimed sets": sales roles only, unclaimed rows only,
// and the new owner must be the caller).

struct BunCalendarSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var scope = 0
    @State private var busy: UUID?
    @State private var writeError: String?

    private static let scopes = ["To claim", "Mine", "All"]

    private struct Day: Identifiable {
        let id: String
        let label: String
        let sets: [PortalAPI.SetReminderFull]
    }

    private var mine: [PortalAPI.SetReminderFull] { store.mySets ?? [] }
    private var pool: [PortalAPI.SetReminderFull] { store.unclaimedSets ?? [] }

    private var visible: [PortalAPI.SetReminderFull] {
        switch scope {
        case 1: mine
        case 2: (mine + pool).sorted { $0.eventStart < $1.eventStart }
        default: pool
        }
    }

    /// Grouped by the day the call actually falls on, soonest first.
    private var days: [Day] {
        let grouped = Dictionary(grouping: visible) { String($0.eventStart.prefix(10)) }
        return grouped.keys.sorted().map { key in
            Day(id: key,
                label: BunStore.parseDay(key).map { BunStore.friendlyDay($0) } ?? key,
                sets: (grouped[key] ?? []).sorted { $0.eventStart < $1.eventStart })
        }
    }

    private var loading: Bool { store.mySets == nil && store.unclaimedSets == nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    BunTitle(text: "Calendar")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                Text("Booked calls. Anything unowned is up for grabs.")
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)

                BunSegment(options: Self.scopes, selection: $scope)

                if let writeError {
                    Text(writeError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }

                if loading {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 62)
                    }
                } else if days.isEmpty {
                    Text(emptyLine)
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                        .padding(.top, 6)
                } else {
                    ForEach(days) { day in
                        dayBlock(day)
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadSets() }
        .refreshable {
            store.mySets = nil
            store.unclaimedSets = nil
            store.unclaimedSetCount = nil
            await store.loadSets()
        }
    }

    private var emptyLine: String {
        switch scope {
        case 1: "Nothing on your calendar yet. Claim one from the pool."
        case 2: "No calls booked."
        default: "Every booked call has an owner. Nothing to claim."
        }
    }

    private func dayBlock(_ day: Day) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(day.label.uppercased())
                .font(bunFont(13, .medium)).tracking(0.8)
                .foregroundStyle(BunTheme.secondary)
                .padding(.top, 8)
            VStack(spacing: 0) {
                ForEach(day.sets) { set in
                    setRow(set)
                }
            }
        }
    }

    private func setRow(_ set: PortalAPI.SetReminderFull) -> some View {
        let unowned = set.ownerId == nil
        return HStack(spacing: 14) {
            BunAvatar(text: String(set.prospect.prefix(1)), size: 44,
                      fill: BunStore.fill(for: set.prospect))
            VStack(alignment: .leading, spacing: 3) {
                Text(set.prospect).font(BunType.rowTitle)
                    .foregroundStyle(BunTheme.ink).lineLimit(1)
                Text(timeLine(set))
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            if busy == set.id {
                ProgressView().tint(BunTheme.secondary)
            } else if unowned {
                Button { claim(set) } label: {
                    Text("Claim").font(bunFont(15, .medium)).foregroundStyle(.white)
                        .padding(.horizontal, 16).frame(height: 38)
                        .background(BunTheme.indigo, in: Capsule())
                }
                .buttonStyle(BunPressStyle())
            } else if set.confirmedAt != nil {
                BunTag(text: "Confirmed", tint: BunTheme.green, fill: BunTheme.green.opacity(0.14))
            } else {
                Button { confirm(set) } label: {
                    Text("Confirm").font(bunFont(15, .medium)).foregroundStyle(BunTheme.indigoLight)
                        .padding(.horizontal, 16).frame(height: 38)
                        .background(BunTheme.field, in: Capsule())
                }
                .buttonStyle(BunPressStyle())
            }
        }
        .frame(minHeight: 68)
    }

    /// Time first, then whatever the setter left behind about the prospect.
    private func timeLine(_ set: PortalAPI.SetReminderFull) -> String {
        var bits: [String] = []
        if let date = PortalAPI.parseTimestamp(set.eventStart) {
            let formatter = DateFormatter()
            formatter.dateFormat = "h:mm a"
            bits.append(formatter.string(from: date))
        }
        if let notes = set.notes, !notes.isEmpty { bits.append(notes) }
        return bits.joined(separator: " · ")
    }

    private func claim(_ set: PortalAPI.SetReminderFull) {
        busy = set.id
        Task {
            do {
                try await store.claim(set)
                writeError = nil
                // Show it where it landed rather than leaving an empty pool.
                if scope == 0 { withAnimation(.snappy(duration: 0.2)) { scope = 1 } }
            } catch {
                writeError = "Could not claim that set: \(error.localizedDescription)"
            }
            busy = nil
        }
    }

    private func confirm(_ set: PortalAPI.SetReminderFull) {
        busy = set.id
        Task {
            do { try await store.confirmSet(set); writeError = nil }
            catch { writeError = "Could not confirm: \(error.localizedDescription)" }
            busy = nil
        }
    }
}
