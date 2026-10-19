import Foundation

public enum AtlasBadgeTier: String, Codable, Equatable, Sendable {
    case gold
    case silver
}

public struct AtlasBadge: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let tier: AtlasBadgeTier

    public init(id: String, title: String, tier: AtlasBadgeTier) {
        self.id = id
        self.title = title
        self.tier = tier
    }
}

public struct AtlasXPEntry: Codable, Equatable, Sendable {
    public let action: String
    public let sourceID: String
    public let skill: String
    public let points: Int

    public init(action: String, sourceID: String, skill: String, points: Int) {
        self.action = action
        self.sourceID = sourceID
        self.skill = skill
        self.points = points
    }
}

public struct AtlasLevelSummary: Codable, Equatable, Sendable {
    public let level: Int
    public let nextLevelAt: Int?
    public let pointsToNextLevel: Int

    public init(level: Int, nextLevelAt: Int?, pointsToNextLevel: Int) {
        self.level = level
        self.nextLevelAt = nextLevelAt
        self.pointsToNextLevel = pointsToNextLevel
    }
}

public struct AtlasProgressSnapshot: Codable, Equatable, Sendable {
    public let totalPoints: Int
    public let level: AtlasLevelSummary
    public let badges: [AtlasBadge]

    public init(totalPoints: Int, level: AtlasLevelSummary, badges: [AtlasBadge]) {
        self.totalPoints = totalPoints
        self.level = level
        self.badges = badges
    }
}

public enum AtlasProgress {
    public static let levelThresholds = [0, 40, 100, 180, 300]

    public static func summarize(entries: [AtlasXPEntry], firstTourBadge: String?) -> AtlasProgressSnapshot {
        let totalPoints = entries.reduce(0) { $0 + max(0, $1.points) }
        let level = levelSummary(totalPoints: totalPoints)
        let badges = buildBadges(entries: entries, firstTourBadge: firstTourBadge)
        return AtlasProgressSnapshot(totalPoints: totalPoints, level: level, badges: badges)
    }

    public static func levelSummary(totalPoints: Int) -> AtlasLevelSummary {
        var level = 1
        for index in 1 ..< levelThresholds.count {
            if totalPoints < levelThresholds[index] {
                return AtlasLevelSummary(level: level, nextLevelAt: levelThresholds[index], pointsToNextLevel: max(0, levelThresholds[index] - totalPoints))
            }
            level += 1
        }
        return AtlasLevelSummary(level: level, nextLevelAt: nil, pointsToNextLevel: 0)
    }

    public static func buildBadges(entries: [AtlasXPEntry], firstTourBadge: String?) -> [AtlasBadge] {
        let actions = Set(entries.map(\.action))
        var badges: [AtlasBadge] = []

        if firstTourBadge == "first_light" {
            badges.append(AtlasBadge(id: "first-light", title: "First light", tier: .gold))
        }
        if actions.contains("trip_planned") {
            badges.append(AtlasBadge(id: "first-trip", title: "First trip planned", tier: .silver))
        }
        if actions.contains("observing_night") {
            badges.append(AtlasBadge(id: "first-check-in", title: "First check-in", tier: .silver))
        }
        if actions.contains("photo_published") {
            badges.append(AtlasBadge(id: "first-photo-published", title: "First photo published", tier: .silver))
        }
        if actions.contains("community_night") {
            badges.append(AtlasBadge(id: "first-community-night", title: "First community night", tier: .silver))
        }

        return badges
    }
}
