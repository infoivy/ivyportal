import SwiftUI

/// Self-serve business creation: a fresh Bun account with no workspace
/// names their business and gets their own org (create_organization RPC;
/// the caller becomes owner/admin/founder of the NEW org only).
struct BunCreateBusinessView: View {
    @State private var store = BunStore.shared
    @State private var name = ""
    @State private var working = false
    @State private var createError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack(spacing: 12) {
                    Image("BunLogo").resizable().renderingMode(.template).scaledToFit()
                        .foregroundStyle(BunTheme.ink)
                        .frame(width: 34, height: 34)
                    Text("Bun").font(bunFont(24, .medium)).foregroundStyle(BunTheme.ink)
                }
                .padding(.top, 40)
                BunTitle(text: "Name your business")
                Text("Your workspace holds your team, clients, and money. You can invite setters and closers right after.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                BunField(label: "Business name", placeholder: "Acme Coaching", text: $name)
                if let createError {
                    Text(createError).font(bunFont(16)).foregroundStyle(BunTheme.pink)
                }
                BunCTA(label: working ? "Creating…" : "Create business",
                       enabled: name.trimmingCharacters(in: .whitespaces).count >= 2 && !working,
                       filled: name.trimmingCharacters(in: .whitespaces).count >= 2) {
                    working = true
                    Task {
                        do {
                            try await store.createBusiness(named: name.trimmingCharacters(in: .whitespaces))
                            await store.refreshAll()
                            createError = nil
                        } catch {
                            createError = "Could not create the business: \(error.localizedDescription)"
                        }
                        working = false
                    }
                }
                Button {
                    Task { await AuthStore.shared.signOut() }
                } label: {
                    Text("Log out").font(bunFont(17)).foregroundStyle(BunTheme.indigoLight)
                }
                .buttonStyle(BunPressStyle())
                .padding(.top, 8)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
    }
}

/// Invite teammates into the active business (invitations insert; the
/// signup trigger grants roles + org membership when they join).
struct BunInviteSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var email = ""
    @State private var selectedRoles: Set<String> = ["setter"]
    @State private var working = false
    @State private var sent = false
    @State private var inviteError: String?

    private let roleOptions = ["setter", "closer", "csm", "coach", "admin"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                BunTitle(text: "Invite teammates")
                Text("They get their roles the moment they sign up with this email.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                BunField(label: "Email", placeholder: "teammate@business.com", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                Text("Roles").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                ScrollView(.horizontal) {
                    HStack(spacing: 10) {
                        ForEach(roleOptions, id: \.self) { role in
                            let active = selectedRoles.contains(role)
                            Button {
                                if active { selectedRoles.remove(role) } else { selectedRoles.insert(role) }
                            } label: {
                                Text(role.capitalized).font(bunFont(16, .medium))
                                    .foregroundStyle(active ? BunTheme.ink : BunTheme.secondary)
                                    .padding(.horizontal, 16).frame(height: 44)
                                    .background(active ? BunTheme.fieldBright : BunTheme.raised, in: Capsule())
                            }
                            .buttonStyle(BunPressStyle())
                        }
                    }
                }
                .scrollIndicators(.hidden)
                if let inviteError {
                    Text(inviteError).font(bunFont(16)).foregroundStyle(BunTheme.pink)
                }
                if sent {
                    Text("Invite saved. It applies when they sign up.")
                        .font(bunFont(16)).foregroundStyle(BunTheme.green)
                }
                BunCTA(label: working ? "Inviting…" : "Send invite",
                       enabled: email.contains("@") && !selectedRoles.isEmpty && !working,
                       filled: email.contains("@") && !selectedRoles.isEmpty) {
                    working = true
                    sent = false
                    Task {
                        do {
                            try await PortalAPI.shared.inviteTeammate(
                                email: email.trimmingCharacters(in: .whitespaces),
                                roles: Array(selectedRoles),
                                orgId: store.activeOrg?.id
                            )
                            sent = true
                            email = ""
                            inviteError = nil
                        } catch {
                            inviteError = "Could not save the invite: \(error.localizedDescription)"
                        }
                        working = false
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
    }
}
