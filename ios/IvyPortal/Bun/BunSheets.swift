import SwiftUI
import PhotosUI

// Bun sheets: Settings (with pushed Notifications / Security screens),
// Referral, Transaction detail, and the Category picker. Mercury-clone
// surfaces measured off the reference screenshots.

// MARK: - Shared private bits

private let bunProfileTeal = Color(red: 0.153, green: 0.400, blue: 0.420)

/// Full-bleed hairline that escapes the standard 22pt content inset.
private struct BunEdgeHairline: View {
    var body: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1)
            .padding(.horizontal, -22)
    }
}

private enum BunSettingsRoute: Hashable {
    case notifications
    case security
    case alert(String)
    case knowledge
    case doc(UUID)
    case appearance
    case help
    case twoFactor
    case profile
    case team
    case split
}

/// Org options that are a switch rather than a screen.
private struct BunSettingsToggle: View {
    let title: String
    let caption: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(bunFont(19)).foregroundStyle(BunTheme.ink)
                Text(caption).font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    .lineLimit(1).minimumScaleFactor(0.85)
            }
        }
        .tint(BunTheme.indigo)
        .frame(minHeight: 64)
    }
}

/// Plain 64pt settings row: title, optional trailing pill, chevron.
private struct BunSettingsRow: View {
    let title: String
    var pillSymbol: String? = nil
    var pillLabel: String? = nil
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(title).font(bunFont(19)).foregroundStyle(BunTheme.ink)
                Spacer()
                if let pillLabel {
                    BunPillChip(symbol: pillSymbol, label: pillLabel, action: action)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(BunTheme.secondary)
            }
            .frame(height: 64)
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }
}

// MARK: - Settings

