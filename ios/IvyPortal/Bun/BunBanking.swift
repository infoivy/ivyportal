import SwiftUI

/// Banking tab (founder 2026-08-17): Accounts and Cards merged. Total balance
/// and the Bun accounts first, then the cards. Linked external accounts are
/// gone — this is one workspace's own money.
struct BunBanking: View {
    @Binding var tab: BunTab
    @State private var store = BunStore.shared
    @State private var selectedCard: BunCard?
    @State private var showCreate = false
    @State private var entryKind: String?
    @State private var amountText = ""
    @State private var writeError: String?

    private var live: Bool { store.signedIn }

    private var outstanding: Double {
        (store.upcomingPayments ?? []).reduce(0) { $0 + $1.amount }
            + (store.overduePayments ?? []).reduce(0) { $0 + $1.amount }
    }

    private var totalBalance: Double {
        live ? ((store.monthIn ?? 0) + (store.wallet?.balance ?? 0)) : BunFixtures.totalBalance
    }

    private var cards: [BunCard] {
        live ? [BunCard(holder: "My card", last4: "0001", kind: "Wallet")] : BunFixtures.cards
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                header
                accountsSection
                edgeHairline
                cardsSection
                walletBlock
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 96)
        }
        .scrollIndicators(.hidden)
        .task {
            await store.loadHome()
            await store.loadMove()
            await store.loadLedger()
        }
        .sheet(item: $selectedCard) { card in
            BunCardDetailSheet(card: card)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showCreate) {
            BunCreateCardSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
                .presentationDetents([.height(360)])
        }
        .sheet(item: $entryKind) { kind in
            walletEntrySheet(kind: kind)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
                .presentationDetents([.height(320)])
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            BunTitle(text: "Banking")
            VStack(alignment: .leading, spacing: 6) {
                Text("Total balance").font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                BunMoney(amount: totalBalance, size: 36, weight: .medium)
            }
        }
    }

    // MARK: Accounts

    private var accountsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Bun accounts").font(bunFont(24)).foregroundStyle(BunTheme.ink)
            VStack(spacing: 12) {
                if live {
                    accountCard(name: "Collected", caption: "this month", amount: store.monthIn ?? 0) { tab = .money }
                    accountCard(name: "Outstanding", caption: "installments receivable", amount: outstanding) { tab = .money }
                } else {
                    ForEach(BunFixtures.accounts) { account in
                        accountCard(name: "\(account.name) ••\(account.last4)", caption: "",
                                    amount: account.balance) { tab = .money }
                    }
                }
            }
        }
    }

    private func accountCard(name: String, caption: String, amount: Double,
                             action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                BunMedallion(size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(name).font(bunFont(20)).foregroundStyle(BunTheme.ink)
                        if !caption.isEmpty {
                            Text(caption).font(bunFont(15)).foregroundStyle(BunTheme.secondary)
                        }
                    }
                    BunMoney(amount: amount, size: 20)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(BunTheme.secondary)
            }
            .padding(20)
            .background(BunTheme.raised, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(BunPressStyle())
    }

    // MARK: Cards

    private var cardsSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("Your cards").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                Spacer()
                Button { showCreate = true } label: {
                    Circle().fill(BunTheme.indigo)
                        .frame(width: 44, height: 44)
                        .overlay(Image(systemName: "plus")
                            .font(.system(size: 19, weight: .regular))
                            .foregroundStyle(.white))
                }
                .buttonStyle(BunPressStyle())
                .accessibilityLabel("New card")
            }
            VStack(spacing: 20) {
                ForEach(cards) { card in
                    Button { selectedCard = card } label: {
                        BunPhysicalCardArt(card: card)
                    }
                    .buttonStyle(BunPressStyle())
                }
            }
        }
    }

    /// Wallet meter + the two writes (wallet_entries).
    @ViewBuilder private var walletBlock: some View {
        if let wallet = store.wallet {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Card balance").font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                        BunMoney(amount: wallet.balance, size: 26, weight: .medium)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("Spent").font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                        BunMoney(amount: -wallet.spent, size: 17)
                    }
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(BunTheme.field).frame(height: 6)
                        Capsule().fill(BunTheme.indigo)
                            .frame(width: geo.size.width * (wallet.loaded > 0 ? min(wallet.spent / wallet.loaded, 1) : 0),
                                   height: 6)
                    }
                }
                .frame(height: 6)
                HStack(spacing: 10) {
                    BunPillChip(symbol: "minus", label: "Log spend") { entryKind = "spend" }
                    BunPillChip(symbol: "plus", label: "Load card") { entryKind = "credit" }
                }
                if let writeError {
                    Text(writeError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }
            }
            .padding(20)
            .background(BunTheme.raised, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
    }

    private func walletEntrySheet(kind: String) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                Spacer()
                BunChipButton(symbol: "xmark") { entryKind = nil }
            }
            BunTitle(text: kind == "spend" ? "Log spend" : "Load card")
            BunField(label: "Amount", placeholder: "0", text: $amountText)
            BunCTA(label: kind == "spend" ? "Log it" : "Add credit",
                   enabled: Double(amountText) ?? 0 > 0, filled: true) {
                let amount = Double(amountText) ?? 0
                Task {
                    if store.signedIn {
                        do {
                            try await PortalAPI.shared.addWalletEntry(kind: kind, amount: amount, note: "")
                            store.wallet = try? await PortalAPI.shared.myWallet()
                            writeError = nil
                        } catch {
                            writeError = "Could not save: \(error.localizedDescription)"
                        }
                    } else if var wallet = store.wallet {
                        // Demo: the meter moves so the flow is playable.
                        if kind == "spend" { wallet.spent += amount } else { wallet.loaded += amount }
                        store.wallet = wallet
                    }
                    amountText = ""
                    entryKind = nil
                }
            }
            Spacer()
        }
        .padding(.horizontal, 22).padding(.top, 14)
    }

    private var edgeHairline: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1)
            .padding(.horizontal, -22)
    }
}

