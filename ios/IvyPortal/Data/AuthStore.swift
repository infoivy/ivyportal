import AuthenticationServices
import Foundation
import Observation
import Supabase
import UIKit

#if targetEnvironment(simulator)
/// Simulator builds run unsigned (CODE_SIGNING_ALLOWED=NO), so keychain
/// access fails with errSecMissingEntitlement (-34018): the session never
/// persists and every request silently degrades to anon. UserDefaults is
/// the session store on simulator only; devices keep the keychain.
private struct SimulatorSessionStorage: AuthLocalStorage {
    func store(key: String, value: Data) throws { UserDefaults.standard.set(value, forKey: key) }
    func retrieve(key: String) throws -> Data? { UserDefaults.standard.data(forKey: key) }
    func remove(key: String) throws { UserDefaults.standard.removeObject(forKey: key) }
}
#endif

@MainActor
@Observable
final class AuthStore {
    static let shared = AuthStore()

    let client: SupabaseClient = {
        #if targetEnvironment(simulator)
        SupabaseClient(
            supabaseURL: PortalConfig.supabaseURL,
            supabaseKey: PortalConfig.supabaseAnonKey,
            options: SupabaseClientOptions(auth: .init(storage: SimulatorSessionStorage()))
        )
        #else
        SupabaseClient(supabaseURL: PortalConfig.supabaseURL, supabaseKey: PortalConfig.supabaseAnonKey)
        #endif
    }()
    private(set) var session: Session?
    private(set) var isWorking = false
    private(set) var errorMessage: String?
    /// Operating roles from user_roles (admin/founder/…); empty until loaded.
    private(set) var roles: [PortalRole] = []
    /// Grantable Home view roles (sales/fulfillment) from the same table.
    private(set) var homeViews: [HomeViewRole] = []
    /// Roles this account holds in the ACTIVE Bun workspace
    /// (`org_members.roles`, applied by BunStore). OrgRolePolicy folds them
    /// with the legacy `user_roles` into `roles` / `homeViews`.
    private(set) var membershipRoles: [String] = []
    private var legacyRoles: [PortalRole] = []
    private var legacyHomeViews: [HomeViewRole] = []
    /// Admin-managed page/money visibility (web role_access parity).
    private(set) var access: [RoleAccessRow] = []
    private(set) var rolesLoaded = false
    /// Set when signup succeeded but the account still needs its email
    /// confirmation link clicked before the first login.
    private(set) var pendingConfirmationEmail: String?

    /// Money figures hidden for this account (web `moneyHidden` rule).
    var moneyHidden: Bool { RoleAccessPolicy.moneyHidden(roles: roles, access: access) }

    var isSignedIn: Bool { session != nil }

    private init() {
        session = client.auth.currentSession
    }

    func signIn(email: String, password: String) async {
        isWorking = true
        errorMessage = nil
        pendingConfirmationEmail = nil
        defer { isWorking = false }
        do {
            session = try await client.auth.signIn(email: email, password: password)
            await loadRoles()
        } catch {
            errorMessage = Self.message(for: error)
        }
    }

