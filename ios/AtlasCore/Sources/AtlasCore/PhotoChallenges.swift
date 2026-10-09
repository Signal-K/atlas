import Foundation

public struct ChallengeWindow: Equatable, Sendable {
    public let start: Date
    public let end: Date
    public let peak: Date?

    public init(start: Date, end: Date, peak: Date? = nil) {
        self.start = start
        self.end = end
        self.peak = peak
    }

    public func contains(_ date: Date) -> Bool {
        date >= start && date <= end
    }
}

public enum ChallengeBadgeTier: String, Equatable, Sendable {
    case gold
    case silver
}

public struct ChallengeRule: Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let detail: String
    public let destinationURL: URL?

    public init(id: String, title: String, detail: String, destinationURL: URL? = nil) {
        self.id = id
        self.title = title
        self.detail = detail
        self.destinationURL = destinationURL
    }
}

public struct PhotoChallengeDefinition: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let objectName: String
    public let prompt: String
    public let tip: String
    public let collectionChallengeID: String
    public let matchingKinds: [String]
    public let targetKeywords: [String]
    public let window: ChallengeWindow
    public let multiplayer: Bool
    public let rules: [ChallengeRule]

    public init(
        id: String,
        name: String,
        objectName: String,
        prompt: String,
        tip: String,
        collectionChallengeID: String,
        matchingKinds: [String],
        targetKeywords: [String] = [],
        window: ChallengeWindow,
        multiplayer: Bool = true,
        rules: [ChallengeRule]
    ) {
        self.id = id
        self.name = name
        self.objectName = objectName
        self.prompt = prompt
        self.tip = tip
        self.collectionChallengeID = collectionChallengeID
        self.matchingKinds = matchingKinds
        self.targetKeywords = targetKeywords
        self.window = window
        self.multiplayer = multiplayer
        self.rules = rules
    }

    public func matches(eventKind: String, target: String) -> Bool {
        guard matchingKinds.contains(eventKind) else { return false }
        guard !targetKeywords.isEmpty else { return true }
        let normalized = target.lowercased()
        return targetKeywords.contains { normalized.contains($0.lowercased()) }
    }

    public func badgeTier(for completionDate: Date) -> ChallengeBadgeTier? {
        if window.contains(completionDate) { return .gold }
        if completionDate > window.end { return .silver }
        return nil
    }
}

