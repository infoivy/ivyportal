import XCTest

@MainActor
final class IvyPortalInteractionTests: XCTestCase {
    private func launch(destination: String = "home", picture: String = "sales") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-demoDestination", destination, "-demoScenario", "loaded", "-homePicture", picture]
        app.launch()
        return app
    }

    func testHomeShowsRolePicturePicker() {
        let app = launch()
        XCTAssertTrue(app.buttons["Sales"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Fulfillment"].exists)
        XCTAssertTrue(app.buttons["Leadership"].exists)
        XCTAssertTrue(app.buttons["Personal"].exists)
    }

    func testSalesPictureTilesRouteIntoWork() {
        let app = launch(picture: "sales")
        let sets = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Sets this week'")).firstMatch
        XCTAssertTrue(sets.waitForExistence(timeout: 3))
        sets.tap()
        XCTAssertTrue(app.staticTexts["UPCOMING"].waitForExistence(timeout: 4))
    }

    func testFulfillmentAtRiskRoutesToCustomers() {
        let app = launch(picture: "fulfillment")
        let risk = app.buttons.matching(NSPredicate(format: "label CONTAINS 'At risk'")).firstMatch
        XCTAssertTrue(risk.waitForExistence(timeout: 3))
        risk.tap()
        XCTAssertTrue(app.staticTexts["Clients"].waitForExistence(timeout: 3))
    }

    func testUpcomingEventOpensDetailSheet() {
        let app = launch()
        let event = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Founder review'")).firstMatch
        XCTAssertTrue(event.waitForExistence(timeout: 3))
        event.tap()
        XCTAssertTrue(app.staticTexts["Today · 5:00 PM to 5:45 PM"].waitForExistence(timeout: 3))
    }

    func testHomeOverdueOpensWorkActionItems() {
        let app = launch()
        let overdue = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Review overdue items'")).firstMatch
        XCTAssertTrue(overdue.waitForExistence(timeout: 3))
        overdue.tap()
        XCTAssertTrue(app.staticTexts["Work"].waitForExistence(timeout: 3))
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
