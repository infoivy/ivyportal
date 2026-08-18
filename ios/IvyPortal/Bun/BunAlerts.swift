import SwiftUI
import UIKit

// Two closer-facing surfaces that existed in the data layer but nowhere in the
// app (founder 2026-08-18: "still stuff missing from portal"): the web's
// notification bell, and the payment links a closer sends on the call.

/// The bell. `portalAlerts` already computes exactly what the web's bell
/// shows, family by family and role-gated; it just had nothing to render into.
struct BunAlertsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    BunTitle(text: "Alerts")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                if store.alerts == nil {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 62)
                    }
                } else if (store.alerts?.alerts ?? []).isEmpty {
                    Text("Nothing needs you right now.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                        .padding(.top, 6)
                } else {
                    VStack(spacing: 0) {
                        ForEach(store.alerts?.alerts ?? []) { alert in
                            alertRow(alert)
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadAlerts() }
        .refreshable {
            store.alerts = nil
            await store.loadAlerts()
        }
    }

    private func alertRow(_ alert: PortalAlert) -> some View {
        HStack(spacing: 14) {
            Image(systemName: Self.symbol(alert.family))
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(Self.tint(alert.tone))
                .frame(width: 44, height: 44)
                .background(Self.tint(alert.tone).opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(alert.title).font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(alert.detail).font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
        }
        .frame(minHeight: 70)
    }

    private static func symbol(_ family: PortalAlert.Family) -> String {
        switch family {
        case .payout: "wallet.bifold"
        case .signup: "person.badge.plus"
        case .unclaimedSet: "calendar.badge.exclamationmark"
        case .setNudge: "bell"
        case .student: "graduationcap"
        case .installment: "creditcard"
        }
    }

    private static func tint(_ tone: PortalAlert.Tone) -> Color {
        switch tone {
        case .danger: BunTheme.pink
        case .warning: Color(red: 0.95, green: 0.72, blue: 0.35)
        case .positive: BunTheme.green
        case .neutral: BunTheme.indigoLight
        }
    }
}

/// Payment links: what a closer actually sends the moment someone says yes.
/// Copy puts the URL on the clipboard, because that is the whole job.
struct BunPaymentLinksSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var copied: UUID?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    BunTitle(text: "Payment links")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                Text("Send these on the call. Tap to copy.")
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)

                if store.paymentLinks == nil {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 62)
                    }
                } else if (store.paymentLinks ?? []).isEmpty {
                    Text("No payment links set up yet. They are created in Bun on the web.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(store.paymentLinks ?? []) { link in
                            linkRow(link)
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadPaymentLinks() }
    }

    private func linkRow(_ link: PortalAPI.PaymentLink) -> some View {
        Button {
            guard let url = link.url, !url.isEmpty else { return }
            UIPasteboard.general.string = url
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation(.snappy(duration: 0.2)) { copied = link.id }
            Task {
                try? await Task.sleep(for: .seconds(2))
                withAnimation(.easeOut(duration: 0.3)) { if copied == link.id { copied = nil } }
            }
        } label: {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(link.label).font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                    Text(caption(link)).font(BunType.caption)
                        .foregroundStyle(BunTheme.secondary).lineLimit(1)
                }
                Spacer(minLength: 8)
                if let amount = link.amount, amount > 0 {
                    BunMoney(amount: amount, size: BunType.Money.row)
                }
                Image(systemName: copied == link.id ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(copied == link.id ? BunTheme.green : BunTheme.secondary)
                    .frame(width: 40, height: 40)
            }
            .frame(minHeight: 66)
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
        .disabled((link.url ?? "").isEmpty)
    }

    private func caption(_ link: PortalAPI.PaymentLink) -> String {
        var bits = [link.method.capitalized]
        if link.currency.uppercased() != "USD" { bits.append(link.currency.uppercased()) }
        if let notes = link.notes, !notes.isEmpty { bits.append(notes) }
        if (link.url ?? "").isEmpty { bits.append("no URL yet") }
        return bits.joined(separator: " · ")
    }
}
