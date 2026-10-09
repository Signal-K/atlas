import AtlasCore
import Foundation
import SwiftUI
import UIKit

@MainActor
final class CaptureViewModel: ObservableObject {
    @Published var note = ""
    @Published var targetName = ""
    @Published var selectedImage: UIImage?
    @Published var exif: PhotoEXIFMetadata?
    @Published var manualDate = Date()
    @Published var manualLatitude = ""
    @Published var manualLongitude = ""
    @Published var attachPhotoIDResult = true
    @Published var photoIDResult: SkyPhotoIDResult?
    @Published var uploadPhase: CaptureUploadPhase?
    @Published var uploadError: String?
    @Published var queuedCount = 0
    @Published var isBusy = false

    private let session: SessionStore
    private let service: CaptureUploadService
    private var preparedJPEGData: Data?

    init(session: SessionStore) {
        self.session = session
        let queueURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first?
            .appending(path: "capture-upload-queue.json")
            ?? URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("capture-upload-queue.json")
        self.service = CaptureUploadService(baseURL: Config.pocketBaseURL, mediaURL: Config.mediaURL, queueStoreURL: queueURL)
    }

    func onAppear() {
        Task {
            await refreshQueueCount()
            await retryPendingUploads()
        }
    }

    func ingestSelectedImage(_ image: UIImage, originalData: Data?) {
        selectedImage = image
        photoIDResult = nil
        uploadError = nil

        let prepared = optimizedJPEG(from: image)
        preparedJPEGData = prepared ?? originalData

        if let parsed = preparedJPEGData.map(PhotoEXIFParser.extract(from:)) {
            exif = parsed
            if let date = parsed.dateTaken { manualDate = date }
            if let lat = parsed.latitude { manualLatitude = String(format: "%.6f", lat) }
            if let lon = parsed.longitude { manualLongitude = String(format: "%.6f", lon) }
        } else {
            exif = nil
        }
    }

    func clearSelection() {
        selectedImage = nil
        preparedJPEGData = nil
        exif = nil
        photoIDResult = nil
    }

    func identifyPhotoSky() {
        guard let latitude = resolvedLatitude, let longitude = resolvedLongitude else {
            uploadError = "Add latitude and longitude to run photo ID."
            return
        }
        let date = exif?.dateTaken ?? manualDate
        let result = SkyPhotoIdentifier.identify(.init(
            date: date,
            latitude: latitude,
            longitude: longitude,
            headingDeg: exif?.headingDeg
        ))
        photoIDResult = result
        uploadError = nil
    }

    func submitCapture() async {
        guard let userID = session.userID else {
            uploadError = "Sign in to upload photos."
            return
        }
        guard let photoData = preparedJPEGData else {
            uploadError = "Choose a photo first."
            return
        }
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedNote.isEmpty else {
            uploadError = "Add a short session note."
            return
        }
        isBusy = true
        uploadError = nil
        let conditionSummary = attachPhotoIDResult ? photoIDResult?.summary : nil
        let payload = ObservationUploadPayload(
            userID: userID,
            observedAtISO8601: (exif?.dateTaken ?? manualDate).formatted(.iso8601),
            note: trimmedNote,
            targetName: targetName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : targetName.trimmingCharacters(in: .whitespacesAndNewlines),
            conditionSummary: conditionSummary,
            cameraLabel: exif?.cameraLabel,
            challengeID: nil,
            photoData: photoData,
            photoContentType: "image/jpeg"
        )

        do {
            let queueID = try await service.enqueue(payload)
            uploadPhase = .queued
            await refreshQueueCount()
            try await service.processQueue(authProvider: { [weak self] in
                guard let self,
                      let token = self.session.bearerToken,
                      let userID = self.session.userID
                else { return nil }
                return CaptureAuthContext(userID: userID, token: token)
            }, onEvent: { [weak self] event in
                await MainActor.run {
                    self?.handleUploadEvent(event, focusedQueueID: queueID)
                }
            })
            note = ""
            targetName = ""
            clearSelection()
        } catch {
            uploadError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        isBusy = false
        await refreshQueueCount()
    }

    func retryPendingUploads() async {
        do {
            _ = try await service.processQueue(authProvider: { [weak self] in
                guard let self,
                      let token = self.session.bearerToken,
                      let userID = self.session.userID
                else { return nil }
                return CaptureAuthContext(userID: userID, token: token)
            }, onEvent: { [weak self] event in
                await MainActor.run {
                    self?.handleUploadEvent(event, focusedQueueID: nil)
                }
            })
        } catch {
            uploadError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        await refreshQueueCount()
    }

    private func refreshQueueCount() async {
        let count = (try? await service.pendingItems().count) ?? 0
        await MainActor.run { queuedCount = count }
    }

    private func handleUploadEvent(_ event: CaptureUploadEvent, focusedQueueID: String?) {
        if let focusedQueueID, event.queueID != focusedQueueID { return }
        switch event.phase {
        case .queued:
            uploadPhase = .queued
        case .creatingObservation:
            uploadPhase = .creatingObservation
        case .uploadingPhoto:
            uploadPhase = .uploadingPhoto
        case .finalizing:
            uploadPhase = .finalizing
        case .succeeded(let remoteID):
            if !remoteID.isEmpty {
                uploadPhase = .succeeded(remoteID: remoteID)
            }
        case .failed(let message):
            uploadPhase = .failed(message: message)
            uploadError = message
        }
    }

    var uploadStatusLabel: String {
        switch uploadPhase {
        case .queued:
            return "Queued for upload."
        case .creatingObservation:
            return "Saving observation…"
        case .uploadingPhoto:
            return "Uploading photo…"
        case .finalizing:
            return "Finalizing upload…"
        case .succeeded:
            return "Uploaded."
        case .failed(let message):
            return message
        case .none:
            return queuedCount > 0 ? "\(queuedCount) pending upload(s)." : ""
        }
    }

    private var resolvedLatitude: Double? {
        if let text = Double(manualLatitude) { return text }
        return exif?.latitude
    }

    private var resolvedLongitude: Double? {
        if let text = Double(manualLongitude) { return text }
        return exif?.longitude
    }

    private func optimizedJPEG(from image: UIImage) -> Data? {
        let maxEdge: CGFloat = 4096
        let size = image.size
        let largest = max(size.width, size.height)
        let scale = largest > maxEdge ? maxEdge / largest : 1
        let targetSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let rendered = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return rendered.jpegData(compressionQuality: 0.92)
    }
}
