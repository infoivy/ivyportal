import SwiftUI
import UIKit

// Live money actions (data phase 2026-08-17): the Mercury anatomy carrying
// the real portal writes — collect installments, confirm payouts, log closes.

/// Overdue / upcoming installments or unconfirmed payouts, with the write
/// on each row. Business rules untouched: RLS decides who can write.
struct BunPaymentListSheet: View {
    enum Kind { case inbox, approvals, scheduled }
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var writeError: String?
    /// Rows showing the confirmed state before they animate out — same
    /// acknowledgement the Money page's "Came in" gives.
    @State private var settled: Set<String> = []
    let kind: Kind

    /// Shared action pill: flips to a green check on success, then the row
    /// leaves. Identical feel across collecting money and confirming payouts.
    private func settleButton(done: Bool, title: String,
                              action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Group {
                if done {
                    Image(systemName: "checkmark")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.white)
                } else {
                    Text(title).font(bunFont(15, .medium)).foregroundStyle(.white)
                }
            }
            .padding(.horizontal, done ? 0 : 14)
            .frame(width: done ? 38 : nil, height: 38)
            .background(done ? BunTheme.green : BunTheme.indigo, in: Capsule())
        }
        .buttonStyle(BunPressStyle())
        .disabled(done)
    }

    private func collect(_ item: BunStore.BunPlanItem) {
        let key = item.id.uuidString
        guard !settled.contains(key) else { return }
        settled.insert(key)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        Task {
            try? await Task.sleep(for: .seconds(0.75))
            do { try await store.markPaid(item); writeError = nil }
            catch { writeError = "Could not mark it paid: \(error.localizedDescription)" }
            settled.remove(key)
        }
    }

    private func confirm(_ item: BunStore.BunPayoutItem) {
        guard !settled.contains(item.id) else { return }
        settled.insert(item.id)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        Task {
            try? await Task.sleep(for: .seconds(0.75))
            do { try await store.confirmPayout(item); writeError = nil }
            catch { writeError = "Could not confirm: \(error.localizedDescription)" }
            settled.remove(item.id)
        }
    }

    private var title: String {
        switch kind {
        case .inbox: "Inbox"
        case .approvals: "Needs approval"
        case .scheduled: "Scheduled"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                BunTitle(text: title)
                if kind == .approvals, let label = store.payoutPeriodLabel {
                    Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
                }
                if let writeError {
                    Text(writeError).font(BunType.caption).foregroundStyle(BunTheme.pink)
                }
                content
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
    }

    @ViewBuilder private var content: some View {
        switch kind {
        case .inbox: planRows(store.overduePayments ?? [], emptyText: "No overdue installments. Money that slips lands here.")
        case .scheduled: planRows(store.upcomingPayments ?? [], emptyText: "No scheduled installments right now.")
        case .approvals: payoutRows
        }
    }

    private func planRows(_ items: [BunStore.BunPlanItem], emptyText: String) -> some View {
        Group {
            if items.isEmpty {
                Text(emptyText).font(BunType.rowTitle).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(items) { item in
                        let done = settled.contains(item.id.uuidString)
                        // The avatar, amount and action are fixed width, which
                        // left the name about 116pt and wrapped it over two
                        // lines. It now takes priority and stays on one line.
                        HStack(spacing: 12) {
                            BunAvatar(text: String(item.student.prefix(1)), size: 44, fill: BunStore.fill(for: item.student))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.student)
                                    .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                                    .lineLimit(1).minimumScaleFactor(0.85)
                                Text(done ? "Collected" : item.due)
                                    .font(BunType.caption)
                                    .foregroundStyle(done ? BunTheme.green
                                                     : (item.overdue ? BunTheme.pink : BunTheme.secondary))
                                    .lineLimit(1)
                            }
                            .layoutPriority(1)
                            Spacer(minLength: 8)
                            BunMoney(amount: item.amount, size: BunType.Money.chip,
                                     color: done ? BunTheme.green : BunTheme.ink)
                            settleButton(done: done, title: "Came in") {
                                collect(item)
                            }
                        }
                        .frame(minHeight: 68)
                        .animation(.spring(response: 0.32, dampingFraction: 0.72), value: done)
                    }
                }
            }
        }
    }

    private var payoutRows: some View {
        Group {
            let items = store.unconfirmedPayouts ?? []
            if items.isEmpty {
                Text("Everyone is paid for this period.").font(BunType.rowTitle).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(items) { item in
                        let done = settled.contains(item.id)
                        HStack(spacing: 12) {
                            BunAvatar(text: String(item.name.prefix(1)), size: 44, fill: BunStore.fill(for: item.name))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.name)
                                    .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                                    .lineLimit(1).minimumScaleFactor(0.85)
                                if done {
                                    Text("Confirmed").font(BunType.caption)
                                        .foregroundStyle(BunTheme.green).lineLimit(1)
                                }
                            }
                            .layoutPriority(1)
                            Spacer(minLength: 8)
                            BunMoney(amount: item.amount, size: BunType.Money.chip,
                                     color: done ? BunTheme.green : BunTheme.ink)
                            settleButton(done: done, title: "Mark paid") {
                                confirm(item)
                            }
                        }
                        .frame(minHeight: 68)
                        .animation(.spring(response: 0.32, dampingFraction: 0.72), value: done)
                    }
                }
            }
        }
    }
}

