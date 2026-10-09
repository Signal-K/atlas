import Foundation

public struct AskAtlasRequest: Codable, Equatable, Sendable {
    public let question: String
    public let context: String?

    public init(question: String, context: String?) {
        self.question = question
        self.context = context
    }
}

public struct AskAtlasResponse: Codable, Equatable, Sendable {
    public let answer: String

    public init(answer: String) {
        self.answer = answer
    }
}

public enum AskAtlasError: Error, LocalizedError, Equatable, Sendable {
    case unauthorized
    case notEntitled
    case notEnabled
    case invalidQuestion
    case rateLimited
    case offline
    case unavailable
    case emptyResponse
    case server(status: Int, message: String?)

    public var errorDescription: String? {
        switch self {
        case .unauthorized:
            "Sign in to ask Atlas."
        case .notEntitled:
            "Ask Atlas is a Sky Pass feature."
        case .notEnabled:
            "Ask Atlas is not enabled on this deployment."
        case .invalidQuestion:
            "Type a question before sending."
        case .rateLimited:
            "Too many requests right now. Try again shortly."
        case .offline:
            "Can't reach Atlas right now. Check your connection."
        case .unavailable:
            "Could not get an answer right now."
        case .emptyResponse:
            "Atlas returned an empty response."
        case .server(_, let message):
            message ?? "Could not get an answer right now."
        }
    }

    static func fromHTTP(status: Int, message: String?) -> AskAtlasError {
        switch status {
        case 400:
            let text = message?.lowercased() ?? ""
            if text.contains("sky pass") { return .notEntitled }
            if text.contains("not enabled") { return .notEnabled }
            if text.contains("question is required") { return .invalidQuestion }
            if text.contains("invalid request payload") { return .invalidQuestion }
            return .server(status: status, message: message)
        case 401, 403:
            return .unauthorized
        case 429:
            return .rateLimited
        case 500 ... 599:
            return .unavailable
        default:
            return .server(status: status, message: message)
        }
    }
}

public protocol AskAtlasService: Sendable {
    func ask(question: String, context: String?) async throws -> String
}

public struct LiveAskAtlasService: AskAtlasService, Sendable {
    private let client: PocketBaseClient
    private let tokenProvider: @Sendable () -> String?
    private let session: URLSession

    public init(client: PocketBaseClient, tokenProvider: @escaping @Sendable () -> String?, session: URLSession = .shared) {
        self.client = client
        self.tokenProvider = tokenProvider
        self.session = session
    }

    public func ask(question: String, context: String?) async throws -> String {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw AskAtlasError.invalidQuestion }
        guard let token = tokenProvider(), !token.isEmpty else { throw AskAtlasError.unauthorized }

        var request = URLRequest(url: client.baseURL.appendingPathComponent("atlas/ask"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(token, forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(AskAtlasRequest(question: trimmed, context: context))

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw AskAtlasError.offline
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if !(200 ..< 300).contains(status) {
            let message = (try? JSONDecoder().decode(PocketBaseAPIError.self, from: data))?.message
            throw AskAtlasError.fromHTTP(status: status, message: message)
        }

        let decoded = try JSONDecoder().decode(AskAtlasResponse.self, from: data)
        let answer = decoded.answer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !answer.isEmpty else { throw AskAtlasError.emptyResponse }
        return answer
    }
}

private struct PocketBaseAPIError: Decodable {
    let message: String?
}
