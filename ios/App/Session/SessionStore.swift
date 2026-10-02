import Foundation
import Observation
import SwiftUI

@Observable @MainActor
final class SessionStore {
    enum State: Equatable {
        case launching
        case signedOut
        case guest
        case signedIn(email: String)
    }

    enum Mode: String, CaseIterable { case signIn = "Sign in", register = "Create account" }

    private(set) var state: State = .launching
    /// 0 = still sky, 1 = full hyperspace streaks. Driven around sign-in so the same star field
    /// that frames the welcome screen carries the user into Tonight.
    private(set) var warp: Double = 0

    private let service: AuthService
    private let tokenKey = "pb.token", emailKey = "pb.email"

    init(service: AuthService) { self.service = service }

    var email: String? { if case .signedIn(let e) = state { e } else { nil } }

    /// Resume a stored session. A rejected token returns to the welcome screen; a network failure
    /// keeps the user signed in so Tonight still opens on a plane.
    func restore() async {
        guard state == .launching else { return }
        // `-AtlasGuest`: skip the welcome screen (testing / screenshots).
        if ProcessInfo.processInfo.arguments.contains("-AtlasGuest") { state = .guest; return }
        guard let token = Keychain.read(tokenKey) else { state = .signedOut; return }
        let cachedEmail = Keychain.read(emailKey) ?? ""
        do {
            let id = try await service.restore(token: token)
            persist(id)
            state = .signedIn(email: id.email)
        } catch AuthFailure.expired {
            clearStored()
            state = .signedOut
        } catch {
            state = .signedIn(email: cachedEmail)
        }
    }

    func authenticate(mode: Mode, email: String, password: String) async throws {
        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = mode == .signIn
            ? try await service.signIn(email: address, password: password)
            : try await service.register(email: address, password: password)
        persist(id)
        await enter(.signedIn(email: id.email))
    }

    func continueAsGuest() async { await enter(.guest) }

    func signOut() {
        clearStored()
        state = .signedOut
    }

    /// Accelerate the stars, swap the screen at peak speed, then settle into the new one.
    private func enter(_ next: State) async {
        withAnimation(.easeIn(duration: 0.7)) { warp = 1 }
        try? await Task.sleep(for: .milliseconds(700))
        withAnimation(.smooth(duration: 0.5)) { state = next }
        withAnimation(.easeOut(duration: 1.6)) { warp = 0 }
    }

    private func persist(_ id: AuthIdentity) {
        Keychain.write(id.token, for: tokenKey)
        Keychain.write(id.email, for: emailKey)
    }

    private func clearStored() {
        Keychain.delete(tokenKey)
        Keychain.delete(emailKey)
    }
}
