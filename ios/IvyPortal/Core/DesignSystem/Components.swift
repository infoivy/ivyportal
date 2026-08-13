import SwiftUI

let ivySurface = Color(red: 0.11, green: 0.11, blue: 0.118)      // #1C1C1E — Mochi card
let ivyRaised = Color(red: 0.173, green: 0.173, blue: 0.18)      // #2C2C2E — Mochi raised/active
let ivyMuted = Color(red: 0.62, green: 0.62, blue: 0.66)
let ivyGreen = Color(red: 0.35, green: 0.78, blue: 0.46)
let ivyTeal = Color(red: 0.34, green: 0.74, blue: 0.69)
// Mochi accent ramp (funnel / category differentiation)
let ivyBlue = Color(red: 0.37, green: 0.36, blue: 0.90)          // #5E5CE6
let ivyPink = Color(red: 0.96, green: 0.42, blue: 0.61)
let ivyPurple = Color(red: 0.69, green: 0.48, blue: 0.95)
let ivyOrange = Color(red: 1.0, green: 0.62, blue: 0.04)         // #FF9F0A
let ivyRed = Color(red: 1.0, green: 0.27, blue: 0.23)            // #FF453A
let ivyMint = Color(red: 0.19, green: 0.82, blue: 0.35)          // #30D158
// Progress-bar track: visible-but-quiet remainder (Mochi keeps it readable, not invisible).
let ivyTrack = Color.white.opacity(0.16)

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
    /// Large subtitle (Home greeting) vs a small section subtitle (Work/Money).
    var compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 24) {
            ZStack {
                Text(title)
                    .font(compact ? .title3.bold() : .title2.bold())
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
                    .font(compact ? .subheadline.weight(.medium) : .largeTitle.bold())
                    .tracking(compact ? 0 : -0.7)
                    .foregroundStyle(compact ? .secondary : .primary)
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

/// Mochi progress bar: solid fill with a subtly visible remainder track.
struct ProgressBar: View {
    let progress: Double   // 0...1
    var color: Color = .white
    var height: CGFloat = 8

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(ivyTrack).frame(height: height)
                Capsule().fill(color).frame(width: geo.size.width * min(max(progress, 0), 1), height: height)
            }
        }
        .frame(height: height)
        .accessibilityLabel("Progress \(Int(progress * 100)) percent")
    }
}

// MARK: - Mochi hero + grid vocabulary (IMG_7144/7140/7138)

/// Mochi hero stat: colored icon square + huge thin number + caption. The
/// visual anchor of a detail/analytics screen (e.g. Total Replies "476").
struct HeroStat: View {
    let symbol: String
    let color: Color
    let value: String
    var caption: String = ""

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: symbol)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 76, height: 76)
                .background(color, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            Text(value)
                .font(.system(size: 76, weight: .medium, design: .rounded))
                .monospacedDigit()
                .tracking(-2)
            if !caption.isEmpty {
                Text(caption).font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }
}

/// Mochi 2-col stat tile: small grey label + icon top row, big bold value.
struct StatTile: View {
    let label: String
    let value: String
    let symbol: String
    var valueColor: Color = .white
    var action: (() -> Void)? = nil

    var body: some View {
        Button { action?() } label: {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    Text(label).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                    Spacer(minLength: 4)
                    Image(systemName: symbol).font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                }
                Text(value).font(.system(.title, design: .rounded, weight: .semibold)).monospacedDigit().foregroundStyle(valueColor)
            }
            .padding(18)
            .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
            .background(ivySurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(action == nil)
        .accessibilityElement(children: .combine)
    }
}

/// Mochi horizontal daily-breakdown strip: colored active cells, grey empty dashes.
struct DailyStrip: View {
    struct Day: Hashable { let label: String; let value: String; let active: Bool }
    let days: [Day]
    var color: Color = ivyTeal

    var body: some View {
        HStack(spacing: 8) {
            ForEach(days, id: \.self) { day in
                VStack(spacing: 6) {
                    Text(day.label).font(.caption2.weight(.semibold)).foregroundStyle(day.active ? .white.opacity(0.85) : .secondary)
                    Text(day.value).font(.subheadline.bold()).monospacedDigit().foregroundStyle(day.active ? .white : .secondary)
                }
                .frame(maxWidth: .infinity, minHeight: 64)
                .background(day.active ? color : ivySurface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }
}

/// Mochi revenue-breakdown bar: one full-width stacked bar + dot legend with % badges.
struct BreakdownBar: View {
    struct Segment: Hashable { let label: String; let value: String; let percent: Int; let color: Color }
    let title: String
    let subtitle: String
    let keptLabel: String
    let keptValue: String
    let segments: [Segment]

    var body: some View {
        SurfaceCard(padding: 20) {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title).font(.title3.bold())
                        Text(subtitle).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(keptLabel).font(.caption).foregroundStyle(.secondary)
                        Text(keptValue).font(.title3.bold()).monospacedDigit()
                    }
                }
                // stacked bar
                GeometryReader { geo in
                    HStack(spacing: 2) {
                        ForEach(segments, id: \.self) { seg in
                            if seg.percent > 0 {
                                RoundedRectangle(cornerRadius: 4).fill(seg.color)
                                    .frame(width: geo.size.width * CGFloat(seg.percent) / 100)
                            }
                        }
                    }
                }
                .frame(height: 14)
                .background(ivyRaised, in: Capsule())
                VStack(spacing: 12) {
                    ForEach(segments, id: \.self) { seg in
                        HStack(spacing: 12) {
                            Circle().fill(seg.color).frame(width: 9, height: 9)
                            Text(seg.label).font(.subheadline)
                            Spacer()
                            Text(seg.value).font(.subheadline.weight(.semibold)).monospacedDigit().foregroundStyle(.secondary)
                            Text("\(seg.percent)%").font(.caption.bold()).monospacedDigit().foregroundStyle(seg.color)
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(seg.color.opacity(0.16), in: Capsule())
                        }
                    }
                }
            }
        }
    }
}

/// Mochi teammate/entity row: colored initial avatar + name + right count.
struct EntityRow: View {
    let name: String
    let value: String
    let color: Color
    var subtitle: String = ""
    var action: (() -> Void)? = nil

    var body: some View {
        Button { action?() } label: {
            HStack(spacing: 14) {
                Circle().fill(color.opacity(0.9)).frame(width: 42, height: 42)
                    .overlay(Text(name.prefix(1)).font(.headline).foregroundStyle(.white))
                VStack(alignment: .leading, spacing: 3) {
                    Text(name).font(.subheadline.weight(.semibold)).lineLimit(1)
                    if !subtitle.isEmpty { Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                }
                Spacer()
                Text(value).font(.subheadline.bold()).monospacedDigit()
                if action != nil { Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary) }
            }
            .frame(minHeight: 58)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(action == nil)
    }
}