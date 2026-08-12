import SwiftUI

@main
struct IvyPortalApp: App {
    var body: some Scene {
        WindowGroup {
            PortalShell()
                .preferredColorScheme(.dark)
        }
    }
}
