import SwiftUI

@main
struct IvyPortalApp: App {
    @State private var showSplash = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                PortalShell()
                    .preferredColorScheme(.dark)
                if showSplash {
                    SplashView { withAnimation(.easeOut(duration: 0.3)) { showSplash = false } }
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
        }
    }
}