    /// Bun self-serve: create an account; the signup trigger builds the
    /// profile (using full_name metadata when given), and the app then walks
    /// the user into their application.
    func signUp(email: String, password: String, fullName: String? = nil) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            var metadata: [String: AnyJSON] = [:]
            if let fullName, !fullName.isEmpty { metadata["full_name"] = .string(fullName) }
            let result = try await client.auth.signUp(email: email, password: password,
                                                      data: metadata.isEmpty ? nil : metadata)
            session = result.session ?? client.auth.currentSession
            if session == nil {
                // Email confirmations are on: the account exists but needs
                // its inbox link clicked before the first login.
                pendingConfirmationEmail = email
            } else {
                pendingConfirmationEmail = nil
                await loadRoles()
            }
        } catch {
            errorMessage = Self.message(for: error, signingUp: true)
        }
    }

    /// Surface a validation message through the same error line the API
    /// errors use.
    func setError(_ message: String) {
        errorMessage = message
    }

    /// Password reset email (works once the project has SMTP configured; the
    /// rate-limit error surfaces honestly until then).
    func sendPasswordReset(email: String) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await client.auth.resetPasswordForEmail(email)
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
        roles = []
        homeViews = []
        membershipRoles = []
        legacyRoles = []
        legacyHomeViews = []
        access = []
        rolesLoaded = false
    }

    /// The active workspace changed (or its membership loaded): re-derive the
    /// operating roles. Idempotent; safe before `loadRoles` has run.
    func applyMembershipRoles(_ raw: [String]) {
        membershipRoles = raw
        recomputeRoles()
    }

    private func recomputeRoles() {
        roles = OrgRolePolicy.effectiveRoles(membership: membershipRoles, legacy: legacyRoles)
        homeViews = OrgRolePolicy.effectiveHomeViews(membership: membershipRoles, legacy: legacyHomeViews)
    }

    /// Google OAuth through Supabase, same provider the web portal uses.
    /// Requires `ivyportal://auth-callback` in the Supabase Auth redirect
    /// allowlist (dashboard → Authentication → URL Configuration).
    func signInWithGoogle() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let redirect = URL(string: "ivyportal://auth-callback")!
            let authURL = try client.auth.getOAuthSignInURL(provider: .google, redirectTo: redirect)
            let callback = try await WebAuthenticator.authenticate(url: authURL, callbackScheme: "ivyportal")
            session = try await client.auth.session(from: callback)
            await loadRoles()
        } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
            // User closed the sheet; not an error.
        } catch {
            errorMessage = "Google sign-in failed. If this keeps happening, the redirect URL may not be enabled in Supabase."
        }
    }

    /// Loads user_roles for the signed-in account. Safe to call repeatedly.
    func loadRoles() async {
        guard isSignedIn else { return }
        do {
            let raw = try await PortalAPI.shared.myRoles()
            legacyRoles = raw.compactMap(PortalRole.init)
            legacyHomeViews = raw.compactMap(HomeViewRole.init)
            recomputeRoles()
            rolesLoaded = true
        } catch {
            // Keep whatever we had; the shell falls back to the safest tab set.
        }
        // Access defaults enrich visibility; a failed read keeps defaults.
        if let rows = try? await PortalAPI.shared.roleAccess() {
            access = rows
        }
    }

    private static func message(for error: Error, signingUp: Bool = false) -> String {
        let text = String(describing: error)
        if text.contains("email_address_invalid") {
            return "That email address does not look real. Use your work email."
        }
        if text.contains("over_email_send_rate_limit") || text.contains("over_request_rate_limit") {
            return "Too many attempts. Wait a bit and try again."
        }
        if text.contains("user_already_exists") || text.contains("email_exists") {
            return "An account with this email already exists. Log in instead."
        }
        if text.contains("weak_password") {
            return "Pick a stronger password: at least 6 characters."
        }
        if text.contains("email_not_confirmed") {
            return "Confirm your email first: check your inbox for the link."
        }
        if text.contains("400") || text.localizedCaseInsensitiveContains("invalid") || text.localizedCaseInsensitiveContains("password") {
            return signingUp ? "Could not create the account. Check the email and password."
                             : "Incorrect email or password."
        }
        return "Could not reach Bun. Check your connection and try again."
    }
}

/// Minimal ASWebAuthenticationSession wrapper for the Supabase OAuth flow.
@MainActor
private enum WebAuthenticator {
    // Apple requires a strong reference for the session's lifetime; without it
    // the completion may never fire and the continuation would leak.
    private static var activeSession: ASWebAuthenticationSession?

    static func authenticate(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            var startedSession: ASWebAuthenticationSession?
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
                Task { @MainActor in
                    // Only release our own reference — never a newer session's.
                    if activeSession === startedSession { activeSession = nil }
                }
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: error ?? URLError(.userCancelledAuthentication))
                }
            }
            session.presentationContextProvider = AnchorProvider.shared
            startedSession = session
            activeSession = session
            if !session.start() {
                activeSession = nil
                continuation.resume(throwing: URLError(.cannotConnectToHost))
            }
        }
    }

    private final class AnchorProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
        static let shared = AnchorProvider()
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }
    }
}