// MARK: - Card art

/// Mercury card face: white body, mastercard mark, chip, and a footer band
/// carrying the holder line and the Bun medallion.
struct BunPhysicalCardArt: View {
    let card: BunCard

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                LinearGradient(colors: [.white, Color(white: 0.965)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top) {
                        Spacer()
                        mastercardMark
                    }
                    Spacer()
                    chip
                    Spacer(minLength: 6)
                }
                .padding(18)
            }
            footer
        }
        .frame(height: 218)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        // The card keeps its edge on a light page, where white-on-white
        // would otherwise dissolve into the background.
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .strokeBorder(Color.black.opacity(0.10), lineWidth: 1))
        .shadow(color: .black.opacity(0.18), radius: 14, y: 8)
    }

    private var mastercardMark: some View {
        VStack(alignment: .trailing, spacing: 2) {
            ZStack {
                Circle().fill(Color.black.opacity(0.78))
                    .frame(width: 32, height: 32)
                    .offset(x: -11)
                Circle().fill(Color(white: 0.66))
                    .frame(width: 32, height: 32)
            }
            Text("mastercard")
                .font(bunFont(11))
                .foregroundStyle(Color(white: 0.55))
        }
    }

    private var chip: some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .stroke(Color(white: 0.72), lineWidth: 1)
            .frame(width: 46, height: 36)
            .overlay(
                VStack(spacing: 10) {
                    Rectangle().fill(Color(white: 0.72)).frame(height: 1)
                    Rectangle().fill(Color(white: 0.72)).frame(height: 1)
                }
                .padding(.horizontal, 7)
            )
    }

    private var footer: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 5) {
                Text(card.holder)
                    .font(bunFont(18))
                    .foregroundStyle(Color(white: 0.20))
                Text("•••• •••• •••• \(card.last4)")
                    .font(bunFont(16))
                    .foregroundStyle(Color(white: 0.45))
            }
            Spacer()
            Image("BunLogo")
                .resizable().renderingMode(.template).scaledToFit()
                .foregroundStyle(Color(white: 0.72))
                .frame(width: 38, height: 38)
        }
        .padding(.horizontal, 18)
        .frame(height: 78)
        .frame(maxWidth: .infinity)
        .background(Color(white: 0.93))
    }
}

// MARK: - Card detail

