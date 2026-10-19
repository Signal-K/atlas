import Foundation
import XCTest
@testable import AtlasCore

final class AtlasCoreTests: XCTestCase {
    func testParsesPocketBaseSpaceSeparatedDates() throws {
        let date = try XCTUnwrap(parsePbDate("2024-01-25 17:54:00.000Z"))
        XCTAssertEqual(date, Date(timeIntervalSince1970: 1706205240))
        XCTAssertEqual(parsePbDate("2024-01-25T17:54:00Z"), Date(timeIntervalSince1970: 1706205240))
        XCTAssertNil(parsePbDate("nonsense"))
    }

    func testMoonPhaseMatchesKnownSyzygies() {
        let fullMoon = Date(timeIntervalSince1970: 1706205240) // 2024-01-25 17:54 UTC
        let newMoon = Date(timeIntervalSince1970: 1704974220)  // 2024-01-11 11:57 UTC
        XCTAssertEqual(MoonPhase.name(at: fullMoon), "Full moon")
        XCTAssertGreaterThan(MoonPhase.illuminationPercent(at: fullMoon), 98)
        XCTAssertEqual(MoonPhase.name(at: newMoon), "New moon")
        XCTAssertLessThan(MoonPhase.illuminationPercent(at: newMoon), 2)
        // 60% lit (about 5 days after full) is gibbous, never "quarter".
        XCTAssertEqual(MoonPhase.name(at: fullMoon.addingTimeInterval(5 * 86400)), "Waning gibbous")
        XCTAssertTrue(MoonPhase.isWaxing(at: newMoon.addingTimeInterval(3 * 86400)))
        XCTAssertFalse(MoonPhase.isWaxing(at: fullMoon.addingTimeInterval(3 * 86400)))
    }

