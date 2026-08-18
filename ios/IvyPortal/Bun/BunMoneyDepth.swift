import SwiftUI
import Charts

// Money depth (founder "go ahead", 2026-08-18): the web's Money-in read, the
// payment-plan book, and the payout ledger. Each is a sheet off the Money tab
// rather than more page — Money is already the longest screen in the app.

/// Money in: what was booked, what actually landed, and the deals behind it.
struct BunMoneyInSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var range = 1

    private static let ranges = [7, 30, 90]

    private var days: Int { Self.ranges[range] }
    private var deals: [PayoutDealRow] { store.deals(days: days) }
    private var booked: Double { deals.reduce(0) { $0 + ($1.totalValue ?? 0) } }
    private var collected: Double { deals.reduce(0) { $0 + ($1.cashCollectedUpfront ?? 0) } }
    private var average: Double { deals.isEmpty ? 0 : booked / Double(deals.count) }

    /// PIF / deposit / split, the split the web shows as one stacked bar.
    private var byType: [(type: String, count: Int)] {
        Dictionary(grouping: deals) { ($0.paymentType ?? "other").lowercased() }
            .map { (type: $0.key, count: $0.value.count) }
            .sorted { $0.count > $1.count }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    BunTitle(text: "Money in")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                BunSegment(options: Self.ranges.map { "\($0)D" }, selection: $range)

                if store.deals == nil {
                    RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 90)
                } else if deals.isEmpty {
                    Text("No closes logged in this window.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    HStack(alignment: .top, spacing: 0) {
                        stat("Collected", money: collected, tone: BunTheme.green)
                        stat("Booked", money: booked)
                    }
                    HStack(alignment: .top, spacing: 0) {
                        stat("Deals", value: "\(deals.count)")
                        stat("Average", money: average)
                    }

                    typeSplit

                    Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)

                    Text("Deals").font(BunType.section).foregroundStyle(BunTheme.ink)
                    VStack(spacing: 0) {
                        ForEach(deals) { deal in
                            dealRow(deal)
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadMoneyDepth() }
    }

    private var typeSplit: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Payment types").font(BunType.label).foregroundStyle(BunTheme.secondary)
            GeometryReader { geo in
                HStack(spacing: 2) {
                    ForEach(byType, id: \.type) { slice in
                        Capsule().fill(Self.tint(slice.type))
                            .frame(width: max(4, geo.size.width * Double(slice.count) / Double(max(deals.count, 1))))
                    }
                }
            }
            .frame(height: 8)
            HStack(spacing: 14) {
                ForEach(byType, id: \.type) { slice in
                    HStack(spacing: 6) {
                        Circle().fill(Self.tint(slice.type)).frame(width: 7, height: 7)
                        Text("\(Self.typeLabel(slice.type)) \(slice.count)")
                            .font(bunFont(14)).foregroundStyle(BunTheme.secondary)
                    }
                }
            }
        }
    }

    static func typeLabel(_ type: String) -> String {
        switch type {
        case "pif": "PIF"
        case "deposit": "Deposit"
        case "split": "Split"
        case "scholarship": "Scholarship"
        case let other: other.capitalized
        }
    }

    private static func tint(_ type: String) -> Color {
        switch type {
        case "pif": BunTheme.green
        case "deposit": BunTheme.indigoLight
        case "split": Color(red: 0.95, green: 0.72, blue: 0.35)
        default: BunTheme.secondary
        }
    }

    private func dealRow(_ deal: PayoutDealRow) -> some View {
        HStack(spacing: 14) {
            BunAvatar(text: String(deal.studentName.prefix(1)), size: 44,
                      fill: BunStore.fill(for: deal.studentName))
            VStack(alignment: .leading, spacing: 3) {
                Text(deal.studentName).font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                Text([BunStore.parseDay(deal.dealDate).map { BunStore.friendlyDay($0) },
                      (deal.paymentType ?? "").isEmpty ? nil : Self.typeLabel(deal.paymentType ?? "")]
                        .compactMap { $0 }.joined(separator: " · "))
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                BunMoney(amount: deal.cashCollectedUpfront ?? 0, size: BunType.Money.row, color: BunTheme.green)
                if (deal.totalValue ?? 0) > (deal.cashCollectedUpfront ?? 0) {
                    Text("of \(ivyMoney(deal.totalValue ?? 0))")
                        .font(bunFont(13)).foregroundStyle(BunTheme.tertiary)
                }
            }
        }
        .frame(minHeight: 66)
    }

    private func stat(_ label: String, money: Double? = nil, value: String? = nil,
                      tone: Color = BunTheme.ink) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
            if let money {
                BunMoney(amount: money, size: 24, weight: .medium, color: tone)
            } else {
                Text(value ?? "–").font(bunFont(24, .medium)).foregroundStyle(tone).monospacedDigit()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The payment-plan book: who is on a plan, how far through it they are, and
/// what lands next.
struct BunPaymentPlansSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var openPlan: UUID?

    private struct PlanRead: Identifiable {
        let id: UUID
        let name: String
        let total: Double
        let paid: Double
        let payments: [PlanPayment]
        var open: Double { max(total - paid, 0) }
        var next: PlanPayment? {
            payments.filter { $0.status != "paid" }.min { $0.dueDate < $1.dueDate }
        }
        var late: Bool { payments.contains { $0.status == "late" || $0.status == "missed" } }
    }

    private var reads: [PlanRead] {
        let payments = Dictionary(grouping: store.planPayments ?? []) { $0.installmentId }
        return (store.plans ?? []).map { plan in
            let mine = payments[plan.id] ?? []
            return PlanRead(id: plan.id, name: plan.studentName, total: plan.totalAmount,
                            paid: mine.filter { $0.status == "paid" }.reduce(0) { $0 + $1.amount },
                            payments: mine.sorted { $0.dueDate < $1.dueDate })
        }
        .sorted { ($0.late ? 0 : 1, $0.name) < ($1.late ? 0 : 1, $1.name) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunTitle(text: "Payment plans")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                if store.plans == nil {
                    RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 80)
                } else if reads.isEmpty {
                    Text("No payment plans yet. Split closes create one.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    ForEach(reads) { plan in
                        planBlock(plan)
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadMoneyDepth() }
    }

    private func planBlock(_ plan: PlanRead) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.snappy(duration: 0.2)) {
                    openPlan = openPlan == plan.id ? nil : plan.id
                }
            } label: {
                HStack(spacing: 14) {
                    BunAvatar(text: String(plan.name.prefix(1)), size: 44, fill: BunStore.fill(for: plan.name))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(plan.name).font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                        Text(caption(plan)).font(BunType.caption)
                            .foregroundStyle(plan.late ? BunTheme.pink : BunTheme.secondary).lineLimit(1)
                    }
                    Spacer()
                    Image(systemName: openPlan == plan.id ? "chevron.up" : "chevron.down")
                        .font(.system(size: 13, weight: .regular)).foregroundStyle(BunTheme.secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(BunPressStyle())

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(BunTheme.field).frame(height: 6)
                    Capsule().fill(plan.late ? BunTheme.pink : BunTheme.green)
                        .frame(width: geo.size.width * (plan.total > 0 ? min(plan.paid / plan.total, 1) : 0), height: 6)
                }
            }
            .frame(height: 6)

            if openPlan == plan.id {
                VStack(spacing: 0) {
                    ForEach(plan.payments) { payment in
                        HStack(spacing: 12) {
                            Text("#\(payment.sequence ?? 0)")
                                .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                                .frame(width: 30, alignment: .leading)
                            Text(BunStore.friendlyDue(payment.dueDate))
                                .font(BunType.caption)
                                .foregroundStyle(payment.status == "paid" ? BunTheme.secondary
                                                 : (payment.status == "upcoming" ? BunTheme.secondary : BunTheme.pink))
                            Spacer()
                            BunMoney(amount: payment.amount, size: 16,
                                     color: payment.status == "paid" ? BunTheme.green : BunTheme.ink)
                        }
                        .frame(minHeight: 44)
                    }
                }
            }
        }
        .padding(.vertical, 6)
    }

    private func caption(_ plan: PlanRead) -> String {
        var bits = ["\(ivyMoney(plan.paid)) of \(ivyMoney(plan.total))"]
        if plan.late {
            bits.append("payment late")
        } else if let next = plan.next {
            bits.append(BunStore.friendlyDue(next.dueDate).lowercased())
        }
        return bits.joined(separator: " · ")
    }
}