public enum PhotoChallengeCatalog {
    private static func utc(_ text: String) -> Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: text)!
    }

    public static let definitions: [PhotoChallengeDefinition] = [
        PhotoChallengeDefinition(
            id: "asv-129-wsw-saturn-sky-photo",
            name: "World Space Week: Saturn sky photo",
            objectName: "Saturn",
            prompt: "Share a sky photo taken while you were observing Saturn, even if Saturn itself is faint in the frame.",
            tip: "Include date, direction, and what helped you identify Saturn.",
            collectionChallengeID: "planet-hunt",
            matchingKinds: ["planet_event", "conjunction"],
            targetKeywords: ["saturn"],
            window: ChallengeWindow(
                start: utc("2026-10-04T00:00:00Z"),
                end: utc("2026-10-10T23:59:59Z"),
                peak: utc("2026-10-07T21:00:00Z")
            ),
            rules: [
                ChallengeRule(id: "saturn-photo", title: "Upload one observing photo", detail: "One accepted upload counts one shared Saturn event contribution."),
                ChallengeRule(id: "saturn-badge-window", title: "Badge tier", detail: "Gold when completed during the event window, silver after the window.")
            ]
        ),
        PhotoChallengeDefinition(
            id: "wsw-draconids-watch",
            name: "World Space Week: Draconids watch",
            objectName: "Meteor shower",
            prompt: "Log a wide-sky frame from your Draconids watch session.",
            tip: "Add where you looked, approximate watch duration, and sky conditions.",
            collectionChallengeID: "meteor-watch",
            matchingKinds: ["meteor_shower"],
            targetKeywords: ["draconids"],
            window: ChallengeWindow(
                start: utc("2026-10-08T00:00:00Z"),
                end: utc("2026-10-09T23:59:59Z"),
                peak: utc("2026-10-08T21:00:00Z")
            ),
            rules: [
                ChallengeRule(id: "draconids-log", title: "Save one meteor-watch submission", detail: "Progress is earned from a saved submission, not from opening the challenge page."),
                ChallengeRule(id: "draconids-badge-window", title: "Badge tier", detail: "Gold during the window, silver after.")
            ]
        ),
        PhotoChallengeDefinition(
            id: "wsw-m31-dark-sky",
            name: "World Space Week: M31 and New Moon dark-sky run",
            objectName: "Andromeda Galaxy",
            prompt: "Submit an observing frame from your M31 or New Moon dark-sky session.",
            tip: "Tell us if this was naked-eye, binocular, or telescope-assisted.",
            collectionChallengeID: "moon-context",
            matchingKinds: ["moon_phase", "deep_sky"],
            targetKeywords: ["new_moon", "m31", "andromeda"],
            window: ChallengeWindow(
                start: utc("2026-10-10T00:00:00Z"),
                end: utc("2026-10-10T23:59:59Z"),
                peak: utc("2026-10-10T19:00:00Z")
            ),
            rules: [
                ChallengeRule(id: "m31-log", title: "Save one dark-sky submission", detail: "A successful submission marks completion for this challenge."),
                ChallengeRule(id: "m31-badge-window", title: "Badge tier", detail: "Gold during the event day, silver after.")
            ]
        ),
        PhotoChallengeDefinition(
            id: "wsw-saturn-telescope-tasks",
            name: "Saturn telescope tasks",
            objectName: "Saturn",
            prompt: "Capture and report telescope observations tied to Saturn campaign tasks.",
            tip: "Use one submission per task run so each contribution can be tracked.",
            collectionChallengeID: "planet-hunt",
            matchingKinds: ["planet_event"],
            targetKeywords: ["saturn"],
            window: ChallengeWindow(
                start: utc("2026-10-04T00:00:00Z"),
                end: utc("2027-11-06T23:59:59Z")
            ),
            rules: [
                ChallengeRule(id: "saturn-pvol", title: "Upload Saturn ring/disc imaging", detail: "Submit to PVOL / ALPO / BAA and log the Atlas submission."),
                ChallengeRule(id: "saturn-detect", title: "Run DeTeCt on Saturn or Jupiter videos", detail: "Record the run result and include notes in caption.", destinationURL: URL(string: "http://www.astrosurf.com/planetessaf/doc/project_detect.php")),
                ChallengeRule(id: "saturn-occultations", title: "Track 2027 occultation opportunities", detail: "Use event windows and report when observation windows are active.")
            ]
        ),
        PhotoChallengeDefinition(
            id: "asv-130-orionids-2026",
            name: "ASV-130 Orionids challenge",
            objectName: "Meteor shower",
            prompt: "Log Orionids watch sessions around the peak nights (21-22 Oct) and share your best frame.",
            tip: "Wide-angle shots are expected; seeing a meteor in-frame is optional on 21-22 Oct peak nights.",
            collectionChallengeID: "meteor-watch",
            matchingKinds: ["meteor_shower"],
            targetKeywords: ["orionids"],
            window: ChallengeWindow(
                start: utc("2026-10-18T00:00:00Z"),
                end: utc("2026-10-24T23:59:59Z"),
                peak: utc("2026-10-21T22:00:00Z")
            ),
            rules: [
                ChallengeRule(id: "orionids-submit", title: "Save an Orionids submission", detail: "Saved challenge submissions drive completion and multiplayer totals."),
                ChallengeRule(id: "orionids-badge-window", title: "Badge tier", detail: "Gold during active Orionids window (peak 21-22 Oct), silver after.")
            ]
        )
    ]
}

public protocol ChallengeCreditStateStore: Sendable {
    func load() async throws -> Set<String>
    func save(_ keys: Set<String>) async throws
}

public actor InMemoryChallengeCreditStore: ChallengeCreditStateStore {
    private var keys: Set<String>

    public init(keys: Set<String> = []) {
        self.keys = keys
    }

    public func load() async throws -> Set<String> { keys }
    public func save(_ keys: Set<String>) async throws { self.keys = keys }
}

public actor ChallengeCreditGate {
    private let store: ChallengeCreditStateStore
    private var loaded = false
    private var keys = Set<String>()

    public init(store: ChallengeCreditStateStore) {
        self.store = store
    }

    /// Returns true only once per key, across restarts, when backed by persistent storage.
    public func claimOnce(key: String) async throws -> Bool {
        if !loaded {
            keys = try await store.load()
            loaded = true
        }
        if keys.contains(key) { return false }
        keys.insert(key)
        try await store.save(keys)
        return true
    }
}

public func saturnSharedEventCreditKey(userID: String, sourceID: String) -> String {
    "saturn-shared-event:\(userID):\(sourceID)"
}
