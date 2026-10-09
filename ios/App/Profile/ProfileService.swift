import AtlasCore
import Foundation

struct ProfileSnapshot: Sendable {
    let userID: String
    let email: String
    let name: String
    let handle: String
    let avatarURL: URL?
    let entitled: Bool
    let totalXP: Int
    let level: Int
    let pointsToNextLevel: Int
    let badges: [AtlasBadge]
    let equipmentItems: [String]
    let journalCount: Int
    let photoCount: Int
}

enum ProfileServiceError: Error, LocalizedError {
    case unauthorized
    case invalidImage
    case failed(status: Int)
    case offline

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            "Sign in again to manage this account."
        case .invalidImage:
            "Could not read this image."
        case .failed:
            "Could not save your profile right now."
        case .offline:
            "Can't reach Atlas right now. Check your connection."
        }
    }
}

protocol ProfileService {
    func loadSnapshot(userID: String, email: String, entitled: Bool, token: String?) async throws -> ProfileSnapshot
    func updateProfile(userID: String, token: String, name: String, handle: String) async throws
    func uploadAvatar(userID: String, token: String, imageData: Data, fileName: String, mimeType: String) async throws
}

struct LiveProfileService: ProfileService {
    private let client: PocketBaseClient
    private let session: URLSession

    init(client: PocketBaseClient, session: URLSession = .shared) {
        self.client = client
        self.session = session
    }

    func loadSnapshot(userID: String, email: String, entitled: Bool, token: String?) async throws -> ProfileSnapshot {
        client.token = token
        let user = try await client.get(collection: "users", id: userID)
        let xpRows = try await loadXPEntries(userID: userID)
        let progress = AtlasProgress.summarize(entries: xpRows, firstTourBadge: user.fields["first_tour_badge"]?.stringValue)

        async let journalCount = count(collection: "atlas_observations", filter: "user = \"\(userID)\"")
        async let photoCount = count(collection: "atlas_observations", filter: "user = \"\(userID)\" && photo_r2_key != \"\"")
        async let equipment = loadEquipment(userID: userID, userRecord: user)

        let resolvedName = nonEmpty(user.fields["name"]?.stringValue)
            ?? nonEmpty(user.fields["username"]?.stringValue)
            ?? email.split(separator: "@").first.map(String.init)
            ?? "Atlas observer"
        let resolvedHandle = nonEmpty(user.fields["username"]?.stringValue) ?? "observer"

        return ProfileSnapshot(
            userID: userID,
            email: email,
            name: resolvedName,
            handle: resolvedHandle,
            avatarURL: avatarURL(from: user),
            entitled: entitled,
            totalXP: progress.totalPoints,
            level: progress.level.level,
            pointsToNextLevel: progress.level.pointsToNextLevel,
            badges: progress.badges,
            equipmentItems: await equipment,
            journalCount: await journalCount,
            photoCount: await photoCount)
    }

