import AtlasCore
import Foundation

/// `-AtlasFixtureStore`: a store with no App Store or backend. Purchases succeed after a short wait.
/// `-AtlasFixtureStoreEmpty`: products unavailable (the "App Store Connect isn't set up yet" state).
struct FixtureSkyPass: SkyPassProvider, SkyPassBackend {
    let empty: Bool

    static func fromLaunchArguments(_ args: [String] = ProcessInfo.processInfo.arguments) -> FixtureSkyPass? {
        if args.contains("-AtlasFixtureStoreEmpty") { return FixtureSkyPass(empty: true) }
        if args.contains("-AtlasFixtureStore") { return FixtureSkyPass(empty: false) }
        return nil
    }

    func offers() async throws -> [SkyPassOffer] {
        try await Task.sleep(for: .milliseconds(500))
        guard !empty else { return [] }
        return [
            SkyPassOffer(tier: .monthly, displayPrice: "CHF 4.00"),
            SkyPassOffer(tier: .yearly, displayPrice: "CHF 40.00"),
            SkyPassOffer(tier: .lifetime, displayPrice: "CHF 55.00"),
        ]
    }

    func purchase(_ tier: SkyPassTier, accountToken: UUID) async throws -> PurchaseOutcome {
        try await Task.sleep(for: .milliseconds(900))
        return .success(SignedTransaction(jws: "fixture-\(tier.rawValue)", accountToken: accountToken, finish: {}))
    }

    func ownedTransactions() async -> [SignedTransaction] { [] }
    func sync() async throws { try await Task.sleep(for: .milliseconds(400)) }
    func updates() -> AsyncStream<SignedTransaction> { AsyncStream { _ in } }

    func verify(signedTransaction: String, bearerToken: String) async throws -> Bool {
        try await Task.sleep(for: .milliseconds(400))
        return true
    }
}
