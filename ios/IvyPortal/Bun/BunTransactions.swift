import SwiftUI

/// Transactions screen: Mercury reference clone. Search, filter chips,
/// day-grouped rows, tap-through to the shared transaction detail sheet.
struct BunTransactions: View {
    /// True when hosted inside the Money page (no own scroll or title).
    var embedded = false
    @State private var searchText = ""
    @State private var showDataViews = false
    @State private var selectedTransaction: BunTransaction?
    @State private var store = BunStore.shared
    @State private var methodFilter: String?      // "Deal" | "Installment" | "Expense"
    @State private var amountFilter: String?      // "over" | "under"  (500)
    @State private var accountFilter: String?     // "Checking ••6997" | "Savings ••7021"
    @State private var showReceipts = false
    @State private var showMovementSheet = false
    @State private var movementSegment = 0

    /// One path for both modes: the signed-out store is seeded with the
    /// demo ledger.
    private var source: [BunTransaction] {
        var rows = store.ledger ?? []
        if let methodFilter {
            rows = rows.filter { $0.method.hasPrefix(methodFilter) }
        }
        if let amountFilter {
            rows = rows.filter { amountFilter == "over" ? abs($0.amount) >= 500 : abs($0.amount) < 500 }
        }
        if let accountFilter {
            rows = rows.filter { $0.account == accountFilter }
        }
        return rows
    }

    private var amountLabel: String {
        switch amountFilter {
        case "over": "Over $500"
        case "under": "Under $500"
        default: "Amount"
        }
    }

    /// Tap cycles Method: all → Deal → Installment → Expense → all.
    private func cycleMethod() {
        let order: [String?] = [nil, "Deal", "Installment", "Expense"]
        let index = order.firstIndex(of: methodFilter) ?? 0
        methodFilter = order[(index + 1) % order.count]
    }

    private func cycleAmount() {
        let order: [String?] = [nil, "over", "under"]
        let index = order.firstIndex(of: amountFilter) ?? 0
        amountFilter = order[(index + 1) % order.count]
    }

    /// Tap cycles Accounts: all → Checking → Savings → all.
    private func cycleAccount() {
        let order: [String?] = [nil, "Checking ••6997", "Savings ••7021"]
        let index = order.firstIndex(of: accountFilter) ?? 0
        accountFilter = order[(index + 1) % order.count]
    }

    private var accountLabel: String {
        accountFilter.map { String($0.split(separator: " ").first ?? "Accounts") } ?? "Accounts"
    }

    private var sourceDays: [String] {
        var seen: Set<String> = []
        return source.compactMap { seen.insert($0.day).inserted ? $0.day : nil }
    }

    var body: some View {
        Group {
            if embedded {
                VStack(alignment: .leading, spacing: 24) {
                    headerRow
                    BunSearchField(text: $searchText)
                    filterChips
                    transactionGroups
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        headerRow
                        BunSearchField(text: $searchText)
                        filterChips
                        transactionGroups
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 12)
                    .padding(.bottom, 96)
                }
                .scrollIndicators(.hidden)
            }
        }
        .task { await store.loadLedger() }
        .refreshable {
            store.ledger = nil
            await store.loadLedger()
        }
        .sheet(isPresented: $showDataViews) {
            BunDataViewsSheet { segment in
                showDataViews = false
                movementSegment = segment
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { showMovementSheet = true }
            }
        }
        .sheet(isPresented: $showMovementSheet) {
            BunMovementSheet(initialSegment: movementSegment)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showReceipts) {
            BunReceiptsSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
                .presentationDetents([.height(540)])
        }
        .sheet(item: $selectedTransaction) { transaction in
            BunTransactionDetail(transaction: transaction)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
    }

    // MARK: header

