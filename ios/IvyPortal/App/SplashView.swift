import SwiftUI

/// Bun startup splash (Mochi-style): the full-color bao logo springs in on
/// black with sparkles, settles, gentle steam wisps rise off the bun, then the
/// whole mark zooms out as it fades to reveal the app. ~2.4s, Reduce Motion aware.
struct SplashView: View {
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false      // spring-in
    @State private var settled = false       // settle bounce
    @State private var steam = false         // steam wisps rise
    @State private var zoomOut = false       // zoom out + fade to app

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ZStack {
                // sparkles around the mark
                ForEach(0..<4) { i in
                    Image(systemName: "sparkle")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.9))
                        .offset(Self.sparkleOffset(i))
                        .scaleEffect(appeared && !steam ? 1 : 0.2)
                        .opacity(appeared ? (steam ? 0 : 0.9) : 0)
                }
                // the bun logo: spring in, settle, then zoom out
                Image("BunLogo")
                    .resizable().scaledToFit()
                    .frame(width: 200, height: 200)
                    .scaleEffect(scale)
                    .opacity(logoOpacity)
                // steam wisps rising off the bun
                steamWisps
            }
        }
        .onAppear(perform: run)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Bun")
    }

    private var scale: CGFloat {
        if zoomOut { return 0.6 }
        if !appeared { return 0.3 }
        return settled ? 1.0 : 1.08
    }

    private var logoOpacity: Double {
        if zoomOut { return 0 }
        return appeared ? 1 : 0
    }

    /// Three soft steam puffs that rise and dissolve above the bun.
    private var steamWisps: some View {
        ZStack {
            ForEach(0..<3) { i in
                SteamWisp(active: steam, delay: Double(i) * 0.16, x: CGFloat(i - 1) * 26)
            }
        }
        .offset(y: -78)
        .opacity(zoomOut ? 0 : 1)
    }

    private func run() {
        if reduceMotion {
            appeared = true; settled = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: finish)
            return
        }
        withAnimation(.spring(duration: 0.5, bounce: 0.5)) { appeared = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
            withAnimation(.spring(duration: 0.35, bounce: 0.4)) { settled = true }
        }
        // steam starts once settled
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.15) { steam = true }
        // zoom out + reveal
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.easeInOut(duration: 0.5)) { zoomOut = true }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: finish)
    }

    private func finish() { onFinish() }

    private static func sparkleOffset(_ i: Int) -> CGSize {
        switch i {
        case 0: return CGSize(width: -98, height: -88)
        case 1: return CGSize(width: 98, height: -84)
        case 2: return CGSize(width: -92, height: 92)
        default: return CGSize(width: 96, height: 88)
        }
    }
}

/// A single steam puff: rises, sways, expands, and fades in a loop while active.
private struct SteamWisp: View {
    let active: Bool
    let delay: Double
    let x: CGFloat
    @State private var rise = false

    var body: some View {
        Circle()
            .fill(.white.opacity(0.5))
            .frame(width: 16, height: 16)
            .blur(radius: 6)
            .scaleEffect(rise ? 1.8 : 0.5)
            .offset(x: x + (rise ? 6 : 0), y: rise ? -56 : 0)
            .opacity(rise ? 0 : 0.6)
            .onChange(of: active) { on in
                guard on else { return }
                withAnimation(.easeOut(duration: 0.9).delay(delay).repeatCount(2, autoreverses: false)) {
                    rise = true
                }
            }
    }
}

#if DEBUG
#Preview { SplashView(onFinish: {}) }
#endif
