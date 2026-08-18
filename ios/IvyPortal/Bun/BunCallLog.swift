import SwiftUI

// Logging a 1:1 call from the phone (daily loop, founder 2026-08-18). The web
// /calls modal writes rating, notes, next step, Fathom link and the action
// items the student ticks off in their own portal — drop any of those and the
// call stops feeding the cadence math and the student's queue, so all of them
// ship here. Group-pathway clients never see this: they own no 1:1 surfaces.

struct BunLogCallFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    let student: StudentRosterItem

    @State private var rating = 3
    @State private var dayChoice = 0
    @State private var notes = ""
    @State private var nextStep = ""
    @State private var fathom = ""
    @State private var items: [String] = [""]
    @State private var submitting = false
    @State private var submitError: String?

    private var callDate: String {
        let date = Calendar.current.date(byAdding: .day, value: -dayChoice, to: Date()) ?? Date()
        return BunStore.dayKey(date)
    }

    private var cleanItems: [String] {
        items.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }

    private var valid: Bool { !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    BunTitle(text: "Log a call")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                HStack(spacing: 14) {
                    BunAvatar(text: String(student.fullName.prefix(1)), size: 46,
                              fill: BunStore.fill(for: student.fullName))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(student.fullName).font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                        Text("\(store.callCounts?[student.id] ?? 0) of \(student.callsAllotted ?? 0) calls used")
                            .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("When").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    BunSegment(options: ["Today", "Yesterday"], selection: $dayChoice)
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Progress").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    HStack(spacing: 10) {
                        ForEach(1...5, id: \.self) { value in
                            Button { rating = value } label: {
                                Image(systemName: value <= rating ? "star.fill" : "star")
                                    .font(.system(size: 22, weight: .regular))
                                    .foregroundStyle(value <= rating ? BunTheme.indigoLight : BunTheme.tertiary)
                                    .frame(width: 46, height: 46)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(BunPressStyle())
                            .accessibilityLabel("\(value) of 5")
                        }
                    }
                }

                BunField(label: "Coach notes", placeholder: "What happened on the call", text: $notes, multiline: true)
                BunField(label: "Next step (optional)", placeholder: "What they owe before the next call", text: $nextStep)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Action items").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    Text("They tick these off in their own portal.")
                        .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    ForEach(items.indices, id: \.self) { index in
                        TextField("", text: $items[index],
                                  prompt: Text("Item \(index + 1)").font(bunFont(19)).foregroundStyle(BunTheme.tertiary))
                            .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                            .padding(.horizontal, 18)
                            .frame(minHeight: 58)
                            .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    BunPillChip(symbol: "plus", label: "Add another") { items.append("") }
                }

                BunField(label: "Recording link (optional)", placeholder: "Fathom or Loom URL", text: $fathom)

                if let submitError {
                    Text(submitError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: submitting ? "Saving…" : "Save call", enabled: valid && !submitting, filled: valid) { submit() }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
                .background(BunTheme.ground.opacity(0.94))
        }
    }

    private func submit() {
        submitting = true
        // The coach is whoever is logging it. Reassigning a call to another
        // coach stays a web job — on the phone you log your own.
        let call = NewStudentCall(
            studentId: student.id,
            coachId: PortalAPI.shared.currentUserID ?? store.meId,
            callDate: callDate,
            progressRating: rating,
            outcome: nil,
            coachNotes: notes.trimmingCharacters(in: .whitespacesAndNewlines),
            actionItemsJson: cleanItems.map { CallActionItem(text: $0) },
            nextStep: nextStep.isEmpty ? nil : nextStep,
            fathomUrl: fathom.isEmpty ? nil : fathom
        )
        Task {
            do {
                try await store.logCall(call)
                submitting = false
                dismiss()
            } catch {
                submitting = false
                submitError = "Could not save the call: \(error.localizedDescription)"
            }
        }
    }
}

/// The client's 1:1 history, as read on their account page.
struct BunCallHistory: View {
    @State private var store = BunStore.shared
    let student: StudentRosterItem

    private var calls: [StudentCall] { store.callsByStudent[student.id] ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if store.callsByStudent[student.id] == nil {
                RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 54)
            } else if calls.isEmpty {
                Text("No 1:1 calls logged yet.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(calls) { call in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 10) {
                                Text(BunStore.parseDay(call.callDate).map { BunStore.friendlyDay($0) } ?? "Recently")
                                    .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                                Spacer()
                                if let rating = call.progressRating {
                                    HStack(spacing: 3) {
                                        ForEach(1...5, id: \.self) { value in
                                            Image(systemName: value <= rating ? "star.fill" : "star")
                                                .font(.system(size: 11, weight: .regular))
                                                .foregroundStyle(value <= rating ? BunTheme.indigoLight : BunTheme.tertiary)
                                        }
                                    }
                                }
                            }
                            if let notes = call.coachNotes, !notes.isEmpty {
                                Text(notes).font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                    .lineLimit(3)
                            }
                            if let next = call.nextStep, !next.isEmpty {
                                Text("Next · \(next)").font(BunType.caption).foregroundStyle(BunTheme.indigoLight)
                                    .lineLimit(2)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 12)
                    }
                }
            }
        }
        .task { await store.loadCalls(for: student.id) }
    }
}