struct BunSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var path: [BunSettingsRoute] = []
    @State private var showReferral = false
    @State private var showSignIn = false
    @State private var showInvite = false
    @State private var auth = AuthStore.shared
    @State private var store = BunStore.shared
    @AppStorage("bunDemoWorkspace") private var demoWorkspace = false

    private var displayName: String {
        auth.isSignedIn ? (store.firstName.map { "\($0)" } ?? "Signed in") : BunFixtures.userFullName
    }

    private var displayEmail: String {
        auth.isSignedIn ? (auth.session?.user.email ?? "") : BunFixtures.userEmail
    }

    /// The owner's switch for the team channel. Off by default: Ivy does not
    /// use it, another business might (founder 2026-08-18).
    private var chatToggleRow: some View {
        BunSettingsToggle(
            title: "Team chat",
            caption: store.chatEnabled ? "on for \(store.orgName)" : "off for \(store.orgName)",
            isOn: Binding(
                get: { store.chatEnabled },
                set: { value in Task { try? await store.setChatEnabled(value) } }
            )
        )
    }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Spacer()
                        BunChipButton(symbol: "xmark") { dismiss() }
                    }
                    .padding(.top, 10)

                    BunTitle(text: "Settings").padding(.top, 18)

                    profileBlock.padding(.top, 26)
                    twoFactorBlock.padding(.top, 26)
                    generalBlock.padding(.top, 26)
                    footerBlock.padding(.top, 26)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 96)
            }
            .background(BunTheme.ground)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: BunSettingsRoute.self) { route in
                Group {
                    switch route {
                    case .notifications: BunNotificationsScreen(path: $path)
                    case .security: BunSecurityScreen()
                    case .alert(let title): BunAlertToggleScreen(title: title)
                    case .knowledge: BunKnowledgeScreen(path: $path)
                    case .doc(let id): BunDocScreen(docId: id)
                    case .appearance: BunAppearanceScreen()
                    case .help: BunHelpScreen()
                    case .twoFactor: BunTwoFactorScreen()
                    case .team: BunTeamAdminScreen()
                    case .split: BunProfitSplitScreen()
                    case .profile: BunProfileScreen()
                    }
                }
                .navigationBarBackButtonHidden(true)
                .toolbar(.hidden, for: .navigationBar)
            }
        }
        .sheet(isPresented: $showReferral) {
            BunReferralSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showSignIn) {
            AuthView(store: AuthStore.shared)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showInvite) {
            BunInviteSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .onChange(of: auth.isSignedIn) { _, signedIn in
            if signedIn {
                showSignIn = false
                // Land the fresh session on Home (business setup shows there
                // for accounts without a workspace yet).
                dismiss()
                Task { await store.refreshAll() }
            }
        }
    }

    private var profileBlock: some View {
        VStack(spacing: 0) {
            BunEdgeHairline()
            Button { path.append(.profile) } label: {
                HStack(spacing: 14) {
                    BunAvatar(text: String(displayName.prefix(1)), size: 52, fill: bunProfileTeal)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(displayName)
                            .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                        Text(displayEmail)
                            .font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                            // An address that wraps mid-domain reads as broken.
                            .lineLimit(1).truncationMode(.middle)
                    }
                    Spacer()
                    BunTag(text: "Admin", tint: BunTheme.green, fill: .clear)
                        .overlay(Capsule().stroke(BunTheme.green.opacity(0.5), lineWidth: 1))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(BunTheme.secondary)
                }
                .padding(.vertical, 16)
                .contentShape(Rectangle())
            }
            .buttonStyle(BunPressStyle())
            BunEdgeHairline()
        }
    }

    private var twoFactorBlock: some View {
        VStack(spacing: 0) {
            BunEdgeHairline()
            BunSettingsRow(title: "Two-Factor Authentication") { path.append(.twoFactor) }
            BunEdgeHairline()
        }
    }

    private var generalBlock: some View {
        VStack(spacing: 0) {
            BunEdgeHairline()
            BunSettingsRow(title: "Invite teammates") { showInvite = true }
            // Admin surfaces sit next to the invite that creates the people
            // they administer.
            BunSettingsRow(title: "Team") { path.append(.team) }
            if BunStore.shared.canSeeFinance {
                BunSettingsRow(title: "Profit split") { path.append(.split) }
            }
            if BunStore.shared.canSetOrgOptions { chatToggleRow }
            BunSettingsRow(title: "Knowledge") { path.append(.knowledge) }
            BunSettingsRow(title: "Notifications") { path.append(.notifications) }
            BunSettingsRow(title: "Security") { path.append(.security) }
            BunSettingsRow(title: "Appearance") { path.append(.appearance) }
            BunSettingsRow(title: "Help") { path.append(.help) }
            BunSettingsRow(title: "Refer a friend",
                           pillSymbol: "gift",
                           pillLabel: "Earn $250") { showReferral = true }
            BunEdgeHairline()
        }
    }

    private var footerBlock: some View {
        VStack(spacing: 0) {
            Button {
                if auth.isSignedIn {
                    Task {
                        await auth.signOut()
                        dismiss()
                    }
                } else {
                    showSignIn = true
                }
            } label: {
                HStack {
                    Text(auth.isSignedIn ? "Log Out" : "Sign in")
                        .font(bunFont(19)).foregroundStyle(BunTheme.indigoLight)
                    Spacer()
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(BunTheme.indigoLight)
                }
                .frame(height: 64)
                .contentShape(Rectangle())
            }
            .buttonStyle(BunPressStyle())
            if !auth.isSignedIn && demoWorkspace {
                Button {
                    demoWorkspace = false
                    dismiss()
                } label: {
                    HStack {
                        Text("Leave demo workspace")
                            .font(bunFont(19)).foregroundStyle(BunTheme.secondary)
                        Spacer()
                        Image(systemName: "arrow.uturn.left")
                            .font(.system(size: 16, weight: .regular))
                            .foregroundStyle(BunTheme.secondary)
                    }
                    .frame(height: 64)
                    .contentShape(Rectangle())
                }
                .buttonStyle(BunPressStyle())
            }
            BunEdgeHairline()
            HStack(spacing: 6) {
                Text("v1.0.0 (1)").foregroundStyle(BunTheme.secondary)
                Text("·").foregroundStyle(BunTheme.secondary)
                Text("Legal & Privacy").foregroundStyle(BunTheme.indigoLight)
                Text("·").foregroundStyle(BunTheme.secondary)
                Text("Licenses").foregroundStyle(BunTheme.indigoLight)
            }
            .font(bunFont(16))
            .frame(maxWidth: .infinity)
            .padding(.top, 22)
        }
    }
}

// MARK: - Notifications (pushed)

private struct BunNotificationsScreen: View {
    @Binding var path: [BunSettingsRoute]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                .padding(.top, 10)

                BunTitle(text: "Notifications").padding(.top, 18)

                VStack(spacing: 20) {
                    BunIconRow(symbol: "chart.line.uptrend.xyaxis", title: "Balance alerts") {
                        path.append(.alert("Balance alerts"))
                    }
                    BunIconRow(symbol: "building.2", title: "Account activity") {
                        path.append(.alert("Account activity"))
                    }
                    BunIconRow(symbol: "creditcard", title: "My cards") {
                        path.append(.alert("My cards"))
                    }
                    BunIconRow(symbol: "person.badge.plus", title: "Team invites") {
                        path.append(.alert("Team invites"))
                    }
                }
                .padding(.top, 28)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 96)
        }
        .background(BunTheme.ground)
    }
}

