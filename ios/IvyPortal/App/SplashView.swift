import SwiftUI

/// Bun startup splash, modeled frame-by-frame on Mochi's launch (235 frames):
/// 1. Spring in with elastic squash-and-stretch (overshoot → wobble)
/// 2. Landing squash
/// 3. Idle breathing bob + a blink
/// 4. Steam wisps rise off the bun
/// 5. Zoom out and shrink to reveal the app
/// Reduce Motion collapses it to a quick fade.
struct SplashView: View {
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var t = Phase.enter

    enum Phase { case enter, land, idle, steam, exitPhase }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            TimelineView(.animation) { context in
                let p = progress(context.date)
                ZStack {
                    BunMark(phase: t, p: p)
                    steamLayer(p)
                }
            }
        }
        .onAppear(perform: run)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Bun")
    }

    // MARK: - Timeline

    @State private var start = Date()

    /// Seconds since the animation started.
    private func progress(_ now: Date) -> Double { now.timeIntervalSince(start) }

    private func run() {
        if reduceMotion {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: onFinish)
            return
        }
        start = Date()
        // phase transitions drive the steam + exit, the TimelineView drives motion
        sequence([
            (0.55, .land),
            (0.75, .idle),
            (1.35, .steam),
            (2.35, .exitPhase),
        ])
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.9, execute: onFinish)
    }

    private func sequence(_ steps: [(Double, Phase)]) {
        for (delay, phase) in steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { t = phase }
        }
    }

    private func steamLayer(_ p: Double) -> some View {
        ZStack {
            ForEach(0..<3) { i in
                SteamWisp(active: t == .steam || t == .exitPhase, delay: Double(i) * 0.22, x: CGFloat(i - 1) * 34)
            }
        }
        .offset(y: -96)
    }
}

// MARK: - The bun mark with squash & stretch

private struct BunMark: View {
    let phase: SplashView.Phase
    let p: Double   // seconds

    var body: some View {
        let m = motion(p)
        Image("BunLogo")
            .resizable().scaledToFit()
            .frame(width: 210, height: 210)
            .scaleEffect(x: m.sx, y: m.sy)
            .offset(y: m.dy)
            .opacity(m.opacity)
    }

    /// Piecewise motion curve. All shapes are squashes/stretches of the logo.
    private func motion(_ p: Double) -> (sx: CGFloat, sy: CGFloat, dy: CGFloat, opacity: Double) {
        switch phase {
        case .enter:
            // elastic scale-up 0 → 1.08 with squash-stretch wobble (0 → 0.55s)
            let k = min(p / 0.55, 1)
            let e = elasticOut(k)
            let base = 0.3 + 0.78 * e
            // squash-stretch pulse: as it overshoots, x and y oppose
            let wob = sin(k * .pi * 3) * (1 - k) * 0.12
            return (base * (1 + wob), base * (1 - wob), 0, Double(min(k * 3, 1)))
        case .land:
            // landing squash: flatten then recover (0.55 → 0.75s)
            let k = min(max((p - 0.55) / 0.2, 0), 1)
            let squash = sin(k * .pi) * 0.14
            return (1.0 + squash, 1.0 - squash, CGFloat(squash * 8), 1)
        case .idle:
            // breathing bob + a blink around p≈1.0 (0.75 → 1.35s)
            let breathe = sin((p - 0.75) * .pi * 2 * 1.4) * 0.02
            let blinkPhase = (p - 0.95) / 0.18
            let blink = (blinkPhase >= 0 && blinkPhase <= 1) ? sin(blinkPhase * .pi) * 0.16 : 0
            return (1.0 + breathe, 1.0 - breathe - blink, CGFloat(breathe * -10), 1)
        case .steam:
            // settle to neutral while steam rises (1.35 → 2.35s)
            let breathe = sin((p - 1.35) * .pi * 2) * 0.015
            return (1.0 + breathe, 1.0 - breathe, 0, 1)
        case .exitPhase:
            // zoom out + shrink to nothing (2.35 → 2.9s)
            let k = min(max((p - 2.35) / 0.55, 0), 1)
            let e = easeInBack(k)
            let s = 1.0 - 0.9 * e
            return (s, s, CGFloat(-20 * e), Double(1 - e * e))
        }
    }

    private func elasticOut(_ x: Double) -> Double {
        guard x > 0, x < 1 else { return x }
        let c4 = (2 * Double.pi) / 3
        return pow(2, -10 * x) * sin((x * 10 - 0.75) * c4) + 1
    }
    private func easeInBack(_ x: Double) -> Double {
        let c1 = 1.70158, c3 = c1 + 1
        return c3 * x * x * x - c1 * x * x
    }
}

// MARK: - Steam

/// A bold, clearly visible steam curl that loops while `active` — driven by a
/// plain SwiftUI animation (reliable in the simulator), not a nested timeline.
private struct SteamWisp: View {
    let active: Bool
    let delay: Double
    let x: CGFloat
    @State private var rise = false

    var body: some View {
        ZStack {
            Capsule().fill(.white).frame(width: 12, height: 32).blur(radius: 1.5)
                .rotationEffect(.degrees(rise ? 16 : -16))
            Circle().fill(.white.opacity(0.5)).frame(width: 36, height: 36).blur(radius: 10)
        }
        .scaleEffect(rise ? 1.5 : 0.5)
        .offset(x: x, y: rise ? -110 : 20)
        .opacity(active ? (rise ? 0.15 : 0.95) : 0)
        .animation(nil, value: rise)   // position/scale animate, opacity snaps at cycle ends
        .onChange(of: active) { on in
            guard on else { rise = false; return }
            withAnimation(.easeInOut(duration: 1.2).delay(delay).repeatForever(autoreverses: true)) {
                rise.toggle()
            }
        }
    }
}

#if DEBUG
#Preview { SplashView(onFinish: {}) }
#endif
