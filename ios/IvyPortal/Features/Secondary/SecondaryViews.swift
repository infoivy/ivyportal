import SwiftUI

private struct PortalDetail: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let symbol: String
}

struct WorkView: View {
    private let items = [
        ("Action items", "2 overdue · 5 open", "checklist", Color.orange, "Review assigned, overdue, and completed action items."),
        ("Calendar", "3 calls today", "calendar", Color.blue, "View today’s calls and scheduled reviews."),
        ("CRM", "Lead queues and follow-up", "tray.full.fill", Color.purple, "Open lead queues and verified follow-up work."),
        ("Money in", "Deals and installments", "banknote.fill", ivyGreen, "Review verified deals, installments, and payment matching."),
        ("Team chat", "Operational updates", "bubble.left.and.bubble.right.fill", Color.cyan, "Read operational team updates."),
    ]
    @State private var detail: PortalDetail?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(title: "Work", subtitle: "Queues that need action")
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(items.enumerated()), id: \.element.0) { index, item in
                            Button {
                                detail = PortalDetail(title: item.0, message: item.4, symbol: item.2)
                            } label: {
                                HStack(spacing: 14) {
                                    Image(systemName: item.2).foregroundStyle(item.3).frame(width: 28)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(item.0).font(.headline)
                                        Text(item.1).font(.subheadline).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                                }
                                .frame(minHeight: 64)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(PressableButtonStyle())
                            if index < items.count - 1 {
                                Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 42)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $detail) { PortalDetailSheet(detail: $0) }
    }
}

struct CustomersView: View {
    private let customers = [
        ("Amina H.", "Missing weekly check-in", Color.orange),
        ("Yusuf K.", "Coaching follow-up due", Color.red),
        ("Maryam A.", "Onboarding in progress", Color.blue),
    ]
    @State private var detail: PortalDetail?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(title: "Clients", subtitle: "Student health and delivery")
                MetricCard(title: "Active students", value: "47", context: "3 need attention", symbol: "person.2.fill", accent: .blue) {
                    detail = PortalDetail(title: "Active students", message: "47 active students. 3 currently need attention.", symbol: "person.2.fill")
                }
                VStack(alignment: .leading, spacing: 12) {
                    Text("Needs attention").font(.title3.bold())
                    SurfaceCard {
                        VStack(spacing: 0) {
                            ForEach(Array(customers.enumerated()), id: \.element.0) { index, customer in
                                Button {
                                    detail = PortalDetail(title: customer.0, message: customer.1, symbol: "person.crop.circle.fill")
                                } label: {
                                    customerRow(customer.0, customer.1, customer.2)
                                }
                                .buttonStyle(PressableButtonStyle())
                                if index < customers.count - 1 {
                                    Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 56)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $detail) { PortalDetailSheet(detail: $0) }
    }

    private func customerRow(_ name: String, _ detail: String, _ color: Color) -> some View {
        HStack(spacing: 12) {
            Circle().fill(color.opacity(0.18)).frame(width: 44, height: 44)
                .overlay(Text(name.prefix(1)).font(.headline).foregroundStyle(color))
            VStack(alignment: .leading, spacing: 3) {
                Text(name).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
        }
        .frame(minHeight: 64)
        .contentShape(Rectangle())
    }
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