/// The revenue write, Mercury-styled: student, attribution, package,
/// amounts, optional even-split plan — PortalAPI.logClose end to end.
struct BunLogCloseFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared

    @State private var students: [StudentRosterItem] = []
    @State private var closers: [StaffProfile] = []
    @State private var setters: [StaffProfile] = []

    @State private var useExisting = true
    @State private var studentId: UUID?
    @State private var newName = ""
    @State private var closerId: UUID?
    @State private var setterId: UUID?
    @State private var programType = "1:1 Pathway"
    @State private var paymentType = "pif"
    @State private var totalValue = ""
    @State private var cashUpfront = ""
    @State private var planCount = 4
    @State private var frequency: NewClose.PlanSpec.Frequency = .monthly
    @State private var firstDue = Calendar.current.date(byAdding: .month, value: 1, to: Date()) ?? Date()
    @State private var submitting = false
    @State private var submitError: String?

    private var total: Double { Double(totalValue.replacingOccurrences(of: ",", with: "")) ?? 0 }
    private var upfront: Double { Double(cashUpfront.replacingOccurrences(of: ",", with: "")) ?? 0 }
    private var remaining: Double { max(0, total - upfront) }
    private var planApplies: Bool { paymentType != "pif" && remaining > 0 }
    private var valid: Bool {
        let name = useExisting ? (studentId != nil) : !newName.trimmingCharacters(in: .whitespaces).isEmpty
        return name && closerId != nil && total > 0 && upfront <= total
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack {
                    Spacer()
                    Text("Log a Close").font(bunFont(19, .medium)).foregroundStyle(BunTheme.ink)
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                BunTitle(text: "Deal details")

                chipRow(["Existing student", "New student"], active: useExisting ? 0 : 1) { useExisting = $0 == 0 }
                if useExisting {
                    menuRow(label: students.first { $0.id == studentId }?.fullName ?? "Select student") {
                        ForEach(students) { student in
                            Button(student.fullName) { studentId = student.id }
                        }
                    }
                } else {
                    BunField(label: "Full name", placeholder: "Student name", text: $newName)
                }

                Text("Attribution").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                menuRow(label: "Closer · " + (closers.first { $0.id == closerId }?.displayName ?? "select")) {
                    ForEach(closers) { person in
                        Button(person.displayName ?? "Member") { closerId = person.id }
                    }
                }
                menuRow(label: "Setter · " + (setters.first { $0.id == setterId }?.displayName ?? "none")) {
                    Button("No setter") { setterId = nil }
                    ForEach(setters) { person in
                        Button(person.displayName ?? "Member") { setterId = person.id }
                    }
                }
                if setterId != nil && setterId == closerId {
                    Text("Same person set and closed: the 15% set+close rate applies.")
                        .font(bunFont(15)).foregroundStyle(BunTheme.green)
                }

                Text("Package").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                chipRow(["1:1 Pathway", "Group Expertise"], active: programType == "1:1 Pathway" ? 0 : 1) {
                    programType = $0 == 0 ? "1:1 Pathway" : "Group Expertise"
                }
                chipRow(["PIF", "Deposit", "Split"], active: ["pif", "deposit", "split"].firstIndex(of: paymentType) ?? 0) {
                    paymentType = ["pif", "deposit", "split"][$0]
                }
                BunField(label: "Total value", placeholder: "0", text: $totalValue)
                BunField(label: "Cash upfront", placeholder: "0", text: $cashUpfront)

                if planApplies {
                    Text("Plan the remaining \(ivyMoney(remaining))").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                    Stepper(value: $planCount, in: 1...24) {
                        Text("\(planCount) payments of \(ivyMoney(remaining / Double(max(planCount, 1))))")
                            .font(bunFont(17)).foregroundStyle(BunTheme.ink)
                    }
                    .padding(.horizontal, 18).frame(minHeight: 56)
                    .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    chipRow(["Monthly", "Biweekly", "Weekly"],
                            active: [NewClose.PlanSpec.Frequency.monthly, .biweekly, .weekly].firstIndex(of: frequency) ?? 0) {
                        frequency = [.monthly, .biweekly, .weekly][$0]
                    }
                    DatePicker("First due", selection: $firstDue, in: Date()..., displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .font(bunFont(17))
                        .padding(.horizontal, 18).frame(minHeight: 56)
                        .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }

                if let submitError {
                    Text(submitError).font(bunFont(16)).foregroundStyle(BunTheme.pink)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 110)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: submitting ? "Logging…" : "Log the close", enabled: valid && !submitting, filled: valid) {
                submit()
            }
            .padding(.horizontal, 22).padding(.bottom, 8)
            .background(BunTheme.ground.opacity(0.94))
        }
        .task { await loadPeople() }
    }

    private func loadPeople() async {
        if students.isEmpty { students = (try? await PortalAPI.shared.students()) ?? [] }
        if closers.isEmpty, let people = try? await PortalAPI.shared.dealPeople() {
            closers = people.closers
            setters = people.setters
            // Non-admin closers log their own deals (web parity).
            if closerId == nil {
                let me = PortalAPI.shared.currentUserID
                closerId = closers.first { $0.id == me }?.id ?? closers.first?.id
            }
        }
    }

    private func submit() {
        guard let closerId else { return }
        submitting = true
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        var close = NewClose(
            existingStudentId: useExisting ? studentId : nil,
            newStudentName: useExisting ? nil : newName.trimmingCharacters(in: .whitespaces),
            closerId: closerId,
            setterId: setterId,
            programType: programType,
            totalValue: total,
            cashUpfront: upfront,
            paymentType: paymentType,
            dealDate: formatter.string(from: Date()),
            notes: nil,
            plan: nil
        )
        if planApplies {
            close.plan = .init(mode: .even(count: planCount,
                                           firstDue: formatter.string(from: firstDue),
                                           frequency: frequency))
        }
        Task {
            do {
                try await PortalAPI.shared.logClose(close)
                await store.refreshAfterClose()
                submitting = false
                dismiss()
            } catch {
                submitting = false
                submitError = "Could not log the close: \(error.localizedDescription)"
            }
        }
    }

    // MARK: chips + menus

    private func chipRow(_ labels: [String], active: Int, action: @escaping (Int) -> Void) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 10) {
                ForEach(labels.indices, id: \.self) { index in
                    Button { action(index) } label: {
                        Text(labels[index]).font(bunFont(16, .medium))
                            .foregroundStyle(index == active ? BunTheme.ink : BunTheme.secondary)
                            .padding(.horizontal, 16).frame(height: 44)
                            .background(index == active ? BunTheme.fieldBright : BunTheme.raised, in: Capsule())
                    }
                    .buttonStyle(BunPressStyle())
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    private func menuRow(label: String, @ViewBuilder items: () -> some View) -> some View {
        Menu {
            items()
        } label: {
            HStack {
                Text(label).font(bunFont(17)).foregroundStyle(BunTheme.ink)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 13, weight: .regular)).foregroundStyle(BunTheme.secondary)
            }
            .padding(.horizontal, 18).frame(minHeight: 56)
            .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}
