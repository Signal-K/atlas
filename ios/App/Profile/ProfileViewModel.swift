import Foundation
import Observation
import AtlasCore
import PhotosUI
import SwiftUI

@Observable @MainActor
final class ProfileViewModel {
    private let service: ProfileService

    private(set) var snapshot: ProfileSnapshot?
    private(set) var isLoading = false
    private(set) var isSaving = false
    private(set) var isUploadingAvatar = false
    private(set) var activeUserID: String?
    private(set) var errorText: String?
    private(set) var successText: String?

    init(service: ProfileService) {
        self.service = service
    }

    func activate(session: SessionStore) async {
        guard activeUserID != session.userID else { return }
        activeUserID = session.userID
        snapshot = nil
        errorText = nil
        successText = nil
        guard session.userID != nil else { return }
        await reload(session: session)
    }

    func reload(session: SessionStore) async {
        guard let userID = session.userID, let email = session.email else { return }
        isLoading = true
        errorText = nil
        defer { isLoading = false }
        do {
            snapshot = try await service.loadSnapshot(
                userID: userID,
                email: email,
                entitled: session.isEntitled,
                token: session.bearerToken)
        } catch {
            errorText = error.localizedDescription
        }
    }

    func saveProfile(session: SessionStore, name: String, handle: String) async {
        guard let userID = session.userID, let token = session.bearerToken else {
            errorText = ProfileServiceError.unauthorized.localizedDescription
            return
        }
        isSaving = true
        errorText = nil
        successText = nil
        defer { isSaving = false }
        do {
            try await service.updateProfile(userID: userID, token: token, name: name, handle: handle)
            successText = "Profile updated."
            await reload(session: session)
        } catch {
            errorText = error.localizedDescription
        }
    }

    func uploadAvatar(_ item: PhotosPickerItem, session: SessionStore) async {
        guard let userID = session.userID, let token = session.bearerToken else {
            errorText = ProfileServiceError.unauthorized.localizedDescription
            return
        }
        isUploadingAvatar = true
        errorText = nil
        successText = nil
        defer { isUploadingAvatar = false }

        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw ProfileServiceError.invalidImage
            }
            try await service.uploadAvatar(
                userID: userID,
                token: token,
                imageData: data,
                fileName: "avatar-\(UUID().uuidString).jpg",
                mimeType: "application/octet-stream")
            successText = "Avatar updated."
            await reload(session: session)
        } catch {
            errorText = error.localizedDescription
        }
    }
}
