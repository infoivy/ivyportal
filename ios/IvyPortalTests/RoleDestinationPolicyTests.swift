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
        XCTAssertFalse(entries.contains(.teamAdministration))
        XCTAssertFalse(entries.contains(.admin))
        XCTAssertFalse(entries.contains(.finance))
        XCTAssertTrue(entries.contains(.profile))
        XCTAssertTrue(entries.contains(.knowledge))
    }

    func testMultipleRolesUnionCapabilitiesWithoutDuplicateDestinations() {
        let destinations = RoleDestinationPolicy.destinations(for: [.setter, .founder, .founder])
        XCTAssertEqual(destinations, [.home, .work, .performance, .customers, .more])
        XCTAssertEqual(Set(destinations).count, destinations.count)
    }
}
