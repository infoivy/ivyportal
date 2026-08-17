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
