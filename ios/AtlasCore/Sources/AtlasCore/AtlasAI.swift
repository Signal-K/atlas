import Foundation

/// Shared caller for the PocketBase Claude hooks (`/atlas/ask`,
/// `/atlas/observations/caption`, `/atlas/events/eclipse-roadmap`).
/// The Anthropic key stays on the server. These routes answer 400 with
/// "not enabled" when `ANTHROPIC_API_KEY` is unset on that deployment.
public struct AtlasAIClient: Sendable {
    public let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func ask(question: String, context: String?, token: String) async throws -> String {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw AskAtlasError.invalidQuestion }
        guard !token.isEmpty else { throw AskAtlasError.unauthorized }

        let body = try JSONEncoder().encode(AskAtlasRequest(question: trimmed, context: context))
        let data = try await post(path: "atlas/ask", token: token, body: body)
        let decoded = try decode(AskAtlasResponse.self, from: data)
        let answer = decoded.answer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !answer.isEmpty else { throw AskAtlasError.emptyResponse }
        return answer
    }

    /// Best-effort Sky Pass caption. Callers should ignore failures: a deployment
    /// without `ANTHROPIC_API_KEY` rejects the route, and the photo upload itself
    /// has already succeeded.
    public func photoCaption(
        jpeg: Data,
        targetName: String?,
        conditionSummary: String?,
        observationID: String?,
        token: String
    ) async throws -> String {
        guard !token.isEmpty else { throw AskAtlasError.unauthorized }
        // The hook rejects base64 longer than 8_000_000 characters.
        guard jpeg.count > 0, jpeg.count < 5_500_000 else { throw AskAtlasError.unavailable }
        let payload = PhotoCaptionRequest(
            photoBase64: jpeg.base64EncodedString(),
            mimeType: "image/jpeg",
            targetName: targetName,
            conditionSummary: conditionSummary,
            observationId: observationID
        )
        let data = try await post(path: "atlas/observations/caption", token: token, body: try JSONEncoder().encode(payload))
        let decoded = try decode(PhotoCaptionResponse.self, from: data)
        let caption = decoded.caption.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !caption.isEmpty else { throw AskAtlasError.emptyResponse }
        return caption
    }

    public func eclipseRoadmap(
        title: String,
        locationName: String,
        latitude: Double,
        longitude: Double,
        timeZoneID: String?,
        token: String
    ) async throws -> String {
        guard !token.isEmpty else { throw AskAtlasError.unauthorized }
        let payload = EclipseRoadmapRequest(
            title: title,
            locationName: locationName,
            lat: latitude,
            lon: longitude,
            timeZone: timeZoneID,
            guideSteps: []
        )
        let data = try await post(path: "atlas/events/eclipse-roadmap", token: token, body: try JSONEncoder().encode(payload))
        let decoded = try decode(EclipseRoadmapResponse.self, from: data)
        let roadmap = decoded.roadmap.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !roadmap.isEmpty else { throw AskAtlasError.emptyResponse }
        return roadmap
    }

    /// `appending(path:)` keeps `/` as a separator. `appendingPathComponent` treats
    /// the string as one component and percent-encodes the slash, so the hook at
    /// `/atlas/ask` is never reached.
    public static func endpoint(baseURL: URL, path: String) -> URL {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return baseURL.appending(path: trimmed)
    }

    private func post(path: String, token: String, body: Data) async throws -> Data {
        var request = URLRequest(url: Self.endpoint(baseURL: baseURL, path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(token, forHTTPHeaderField: "Authorization")
        request.httpBody = body

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw AskAtlasError.offline
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            let message = (try? JSONDecoder().decode(PocketBaseAPIError.self, from: data))?.message
            throw AskAtlasError.fromHTTP(status: status, message: message)
        }
        return data
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw AskAtlasError.unavailable
        }
    }
}

private struct PhotoCaptionRequest: Encodable {
    let photoBase64: String
    let mimeType: String
    let targetName: String?
    let conditionSummary: String?
    let observationId: String?
}

private struct PhotoCaptionResponse: Decodable {
    let caption: String
}

private struct EclipseRoadmapRequest: Encodable {
    let title: String
    let locationName: String
    let lat: Double
    let lon: Double
    let timeZone: String?
    let guideSteps: [String]
}

private struct EclipseRoadmapResponse: Decodable {
    let roadmap: String
}

struct PocketBaseAPIError: Decodable {
    let message: String?
}
