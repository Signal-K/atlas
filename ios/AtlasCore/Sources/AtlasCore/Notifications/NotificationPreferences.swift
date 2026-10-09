import Foundation

public enum AtlasNotificationCategory: String, CaseIterable, Codable, Sendable {
    case clearSky = "clear_sky"
    case skyEvents = "sky_events"
    case challenges = "challenges"

    public var title: String {
        switch self {
        case .clearSky: "Clear-sky windows"
        case .skyEvents: "Sky events"
        case .challenges: "Challenges"
        }
    }

    public var description: String {
        switch self {
        case .clearSky: "Cloud-aware prompts when conditions are favorable."
        case .skyEvents: "Upcoming celestial events from your watchlist and Tonight feed."
        case .challenges: "Challenge updates tied to active sky events."
        }
    }
}

public struct NotificationPreferences: Codable, Equatable, Sendable {
    public var clearSky: Bool
    public var skyEvents: Bool
    public var challenges: Bool

    public init(clearSky: Bool = true, skyEvents: Bool = true, challenges: Bool = true) {
        self.clearSky = clearSky
        self.skyEvents = skyEvents
        self.challenges = challenges
    }

    public static let `default` = NotificationPreferences()

    public func allows(_ category: AtlasNotificationCategory) -> Bool {
        switch category {
        case .clearSky: clearSky
        case .skyEvents: skyEvents
        case .challenges: challenges
        }
    }

    public mutating func set(_ category: AtlasNotificationCategory, enabled: Bool) {
        switch category {
        case .clearSky: clearSky = enabled
        case .skyEvents: skyEvents = enabled
        case .challenges: challenges = enabled
        }
    }
}
