import AtlasCore
import Foundation

struct ChallengeEvent: Equatable, Sendable, Identifiable {
    let id: String
    let kind: String
    let target: String
    let title: String
    let startsAt: Date
    let endsAt: Date
}

struct ChallengeSubmission: Equatable, Sendable, Identifiable {
    let id: String
    let eventID: String
    let challengeID: String
    let caption: String
    let approved: Bool
    let createdAt: Date
    let userID: String
    let isMine: Bool
}

struct ActivePhotoChallenge: Equatable, Sendable, Identifiable {
    let event: ChallengeEvent
    let definition: PhotoChallengeDefinition
    let submissions: [ChallengeSubmission]

    var id: String { "\(event.id):\(definition.id)" }

    var collectiveTotal: Int {
        submissions.filter { $0.approved || $0.isMine }.count
    }

    var myContribution: Int {
        submissions.filter(\.isMine).count
    }

    var badgeTier: ChallengeBadgeTier? {
        guard let completion = submissions.filter(\.isMine).map(\.createdAt).sorted().first else { return nil }
        return definition.badgeTier(for: completion)
    }

    var leaderboard: [(userID: String, submissions: Int)] {
        let counts = submissions
            .filter { $0.approved || $0.isMine }
            .reduce(into: [String: Int]()) { partial, submission in
                partial[submission.userID, default: 0] += 1
            }
        return counts
            .map { ($0.key, $0.value) }
            .sorted { lhs, rhs in
                if lhs.1 == rhs.1 { return lhs.0 < rhs.0 }
                return lhs.1 > rhs.1
            }
    }
}

actor ChallengeService {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func loadActiveChallenges(userID: String, token: String?) async throws -> [ActivePhotoChallenge] {
        let events = try await loadSkyEvents()
        let submissions = try await loadSubmissions(userID: userID, token: token)
        let now = Date()

        var active: [ActivePhotoChallenge] = []
        var matchedDefinitionIDs = Set<String>()
        for event in events {
            for definition in PhotoChallengeCatalog.definitions where definition.matches(eventKind: event.kind, target: event.target) {
                if event.endsAt < now.addingTimeInterval(-60 * 60 * 24 * 14) { continue }
                let rows = submissions.filter { $0.eventID == event.id && $0.challengeID == definition.collectionChallengeID }
                active.append(ActivePhotoChallenge(event: event, definition: definition, submissions: rows))
                matchedDefinitionIDs.insert(definition.id)
            }
        }

        // Keep challenge cards visible when event ingestion lags, so ASV challenge definitions still
        // appear in-app and can receive submissions within/near their configured windows.
        for definition in PhotoChallengeCatalog.definitions where !matchedDefinitionIDs.contains(definition.id) {
            if definition.window.end < now.addingTimeInterval(-60 * 60 * 24 * 14) { continue }
            let fallbackEvent = ChallengeEvent(
                id: "catalog-\(definition.id)",
                kind: definition.matchingKinds.first ?? "challenge",
                target: definition.objectName,
                title: definition.name,
                startsAt: definition.window.start,
                endsAt: definition.window.end
            )
            let rows = submissions.filter { $0.challengeID == definition.collectionChallengeID }
            active.append(ActivePhotoChallenge(event: fallbackEvent, definition: definition, submissions: rows))
        }

        return active.sorted { lhs, rhs in
            if lhs.event.startsAt == rhs.event.startsAt { return lhs.definition.name < rhs.definition.name }
            return lhs.event.startsAt < rhs.event.startsAt
        }
    }

    func submit(
        challenge: PhotoChallengeDefinition,
        eventID: String,
        caption: String,
        imageData: Data,
        contentType: String,
        auth: CaptureAuthContext
    ) async throws {
        let submissionID = try await createSubmission(
            challengeID: challenge.collectionChallengeID,
            eventID: eventID,
            caption: caption,
            imageData: imageData,
            contentType: contentType,
            auth: auth
        )

        if challenge.id == "asv-129-wsw-saturn-sky-photo" {
            let key = saturnSharedEventCreditKey(userID: auth.userID, sourceID: submissionID)
            try await createSaturnSharedCredit(sourceID: key, auth: auth)
        }
    }

    private func loadSkyEvents() async throws -> [ChallengeEvent] {
        let now = Date()
        let end = now.addingTimeInterval(120 * 86_400)
        let start = now.addingTimeInterval(-10 * 86_400)
        let filter = "starts_at <= \"\(pbDateString(end))\" && ends_at >= \"\(pbDateString(start))\""
        var components = URLComponents(url: baseURL.appending(path: "/api/collections/sky_events/records"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "page", value: "1"),
            URLQueryItem(name: "perPage", value: "200"),
            URLQueryItem(name: "sort", value: "starts_at"),
            URLQueryItem(name: "filter", value: filter),
        ]
        guard let url = components?.url else { throw ChallengeServiceError.invalidResponse }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        let (data, response) = try await session.data(for: request)
        try throwIfNotSuccess(response: response, data: data, fallback: "Failed to load events.")
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = json["items"] as? [[String: Any]]
        else { return [] }

        return items.compactMap { item in
            guard let id = item["id"] as? String,
                  let startsRaw = item["starts_at"] as? String,
                  let endsRaw = item["ends_at"] as? String,
                  let startsAt = parsePbDate(startsRaw),
                  let endsAt = parsePbDate(endsRaw)
            else { return nil }
            return ChallengeEvent(
                id: id,
                kind: item["kind"] as? String ?? "",
                target: item["target"] as? String ?? "",
                title: item["title"] as? String ?? "",
                startsAt: startsAt,
                endsAt: endsAt
            )
        }
    }

    private func loadSubmissions(userID: String, token: String?) async throws -> [ChallengeSubmission] {
        guard let token else { return [] }
        var components = URLComponents(url: baseURL.appending(path: "/api/collections/atlas_photo_challenge_submissions/records"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "page", value: "1"),
            URLQueryItem(name: "perPage", value: "200"),
            URLQueryItem(name: "sort", value: "-created"),
        ]
        guard let url = components?.url else { throw ChallengeServiceError.invalidResponse }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(token, forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        try throwIfNotSuccess(response: response, data: data, fallback: "Failed to load challenge submissions.")
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = json["items"] as? [[String: Any]]
        else { return [] }

        return items.compactMap { item in
            guard let id = item["id"] as? String,
                  let eventID = item["event"] as? String,
                  let challengeID = item["challenge_id"] as? String,
                  let createdRaw = item["created"] as? String,
                  let createdAt = parsePbDate(createdRaw),
                  let owner = item["user"] as? String
            else { return nil }
            return ChallengeSubmission(
                id: id,
                eventID: eventID,
                challengeID: challengeID,
                caption: item["caption"] as? String ?? "",
                approved: item["approved"] as? Bool ?? false,
                createdAt: createdAt,
                userID: owner,
                isMine: owner == userID
            )
        }
    }

    private func createSubmission(
        challengeID: String,
        eventID: String,
        caption: String,
        imageData: Data,
        contentType: String,
        auth: CaptureAuthContext
    ) async throws -> String {
        let url = baseURL.appending(path: "/api/collections/atlas_photo_challenge_submissions/records")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(auth.token, forHTTPHeaderField: "Authorization")
        let boundary = "atlas-challenge-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = multipartBody(boundary: boundary) { body in
            body.addField(name: "user", value: auth.userID)
            body.addField(name: "event", value: eventID)
            body.addField(name: "challenge_id", value: challengeID)
            body.addField(name: "caption", value: caption)
            body.addFile(name: "image", filename: "challenge.jpg", contentType: contentType, data: imageData)
        }

        let (data, response) = try await session.data(for: request)
        try throwIfNotSuccess(response: response, data: data, fallback: "Failed to submit challenge.")
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = object["id"] as? String
        else { throw ChallengeServiceError.invalidResponse }
        return id
    }

    private func createSaturnSharedCredit(sourceID: String, auth: CaptureAuthContext) async throws {
        let url = baseURL.appending(path: "/api/collections/atlas_xp_ledger/records")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(auth.token, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "user": auth.userID,
            "action": "saturn_shared_event_credit",
            "source_id": sourceID,
            "skill": "community",
            "points": 1,
            "event_kind": "planet_event"
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ChallengeServiceError.invalidResponse }
        if (200..<300).contains(http.statusCode) { return }
        if http.statusCode == 400,
           let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           "\(body)".localizedCaseInsensitiveContains("unique") {
            return
        }
        try throwIfNotSuccess(response: response, data: data, fallback: "Failed to record Saturn shared-event credit.")
    }
}

