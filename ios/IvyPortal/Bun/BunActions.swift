import SwiftUI

// Action items on the phone (daily loop, founder 2026-08-18). The web hub
// merges two sources — ad-hoc rows and items coaches wrote onto calls — so
// this does too: an open count that quietly dropped half the work would be
// worse than no count. Filters mirror the web's Open / Mine / Overdue.

/// One queue row: tick circle, item, who it belongs to and when it is due.
struct BunTaskRow: View {
    let task: BunStore.BunTask
    /// Home keeps rows to one line (no wrapping in a dense list); the hub is
    /// where the whole item is meant to be read.
    var lines = 1
    let toggle: () -> Void

    private var caption: String {
        let due = task.due.map { BunStore.friendlyDue($0) }
        return [task.subject, due].compactMap { $0 }.joined(separator: " · ")
    }

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .strokeBorder(task.done ? BunTheme.green : BunTheme.tertiary, lineWidth: 1.5)
                        .frame(width: 26, height: 26)
                    if task.done {
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(BunTheme.green)
                    }
                }
                .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 3) {
                    Text(task.text)
                        .font(BunType.rowTitle)
                        .foregroundStyle(task.done ? BunTheme.secondary : BunTheme.ink)
                        .strikethrough(task.done, color: BunTheme.secondary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(lines)
                    Text(caption)
                        .font(BunType.caption)
                        .foregroundStyle(task.isOverdue ? BunTheme.pink : BunTheme.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
            }
            .frame(minHeight: 66)
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }
}

struct BunActionItemsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var filter = 0
    @State private var showAdd = false
    @State private var writeError: String?

    private static let filters = ["Open", "Mine", "Overdue"]

    private var visible: [BunStore.BunTask] {
        let all = store.tasks
        return switch filter {
        case 1: all.filter { !$0.done && $0.ownerId == store.meId }
        case 2: all.filter(\.isOverdue)
        default: all.filter { !$0.done }
        }
    }

    private var clientTasks: [BunStore.BunTask] { visible.filter(\.isClient) }
    private var teamTasks: [BunStore.BunTask] { visible.filter { !$0.isClient } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    BunTitle(text: "Action items")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                BunSegment(options: Self.filters, selection: $filter)

                if let writeError {
                    Text(writeError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }

                if store.actionItems == nil {
                    ForEach(0..<4, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 54)
                    }
                } else if visible.isEmpty {
                    Text(emptyLine)
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                        .padding(.top, 6)
                } else {
                    group("Clients", tasks: clientTasks)
                    group("Team", tasks: teamTasks)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: "Add an item", symbol: "plus", filled: true) { showAdd = true }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
                .background(BunTheme.ground.opacity(0.94))
        }
        .sheet(isPresented: $showAdd) {
            BunAddTaskSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .task { await store.loadActionItems() }
    }

    private var emptyLine: String {
        switch filter {
        case 1: "Nothing assigned to you right now."
        case 2: "Nothing is overdue. Good."
        default: "The queue is clear."
        }
    }

    @ViewBuilder private func group(_ title: String, tasks: [BunStore.BunTask]) -> some View {
        if !tasks.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text(title.uppercased())
                    .font(bunFont(13, .medium)).tracking(0.8)
                    .foregroundStyle(BunTheme.secondary)
                    .padding(.top, 8)
                ForEach(tasks) { task in
                    BunTaskRow(task: task, lines: 2) { toggle(task) }
                        .contextMenu {
                            if task.canDelete {
                                Button("Delete", role: .destructive) { remove(task) }
                            }
                        }
                }
            }
        }
    }

    private func toggle(_ task: BunStore.BunTask) {
        Task {
            do {
                try await store.setTaskDone(task, done: !task.done)
                writeError = nil
            } catch {
                writeError = "Could not save that tick: \(error.localizedDescription)"
            }
        }
    }

    private func remove(_ task: BunStore.BunTask) {
        Task {
            do {
                try await store.deleteTask(task)
                writeError = nil
            } catch {
                writeError = "Could not delete: \(error.localizedDescription)"
            }
        }
    }
}

