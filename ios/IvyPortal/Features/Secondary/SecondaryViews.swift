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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(title: "More", subtitle: "Account and authorized tools")
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