/// Per-alert Push/Email preference screen (pushed from Notifications).
private struct BunAlertToggleScreen: View {
    let title: String
    @Environment(\.dismiss) private var dismiss
    @State private var segment = 0
    @State private var toggles: [Bool] = BunFixtures.accounts.map { _ in true }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                .padding(.top, 10)

                BunTitle(text: title).padding(.top, 18)

                BunSegment(options: ["Push", "Email"], selection: $segment)
                    .padding(.top, 24)

                VStack(spacing: 0) {
                    ForEach(BunFixtures.accounts.indices, id: \.self) { index in
                        HStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("\(BunFixtures.accounts[index].name) ••\(BunFixtures.accounts[index].last4)")
                                    .font(bunFont(22)).foregroundStyle(BunTheme.ink)
                                Text("Notify me when the balance falls below a custom amount.")
                                    .font(bunFont(19)).foregroundStyle(BunTheme.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer()
                            Toggle("", isOn: $toggles[index])
                                .labelsHidden()
                                .tint(BunTheme.indigo)
                        }
                        .padding(.vertical, 18)
                    }
                }
                .padding(.top, 12)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 96)
        }
        .background(BunTheme.ground)
    }
}

// MARK: - Security (pushed)

private struct BunSecurityScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var faceID = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                    BunChipButton(symbol: "arrow.clockwise") {}
                }
                .padding(.top, 10)

                BunTitle(text: "Security").padding(.top, 18)

                Text("Login").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                    .padding(.top, 30)

                Button {} label: {
                    HStack {
                        Text("Change Password").font(bunFont(22)).foregroundStyle(BunTheme.ink)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 15, weight: .regular))
                            .foregroundStyle(BunTheme.secondary)
                    }
                    .frame(height: 64)
                    .contentShape(Rectangle())
                }
                .buttonStyle(BunPressStyle())
                .padding(.top, 8)

                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Face ID").font(bunFont(22)).foregroundStyle(BunTheme.ink)
                        Text("Sign in and approve transfers with Face ID.")
                            .font(bunFont(19)).foregroundStyle(BunTheme.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Toggle("", isOn: $faceID)
                        .labelsHidden()
                        .tint(BunTheme.indigo)
                }
                .padding(.vertical, 14)

                Text("Sessions and devices").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                    .padding(.top, 30)

                sessionRow(title: "Trusted Devices",
                           caption: "Devices that skip two-step verification when you sign in.",
                           count: "0", chevron: false)
                sessionRow(title: "Mobile Devices",
                           caption: "Phones and tablets signed in to the Bun app.",
                           count: "2", chevron: true)
                sessionRow(title: "Activity History",
                           caption: "Recent sign-ins, password changes, and security events.",
                           count: nil, chevron: true)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 96)
        }
        .background(BunTheme.ground)
    }

    private func sessionRow(title: String, caption: String, count: String?, chevron: Bool) -> some View {
        Button {} label: {
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(title).font(bunFont(22)).foregroundStyle(BunTheme.ink)
                    Text(caption).font(bunFont(19)).foregroundStyle(BunTheme.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                if let count {
                    Text(count).font(bunFont(22)).foregroundStyle(BunTheme.secondary)
                }
                if chevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(BunTheme.secondary)
                }
            }
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }
}

// MARK: - Referral

