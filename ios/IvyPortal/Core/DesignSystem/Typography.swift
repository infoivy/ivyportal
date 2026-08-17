import SwiftUI

// Mercury typography (founder 2026-08-17): Apercu Pro everywhere. Weights
// stay THIN — former bold/semibold styles resolve to Medium; Bold is reserved
// for rare emphasis. Numbers ride the same family with tight tracking.

enum IvyWeight {
    case light, regular, medium, bold

    var postScriptName: String {
        switch self {
        case .light: "ApercuPro-Light"
        case .regular: "ApercuPro-Regular"
        case .medium: "ApercuPro-Medium"
        case .bold: "ApercuPro-Bold"
        }
    }
}

/// The one way to make a font in this app.
func ivyFont(_ size: CGFloat, _ weight: IvyWeight = .regular) -> Font {
    .custom(weight.postScriptName, size: size)
}

// MARK: - Mercury type scale
//
// Measured off the founder's 42 reference screenshots (2026-08-18) rather than
// guessed. Method: screenshots are @3x, Apercu's cap height is 0.70em, so
// pt = capPx / (0.70 * 3). Weight comes from the stem width of an `l`/`i`
// against Apercu's per-face stem/cap ratios (Light .091, Regular .119,
// Medium .150, Bold .176), allowing the ~1px bloom iOS adds to white-on-dark
// text. Calibration reproduces this app's own known sizes to the pixel.
//
//   page/sheet title  30pt Medium   "Transactions", "Settings", "Security"
//   headline          20pt Medium   "Welcome, Ali"
//   section header    20pt Medium   "Payments", "Your cards", "December 2025"
//   hero money        30pt Regular  the balance
//   value             19pt          money under a label
//   row title         18pt Regular  "Parallel Web Systems", "Two-Factor …"
//   chip              16pt          "30D", segment labels
//   label / caption   15pt Regular  "Money in", "••1509 · Physical Debit"
//
// The old scale ran 2-6pt larger everywhere and set headings Regular, which is
// what made the app read bigger and blunter than the reference.
enum BunType {
    static let pageTitle = ivyFont(30, .medium)
    static let headline = ivyFont(20, .medium)
    static let section = ivyFont(20, .medium)
    static let rowTitle = ivyFont(18)
    static let chip = ivyFont(16)
    static let label = ivyFont(15)
    static let caption = ivyFont(15)

    /// Money sizes are passed to `BunMoney`, which needs the number not a Font.
    enum Money {
        static let hero: CGFloat = 30
        static let value: CGFloat = 19
        static let row: CGFloat = 18
        static let chip: CGFloat = 16
    }
}

/// Big Mercury numbers: Apercu at display sizes; callers add tracking.
func ivyNumber(_ size: CGFloat, _ weight: IvyWeight = .regular) -> Font {
    .custom(weight.postScriptName, size: size)
}

/// Mercury money: "$137,285·19" with the cents raised and smaller. `cents`
/// false renders whole dollars only (the app's usual truth-first style).
func ivyMoneyText(_ value: Double, size: CGFloat, weight: IvyWeight = .regular, showCents: Bool = false) -> Text {
    let whole = ivyMoney(value)
    guard showCents else {
        return Text(whole).font(ivyNumber(size, weight))
    }
    let centsValue = Int((abs(value) * 100).rounded()) % 100
    return Text(whole).font(ivyNumber(size, weight))
        + Text(".\(String(format: "%02d", centsValue))")
            .font(ivyNumber(size * 0.55, weight))
            .baselineOffset(size * 0.32)
            .foregroundStyle(.secondary)
}
