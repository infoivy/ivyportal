import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class OrgRolePolicyTests: XCTestCase {
    func testOwnerCarriesAdminAndFounderInsideTheOrg() {
        XCTAssertEqual(OrgRolePolicy.portalRoles(fromMembership: ["owner"]), [.admin, .founder])
    }

    func testCreateOrganizationGrantIsStableAndDeduped() {
        // create_organization stamps owner/admin/founder; owner already implies both.
        XCTAssertEqual(OrgRolePolicy.portalRoles(fromMembership: ["owner", "admin", "founder"]), [.admin, .founder])
    }

    func testStudentMembershipGrantsNoOperatingRole() {
        XCTAssertTrue(OrgRolePolicy.portalRoles(fromMembership: ["student"]).isEmpty)
        XCTAssertEqual(OrgRolePolicy.effectiveRoles(membership: ["student"], legacy: []), [])
    }

    func testMembershipWinsOverLegacyRoles() {
        // An Ivy setter who owns a second business is its founder while viewing it.
        XCTAssertEqual(OrgRolePolicy.effectiveRoles(membership: ["owner"], legacy: [.setter]), [.admin, .founder])
    }

    func testLegacyFallsBackWhenMembershipIsSilent() {
        XCTAssertEqual(OrgRolePolicy.effectiveRoles(membership: [], legacy: [.closer]), [.closer])
        XCTAssertEqual(OrgRolePolicy.effectiveRoles(membership: ["student"], legacy: [.closer]), [.closer])
    }

    func testUnknownTokensAreIgnoredAndCaseIsForgiven() {
        XCTAssertEqual(OrgRolePolicy.portalRoles(fromMembership: ["Setter", "billing_bot", "CSM"]), [.setter, .csm])
    }

    func testHomeViewsFollowTheMembershipWhenItSpeaks() {
        XCTAssertEqual(OrgRolePolicy.effectiveHomeViews(membership: ["closer", "sales"], legacy: [.fulfillment]), [.sales])
        XCTAssertEqual(OrgRolePolicy.effectiveHomeViews(membership: ["owner"], legacy: [.fulfillment]), [])
        XCTAssertEqual(OrgRolePolicy.effectiveHomeViews(membership: [], legacy: [.fulfillment]), [.fulfillment])
    }
}
