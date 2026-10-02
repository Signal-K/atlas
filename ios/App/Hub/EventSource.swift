import AtlasCore
import Foundation

protocol EventSource: Sendable {
    func events(from: Date, to: Date) async throws -> [SkyEvent]
}

struct LiveEventSource: EventSource {
    let client: PocketBaseClient
    func events(from: Date, to: Date) async throws -> [SkyEvent] {
        try await client.skyEvents(from: from, to: to)
    }
}

/// Launch-argument driven fixtures so the Hub's states can be exercised without a backend:
/// `-AtlasFixtures`, `-AtlasFixtureEmpty`, `-AtlasFixtureError`, `-AtlasFixtureSlow`.
struct FixtureEventSource: EventSource {
    enum Mode { case loaded, empty, error, slow }
    let mode: Mode

    struct FixtureError: LocalizedError {
        var errorDescription: String? { "Couldn't reach the sky events service." }
    }

    func events(from: Date, to: Date) async throws -> [SkyEvent] {
        switch mode {
        case .error: throw FixtureError()
        case .empty: return []
        case .slow: try await Task.sleep(for: .seconds(3600)); return []
        case .loaded: return Self.sample(now: from)
        }
    }

    static func fromLaunchArguments(_ args: [String] = ProcessInfo.processInfo.arguments) -> FixtureEventSource? {
        if args.contains("-AtlasFixtureError") { return .init(mode: .error) }
        if args.contains("-AtlasFixtureEmpty") { return .init(mode: .empty) }
        if args.contains("-AtlasFixtureSlow") { return .init(mode: .slow) }
        if args.contains("-AtlasFixtures") { return .init(mode: .loaded) }
        return nil
    }

    static func sample(now: Date) -> [SkyEvent] {
        func ev(_ id: String, _ kind: String, _ title: String, _ desc: String, hours: Double, dur: Double = 3) -> SkyEvent {
            let s = now.addingTimeInterval(hours * 3600)
            return SkyEvent(id: id, kind: kind, target: "", title: title, description: desc,
                            startsAt: s, endsAt: s.addingTimeInterval(dur * 3600))
        }
        return [
            ev("f1", "moon_phase", "Full Moon", "The Moon is fully illuminated.", hours: 3),
            ev("f2", "iss_pass", "ISS evening pass", "Bright pass, 4 minutes above 40 degrees.", hours: 5, dur: 0.1),
            ev("f3", "conjunction", "Venus meets Jupiter", "Closest approach in the pre-dawn sky.", hours: 30),
            ev("f4", "meteor_shower", "Orionids peak", "Up to 20 meteors per hour from a dark site.", hours: 52, dur: 8),
            ev("f5", "eclipse", "Partial lunar eclipse", "Visible across the Pacific.", hours: 100, dur: 4),
            ev("f6", "comet", "Comet approach", "Binocular object in Virgo.", hours: 200, dur: 12),
        ]
    }
}
