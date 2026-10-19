import Foundation

public struct RetryQueueItem<Payload: Codable & Equatable & Sendable>: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let createdAt: Date
    public var attempts: Int
    public var lastError: String?
    public var payload: Payload

    public init(
        id: String = UUID().uuidString,
        createdAt: Date = Date(),
        attempts: Int = 0,
        lastError: String? = nil,
        payload: Payload
    ) {
        self.id = id
        self.createdAt = createdAt
        self.attempts = attempts
        self.lastError = lastError
        self.payload = payload
    }
}

public enum RetryQueueStage: Equatable, Sendable {
    case queued
    case processing
    case succeeded
    case failed(error: String)
}

public struct RetryQueueEvent<Payload: Codable & Equatable & Sendable>: Equatable, Sendable {
    public let item: RetryQueueItem<Payload>
    public let stage: RetryQueueStage
}

public struct RetryQueueProcessingReport: Equatable, Sendable {
    public let processed: Int
    public let succeeded: Int
    public let failed: Int
    public let pending: Int
}

public protocol RetryQueueStore: Sendable {
    func loadData() async throws -> Data?
    func saveData(_ data: Data) async throws
}

public actor InMemoryRetryQueueStore: RetryQueueStore {
    private var data: Data?

    public init() {}

    public func loadData() async throws -> Data? { data }
    public func saveData(_ data: Data) async throws { self.data = data }
}

public actor JSONFileRetryQueueStore: RetryQueueStore {
    private let url: URL

    public init(url: URL) {
        self.url = url
    }

    public func loadData() async throws -> Data? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try Data(contentsOf: url)
    }

    public func saveData(_ data: Data) async throws {
        let dir = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: nil)
        try data.write(to: url, options: [.atomic])
    }
}

public actor RetryQueue<Payload: Codable & Equatable & Sendable> {
    private let store: RetryQueueStore
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var loaded = false
    private var items: [RetryQueueItem<Payload>] = []

    public init(store: RetryQueueStore) {
        self.store = store
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    public func allItems() async throws -> [RetryQueueItem<Payload>] {
        try await ensureLoaded()
        return items
    }

    @discardableResult
    public func enqueue(_ payload: Payload, id: String = UUID().uuidString) async throws -> RetryQueueItem<Payload> {
        try await ensureLoaded()
        let item = RetryQueueItem(id: id, payload: payload)
        items.append(item)
        try await persist()
        return item
    }

    @discardableResult
    public func process(
        onEvent: (@Sendable (RetryQueueEvent<Payload>) async -> Void)? = nil,
        handler: @Sendable (RetryQueueItem<Payload>) async throws -> Void
    ) async throws -> RetryQueueProcessingReport {
        try await ensureLoaded()

        var processed = 0
        var succeeded = 0
        var failed = 0
        var index = 0

        while index < items.count {
            var item = items[index]
            await onEvent?(RetryQueueEvent(item: item, stage: .processing))
            processed += 1
            do {
                try await handler(item)
                items.remove(at: index)
                succeeded += 1
                await onEvent?(RetryQueueEvent(item: item, stage: .succeeded))
                try await persist()
            } catch {
                item.attempts += 1
                item.lastError = String(describing: error)
                items[index] = item
                failed += 1
                await onEvent?(RetryQueueEvent(item: item, stage: .failed(error: item.lastError ?? "Unknown error")))
                try await persist()
                index += 1
            }
        }

        return RetryQueueProcessingReport(
            processed: processed,
            succeeded: succeeded,
            failed: failed,
            pending: items.count
        )
    }

    public func removeAll() async throws {
        try await ensureLoaded()
        items.removeAll()
        try await persist()
    }

    private func ensureLoaded() async throws {
        guard !loaded else { return }
        defer { loaded = true }
        guard let data = try await store.loadData() else {
            items = []
            return
        }
        do {
            items = try decoder.decode([RetryQueueItem<Payload>].self, from: data)
        } catch {
            items = []
        }
    }

    private func persist() async throws {
        let data = try encoder.encode(items)
        try await store.saveData(data)
    }
}