/// Card page (reference: number / wallet / freeze chips, card facts, and the
/// daily spending meter).
struct BunCardDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var frozen = false
    @State private var favorite = false
    let card: BunCard

    private var spentToday: Double {
        (store.wallet?.recent ?? [])
            .filter { $0.kind == "spend" }
            .prefix(1)
            .reduce(0) { $0 + $1.amount }
    }
    private let dailyLimit: Double = 2_500

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunChipButton(symbol: "xmark") { dismiss() }
                    Spacer()
                    Button { favorite.toggle() } label: {
                        Image(systemName: favorite ? "star.fill" : "star")
                            .font(.system(size: 18, weight: .regular))
                            .foregroundStyle(favorite ? BunTheme.indigoLight : BunTheme.ink)
                            .frame(width: 46, height: 46)
                            .background(Color.white.opacity(0.06), in: Circle())
                            .overlay(Circle().stroke(Color.white.opacity(0.07)))
                    }
                    .buttonStyle(BunPressStyle())
                }

                BunPhysicalCardArt(card: card)

                ScrollView(.horizontal) {
                    HStack(spacing: 10) {
                        BunPillChip(symbol: "creditcard", label: "Number")
                        BunPillChip(symbol: "wallet.pass", label: "Apple Wallet")
                        BunPillChip(symbol: "snowflake", label: frozen ? "Unfreeze" : "Freeze") {
                            withAnimation(.snappy(duration: 0.2)) { frozen.toggle() }
                        }
                    }
                    .padding(.horizontal, 22)
                }
                .scrollIndicators(.hidden)
                .padding(.horizontal, -22)

                factRow(label: "Card type", value: card.kind)
                factRow(label: "Account", value: "Checking ••6997", accent: true)
                factRow(label: "Status", value: frozen ? "Frozen" : "Active",
                        accent: false, tone: frozen ? BunTheme.indigoLight : BunTheme.green)

                Rectangle().fill(BunTheme.hairline).frame(height: 1).padding(.horizontal, -22)

                spendingBlock

                Text("Activity").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                activityList
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadHome() }
    }

    private func factRow(label: String, value: String, accent: Bool = false,
                         tone: Color? = nil) -> some View {
        HStack {
            Text(label).font(bunFont(18)).foregroundStyle(BunTheme.secondary)
            Spacer()
            Text(value).font(bunFont(18))
                .foregroundStyle(tone ?? (accent ? BunTheme.indigoLight : BunTheme.ink))
        }
        .frame(minHeight: 52)
    }

    private var spendingBlock: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                BunMoney(amount: spentToday, size: 24, weight: .medium)
                Text("spent today").font(bunFont(20)).foregroundStyle(BunTheme.secondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(BunTheme.field).frame(height: 8)
                    Capsule().fill(BunTheme.indigo)
                        .frame(width: geo.size.width * min(spentToday / dailyLimit, 1), height: 8)
                }
            }
            .frame(height: 8)
            VStack(spacing: 0) {
                limitRow(label: "Daily spending limit", amount: dailyLimit, dot: nil, bold: true)
                limitRow(label: "Posted", amount: spentToday, dot: BunTheme.indigoLight)
                limitRow(label: "Pending", amount: 0, dot: BunTheme.secondary)
                limitRow(label: "Available to spend", amount: dailyLimit - spentToday,
                         dot: nil, tone: BunTheme.green)
            }
            .padding(18)
            .background(BunTheme.raised, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    private func limitRow(label: String, amount: Double, dot: Color?,
                          bold: Bool = false, tone: Color? = nil) -> some View {
        HStack(spacing: 10) {
            if let dot {
                Circle().fill(dot).frame(width: 9, height: 9)
            }
            Text(label).font(bunFont(17, bold ? .medium : .regular))
                .foregroundStyle(bold ? BunTheme.ink : BunTheme.secondary)
            Spacer()
            BunMoney(amount: amount, size: 17, color: tone ?? BunTheme.ink)
        }
        .frame(minHeight: 44)
    }

    @ViewBuilder private var activityList: some View {
        if let entries = store.wallet?.recent, !entries.isEmpty {
            VStack(spacing: 0) {
                ForEach(entries.prefix(10)) { entry in
                    HStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.note.isEmpty ? (entry.kind == "spend" ? "Card spend" : "Card load") : entry.note)
                                .font(bunFont(17)).foregroundStyle(BunTheme.ink).lineLimit(1)
                            Text(entry.entryDate).font(bunFont(15)).foregroundStyle(BunTheme.secondary)
                        }
                        Spacer()
                        BunMoney(amount: entry.kind == "spend" ? -entry.amount : entry.amount,
                                 size: 17,
                                 color: entry.kind == "spend" ? BunTheme.ink : BunTheme.green)
                    }
                    .frame(minHeight: 58)
                }
            }
        } else {
            Text("No card activity yet. Loads and spends land here.")
                .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
        }
    }
}

/// Create-card sheet: honest — issuing runs on the money provider, not here.
struct BunCreateCardSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                Spacer()
                BunChipButton(symbol: "xmark") { dismiss() }
            }
            BunTitle(text: "New card")
            Text("Cards are issued through your payment provider. Track loads and spends here once the card exists.")
                .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            BunCTA(label: "Got it", enabled: true, filled: true) { dismiss() }
            Spacer()
        }
        .padding(.horizontal, 22).padding(.top, 14)
    }
}
