import Foundation
import XCTest
@testable import AtlasCore

final class RetryQueueTests: XCTestCase {
    private struct Payload: Codable, Equatable, Sendable {
        var value: String
    }

    func testProcessRemovesSucceededItems() async throws {
        let store = InMemoryRetryQueueStore()
        let queue = RetryQueue<Payload>(store: store)
        _ = try await queue.enqueue(.init(value: "a"), id: "a")
        _ = try await queue.enqueue(.init(value: "b"), id: "b")

        let report = try await queue.process { _ in }
        XCTAssertEqual(report.processed, 2)
        XCTAssertEqual(report.succeeded, 2)
        XCTAssertEqual(report.failed, 0)
        XCTAssertEqual(report.pending, 0)
        XCTAssertEqual(try await queue.allItems(), [])
    }

    func testFailureStaysQueuedAndAttemptCountIncrements() async throws {
        let store = InMemoryRetryQueueStore()
        let queue = RetryQueue<Payload>(store: store)
        _ = try await queue.enqueue(.init(value: "retry-me"), id: "retry-me")

        enum TestError: Error { case fail }

        let first = try await queue.process { _ in throw TestError.fail }
        XCTAssertEqual(first.failed, 1)
        XCTAssertEqual(first.pending, 1)

        let afterFailure = try await queue.allItems()
        XCTAssertEqual(afterFailure.count, 1)
        XCTAssertEqual(afterFailure[0].attempts, 1)

        let second = try await queue.process { _ in }
        XCTAssertEqual(second.succeeded, 1)
        XCTAssertEqual(second.pending, 0)
    }

    func testQueueReloadKeepsPendingItems() async throws {
        let store = InMemoryRetryQueueStore()
        let firstQueue = RetryQueue<Payload>(store: store)
        _ = try await firstQueue.enqueue(.init(value: "persisted"), id: "persisted")

        let reloadedQueue = RetryQueue<Payload>(store: store)
        let items = try await reloadedQueue.allItems()
        XCTAssertEqual(items.map(\.id), ["persisted"])
    }
}
