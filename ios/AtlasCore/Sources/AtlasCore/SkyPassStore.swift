import Foundation
import Observation

/// A Sky Pass product as StoreKit priced it for this customer.
public struct SkyPassOffer: Identifiable, Equatable, Sendable {
    public let tier: SkyPassTier
    /// Localised, e.g. "CHF 4.00" -- always StoreKit's own string.
    public let displayPrice: String
    public var id: String { tier.id }

    public init(tier: SkyPassTier, displayPrice: String) {
        self.tier = tier
        self.displayPrice = displayPrice
    }
}

/// A StoreKit-verified transaction, still in its signed form for the server.
public struct SignedTransaction: Sendable {
    public let jws: String
    /// The `appAccountToken` the purchase was made with; nil when none was set.
    public let accountToken: UUID?
    /// Tells StoreKit the content was delivered. Call only after the server accepted it.
    public let finish: @Sendable () async -> Void

    public init(jws: String, accountToken: UUID?, finish: @escaping @Sendable () async -> Void) {
        self.jws = jws
        self.accountToken = accountToken
        self.finish = finish
    }
}

public enum PurchaseOutcome: Sendable {
    case success(SignedTransaction)
    case cancelled
    /// Ask to Buy / SCA: the purchase will arrive later through `updates()`.
    case pending
}

/// The StoreKit surface the store needs. The app supplies a StoreKit 2 implementation; tests and
/// `-AtlasFixtureStore` supply fakes. Kept free of StoreKit so the logic below runs under `swift test`.
public protocol SkyPassProvider: Sendable {
    func offers() async throws -> [SkyPassOffer]
    func purchase(_ tier: SkyPassTier, accountToken: UUID) async throws -> PurchaseOutcome
    /// Verified transactions the customer currently owns (active subscriptions, lifetime).
    func ownedTransactions() async -> [SignedTransaction]
    /// Asks the App Store to re-sync purchases; may show an Apple ID prompt.
    func sync() async throws
    /// Transactions that arrive outside a purchase call: renewals, Ask to Buy approvals, other devices.
    func updates() -> AsyncStream<SignedTransaction>
}

/// The signed-in Atlas account as the store sees it.
@MainActor public protocol SkyPassAccount: AnyObject {
    var userID: String? { get }
    var bearerToken: String? { get }
    var isEntitled: Bool { get }
    func markEntitled()
}

@Observable @MainActor
public final class SkyPassStore {
    public enum Phase: Equatable { case loading, ready, unavailable }
    public struct Notice: Equatable {
        public let text: String
        public let isError: Bool
    }

    public private(set) var phase: Phase = .loading
    public private(set) var offers: [SkyPassOffer] = []
    public private(set) var purchasing: SkyPassTier?
    public private(set) var isRestoring = false
    public private(set) var notice: Notice?

    private let provider: SkyPassProvider
    private let backend: SkyPassBackend
    private let account: SkyPassAccount

    public init(provider: SkyPassProvider, backend: SkyPassBackend, account: SkyPassAccount) {
        self.provider = provider
        self.backend = backend
        self.account = account
    }

    public var isEntitled: Bool { account.isEntitled }
    public var isSignedIn: Bool { account.userID != nil }
    public var isBusy: Bool { purchasing != nil || isRestoring }

    public func loadOffers() async {
        phase = .loading
        do {
            offers = try await provider.offers()
            phase = offers.isEmpty ? .unavailable : .ready
        } catch {
            offers = []
            phase = .unavailable
        }
    }

    public func buy(_ tier: SkyPassTier) async {
        guard !isBusy else { return }
        guard let userID = account.userID else {
            notice = Notice(text: "Sign in to get Sky Pass.", isError: true)
            return
        }
        purchasing = tier
        notice = nil
        defer { purchasing = nil }
        do {
            switch try await provider.purchase(tier, accountToken: SkyPass.accountToken(forUserID: userID)) {
            case .success(let tx):
                notice = message(for: await redeem(tx), afterPurchase: true)
            case .cancelled:
                break
            case .pending:
                notice = Notice(text: "Waiting for approval. Sky Pass unlocks as soon as it's approved.", isError: false)
            }
        } catch {
            notice = Notice(text: "The purchase didn't go through. You haven't been charged.", isError: true)
        }
    }

    public func restore() async {
        guard !isBusy else { return }
        guard account.userID != nil else {
            notice = Notice(text: "Sign in to restore Sky Pass.", isError: true)
            return
        }
        isRestoring = true
        notice = nil
        defer { isRestoring = false }
        do { try await provider.sync() } catch {
            notice = Notice(text: "Couldn't reach the App Store. Try again in a moment.", isError: true)
            return
        }
        let mine = await ownedByThisAccount()
        guard !mine.isEmpty else {
            notice = Notice(text: "No Sky Pass purchase was found for this Atlas account on this Apple ID.", isError: true)
            return
        }
        var best = Redemption.notEntitled
        for tx in mine {
            let result = await redeem(tx)
            if result == .granted { best = .granted; break }
            if best != .failed { best = result }
        }
        notice = message(for: best, afterPurchase: false)
    }

    /// Runs for the signed-in session: claims purchases this account already owns (a reinstall, a
    /// purchase made on another device) and redeems anything StoreKit delivers later. Cancelled with
    /// the surrounding task on sign-out.
    public func run() async {
        if account.userID != nil, !account.isEntitled {
            for tx in await ownedByThisAccount() where await redeem(tx) == .granted { break }
        }
        for await tx in provider.updates() {
            guard !Task.isCancelled else { return }
            guard owns(tx) else { continue }
            if await redeem(tx) == .granted, notice == nil { notice = Notice(text: "Sky Pass is active.", isError: false) }
        }
    }

    // MARK: Redeeming

    private enum Redemption { case granted, notEntitled, wrongAccount, failed }

    private func redeem(_ tx: SignedTransaction) async -> Redemption {
        guard let bearer = account.bearerToken else { return .failed }
        do {
            let entitled = try await backend.verify(signedTransaction: tx.jws, bearerToken: bearer)
            await tx.finish()
            guard entitled else { return .notEntitled }
            account.markEntitled()
            return .granted
        } catch SkyPassBackendError.accountMismatch {
            // Will never be deliverable to this account; finish so it stops reappearing.
            await tx.finish()
            return .wrongAccount
        } catch {
            // Left unfinished on purpose: StoreKit redelivers it on the next launch.
            return .failed
        }
    }

    private func owns(_ tx: SignedTransaction) -> Bool {
        guard let userID = account.userID, let token = tx.accountToken else { return false }
        return token == SkyPass.accountToken(forUserID: userID)
    }

    private func ownedByThisAccount() async -> [SignedTransaction] {
        await provider.ownedTransactions().filter(owns)
    }

    private func message(for result: Redemption, afterPurchase: Bool) -> Notice {
        switch result {
        case .granted:
            Notice(text: afterPurchase ? "Sky Pass is active. Thank you." : "Sky Pass restored.", isError: false)
        case .notEntitled:
            Notice(text: "The App Store confirmed the purchase but it isn't active. Try Restore Purchases.", isError: true)
        case .wrongAccount:
            Notice(text: "That purchase belongs to a different Atlas account.", isError: true)
        case .failed:
            Notice(text: afterPurchase
                ? "Your purchase went through but we couldn't reach Atlas to unlock it. It will unlock automatically next time you open the app, or tap Restore Purchases."
                : "Couldn't reach Atlas to unlock your purchase. Try again in a moment.", isError: true)
        }
    }
}
