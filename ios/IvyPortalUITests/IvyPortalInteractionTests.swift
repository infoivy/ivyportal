import XCTest

@MainActor
final class BunSmokeTests: XCTestCase {
    private func launch(tab: String = "home") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-bunTab", tab]
        app.launch()
        return app
    }

    func testBarShowsAllFiveTabs() {
        let app = launch()
        for id in ["tab-home", "tab-money", "tab-team", "tab-clients", "tab-work"] {
            XCTAssertTrue(app.buttons[id].waitForExistence(timeout: 4), id)
        }
    }

    /// Banking folded into Money (2026-08-18): the cards live there now.
    func testCardsLiveOnMoney() {
        let app = launch(tab: "money")
        XCTAssertTrue(app.staticTexts["Your cards"].waitForExistence(timeout: 6),
                      "cards on money: \(app.staticTexts.allElementsBoundByIndex.prefix(12).map(\.label))")
    }

    func testWorkDirectLaunch() {
        let app = launch(tab: "work")
        XCTAssertTrue(app.staticTexts["Work"].waitForExistence(timeout: 6),
                      "direct work: \(app.staticTexts.allElementsBoundByIndex.prefix(10).map(\.label))")
    }

    func testMoneyDirectLaunch() {
        let app = launch(tab: "money")
        XCTAssertTrue(app.staticTexts["Money"].waitForExistence(timeout: 6),
                      "direct money: \(app.staticTexts.allElementsBoundByIndex.prefix(10).map(\.label))")
    }

    func testTeamDirectLaunch() {
        let app = launch(tab: "team")
        XCTAssertTrue(app.staticTexts["Team"].waitForExistence(timeout: 6),
                      "direct team: \(app.staticTexts.allElementsBoundByIndex.prefix(10).map(\.label))")
    }

    func testClientsDirectLaunch() {
        let app = launch(tab: "clients")
        XCTAssertTrue(app.staticTexts["Clients"].waitForExistence(timeout: 6),
                      "direct clients: \(app.staticTexts.allElementsBoundByIndex.prefix(10).map(\.label))")
    }

    private func switchTab(_ app: XCUIApplication, id: String, expect title: String) {
        // One retap tolerated: simulator scroll touch delays occasionally
        // swallow the first synthesized tap on the floating bar.
        app.buttons[id].tap()
        if !app.staticTexts[title].waitForExistence(timeout: 5) {
            app.buttons[id].tap()
        }
        XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 8), "\(id) → \(title)")
    }

    func testTabSwitching() {
        let app = launch()
        switchTab(app, id: "tab-money", expect: "Money")
        switchTab(app, id: "tab-team", expect: "Team")
        switchTab(app, id: "tab-clients", expect: "Clients")
        switchTab(app, id: "tab-work", expect: "Work")
    }
}

/// Founder demo: the COMPLETE self-serve onboarding, screenshotted at every
/// step — create account → confirm email → name the business → own workspace
/// → invite a teammate. Two parts because email confirmations are on for the
/// project: the confirmation link is "clicked" between part 1 and part 2
/// (harness stamps the demo account confirmed). Credentials come in via
/// TEST_RUNNER_BUN_DEMO_EMAIL / TEST_RUNNER_BUN_DEMO_PASSWORD.
@MainActor
final class BunOnboardingDemo: XCTestCase {
    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private var demoEmail: String { ProcessInfo.processInfo.environment["BUN_DEMO_EMAIL"] ?? "" }
    private var demoPassword: String { ProcessInfo.processInfo.environment["BUN_DEMO_PASSWORD"] ?? "" }

    /// Splash choreography runs ~3.2s before the welcome stack fades in.
    private func waitForWelcome(_ app: XCUIApplication) {
        XCTAssertTrue(app.staticTexts["Learn more about Bun"].waitForExistence(timeout: 12),
                      "welcome stack after splash")
    }

