import AtlasCore
import Foundation

struct AuthIdentity: Equatable, Sendable {
    let email: String
    let token: String
}

protocol AuthService: Sendable {
    func signIn(email: String, password: String) async throws -> AuthIdentity
    func register(email: String, password: String) async throws -> AuthIdentity
    /// Validates a stored token; throws `AuthFailure.expired` when it is no longer good.
    func restore(token: String) async throws -> AuthIdentity
}

/// User-facing auth failures. Everything shown on the welcome screen comes through here.
enum AuthFailure: LocalizedError, Equatable {
    case badCredentials, invalidDetails, expired, offline

    var errorDescription: String? {
        switch self {
        case .badCredentials: "That email and password don't match."
        case .invalidDetails: "Use a valid email and a password of at least 8 characters, or sign in if you already have an account."
        case .expired: "Your session ended. Sign in again."
        case .offline: "Can't reach Atlas right now. Check your connection."
        }
    }

    static func map(_ error: Error) -> AuthFailure {
        if let pb = error as? PocketBaseError, case .http(let status) = pb {
            switch status {
            case 400: return .badCredentials
            case 401, 403: return .expired
            default: return .offline
            }
        }
        return .offline
    }
}

struct LiveAuthService: AuthService {
    let client: PocketBaseClient

    func signIn(email: String, password: String) async throws -> AuthIdentity {
        do { return try identity(from: try await client.authWithPassword(identity: email, password: password)) }
        catch { throw AuthFailure.map(error) }
    }

    func register(email: String, password: String) async throws -> AuthIdentity {
        do { return try identity(from: try await client.register(email: email, password: password)) }
        catch let error as PocketBaseError {
            if case .http(400) = error { throw AuthFailure.invalidDetails }
            throw AuthFailure.map(error)
        } catch { throw AuthFailure.map(error) }
    }

    func restore(token: String) async throws -> AuthIdentity {
        client.token = token
        do { return try identity(from: try await client.authRefresh()) }
        catch {
            let failure = AuthFailure.map(error)
            if failure == .expired { client.token = nil }
            throw failure
        }
    }

    private func identity(from record: PocketBaseRecord) throws -> AuthIdentity {
        guard let token = client.token else { throw AuthFailure.expired }
        return AuthIdentity(email: record.fields["email"]?.stringValue ?? "", token: token)
    }
}

/// `-AtlasFixtureAuth`: no backend. Passwords under 8 characters fail validation, "wrong" fails
/// sign-in, and emails containing "taken" can't be registered, so every error path is reachable.
struct FixtureAuthService: AuthService {
    static func fromLaunchArguments(_ args: [String] = ProcessInfo.processInfo.arguments) -> FixtureAuthService? {
        args.contains("-AtlasFixtureAuth") ? FixtureAuthService() : nil
    }

    func signIn(email: String, password: String) async throws -> AuthIdentity {
        try await Task.sleep(for: .milliseconds(700))
        guard password != "wrong" else { throw AuthFailure.badCredentials }
        return AuthIdentity(email: email, token: "fixture")
    }

    func register(email: String, password: String) async throws -> AuthIdentity {
        try await Task.sleep(for: .milliseconds(700))
        guard password.count >= 8, !email.contains("taken") else { throw AuthFailure.invalidDetails }
        return AuthIdentity(email: email, token: "fixture")
    }

    func restore(token: String) async throws -> AuthIdentity { AuthIdentity(email: "stored@atlas.test", token: token) }
}
