import Foundation

public struct PocketBaseRecord: Decodable, Sendable {
    public let id: String
    public let fields: [String: JSONValue]

    public init(from decoder: Decoder) throws {
        let all = try [String: JSONValue](from: decoder)
        guard case .string(let id)? = all["id"] else {
            throw DecodingError.keyNotFound(
                AnyKey("id"), .init(codingPath: [], debugDescription: "record has no id"))
        }
        self.id = id
        self.fields = all
    }
}

public struct PocketBaseList: Decodable, Sendable {
    public let page: Int
    public let perPage: Int
    public let totalItems: Int
    public let items: [PocketBaseRecord]
}

public enum PocketBaseError: Error, Equatable {
    case http(status: Int)
    case invalidURL
}

/// Minimal PocketBase REST client. Base URL comes from config (the web app uses
/// VITE_PB_URL); never point local tooling at a deployed instance.
public final class PocketBaseClient: @unchecked Sendable {
    public let baseURL: URL
    private let session: URLSession
    private let lock = NSLock()
    private var _token: String?

    public var token: String? {
        get { lock.withLock { _token } }
        set { lock.withLock { _token = newValue } }
    }

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func request(path: String, query: [URLQueryItem] = [], method: String = "GET", body: Data? = nil) throws -> URLRequest {
        guard var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        else { throw PocketBaseError.invalidURL }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw PocketBaseError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.httpBody = body
        if body != nil { req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let token { req.setValue(token, forHTTPHeaderField: "Authorization") }
        return req
    }

    private func send<T: Decodable>(_ req: URLRequest, as type: T.Type) async throws -> T {
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw PocketBaseError.http(status: http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    public func list(collection: String, page: Int = 1, perPage: Int = 30, filter: String? = nil, sort: String? = nil) async throws -> PocketBaseList {
        var query = [URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "perPage", value: String(perPage))]
        if let filter { query.append(URLQueryItem(name: "filter", value: filter)) }
        if let sort { query.append(URLQueryItem(name: "sort", value: sort)) }
        return try await send(try request(path: "api/collections/\(collection)/records", query: query), as: PocketBaseList.self)
    }

    public func get(collection: String, id: String) async throws -> PocketBaseRecord {
        try await send(try request(path: "api/collections/\(collection)/records/\(id)"), as: PocketBaseRecord.self)
    }

    struct AuthResponse: Decodable { let token: String; let record: PocketBaseRecord }

    /// Password auth against an auth collection; stores the returned token.
    @discardableResult
    public func authWithPassword(collection: String = "users", identity: String, password: String) async throws -> PocketBaseRecord {
        let body = try JSONEncoder().encode(["identity": identity, "password": password])
        let res = try await send(
            try request(path: "api/collections/\(collection)/auth-with-password", method: "POST", body: body),
            as: AuthResponse.self)
        token = res.token
        return res.record
    }

    /// Creates an account, then signs in with it (PocketBase create does not return a token).
    @discardableResult
    public func register(collection: String = "users", email: String, password: String) async throws -> PocketBaseRecord {
        let body = try JSONEncoder().encode(["email": email, "password": password, "passwordConfirm": password])
        _ = try await send(try request(path: "api/collections/\(collection)/records", method: "POST", body: body), as: PocketBaseRecord.self)
        return try await authWithPassword(collection: collection, identity: email, password: password)
    }

    /// Exchanges a stored token for a fresh one; throws `.http(401)` when it is no longer valid.
    @discardableResult
    public func authRefresh(collection: String = "users") async throws -> PocketBaseRecord {
        let res = try await send(try request(path: "api/collections/\(collection)/auth-refresh", method: "POST"), as: AuthResponse.self)
        token = res.token
        return res.record
    }
}
