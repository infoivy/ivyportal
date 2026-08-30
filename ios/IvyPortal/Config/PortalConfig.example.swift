import Foundation

// Copy to PortalConfig.swift (gitignored) and fill in your project values.
// Only the publishable (anon) key goes here. Never the service-role key.
enum PortalConfig {
    static let supabaseURL = URL(string: "https://YOUR_PROJECT.supabase.co")!
    static let supabaseAnonKey = "sb_publishable_YOUR_KEY"
}
