import Foundation

/// A row of the PocketBase `sky_events` collection. Mirrors `SkyEvent` in src/lib/db.ts.
public struct SkyEvent: Identifiable, Equatable, Sendable {
    public let id: String
    public let kind: String
    public let target: String
    public let title: String
    public let description: String
    public let content: String?
    public let startsAt: Date
    public let endsAt: Date
    public let latitude: Double?
    public let longitude: Double?

    public init(
        id: String, kind: String, target: String = "", title: String, description: String = "",
        content: String? = nil, startsAt: Date, endsAt: Date, latitude: Double? = nil, longitude: Double? = nil
    ) {
        self.id = id; self.kind = kind; self.target = target; self.title = title
        self.description = description; self.content = content
        self.startsAt = startsAt; self.endsAt = endsAt
        self.latitude = latitude; self.longitude = longitude
    }

    /// Nil when the record has no parseable start/end, so one bad row never blanks the feed.
    public init?(record: PocketBaseRecord) {
        let f = record.fields
        guard let starts = f["starts_at"]?.stringValue.flatMap(parsePbDate),
              let ends = f["ends_at"]?.stringValue.flatMap(parsePbDate)
        else { return nil }
        let lat = f["latitude"]?.doubleValue, lon = f["longitude"]?.doubleValue
        // (0, 0) is PocketBase's "unset" for a number field, not Null Island.
        let hasPlace = !(lat == 0 && lon == 0)
        self.init(
            id: record.id,
            kind: f["kind"]?.stringValue ?? "",
            target: f["target"]?.stringValue ?? "",
            title: f["title"]?.stringValue ?? "",
            description: f["description"]?.stringValue ?? "",
            content: f["content"]?.stringValue,
            startsAt: starts, endsAt: ends,
            latitude: hasPlace ? lat : nil, longitude: hasPlace ? lon : nil
        )
    }
}

extension PocketBaseClient {
    /// Events overlapping [start, end] -- not "starts_at >= start": a multi-day event already in
    /// progress must still be returned. Dates are sent in PocketBase's space-separated format
    /// because its filter compares strings, and "T" sorts after " " (same-day comparisons invert).
    public func skyEvents(from start: Date, to end: Date) async throws -> [SkyEvent] {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let pb = { (d: Date) in formatter.string(from: d).replacingOccurrences(of: "T", with: " ") }
        let filter = "starts_at <= \"\(pb(end))\" && ends_at >= \"\(pb(start))\""
        var events: [SkyEvent] = []
        var page = 1
        while true {
            let list = try await list(collection: "sky_events", page: page, perPage: 200, filter: filter, sort: "starts_at")
            events += list.items.compactMap(SkyEvent.init(record:))
            if list.items.isEmpty || events.count >= list.totalItems || page * list.perPage >= list.totalItems { break }
            page += 1
        }
        return events
    }
}
