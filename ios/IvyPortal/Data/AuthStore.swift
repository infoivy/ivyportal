import Foundation
import Observation
import Supabase

@MainActor
@Observable
final class AuthStore {
    static let shared = AuthStore()

    let client = SupabaseClient(supabaseURL: PortalConfig.supabaseURL, supabaseKey: PortalConfig.supabaseAnonKey)
    private(set) var session: Session?
    private(set) var isWorking = false
    private(set) var errorMessage: String?

    var isSignedIn: Bool { session != nil }

    private init() {
        session = client.auth.currentSession
    }

    func signIn(email: String, password: String) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            session = try await client.auth.signIn(email: email, password: password)
        } catch {
            errorMessage = Self.message(for: error)
        }
    }

    func signOut() async {
        do {
            try await client.auth.signOut()
        } catch {
            errorMessage = Self.message(for: error)
        }
        session = nil
    }

    private static func message(for error: Error) -> String {
        let text = String(describing: error)
        if text.contains("400") || text.localizedCaseInsensitiveContains("invalid") || text.localizedCaseInsensitiveContains("password") {
            return "Incorrect email or password."
        }
        return "Could not reach the portal. Check your connection and try again."
    }
}