    func testBuildsAuthorizedListRequest() throws {
        let client = PocketBaseClient(baseURL: URL(string: "http://127.0.0.1:8090")!)
        client.token = "abc"
        let req = try client.request(path: "api/collections/events/records", query: [URLQueryItem(name: "page", value: "1")])
        XCTAssertEqual(req.url?.absoluteString, "http://127.0.0.1:8090/api/collections/events/records?page=1")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "abc")
    }

    func testBuildsRegisterAndRefreshRequests() throws {
        let client = PocketBaseClient(baseURL: URL(string: "http://127.0.0.1:8090")!)
        client.token = "tok"
        let refresh = try client.request(path: "api/collections/users/auth-refresh", method: "POST")
        XCTAssertEqual(refresh.httpMethod, "POST")
        XCTAssertEqual(refresh.value(forHTTPHeaderField: "Authorization"), "tok")
        let body = try JSONEncoder().encode(["email": "a@b.co", "password": "pw", "passwordConfirm": "pw"])
        let create = try client.request(path: "api/collections/users/records", method: "POST", body: body)
        XCTAssertEqual(create.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertEqual(create.httpBody, body)
    }

    func testDecodesRecordWithArbitraryFields() throws {
        let json = Data(#"{"id":"r1","title":"Eclipse","score":3,"tags":["a"]}"#.utf8)
        let record = try JSONDecoder().decode(PocketBaseRecord.self, from: json)
        XCTAssertEqual(record.id, "r1")
        XCTAssertEqual(record.fields["title"], .string("Eclipse"))
    }
}

final class AstroTests: XCTestCase {
    private let perth = TimeZone(identifier: "Australia/Perth")!
    private let lat = -31.95, lon = 115.86
    private let now = Date(timeIntervalSince1970: 1790942400) // 2026-10-02 20:00 AWST

    func testSiriusAltitudeMatchesHandCalculation() throws {
        let sirius = try XCTUnwrap(Catalog.stars.first { $0.id == "sirius" })
        let p = Astro.horizontal(raHours: sirius.raHours, decDeg: sirius.decDeg, at: now.addingTimeInterval(8 * 3600), latitude: lat, longitude: lon)
        XCTAssertEqual(p.altitudeDeg, 55.8, accuracy: 0.5) // 04:00 AWST, LST 4.49h
        XCTAssertEqual(p.compass, "E")
    }

    func testPerthTwilightTimesAreSane() throws {
        let w = DarknessWindow.tonight(now: now, latitude: lat, longitude: lon)
        var cal = Calendar(identifier: .gregorian); cal.timeZone = perth
        func hm(_ d: Date?) -> Double { let c = cal.dateComponents([.hour, .minute], from: d!); return Double(c.hour!) + Double(c.minute!) / 60 }
        XCTAssertEqual(hm(w.sunset), 18.33, accuracy: 0.25)
        XCTAssertEqual(hm(w.astronomicalDusk), 19.7, accuracy: 0.25)
        XCTAssertEqual(hm(w.astronomicalDawn), 4.5, accuracy: 0.25)
        XCTAssertLessThan(try XCTUnwrap(w.sunset), try XCTUnwrap(w.civilDusk))
        XCTAssertLessThan(try XCTUnwrap(w.civilDusk), try XCTUnwrap(w.astronomicalDusk))
    }

    func testMoonIsBelowHorizonBeforeMidnightNearLastQuarter() {
        XCTAssertLessThan(Astro.moonPosition(at: now, latitude: lat, longitude: lon).altitudeDeg, 0)
        XCTAssertGreaterThan(Astro.moonPosition(at: now.addingTimeInterval(8 * 3600), latitude: lat, longitude: lon).altitudeDeg, 20)
    }
}

final class TonightPlannerTests: XCTestCase {
    private let perth = TimeZone(identifier: "Australia/Perth")!
    private let lat = -31.95, lon = 115.86
    private let now = Date(timeIntervalSince1970: 1790942400)

    private func event(_ id: String, _ kind: String, target: String = "", at hours: Double = 1, lat elat: Double? = nil, lon elon: Double? = nil) -> SkyEvent {
        let s = now.addingTimeInterval(hours * 3600)
        return SkyEvent(id: id, kind: kind, target: target, title: id, startsAt: s, endsAt: s.addingTimeInterval(3600), latitude: elat, longitude: elon)
    }

    func testPlanRanksByKindPriorityAndFiltersByLocationAndOrbitalKinds() {
        let plan = TonightPlanner.plan(events: [
            event("meteors", "meteor_shower"), event("moon", "moon_phase"), event("conj", "conjunction"),
            event("iss", "iss_pass"), event("farISS", "fireball", lat: 51.5, lon: -0.1),
        ], forecast: nil, now: now, latitude: lat, longitude: lon, timeZone: perth)
        XCTAssertEqual(plan.targets.map(\.id), ["moon", "conj", "meteors"])
        XCTAssertEqual(plan.rating, .maybe)
        XCTAssertFalse(plan.weatherAvailable)
    }

    func testQuietNightStillOffersTheMoonWhenItIsUp() throws {
        // Perth, Oct 2 2026: the waning moon rises after midnight and climbs before dawn.
        let plan = TonightPlanner.plan(events: [], forecast: nil, now: now, latitude: lat, longitude: lon, timeZone: perth)
        let moon = try XCTUnwrap(plan.targets.first { $0.event.id == "derived-moon" })
        XCTAssertGreaterThan(try XCTUnwrap(moon.direction).altitudeDeg, 8)
        // ...but never duplicates a calendar moon event.
        let withEvent = TonightPlanner.plan(events: [event("moon", "moon_phase")], forecast: nil, now: now, latitude: lat, longitude: lon, timeZone: perth)
        XCTAssertNil(withEvent.targets.first { $0.event.id == "derived-moon" })
    }

    func testUpcomingIsLaterLocalNonOrbitalEventsInOrder() {
        let events = [event("later", "meteor_shower", at: 60), event("soon", "comet", at: 40), event("iss", "iss_pass", at: 45), event("tonight", "comet", at: 1),
                      event("far", "fireball", at: 50, lat: 51.5, lon: -0.1)]
        let end = now.addingTimeInterval(10 * 3600)
        XCTAssertEqual(TonightPlanner.upcoming(events, after: end, latitude: lat, longitude: lon).map(\.id), ["soon", "later"])
    }

    func testDeepSkyThatNeverRisesIsDroppedAndVisibleOnesGetADirection() {
        // M31 (dec +41) from Perth sits low; M42 is a showpiece Perth sees well after midnight.
        let plan = TonightPlanner.plan(events: [event("m42", "deep_sky", target: "m42"), event("m13", "deep_sky", target: "m13")],
                                       forecast: nil, now: now, latitude: lat, longitude: lon, timeZone: perth)
        XCTAssertTrue(plan.targets.allSatisfy { $0.direction != nil })
        XCTAssertTrue(plan.targets.allSatisfy { ($0.direction?.altitudeDeg ?? 0) >= 10 })
    }

    func testStarsAreBrightestFirstAndWellPlaced() {
        let plan = TonightPlanner.plan(events: [], forecast: nil, now: now, latitude: lat, longitude: lon, timeZone: perth)
        XCTAssertFalse(plan.stars.isEmpty)
        XCTAssertEqual(plan.stars.first?.star.name, "Sirius")
        XCTAssertTrue(plan.stars.allSatisfy { $0.bestPosition.altitudeDeg >= 25 })
        XCTAssertEqual(plan.stars.map(\.star.magnitude), plan.stars.map(\.star.magnitude).sorted())
    }

    func testWindowsIncludeDarkAndMoonFreeSpan() throws {
        let plan = TonightPlanner.plan(events: [], forecast: nil, now: now, latitude: lat, longitude: lon, timeZone: perth)
        let dark = try XCTUnwrap(plan.windows.first { $0.kind == .dark })
        let moonless = try XCTUnwrap(plan.windows.first { $0.kind == .moonless })
        XCTAssertGreaterThanOrEqual(moonless.start, dark.start)
        XCTAssertLessThanOrEqual(moonless.end, dark.end.addingTimeInterval(1))
    }

    func testPlanCarriesThePlacesTimeZoneAndFallbackCityMatchesTheDeviceZone() {
        let plan = TonightPlanner.plan(events: [], forecast: nil, now: now, latitude: lat, longitude: lon, timeZone: perth)
        XCTAssertEqual(plan.timeZone.identifier, "Australia/Perth")
        XCTAssertEqual(Cities.fallback(for: TimeZone(identifier: "Europe/Tallinn")!).name, "Tallinn")
        // A zone with no listed city still resolves to the nearest offset (Asia/Kathmandu +5:45 -> a +5:30 or +6:00 city).
        XCTAssertTrue(["Mumbai", "Delhi", "Dhaka"].contains(Cities.fallback(for: TimeZone(identifier: "Asia/Kathmandu")!).name))
    }

    func testScoreAndForecastParsing() throws {
        XCTAssertEqual(TonightScore.score(cloudCoverPct: 90, precipitationChancePct: 0, moonIlluminationPct: 0, hasBrightTarget: false).rating, .skip)
        XCTAssertEqual(TonightScore.score(cloudCoverPct: 5, precipitationChancePct: 0, moonIlluminationPct: 10, hasBrightTarget: false).rating, .great)
        XCTAssertEqual(TonightScore.score(cloudCoverPct: 40, precipitationChancePct: 30, moonIlluminationPct: 80, hasBrightTarget: true).rating, .good)

        var times: [String] = [], cloud: [Double] = [], rain: [Double] = []
        for (day, hours) in [("2026-10-02", 18..<24), ("2026-10-03", 0..<6)] {
            for h in hours { times.append(String(format: "%@T%02d:00", day, h)); cloud.append(day == "2026-10-02" ? 10 : 30); rain.append(0) }
        }
        // 06 hours of 10% (evening) + 6 hours of 30% (morning) => 20% night average; daytime hours ignored.
        times += ["2026-10-02T12:00", "2026-10-03T12:00"]; cloud += [100, 100]; rain += [90, 90]
        let json = ["timezone": "Australia/Perth", "daily": ["time": ["2026-10-02"], "cloud_cover_mean": [99], "precipitation_probability_mean": [90]],
                    "hourly": ["time": times, "cloud_cover": cloud, "precipitation_probability": rain]] as [String: Any]
        let f = try ViewingForecastService.parse(JSONSerialization.data(withJSONObject: json))
        XCTAssertEqual(f.timeZone, "Australia/Perth")
        XCTAssertEqual(try XCTUnwrap(f.nights.first).cloudCoverPct, 20, accuracy: 0.01)
        XCTAssertEqual(try XCTUnwrap(f.nights.first).precipitationChancePct, 0, accuracy: 0.01)
    }
}

final class SkyEventTests: XCTestCase {
    private func record(_ json: String) throws -> PocketBaseRecord {
        try JSONDecoder().decode(PocketBaseRecord.self, from: Data(json.utf8))
    }

    func testMapsRecordAndTreatsZeroZeroAsNoLocation() throws {
        let r = try record(#"{"id":"e1","kind":"eclipse","target":"moon","title":"Total eclipse","description":"d","starts_at":"2026-08-12 17:00:00.000Z","ends_at":"2026-08-12 19:00:00.000Z","latitude":0,"longitude":0}"#)
        let e = try XCTUnwrap(SkyEvent(record: r))
        XCTAssertEqual(e.title, "Total eclipse")
        XCTAssertEqual(e.endsAt.timeIntervalSince(e.startsAt), 7200)
        XCTAssertNil(e.latitude)
        let placed = try XCTUnwrap(SkyEvent(record: try record(#"{"id":"e2","starts_at":"2026-08-12 17:00:00.000Z","ends_at":"2026-08-12 19:00:00.000Z","latitude":-31.9,"longitude":115.8}"#)))
        XCTAssertEqual(placed.latitude, -31.9)
    }

    func testSkipsRecordsWithoutDates() throws {
        XCTAssertNil(SkyEvent(record: try record(#"{"id":"bad","title":"x"}"#)))
    }

    func testCategoryLookup() {
        XCTAssertEqual(EventCategory.forKind("iss_pass")?.label, "Satellites")
        XCTAssertNil(EventCategory.forKind("nope"))
    }
}
