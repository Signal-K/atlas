import Foundation
import XCTest
@testable import AtlasCore

final class SkyGuideTests: XCTestCase {
    private let perth = (lat: -31.95, lon: 115.86)
    private var zone: TimeZone { TimeZone(identifier: "Australia/Perth")! }
    private func date(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    // MARK: Equipment & visibility

    func testLimitingMagnitudeGrowsWithEquipment() {
        XCTAssertLessThan(Equipment.phone.limitingMagnitude, Equipment.binoculars.limitingMagnitude)
        XCTAssertLessThan(Equipment.binoculars.limitingMagnitude, Equipment.telescope.limitingMagnitude)
        XCTAssertEqual(Equipment.stored("binoculars"), .binoculars)
        XCTAssertNil(Equipment.stored("bogus"))
        XCTAssertNil(Equipment.stored(nil))
    }

    func testBetterEquipmentNeverShowsFewerObjects() {
        let when = date("2026-10-04T14:00:00Z") // 10pm Perth
        let phone = SkyVisibility.visible(with: .phone, at: when, latitude: perth.lat, longitude: perth.lon)
        let bino = SkyVisibility.visible(with: .binoculars, at: when, latitude: perth.lat, longitude: perth.lon)
        let scope = SkyVisibility.visible(with: .telescope, at: when, latitude: perth.lat, longitude: perth.lon)
        XCTAssertFalse(phone.isEmpty)
        XCTAssertLessThanOrEqual(phone.count, bino.count)
        XCTAssertLessThanOrEqual(bino.count, scope.count)
        XCTAssertTrue(Set(phone.map(\.id)).isSubset(of: Set(bino.map(\.id))))
        XCTAssertTrue(phone.allSatisfy { $0.position.altitudeDeg >= 5 })
        XCTAssertEqual(phone.map(\.object.magnitude), phone.map(\.object.magnitude).sorted(), "brightest first")
    }

    func testFaintDeepSkyNeedsOpticsAndBrightMoonHidesFaintOnes() {
        let faint = SkyObject(id: "x", name: "Faint", kind: .deepSky, detail: "galaxy", raHours: 0, decDeg: 0, magnitude: 8.5, sizeDeg: 0.1, colorIndex: 0.6)
        XCTAssertFalse(SkyVisibility.isVisible(faint, with: .phone))
        XCTAssertTrue(SkyVisibility.isVisible(faint, with: .binoculars) == false, "extended objects need to be a notch brighter than stars")
        XCTAssertTrue(SkyVisibility.isVisible(faint, with: .telescope))
        let when = date("2026-10-04T14:00:00Z")
        let dark = SkyVisibility.visible(with: .binoculars, at: when, latitude: perth.lat, longitude: perth.lon, moonIlluminationPct: 0)
        let moonlit = SkyVisibility.visible(with: .binoculars, at: when, latitude: perth.lat, longitude: perth.lon, moonIlluminationPct: 100)
        XCTAssertLessThan(moonlit.count, dark.count)
    }

    func testHowToSeeIsSpecificToEquipmentAndDirection() {
        let o = SkyObject(id: "m13", name: "Hercules Globular Cluster", kind: .deepSky, detail: "globular cluster", raHours: 16.7, decDeg: 36.5, magnitude: 5.8, sizeDeg: 0.275, colorIndex: 0.6)
        let p = HorizontalPosition(altitudeDeg: 42, azimuthDeg: 270)
        let phone = ViewingGuide.howToSee(o, with: .phone, position: p)
        let scope = ViewingGuide.howToSee(o, with: .telescope, position: p)
        XCTAssertTrue(phone.contains("W") && phone.contains("42°"))
        XCTAssertNotEqual(phone, scope)
        XCTAssertTrue(scope.contains("eyepiece"))
    }

    // MARK: Pointing

    /// User faces north holding the phone upright, looking through it.
    private let facingNorth = SkyCamera(rotation: [0, -1, 0, 0, 0, 1, -1, 0, 0])

    func testLookDirectionFollowsTheBackCamera() {
        let look = facingNorth.lookDirection
        XCTAssertEqual(look.altitudeDeg, 0, accuracy: 0.001)
        XCTAssertEqual(look.azimuthDeg, 0, accuracy: 0.001)
    }

    func testProjectionPutsEastOnTheRightWhenFacingNorth() throws {
        let centre = try XCTUnwrap(facingNorth.project(HorizontalPosition(altitudeDeg: 0, azimuthDeg: 0), fovDeg: 60, width: 400, height: 800))
        XCTAssertEqual(centre.x, 200, accuracy: 0.01); XCTAssertEqual(centre.y, 400, accuracy: 0.01)
        let east = try XCTUnwrap(facingNorth.project(HorizontalPosition(altitudeDeg: 0, azimuthDeg: 20), fovDeg: 60, width: 400, height: 800))
        XCTAssertGreaterThan(east.x, 200)
        let up = try XCTUnwrap(facingNorth.project(HorizontalPosition(altitudeDeg: 20, azimuthDeg: 0), fovDeg: 60, width: 400, height: 800))
        XCTAssertLessThan(up.y, 400, "higher in the sky is higher on screen")
        XCTAssertNil(facingNorth.project(HorizontalPosition(altitudeDeg: 0, azimuthDeg: 180), fovDeg: 60, width: 400, height: 800), "behind the viewer")
        XCTAssertNil(facingNorth.project(HorizontalPosition(altitudeDeg: 0, azimuthDeg: 80), fovDeg: 60, width: 400, height: 800), "outside the field of view")
    }

    func testLookingCameraAimsWhereAsked() throws {
        for (az, alt) in [(0.0, 0.0), (90, 30), (225, 60), (310, -5)] {
            let cam = SkyCamera.looking(azimuth: az, altitude: alt)
            XCTAssertEqual(cam.lookDirection.altitudeDeg, alt, accuracy: 0.001)
            XCTAssertEqual(cam.lookDirection.azimuthDeg, az, accuracy: 0.001)
            let c = try XCTUnwrap(cam.project(HorizontalPosition(altitudeDeg: alt, azimuthDeg: az), fovDeg: 70, width: 300, height: 500))
            XCTAssertEqual(c.x, 150, accuracy: 0.01); XCTAssertEqual(c.y, 250, accuracy: 0.01)
        }
        // Looking east and a little up: something further south of east is on the right.
        let cam = SkyCamera.looking(azimuth: 90, altitude: 20)
        let right = try XCTUnwrap(cam.project(HorizontalPosition(altitudeDeg: 20, azimuthDeg: 110), fovDeg: 70, width: 300, height: 500))
        XCTAssertGreaterThan(right.x, 150)
    }

    // MARK: Device

    func testDeviceIdentifiersResolveToNamesAndCapabilities() {
        let pro = DeviceCatalog.profile(identifier: "iPhone16,1")
        XCTAssertEqual(pro.name, "iPhone 15 Pro")
        XCTAssertTrue(pro.isPro && pro.hasTelephoto && pro.hasNightMode && pro.hasUltraWide)
        XCTAssertEqual(DeviceCatalog.profile(identifier: "iPhone14,6").hasNightMode, false, "SE has no Night mode")
        XCTAssertEqual(DeviceCatalog.profile(identifier: "iPhone18,3").name, "iPhone 17")
        let future = DeviceCatalog.profile(identifier: "iPhone25,9")
        XCTAssertTrue(future.hasNightMode && future.hasUltraWide)
        XCTAssertEqual(DeviceCatalog.profile(identifier: "iPhone8,1").hasNightMode, false)
        XCTAssertEqual(DeviceCatalog.profile(identifier: "garbage").name, "Your device")
        XCTAssertTrue(pro.summary.contains("Night mode"))
    }

    // MARK: Camera

    private let pro = DeviceCatalog.profile(identifier: "iPhone16,1")
    private let basic = DeviceCatalog.profile(identifier: "iPhone14,7")

    func testStarShotsFollowTheFiveHundredRuleAndFocusAtInfinity() {
        let p = CameraAdvisor.plan(kind: "meteor_shower", equipment: .phone, device: basic, moonIlluminationPct: 10)
        XCTAssertEqual(p.lens, .ultraWide)
        XCTAssertEqual(p.focus, .infinity)
        XCTAssertEqual(p.shutterSeconds, 15, "500/13 = 38 s, capped by the 15 s ceiling")
        let wide = CameraAdvisor.plan(kind: "bright_star", equipment: .phone, device: basic, moonIlluminationPct: 0)
        XCTAssertEqual(wide.shutterSeconds, 10, "main lens: 500/24 = 20 s, capped at 10 s")
        XCTAssertTrue(p.needsTripod)
    }

    func testMoonExposureLengthensForThinCrescent() {
        let full = CameraAdvisor.plan(kind: "moon_phase", equipment: .phone, device: pro, moonIlluminationPct: 100)
        let crescent = CameraAdvisor.plan(kind: "moon_phase", equipment: .phone, device: pro, moonIlluminationPct: 8)
        XCTAssertEqual(full.shutterSeconds, 1.0 / 500, accuracy: 1e-6)
        XCTAssertGreaterThan(crescent.shutterSeconds, full.shutterSeconds * 4)
        XCTAssertLessThan(crescent.shutterSeconds, 0.05)
        XCTAssertEqual(full.lens, .telephoto)
        XCTAssertEqual(CameraAdvisor.plan(kind: "moon_phase", equipment: .phone, device: basic, moonIlluminationPct: 100).lens, .wide)
    }

    func testSolarEclipseWarnsAboutFilters() {
        let p = CameraAdvisor.plan(kind: "eclipse", title: "Total solar eclipse", equipment: .phone, device: pro, moonIlluminationPct: 0)
        XCTAssertTrue(p.warnings.joined().contains("permanent eye damage"))
        XCTAssertTrue(p.steps.joined().contains("filter"))
        let lunar = CameraAdvisor.plan(kind: "eclipse", title: "Total lunar eclipse", equipment: .phone, device: pro, moonIlluminationPct: 100)
        XCTAssertTrue(lunar.warnings.isEmpty)
        XCTAssertEqual(lunar.iso, 1600)
    }

    func testEyepieceShootingLocksFocusAndNeedsNoTripod() {
        let p = CameraAdvisor.plan(kind: "planet_event", equipment: .telescope, device: pro, moonIlluminationPct: 20)
        XCTAssertEqual(p.focus, .lockAfterAutofocus)
        XCTAssertFalse(p.needsTripod)
        XCTAssertTrue(p.steps.first?.contains("eyepiece") ?? false)
    }

    func testBrightMoonHalvesStarExposures() {
        let dark = CameraAdvisor.plan(kind: "bright_star", equipment: .phone, device: pro, moonIlluminationPct: 10)
        let moonlit = CameraAdvisor.plan(kind: "bright_star", equipment: .phone, device: pro, moonIlluminationPct: 90)
        XCTAssertLessThan(moonlit.shutterSeconds, dark.shutterSeconds)
        XCTAssertFalse(moonlit.warnings.isEmpty)
    }

    func testShutterLabels() {
        XCTAssertEqual(CameraPlan.shutterLabel(1.0 / 500), "1/500")
        XCTAssertEqual(CameraPlan.shutterLabel(15), "15s")
        XCTAssertEqual(CameraPlan.shutterLabel(0.5), "1/2")
        XCTAssertEqual(CameraPlan.shutterLabel(2.5), "2.5s")
    }

    // MARK: Alerts

    private func hours(from start: Date, clouds: [Double], rain: Double = 0) -> [HourAdvisory] {
        clouds.enumerated().map { HourAdvisory(start: start.addingTimeInterval(Double($0.offset) * 3600), cloudCoverPct: $0.element, precipitationChancePct: rain) }
    }

    func testClearestWindowPicksLongestClearRun() throws {
        let t0 = date("2026-10-04T12:00:00Z")
        let h = hours(from: t0, clouds: [90, 10, 15, 80, 5, 5, 10, 5, 90])
        let w = try XCTUnwrap(AlertPlanner.clearestWindow(h, from: t0, to: t0.addingTimeInterval(9 * 3600)))
        XCTAssertEqual(w.start, t0.addingTimeInterval(4 * 3600))
        XCTAssertEqual(w.end, t0.addingTimeInterval(8 * 3600))
        XCTAssertEqual(w.meanCloud, 6.25, accuracy: 0.001)
    }

    func testNoWindowWhenCloudyOrTooShortOrRainy() {
        let t0 = date("2026-10-04T12:00:00Z")
        XCTAssertNil(AlertPlanner.clearestWindow(hours(from: t0, clouds: [90, 80, 95, 70]), from: t0, to: t0.addingTimeInterval(4 * 3600)))
        XCTAssertNil(AlertPlanner.clearestWindow(hours(from: t0, clouds: [90, 10, 90]), from: t0, to: t0.addingTimeInterval(3 * 3600)), "one clear hour is too short")
        XCTAssertNil(AlertPlanner.clearestWindow(hours(from: t0, clouds: [5, 5, 5, 5], rain: 80), from: t0, to: t0.addingTimeInterval(4 * 3600)))
    }

    func testClearNightAlertFiresBeforeTheWindowAndMentionsIt() throws {
        let now = date("2026-10-04T04:00:00Z") // noon in Perth
        let dark = DarknessWindow.tonight(now: now, latitude: perth.lat, longitude: perth.lon)
        let dusk = try XCTUnwrap(dark.civilDusk)
        let forecast = ViewingForecast(nights: [], timeZone: "Australia/Perth", hours: hours(from: dusk.addingTimeInterval(-3600), clouds: Array(repeating: 10, count: 10)))
        let alerts = AlertPlanner.plan(forecast: forecast, events: [], now: now, latitude: perth.lat, longitude: perth.lon, timeZone: zone)
        let first = try XCTUnwrap(alerts.first)
        XCTAssertEqual(first.kind, .clearNight)
        XCTAssertEqual(first.title, "Clear sky tonight")
        XCTAssertGreaterThan(first.fireDate, now)
        XCTAssertLessThan(first.fireDate, dusk.addingTimeInterval(3600))
        XCTAssertTrue(first.body.contains("10% cloud"))
        XCTAssertEqual(Set(alerts.map(\.id)).count, alerts.count, "ids are unique per night")
        XCTAssertTrue(alerts.allSatisfy { $0.fireDate > now })
    }

    func testPreferencesTurnAlertKindsOff() {
        let now = date("2026-10-04T04:00:00Z")
        let all = hours(from: now, clouds: Array(repeating: 5, count: 72))
        let f = ViewingForecast(nights: [], timeZone: nil, hours: all)
        let event = SkyEvent(id: "e1", kind: "eclipse", target: "moon", title: "Lunar eclipse", description: "", content: nil,
                             startsAt: now.addingTimeInterval(30 * 3600), endsAt: now.addingTimeInterval(33 * 3600), latitude: nil, longitude: nil)
        let both = AlertPlanner.plan(forecast: f, events: [event], now: now, latitude: perth.lat, longitude: perth.lon, timeZone: zone)
        XCTAssertTrue(both.contains { $0.kind == .event } && both.contains { $0.kind == .clearNight })
        let none = AlertPlanner.plan(forecast: f, events: [event], now: now, latitude: perth.lat, longitude: perth.lon, timeZone: zone, preferences: .init(clearNights: false, events: false))
        XCTAssertTrue(none.isEmpty)
        let eventsOnly = AlertPlanner.plan(forecast: f, events: [event], now: now, latitude: perth.lat, longitude: perth.lon, timeZone: zone, preferences: .init(clearNights: false, events: true))
        XCTAssertEqual(eventsOnly.map(\.kind), [.event])
        XCTAssertEqual(eventsOnly.first?.id, "atlas.alert.event.e1")
    }

    func testCloudyEventHourIsNotAlerted() {
        let now = date("2026-10-04T04:00:00Z")
        let startsAt = now.addingTimeInterval(30 * 3600)
        let f = ViewingForecast(nights: [], timeZone: nil, hours: hours(from: now, clouds: Array(repeating: 95, count: 72)))
        let event = SkyEvent(id: "e2", kind: "eclipse", target: "moon", title: "Lunar eclipse", description: "", content: nil,
                             startsAt: startsAt, endsAt: startsAt.addingTimeInterval(7200), latitude: nil, longitude: nil)
        let alerts = AlertPlanner.plan(forecast: f, events: [event], now: now, latitude: perth.lat, longitude: perth.lon, timeZone: zone)
        XCTAssertTrue(alerts.isEmpty)
    }

    func testParsesHourlyForecastIntoRealInstants() throws {
        let json = """
        {"timezone":"Australia/Perth","utc_offset_seconds":28800,
         "daily":{"time":["2026-10-04"],"cloud_cover_mean":[40],"precipitation_probability_mean":[10]},
         "hourly":{"time":["2026-10-04T21:00","2026-10-04T22:00"],"cloud_cover":[12,30],"cloud_cover_low":[1,2],"cloud_cover_high":[3,4],"precipitation_probability":[0,5]}}
        """
        let f = try ViewingForecastService.parse(Data(json.utf8), days: 1)
        XCTAssertEqual(f.hours.count, 2)
        XCTAssertEqual(f.hours[0].start, date("2026-10-04T13:00:00Z"), "21:00 in Perth (+8) is 13:00 UTC")
        XCTAssertEqual(f.hours[1].cloudCoverPct, 30)
    }

    // MARK: Check-in

    private func event(_ id: String, _ kind: String, start: Double, end: Double, now: Date, title: String = "T") -> SkyEvent {
        SkyEvent(id: id, kind: kind, target: "", title: title, startsAt: now.addingTimeInterval(start * 3600), endsAt: now.addingTimeInterval(end * 3600))
    }

    func testActiveNowKeepsOnlyRelevantRunningEvents() {
        let now = date("2026-10-04T14:00:00Z")
        let events = [
            event("a", "planet_event", start: -1, end: 5, now: now),     // running
            event("b", "conjunction", start: 1, end: 3, now: now),       // later
            event("c", "meteor_shower", start: -30, end: -1, now: now),  // over
            event("d", "fireball", start: -1, end: 1, now: now),         // a record of the past
            event("e", "iss_pass", start: -1, end: 1, now: now),         // opt-in orbital
            event("f", "eclipse", start: -0.5, end: 2, now: now),        // running, higher priority
        ]
        let active = TonightPlanner.activeNow(events, now: now, latitude: perth.lat, longitude: perth.lon)
        XCTAssertEqual(active.map(\.id), ["f", "a"], "most important first")
    }

    func testCheckInFieldsMatchTheWebRecord() {
        let now = date("2026-10-04T14:00:00Z")
        let real = SkyEvent(id: "abc123def456ghi", kind: "eclipse", target: "moon", title: "Total lunar eclipse", startsAt: now, endsAt: now)
        let draft = CheckInDraft(event: real, observedAt: now, rating: .great, note: "  Red moon!  ", deviceUsed: "Binoculars", locationLabel: "Perth", conditionSummary: "")
        let f = CheckIn.fields(draft, userID: "user1")
        XCTAssertEqual(f["user"], "user1")
        XCTAssertEqual(f["observed_at"], "2026-10-04 14:00:00.000Z")
        XCTAssertEqual(f["event"], "abc123def456ghi")
        XCTAssertEqual(f["target_name"], "Total lunar eclipse")
        XCTAssertEqual(f["note"], "Red moon!")
        XCTAssertEqual(f["attempt_rating"], "great")
        XCTAssertEqual(f["device_used"], "Binoculars")
        XCTAssertNil(f["condition_summary"], "blank values are omitted")
        XCTAssertEqual(parsePbDate(f["observed_at"]!), now)
    }

    func testGeneratedEventIdsAreNotSentAsRelations() {
        let now = Date()
        let derived = SkyEvent(id: "derived-moon", kind: "moon_phase", title: "Waxing Moon", startsAt: now, endsAt: now)
        let f = CheckIn.fields(CheckInDraft(event: derived), userID: "u")
        XCTAssertNil(f["event"])
        XCTAssertEqual(f["target_name"], "Waxing Moon")
        XCTAssertTrue(CheckIn.isRecordID("abc123def456ghi"))
        XCTAssertFalse(CheckIn.isRecordID("past-2026-10-04"))
        XCTAssertNil(f["attempt_rating"])
    }

    func testCheckInPostsToTheObservationsCollection() throws {
        let client = PocketBaseClient(baseURL: URL(string: "http://127.0.0.1:8094")!)
        client.token = "tok"
        let body = try JSONEncoder().encode(["user": "u"])
        let req = try client.request(path: "api/collections/atlas_observations/records", method: "POST", body: body)
        XCTAssertEqual(req.httpMethod, "POST")
        XCTAssertEqual(req.url?.path, "/api/collections/atlas_observations/records")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "tok")
    }
}
