import Foundation
import XCTest
@testable import AtlasCore

final class NotificationPlannerTests: XCTestCase {
    private let tz = TimeZone(identifier: "Australia/Perth")!

    func testParsesRemotePayloadRouteAndCategory() throws {
        let payload = try XCTUnwrap(
            AtlasNotificationPayloadParser.parse(userInfo: [
                "aps": ["alert": ["title": "Orionids peak", "body": "Best after midnight."]],
                "category": "sky_events",
                "event_id": "evt-orionids",
                "url": "/tonight?section=coming&eventId=evt-orionids",
            ]))

        XCTAssertEqual(payload.title, "Orionids peak")
        XCTAssertEqual(payload.category, .skyEvents)
        XCTAssertEqual(payload.route, .skyEvent(eventID: "evt-orionids"))
    }

    func testParsesFallbackTonightSectionFromUrl() throws {
        let payload = try XCTUnwrap(
            AtlasNotificationPayloadParser.parse(userInfo: [
                "title": "Atlas: get ready",
                "body": "Clear opening shortly.",
                "category": "clear_sky",
                "url": "/tonight?section=photo",
            ]))

        XCTAssertEqual(payload.category, .clearSky)
        XCTAssertEqual(payload.route, .tonight(section: .photo))
    }

    func testBuildsClearSkyAndPriorityEventDrafts() throws {
        let now = Date(timeIntervalSince1970: 1790942400) // 2026-10-02 20:00 AWST
        let darkStart = now.addingTimeInterval(90 * 60)
        let darkEnd = now.addingTimeInterval(7 * 3600)
        let plan = planForTests(
            now: now,
            rating: .great,
            cloudCover: 12,
            rain: 5,
            windows: [
                .init(kind: .dark, start: darkStart, end: darkEnd, title: "Dark sky", detail: "test"),
            ])
        let upcoming = [
            event("late-comet", title: "Comet atlas", kind: "comet", start: now.addingTimeInterval(2 * 24 * 3600)),
            event("orionids", title: "Orionids peak 21-22 Oct", kind: "meteor_shower", start: now.addingTimeInterval(4 * 24 * 3600)),
            event("wsw", title: "World Space Week opening night", kind: "conjunction", start: now.addingTimeInterval(3 * 24 * 3600)),
        ]

        let drafts = AtlasLocalNotificationPlanner.drafts(from: plan, upcoming: upcoming, now: now)

        XCTAssertEqual(drafts.first?.category, .clearSky)
        XCTAssertTrue(drafts.contains(where: { $0.id == "atlas-local-event-wsw" }))
        XCTAssertTrue(drafts.contains(where: { $0.id == "atlas-local-event-orionids" }))
    }

    func testHonorsPreferencesAndSkipsPoorNights() {
        let now = Date(timeIntervalSince1970: 1790942400)
        let plan = planForTests(
            now: now,
            rating: .poor,
            cloudCover: 88,
            rain: 60,
            windows: [
                .init(kind: .dark, start: now.addingTimeInterval(2 * 3600), end: now.addingTimeInterval(6 * 3600), title: "Dark sky", detail: "test"),
            ])
        let prefs = NotificationPreferences(clearSky: true, skyEvents: false, challenges: false)
        let drafts = AtlasLocalNotificationPlanner.drafts(from: plan, upcoming: [event("a", title: "World Space Week", kind: "conjunction", start: now.addingTimeInterval(3 * 3600))], now: now, preferences: prefs)
        XCTAssertTrue(drafts.isEmpty)
    }

    private func event(_ id: String, title: String, kind: String, start: Date) -> SkyEvent {
        SkyEvent(id: id, kind: kind, target: "", title: title, description: "Details", startsAt: start, endsAt: start.addingTimeInterval(3600))
    }

    private func planForTests(
        now: Date,
        rating: TonightRating,
        cloudCover: Double,
        rain: Double,
        windows: [PhotoWindow]
    ) -> TonightPlan {
        TonightPlan(
            rating: rating,
            reasons: [],
            weatherAvailable: true,
            cloudCoverPct: cloudCover,
            precipitationChancePct: rain,
            moonIlluminationPct: 20,
            moonName: "Waxing",
            darkness: DarknessWindow(sunset: now, civilDusk: now, astronomicalDusk: now, astronomicalDawn: now, civilDawn: now),
            windows: windows,
            generalAdvice: "",
            targets: [],
            stars: [],
            nextClearNight: nil,
            nightStart: now,
            nightEnd: now.addingTimeInterval(8 * 3600),
            latitude: -31.95,
            longitude: 115.86,
            timeZone: tz)
    }
}
