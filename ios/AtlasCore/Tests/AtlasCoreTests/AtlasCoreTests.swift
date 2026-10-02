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

    func testDecodesRecordWithArbitraryFields() throws {
        let json = Data(#"{"id":"r1","title":"Eclipse","score":3,"tags":["a"]}"#.utf8)
        let record = try JSONDecoder().decode(PocketBaseRecord.self, from: json)
        XCTAssertEqual(record.id, "r1")
        XCTAssertEqual(record.fields["title"], .string("Eclipse"))
    }
}
