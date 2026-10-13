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

    func testAIEndpointsKeepPathSeparators() {
        let base = URL(string: "https://pb.test")!
        XCTAssertEqual(AtlasAIClient.endpoint(baseURL: base, path: "atlas/ask").absoluteString, "https://pb.test/atlas/ask")
        XCTAssertEqual(
            AtlasAIClient.endpoint(baseURL: base, path: "/atlas/observations/caption").absoluteString,
            "https://pb.test/atlas/observations/caption")
        XCTAssertEqual(
            AtlasAIClient.endpoint(baseURL: base, path: "atlas/events/eclipse-roadmap").absoluteString,
            "https://pb.test/atlas/events/eclipse-roadmap")
        XCTAssertFalse(AtlasAIClient.endpoint(baseURL: base, path: "atlas/ask").absoluteString.contains("%2F"))
    }
}

private final class AtlasAIStub: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var status = 200
    nonisolated(unsafe) static var body = Data(#"{"answer":"Jupiter is up."}"#.utf8)
    nonisolated(unsafe) static var seen: URLRequest?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.seen = request
        let response = HTTPURLResponse(url: request.url!, statusCode: Self.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class AtlasAIClientTests: XCTestCase {
    private func client() -> AtlasAIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [AtlasAIStub.self]
        return AtlasAIClient(baseURL: URL(string: "https://pb.test")!, session: URLSession(configuration: config))
    }

    func testAskPostsAuthorizedJSONToTheHookPath() async throws {
        AtlasAIStub.status = 200
        AtlasAIStub.body = Data(#"{"answer":"Jupiter is up."}"#.utf8)
        let answer = try await client().ask(question: "What is up?", context: "Perth", token: "tok")
        XCTAssertEqual(answer, "Jupiter is up.")
        XCTAssertEqual(AtlasAIStub.seen?.httpMethod, "POST")
        XCTAssertEqual(AtlasAIStub.seen?.url?.absoluteString, "https://pb.test/atlas/ask")
        XCTAssertEqual(AtlasAIStub.seen?.value(forHTTPHeaderField: "Authorization"), "tok")
        XCTAssertEqual(AtlasAIStub.seen?.value(forHTTPHeaderField: "Content-Type"), "application/json")
        let payload = try JSONSerialization.jsonObject(with: try XCTUnwrap(AtlasAIStub.seen?.httpBody)) as? [String: String]
        XCTAssertEqual(payload?["question"], "What is up?")
        XCTAssertEqual(payload?["context"], "Perth")
    }

    func testAskSurfacesNotEnabledFromTheServer() async {
        AtlasAIStub.status = 400
        AtlasAIStub.body = Data(#"{"data":{},"message":"Ask Atlas is not enabled on this deployment.","status":400}"#.utf8)
        do {
            _ = try await client().ask(question: "Hi", context: nil, token: "tok")
            XCTFail("expected not enabled")
        } catch let error as AskAtlasError {
            XCTAssertEqual(error, .notEnabled)
        } catch {
            XCTFail("unexpected \(error)")
        }
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