struct BunReferralSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showTerms = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                    Button { showTerms = true } label: {
                        Text("Terms").font(bunFont(17)).foregroundStyle(BunTheme.indigoLight)
                            .padding(.horizontal, 20)
                            .frame(height: 46)
                            .overlay(Capsule().stroke(BunTheme.hairline, lineWidth: 1))
                            .contentShape(Capsule())
                    }
                    .buttonStyle(BunPressStyle())
                    .alert("Referral terms", isPresented: $showTerms) {
                        Button("OK", role: .cancel) {}
                    } message: {
                        Text("The $250 bonus pays out after your referral's business is active for 60 days. One bonus per referred business.")
                    }
                }
                .padding(.top, 10)

                BunTitle(text: "Share the love").padding(.top, 18)

                referralCard.padding(.top, 26)

                BunEdgeHairline().padding(.top, 28)

                Text("Referral URL").font(bunFont(19)).foregroundStyle(BunTheme.secondary)
                    .padding(.top, 24)

                HStack {
                    Text("bun.app/r/alex").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    Spacer()
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(BunTheme.indigoLight)
                }
                .padding(.horizontal, 20)
                .frame(height: 58)
                .background(BunTheme.field, in: Capsule())
                .padding(.top, 12)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .bottom) {
            ShareLink(item: URL(string: "https://bun.app/r/alex")!) {
                HStack(spacing: 9) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 17, weight: .regular))
                    Text("Share my Link").font(bunFont(21, .medium))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 64)
                .background(BunTheme.indigo, in: Capsule())
            }
            .buttonStyle(BunPressStyle())
            .padding(.horizontal, 22)
            .padding(.bottom, 8)
        }
    }

    private var referralCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("$250").font(bunFont(40, .medium)).foregroundStyle(BunTheme.ink)
            Text("Referral bonus").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                .padding(.top, 8)
            Text("If your referral signs up for Bun within the first 90 days, you both get a $250 bonus.")
                .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .background(BunTheme.raised)
        .overlay(alignment: .topTrailing) {
            Image("BunLogo").resizable().renderingMode(.template).scaledToFit()
                .foregroundStyle(BunTheme.ink.opacity(0.10))
                .frame(width: 170, height: 170)
                .offset(x: 60, y: -30)
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

// MARK: - Transaction detail

struct BunTransactionDetail: View {
    let transaction: BunTransaction
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var showCategory = false
    @State private var linkCopied = false
    @State private var showNoteEditor = false
    @State private var noteDraft = ""
    @State private var attachments: [PhotosPickerItem] = []
    @State private var showClient = false

    private var savedCategory: String? {
        store.txCategory[transaction.id] ?? transaction.category
    }
    private var savedNote: String? { store.txNote[transaction.id] }

    /// The client this money belongs to, when the counterparty is on the roster.
    private var matchedClient: StudentRosterItem? {
        (store.roster ?? []).first { $0.fullName == transaction.counterparty }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ZStack {
                    Text(transaction.method)
                        .font(bunFont(19, .medium)).foregroundStyle(BunTheme.ink)
                        .lineLimit(1)
                        .padding(.horizontal, 56)
                    HStack {
                        Spacer()
                        BunChipButton(symbol: "xmark") { dismiss() }
                    }
                }
                .padding(.top, 10)

                identity.padding(.top, 26)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        BunPillChip(symbol: "tag", label: savedCategory ?? "Categorize") { showCategory = true }
                        BunPillChip(symbol: linkCopied ? "checkmark" : "link",
                                    label: linkCopied ? "Copied" : "Copy Link",
                                    tint: linkCopied ? BunTheme.green : BunTheme.indigoLight) {
                            UIPasteboard.general.string = "bun.app/tx/\(transaction.id.uuidString.lowercased())"
                            withAnimation(.snappy(duration: 0.2)) { linkCopied = true }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                withAnimation { linkCopied = false }
                            }
                        }
                        if matchedClient != nil {
                            BunPillChip(symbol: "person.crop.circle", label: "View client") {
                                showClient = true
                            }
                        }
                        BunPillChip(symbol: "flag", label: "Dispute") { showNoteEditor = true }
                    }
                    .frame(height: 54)
                }
                .padding(.top, 24)

                BunEdgeHairline().padding(.top, 24)

                timeline.padding(.vertical, 26)

                BunEdgeHairline()

                Text("Category").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                    .padding(.top, 28)
                HStack {
                    BunPillChip(symbol: savedCategory == nil ? "plus" : "tag",
                                label: savedCategory ?? "Add a Category") { showCategory = true }
                    Spacer()
                }
                .padding(.top, 14)

                Text("Notes").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                    .padding(.top, 30)
                if let savedNote, !savedNote.isEmpty {
                    Text(savedNote).font(bunFont(17)).foregroundStyle(BunTheme.ink.opacity(0.9))
                        .padding(.top, 12)
                }
                HStack {
                    BunPillChip(symbol: savedNote == nil ? "plus" : "pencil",
                                label: savedNote == nil ? "Add a Note" : "Edit note") {
                        noteDraft = savedNote ?? ""
                        showNoteEditor = true
                    }
                    Spacer()
                }
                .padding(.top, 14)

                Text("Attachments").font(bunFont(24)).foregroundStyle(BunTheme.ink)
                    .padding(.top, 30)
                uploadBox.padding(.top, 14)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 96)
        }
        .sheet(isPresented: $showClient) {
            if let client = matchedClient {
                BunClientSheet(student: client)
                    .presentationBackground(BunTheme.ground)
                    .presentationCornerRadius(40)
            }
        }
        .sheet(isPresented: $showCategory) {
            BunCategorySheet(current: savedCategory) { picked in
                store.txCategory[transaction.id] = picked
            }
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showNoteEditor) {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Spacer()
                    BunChipButton(symbol: "xmark") { showNoteEditor = false }
                }
                BunTitle(text: "Note")
                BunField(label: "Note", placeholder: "Add a note to yourself", text: $noteDraft, multiline: true)
                BunCTA(label: "Save", enabled: true, filled: true) {
                    store.txNote[transaction.id] = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                    showNoteEditor = false
                }
                Spacer()
            }
            .padding(.horizontal, 22).padding(.top, 14)
            .presentationBackground(BunTheme.ground)
            .presentationCornerRadius(40)
            .presentationDetents([.height(420)])
        }
    }

    private var identity: some View {
        VStack(spacing: 0) {
            BunAvatar(text: String(transaction.counterparty.prefix(1)),
                      size: 64, fill: transaction.avatarFill)
            Text(transaction.counterparty)
                .font(bunFont(24)).foregroundStyle(BunTheme.ink)
                .padding(.top, 14)
                .lineLimit(1)
            if let category = transaction.category {
                Text(category).font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                    .padding(.top, 4)
            }
            BunMoney(amount: transaction.amount, size: 40, weight: .medium)
                .padding(.top, 14)
        }
        .frame(maxWidth: .infinity)
    }

    private var timeline: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(spacing: 6) {
                Circle().fill(BunTheme.secondary).frame(width: 8, height: 8)
                    .padding(.top, 6)
                Rectangle().fill(BunTheme.hairline).frame(width: 2)
                    .frame(maxHeight: .infinity)
                Image(systemName: "mappin")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(BunTheme.secondary)
            }
            .frame(width: 14)
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(transaction.method)
                        .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                        .lineLimit(1)
                    Text(transaction.day)
                        .font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                    Text("Bun \(transaction.account)")
                        .font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(transaction.counterparty)
                        .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                        .lineLimit(1)
                    Text(transaction.day)
                        .font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                }
            }
            Spacer()
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private var uploadBox: some View {
        PhotosPicker(selection: $attachments, maxSelectionCount: 3, matching: .images) {
            HStack(spacing: 8) {
                Image(systemName: attachments.isEmpty ? "arrow.up.to.line" : "checkmark")
                    .font(.system(size: 16, weight: .regular))
                Text(attachments.isEmpty ? "Upload" : "\(attachments.count) attached · stays on this device").font(bunFont(17))
            }
            .foregroundStyle(BunTheme.indigoLight)
            .frame(maxWidth: .infinity)
            .frame(height: 64)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(BunTheme.hairline, style: StrokeStyle(lineWidth: 1, dash: [6]))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }
}

