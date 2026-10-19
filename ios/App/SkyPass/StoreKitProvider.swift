import AtlasCore
import Foundation
import StoreKit

/// StoreKit 2 behind `SkyPassProvider`. Every transaction handed on has passed StoreKit's own
/// on-device verification; atlas-billing then re-verifies the signed JWS against Apple's chain.
struct StoreKitProvider: SkyPassProvider {
    enum StoreError: Error { case unavailable, unverified }

    func offers() async throws -> [SkyPassOffer] {
        let products = try await Product.products(for: SkyPass.productIDs)
        return products
            .compactMap { product in SkyPassTier(productID: product.id).map { SkyPassOffer(tier: $0, displayPrice: product.displayPrice) } }
            .sorted { SkyPassTier.allCases.firstIndex(of: $0.tier)! < SkyPassTier.allCases.firstIndex(of: $1.tier)! }
    }

    func purchase(_ tier: SkyPassTier, accountToken: UUID) async throws -> PurchaseOutcome {
        guard let product = try await Product.products(for: [tier.productID]).first else { throw StoreError.unavailable }
        switch try await product.purchase(options: [.appAccountToken(accountToken)]) {
        case .success(let verification): return .success(try Self.signed(verification).transaction)
        case .userCancelled: return .cancelled
        case .pending: return .pending
        @unknown default: return .cancelled
        }
    }

    func ownedTransactions() async -> [SignedTransaction] {
        var owned: [SignedTransaction] = []
        for await result in Transaction.currentEntitlements {
            if let tx = try? Self.signed(result), SkyPassTier(productID: tx.productID) != nil { owned.append(tx.transaction) }
        }
        return owned
    }

    func sync() async throws { try await AppStore.sync() }

    func updates() -> AsyncStream<SignedTransaction> {
        AsyncStream { continuation in
            let task = Task {
                for await result in Transaction.updates {
                    if let tx = try? Self.signed(result) { continuation.yield(tx.transaction) }
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private struct Verified { let productID: String; let transaction: SignedTransaction }

    private static func signed(_ verification: VerificationResult<Transaction>) throws -> Verified {
        guard case .verified(let tx) = verification else { throw StoreError.unverified }
        return Verified(
            productID: tx.productID,
            transaction: SignedTransaction(jws: verification.jwsRepresentation, accountToken: tx.appAccountToken, finish: { await tx.finish() }))
    }
}
