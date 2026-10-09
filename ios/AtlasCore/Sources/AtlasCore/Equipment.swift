import Foundation

/// What the person observes with. Drives what the Sky page lists, how each object is described and
/// the camera plan. Raw values are persisted, so don't rename them.
public enum Equipment: String, CaseIterable, Identifiable, Sendable {
    case phone, binoculars, telescope

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .phone: "Phone"
        case .binoculars: "Binoculars"
        case .telescope: "Telescope"
        }
    }

    public var symbol: String {
        switch self {
        case .phone: "iphone"
        case .binoculars: "binoculars.fill"
        case .telescope: "scope"
        }
    }

    public var blurb: String {
        switch self {
        case .phone: "Your eyes and your phone camera. Bright stars, planets and the Moon."
        case .binoculars: "Adds star clusters, bright nebulae and the Andromeda galaxy."
        case .telescope: "Everything in the catalogue, from galaxies to faint globular clusters."
        }
    }

    /// Faintest magnitude you can realistically pick out from a typical suburban sky.
    public var limitingMagnitude: Double {
        switch self {
        case .phone: 5.5
        case .binoculars: 9.0
        case .telescope: 12.0
        }
    }

    /// Stored in UserDefaults; nil until onboarding has run.
    public static func stored(_ raw: String?) -> Equipment? { raw.flatMap { Self(rawValue: $0) } }
}

/// A thing on the Sky page: a catalogue star or a deep-sky object, in one shape.
public struct SkyObject: Identifiable, Equatable, Sendable {
    public enum Kind: Equatable, Sendable { case star, deepSky }

    public let id: String
    public let name: String
    public let kind: Kind
    /// Constellation for a star, object type ("open cluster") for deep sky.
    public let detail: String
    public let raHours: Double
    public let decDeg: Double
    public let magnitude: Double
    public let sizeDeg: Double
    public let colorIndex: Double
}

public struct VisibleObject: Identifiable, Equatable, Sendable {
    public var id: String { object.id }
    public let object: SkyObject
    public let position: HorizontalPosition
    public let howToSee: String
}

public enum SkyVisibility {
    public static let allObjects: [SkyObject] =
        Catalog.stars.map { SkyObject(id: $0.id, name: $0.name, kind: .star, detail: $0.constellation, raHours: $0.raHours, decDeg: $0.decDeg, magnitude: $0.magnitude, sizeDeg: 0, colorIndex: $0.colorIndex) }
        + Catalog.deepSky.map { SkyObject(id: $0.id, name: $0.name, kind: .deepSky, detail: $0.type, raHours: $0.raHours, decDeg: $0.decDeg, magnitude: $0.magnitude, sizeDeg: $0.sizeDeg, colorIndex: 0.6) }

    /// Whether `object` is worth listing for `equipment`. Extended objects (nebulae, galaxies) are
    /// dimmer than their total magnitude suggests, so they must be a notch brighter than a star.
    public static func isVisible(_ object: SkyObject, with equipment: Equipment) -> Bool {
        let limit = equipment.limitingMagnitude - (object.kind == .deepSky ? 0.8 : 0)
        return object.magnitude <= limit
    }

    /// Objects above `minAltitude` for this equipment, brightest first. `moonIlluminationPct` washes out
    /// the faintest objects, so a bright Moon lowers the limit for the eye and binoculars.
    public static func visible(
        with equipment: Equipment, at date: Date, latitude: Double, longitude: Double,
        minAltitude: Double = 5, moonIlluminationPct: Double = 0
    ) -> [VisibleObject] {
        let washout = equipment == .telescope ? 0 : min(1.0, moonIlluminationPct / 100) * 0.8
        return allObjects.compactMap { o in
            guard isVisible(o, with: equipment), o.magnitude <= equipment.limitingMagnitude - (o.kind == .deepSky ? 0.8 : 0) - washout else { return nil }
            let p = Astro.horizontal(raHours: o.raHours, decDeg: o.decDeg, at: date, latitude: latitude, longitude: longitude)
            guard p.altitudeDeg >= minAltitude else { return nil }
            return VisibleObject(object: o, position: p, howToSee: ViewingGuide.howToSee(o, with: equipment, position: p))
        }
        .sorted { $0.object.magnitude < $1.object.magnitude }
    }
}

/// Plain-language "how do I actually see this" text, written per equipment.
public enum ViewingGuide {
    public static func howToSee(_ o: SkyObject, with equipment: Equipment, position p: HorizontalPosition) -> String {
        let where_ = "Face \(p.compass) and look about \(Int(p.altitudeDeg.rounded()))° up (a fist at arm's length is 10°)."
        switch (o.kind, equipment) {
        case (.star, .phone):
            return "\(where_) It's a \(o.magnitude < 0.5 ? "very bright" : "bright") point; you don't need a camera to see it. For a photo, rest the phone against something steady and use Night mode."
        case (.star, .binoculars):
            return "\(where_) Binoculars show its colour more strongly; defocus a touch to see it as a small disc."
        case (.star, .telescope):
            return "\(where_) Stars stay points in a telescope, so use it for colour and for splitting doubles. A low-power eyepiece is plenty."
        case (.deepSky, .phone):
            return "\(where_) Let your eyes adapt for 15 minutes away from lights. It will look like a faint smudge; a 10-second tripod shot shows far more."
        case (.deepSky, .binoculars):
            return "\(where_) Brace the binoculars against a wall or lie back in a chair. Use averted vision: look slightly to one side and the \(o.detail) pops out."
        case (.deepSky, .telescope):
            let power = o.sizeDeg > 0.5 ? "a low-power, wide-field eyepiece" : o.sizeDeg > 0.15 ? "a medium eyepiece" : "a medium-to-high-power eyepiece"
            return "\(where_) Centre it with your finder, then use \(power). Give your eyes a few minutes at the eyepiece."
        }
    }
}