    private var headerRow: some View {
        HStack(spacing: 12) {
            if embedded {
                Text("Transactions").font(bunFont(26)).foregroundStyle(BunTheme.ink)
            } else {
                BunTitle(text: "Transactions")
            }
            Spacer()
            HStack(spacing: 18) {
                headerIcon("doc.plaintext") { showReceipts = true }
                headerIcon("line.3.horizontal.decrease") {
                    methodFilter = nil
                    amountFilter = nil
                    accountFilter = nil
                    searchText = ""
                }
            }
            .padding(.horizontal, 18)
            .frame(height: 54)
            .background(BunTheme.raised, in: Capsule())
        }
    }

    private func headerIcon(_ symbol: String, action: @escaping () -> Void = {}) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(BunTheme.ink)
                .frame(minWidth: 24, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }

    // MARK: filter chips

    private var filterChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 10) {
                BunPillChip(symbol: "bookmark", label: "Views", tint: BunTheme.ink) {
                    showDataViews = true
                }
                BunPillChip(symbol: "dollarsign", label: methodFilter ?? "Method",
                            tint: methodFilter == nil ? BunTheme.ink : BunTheme.indigoLight) { cycleMethod() }
                BunPillChip(symbol: "lessthanorequalto", label: amountLabel,
                            tint: amountFilter == nil ? BunTheme.ink : BunTheme.indigoLight) { cycleAmount() }
                BunPillChip(symbol: "building.columns", label: accountLabel,
                            tint: accountFilter == nil ? BunTheme.ink : BunTheme.indigoLight) { cycleAccount() }
            }
            .padding(.horizontal, 22)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -22)
    }

    // MARK: grouped list

    private var transactionGroups: some View {
        VStack(alignment: .leading, spacing: 24) {
            if store.signedIn, store.ledger == nil, store.ledgerError == nil {
                ForEach(0..<5, id: \.self) { _ in
                    HStack(spacing: 16) {
                        Circle().fill(BunTheme.field).frame(width: 44, height: 44)
                        RoundedRectangle(cornerRadius: 8).fill(BunTheme.field).frame(width: 180, height: 16)
                        Spacer()
                        RoundedRectangle(cornerRadius: 8).fill(BunTheme.field).frame(width: 70, height: 16)
                    }
                    .padding(.vertical, 10)
                }
            } else if store.signedIn, let error = store.ledgerError {
                VStack(alignment: .leading, spacing: 12) {
                    Text(error).font(bunFont(19)).foregroundStyle(BunTheme.secondary)
                    BunPillChip(label: "Retry") { Task { store.ledgerError = nil; await store.loadLedger() } }
                }
            } else if source.isEmpty {
                Text("No money movement yet. Logged closes and paid installments land here.")
                    .font(bunFont(19)).foregroundStyle(BunTheme.secondary)
            }
            ForEach(sourceDays, id: \.self) { day in
                let rows = transactions(on: day)
                if !rows.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(day)
                            .font(bunFont(22, .medium))
                            .foregroundStyle(BunTheme.ink)
                            .padding(.bottom, 8)
                        ForEach(rows) { transaction in
                            BunTransactionRow(transaction: transaction) {
                                selectedTransaction = transaction
                            }
                            .padding(.vertical, 10)
                        }
                    }
                }
            }
        }
    }

    private func transactions(on day: String) -> [BunTransaction] {
        source.filter { transaction in
            guard transaction.day == day else { return false }
            let query = searchText.trimmingCharacters(in: .whitespaces)
            guard !query.isEmpty else { return true }
            return transaction.counterparty.localizedCaseInsensitiveContains(query)
        }
    }
}

// MARK: - Row

/// Mercury transaction row: avatar, counterparty, method + tag, money right.
private struct BunTransactionRow: View {
    let transaction: BunTransaction
    var action: () -> Void = {}

    private var failed: Bool { transaction.tag == "Failed" }

    private var initials: String {
        // Reference shows ONE initial ("P" for Parallel Web Systems).
        String(transaction.counterparty.prefix(1)).uppercased()
    }

