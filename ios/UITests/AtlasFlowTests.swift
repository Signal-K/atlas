import XCTest

/// Simulator walk-through of the native flows (ASV-121 auth + Tonight, ASV-124 equipment + Sky).
/// Runs on fixtures, so no backend is needed. Screenshots are attached to the result bundle.
final class AtlasFlowTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        // The location prompt can appear over any screen on first launch.
        addUIInterruptionMonitor(withDescription: "system alerts") { alert in
            for label in ["Allow While Using App", "Allow", "OK"] where alert.buttons[label].exists {
                alert.buttons[label].tap(); return true
            }
            return false
        }
    }

    private func launch(_ args: [String]) {
        app.launchArguments = args
        app.launch()
    }

    /// Opens Settings and signs out (or goes to sign-in for a guest). The control sits in the sheet's account block.
    private func signOutViaSettings() {
        app.buttons["Settings"].tap()
        let row = app.buttons.containing(NSPredicate(format: "label CONTAINS 'Account and Sky Pass'")).firstMatch
        for _ in 0..<5 where !row.isHittable { app.swipeUp() }
        XCTAssertTrue(row.waitForExistence(timeout: 3), "Account row in Settings")
        row.tap()
        let signOut = app.buttons["Sign out"]
        let signIn = app.buttons["Sign in or create account"]
        for _ in 0..<4 where !(signOut.exists || signIn.exists) { app.swipeUp() }
        for _ in 0..<4 where !(signOut.exists || signIn.exists) { app.swipeDown() }
        XCTAssertTrue(signOut.waitForExistence(timeout: 3) || signIn.exists, "account block in Settings")
        shot("settings-account")
        (signOut.exists ? signOut : signIn).tap()
    }

    /// The Keychain survives between runs (a prior fixture sign-in leaves a token), so start from the welcome screen.
    private func launchAtWelcome(_ args: [String]) {
        launch(args)
        dismissPrompts()
        if app.buttons["Settings"].waitForExistence(timeout: 6) { signOutViaSettings() }
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways
        add(a)
    }

    private func dismissPrompts() {
        app.tap() // lets the interruption monitor fire
        sleep(1)
    }

    private func fillCredentials(email: String, password: String) {
        let e = app.textFields["Email"]
        XCTAssertTrue(e.waitForExistence(timeout: 10), "welcome email field")
        e.tap(); e.typeText(email)
        let p = app.secureTextFields["Password"]
        p.tap(); p.typeText(password)
    }

    func testSignInFailureStaysOnWelcome() {
        launchAtWelcome(["-AtlasFixtureAuth", "-AtlasEquipment", "phone"])
        fillCredentials(email: "a@b.co", password: "wrong")
        app.keyboards.buttons["Go"].tap()
        sleep(2)
        shot("signin-failure")
        XCTAssertTrue(app.buttons.matching(identifier: "Sign in").count > 0, "still on the welcome panel after a failed sign in")
        XCTAssertFalse(app.staticTexts["Tonight"].exists)
    }

    func testCreateAccountReachesTonightThenSignOut() {
        launchAtWelcome(["-AtlasFixtureAuth", "-AtlasFixtures", "-AtlasEquipment", "phone"])
        app.buttons.matching(identifier: "Create account").element(boundBy: 0).tap()
        fillCredentials(email: "new@atlas.test", password: "longenough1")
        app.keyboards.buttons["Go"].tap()
        dismissPrompts()
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 15), "Tonight after register")
        shot("tonight-after-register")
        signOutViaSettings()
        XCTAssertTrue(app.buttons["Just look at the sky"].waitForExistence(timeout: 10), "back at welcome")
        shot("after-sign-out")
    }

    func testGuestReachesTonight() {
        launchAtWelcome(["-AtlasFixtureAuth", "-AtlasFixtures", "-AtlasEquipment", "phone"])
        let guest = app.buttons["Just look at the sky"]
        XCTAssertTrue(guest.waitForExistence(timeout: 10))
        guest.tap()
        dismissPrompts()
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 15), "Tonight as guest")
        shot("tonight-guest")
    }

    func testEmptyAndErrorStatesRender() {
        for (flag, name) in [("-AtlasFixtureEmpty", "tonight-empty"), ("-AtlasFixtureError", "tonight-error")] {
            app.terminate()
            launch([flag, "-AtlasFixtureSignedIn", "-AtlasEquipment", "phone"])
            dismissPrompts()
            XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 15), name)
            sleep(2)
            shot(name)
        }
    }

    func testEquipmentOnboardingThenSkyPage() {
        launch(["-AtlasFixtures", "-AtlasFixtureSignedIn", "-AtlasResetOnboarding"])
        dismissPrompts()
        let telescope = app.staticTexts["Telescope"]
        XCTAssertTrue(telescope.waitForExistence(timeout: 10), "first run asks for equipment")
        shot("equipment-onboarding")
        telescope.tap()
        app.buttons["Continue"].tap()
        dismissPrompts()
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 15))
        shot("tonight-telescope")
    }

    func testSkyPageOpensForEquipment() {
        launch(["-AtlasFixtures", "-AtlasFixtureSignedIn", "-AtlasEquipment", "telescope", "-AtlasOpenSky"])
        dismissPrompts()
        XCTAssertTrue(app.buttons["Map"].waitForExistence(timeout: 15), "Sky page toggles Point/Map")
        shot("sky-point")
        app.buttons["Map"].tap()
        sleep(1)
        shot("sky-map")
    }

    func testSkyPassSheetShowsTiersWithoutPolar() {
        launch(["-AtlasFixtureSignedIn", "-AtlasFixtureStore", "-AtlasOpenSkyPass", "-AtlasEquipment", "phone"])
        dismissPrompts()
        XCTAssertTrue(app.staticTexts["Sky Pass"].waitForExistence(timeout: 15))
        shot("skypass")
        XCTAssertFalse(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'polar'")).element.exists)
    }
}
