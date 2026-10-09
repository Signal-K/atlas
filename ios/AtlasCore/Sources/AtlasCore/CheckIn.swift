import Foundation

/// How the attempt went; the values are what `atlas_observations.attempt_rating` accepts.
public enum CheckInRating: String, CaseIterable, Identifiable, Sendable {
    case poor, ok, good, great
    public var id: String { rawValue }
    public var label: String {
        switch self { case .poor: "Poor"; case .ok: "OK"; case .good: "Good"; case .great: "Great" }
    }
}

/// A tonight check-in, before it is sent. Mirrors the web's `pushObservation` for a plain (not
/// backdated) check-in so both apps write the same record shape.
public struct CheckInDraft: Equatable, Sendable {
    public var event: SkyEvent
    public var observedAt: Date
    public var rating: CheckInRating?
    public var note: String
    public var deviceUsed: String?
    public var locationLabel: String?
    public var conditionSummary: String?

    public init(event: SkyEvent, observedAt: Date = Date(), rating: CheckInRating? = nil, note: String = "",
                deviceUsed: String? = nil, locationLabel: String? = nil, conditionSummary: String? = nil) {
        self.event = event; self.observedAt = observedAt; self.rating = rating; self.note = note
        self.deviceUsed = deviceUsed; self.locationLabel = locationLabel; self.conditionSummary = conditionSummary
    }
}

public enum CheckIn {
    /// A real PocketBase record id (15 lowercase letters/digits). Generated events such as the derived
    /// Moon have other ids; sending one as the `event` relation would make the server reject the whole
    /// record, so those are omitted and the title travels as `target_name`.
    public static func isRecordID(_ id: String) -> Bool {
        id.count == 15 && id.allSatisfy { ($0 >= "a" && $0 <= "z") || ($0 >= "0" && $0 <= "9") }
    }

    /// Request fields for `atlas_observations`. Empty optional values are omitted rather than sent blank.
    public static func fields(_ draft: CheckInDraft, userID: String) -> [String: String] {
        var out: [String: String] = [
            "user": userID,
            "observed_at": pbDateString(draft.observedAt),
            "target_name": draft.event.title,
        ]
        if isRecordID(draft.event.id) { out["event"] = draft.event.id }
        func put(_ key: String, _ value: String?) {
            if let v = value?.trimmingCharacters(in: .whitespacesAndNewlines), !v.isEmpty { out[key] = v }
        }
        put("note", draft.note)
        put("device_used", draft.deviceUsed)
        put("location_label", draft.locationLabel)
        put("condition_summary", draft.conditionSummary)
        put("attempt_rating", draft.rating?.rawValue)
        return out
    }
}

public extension PocketBaseClient {
    /// Creates a record the signed-in user owns; the collection's create rule decides who may.
    @discardableResult
    func create(collection: String, fields: [String: String]) async throws -> PocketBaseRecord {
        let body = try JSONEncoder().encode(fields)
        return try await send(try request(path: "api/collections/\(collection)/records", method: "POST", body: body), as: PocketBaseRecord.self)
    }

    func submitCheckIn(_ draft: CheckInDraft, userID: String) async throws {
        try await create(collection: "atlas_observations", fields: CheckIn.fields(draft, userID: userID))
    }
}

public extension TonightPlanner {
    /// Events that are on right now and relevant to this place: the ones worth a check-in. Excludes
    /// records of things that already happened (fireballs, flares) and opt-in orbital passes.
    static func activeNow(_ events: [SkyEvent], now: Date, latitude: Double, longitude: Double) -> [SkyEvent] {
        events.filter {
            $0.startsAt <= now && $0.endsAt >= now && KindMeta.of($0.kind).priority < 9
                && !optInOrbital.contains($0.kind) && isLocal($0, latitude, longitude) && isAuroraRelevant($0, latitude)
        }
        .sorted { KindMeta.of($0.kind).priority < KindMeta.of($1.kind).priority }
    }
}
