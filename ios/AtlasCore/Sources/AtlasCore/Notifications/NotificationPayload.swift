import Foundation

public enum AtlasTonightSection: String, Codable, Sendable {
    case tonight
    case photo
    case stars
    case coming
}

public enum AtlasNotificationRoute: Equatable, Sendable {
    case tonight(section: AtlasTonightSection)
    case skyEvent(eventID: String)
    case challenge(challengeID: String?)
}

public struct AtlasNotificationPayload: Equatable, Sendable {
    public let title: String
    public let body: String
    public let category: AtlasNotificationCategory
    public let route: AtlasNotificationRoute
    public let url: String?

    public init(title: String, body: String, category: AtlasNotificationCategory, route: AtlasNotificationRoute, url: String?) {
        self.title = title
        self.body = body
        self.category = category
        self.route = route
        self.url = url
    }
}

public enum AtlasNotificationPayloadParser {
    public static func parse(userInfo: [AnyHashable: Any]) -> AtlasNotificationPayload? {
        let aps = userInfo["aps"] as? [String: Any]
        let alert = aps?["alert"] as? [String: Any]
        let title = (userInfo["title"] as? String) ?? (alert?["title"] as? String) ?? "Atlas"
        let body = (userInfo["body"] as? String) ?? (alert?["body"] as? String) ?? "A sky update is ready."
        let url = userInfo["url"] as? String

        let category = parseCategory(raw: userInfo["category"] as? String)
        let route = parseRoute(
            rawRoute: userInfo["atlas_route"] as? String,
            eventID: userInfo["event_id"] as? String,
            challengeID: userInfo["challenge_id"] as? String,
            url: url)

        return AtlasNotificationPayload(title: title, body: body, category: category, route: route, url: url)
    }

    private static func parseCategory(raw: String?) -> AtlasNotificationCategory {
        guard let raw, let category = AtlasNotificationCategory(rawValue: raw) else { return .skyEvents }
        return category
    }

    private static func parseRoute(rawRoute: String?, eventID: String?, challengeID: String?, url: String?) -> AtlasNotificationRoute {
        if let eventID, !eventID.isEmpty { return .skyEvent(eventID: eventID) }
        if rawRoute == "challenge" { return .challenge(challengeID: challengeID) }

        guard let url, let components = URLComponents(string: url) else {
            if rawRoute == "tonight_photo" { return .tonight(section: .photo) }
            if rawRoute == "tonight_stars" { return .tonight(section: .stars) }
            if rawRoute == "tonight_coming" { return .tonight(section: .coming) }
            return .tonight(section: .tonight)
        }

        if let id = components.queryItems?.first(where: { $0.name == "eventId" })?.value, !id.isEmpty {
            return .skyEvent(eventID: id)
        }
        if let id = components.queryItems?.first(where: { $0.name == "challengeId" })?.value {
            return .challenge(challengeID: id.isEmpty ? nil : id)
        }
        if let section = components.queryItems?.first(where: { $0.name == "section" })?.value,
           let tonightSection = AtlasTonightSection(rawValue: section) {
            return .tonight(section: tonightSection)
        }
        if components.path.contains("challenge") { return .challenge(challengeID: challengeID) }
        return .tonight(section: .tonight)
    }
}
