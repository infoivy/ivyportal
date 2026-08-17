import SwiftUI

// Shared Mercury-clone atoms, measured off the 42 reference screenshots.

/// Founder 2026-08-17: surfaces carry REAL Apple Liquid Glass where the OS
/// has it (the rim light travels as the device moves); older systems get the
/// tinted background with a static light-catching rim.
struct BunGlassSurface<S: InsettableShape>: ViewModifier {
    let shape: S
    let tint: Color
    /// Interactive glass reacts to touch (a slight swell). The tab bar keeps
    /// it off so tapping a tab never zooms the bar.
    var interactive = true
    private var rim: some ShapeStyle {
        LinearGradient(colors: [.white.opacity(0.32), .white.opacity(0.04)],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    func body(content: Content) -> some View {
        // The rim stays visible over the glass too (founder: "the border
        // still needs to be there, even when not catching light").
        if #available(iOS 26.0, *) {
            content
                .glassEffect(interactive ? .regular.tint(tint).interactive() : .regular.tint(tint),
                             in: shape)
                .overlay(shape.strokeBorder(rim, lineWidth: 1))
        } else {
            content
                .background(tint, in: shape)
                .overlay(shape.strokeBorder(rim, lineWidth: 1))
        }
    }
}

extension View {
    /// Tinted glass surface: liquid glass on iOS 26+, tinted fill + rim below.
    func bunGlassSurface(_ shape: some InsettableShape, tint: Color,
                         interactive: Bool = true) -> some View {
        modifier(BunGlassSurface(shape: shape, tint: tint, interactive: interactive))
    }
}

/// Big left page title ("Move money", "Transactions", "Cards").
struct BunTitle: View {
    let text: String
    var body: some View {
        Text(text).font(bunFont(34, .medium)).tracking(0.2)
            .foregroundStyle(BunTheme.ink)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Circular chip button (back ‹ / close ✕ / refresh) on sheet headers.
struct BunChipButton: View {
    let symbol: String
    var size: CGFloat = 46
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size * 0.38, weight: .regular))
                .foregroundStyle(BunTheme.ink)
                .frame(width: size, height: size)
                .background(Color.white.opacity(0.06), in: Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.07)))
        }
        .buttonStyle(BunPressStyle())
    }
}

/// Action chip row item: "✈ Send" solid indigo, or quiet "↔ Transfer".
struct BunActionChip: View {
    let symbol: String
    let label: String
    var filled = false
    var action: () -> Void = {}
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: symbol).font(.system(size: 15, weight: .regular))
                Text(label).font(bunFont(17, .medium))
            }
            .foregroundStyle(filled ? .white : BunTheme.indigoLight)
            .padding(.horizontal, 18).frame(height: 54)
            .background(filled ? BunTheme.indigo : BunTheme.field, in: Capsule())
        }
        .buttonStyle(BunPressStyle())
    }
}

/// Small pill chip ("+ Request", "＋ Make Another Deposit", filter chips).
struct BunPillChip: View {
    var symbol: String? = nil
    let label: String
    var tint: Color = BunTheme.indigoLight
    var fill: Color = BunTheme.field
    var action: () -> Void = {}
    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let symbol { Image(systemName: symbol).font(.system(size: 13, weight: .regular)) }
                Text(label).font(bunFont(16, .regular))
            }
            .foregroundStyle(tint)
            .padding(.horizontal, 16).frame(height: 44)
            .background(fill, in: Capsule())
        }
        .buttonStyle(BunPressStyle())
    }
}

/// Icon-circle list row ("Inbox / 0 items ›").
struct BunIconRow: View {
    let symbol: String
    let title: String
    var subtitle: String = ""
    var chevron = true
    var action: () -> Void = {}
    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: symbol)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(BunTheme.ink)
                    .frame(width: 44, height: 44)
                    .background(BunTheme.field, in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    if !subtitle.isEmpty {
                        Text(subtitle).font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                    }
                }
                Spacer()
                if chevron {
                    Image(systemName: "chevron.right").font(.system(size: 14, weight: .regular))
                        .foregroundStyle(BunTheme.secondary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(BunPressStyle())
    }
}

