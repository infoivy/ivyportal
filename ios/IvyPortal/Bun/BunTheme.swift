import SwiftUI
import UIKit

// Bun theme: dark readings taken from the Mercury iOS references (2026-08-17,
// founder scorched-earth rebuild); light palette added 2026-08-17 for the
// Appearance toggle. Every token is trait-adaptive, so the whole workspace
// flips with `preferredColorScheme`.
enum BunTheme {
    private static func dyn(light: (Double, Double, Double), dark: (Double, Double, Double),
                            lightAlpha: Double = 1, darkAlpha: Double = 1) -> Color {
        Color(UIColor { trait in
            let rgb = trait.userInterfaceStyle == .light ? light : dark
            let alpha = trait.userInterfaceStyle == .light ? lightAlpha : darkAlpha
            return UIColor(red: rgb.0, green: rgb.1, blue: rgb.2, alpha: alpha)
        })
    }

    static let ground = dyn(light: (0.965, 0.965, 0.976), dark: (0.051, 0.055, 0.082))
    static let raised = dyn(light: (0.925, 0.928, 0.945), dark: (0.106, 0.118, 0.165))
    static let field = dyn(light: (0.885, 0.890, 0.915), dark: (0.149, 0.165, 0.220))
    static let fieldBright = dyn(light: (0.840, 0.847, 0.880), dark: (0.196, 0.212, 0.275))
    static let hairline = dyn(light: (0, 0, 0), dark: (1, 1, 1), lightAlpha: 0.09, darkAlpha: 0.08)
    static let ink = dyn(light: (0.090, 0.095, 0.135), dark: (0.930, 0.937, 0.965))
    static let secondary = dyn(light: (0.370, 0.385, 0.445), dark: (0.612, 0.631, 0.698))
    static let tertiary = dyn(light: (0.550, 0.560, 0.620), dark: (0.45, 0.465, 0.53))
    static let indigo = dyn(light: (0.360, 0.405, 0.900), dark: (0.396, 0.440, 0.922))
    static let indigoLight = dyn(light: (0.315, 0.365, 0.800), dark: (0.596, 0.647, 0.960))
    static let green = dyn(light: (0.115, 0.545, 0.360), dark: (0.306, 0.770, 0.550))
    static let pink = dyn(light: (0.790, 0.290, 0.395), dark: (0.910, 0.533, 0.607))
    static let chartLine = dyn(light: (0.380, 0.430, 0.870), dark: (0.486, 0.537, 0.949))
    static let barBg = dyn(light: (0.910, 0.913, 0.932), dark: (0.090, 0.098, 0.133))
    static let barActive = dyn(light: (0.830, 0.838, 0.875), dark: (0.165, 0.180, 0.240))
    /// Balance-chart stroke and fill anchors, read off the reference: a thin
    /// sky-blue line over a deep navy wash that fades out toward the floor.
    /// The alphas live in the tokens so the gradient stops stay literal.
    static let chartStroke = dyn(light: (0.235, 0.400, 0.780), dark: (0.510, 0.667, 0.925))
    static let chartFillTop = dyn(light: (0.400, 0.500, 0.870), dark: (0.135, 0.190, 0.360),
                                  lightAlpha: 0.26, darkAlpha: 0.95)
    static let chartFillBottom = dyn(light: (0.400, 0.500, 0.870), dark: (0.070, 0.090, 0.165),
                                     lightAlpha: 0.0, darkAlpha: 0.0)
}

/// Apercu shortcuts for the Bun rebuild (Mercury's own typeface).
func bunFont(_ size: CGFloat, _ weight: IvyWeight = .regular) -> Font {
    ivyFont(size, weight)
}

/// Mercury money: whole dollars large, cents superscript small.
/// "−$15.53" renders as −$15 with a raised .53.
struct BunMoney: View {
    let amount: Double
    var size: CGFloat = 17
    var weight: IvyWeight = .regular
    var color: Color = BunTheme.ink
    var showSign = false     // explicit − for outflows, nothing for inflows

    var body: some View {
        let negative = amount < 0
        let absolute = abs(amount)
        let whole = Int(absolute)
        let cents = Int((absolute * 100).rounded()) % 100
        (Text("\(negative ? "−" : (showSign ? "+" : ""))$\(whole.formatted(.number.grouping(.automatic).locale(Locale(identifier: "en_US"))))")
            .font(bunFont(size, weight))
         + Text(".\(String(format: "%02d", cents))")
            .font(bunFont(size * 0.62, weight))
            .baselineOffset(size * 0.30))
            .foregroundStyle(color)
            .monospacedDigit()
    }
}