// MARK: - Category picker

struct BunCategorySheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var selected: String?
    @State private var store = BunStore.shared
    var onPick: (String) -> Void = { _ in }

    init(current: String? = nil, onPick: @escaping (String) -> Void = { _ in }) {
        _selected = State(initialValue: current)
        self.onPick = onPick
    }

    private var allCategories: [String] {
        (BunFixtures.categories + store.customCategories).sorted()
    }

    private var filtered: [String] {
        search.isEmpty
            ? allCategories
            : allCategories.filter { $0.localizedCaseInsensitiveContains(search) }
    }

    /// A typed name that matches nothing exactly can be added on the spot.
    private var addable: String? {
        let trimmed = search.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2,
              !allCategories.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame })
        else { return nil }
        return trimmed
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                .padding(.top, 10)

                BunTitle(text: "Category").padding(.top, 18)

                VStack(spacing: 0) {
                    if let addable {
                        Button {
                            store.customCategories.append(addable)
                            selected = addable
                            onPick(addable)
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { dismiss() }
                        } label: {
                            HStack(spacing: 16) {
                                Circle().fill(BunTheme.field)
                                    .frame(width: 26, height: 26)
                                    .overlay(Image(systemName: "plus")
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(BunTheme.indigoLight))
                                Text("Add \"\(addable)\"").font(bunFont(19)).foregroundStyle(BunTheme.indigoLight)
                                Spacer()
                            }
                            .frame(height: 56)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(BunPressStyle())
                    }
                    ForEach(filtered, id: \.self) { name in
                        Button {
                            selected = name
                            onPick(name)
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { dismiss() }
                        } label: {
                            HStack(spacing: 16) {
                                Circle().fill(BunTheme.field)
                                    .frame(width: 26, height: 26)
                                    .overlay {
                                        if selected == name {
                                            Circle().stroke(BunTheme.indigo, lineWidth: 2)
                                            Circle().fill(BunTheme.indigo)
                                                .frame(width: 10, height: 10)
                                        }
                                    }
                                Text(name).font(bunFont(19)).foregroundStyle(BunTheme.ink)
                                Spacer()
                            }
                            .frame(height: 56)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(BunPressStyle())
                    }
                }
                .padding(.top, 16)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 96)
        }
        .overlay(alignment: .bottom) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16)).foregroundStyle(BunTheme.secondary)
                TextField("", text: $search,
                          prompt: Text("Search").font(bunFont(19)).foregroundStyle(BunTheme.secondary))
                    .font(bunFont(19)).foregroundStyle(BunTheme.ink)
            }
            .padding(.horizontal, 18)
            .frame(height: 54)
            .background(.ultraThinMaterial, in: Capsule())
            .padding(.horizontal, 22)
            .padding(.bottom, 16)
        }
    }
}