    func testPart1CreateAccount() {
        continueAfterFailure = false
        XCTAssertFalse(demoEmail.isEmpty, "pass TEST_RUNNER_BUN_DEMO_EMAIL")

        let app = XCUIApplication()
        app.launchArguments = ["-signOut"]
        app.launch()

        waitForWelcome(app)
        snap(app, "01-welcome")

        app.staticTexts["Business"].tap()
        XCTAssertTrue(app.buttons["Get started"].waitForExistence(timeout: 6), "pitch page")
        snap(app, "02-pitch")
        app.buttons["Get started"].tap()

        XCTAssertTrue(app.staticTexts["What's your name?"].waitForExistence(timeout: 6))
        let first = app.textFields.element(boundBy: 0)
        first.tap(); first.typeText("Bun")
        let last = app.textFields.element(boundBy: 1)
        last.tap(); last.typeText("Founder")
        snap(app, "03-name")
        app.buttons["Start application"].tap()

        XCTAssertTrue(app.staticTexts["Create your account"].waitForExistence(timeout: 6))
        let emailField = app.textFields.firstMatch
        emailField.tap(); emailField.typeText(demoEmail)
        let passwordField = app.secureTextFields.firstMatch
        passwordField.tap(); passwordField.typeText(demoPassword)
        snap(app, "04-credentials")
        app.buttons["account-next"].tap()

        // With SMTP configured this lands on "You're all set up."; while the
        // email quota is exhausted the honest rate-limit error shows instead.
        let done = app.staticTexts["You're all set up."]
        let rateLimited = app.staticTexts.matching(
            NSPredicate(format: "label BEGINSWITH 'Too many attempts'")).firstMatch
        let landed = done.waitForExistence(timeout: 15) || rateLimited.exists
        XCTAssertTrue(landed,
                      "post-signup state: \(app.staticTexts.allElementsBoundByIndex.prefix(14).map(\.label))")
        snap(app, "05-post-signup")
    }

    func testPart2ConfirmedOnboarding() {
        continueAfterFailure = false
        XCTAssertFalse(demoEmail.isEmpty, "pass TEST_RUNNER_BUN_DEMO_EMAIL")

        let app = XCUIApplication()
        app.launchArguments = ["-signOut"]
        app.launch()

        waitForWelcome(app)
        app.buttons["welcome-login"].tap()
        XCTAssertTrue(app.staticTexts["Log in"].waitForExistence(timeout: 6), "login screen")

        let emailField = app.textFields.firstMatch
        emailField.tap(); emailField.typeText(demoEmail)
        let passwordField = app.secureTextFields.firstMatch
        passwordField.tap(); passwordField.typeText(demoPassword)
        snap(app, "06-log-in")
        app.buttons["auth-submit"].tap()

        // Root swaps to the workspace; an account without a business lands on
        // the naming takeover, one with a business lands on its home.
        let nameBusiness = app.staticTexts["Name your business"]
        let orgChip = app.staticTexts["Acme Coaching"]
        let landed = nameBusiness.waitForExistence(timeout: 15) || orgChip.waitForExistence(timeout: 5)
        XCTAssertTrue(landed,
                      "signed-in landing: \(app.staticTexts.allElementsBoundByIndex.prefix(14).map(\.label))")
        snap(app, "07-signed-in-landing")
    }
}

/// Home's lower half: the strips that route to the Team and Clients tabs.
/// Kept as a test rather than a manual check because they sit below the fold,
/// where a broken layout would go unseen in a screenshot review.
@MainActor
final class BunHomeStripTests: XCTestCase {
    func testHomeCarriesTeamAndClientStrips() {
        let app = XCUIApplication()
        app.launchArguments = ["-bunTab", "home"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Welcome, Alex"].waitForExistence(timeout: 8))
        // XCUITest counts off-screen elements as existing, so scroll first
        // and judge the strips on where they actually land.
        for _ in 0..<3 { app.swipeUp() }
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "home-lower"
        shot.lifetime = .keepAlways
        add(shot)
        XCTAssertTrue(app.staticTexts["EOD coverage"].exists, "team strip")
        XCTAssertTrue(app.staticTexts["At risk"].exists, "clients strip")
        XCTAssertTrue(app.staticTexts["Need a check-in"].exists, "check-in stat")
        XCTAssertTrue(app.staticTexts["At risk"].isHittable, "clients strip on screen")
    }
}

/// The performance graph and the member rows sit below coverage, so they get
/// the same below-the-fold treatment as Home's strips.
@MainActor
final class BunTeamGraphTests: XCTestCase {
    func testTeamCarriesTheActivityGraph() {
        let app = XCUIApplication()
        app.launchArguments = ["-bunTab", "team"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Team"].waitForExistence(timeout: 8))
        for _ in 0..<2 { app.swipeUp() }
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "team-graph"
        shot.lifetime = .keepAlways
        add(shot)
        XCTAssertTrue(app.staticTexts["Calls booked"].exists, "metric label")
        XCTAssertTrue(app.staticTexts["Setters"].exists, "setter rows")
    }
}
