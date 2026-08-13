import SwiftUI

#if DEBUG
enum DemoEODStatus: String, Hashable { case submitted, pending, missing }
struct DemoEOD: Identifiable {
    let id = UUID()
    let name: String
    let color: Color
    let status: DemoEODStatus
    let line: String
    let content: String
}

struct EODSheet: View {
    @Environment(\.dismiss) private var dismiss
    let person: DemoEOD
    let submitted: Bool
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    HStack(spacing: 12) { AvatarBadge(name: person.name, color: person.color); Text(person.name).font(.title2.bold()) }
                    Spacer()
                    Button("Done") { dismiss() }
                }
                StatusPill(title: submitted || person.status == .submitted ? "Submitted" : person.status == .pending ? "Pending" : "Missing", color: submitted || person.status == .submitted ? ivyGreen : person.status == .pending ? .orange : .red)
                if person.status == .submitted || submitted {
                    SurfaceCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("TODAY'S EOD").font(.caption.bold()).tracking(1).foregroundStyle(.secondary)
                            Text(person.content).font(.subheadline)
                        }
                    }
                } else {
                    StatusCard(symbol: person.status == .pending ? "clock.fill" : "exclamationmark.triangle.fill", title: person.status == .pending ? "EOD pending" : "EOD missing", message: person.status == .pending ? "Still within today's reporting window." : "No EOD was submitted today. Reach out before the daily review.")
                }
                Text("Debug fixture · Production EODs come from the Portal").font(.caption).foregroundStyle(.tertiary)
            }.padding(24)
        }
        .presentationDetents([.large])
        .presentationBackground(ivySurface)
    }
}

struct EODSubmitSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onSave: (String) -> Void
    @State private var dials = ""
    @State private var connects = ""
    @State private var sets = ""
    @State private var notes = ""
    @State private var name = "You"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Daily EOD").font(.title2.bold())
                    Text("Debug fixture · Saved locally only; production EODs require the Portal API.").font(.subheadline).foregroundStyle(.secondary)
                    HStack(spacing: 10) {
                        EODField(title: "Dials", text: $dials)
                        EODField(title: "Connects", text: $connects)
                        EODField(title: "Sets", text: $sets)
                    }
                    TextField("Notes (what worked, what blocked)", text: $notes, axis: .vertical).padding(14).background(ivySurface, in: RoundedRectangle(cornerRadius: 16)).lineLimit(3...6)
                }.padding(20)
            }
            .navigationTitle("Submit EOD").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { onSave(name) }
                        .disabled(dials.trimmingCharacters(in: .whitespaces).isEmpty)
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(.black)
    }
}

private struct EODField: View {
    let title: String
    @Binding var text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption.bold()).foregroundStyle(.secondary)
            TextField("0", text: $text).keyboardType(.numberPad).font(.title3.bold()).padding(12).background(ivySurface, in: RoundedRectangle(cornerRadius: 14))
        }
    }
}



private struct TeammateMetric: Identifiable {
    let id = UUID()
    let name, value, rate: String
    let color: Color
    static let replies = [
        TeammateMetric(name: "Haroon Quraishi", value: "134", rate: "71%", color: .purple),
        TeammateMetric(name: "Masood Ali", value: "118", rate: "68%", color: .pink),
        TeammateMetric(name: "Aalian Khan", value: "97", rate: "64%", color: .blue),
        TeammateMetric(name: "Abdelmalik", value: "76", rate: "59%", color: ivyGreen),
    ]
}

private extension PerformanceMetric {
    var title: String {
        switch self {
        case .totalMessages: "Total messages sent"
        case .totalReplies: "Total replies received"
        case .followUps: "Follow-ups sent"
        case .linksSent: "Links sent"
        case .bookedCalls: "Booked calls"
        case .activeHours: "Active hours"
        case .setterReplies: "Setter replies"
        case .scriptAnalysis: "Script analysis"
        }
    }
    var primaryValue: String {
        switch self {
        case .totalMessages: "601"
        case .totalReplies: "476"
        case .followUps: "289"
        case .linksSent: "0"
        case .bookedCalls: "18"
        case .activeHours: "7.2"
        case .setterReplies: "425"
        case .scriptAnalysis: "92%"
        }
    }
    var primaryLabel: String {
        switch self {
        case .totalMessages: "Messages"
        case .totalReplies: "Replies"
        case .followUps: "Follow-ups"
        case .linksSent: "Links"
        case .bookedCalls: "Booked"
        case .activeHours: "Hours"
        case .setterReplies: "Replies"
        case .scriptAnalysis: "Quality"
        }
    }
    var secondaryValue: String {
        switch self {
        case .totalMessages: "1.8%"
        case .totalReplies: "79%"
        case .followUps: "48%"
        case .linksSent: "0%"
        case .bookedCalls: "67%"
        case .activeHours: "9 AM"
        case .setterReplies: "38%"
        case .scriptAnalysis: "B+"
        }
    }
    var secondaryLabel: String {
        switch self {
        case .totalMessages: "Reply rate"
        case .totalReplies: "Outreach vs inbound"
        case .followUps: "Of messages"
        case .linksSent: "Verified"
        case .bookedCalls: "Show rate"
        case .activeHours: "Peak hour"
        case .setterReplies: "Of replies"
        case .scriptAnalysis: "Grade"
        }
    }
}

#endif