/// Knowledge hub: live portal docs grouped by category (read-only; editing
/// stays on the web, admin-only there).
private struct BunKnowledgeScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @Binding var path: [BunSettingsRoute]

    private var grouped: [(category: String, docs: [PortalAPI.Doc])] {
        let docs = store.docs ?? []
        let groups = Dictionary(grouping: docs) { $0.category.capitalized }
        return groups.keys.sorted().map { (category: $0, docs: groups[$0] ?? []) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                BunTitle(text: "Knowledge")
                if store.docs == nil {
                    ForEach(0..<4, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 54)
                    }
                } else if grouped.isEmpty {
                    Text("No docs yet. Playbooks written in Bun on the web land here.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    ForEach(grouped, id: \.category) { group in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(group.category.uppercased())
                                .font(bunFont(13, .medium)).tracking(0.8)
                                .foregroundStyle(BunTheme.secondary)
                                .padding(.top, 8)
                            ForEach(group.docs) { doc in
                                Button { path.append(.doc(doc.id)) } label: {
                                    HStack(spacing: 14) {
                                        Image(systemName: "doc.text")
                                            .font(.system(size: 16, weight: .regular))
                                            .foregroundStyle(BunTheme.ink)
                                            .frame(width: 44, height: 44)
                                            .background(BunTheme.field, in: Circle())
                                        Text(doc.title).font(bunFont(18)).foregroundStyle(BunTheme.ink).lineLimit(1)
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.system(size: 14, weight: .regular))
                                            .foregroundStyle(BunTheme.secondary)
                                    }
                                    .frame(minHeight: 60)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(BunPressStyle())
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadDocs() }
    }
}

/// One doc, read-only: title + paragraphs (headings promoted).
private struct BunDocScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    let docId: UUID

    private var doc: PortalAPI.Doc? { store.docs?.first { $0.id == docId } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                if let doc {
                    BunTitle(text: doc.title)
                    ForEach(Array(doc.content.components(separatedBy: "\n\n").enumerated()), id: \.offset) { _, block in
                        let trimmed = block.trimmingCharacters(in: .whitespacesAndNewlines)
                        if trimmed.hasPrefix("#") {
                            Text(trimmed.drop(while: { $0 == "#" || $0 == " " }))
                                .font(bunFont(22, .medium)).foregroundStyle(BunTheme.ink)
                                .padding(.top, 8)
                        } else if !trimmed.isEmpty {
                            Text(trimmed).font(bunFont(17)).foregroundStyle(BunTheme.ink.opacity(0.9))
                                .lineSpacing(4)
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
    }
}


/// Appearance: the app ships dark (the design language IS dark); the other
/// modes arrive with the light theme.
private struct BunAppearanceScreen: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("bunAppearance") private var appearance = "dark"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                BunTitle(text: "Appearance")
                HStack(spacing: 12) {
                    modeTile("light", label: "Light", symbol: "sun.max")
                    modeTile("dark", label: "Dark", symbol: "moon")
                    modeTile("system", label: "System", symbol: "circle.lefthalf.filled")
                }
                Text("Bun follows this everywhere, including sheets and the tab bar.")
                    .font(bunFont(15)).foregroundStyle(BunTheme.secondary)
                Spacer()
            }
            .padding(.horizontal, 22).padding(.top, 14)
        }
        .scrollIndicators(.hidden)
    }

    private func modeTile(_ value: String, label: String, symbol: String) -> some View {
        let selected = appearance == value
        return Button {
            withAnimation(.snappy(duration: 0.25)) { appearance = value }
        } label: {
            VStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(selected ? BunTheme.indigoLight : BunTheme.secondary)
                Text(label).font(bunFont(16, selected ? .medium : .regular))
                    .foregroundStyle(selected ? BunTheme.ink : BunTheme.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 96)
            .background(selected ? BunTheme.fieldBright : BunTheme.raised,
                        in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(selected ? BunTheme.indigo.opacity(0.55) : .clear, lineWidth: 1.5))
        }
        .buttonStyle(BunPressStyle())
        .accessibilityLabel("\(label) appearance")
    }
}