    func updateProfile(userID: String, token: String, name: String, handle: String) async throws {
        guard !token.isEmpty else { throw ProfileServiceError.unauthorized }
        let payload: [String: String] = [
            "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
            "username": handle.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
        _ = try await sendJSONUpdate(userID: userID, token: token, payload: payload)
    }

    func uploadAvatar(userID: String, token: String, imageData: Data, fileName: String, mimeType: String) async throws {
        guard !token.isEmpty else { throw ProfileServiceError.unauthorized }
        guard !imageData.isEmpty else { throw ProfileServiceError.invalidImage }

        let boundary = "atlas-\(UUID().uuidString)"
        var body = Data()
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"avatar\"; filename=\"\(fileName)\"\r\n")
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(imageData)
        body.appendString("\r\n--\(boundary)--\r\n")

        var request = URLRequest(url: userRecordURL(userID: userID))
        request.httpMethod = "PATCH"
        request.setValue(token, forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        do {
            let (_, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200 ..< 300).contains(status) else {
                if status == 401 || status == 403 { throw ProfileServiceError.unauthorized }
                throw ProfileServiceError.failed(status: status)
            }
        } catch let profileError as ProfileServiceError {
            throw profileError
        } catch {
            throw ProfileServiceError.offline
        }
    }

    // MARK: Helpers

    private func count(collection: String, filter: String) async -> Int {
        do {
            let page = try await client.list(collection: collection, page: 1, perPage: 1, filter: filter)
            return page.totalItems
        } catch {
            return 0
        }
    }

    private func loadXPEntries(userID: String) async throws -> [AtlasXPEntry] {
        let rows = try await listAll(collection: "atlas_xp_ledger", filter: "user = \"\(userID)\"")
        return rows.compactMap { row in
            guard let action = row.fields["action"]?.stringValue,
                  let sourceID = row.fields["source_id"]?.stringValue,
                  let skill = row.fields["skill"]?.stringValue
            else { return nil }
            let points = Int((row.fields["points"]?.doubleValue ?? 0).rounded())
            return AtlasXPEntry(action: action, sourceID: sourceID, skill: skill, points: points)
        }
    }

    private func loadEquipment(userID: String, userRecord: PocketBaseRecord) async -> [String] {
        var entries = [String]()

        if let instruments = userRecord.fields["viewing_instruments"]?.stringArrayValue {
            entries.append(contentsOf: instruments.map(labelForEquipment))
        }
        if let devices = userRecord.fields["device_models"]?.stringArrayValue {
            entries.append(contentsOf: devices.map(labelForEquipment))
        }
        if entries.isEmpty {
            do {
                let plans = try await client.list(collection: "atlas_trip_plans", page: 1, perPage: 1, filter: "user = \"\(userID)\"", sort: "-updated")
                if let first = plans.items.first,
                   let raw = first.fields["equipment_json"]?.stringValue,
                   let data = raw.data(using: .utf8),
                   let decoded = try? JSONDecoder().decode([String].self, from: data)
                {
                    entries.append(contentsOf: decoded.map(labelForEquipment))
                }
            } catch {}
        }

        let deduped = Array(Set(entries)).sorted()
        return deduped
    }

    private func listAll(collection: String, filter: String) async throws -> [PocketBaseRecord] {
        var page = 1
        var all: [PocketBaseRecord] = []
        while true {
            let response = try await client.list(collection: collection, page: page, perPage: 100, filter: filter)
            all.append(contentsOf: response.items)
            let loaded = page * response.perPage
            if loaded >= response.totalItems { break }
            page += 1
        }
        return all
    }

    private func sendJSONUpdate(userID: String, token: String, payload: [String: String]) async throws -> PocketBaseRecord {
        var request = URLRequest(url: userRecordURL(userID: userID))
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(token, forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200 ..< 300).contains(status) else {
                if status == 401 || status == 403 { throw ProfileServiceError.unauthorized }
                throw ProfileServiceError.failed(status: status)
            }
            return try JSONDecoder().decode(PocketBaseRecord.self, from: data)
        } catch let profileError as ProfileServiceError {
            throw profileError
        } catch {
            throw ProfileServiceError.offline
        }
    }

    private func userRecordURL(userID: String) -> URL {
        client.baseURL.appendingPathComponent("api/collections/users/records/\(userID)")
    }

    private func avatarURL(from record: PocketBaseRecord) -> URL? {
        guard let avatarName = nonEmpty(record.fields["avatar"]?.stringValue) else { return nil }
        return client.baseURL.appendingPathComponent("api/files/users/\(record.id)/\(avatarName)")
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
        return trimmed
    }

    private func labelForEquipment(_ raw: String) -> String {
        switch raw {
        case "naked_eye": return "Naked eye"
        case "binoculars": return "Binoculars"
        case "telescope": return "Telescope"
        default:
            return raw
                .replacingOccurrences(of: "_", with: " ")
                .replacingOccurrences(of: "-", with: " ")
                .split(separator: " ")
                .map { $0.capitalized }
                .joined(separator: " ")
        }
    }
}

private extension JSONValue {
    var stringArrayValue: [String]? {
        guard case .array(let values) = self else { return nil }
        return values.compactMap(\.stringValue)
    }
}

private extension Data {
    mutating func appendString(_ value: String) {
        append(Data(value.utf8))
    }
}
