import SwiftUI

// Card ledgers (web /cards, founder "go ahead with all" 2026-08-18). The old
// wallet meter only knew about one card and one number; the business reads
// these per person — what was loaded, what was spent, and what is still
// sitting there — so the ledger came over whole.

struct BunCardLedgersSection: View {
    @State private var store = BunStore.shared
    @State private var openLedger: CardLedger?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Card balances").font(bunFont(24)).foregroundStyle(BunTheme.ink)
            if store.cardLedgers == nil {
                RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 60)
            } else if (store.cardLedgers ?? []).isEmpty {
                Text("No card money recorded yet.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(store.cardLedgers ?? []) { ledger in
                        Button { openLedger = ledger } label: {
                            HStack(spacing: 14) {
                                BunAvatar(text: String(ledger.name.prefix(1)), size: 44,
                                          fill: BunStore.fill(for: ledger.name))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(ledger.name).font(BunType.rowTitle)
                                        .foregroundStyle(BunTheme.ink).lineLimit(1)
                                    Text("\(ivyMoney(ledger.loaded)) loaded · \(ivyMoney(ledger.spent)) spent")
                                        .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                        .lineLimit(1).minimumScaleFactor(0.85)
                                }
                                Spacer()
                                BunMoney(amount: ledger.balance, size: BunType.Money.row,
                                         color: ledger.balance > 0 ? BunTheme.ink : BunTheme.secondary)
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 13, weight: .regular))
                                    .foregroundStyle(BunTheme.secondary)
                            }
                            .frame(minHeight: 66)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(BunPressStyle())
                    }
                }
            }
        }
        .sheet(item: $openLedger) { ledger in
            BunCardLedgerSheet(ledgerId: ledger.id)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .task { await store.loadCards() }
    }
}

/// One person's card, month by month, with the three writes the web offers.
struct BunCardLedgerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    let ledgerId: UUID

    @State private var entryKind: String?
    @State private var amount = ""
    @State private var note = ""
    @State private var writeError: String?

    private var ledger: CardLedger? { store.cardLedgers?.first { $0.id == ledgerId } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunTitle(text: "Card")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                if let ledger {
                    HStack(spacing: 14) {
                        BunAvatar(text: String(ledger.name.prefix(1)), size: 52,
                                  fill: BunStore.fill(for: ledger.name))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(ledger.name).font(bunFont(24)).foregroundStyle(BunTheme.ink)
                            Text("\(ivyMoney(ledger.loaded)) loaded all-time · \(ivyMoney(ledger.spent)) spent")
                                .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                .lineLimit(1).minimumScaleFactor(0.85)
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Balance").font(BunType.label).foregroundStyle(BunTheme.secondary)
                        BunMoney(amount: ledger.balance, size: BunType.Money.hero)
                        Text("what is still sitting on the card")
                            .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
                    }

                    HStack(spacing: 10) {
                        BunPillChip(symbol: "minus", label: "Log spend") { open("spend") }
                        BunPillChip(symbol: "plus", label: "Load") { open("credit") }
                        BunPillChip(symbol: "equal", label: "Set balance") { open("set") }
                    }

                    if let writeError {
                        Text(writeError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                    }

                    ForEach(ledger.months) { month in
                        monthBlock(month)
                    }
                } else {
                    RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 90)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $entryKind) { kind in
            entrySheet(kind)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
                .presentationDetents([.height(400)])
        }
    }

    private func open(_ kind: String) {
        amount = ""
        note = ""
        entryKind = kind
    }

    /// Carry-in and carry-out are the point of the month view: unspent money
    /// rolls forward rather than resetting.
    private func monthBlock(_ month: CardMonth) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(month.label.uppercased())
                    .font(bunFont(13, .medium)).tracking(0.8)
                    .foregroundStyle(BunTheme.secondary)
                Spacer()
                Text("in \(ivyMoney(month.carriedIn)) · out \(ivyMoney(month.carriedOut))")
                    .font(bunFont(13)).foregroundStyle(BunTheme.tertiary)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            VStack(spacing: 0) {
                ForEach(month.entries) { entry in
                    HStack(spacing: 12) {
                        Text(BunStore.parseDay(entry.entryDate).map { BunStore.friendlyDay($0) } ?? entry.entryDate)
                            .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                            .frame(width: 100, alignment: .leading)
                            .lineLimit(1).minimumScaleFactor(0.8)
                        Text(entry.note.isEmpty ? (entry.kind == "credit" ? "Loaded" : "Spend") : entry.note)
                            .font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                        Spacer()
                        BunMoney(amount: entry.kind == "credit" ? entry.amount : -entry.amount,
                                 size: 17, color: entry.kind == "credit" ? BunTheme.green : BunTheme.ink)
                    }
                    .frame(minHeight: 54)
                }
            }
        }
        .padding(.top, 6)
    }

    private func entrySheet(_ kind: String) -> some View {
        let title = kind == "spend" ? "Log spend" : (kind == "credit" ? "Load card" : "Set balance")
        return VStack(alignment: .leading, spacing: 20) {
            HStack {
                BunTitle(text: title)
                Spacer()
                BunChipButton(symbol: "xmark") { entryKind = nil }
            }
            if kind == "set" {
                Text("Writes the difference as its own entry — the ledger is a history, so nothing is ever edited away.")
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            BunField(label: kind == "set" ? "New balance" : "Amount", placeholder: "0", text: $amount)
            if kind != "set" {
                BunField(label: "Note (optional)", placeholder: "What it was for", text: $note)
            }
            BunCTA(label: title, enabled: Double(amount) != nil, filled: true) {
                let value = Double(amount) ?? 0
                let noteText = note
                entryKind = nil
                Task {
                    do {
                        try await store.cardEntry(ledgerId: ledgerId, kind: kind, amount: value, note: noteText)
                        writeError = nil
                    } catch {
                        writeError = "Could not save: \(error.localizedDescription)"
                    }
                }
            }
            Spacer()
        }
        .padding(.horizontal, 22)
        .padding(.top, 18)
    }
}
