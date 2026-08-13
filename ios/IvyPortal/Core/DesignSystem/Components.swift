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
    var showsMenu = false

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            ZStack {
                Text(title)
                    .font(.title2.bold())
                    .frame(maxWidth: .infinity)
                    .accessibilityAddTraits(.isHeader)
                if showsMenu {
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

// MARK: - Motion (locked: docs/ios/DESIGN-LANGUAGE.md §7)

/// Quiet spring used for sheets, section changes, and navigation.
let ivySpring = Animation.spring(duration: 0.34, bounce: 0.22)

/// Skeleton block that matches the final card geometry while loading.
struct SkeletonBlock: View {
    var height: CGFloat = 120
    var cornerRadius: CGFloat = 20

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(ivySurface)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .shimmer()
    }
}

/// Layout-preserving skeleton for a list of cards.
struct SkeletonCards: View {
    var count = 3
    var height: CGFloat = 120

    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<count, id: \.self) { _ in SkeletonBlock(height: height) }
        }
        .accessibilityLabel("Loading")
    }
}

private struct ShimmerModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        if reduceMotion {
            content.opacity(0.7)
        } else {
            content
                .overlay(
                    LinearGradient(
                        colors: [.clear, Color.white.opacity(0.06), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .offset(x: phase * 400)
                )
                .onAppear {
                    withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                        phase = 1.2
                    }
                }
        }
    }
}

extension View {
    func shimmer() -> some View { modifier(ShimmerModifier()) }
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
// MARK: - Mochi design language (locked: docs/ios/DESIGN-LANGUAGE.md)

struct ScreenTitle: View {
    let title: String
    var subtitle = ""

    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.largeTitle.bold())
                .tracking(-0.6)
                .accessibilityAddTraits(.isHeader)
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct IconSquare: View {
    let symbol: String
    let color: Color
    var size: CGFloat = 32

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.45, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(color, in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
            .accessibilityHidden(true)
    }
}

/// Mochi metric card: icon square + small title + big number + context.
struct MetricNumberCard: View {
    let title: String
    let value: String
    let context: String
    let symbol: String
    let color: Color
    var action: (() -> Void)?

    var body: some View {
        Button { action?() } label: {
            SurfaceCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        IconSquare(symbol: symbol, color: color, size: 30)
                        Spacer()
                        if action != nil {
                            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                        }
                    }
                    Text(title).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    Text(value).font(.system(.title, design: .rounded, weight: .semibold)).monospacedDigit()
                    Text(context).font(.caption2).foregroundStyle(color).lineLimit(2)
                }
                .frame(maxWidth: .infinity, minHeight: 116, alignment: .leading)
            }
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(action == nil)
        .accessibilityElement(children: .combine)
        .accessibilityHint(action == nil ? "" : "Opens details")
    }
}

/// Mochi funnel/stage row: colored icon square + label + count + chevron.
struct FunnelRow: View {
    let title: String
    let value: String
    let symbol: String
    let color: Color
    var action: (() -> Void)? = nil

    var body: some View {
        Button { action?() } label: {
            HStack(spacing: 14) {
                IconSquare(symbol: symbol, color: color, size: 28)
                Text(title).font(.subheadline.weight(.semibold))
                Spacer()
                Text(value).font(.subheadline.bold()).monospacedDigit()
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
            }
            .frame(minHeight: 50)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
    }
}

struct SectionLabel: View {
    let title: String

    var body: some View {
        Text(title.uppercased())
            .font(.caption.bold())
            .tracking(1)
            .foregroundStyle(.secondary)
    }
}

/// Stacked label/value pair inside a card (Mochi pair style, e.g. reply rate / median time).
struct PairStat: View {
    let value: String
    let label: String
    var color: Color = .white

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(value).font(.system(.title2, design: .rounded, weight: .semibold)).monospacedDigit().foregroundStyle(color)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}