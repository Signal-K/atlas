import AtlasCore
import Foundation
import SwiftUI
import UIKit

@MainActor
final class ChallengesViewModel: ObservableObject {
    @Published var challenges: [ActivePhotoChallenge] = []
    @Published var selectedChallengeID: ActivePhotoChallenge.ID?
    @Published var caption = ""
    @Published var selectedImage: UIImage?
    @Published var errorMessage: String?
    @Published var isLoading = false
    @Published var isSubmitting = false

    private let session: SessionStore
    private let service: ChallengeService
    private var selectedImageData: Data?

    init(session: SessionStore) {
        self.session = session
        self.service = ChallengeService(baseURL: Config.pocketBaseURL)
    }

    var selectedChallenge: ActivePhotoChallenge? {
        if let selectedChallengeID {
            return challenges.first { $0.id == selectedChallengeID }
        }
        return challenges.first
    }

    func onAppear() {
        Task { await refresh() }
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await service.loadActiveChallenges(userID: session.userID ?? "", token: session.bearerToken)
            challenges = loaded
            if selectedChallengeID == nil {
                selectedChallengeID = loaded.first?.id
            }
            errorMessage = nil
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func setSelectedImage(_ image: UIImage, originalData: Data?) {
        selectedImage = image
        selectedImageData = optimizedJPEG(from: image) ?? originalData
    }

    func clearSelectedImage() {
        selectedImage = nil
        selectedImageData = nil
    }

    func submitSelectedChallenge() async {
        guard let selected = selectedChallenge else {
            errorMessage = "Choose a challenge first."
            return
        }
        guard let userID = session.userID, let token = session.bearerToken else {
            errorMessage = "Sign in to submit challenge entries."
            return
        }
        guard let imageData = selectedImageData else {
            errorMessage = "Add a photo for this submission."
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await service.submit(
                challenge: selected.definition,
                eventID: selected.event.id,
                caption: caption.trimmingCharacters(in: .whitespacesAndNewlines),
                imageData: imageData,
                contentType: "image/jpeg",
                auth: CaptureAuthContext(userID: userID, token: token)
            )
            caption = ""
            clearSelectedImage()
            await refresh()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
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
