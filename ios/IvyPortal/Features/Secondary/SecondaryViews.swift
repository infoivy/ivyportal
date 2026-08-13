import SwiftUI

private struct PortalDetail: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let symbol: String
}

struct MoreView: View {
    let entries: [MoreEntry]
    @State private var detail: PortalDetail?
    @State private var auth = AuthStore.shared
    @State private var authPresented = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(title: "More", subtitle: "Account and authorized tools")
                accountSection
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(entries.enumerated()), id: \.element) { index, entry in
                            Button {
                                detail = PortalDetail(title: entry.title, message: entry.detail, symbol: entry.symbol)
                            } label: {
                                HStack {
                                    Image(systemName: entry.symbol).frame(width: 28).foregroundStyle(.secondary)
                                    Text(entry.title).font(.headline)
                                    Spacer()
                                    Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                                }
                                .frame(minHeight: 60)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(PressableButtonStyle())
                            if index < entries.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 40) }
                        }
                    }
                }
            }.padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $detail) { PortalDetailSheet(detail: $0) }
        .sheet(isPresented: $authPresented) {
            AuthView(store: auth)
                .presentationDetents([.large])
                .presentationBackground(.black)
        }
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Account").font(.caption.bold()).tracking(1).foregroundStyle(.secondary)
            SurfaceCard {
                VStack(spacing: 0) {
                    if auth.isSignedIn {
                        HStack(spacing: 12) {
                            AvatarBadge(name: "S", color: ivyTeal)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(auth.session?.user.email ?? "Signed in").font(.headline)
                                Text("Admin · Founder").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                        }.frame(minHeight: 64)
                        Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54)
                        Button {
                            Task { await auth.signOut() }
                        } label: {
                            HStack(spacing: 12) {
                                Text("Sign out").font(.subheadline.weight(.semibold)).foregroundStyle(.red)
                                Spacer()
                            }.frame(minHeight: 50).contentShape(Rectangle())
                        }.buttonStyle(PressableButtonStyle())
                    } else {
                        Button { authPresented = true } label: {
                            HStack(spacing: 14) {
                                Image(systemName: "person.badge.key.fill").font(.system(size: 15, weight: .semibold)).frame(width: 42, height: 42).background(Color.blue.opacity(0.18), in: Circle()).foregroundStyle(.blue)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Sign in to Portal").font(.headline)
                                    Text("Load live data with your portal account").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                            }.frame(minHeight: 64).contentShape(Rectangle())
                        }.buttonStyle(PressableButtonStyle())
                    }
                }
            }
            if !auth.isSignedIn {
                Text("Preview mode: everything is open. Sign in for live portal data.")
                    .font(.caption).foregroundStyle(.tertiary)
            }
        }
    }
}

private struct PortalDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let detail: PortalDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                Image(systemName: detail.symbol).font(.title2)
                Text(detail.title).font(.title2.bold())
                Spacer()
                Button("Done") { dismiss() }.frame(minHeight: 48)
            }
            Text(detail.message).font(.body).foregroundStyle(.secondary)
            Text("This native surface will use verified Ivy Portal data when the corresponding service is connected.")
                .font(.caption).foregroundStyle(.tertiary)
            Spacer()
        }
        .padding(24)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationBackground(ivySurface)
    }
}

private extension MoreEntry {
    var title: String {
        switch self {
        case .knowledge: "Knowledge"
        case .profile: "Profile"
        case .teamAdministration: "Team administration"
        case .admin: "Admin"
        case .integrations: "Integrations"
        case .finance: "Finance"
        case .cards: "Cards"
        case .signOut: "Sign out"
        }
    }
    var symbol: String {
        switch self {
        case .knowledge: "book.closed.fill"
        case .profile: "person.crop.circle"
        case .teamAdministration: "person.3.fill"
        case .admin: "lock.shield.fill"
        case .integrations: "puzzlepiece.extension.fill"
        case .finance: "chart.pie.fill"
        case .cards: "creditcard.fill"
        case .signOut: "rectangle.portrait.and.arrow.right"
        }
    }
    var detail: String {
        switch self {
        case .knowledge: "Open the Ivy knowledge base."
        case .profile: "Review your profile and account details."
        case .teamAdministration: "Manage authorized team members and roles."
        case .admin: "Open restricted administration tools."
        case .integrations: "Review connected services and integration health."
        case .finance: "Review authorized financial reporting."
        case .cards: "Review saved payment-card controls."
        case .signOut: "End the current authenticated session."
        }
    }
}