/// The payout ledger for one semi-monthly period: what each person is owed,
/// the commission and base pay behind it, and the confirm that records it.
struct BunPayoutLedgerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var adjustingMember: String?
    @State private var adjustAmount = ""
    @State private var adjustNote = ""
    @State private var writeError: String?

    private var data: PayoutLedgerData? { store.payoutData }

    private var owed: [OwedMember] {
        (data?.owed ?? []).filter { $0.total != 0 }.sorted { $0.total > $1.total }
    }

    private var toPay: Double {
        owed.filter { data?.confirmedByUser[$0.id] == nil }.reduce(0) { $0 + $1.total }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunTitle(text: "Payouts")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                periodNav

                if let writeError {
                    Text(writeError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }
                if let error = store.payoutError {
                    Text(error).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }

                if data == nil && store.payoutError == nil {
                    RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 80)
                } else if let data {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("To pay out").font(BunType.label).foregroundStyle(BunTheme.secondary)
                        BunMoney(amount: toPay, size: BunType.Money.hero)
                        Text(data.periodEnded ? "period closed" : "live · moves with cash until the period closes")
                            .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    }

                    Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)

                    if owed.isEmpty {
                        Text("Nothing owed in this period yet.")
                            .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                    } else {
                        ForEach(owed) { member in
                            memberBlock(member, confirmed: data.confirmedByUser[member.id])
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $adjustingMember) { memberId in
            adjustSheet(memberId)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
                .presentationDetents([.height(420)])
        }
        .task { await store.loadPayouts() }
    }

    private var periodNav: some View {
        HStack(spacing: 12) {
            BunChipButton(symbol: "chevron.left", size: 40) {
                Task { await store.loadPayouts(offset: store.payoutOffset - 1) }
            }
            Text(data?.period.label ?? store.payoutPeriodLabel ?? "…")
                .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                .frame(maxWidth: .infinity)
            BunChipButton(symbol: "chevron.right", size: 40) {
                Task { await store.loadPayouts(offset: store.payoutOffset + 1) }
            }
        }
    }

    private func memberBlock(_ member: OwedMember, confirmed: PayoutConfirmationRow?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                BunAvatar(text: String(member.name.prefix(1)), size: 44, fill: BunStore.fill(for: member.name))
                VStack(alignment: .leading, spacing: 3) {
                    Text(member.name).font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                    Text(breakdown(member)).font(BunType.caption).foregroundStyle(BunTheme.secondary)
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                Spacer()
                BunMoney(amount: member.total, size: BunType.Money.row)
            }
            HStack(spacing: 10) {
                if confirmed != nil {
                    BunTag(text: "Paid", tint: BunTheme.green, fill: BunTheme.green.opacity(0.14))
                } else {
                    Button {
                        Task {
                            do { try await store.confirm(member); writeError = nil }
                            catch { writeError = "Could not confirm: \(error.localizedDescription)" }
                        }
                    } label: {
                        Text("Mark paid").font(bunFont(15, .medium)).foregroundStyle(.white)
                            .padding(.horizontal, 16).frame(height: 38)
                            .background(BunTheme.indigo, in: Capsule())
                    }
                    .buttonStyle(BunPressStyle())
                }
                BunPillChip(symbol: "plus", label: "Adjustment") {
                    adjustAmount = ""
                    adjustNote = ""
                    adjustingMember = member.id
                }
                Spacer()
            }
        }
        .padding(.vertical, 8)
    }

    /// Commission, base pay and any adjustment, exactly as the ledger built it.
    private func breakdown(_ member: OwedMember) -> String {
        var bits: [String] = []
        if member.commission != 0 { bits.append("\(ivyMoney(member.commission)) commission") }
        if member.basePay != 0 { bits.append("\(ivyMoney(member.basePay)) base") }
        if member.adjustment != 0 { bits.append("\(ivyMoney(member.adjustment)) adjustment") }
        return bits.isEmpty ? "nothing attributed yet" : bits.joined(separator: " · ")
    }

    private func adjustSheet(_ memberId: String) -> some View {
        let name = data?.names[memberId] ?? "Member"
        return VStack(alignment: .leading, spacing: 20) {
            HStack {
                BunTitle(text: "Adjustment")
                Spacer()
                BunChipButton(symbol: "xmark") { adjustingMember = nil }
            }
            Text("Corrects \(name)'s payout for \(data?.period.label ?? "this period"), or records money paid outside the ledger. Negative amounts subtract.")
                .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                .fixedSize(horizontal: false, vertical: true)
            BunField(label: "Amount", placeholder: "0", text: $adjustAmount)
            BunField(label: "Why", placeholder: "Reason for the correction", text: $adjustNote)
            BunCTA(label: "Save adjustment",
                   enabled: Double(adjustAmount) != nil && !adjustNote.trimmingCharacters(in: .whitespaces).isEmpty,
                   filled: true) {
                let amount = Double(adjustAmount) ?? 0
                let note = adjustNote
                adjustingMember = nil
                Task {
                    do { try await store.addAdjustment(memberId: memberId, amount: amount, note: note); writeError = nil }
                    catch { writeError = "Could not save the adjustment: \(error.localizedDescription)" }
                }
            }
            Spacer()
        }
        .padding(.horizontal, 22)
        .padding(.top, 18)
    }
}
