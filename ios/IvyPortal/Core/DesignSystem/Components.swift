import SwiftUI

let ivySurface = Color(red: 0.075, green: 0.078, blue: 0.09)
let ivyRaised = Color(red: 0.105, green: 0.11, blue: 0.125)
let ivyGreen = Color(red: 0.2, green: 0.82, blue: 0.52)

struct ScreenHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Image(systemName: "leaf.fill")
                    .font(.caption.bold())
                    .frame(width: 32, height: 32)
                    .background(ivyRaised, in: Circle())
                Text("IVY PORTAL")
                    .font(.caption2.weight(.bold))
                    .tracking(0.8)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.bottom, 12)
            Text(title)
                .font(.title.bold())
                .accessibilityAddTraits(.isHeader)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

struct SurfaceCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ivySurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.white.opacity(0.06)))
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let context: String
    let symbol: String
    let accent: Color
    var action: (() -> Void)?

    var body: some View {
        Button {
            action?()
        } label: {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top) {
                        Text(title).font(.subheadline).foregroundStyle(.secondary)
                        Spacer()
                        Image(systemName: symbol).foregroundStyle(accent)
                    }
                    Text(value)
                        .font(.system(.title, design: .rounded, weight: .semibold))
                        .monospacedDigit()
                    Text(context).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(action == nil)
        .accessibilityElement(children: .combine)
        .accessibilityHint(action == nil ? "" : "Opens metric details")
    }
}

struct StatusCard: View {
    let symbol: String
    let title: String
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        SurfaceCard {
            VStack(spacing: 16) {
                Image(systemName: symbol).font(.title).foregroundStyle(.secondary)
                Text(title).font(.headline)
                Text(message).multilineTextAlignment(.center).font(.subheadline).foregroundStyle(.secondary)
                if let retry {
                    Button("Retry", action: retry)
                        .buttonStyle(.borderedProminent)
                        .tint(.white)
                        .foregroundStyle(.black)
                        .frame(minHeight: 48)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
        }
    }
}