/// Search field ("🔍 Search").
struct BunSearchField: View {
    @Binding var text: String
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").font(.system(size: 16)).foregroundStyle(BunTheme.secondary)
            TextField("", text: $text, prompt: Text("Search").font(bunFont(19)).foregroundStyle(BunTheme.secondary))
                .font(bunFont(19)).foregroundStyle(BunTheme.ink)
        }
        .padding(.horizontal, 18).frame(height: 54)
        .background(BunTheme.raised, in: Capsule())
    }
}

/// Status tag ("Pending", "Failed", "Admin").
struct BunTag: View {
    let text: String
    var tint: Color = BunTheme.secondary
    var fill: Color = BunTheme.field
    var body: some View {
        Text(text).font(bunFont(14))
            .foregroundStyle(tint)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(fill, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

/// Push/Email style segmented pill.
struct BunSegment: View {
    let options: [String]
    @Binding var selection: Int
    var body: some View {
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { index in
                Button { withAnimation(.snappy(duration: 0.2)) { selection = index } } label: {
                    Text(options[index]).font(bunFont(18))
                        .foregroundStyle(selection == index ? BunTheme.ink : BunTheme.secondary)
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(selection == index ? BunTheme.fieldBright : .clear, in: Capsule())
                }
                .buttonStyle(BunPressStyle())
            }
        }
        .padding(3)
        .background(BunTheme.raised, in: Capsule())
    }
}

/// Full-width bottom CTA pill ("Next", "Review", "Share my Link").
struct BunCTA: View {
    let label: String
    var symbol: String? = nil
    var enabled = true
    var filled = false   // enabled forms glow indigo; idle forms are quiet
    var action: () -> Void = {}
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let symbol { Image(systemName: symbol).font(.system(size: 16, weight: .regular)) }
                Text(label).font(bunFont(19, .medium))
            }
            .foregroundStyle(filled ? .white : (enabled ? BunTheme.indigoLight : BunTheme.secondary))
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(filled ? AnyShapeStyle(BunTheme.indigo) : AnyShapeStyle(BunTheme.raised), in: Capsule())
            .overlay(Capsule().stroke(enabled && !filled ? BunTheme.indigoLight.opacity(0.35) : .clear))
        }
        .buttonStyle(BunPressStyle())
        .disabled(!enabled)
    }
}

/// Labeled form field, Mercury dark style.
struct BunField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var multiline = false
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label).font(bunFont(19)).foregroundStyle(BunTheme.ink)
            TextField("", text: $text,
                      prompt: Text(placeholder).font(bunFont(19)).foregroundStyle(BunTheme.tertiary),
                      axis: multiline ? .vertical : .horizontal)
                .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                .lineLimit(multiline ? 4...8 : 1...1)
                .padding(.horizontal, 18).padding(.vertical, multiline ? 16 : 0)
                .frame(minHeight: multiline ? 120 : 58, alignment: multiline ? .topLeading : .center)
                .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}

/// The medallion mark in a thin-line circle (account icon).
struct BunMedallion: View {
    var size: CGFloat = 44
    var body: some View {
        Image("BunLogo").resizable().renderingMode(.template).scaledToFit()
            .foregroundStyle(BunTheme.ink.opacity(0.9))
            .frame(width: size * 0.9, height: size * 0.9)
            .frame(width: size, height: size)
    }
}

/// Initial avatar circle (transactions, profile).
struct BunAvatar: View {
    let text: String
    var size: CGFloat = 44
    var fill: Color = Color(red: 0.23, green: 0.33, blue: 0.42)
    var body: some View {
        Circle().fill(fill).frame(width: size, height: size)
            .overlay(Text(text).font(bunFont(size * 0.36, .medium)).foregroundStyle(BunTheme.ink))
    }
}

struct BunPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.7 : 1)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}