private struct BunHelpScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                BunTitle(text: "Help")
                BunIconRow(symbol: "book", title: "Knowledge", subtitle: "Playbooks and SOPs")
                BunIconRow(symbol: "envelope", title: "Contact the team", subtitle: "However your team already talks")
                Text("Admin tools, team management, and doc editing live in Bun on the web.")
                    .font(bunFont(16)).foregroundStyle(BunTheme.secondary)
            }
            .padding(.horizontal, 22).padding(.top, 14)
        }
        .scrollIndicators(.hidden)
    }
}

/// 2FA status: managed by the identity provider (Supabase Auth) — surfaced
/// honestly rather than faked.
private struct BunTwoFactorScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                BunTitle(text: "Two-Factor Authentication")
                Text("Sign-in security is managed by your identity provider. Enrollment controls arrive here in a later release; until then 2FA is configured in Bun on the web.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            }
            .padding(.horizontal, 22).padding(.top, 14)
        }
        .scrollIndicators(.hidden)
    }
}

/// Workspace switcher off the Home org chip. Signed in it lists real org
/// memberships (data scoping arrives with Phase 2); the preview ships demo
/// workspaces so nothing dead-ends.
struct BunOrgSwitcherSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var showCreate = false
    private var live: Bool { store.signedIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                BunTitle(text: "Workspaces")
                Spacer()
                BunChipButton(symbol: "xmark") { dismiss() }
            }
            VStack(spacing: 0) {
                if live {
                    ForEach(store.orgs ?? [], id: \.id) { org in
                        workspaceRow(name: org.name, active: org.id == (store.activeOrg?.id)) {
                            guard !store.isSwitchingOrg else { return }
                            Task {
                                await store.switchOrg(org.id)
                                dismiss()
                            }
                        }
                    }
                    if store.isSwitchingOrg {
                        HStack(spacing: 10) {
                            ProgressView().tint(BunTheme.secondary)
                            Text("Switching workspace…").font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                        }
                        .padding(.vertical, 10)
                        .accessibilityIdentifier("bun.org.switching")
                    }
                } else {
                    ForEach(BunFixtures.workspaces, id: \.self) { name in
                        workspaceRow(name: name, active: name == store.fixtureOrgName) {
                            store.fixtureOrgName = name
                            dismiss()
                        }
                    }
                }
            }
            if live {
                Button { showCreate = true } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "plus")
                            .font(.system(size: 17, weight: .regular))
                            .foregroundStyle(BunTheme.indigoLight)
                            .frame(width: 44, height: 44)
                            .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        Text("New business").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                        Spacer()
                    }
                    .padding(.vertical, 10)
                }
                .buttonStyle(BunPressStyle())
            }
            Spacer()
        }
        .padding(.horizontal, 22)
        .padding(.top, 18)
        .sheet(isPresented: $showCreate) {
            BunCreateBusinessView()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
    }

    private func workspaceRow(name: String, active: Bool, select: @escaping () -> Void) -> some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(BunTheme.field)
                .frame(width: 44, height: 44)
                .overlay(Text(String(name.prefix(1))).font(bunFont(19, .medium)).foregroundStyle(BunTheme.ink))
            Text(name).font(bunFont(19)).foregroundStyle(BunTheme.ink)
            Spacer()
            if active {
                Image(systemName: "checkmark")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(BunTheme.indigoLight)
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .onTapGesture(perform: select)
    }
}

