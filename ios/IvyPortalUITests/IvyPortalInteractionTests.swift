import XCTest

@MainActor
final class IvyPortalInteractionTests: XCTestCase {
    private func launch(destination: String = "home", picture: String = "sales") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-demoDestination", destination, "-demoScenario", "loaded", "-homePicture", picture]
        app.launch()
        return app
    }

    func testHomeShowsYourItemsBannerAndActivity() {
        let app = launch()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS 'Your items'")).firstMatch.waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Latest Activity"].exists)
    }

    func testYourItemsBannerRoutesToWork() {
        let app = launch()
        let banner = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Your items'")).firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 3))
        banner.tap()
        XCTAssertTrue(app.staticTexts["Work"].waitForExistence(timeout: 3))
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

    func testPerformanceShowsTeamWeekOpsStrip() {
        let app = launch(destination: "performance")
        XCTAssertTrue(app.staticTexts["Team week"].waitForExistence(timeout: 4))
        XCTAssertTrue(app.staticTexts["Filed today"].exists)
        XCTAssertTrue(app.staticTexts["Missed yest"].exists)
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
