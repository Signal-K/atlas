import AtlasCore
import Foundation

struct ObservationUploadPayload: Codable, Equatable, Sendable {
    var userID: String
    var observedAtISO8601: String
    var note: String
    var targetName: String?
    var conditionSummary: String?
    var cameraLabel: String?
    var challengeID: String?
    var photoData: Data?
    var photoContentType: String?
}

struct CaptureAuthContext: Sendable {
    let userID: String
    let token: String
}

enum CaptureUploadPhase: Equatable, Sendable {
    case queued
    case creatingObservation
    case uploadingPhoto
    case finalizing
    case succeeded(remoteID: String)
    case failed(message: String)
}

struct CaptureUploadEvent: Sendable {
    let queueID: String
    let phase: CaptureUploadPhase
}

actor CaptureUploadService {
    private let baseURL: URL
    private let mediaURL: URL?
    private let queue: RetryQueue<ObservationUploadPayload>
    private let session: URLSession

    init(baseURL: URL, mediaURL: URL?, queueStoreURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.mediaURL = mediaURL
        self.queue = RetryQueue(store: JSONFileRetryQueueStore(url: queueStoreURL))
        self.session = session
    }

    @discardableResult
    func enqueue(_ payload: ObservationUploadPayload) async throws -> String {
        let queued = try await queue.enqueue(payload)
        return queued.id
    }

    func pendingItems() async throws -> [RetryQueueItem<ObservationUploadPayload>] {
        try await queue.allItems()
    }

    @discardableResult
    func processQueue(
        authProvider: @Sendable () async -> CaptureAuthContext?,
        onEvent: (@Sendable (CaptureUploadEvent) async -> Void)? = nil
    ) async throws -> RetryQueueProcessingReport {
        try await queue.process(onEvent: { event in
            let mapped: CaptureUploadPhase
            switch event.stage {
            case .queued:
                mapped = .queued
            case .processing:
                mapped = .creatingObservation
            case .succeeded:
                mapped = .succeeded(remoteID: "")
            case .failed(let error):
                mapped = .failed(message: error)
            }
            await onEvent?(CaptureUploadEvent(queueID: event.item.id, phase: mapped))
        }, handler: { [baseURL, mediaURL, session] item in
            guard let auth = await authProvider() else { throw UploadError.notSignedIn }
            guard auth.userID == item.payload.userID else { throw UploadError.userMismatch }
            let remoteID = try await Self.createObservation(
                payload: item.payload,
                baseURL: baseURL,
                token: auth.token,
                includePhotoAttachment: mediaURL == nil,
                session: session
            )
            await onEvent?(CaptureUploadEvent(queueID: item.id, phase: .creatingObservation))

            if let photoData = item.payload.photoData, let mediaURL {
                await onEvent?(CaptureUploadEvent(queueID: item.id, phase: .uploadingPhoto))
                let uploaded = try await Self.uploadPhoto(
                    observationID: remoteID,
                    photoData: photoData,
                    contentType: item.payload.photoContentType ?? "image/jpeg",
                    mediaURL: mediaURL,
                    token: auth.token,
                    session: session
                )
                await onEvent?(CaptureUploadEvent(queueID: item.id, phase: .finalizing))
                try await Self.patchObservationMedia(
                    observationID: remoteID,
                    key: uploaded.key,
                    size: uploaded.size,
                    baseURL: baseURL,
                    token: auth.token,
                    session: session
                )
            }

            await onEvent?(CaptureUploadEvent(queueID: item.id, phase: .succeeded(remoteID: remoteID)))
        })
    }

    private static func createObservation(
        payload: ObservationUploadPayload,
        baseURL: URL,
        token: String,
        includePhotoAttachment: Bool,
        session: URLSession
    ) async throws -> String {
        let url = baseURL.appending(path: "/api/collections/atlas_observations/records")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(token, forHTTPHeaderField: "Authorization")

        if includePhotoAttachment, let photoData = payload.photoData {
            let boundary = "atlas-\(UUID().uuidString)"
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            request.httpBody = multipartBody(boundary: boundary) { body in
                body.addField(name: "user", value: payload.userID)
                body.addField(name: "observed_at", value: payload.observedAtISO8601)
                body.addField(name: "note", value: payload.note)
                if let targetName = payload.targetName { body.addField(name: "target_name", value: targetName) }
                if let conditionSummary = payload.conditionSummary { body.addField(name: "condition_summary", value: conditionSummary) }
                if let cameraLabel = payload.cameraLabel { body.addField(name: "device_used", value: cameraLabel) }
                body.addFile(
                    name: "photo",
                    filename: "capture.jpg",
                    contentType: payload.photoContentType ?? "image/jpeg",
                    data: photoData
                )
            }
        } else {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            var body: [String: Any] = [
                "user": payload.userID,
                "observed_at": payload.observedAtISO8601,
                "note": payload.note
            ]
            if let targetName = payload.targetName { body["target_name"] = targetName }
            if let conditionSummary = payload.conditionSummary { body["condition_summary"] = conditionSummary }
            if let cameraLabel = payload.cameraLabel { body["device_used"] = cameraLabel }
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)
        try throwIfNotSuccess(response: response, data: data, fallback: "Observation upload failed.")
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = object["id"] as? String
        else {
            throw UploadError.invalidResponse
        }
        return id
    }

    private struct UploadedPhoto: Sendable {
        let key: String
        let size: Int
    }

    private static func uploadPhoto(
        observationID: String,
        photoData: Data,
        contentType: String,
        mediaURL: URL,
        token: String,
        session: URLSession
    ) async throws -> UploadedPhoto {
        let url = mediaURL.appending(path: "/v1/observations/\(observationID)/photo")
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(token, forHTTPHeaderField: "Authorization")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = photoData
        let (data, response) = try await session.data(for: request)
        try throwIfNotSuccess(response: response, data: data, fallback: "Photo upload failed.")

        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let key = object["key"] as? String
        else {
            throw UploadError.invalidResponse
        }
        let size = (object["size"] as? NSNumber)?.intValue ?? photoData.count
        return UploadedPhoto(key: key, size: size)
    }

    private static func patchObservationMedia(
        observationID: String,
        key: String,
        size: Int,
        baseURL: URL,
        token: String,
        session: URLSession
    ) async throws {
        let url = baseURL.appending(path: "/api/collections/atlas_observations/records/\(observationID)")
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue(token, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["photo_r2_key": key, "photo_r2_size": size])

        let (data, response) = try await session.data(for: request)
        try throwIfNotSuccess(response: response, data: data, fallback: "Failed to save uploaded photo metadata.")
    }

    private static func throwIfNotSuccess(response: URLResponse, data: Data, fallback: String) throws {
        guard let http = response as? HTTPURLResponse else { throw UploadError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message: String
            if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let raw = object["message"] as? String ?? object["error"] as? String {
                message = raw
            } else {
                message = fallback
            }
            throw UploadError.remote(message: message)
        }
    }
}

private enum UploadError: LocalizedError {
    case notSignedIn
    case userMismatch
    case invalidResponse
    case remote(message: String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            return "Sign in to upload photos."
        case .userMismatch:
            return "Queued upload belongs to a different account."
        case .invalidResponse:
            return "Atlas returned an unexpected upload response."
        case .remote(let message):
            return message
        }
    }
}

private struct MultipartBuilder {
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

private func multipartBody(boundary: String, build: (inout MultipartBuilder) -> Void) -> Data {
    var builder = MultipartBuilder(boundary: boundary)
    build(&builder)
    builder.close()
    return builder.data
}
