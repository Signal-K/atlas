import Foundation

/// PocketBase returns datetimes as "YYYY-MM-DD HH:MM:SS.sssZ" (a space, not "T").
/// Mirrors `parsePbDate` in src/lib/pocketbaseDate.ts.
public func parsePbDate(_ raw: String) -> Date? {
    let normalized = raw.contains("T") ? raw : raw.replacingOccurrences(of: " ", with: "T")
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = withFraction.date(from: normalized) { return date }
    let plain = ISO8601DateFormatter()
    plain.formatOptions = [.withInternetDateTime]
    return plain.date(from: normalized)
}