/// The composer. One item, many targets — the web inserts one row per person
/// and so does this.
struct BunAddTaskSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var text = ""
    @State private var dueChoice = 0
    @State private var search = ""
    @State private var pickedStudents: Set<UUID> = []
    @State private var pickedMembers: Set<UUID> = []
    @State private var saving = false
    @State private var saveError: String?

    private static let dueOptions = ["No date", "Today", "Tomorrow", "In a week"]

    private var due: String? {
        let offset: Int
        switch dueChoice {
        case 1: offset = 0
        case 2: offset = 1
        case 3: offset = 7
        default: return nil
        }
        let date = Calendar.current.date(byAdding: .day, value: offset, to: Date()) ?? Date()
        return BunStore.dayKey(date)
    }

    private var students: [StudentRosterItem] {
        let all = store.prioritizedRoster.filter { $0.archivedAt == nil }
        guard !search.isEmpty else { return all }
        return all.filter { $0.fullName.localizedCaseInsensitiveContains(search) }
    }

    private var members: [StaffProfile] {
        let all = store.teamMembers ?? []
        guard !search.isEmpty else { return all }
        return all.filter { ($0.displayName ?? "").localizedCaseInsensitiveContains(search) }
    }

    private var valid: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !(pickedStudents.isEmpty && pickedMembers.isEmpty)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunTitle(text: "New item")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                BunField(label: "Item", placeholder: "What needs doing", text: $text, multiline: true)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Due").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    BunSegment(options: Self.dueOptions, selection: $dueChoice)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("For").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    BunSearchField(text: $search)
                    pickerGroup("Clients", rows: students.map { ($0.id, $0.fullName) }, picked: $pickedStudents)
                    pickerGroup("Team", rows: members.map { ($0.id, $0.displayName ?? "Team member") },
                                picked: $pickedMembers)
                }

                if let saveError {
                    Text(saveError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: saving ? "Adding…" : "Add item", enabled: valid && !saving, filled: valid) { save() }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
                .background(BunTheme.ground.opacity(0.94))
        }
        .task { await store.loadActionItems() }
    }

    @ViewBuilder private func pickerGroup(_ title: String, rows: [(UUID, String)],
                                          picked: Binding<Set<UUID>>) -> some View {
        if !rows.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(bunFont(13, .medium)).tracking(0.8)
                    .foregroundStyle(BunTheme.secondary)
                    .padding(.top, 8)
                ForEach(rows.prefix(search.isEmpty ? 6 : 20), id: \.0) { id, name in
                    Button {
                        if picked.wrappedValue.contains(id) {
                            picked.wrappedValue.remove(id)
                        } else {
                            picked.wrappedValue.insert(id)
                        }
                    } label: {
                        HStack(spacing: 14) {
                            BunAvatar(text: String(name.prefix(1)), size: 40, fill: BunStore.fill(for: name))
                            Text(name).font(bunFont(18)).foregroundStyle(BunTheme.ink).lineLimit(1)
                            Spacer()
                            Image(systemName: picked.wrappedValue.contains(id) ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 20, weight: .regular))
                                .foregroundStyle(picked.wrappedValue.contains(id) ? BunTheme.indigoLight : BunTheme.tertiary)
                        }
                        .frame(minHeight: 58)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BunPressStyle())
                }
            }
        }
    }

    private func save() {
        saving = true
        let chosenStudents = (store.roster ?? []).filter { pickedStudents.contains($0.id) }
        let chosenMembers = (store.teamMembers ?? []).filter { pickedMembers.contains($0.id) }
        Task {
            do {
                try await store.addTasks(text: text, due: due,
                                         students: chosenStudents, members: chosenMembers)
                saving = false
                dismiss()
            } catch {
                saving = false
                saveError = "Could not add: \(error.localizedDescription)"
            }
        }
    }
}
