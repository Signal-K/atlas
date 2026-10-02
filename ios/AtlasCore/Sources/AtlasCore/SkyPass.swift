import CryptoKit
import Foundation

/// The three Sky Pass products sold through Apple In-App Purchase. Same tiers as the web checkout
/// (monthly, yearly, lifetime); the App Store owns the price a customer is charged, so nothing here
/// carries an amount.
public enum SkyPassTier: String, CaseIterable, Sendable, Identifiable {
    case monthly, yearly, lifetime

    public var id: String { productID }
    public var productID: String { "\(SkyPass.productPrefix).\(rawValue)" }

    public init?(productID: String) {
        guard let tier = Self.allCases.first(where: { $0.productID == productID }) else { return nil }
        self = tier
    }

    public var title: String {
        switch self {
        case .monthly: "Monthly"
        case .yearly: "Yearly"
        case .lifetime: "Lifetime"
        }
    }

    /// Billing wording Apple requires next to the price.
    public var cadence: String {
        switch self {
        case .monthly: "per month, renews automatically"
        case .yearly: "per year, renews automatically"
        case .lifetime: "one time, yours for good"
        }
    }

    public var isSubscription: Bool { self != .lifetime }
}

public enum SkyPass {
    public static let productPrefix = "tech.skinetics.atlas.skypass"
    public static var productIDs: [String] { SkyPassTier.allCases.map(\.productID) }

    /// The `appAccountToken` attached to every purchase for an Atlas user. Derived (not stored) as
    /// SHA-256("atlas-user:" + userID), first 16 bytes, shaped like a v5 UUID, so the app, the
    /// App Store and atlas-billing (which derives the same value) agree without a lookup table, and
    /// a signed transaction copied to another account fails the ownership check.
    /// Mirrored in atlas-billing/internal/extensions/apple.go; both pin the same test vector.
    public static func accountToken(forUserID userID: String) -> UUID {
        var bytes = Array(SHA256.hash(data: Data("atlas-user:\(userID)".utf8)).prefix(16))
        bytes[6] = bytes[6] & 0x0F | 0x50
        bytes[8] = bytes[8] & 0x3F | 0x80
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }
}
