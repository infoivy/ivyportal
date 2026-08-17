import SwiftUI

// The four Move money flows: Transfer, Deposit, Send, Request.
// Each is a multi-step sheet driven by a local @State step.

// MARK: - Shared sheet pieces (file-private)

/// Sheet header: optional back chip left, optional centered 19-medium title,
/// close chip right.
private struct BunFlowHeader: View {
    var title: String = ""
    var back: (() -> Void)? = nil
    let close: () -> Void

    var body: some View {
        ZStack {
            if !title.isEmpty {
                Text(title)
                    .font(bunFont(19, .medium))
                    .foregroundStyle(BunTheme.ink)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .padding(.horizontal, 58)
            }
            HStack {
                if let back {
                    BunChipButton(symbol: "chevron.left", action: back)
                }
                Spacer()
                BunChipButton(symbol: "xmark", action: close)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 14)
    }
}

/// Raised account card used by the Transfer and Deposit account pickers.
private struct BunAccountPickCard: View {
    let account: BunAccount
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                BunMedallion(size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(account.name) ••\(account.last4)")
                        .font(bunFont(20))
                        .foregroundStyle(BunTheme.ink)
                    BunMoney(amount: account.balance, size: 20, color: BunTheme.secondary)
                }
                Spacer()
            }
            .padding(18)
            .background(BunTheme.raised, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(BunPressStyle())
    }
}

/// Centered big amount entry: "$" 44 beside a 56pt numeric field.
private struct BunAmountEntry: View {
    @Binding var amount: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Spacer(minLength: 0)
            Text("$")
                .font(bunFont(44))
                .foregroundStyle(BunTheme.ink)
            TextField("", text: $amount,
                      prompt: Text("0").font(bunFont(56)).foregroundStyle(BunTheme.tertiary))
                .font(bunFont(56))
                .foregroundStyle(BunTheme.ink)
                .keyboardType(.decimalPad)
                .fixedSize()
                .frame(minWidth: 34)
            Spacer(minLength: 0)
        }
    }
}

/// Full-bleed hairline that escapes the 22pt content inset.
private struct BunEdgeHairline: View {
    var body: some View {
        Rectangle()
            .fill(BunTheme.hairline)
            .frame(height: 1)
            .padding(.horizontal, -22)
    }
}

// MARK: - Transfer

struct BunTransferFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var step = 1
    @State private var fromAccount: BunAccount? = nil
    @State private var toAccount: BunAccount? = nil
    @State private var amount = ""

    private var chosenFrom: BunAccount { fromAccount ?? BunFixtures.accounts[0] }
    private var chosenTo: BunAccount { toAccount ?? BunFixtures.accounts[1] }

    var body: some View {
        switch step {
        case 1:
            pickStep(title: "Transfer from", excluding: nil, back: nil) { account in
                fromAccount = account
                step = 2
            }
        case 2:
            pickStep(title: "Transfer to", excluding: chosenFrom.id, back: { step = 1 }) { account in
                toAccount = account
                step = 3
            }
        default:
            amountStep
        }
    }

    private func pickStep(title: String, excluding: UUID?, back: (() -> Void)?,
                          choose: @escaping (BunAccount) -> Void) -> some View {
        VStack(spacing: 0) {
            BunFlowHeader(title: "Transfer Between Your Accounts", back: back, close: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BunTitle(text: title)

                    Text("Bun accounts")
                        .font(bunFont(24))
                        .foregroundStyle(BunTheme.ink)

                    VStack(spacing: 12) {
                        ForEach(BunFixtures.accounts.filter { $0.id != excluding }) { account in
                            BunAccountPickCard(account: account) { choose(account) }
                        }
                    }

                    BunEdgeHairline()

                    Text("Linked accounts")
                        .font(bunFont(24))
                        .foregroundStyle(BunTheme.ink)

                    HStack(spacing: 8) {
                        Image(systemName: "calendar")
                            .font(.system(size: 14, weight: .regular))
                            .foregroundStyle(BunTheme.secondary)
                        Text("External transfers take up to 3 business days.")
                            .font(bunFont(16))
                            .foregroundStyle(BunTheme.secondary)
                    }

                    linkedRow

                    linkNewRow
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var linkedRow: some View {
        HStack(spacing: 16) {
            Image(systemName: "building.columns")
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(BunTheme.ink)
                .frame(width: 44, height: 44)
                .background(BunTheme.field, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text("360 Performance Savings ••6757")
                    .font(bunFont(19))
                    .foregroundStyle(BunTheme.ink)
                Text("Capital One")
                    .font(bunFont(16))
                    .foregroundStyle(BunTheme.secondary)
            }
            Spacer()
        }
    }

    private var linkNewRow: some View {
        HStack(spacing: 16) {
            Image(systemName: "plus")
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(BunTheme.indigoLight)
                .frame(width: 44, height: 44)
                .background(BunTheme.field, in: Circle())
            Text("Link a new account")
                .font(bunFont(19))
                .foregroundStyle(BunTheme.indigoLight)
            Spacer()
        }
    }

    private var amountStep: some View {
        VStack(spacing: 0) {
            BunFlowHeader(back: { step = 2 }, close: { dismiss() })
            ScrollView {
                VStack(spacing: 28) {
                    HStack(spacing: 12) {
                        accountBox(chosenFrom)
                        ZStack {
                            Circle().fill(BunTheme.field).frame(width: 44, height: 44)
                            Image(systemName: "arrow.right")
                                .font(.system(size: 16, weight: .regular))
                                .foregroundStyle(BunTheme.ink)
                        }
                        accountBox(chosenTo)
                    }

                    VStack(spacing: 14) {
                        Text("Transfer amount")
                            .font(bunFont(19))
                            .foregroundStyle(BunTheme.secondary)
                        BunAmountEntry(amount: $amount)
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 22)
                .padding(.top, 28)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: "Review", enabled: !amount.isEmpty) { dismiss() }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
        }
    }

    private func accountBox(_ account: BunAccount) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text("\(account.name) ••\(account.last4)")
                    .font(bunFont(16))
                    .foregroundStyle(BunTheme.ink)
                    .lineLimit(1)
                BunMoney(amount: account.balance, size: 16, color: BunTheme.secondary)
            }
            Spacer(minLength: 6)
            BunMedallion(size: 28)
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(BunTheme.hairline, lineWidth: 1)
        )
    }
}

