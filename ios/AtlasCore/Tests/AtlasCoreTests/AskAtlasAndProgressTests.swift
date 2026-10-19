import Foundation
import XCTest
@testable import AtlasCore

final class AskAtlasModelTests: XCTestCase {
    func testAskAtlasRequestEncoding() throws {
        let payload = AskAtlasRequest(question: "What can I see tonight?", context: "Perth, mostly clear")
        let data = try JSONEncoder().encode(payload)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: String]
        XCTAssertEqual(json?["question"], "What can I see tonight?")
        XCTAssertEqual(json?["context"], "Perth, mostly clear")
    }

    func testAskAtlasResponseDecoding() throws {
        let data = Data(#"{"answer":"Try Jupiter near midnight."}"#.utf8)
        let decoded = try JSONDecoder().decode(AskAtlasResponse.self, from: data)
        XCTAssertEqual(decoded.answer, "Try Jupiter near midnight.")
    }

    func testAskAtlasHTTPErrorMapping() {
        XCTAssertEqual(AskAtlasError.fromHTTP(status: 429, message: nil), .rateLimited)
        XCTAssertEqual(AskAtlasError.fromHTTP(status: 403, message: "denied"), .unauthorized)
        XCTAssertEqual(AskAtlasError.fromHTTP(status: 400, message: "Ask Atlas is a Sky Pass feature."), .notEntitled)
        XCTAssertEqual(AskAtlasError.fromHTTP(status: 400, message: "Ask Atlas is not enabled on this deployment."), .notEnabled)
        XCTAssertEqual(AskAtlasError.fromHTTP(status: 400, message: "A question is required."), .invalidQuestion)
    }
}

final class AtlasProgressTests: XCTestCase {
    func testLevelThresholdsMatchWebProjector() {
        XCTAssertEqual(AtlasProgress.levelSummary(totalPoints: 0), AtlasLevelSummary(level: 1, nextLevelAt: 40, pointsToNextLevel: 40))
        XCTAssertEqual(AtlasProgress.levelSummary(totalPoints: 40), AtlasLevelSummary(level: 2, nextLevelAt: 100, pointsToNextLevel: 60))
        XCTAssertEqual(AtlasProgress.levelSummary(totalPoints: 299), AtlasLevelSummary(level: 4, nextLevelAt: 300, pointsToNextLevel: 1))
        XCTAssertEqual(AtlasProgress.levelSummary(totalPoints: 350), AtlasLevelSummary(level: 5, nextLevelAt: nil, pointsToNextLevel: 0))
    }

    func testBadgeAndPointSummary() {
        let rows = [
            AtlasXPEntry(action: "observing_night", sourceID: "2026-10-08", skill: "observing", points: 10),
            AtlasXPEntry(action: "trip_planned", sourceID: "trip-1", skill: "planning", points: 20),
            AtlasXPEntry(action: "photo_published", sourceID: "obs-1", skill: "photography", points: 15),
        ]
        let summary = AtlasProgress.summarize(entries: rows, firstTourBadge: "first_light")
        XCTAssertEqual(summary.totalPoints, 45)
        XCTAssertEqual(summary.level.level, 2)
        XCTAssertEqual(summary.badges.first?.tier, .gold)
        XCTAssertTrue(summary.badges.contains(where: { $0.id == "first-check-in" && $0.tier == .silver }))
        XCTAssertTrue(summary.badges.contains(where: { $0.id == "first-trip" && $0.tier == .silver }))
        XCTAssertTrue(summary.badges.contains(where: { $0.id == "first-photo-published" && $0.tier == .silver }))
    }
}
