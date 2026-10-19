import Foundation

/// How sky-event kinds group into browsing categories. Port of src/lib/eventCategories.ts --
/// keep the two in step. `symbol` is an SF Symbol name (the web uses its own icon set).
public struct EventCategory: Equatable, Sendable {
    public let id: String
    public let label: String
    public let symbol: String
    public let kinds: [String]

    public static let all: [EventCategory] = [
        .init(id: "moon-eclipses", label: "Moon & eclipses", symbol: "moon.stars", kinds: ["moon_phase", "eclipse"]),
        .init(id: "planets", label: "Planets & conjunctions", symbol: "globe.europe.africa", kinds: ["planet_event", "conjunction"]),
        .init(id: "meteor-showers", label: "Meteors & fireballs", symbol: "sparkles", kinds: ["meteor_shower", "fireball"]),
        .init(id: "satellites", label: "Satellites", symbol: "antenna.radiowaves.left.and.right", kinds: ["iss_pass", "satellite_flare"]),
        .init(id: "aurora", label: "Aurora & space weather", symbol: "waveform.path", kinds: ["aurora", "solar_flare"]),
        .init(id: "deep-sky", label: "Stars & deep sky", symbol: "binoculars", kinds: ["bright_star", "deep_sky", "telescope_target"]),
        .init(id: "asteroids", label: "Asteroids", symbol: "smallcircle.filled.circle", kinds: ["asteroid_approach"]),
        .init(id: "guides", label: "Guides", symbol: "book", kinds: ["comet", "night_sky_guide", "local_night_sky"]),
    ]

    public static func forKind(_ kind: String) -> EventCategory? {
        all.first { $0.kinds.contains(kind) }
    }
}
