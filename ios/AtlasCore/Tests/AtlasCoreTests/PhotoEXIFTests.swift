import Foundation
import XCTest
@testable import AtlasCore

final class PhotoEXIFTests: XCTestCase {
    func testExplicitOffsetBuildsUTCInstant() {
        let raw = PhotoEXIFRaw(
            dateTimeOriginal: "2026:10:09 22:30:00",
            offsetTimeOriginal: "+02:00",
            latitude: 59.437,
            longitude: 24.7536,
            headingDeg: 191.0,
            cameraMake: "Apple",
            cameraModel: "iPhone 16 Pro"
        )
        let parsed = PhotoEXIFParser.parse(raw: raw)
        XCTAssertEqual(parsed.timeZoneKnown, true)
        XCTAssertEqual(parsed.offsetSource, .exifOffset)
        XCTAssertEqual(parsed.offsetMinutes, 120)
        XCTAssertEqual(try XCTUnwrap(parsed.latitude), 59.437, accuracy: 0.0001)
        XCTAssertEqual(try XCTUnwrap(parsed.longitude), 24.7536, accuracy: 0.0001)
        XCTAssertEqual(parsed.cameraLabel, "Apple iPhone 16 Pro")
        XCTAssertEqual(parsed.dateTaken, Date(timeIntervalSince1970: 1791577800)) // 2026-10-09 20:30:00Z
    }

    func testGpsUTCBackfillsOffsetWhenExifOffsetMissing() {
        let raw = PhotoEXIFRaw(
            dateTimeOriginal: "2026:10:09 22:30:00",
            gpsDateStamp: "2026:10:09",
            gpsTimeStamp: "20:30:00"
        )
        let parsed = PhotoEXIFParser.parse(raw: raw)
        XCTAssertEqual(parsed.timeZoneKnown, false)
        XCTAssertEqual(parsed.offsetSource, .gpsUtc)
        XCTAssertEqual(parsed.offsetMinutes, 120)
        XCTAssertEqual(parsed.dateTaken, Date(timeIntervalSince1970: 1791577800))
    }

    func testLongitudeEstimateFallbackUsesQuarterHourSteps() {
        let raw = PhotoEXIFRaw(
            dateTimeOriginal: "2026:10:09 22:30:00",
            longitude: 22.0
        )
        let parsed = PhotoEXIFParser.parse(raw: raw)
        XCTAssertEqual(parsed.offsetSource, .longitudeEstimate)
        XCTAssertEqual(parsed.offsetMinutes, 90)
        XCTAssertNotNil(parsed.dateTaken)
    }
}
