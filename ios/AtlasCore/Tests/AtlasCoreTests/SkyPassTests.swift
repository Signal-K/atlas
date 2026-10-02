import Foundation
import XCTest
@testable import AtlasCore

@MainActor private final class FakeAccount: SkyPassAccount {
    var userID: String? = "abc123def456ghi"
    var bearerToken: String? = "tok"
    var isEntitled = false
    func markEntitled() { isEntitled = true }
}

private final class FakeBackend: SkyPassBackend, @unchecked Sendable {
    var result: Result<Bool, SkyPassBackendError> = .success(true)
    private(set) var verified: [(jws: String, bearer: String)] = []
    func verify(signedTransaction: String, bearerToken: String) async throws -> Bool {
        verified.append((signedTransaction, bearerToken))
        return try result.get()
    }
}

private final class FakeProvider: SkyPassProvider, @unchecked Sendable {
    var offersResult: Result<[SkyPassOffer], Error> = .success([SkyPassOffer(tier: .monthly, displayPrice: "CHF 4.00")])
    var outcome: PurchaseOutcome = .cancelled
    var owned: [SignedTransaction] = []
    var syncFails = false
    var streamed: [SignedTransaction] = []
    private(set) var purchasedToken: UUID?

    func offers() async throws -> [SkyPassOffer] { try offersResult.get() }
    func purchase(_ tier: SkyPassTier, accountToken: UUID) async throws -> PurchaseOutcome {
        purchasedToken = accountToken
        return outcome
    }
    func ownedTransactions() async -> [SignedTransaction] { owned }
    func sync() async throws { if syncFails { throw URLError(.notConnectedToInternet) } }
    func updates() -> AsyncStream<SignedTransaction> {
        let items = streamed
        return AsyncStream { c in items.forEach { c.yield($0) }; c.finish() }
    }
}

private final class Finished: @unchecked Sendable { var count = 0 }

private func signed(_ jws: String = "jws", user: String? = "abc123def456ghi", finished: Finished = Finished()) -> SignedTransaction {
    SignedTransaction(jws: jws, accountToken: user.map(SkyPass.accountToken(forUserID:)), finish: { finished.count += 1 })
}

@MainActor final class SkyPassTests: XCTestCase {
    private func make() -> (SkyPassStore, FakeProvider, FakeBackend, FakeAccount) {
        let p = FakeProvider(), b = FakeBackend(), a = FakeAccount()
        return (SkyPassStore(provider: p, backend: b, account: a), p, b, a)
    }

    // MARK: Core

    /// atlas-billing derives the same value; its test pins the identical vector.
    func testAccountTokenMatchesTheServerVector() {
        let token = SkyPass.accountToken(forUserID: "abc123def456ghi")
        XCTAssertEqual(token.uuidString.lowercased(), "10af821b-3d3a-5f86-8aeb-6c1715a78e21")
        XCTAssertNotEqual(token, SkyPass.accountToken(forUserID: "someoneelse"))
    }

    func testTiersMapToTheStoreProductIDs() {
        XCTAssertEqual(SkyPass.productIDs, [
            "tech.skinetics.atlas.skypass.monthly", "tech.skinetics.atlas.skypass.yearly", "tech.skinetics.atlas.skypass.lifetime",
        ])
        XCTAssertEqual(SkyPassTier(productID: "tech.skinetics.atlas.skypass.yearly"), .yearly)
        XCTAssertNil(SkyPassTier(productID: "tech.skinetics.atlas.coins"))
        XCTAssertFalse(SkyPassTier.lifetime.isSubscription)
    }

