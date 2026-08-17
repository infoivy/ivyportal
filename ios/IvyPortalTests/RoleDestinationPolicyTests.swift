import XCTest
#if canImport(IvyPortal)
@testable import IvyPortal
#else
@testable import IvyPortalCore
#endif

final class RoleDestinationPolicyTests: XCTestCase {
    func testLeadershipReceivesPerformance() {
        XCTAssertTrue(RoleDestinationPolicy.destinations(for: [.founder]).contains(.performance))
        XCTAssertTrue(RoleDestinationPolicy.destinations(for: [.admin]).contains(.performance))
        XCTAssertTrue(RoleDestinationPolicy.destinations(for: [.cofounder]).contains(.performance))
    }

    func testSetterDoesNotReceiveTeamPerformance() {
        XCTAssertFalse(RoleDestinationPolicy.destinations(for: [.setter]).contains(.performance))
    }

    func testUnauthorizedMoreEntriesAreOmitted() {
        let entries = RoleDestinationPolicy.moreEntries(for: [.setter])
        XCTAssertFalse(entries.contains(.team))
        XCTAssertFalse(entries.contains(.admin))
        XCTAssertTrue(entries.contains(.contentHub)) // staff template library
        XCTAssertTrue(entries.contains(.profile))
        XCTAssertTrue(entries.contains(.tags))
        XCTAssertTrue(entries.contains(.app))
    }

    func testFounderOnlySettingsStayFounderOnly() {
        // Socials stays a founder surface; admin does not unlock it.
        let adminEntries = RoleDestinationPolicy.moreEntries(for: [.admin])
        XCTAssertFalse(adminEntries.contains(.socials))
        XCTAssertTrue(adminEntries.contains(.team))
        let founderEntries = RoleDestinationPolicy.moreEntries(for: [.founder])
        XCTAssertTrue(founderEntries.contains(.socials))
    }

    func testMultipleRolesUnionCapabilitiesWithoutDuplicateDestinations() {
        // Mercury IA (2026-08-17): Settings is a sidebar row, never a tab;
        // Money joins the bar for money roles.
        let destinations = RoleDestinationPolicy.destinations(for: [.setter, .founder, .founder])
        XCTAssertEqual(destinations, [.home, .performance, .work, .customers, .money])
        XCTAssertEqual(Set(destinations).count, destinations.count)
    }

    func testMoneyTabOnlyForMoneyRoles() {
        // Mirrors the web /revenue + /payouts gates' union — never looser.
        XCTAssertTrue(RoleDestinationPolicy.destinations(for: [.closer]).contains(.money))
        XCTAssertTrue(RoleDestinationPolicy.destinations(for: [.cofounder]).contains(.money))
        XCTAssertFalse(RoleDestinationPolicy.destinations(for: [.setter]).contains(.money))
        XCTAssertFalse(RoleDestinationPolicy.destinations(for: [.csm]).contains(.money))
        XCTAssertFalse(RoleDestinationPolicy.destinations(for: [.coach]).contains(.money))
    }

    func testSettingsNeverInTheTabBar() {
        for roles: [PortalRole] in [[.founder], [.admin], [.setter], [.csm], [.closer]] {
            XCTAssertFalse(RoleDestinationPolicy.destinations(for: roles).contains(.more))
        }
    }

    // MARK: One home per person (founder-directed 2026-08-15)

    func testEachLeaderGetsExactlyOneHome() {
        // Abu Bilal: sales view role IS the homepage.
        XCTAssertEqual(HomePicturePolicy.pictures(for: [.founder, .admin, .cofounder], views: [.sales]), [.sales])
        // Faizan: fulfillment view role IS the homepage.
        XCTAssertEqual(HomePicturePolicy.pictures(for: [.founder, .admin, .cofounder], views: [.fulfillment]), [.fulfillment])
        // The founder holds neither view: the general Overview.
        XCTAssertEqual(HomePicturePolicy.pictures(for: [.founder, .admin], views: []), [.leadership])
        // Non-leaders always land on Personal.
        XCTAssertEqual(HomePicturePolicy.pictures(for: [.setter], views: []), [.personal])
        // Both views resolve deterministically to Sales — still one page.
        XCTAssertEqual(HomePicturePolicy.pictures(for: [.admin], views: [.sales, .fulfillment]), [.sales])
    }

    // MARK: role_access (web nav-pages parity)

    private let hideAllMoney = [
        RoleAccessRow(role: "setter", hiddenPages: [], grantedPages: [], hideMoney: true),
        RoleAccessRow(role: "closer", hiddenPages: [], grantedPages: [], hideMoney: true),
    ]

    func testMoneyHiddenOnlyWhenEveryConfigurableRoleHidesIt() {
        XCTAssertTrue(RoleAccessPolicy.moneyHidden(roles: [.setter], access: hideAllMoney))
        XCTAssertTrue(RoleAccessPolicy.moneyHidden(roles: [.setter, .closer], access: hideAllMoney))
        // One held role NOT hiding money keeps the figures visible.
        let mixed = [RoleAccessRow(role: "setter", hiddenPages: [], grantedPages: [], hideMoney: true)]
        XCTAssertFalse(RoleAccessPolicy.moneyHidden(roles: [.setter, .closer], access: mixed))
        // Admin and founder are never restricted.
        XCTAssertFalse(RoleAccessPolicy.moneyHidden(roles: [.setter, .admin], access: hideAllMoney))
        // No configurable role held → defaults.
        XCTAssertFalse(RoleAccessPolicy.moneyHidden(roles: [.cofounder], access: hideAllMoney))
    }

    func testHiddenPageNeedsEveryHeldRoleToHideIt() {
        let access = [
            RoleAccessRow(role: "setter", hiddenPages: ["/knowledge"], grantedPages: [], hideMoney: false),
            RoleAccessRow(role: "csm", hiddenPages: [], grantedPages: [], hideMoney: false),
        ]
        XCTAssertTrue(RoleAccessPolicy.pageHidden("/knowledge", roles: [.setter], access: access))
        // Extra roles only ever ADD access.
        XCTAssertFalse(RoleAccessPolicy.pageHidden("/knowledge", roles: [.setter, .csm], access: access))
        XCTAssertFalse(RoleAccessPolicy.pageHidden("/knowledge", roles: [.setter, .admin], access: access))
        let tabs = RoleAccessPolicy.visibleWorkTabs(roles: [.setter], access: access)
        XCTAssertFalse(tabs.contains(.knowledge))
        XCTAssertTrue(tabs.contains(.myEOD))
    }

    func testGrantsCannotCrossHardGates() {
        // A setter granted /payouts still never sees it (admin|cofounder wall).
        let access = [RoleAccessRow(role: "setter", hiddenPages: [], grantedPages: ["/payouts", "/calls"], hideMoney: false)]
        XCTAssertTrue(RoleAccessPolicy.pageHidden("/payouts", roles: [.setter], access: access))
        // /calls has no setter default but the gate blocks setters too.
        XCTAssertTrue(RoleAccessPolicy.pageHidden("/calls", roles: [.setter], access: access))
        // A coach granted /revenue passes (coach is inside that gate).
        let coachGrant = [RoleAccessRow(role: "coach", hiddenPages: [], grantedPages: ["/revenue"], hideMoney: false)]
        XCTAssertFalse(RoleAccessPolicy.pageHidden("/revenue", roles: [.coach], access: coachGrant))
    }
}
