import Foundation
import XCTest
@testable import AtlasCore

final class PhotoChallengesTests: XCTestCase {
    func testBadgeTierGoldInWindowSilverAfter() throws {
        let challenge = try XCTUnwrap(PhotoChallengeCatalog.definitions.first { $0.id == "asv-129-wsw-saturn-sky-photo" })
        let middle = challenge.window.start.addingTimeInterval(2 * 86_400)
        XCTAssertEqual(challenge.badgeTier(for: middle), .gold)
        XCTAssertEqual(challenge.badgeTier(for: challenge.window.end.addingTimeInterval(60)), .silver)
        XCTAssertNil(challenge.badgeTier(for: challenge.window.start.addingTimeInterval(-60)))
    }

    func testWorldSpaceWeekDestinationsLinkToTheOtherGamesOverHTTPS() {
        XCTAssertEqual(
            WorldSpaceWeekCampaign.destinations.map(\.id),
            ["landnam", "garden"]
        )
        XCTAssertEqual(
            WorldSpaceWeekCampaign.destinations.map(\.url.host),
            ["playlandnam.space", "starsailors.space"]
        )
        XCTAssertTrue(WorldSpaceWeekCampaign.destinations.allSatisfy { $0.url.scheme == "https" })
    }

    func testSaturnCreditKeyIsStable() {
        XCTAssertEqual(
            saturnSharedEventCreditKey(userID: "u1", sourceID: "obs-123"),
            saturnSharedEventCreditKey(userID: "u1", sourceID: "obs-123")
        )
        XCTAssertNotEqual(
            saturnSharedEventCreditKey(userID: "u1", sourceID: "obs-123"),
            saturnSharedEventCreditKey(userID: "u1", sourceID: "obs-124")
        )
    }

    func testCreditGateIsIdempotentAcrossReloadRetry() async throws {
        let store = InMemoryChallengeCreditStore()
        let key = saturnSharedEventCreditKey(userID: "user-a", sourceID: "upload-1")

        let firstGate = ChallengeCreditGate(store: store)
        let _v2 = try await firstGate.claimOnce(key: key)
        XCTAssertEqual(_v2, true)
        let _v3 = try await firstGate.claimOnce(key: key)
        XCTAssertEqual(_v3, false)
        // Simulate app reload by creating a fresh gate against the same backing store.
        let secondGate = ChallengeCreditGate(store: store)
        let _v4 = try await secondGate.claimOnce(key: key)
        XCTAssertEqual(_v4, false)
        let _v5 = try await secondGate.claimOnce(key: key + "-different")
        XCTAssertEqual(_v5, true)
    }

    func testOrionidsChallengeHasASV130AndPeakWindow() throws {
        let challenge = try XCTUnwrap(PhotoChallengeCatalog.definitions.first { $0.id == "asv-130-orionids-2026" })
        XCTAssertEqual(challenge.name, "ASV-130 Orionids challenge")
        XCTAssertEqual(challenge.window.peak, ISO8601DateFormatter().date(from: "2026-10-21T22:00:00Z"))
        XCTAssertEqual(challenge.window.end, ISO8601DateFormatter().date(from: "2026-10-24T23:59:59Z"))
    }
}