    func testVerifyRequestUsesTheBearerScheme() throws {
        let backend = LiveSkyPassBackend(baseURL: URL(string: "https://billing.example")!)
        let req = try backend.request(signedTransaction: "a.b.c", bearerToken: "pbtoken")
        XCTAssertEqual(req.url?.absoluteString, "https://billing.example/entitlement/apple/verify")
        XCTAssertEqual(req.httpMethod, "POST")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer pbtoken")
        XCTAssertEqual(String(data: try XCTUnwrap(req.httpBody), encoding: .utf8), #"{"signedTransaction":"a.b.c"}"#)
    }

    // MARK: Offers

    func testOffersLoadAndUnavailableWhenEmptyOrFailing() async {
        let (store, provider, _, _) = make()
        await store.loadOffers()
        XCTAssertEqual(store.phase, .ready)
        provider.offersResult = .success([])
        await store.loadOffers()
        XCTAssertEqual(store.phase, .unavailable)
        provider.offersResult = .failure(URLError(.badServerResponse))
        await store.loadOffers()
        XCTAssertEqual(store.phase, .unavailable)
    }

    // MARK: Buying

    func testPurchaseIsBoundToTheAccountAndUnlocksAfterServerVerification() async {
        let (store, provider, backend, account) = make()
        let finished = Finished()
        provider.outcome = .success(signed("jws-1", finished: finished))
        await store.buy(.monthly)
        XCTAssertEqual(provider.purchasedToken, SkyPass.accountToken(forUserID: "abc123def456ghi"))
        XCTAssertEqual(backend.verified.map(\.jws), ["jws-1"])
        XCTAssertEqual(backend.verified.first?.bearer, "tok")
        XCTAssertTrue(account.isEntitled)
        XCTAssertEqual(finished.count, 1)
        XCTAssertEqual(store.notice?.isError, false)
        XCTAssertNil(store.purchasing)
    }

    func testCancelledPurchaseSaysNothingAndChargesNothing() async {
        let (store, _, backend, account) = make()
        await store.buy(.yearly)
        XCTAssertNil(store.notice)
        XCTAssertTrue(backend.verified.isEmpty)
        XCTAssertFalse(account.isEntitled)
    }

    func testPendingPurchaseExplainsTheWait() async {
        let (store, provider, _, account) = make()
        provider.outcome = .pending
        await store.buy(.monthly)
        XCTAssertEqual(store.notice?.isError, false)
        XCTAssertFalse(account.isEntitled)
    }

    func testGuestsCannotBuy() async {
        let (store, provider, _, account) = make()
        account.userID = nil
        await store.buy(.monthly)
        XCTAssertNil(provider.purchasedToken)
        XCTAssertEqual(store.notice?.isError, true)
    }

    func testServerOutageLeavesTheTransactionUnfinishedForRetry() async {
        let (store, provider, backend, account) = make()
        let finished = Finished()
        provider.outcome = .success(signed(finished: finished))
        backend.result = .failure(.failed(status: 502))
        await store.buy(.monthly)
        XCTAssertFalse(account.isEntitled)
        XCTAssertEqual(finished.count, 0, "an unfinished transaction is what makes StoreKit redeliver it")
        XCTAssertEqual(store.notice?.isError, true)
    }

    func testAnotherAccountsPurchaseIsRejectedAndFinished() async {
        let (store, provider, backend, account) = make()
        let finished = Finished()
        provider.outcome = .success(signed(finished: finished))
        backend.result = .failure(.accountMismatch)
        await store.buy(.monthly)
        XCTAssertFalse(account.isEntitled)
        XCTAssertEqual(finished.count, 1)
        XCTAssertTrue(store.notice?.text.contains("different Atlas account") == true)
    }

    // MARK: Restore

    func testRestoreClaimsOnlyThisAccountsPurchases() async {
        let (store, provider, backend, account) = make()
        provider.owned = [signed("theirs", user: "someoneelse"), signed("legacy", user: nil), signed("mine")]
        await store.restore()
        XCTAssertEqual(backend.verified.map(\.jws), ["mine"])
        XCTAssertTrue(account.isEntitled)
    }

    func testRestoreWithNothingOwnedSaysSo() async {
        let (store, _, _, account) = make()
        await store.restore()
        XCTAssertFalse(account.isEntitled)
        XCTAssertTrue(store.notice?.text.contains("No Sky Pass purchase") == true)
    }

    func testRestoreSurvivesAnAppStoreOutage() async {
        let (store, provider, backend, _) = make()
        provider.syncFails = true
        await store.restore()
        XCTAssertTrue(backend.verified.isEmpty)
        XCTAssertEqual(store.notice?.isError, true)
    }

    // MARK: Background

    func testRunRedeemsOwnedAndStreamedPurchasesButSkipsForeignOnes() async {
        let (store, provider, backend, account) = make()
        provider.owned = [signed("owned")]
        provider.streamed = [signed("foreign", user: "someoneelse"), signed("streamed")]
        await store.run()
        // "owned" grants entitlement first, then the stream is still drained for this account only.
        XCTAssertEqual(backend.verified.map(\.jws), ["owned", "streamed"])
        XCTAssertTrue(account.isEntitled)
    }

    func testRunDoesNotReclaimWhenAlreadyEntitledOnTheWeb() async {
        let (store, provider, backend, account) = make()
        account.isEntitled = true
        provider.owned = [signed("owned")]
        await store.run()
        XCTAssertTrue(backend.verified.isEmpty)
    }
}
