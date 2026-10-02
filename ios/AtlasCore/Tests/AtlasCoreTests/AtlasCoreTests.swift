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

final class HubFeedTests: XCTestCase {
    private let perth = TimeZone(identifier: "Australia/Perth")! // UTC+8
    private func event(_ id: String, _ iso: String, kind: String = "meteor_shower") -> SkyEvent {
        let d = parsePbDate(iso)!
        return SkyEvent(id: id, kind: kind, title: id, startsAt: d, endsAt: d.addingTimeInterval(3600))
    }

    func testDayKeysUseTheViewersTimeZoneNotUTC() {
        // 22:00 UTC on the 1st is 06:00 on the 2nd in Perth.
        let feed = HubFeed(now: parsePbDate("2026-10-01T22:00:00Z")!, timeZone: perth)
        XCTAssertEqual(feed.todayKey, "2026-10-02")
        XCTAssertEqual(feed.dateKey(parsePbDate("2026-10-02T17:00:00Z")!), "2026-10-03")
    }

    func testFiltersGroupsAndLabels() {
        let feed = HubFeed(now: parsePbDate("2026-10-02T04:00:00Z")!, timeZone: perth) // 12:00 Oct 2
        let events = [
            event("later", "2026-10-20T10:00:00Z"),
            event("tomorrow", "2026-10-03 02:00:00.000Z"),
            event("tonightB", "2026-10-02T14:00:00Z"),
            event("tonightA", "2026-10-02T11:00:00Z"),
        ]
        XCTAssertEqual(feed.count(events, filter: .all), 4)
        XCTAssertEqual(feed.count(events, filter: .tonight), 2)
        XCTAssertEqual(feed.count(events, filter: .week), 3)
        let groups = feed.groups(events, filter: .all)
        XCTAssertEqual(groups.map(\.label).prefix(2), ["Today", "Tomorrow"])
        XCTAssertEqual(groups[0].events.map(\.id), ["tonightA", "tonightB"])
        XCTAssertEqual(groups.count, 3)
    }

    func testTonightPagesFallBackToNextUpcomingOnAQuietNight() {
        let feed = HubFeed(now: parsePbDate("2026-10-02T04:00:00Z")!, timeZone: perth)
        let busy = [event("b", "2026-10-02T14:00:00Z"), event("a", "2026-10-02T11:00:00Z"), event("far", "2026-10-20T10:00:00Z")]
        let tonight = feed.tonightOrNext(busy)
        XCTAssertTrue(tonight.isTonight)
        XCTAssertEqual(tonight.events.map(\.id), ["a", "b"])

        let quiet = [event("far", "2026-10-20T10:00:00Z"), event("soon", "2026-10-05T10:00:00Z"), event("gone", "2026-09-01T10:00:00Z")]
        let next = feed.tonightOrNext(quiet, limit: 1)
        XCTAssertFalse(next.isTonight)
        XCTAssertEqual(next.events.map(\.id), ["soon"])
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