    private var moneyColor: Color {
        if failed { return BunTheme.secondary }
        return transaction.amount > 0 ? BunTheme.green : BunTheme.ink
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                BunAvatar(text: initials, size: 44, fill: transaction.avatarFill)
                VStack(alignment: .leading, spacing: 3) {
                    Text(transaction.counterparty)
                        .font(bunFont(19))
                        .foregroundStyle(BunTheme.ink)
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        Text(transaction.method)
                            .font(bunFont(16))
                            .foregroundStyle(BunTheme.secondary)
                            .lineLimit(1)
                        if let tag = transaction.tag {
                            BunTag(text: tag)
                        }
                    }
                }
                Spacer(minLength: 12)
                BunMoney(amount: transaction.amount, size: 17, color: moneyColor)
                    .strikethrough(failed, color: BunTheme.secondary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }
}

// MARK: - Data views sheet

/// "Data views" bottom sheet: saved list views behind the Views filter chip.
private struct BunDataViewsSheet: View {
    var openMovement: (Int) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule()
                .fill(BunTheme.fieldBright)
                .frame(width: 40, height: 5)
                .frame(maxWidth: .infinity)
                .padding(.top, 12)
            Text("Data views")
                .font(bunFont(24, .medium))
                .foregroundStyle(BunTheme.ink)
                .padding(.top, 26)
            VStack(spacing: 10) {
                BunIconRow(symbol: "bookmark", title: "Monthly money in", chevron: false) { openMovement(0) }
                BunIconRow(symbol: "bookmark", title: "Monthly money out", chevron: false) { openMovement(1) }
            }
            .padding(.top, 22)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .presentationDetents([.height(300)])
        .presentationBackground(BunTheme.ground)
        .presentationCornerRadius(40)
    }
}

// MARK: - Match receipts (reference: the receipts bottom sheet)

import PhotosUI

/// "Match receipts" sheet: photo capture / library / files rows. Picking
/// works end to end; matching against card transactions connects to the
/// portal in a later pass (honest caption below).
struct BunReceiptsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var pickedItems: [PhotosPickerItem] = []
    @State private var pickedCount = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule().fill(BunTheme.fieldBright).frame(width: 40, height: 5)
                .frame(maxWidth: .infinity).padding(.top, 12)
            HStack(spacing: 8) {
                Text("Match receipts").font(bunFont(26, .medium)).foregroundStyle(BunTheme.ink)
                Image(systemName: "sparkles").font(.system(size: 17, weight: .regular))
                    .foregroundStyle(BunTheme.green)
            }
            .padding(.top, 26)
            Text("Receipts will be automatically matched to the correct transaction once matching is connected. Picked photos stay on this device until then.")
                .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                .padding(.top, 10)

            VStack(spacing: 14) {
                receiptRow(title: "Take Photos", symbol: "camera") {}
                    .opacity(0.5)   // camera needs a device; quietly disabled on simulator
                PhotosPicker(selection: $pickedItems, maxSelectionCount: 5, matching: .images) {
                    BunReceiptRowLabel(title: pickedCount > 0 ? "\(pickedCount) photo\(pickedCount == 1 ? "" : "s") picked" : "Choose Photos From Library",
                                       symbol: pickedCount > 0 ? "checkmark" : "photo")
                }
                .buttonStyle(BunPressStyle())
                receiptRow(title: "Upload Files", symbol: "arrow.up.to.line") {}
                    .opacity(0.5)
            }
            .padding(.top, 24)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 22)
        .onChange(of: pickedItems) { _, items in
            pickedCount = items.count
        }
    }

    private func receiptRow(title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { BunReceiptRowLabel(title: title, symbol: symbol) }
            .buttonStyle(BunPressStyle())
    }
}

private struct BunReceiptRowLabel: View {
    let title: String
    let symbol: String

    var body: some View {
        HStack {
            Text(title).font(bunFont(19)).foregroundStyle(BunTheme.ink)
            Spacer()
            Image(systemName: symbol).font(.system(size: 16, weight: .regular))
                .foregroundStyle(BunTheme.ink)
                .frame(width: 44, height: 44)
                .background(BunTheme.fieldBright, in: Circle())
        }
        .padding(.horizontal, 18)
        .frame(minHeight: 78)
        .background(BunTheme.raised, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}
