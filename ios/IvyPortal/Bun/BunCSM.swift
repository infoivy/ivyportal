import SwiftUI
import Charts

// CSM workspace (web /csm, founder "go ahead with all" 2026-08-18). The
// fulfillment half of the business: what the roster produced, where everyone
// stands, the one-tap tally a CSM keeps during the day, and the team's notes.
// It opens from the Clients tab, which is where that work already lives.

struct BunCSMSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var tallyError: String?

    private static let kinds: [(kind: String, label: String, symbol: String)] = [
        ("checkin", "Check-ins", "message.badge"),
        ("loom", "Looms", "video"),
        ("roleplay", "Roleplays", "person.wave.2"),
        ("escalation", "Escalations", "exclamationmark.triangle"),
    ]

    private var active: [StudentRosterItem] {
        (store.roster ?? []).filter { $0.status == "active" && $0.archivedAt == nil }
    }

    private var landed: Int {
        active.filter { ["offer_won", "testimonial", "graduated"].contains(store.phase(of: $0)) }.count
    }

    private var firstWins: Int { active.filter { $0.firstWinAt != nil }.count }

    /// Landed roles over the whole active roster — the number the fulfillment
    /// side is actually judged on.
    private var successRate: Int {
        guard !active.isEmpty else { return 0 }
        return Int((Double(landed) / Double(active.count) * 100).rounded())
    }

    private var phases: [(name: String, count: Int)] {
        let counts = active.reduce(into: [String: Int]()) { totals, client in
            totals[store.phase(of: client), default: 0] += 1
        }
        return ["onboarding", "training", "applying", "offer_won"]
            .compactMap { key in counts[key].map { (name: BunClientSheet.phaseLabel(key), count: $0) } }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack {
                    BunTitle(text: "Workspace")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                standingBlock
                edgeHairline
                tallyBlock
                edgeHairline
                outputBlock
                edgeHairline
                notesBlock
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task {
            await store.loadClients()
            await store.loadOps()
            await store.loadPictures()
            await store.loadCSM()
        }
    }

    // MARK: Standing

    private var standingBlock: some View {
        let delivery = store.delivery
        return VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 0) {
                stat("Landed roles", value: "\(landed)", tone: BunTheme.green)
                stat("Success rate", value: "\(successRate)%")
                stat("First wins", value: "\(firstWins)")
            }
            if !phases.isEmpty {
                phaseBar
                // Four labels do not fit on one phone line; scroll rather
                // than wrap a legend into two ragged rows.
                ScrollView(.horizontal) {
                    HStack(spacing: 14) {
                        ForEach(phases, id: \.name) { phase in
                            HStack(spacing: 6) {
                                Circle().fill(BunClientSheet.phaseTint(phaseKey(phase.name)))
                                    .frame(width: 7, height: 7)
                                Text("\(phase.name) \(phase.count)")
                                    .font(bunFont(14)).foregroundStyle(BunTheme.secondary)
                                    .lineLimit(1).fixedSize()
                            }
                        }
                    }
                    .padding(.horizontal, 22)
                }
                .scrollIndicators(.hidden)
                .padding(.horizontal, -22)
            }
            Text("\(delivery.atRisk) at risk · \(delivery.quiet14) quiet 14 days · \(delivery.dueCheckin) due a check-in")
                .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                .lineLimit(1).minimumScaleFactor(0.8)
        }
    }

    private func phaseKey(_ label: String) -> String {
        switch label {
        case "Onboarding": "onboarding"
        case "Training": "training"
        case "Applying": "applying"
        case "Offer won": "offer_won"
        default: "onboarding"
        }
    }

    private var phaseBar: some View {
        GeometryReader { geo in
            HStack(spacing: 2) {
                ForEach(phases, id: \.name) { phase in
                    Capsule().fill(BunClientSheet.phaseTint(phaseKey(phase.name)))
                        .frame(width: max(4, geo.size.width * Double(phase.count) / Double(max(active.count, 1))))
                }
            }
        }
        .frame(height: 8)
    }

    // MARK: Tally

    /// One tap per thing done. Long-press takes it back, because a miscount
    /// that cannot be undone is worse than no count.
    private var tallyBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today's tally").font(BunType.section).foregroundStyle(BunTheme.ink)
            Text("Tap to count · hold to take one back")
                .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
            if let tallyError {
                Text(tallyError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
            }
            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(Self.kinds, id: \.kind) { item in
                        Button {
                            Task {
                                do { try await store.tally(item.kind); tallyError = nil }
                                catch { tallyError = "Could not count that: \(error.localizedDescription)" }
                            }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: item.symbol).font(.system(size: 14, weight: .regular))
                                Text("\(store.tallyCounts[item.kind] ?? 0)")
                                    .font(bunFont(17, .medium)).monospacedDigit()
                                Text(item.label).font(bunFont(15)).foregroundStyle(BunTheme.secondary)
                            }
                            .foregroundStyle(BunTheme.ink)
                            .padding(.horizontal, 14).frame(height: 44)
                            .background(BunTheme.raised, in: Capsule())
                        }
                        .buttonStyle(BunPressStyle())
                        .onLongPressGesture {
                            Task {
                                do { try await store.undoTally(item.kind); tallyError = nil }
                                catch { tallyError = "Could not undo: \(error.localizedDescription)" }
                            }
                        }
                    }
                }
                .padding(.horizontal, 22)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -22)
        }
    }

    // MARK: Output

    private var outputBlock: some View {
        let series = store.clientOutput
        let peak = max(series.map(\.value).max() ?? 0, 1)
        return VStack(alignment: .leading, spacing: 12) {
            Text("Client output").font(BunType.section).foregroundStyle(BunTheme.ink)
            Text("applications, outreach and interviews · last 14 days")
                .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
            if series.allSatisfy({ $0.value == 0 }) {
                Text("Nothing reported yet in this window.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                Chart {
                    ForEach(series, id: \.day) { point in
                        BarMark(x: .value("Day", point.day),
                                y: .value("Output", point.value),
                                width: .fixed(10))
                            .cornerRadius(4)
                            .foregroundStyle(BunTheme.indigo.opacity(0.35 + 0.65 * Double(point.value) / Double(peak)))
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { _ in
                        AxisValueLabel().font(bunFont(12)).foregroundStyle(BunTheme.tertiary)
                        AxisGridLine().foregroundStyle(BunTheme.hairline)
                    }
                }
                .frame(height: 130)
            }
        }
    }

    // MARK: Notes

    private var notesBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Latest notes").font(BunType.section).foregroundStyle(BunTheme.ink)
            if store.csmFeed == nil {
                RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 60)
            } else if (store.csmFeed ?? []).isEmpty {
                Text("No notes written yet.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(store.csmFeed ?? []) { note in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(note.author).font(BunType.caption).foregroundStyle(BunTheme.ink)
                                Text("on \(note.studentName)").font(BunType.caption)
                                    .foregroundStyle(BunTheme.secondary).lineLimit(1)
                                Spacer()
                                Text(PortalAPI.parseTimestamp(note.createdAt).map { BunStore.friendlyDay($0) } ?? "")
                                    .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                            }
                            Text(note.note).font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 12)
                    }
                }
            }
        }
    }

    private func stat(_ label: String, value: String, tone: Color = BunTheme.ink) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
                .lineLimit(1).minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(value).font(bunFont(26, .medium)).foregroundStyle(tone).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var edgeHairline: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)
    }
}
