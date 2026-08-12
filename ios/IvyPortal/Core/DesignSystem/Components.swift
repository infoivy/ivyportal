import SwiftUI

let ivySurface = Color(red: 0.105, green: 0.108, blue: 0.118)
let ivyRaised = Color(red: 0.145, green: 0.148, blue: 0.16)
let ivyMuted = Color(red: 0.62, green: 0.62, blue: 0.66)
let ivyGreen = Color(red: 0.35, green: 0.78, blue: 0.46)
let ivyTeal = Color(red: 0.34, green: 0.74, blue: 0.69)

private struct PortalMenuActionKey: EnvironmentKey {
    nonisolated(unsafe) static let defaultValue: () -> Void = {}
}

extension EnvironmentValues {
    var openPortalMenu: () -> Void {
        get { self[PortalMenuActionKey.self] }
        set { self[PortalMenuActionKey.self] = newValue }
    }
}

struct ScreenHeader: View {
    @Environment(\.openPortalMenu) private var openMenu
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            ZStack {
                Text(title)
                    .font(.title2.bold())
                    .frame(maxWidth: .infinity)
                    .accessibilityAddTraits(.isHeader)
                HStack {
                    Button(action: openMenu) {
                        Image(systemName: "line.3.horizontal")
                            .font(.system(size: 18, weight: .semibold))
                            .frame(width: 48, height: 48)
                            .background(ivySurface, in: Circle())
                            .overlay(Circle().stroke(Color.white.opacity(0.1)))
                    }
                    .buttonStyle(PressableButtonStyle())
                    .accessibilityLabel("Open navigation")
                    Spacer()
                }
            }
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.largeTitle.bold())
                    .tracking(-0.7)
                    .accessibilityAddTraits(.isHeader)
            }
        }
    }
}

struct SurfaceCard<Content: View>: View {
    var padding: CGFloat = 18
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ivySurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
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
        Button { action?() } label: {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top, spacing: 8) {
                        Text(title)
                            .font(.subheadline)
                            .foregroundStyle(ivyMuted)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 4)
                        Image(systemName: symbol)
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                            .frame(width: 30, height: 30)
                            .background(accent, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    }
                    Text(value)
                        .font(.system(.title, design: .rounded, weight: .semibold))
                        .monospacedDigit()
                    Text(context)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                .frame(minHeight: 112, alignment: .top)
            }
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(action == nil)
        .accessibilityElement(children: .combine)
        .accessibilityHint(action == nil ? "" : "Opens metric details")
    }
}

struct FilterChip: View {
    let title: String
    let symbol: String

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: symbol)
            Text(title).lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
        }
        .font(.subheadline.weight(.semibold))
        .frame(minHeight: 48)
        .padding(.horizontal, 15)
        .background(ivySurface, in: Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.09)))
    }
}

struct SegmentedPicker<Option: Hashable & CaseIterable>: View where Option.AllCases: RandomAccessCollection {
    @Binding var selection: Option
    let title: (Option) -> String

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(Option.allCases), id: \.self) { option in
                Button { selection = option } label: {
                    Text(title(option))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(selection == option ? .white : .secondary)
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(selection == option ? Color.white.opacity(0.25) : .clear, in: Capsule())
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
        .padding(4)
        .background(ivySurface, in: Capsule())
    }
}

struct StatusPill: View {
    let title: String
    let color: Color

    var body: some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(color.opacity(0.15), in: Capsule())
    }
}

struct AvatarBadge: View {
    let name: String
    let color: Color

    var body: some View {
        Circle()
            .fill(color.opacity(0.9))
            .frame(width: 42, height: 42)
            .overlay(Text(name.prefix(1)).font(.headline).foregroundStyle(.white))
            .accessibilityHidden(true)
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