/// Read-only profile screen off the Settings header row.
struct BunProfileScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var auth = AuthStore.shared
    @State private var store = BunStore.shared

    @State private var name = ""
    @State private var phone = ""
    @State private var loaded = false
    @State private var saving = false
    @State private var saveError: String?
    @State private var saved = false

    private var live: Bool { auth.isSignedIn }
    private var email: String { live ? (auth.session?.user.email ?? "") : BunFixtures.userEmail }
    private var roleLine: String {
        live ? (auth.roles.isEmpty ? "No role yet" : auth.roles.map(\.rawValue).joined(separator: " · "))
             : "Admin · Founder"
    }

    /// Setter type is a PROFILE field, not a device preference: it decides
    /// which fields the EOD form shows and which targets judge the day.
    private static let setterTypes: [(key: String, label: String)] = [
        ("phone", "Phone"), ("dm", "DM"), ("full_cycle", "Full cycle"),
    ]

    var body: some View {
        ZStack {
            BunTheme.ground.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HStack {
                        BunChipButton(symbol: "chevron.left") { dismiss() }
                        Spacer()
                    }
                    BunTitle(text: "Profile")

                    HStack(spacing: 16) {
                        BunAvatar(text: String((name.isEmpty ? "?" : name).prefix(1)), size: 64,
                                  fill: Color(red: 0.153, green: 0.400, blue: 0.420))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(name.isEmpty ? "Your profile" : name)
                                .font(bunFont(22, .medium)).foregroundStyle(BunTheme.ink)
                            Text(email).font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                                .lineLimit(1).truncationMode(.middle)
                        }
                    }

                    BunField(label: "Display name", placeholder: "How your name appears", text: $name)
                    BunField(label: "Phone", placeholder: "For reminders and calls", text: $phone)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Setter type").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                        Text("Decides which numbers your EOD asks for.")
                            .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                        HStack(spacing: 10) {
                            ForEach(Self.setterTypes, id: \.key) { type in
                                Button {
                                    Task { try? await store.setSetterType(type.key) }
                                } label: {
                                    Text(type.label).font(bunFont(16))
                                        .foregroundStyle(store.setterType == type.key ? .white : BunTheme.ink)
                                        .padding(.horizontal, 16).frame(height: 42)
                                        .background(store.setterType == type.key
                                                    ? AnyShapeStyle(BunTheme.indigo) : AnyShapeStyle(BunTheme.raised),
                                                    in: Capsule())
                                }
                                .buttonStyle(BunPressStyle())
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Timezone").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                        Text("Your EOD day follows this, so a late night still files against the right date.")
                            .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Menu {
                            ForEach(store.timezoneChoices, id: \.self) { zone in
                                Button("\(zone)\(store.timezone == zone ? " ✓" : "")") {
                                    Task { try? await store.setTimezone(zone) }
                                }
                            }
                        } label: {
                            HStack(spacing: 8) {
                                Text(store.timezone ?? TimeZone.current.identifier)
                                    .font(bunFont(17)).foregroundStyle(BunTheme.ink).lineLimit(1)
                                Image(systemName: "arrowtriangle.down.fill")
                                    .font(.system(size: 8, weight: .regular)).foregroundStyle(BunTheme.secondary)
                                Spacer()
                            }
                            .padding(.horizontal, 16).frame(height: 54)
                            .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                    }

                    VStack(spacing: 0) {
                        profileRow(label: "Workspace", value: store.orgName)
                        profileRow(label: "Roles", value: roleLine)
                    }

                    if let saveError {
                        Text(saveError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                    }
                    BunCTA(label: saving ? "Saving…" : (saved ? "Saved" : "Save changes"),
                           enabled: !saving, filled: true) { save() }
                    Spacer(minLength: 20)
                }
                .padding(.horizontal, 22)
                .padding(.top, 14)
                .padding(.bottom, 40)
            }
            .scrollIndicators(.hidden)
        }
        .task {
            guard !loaded else { return }
            await store.loadProfile()
            name = store.displayName ?? (live ? "" : BunFixtures.userFullName)
            phone = store.phone ?? ""
            loaded = true
        }
    }

    private func save() {
        saving = true
        Task {
            do {
                try await store.saveProfile(name: name, phone: phone)
                saving = false
                saved = true
                saveError = nil
            } catch {
                saving = false
                saveError = "Could not save: \(error.localizedDescription)"
            }
        }
    }

    private func profileRow(label: String, value: String) -> some View {
        HStack {
            Text(label).font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            Spacer()
            Text(value).font(bunFont(17)).foregroundStyle(BunTheme.ink)
                .lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(height: 56)
    }
}

