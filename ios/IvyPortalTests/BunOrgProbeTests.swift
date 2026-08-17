import Security
import XCTest
@testable import IvyPortal

/// Diagnostic probe for the onboarding demo: signs in as the demo account
/// in-process and verifies the client attaches the user JWT (an anon read
/// of org_members returns [] silently, so a non-empty result proves auth).
/// Runs only when TEST_RUNNER_BUN_DEMO_EMAIL is provided.
@MainActor
final class BunOrgProbeTests: XCTestCase {
    func testAuthedOrgRead() async throws {
        let env = ProcessInfo.processInfo.environment
        guard let email = env["BUN_DEMO_EMAIL"], let password = env["BUN_DEMO_PASSWORD"] else {
            throw XCTSkip("no demo credentials provided")
        }
        let auth = AuthStore.shared
        await auth.signOut()
        await auth.signIn(email: email, password: password)
        XCTAssertNil(auth.errorMessage, "sign-in failed: \(auth.errorMessage ?? "")")
        XCTAssertTrue(auth.isSignedIn)
        print("PROBE stored session user:", auth.session?.user.email ?? "nil")
        print("PROBE currentSession:", auth.client.auth.currentSession?.user.email ?? "nil")
        do {
            let s = try await auth.client.auth.session
            print("PROBE async session:", s.user.email ?? "?", "expires:", s.expiresAt)
        } catch {
            print("PROBE async session THREW:", error)
        }
        // Raw keychain sanity check in this process
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "bun.probe",
            kSecAttrAccount as String: "probe",
            kSecValueData as String: Data("x".utf8),
        ]
        SecItemDelete(addQuery as CFDictionary)
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        var readResult: CFTypeRef?
        var readQuery = addQuery; readQuery.removeValue(forKey: kSecValueData as String)
        readQuery[kSecReturnData as String] = true
        let readStatus = SecItemCopyMatching(readQuery as CFDictionary, &readResult)
        print("PROBE keychain add:", addStatus, "read:", readStatus)

        let orgs = try await PortalAPI.shared.myOrgs()
        XCTAssertFalse(orgs.isEmpty, "authed org_members read returned [] · JWT not attached?")
        print("PROBE orgs:", orgs.map(\.name))
    }
}
