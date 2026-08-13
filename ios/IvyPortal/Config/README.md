# Portal configuration

The app reads its Supabase URL and publishable (anon) key from `ios/IvyPortal/Config/PortalConfig.swift`, which is **gitignored** so the real key never reaches git.

To set it up locally, create that file with:

```swift
import Foundation

enum PortalConfig {
    static let supabaseURL = URL(string: "https://YOUR_PROJECT.supabase.co")!
    static let supabaseAnonKey = "sb_publishable_YOUR_KEY"
}
```

Only the publishable (anon) key goes here. Never the service-role key.
