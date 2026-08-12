import XCTest

@MainActor
final class IvyPortalInteractionTests: XCTestCase {
    private func launch(destination: String = "home") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-demoDestination", destination, "-demoScenario", "loaded"]
        app.launch()
        return app
    }

    func testHomePriorityOpensWork() {
        let app = launch()
        let overdue = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Review overdue items'")).firstMatch
        XCTAssertTrue(overdue.waitForExistence(timeout: 3))
        overdue.tap()
        XCTAssertTrue(app.staticTexts["Work"].waitForExistence(timeout: 3))
    }

    func testHomeMetricOpensPulse() {
        let app = launch()
        let calls = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Calls booked'")).firstMatch
        XCTAssertTrue(calls.waitForExistence(timeout: 3))
        calls.tap()
        XCTAssertTrue(app.staticTexts["Pulse"].waitForExistence(timeout: 3))
    }

    func testUpcomingEventOpensDetailSheet() {
        let app = launch()
        let event = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Founder review'")).firstMatch
        XCTAssertTrue(event.waitForExistence(timeout: 3))
        event.tap()
        XCTAssertTrue(app.staticTexts["Today · 5:00 PM to 5:45 PM"].waitForExistence(timeout: 3))
    }

    func testWorkRowOpensDetailSheet() {
        let app = launch(destination: "work")
        let crm = app.buttons.matching(NSPredicate(format: "label CONTAINS 'CRM'")).firstMatch
        XCTAssertTrue(crm.waitForExistence(timeout: 3))
        crm.tap()
        XCTAssertTrue(app.staticTexts["Open lead queues and verified follow-up work."].waitForExistence(timeout: 3))
    }

    func testPaymentsLaunchShowsOverviewAndTabs() {
        let app = launch(destination: "payments")
        XCTAssertTrue(app.staticTexts["Gross volume"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Clients"].exists)
        XCTAssertTrue(app.buttons["Costs"].exists)
    }

    func testPerformanceMetricOpensDrilldown() {
        let app = launch(destination: "performance")
        let replies = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Total replies received'")).firstMatch
        XCTAssertTrue(replies.waitForExistence(timeout: 3))
        replies.tap()
        XCTAssertTrue(app.staticTexts["DAILY BREAKDOWN"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["BY TEAMMATE"].exists)
    }
}
