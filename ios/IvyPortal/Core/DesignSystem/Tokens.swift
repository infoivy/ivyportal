import SwiftUI
import UIKit

// Slim survivor of the pre-scorched-earth design system (2026-08-17):
// just the adaptive tokens the splash and login still reference, plus the
// money formatter Typography.swift uses. The Bun UI uses BunTheme.
private func adaptive(_ light: (Double, Double, Double), _ dark: (Double, Double, Double)) -> Color {
    Color(uiColor: UIColor { trait in
        let c = trait.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: c.0, green: c.1, blue: c.2, alpha: 1)
    })
}

let ivyPaper = adaptive((0.965, 0.968, 0.984), (0.102, 0.110, 0.158))
let ivySurface = adaptive((1, 1, 1), (0.055, 0.063, 0.090))
let ivyBorder = adaptive((0.898, 0.906, 0.937), (0.180, 0.192, 0.250))
let ivyInk = adaptive((0.106, 0.122, 0.208), (0.925, 0.930, 0.955))
let ivyAccent = adaptive((0.322, 0.40, 0.92), (0.43, 0.48, 0.95))
let ivyRed = adaptive((0.84, 0.27, 0.31), (0.96, 0.42, 0.45))
let ivyShadow = adaptive((0.106, 0.122, 0.208), (0, 0, 0))

/// Money pinned to en-US ("$1,478" — never "$1.478" on Saudi/Dutch locales).
func ivyMoney(_ value: Double, cents: Bool = false) -> String {
    value.formatted(.currency(code: "USD")
        .locale(Locale(identifier: "en_US"))
        .precision(.fractionLength(cents ? 2 : 0)))
}
