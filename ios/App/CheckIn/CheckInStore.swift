import AtlasCore
import Foundation
import Observation

protocol CheckInService: Sendable {
    func submit(_ draft: CheckInDraft, userID: String) async throws
}

struct LiveCheckInService: CheckInService {
    let client: PocketBaseClient
    func submit(_ draft: CheckInDraft, userID: String) async throws { try await client.submitCheckIn(draft, userID: userID) }
}

/// `-AtlasFixtures` runs have no backend; `-AtlasFixtureCheckInFail` exercises the error state.
struct FixtureCheckInService: CheckInService {
    let fails: Bool
    struct Failure: LocalizedError { var errorDescription: String? { "Fixture check-in failure." } }
    func submit(_ draft: CheckInDraft, userID: String) async throws {
        try await Task.sleep(for: .milliseconds(500))
        if fails { throw Failure() }
    }
}

/// Sends check-ins and remembers which events this device has already checked in to, so the card
/// on Tonight turns into a confirmation instead of asking again.
@Observable @MainActor
final class CheckInStore {
    private static let key = "atlas.checkIns"
    private let service: CheckInService
    private let defaults: UserDefaults
    private(set) var done: [String: Date]

    init(service: CheckInService, defaults: UserDefaults = .standard) {
        self.service = service
        self.defaults = defaults
        let saved = (defaults.dictionary(forKey: Self.key) as? [String: Double]) ?? [:]
        // Events are short-lived; forget old ones so this never grows.
        let cutoff = Date().addingTimeInterval(-7 * 86400)
        done = saved.mapValues { Date(timeIntervalSince1970: $0) }.filter { $0.value > cutoff }
    }

    static func service(client: PocketBaseClient, arguments: [String] = ProcessInfo.processInfo.arguments) -> CheckInService {
        if arguments.contains("-AtlasFixtureCheckInFail") { return FixtureCheckInService(fails: true) }
        if arguments.contains("-AtlasFixtures") || arguments.contains("-AtlasFixtureSignedIn") { return FixtureCheckInService(fails: false) }
        return LiveCheckInService(client: client)
    }

    func checkedInAt(_ eventID: String) -> Date? { done[eventID] }

    func submit(_ draft: CheckInDraft, userID: String) async throws {
        try await service.submit(draft, userID: userID)
        done[draft.event.id] = draft.observedAt
        defaults.set(done.mapValues(\.timeIntervalSince1970), forKey: Self.key)
    }
}
