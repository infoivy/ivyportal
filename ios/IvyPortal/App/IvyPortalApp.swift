import SwiftUI

@main
struct IvyPortalApp: App {
    @State private var showSplash: Bool
    @State private var auth = AuthStore.shared
    /// UI-test/preview hook: `-bunTab` pins the fixture shell (no onboarding).
    private let forceShell = ProcessInfo.processInfo.arguments.contains("-bunTab")
    /// Sticky demo mode: once the demo workspace has been opened, plain
    /// launches keep landing on it (founder kept "getting logged out" when
    /// relaunching from the home screen). Cleared by `-signOut` and by
    /// "Leave demo workspace" in Settings.
    @AppStorage("bunDemoWorkspace") private var demoWorkspace = false
    @AppStorage("bunAppearance") private var appearance = "dark"

    /// nil = follow the system (the "System" tile).
    private var scheme: ColorScheme? {
        switch appearance {
        case "light": .light
        case "system": nil
        default: .dark
        }
    }

    init() {
        let arguments = ProcessInfo.processInfo.arguments
        // Demo/testing hook: start the session signed out, fresh-user state.
        if arguments.contains("-signOut") {
            Task { await AuthStore.shared.signOut() }
            UserDefaults.standard.removeObject(forKey: "bunDemoWorkspace")
        }
        if arguments.contains("-bunTab") {
            UserDefaults.standard.set(true, forKey: "bunDemoWorkspace")
        }
        // The onboarding flow opens on its own splash; the standalone splash
        // covers warm launches straight into the workspace.
        let straightToWorkspace = AuthStore.shared.isSignedIn
            || UserDefaults.standard.bool(forKey: "bunDemoWorkspace")
        _showSplash = State(initialValue: straightToWorkspace && !arguments.contains("-bunTab"))
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                rootContent
                    .environment(\.font, ivyFont(16))
                    .preferredColorScheme(scheme)

                if showSplash {
                    BunLaunchSplash()
                        .transition(.opacity)
                        .zIndex(1)
                        .task {
                            try? await Task.sleep(for: .milliseconds(1600))
                            withAnimation(.easeInOut(duration: 0.7)) { showSplash = false }
                        }
                }
            }
        }
    }

    /// Onboarding era (founder 2026-08-17): a signed-out launch opens on the
    /// welcome flow (splash, pitch, application); the workspace shell is for
    /// signed-in accounts, sticky demo mode, and `-bunTab` test launches.
    @ViewBuilder private var rootContent: some View {
        if forceShell || auth.isSignedIn || demoWorkspace {
            BunShell()
        } else {
            BunWelcomeFlow()
                .transition(.opacity)
        }
    }
}
