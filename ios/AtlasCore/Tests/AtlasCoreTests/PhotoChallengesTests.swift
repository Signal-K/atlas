import Foundation
import XCTest
@testable import AtlasCore

final class PhotoChallengesTests: XCTestCase {
    func testBadgeTierGoldInWindowSilverAfter() throws {
        let challenge = try XCTUnwrap(PhotoChallengeCatalog.definitions.first { $0.id == "wsw-saturn-sky-photo" })
        let middle = challenge.window.start.addingTimeInterval(2 * 86_400)
        XCTAssertEqual(challenge.badgeTier(for: middle), .gold)
        XCTAssertEqual(challenge.badgeTier(for: challenge.window.end.addingTimeInterval(60)), .silver)
        XCTAssertNil(challenge.badgeTier(for: challenge.window.start.addingTimeInterval(-60)))
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
        XCTAssertEqual(try await firstGate.claimOnce(key: key), true)
        XCTAssertEqual(try await firstGate.claimOnce(key: key), false)

        // Simulate app reload by creating a fresh gate against the same backing store.
        let secondGate = ChallengeCreditGate(store: store)
        XCTAssertEqual(try await secondGate.claimOnce(key: key), false)
        XCTAssertEqual(try await secondGate.claimOnce(key: key + "-different"), true)
    }
}
