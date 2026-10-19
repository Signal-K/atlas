import Foundation

public enum SkyPassBackendError: Error, Equatable, Sendable {
    /// The transaction is signed for a different Atlas account (HTTP 403).
    case accountMismatch
    /// Atlas rejected the session or the purchase, or could not be reached.
    case failed(status: Int?)
}

/// Hands a StoreKit signed transaction to atlas-billing, which verifies it against Apple's
/// certificate chain and flips `entitled` on the shared Atlas account.
public protocol SkyPassBackend: Sendable {
    /// Returns whether the account is now entitled.
    func verify(signedTransaction: String, bearerToken: String) async throws -> Bool
}

public struct LiveSkyPassBackend: SkyPassBackend {
    public let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func request(signedTransaction: String, bearerToken: String) throws -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent("entitlement/apple/verify"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // atlas-billing, unlike PocketBase itself, requires the "Bearer " scheme.
        req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(["signedTransaction": signedTransaction])
        return req
    }

    public func verify(signedTransaction: String, bearerToken: String) async throws -> Bool {
        let req = try request(signedTransaction: signedTransaction, bearerToken: bearerToken)
        let data: Data, response: URLResponse
        do { (data, response) = try await session.data(for: req) } catch { throw SkyPassBackendError.failed(status: nil) }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 403 { throw SkyPassBackendError.accountMismatch }
        guard (200..<300).contains(status) else { throw SkyPassBackendError.failed(status: status) }
        struct Reply: Decodable { let entitled: Bool }
        return (try? JSONDecoder().decode(Reply.self, from: data))?.entitled ?? false
    }
}