private enum ChallengeServiceError: LocalizedError {
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Atlas returned an unexpected challenge response."
        }
    }
}

private func pbDateString(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date).replacingOccurrences(of: "T", with: " ")
}

private func throwIfNotSuccess(response: URLResponse, data: Data, fallback: String) throws {
    guard let http = response as? HTTPURLResponse else { throw ChallengeServiceError.invalidResponse }
    guard (200..<300).contains(http.statusCode) else {
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let message = object["message"] as? String ?? object["error"] as? String {
            throw NSError(domain: "Atlas", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
        }
        throw NSError(domain: "Atlas", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: fallback])
    }
}

private struct ChallengeMultipartBuilder {
    private(set) var data = Data()
    private let boundary: String

    init(boundary: String) {
        self.boundary = boundary
    }

    mutating func addField(name: String, value: String) {
        data.append("--\(boundary)\r\n".data(using: .utf8)!)
        data.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        data.append("\(value)\r\n".data(using: .utf8)!)
    }

    mutating func addFile(name: String, filename: String, contentType: String, data fileData: Data) {
        data.append("--\(boundary)\r\n".data(using: .utf8)!)
        data.append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        data.append("Content-Type: \(contentType)\r\n\r\n".data(using: .utf8)!)
        data.append(fileData)
        data.append("\r\n".data(using: .utf8)!)
    }

    mutating func close() {
        data.append("--\(boundary)--\r\n".data(using: .utf8)!)
    }
}

private func multipartBody(boundary: String, build: (inout ChallengeMultipartBuilder) -> Void) -> Data {
    var builder = ChallengeMultipartBuilder(boundary: boundary)
    build(&builder)
    builder.close()
    return builder.data
}
