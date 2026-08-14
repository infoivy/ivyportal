import SwiftUI

/// Bun startup splash (Mochi-style): the white line-art steamer logo springs in
/// on black with four sparkles, settles, then a small accent wink pops. ~1.6s,
/// Reduce Motion aware, then calls onFinish to reveal the app.
struct SplashView: View {
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false
    @State private var settled = false
    @State private var accent = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ZStack {
                // sparkles (fade in, drift, fade out)
                ForEach(0..<4) { i in
                    Image(systemName: "sparkle")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.9))
                        .offset(Self.sparkleOffset(i))
                        .scaleEffect(appeared && !settled ? 1 : 0.2)
                        .opacity(appeared ? (settled ? 0 : 0.9) : 0)
                }
                // the bun logo: fade + spring scale in, then a gentle settle bounce
                Image("BunLogo")
                    .resizable().scaledToFit()
                    .frame(width: 180, height: 180)
                    .scaleEffect(appeared ? (settled ? 1.0 : 1.06) : 0.3)
                    .opacity(appeared ? 1 : 0)
                // accent wink: a small dot pops on the lower-right after settle
                Circle()
                    .fill(.white)
                    .frame(width: 16, height: 16)
                    .overlay(Circle().stroke(Color.black, lineWidth: 2))
                    .offset(x: 56, y: 56)
                    .scaleEffect(accent ? 1 : 0)
                    .opacity(accent ? 1 : 0)
            }
        }
        .onAppear(perform: run)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Bun")
    }

    private func run() {
        if reduceMotion {
            appeared = true; settled = true; accent = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: onFinish)
            return
        }
        withAnimation(.spring(duration: 0.5, bounce: 0.5)) { appeared = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
            withAnimation(.spring(duration: 0.35, bounce: 0.4)) { settled = true }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation(.spring(duration: 0.3, bounce: 0.6)) { accent = true }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6, execute: onFinish)
    }

    private static func sparkleOffset(_ i: Int) -> CGSize {
        switch i {
        case 0: return CGSize(width: -90, height: -80)
        case 1: return CGSize(width: 90, height: -76)
        case 2: return CGSize(width: -84, height: 84)
        default: return CGSize(width: 88, height: 80)
        }
    }
}

#if DEBUG
#Preview { SplashView(onFinish: {}) }
#endif
