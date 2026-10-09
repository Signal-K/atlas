import AtlasCore
import Foundation
import Observation

struct AskAtlasMessage: Identifiable, Codable, Equatable, Sendable {
    enum Role: String, Codable, Sendable {
        case user
        case assistant
    }

    let id: UUID
    let role: Role
    let text: String
    let createdAt: Date

    init(id: UUID = UUID(), role: Role, text: String, createdAt: Date = .now) {
        self.id = id
        self.role = role
        self.text = text
        self.createdAt = createdAt
    }
}

struct AskAtlasHistoryStore {
    private let defaults: UserDefaults
    private let keyPrefix: String
    private let maxMessages: Int

    init(defaults: UserDefaults = .standard, keyPrefix: String = "atlas.ask.history", maxMessages: Int = 40) {
        self.defaults = defaults
        self.keyPrefix = keyPrefix
        self.maxMessages = maxMessages
    }

    func load(userID: String) -> [AskAtlasMessage] {
        guard let data = defaults.data(forKey: storageKey(for: userID)),
              let decoded = try? JSONDecoder().decode([AskAtlasMessage].self, from: data)
        else { return [] }
        return decoded
    }

    func save(_ messages: [AskAtlasMessage], userID: String) {
        let trimmed = Array(messages.suffix(maxMessages))
        guard let data = try? JSONEncoder().encode(trimmed) else { return }
        defaults.set(data, forKey: storageKey(for: userID))
    }

    func clear(userID: String) {
        defaults.removeObject(forKey: storageKey(for: userID))
    }

    private func storageKey(for userID: String) -> String {
        "\(keyPrefix).\(userID)"
    }
}

@Observable @MainActor
final class AskAtlasViewModel {
    private let service: AskAtlasService
    private let historyStore: AskAtlasHistoryStore
    private let tokenProvider: @MainActor () -> String?

    private(set) var messages: [AskAtlasMessage] = []
    var draft = ""
    private(set) var isSending = false
    private(set) var errorText: String?
    private(set) var loadedUserID: String?

    let quickPrompts = [
        "What is easiest to see tonight?",
        "When should I go outside?",
        "How should I use my phone camera?",
    ]

    init(service: AskAtlasService, historyStore: AskAtlasHistoryStore = AskAtlasHistoryStore(), tokenProvider: @escaping @MainActor () -> String?) {
        self.service = service
        self.historyStore = historyStore
        self.tokenProvider = tokenProvider
    }

    func activate(for userID: String?) {
        guard loadedUserID != userID else { return }
        loadedUserID = userID
        draft = ""
        errorText = nil
        guard let userID else {
            messages = []
            return
        }
        messages = historyStore.load(userID: userID)
    }

    func clearHistory() {
        guard let userID = loadedUserID else { return }
        messages = []
        historyStore.clear(userID: userID)
    }

    func send(context: String?) async {
        let question = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isSending else { return }
        guard let userID = loadedUserID else {
            errorText = AskAtlasError.unauthorized.localizedDescription
            return
        }
        guard tokenProvider()?.isEmpty == false else {
            errorText = AskAtlasError.unauthorized.localizedDescription
            return
        }

        isSending = true
        errorText = nil
        draft = ""

        let outgoing = AskAtlasMessage(role: .user, text: question)
        messages.append(outgoing)
        historyStore.save(messages, userID: userID)

        do {
            let combinedContext = mergedContext(screenContext: context)
            let answer = try await service.ask(question: question, context: combinedContext)
            messages.append(AskAtlasMessage(role: .assistant, text: answer))
            historyStore.save(messages, userID: userID)
        } catch let askError as AskAtlasError {
            errorText = askError.localizedDescription
        } catch {
            errorText = AskAtlasError.offline.localizedDescription
        }
        isSending = false
    }

    private func mergedContext(screenContext: String?) -> String? {
        var blocks: [String] = []
        if let screenContext, !screenContext.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            blocks.append(screenContext.trimmingCharacters(in: .whitespacesAndNewlines))
        }

        let transcript = messages.suffix(6).map { message in
            let role = message.role == .user ? "User" : "Atlas"
            return "\(role): \(message.text)"
        }.joined(separator: "\n")
        if !transcript.isEmpty {
            blocks.append("Recent conversation:\n\(transcript)")
        }

        guard !blocks.isEmpty else { return nil }
        let merged = blocks.joined(separator: "\n\n")
        return String(merged.prefix(2_000))
    }
}