// MARK: - Deposit

struct BunDepositFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var step = 1
    @State private var account: BunAccount? = nil
    @State private var amount = ""
    @State private var sender = ""
    @State private var note = ""

    private var chosenAccount: BunAccount { account ?? BunFixtures.accounts[0] }

    var body: some View {
        switch step {
        case 1: beforeStep
        case 2: pickStep
        case 3: amountStep
        default: detailsStep
        }
    }

    private var beforeStep: some View {
        VStack(spacing: 0) {
            BunFlowHeader(title: "Deposit a Check", close: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    BunTitle(text: "Before you upload")

                    infoRow("clock",
                            Text("Check deposits usually take up to 5 business days to clear."))
                    infoRow("flag",
                            Text("Sign the back of your check and write \"For deposit only\" below your signature."))
                    infoRow("questionmark.circle",
                            Text("Questions about check deposits? Visit our ")
                            + Text("Help Center.").foregroundStyle(BunTheme.indigoLight))
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: "Next") { step = 2 }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
        }
    }

    private func infoRow(_ symbol: String, _ text: Text) -> some View {
        HStack(alignment: .center, spacing: 16) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .regular))
                .foregroundStyle(BunTheme.ink)
                .frame(width: 48, height: 48)
                .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            text
                .font(bunFont(19))
                .foregroundStyle(BunTheme.secondary)
            Spacer(minLength: 0)
        }
    }

    private var pickStep: some View {
        VStack(spacing: 0) {
            BunFlowHeader(title: "Deposit a Check", back: { step = 1 }, close: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BunTitle(text: "Deposit check to")
                    VStack(spacing: 12) {
                        ForEach(BunFixtures.accounts) { candidate in
                            BunAccountPickCard(account: candidate) {
                                account = candidate
                                step = 3
                            }
                        }
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var amountStep: some View {
        VStack(spacing: 0) {
            BunFlowHeader(title: "Deposit a Check", back: { step = 2 }, close: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HStack(spacing: 14) {
                        BunMedallion(size: 44)
                        Text("\(chosenAccount.name) ••\(chosenAccount.last4)")
                            .font(bunFont(19))
                            .foregroundStyle(BunTheme.ink)
                        Spacer()
                        BunMoney(amount: chosenAccount.balance, size: 17, color: BunTheme.secondary)
                    }

                    BunEdgeHairline()

                    VStack(spacing: 14) {
                        Text("Check amount")
                            .font(bunFont(19))
                            .foregroundStyle(BunTheme.secondary)
                        BunAmountEntry(amount: $amount)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 16)
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: "Next", enabled: !amount.isEmpty) { step = 4 }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
        }
    }

    private var detailsStep: some View {
        VStack(spacing: 0) {
            BunFlowHeader(title: "Deposit a Check", back: { step = 3 }, close: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BunTitle(text: "Check details")
                    BunField(label: "From", placeholder: "Check sender", text: $sender)
                    BunField(label: "Note", placeholder: "Add a note to yourself (optional)",
                             text: $note, multiline: true)
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: "Next") { dismiss() }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
        }
    }
}

// MARK: - Send

struct BunSendFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""

    var body: some View {
        VStack(spacing: 0) {
            BunFlowHeader(title: "Send a Payment", close: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BunTitle(text: "Recipient")
                    BunField(label: "Name", placeholder: "", text: $name)
                    BunField(label: "Email", placeholder: "", text: $email)
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: "Next") { dismiss() }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
        }
    }
}

// MARK: - Request

struct BunRequestFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""

    var body: some View {
        VStack(spacing: 0) {
            BunFlowHeader(title: "Request a Payment", close: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BunTitle(text: "Contact details")
                    BunField(label: "Name", placeholder: "", text: $name)
                    BunField(label: "Email", placeholder: "", text: $email)
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .bottom) {
            BunCTA(label: "Next") { dismiss() }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
        }
    }
}
