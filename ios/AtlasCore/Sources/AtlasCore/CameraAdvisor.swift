import Foundation

public enum CameraLens: String, Sendable {
    case ultraWide, wide, telephoto

    public var label: String {
        switch self { case .ultraWide: "Ultra wide (0.5x)"; case .wide: "Main (1x)"; case .telephoto: "Telephoto" }
    }
}

public enum FocusSetting: Equatable, Sendable {
    /// Lens racked to infinity: stars, aurora, meteors.
    case infinity
    /// Focus on the subject once, then lock (the Moon, or anything seen through an eyepiece).
    case lockAfterAutofocus
}

/// What to dial in for one subject. `shutterSeconds` and `iso` are ideals; the camera clamps them to
/// what the phone's active format allows and reports what it actually applied.
public struct CameraPlan: Equatable, Sendable {
    public var subject: String
    public var lens: CameraLens
    public var zoom: Double
    public var iso: Double
    public var shutterSeconds: Double
    public var focus: FocusSetting
    public var whiteBalanceKelvin: Double
    public var needsTripod: Bool
    /// Take a few frames and keep the sharpest, or stack them.
    public var frames: Int
    public var steps: [String]
    /// Safety or accuracy warnings shown above the camera.
    public var warnings: [String]

    public var shutterLabel: String { Self.shutterLabel(shutterSeconds) }

    public static func shutterLabel(_ s: Double) -> String {
        s >= 1 ? (s == s.rounded() ? "\(Int(s))s" : String(format: "%.1fs", s)) : "1/\(max(1, Int((1 / s).rounded())))"
    }
}

/// Turns "what am I shooting, with what" into camera settings. Phones have a fixed aperture, so the
/// levers are ISO, shutter, focus, white balance and which lens. The untracked-star limit uses the
/// "500 rule" so stars stay points rather than trails.
public enum CameraAdvisor {
    public static func plan(
        kind: String, title: String = "", equipment: Equipment, device: DeviceProfile,
        moonIlluminationPct: Double, isMoonUp: Bool = true
    ) -> CameraPlan {
        let lowered = title.lowercased()
        var p: CameraPlan
        switch kind {
        case "moon_phase":
            p = moon(illumination: moonIlluminationPct, device: device)
        case "eclipse":
            p = lowered.contains("solar") ? solarEclipse() : lunarEclipse(title: title, lowered: lowered, device: device)
        case "aurora":
            p = starfield(subject: "Aurora", device: device, maxShutter: 8, iso: 1600, kelvin: 3800, lens: .ultraWide)
            p.steps.append("Aurora moves; if it is bright, drop to 3-4 s so the curtains keep their shape.")
        case "meteor_shower":
            p = starfield(subject: "Meteor shower", device: device, maxShutter: 15, iso: 3200, kelvin: 3800, lens: .ultraWide)
            p.frames = 40
            p.steps.append("Shoot a continuous series (Night mode off, interval timer or burst). Keep every frame; the meteors are in a few of them.")
        case "conjunction", "planet_event":
            p = planetary(subject: kind == "conjunction" ? "Conjunction" : "Planet", device: device, wide: kind == "conjunction")
        case "bright_star":
            p = starfield(subject: "Bright star", device: device, maxShutter: 10, iso: 1600, kelvin: 3800, lens: .wide)
        case "deep_sky", "telescope_target", "comet":
            p = deepSky(equipment: equipment, device: device, moonPct: moonIlluminationPct)
        default:
            p = starfield(subject: title.isEmpty ? "Night sky" : title, device: device, maxShutter: 15, iso: 3200, kelvin: 3800, lens: .ultraWide)
        }

        // The Moon (and eclipses) are the subject, not a source of glare.
        let moonIsSubject = kind == "moon_phase" || kind == "eclipse"
        if !moonIsSubject, moonIlluminationPct > 60, isMoonUp {
            p.iso = max(400, p.iso / 2)
            p.shutterSeconds = max(0.5, p.shutterSeconds / 2)
            p.warnings.append("A bright Moon is up, so exposures are halved to keep the sky from washing out.")
        }
        // Optics change the plan: through binoculars or a scope the phone is held to the eyepiece.
        if equipment != .phone, ["deep_sky", "telescope_target", "comet", "bright_star", "conjunction", "planet_event", "moon_phase"].contains(kind) {
            p.lens = device.hasTelephoto ? .telephoto : .wide
            p.zoom = 1
            p.focus = .lockAfterAutofocus
            p.needsTripod = false
            p.steps.insert("Hold the lens right up to the \(equipment == .telescope ? "eyepiece" : "binocular eyepiece"), centred on the bright circle. Tap to focus, then the camera locks it.", at: 0)
        }
        if p.lens == .ultraWide, !device.hasUltraWide { p.lens = .wide }
        if p.lens == .telephoto, !device.hasTelephoto { p.lens = .wide; p.zoom = max(p.zoom, 2) }
        if device.hasNightMode, p.needsTripod, p.shutterSeconds >= 1 {
            p.steps.append("The Camera app's Night mode can expose up to 30 s on a tripod, longer than a third-party camera can. Use it for the single best frame, and these settings when you want manual control.")
        }
        return p
    }

    // MARK: Subjects

    static func moon(illumination: Double, device: DeviceProfile) -> CameraPlan {
        // Full Moon is about 1/500 s at ISO 100; a thin crescent needs far longer.
        let scale = min(16, max(1, 100 / max(illumination, 6)))
        return CameraPlan(
            subject: "Moon", lens: device.hasTelephoto ? .telephoto : .wide, zoom: device.hasTelephoto ? 1 : 3,
            iso: 100, shutterSeconds: 1 / 500 * scale, focus: .lockAfterAutofocus, whiteBalanceKelvin: 5200,
            needsTripod: true, frames: 5,
            steps: ["Tap the Moon to focus, then lower exposure until the surface detail shows; the Moon is much brighter than it looks.",
                    "Take several frames and keep the sharpest."],
            warnings: [])
    }

    static func lunarEclipse(title: String, lowered: String, device: DeviceProfile) -> CameraPlan {
        let total = lowered.contains("total")
        var p = moon(illumination: total ? 8 : 60, device: device)
        p.subject = "Lunar eclipse"
        if total {
            p.iso = 1600; p.shutterSeconds = 1; p.whiteBalanceKelvin = 4200
            p.steps = ["During totality the Moon is dim and red: raise ISO and use a tripod.",
                       "Bracket: take frames at 1/2 s, 1 s and 2 s, and keep the one that holds the colour without blurring."]
        } else {
            p.iso = 200; p.shutterSeconds = 1 / 125
            p.steps = ["Partial phases are as bright as a normal Moon in the lit part; expose for it and let the shadow go dark."]
        }
        return p
    }

    static func solarEclipse() -> CameraPlan {
        CameraPlan(
            subject: "Solar eclipse", lens: .telephoto, zoom: 3, iso: 50, shutterSeconds: 1 / 1000, focus: .lockAfterAutofocus,
            whiteBalanceKelvin: 5500, needsTripod: true, frames: 5,
            steps: ["Put a certified solar filter (ISO 12312-2) over the lens before you point at the Sun.",
                    "Only take the filter off during totality, and put it back before the Sun reappears."],
            warnings: ["Never look at the Sun through a phone, binoculars or telescope without a certified solar filter. It causes permanent eye damage, and can damage the camera sensor."])
    }

    static func planetary(subject: String, device: DeviceProfile, wide: Bool) -> CameraPlan {
        CameraPlan(
            subject: subject, lens: wide ? .wide : (device.hasTelephoto ? .telephoto : .wide), zoom: wide ? 1 : (device.hasTelephoto ? 1 : 3),
            iso: 400, shutterSeconds: 0.5, focus: .lockAfterAutofocus, whiteBalanceKelvin: 4500, needsTripod: true, frames: 8,
            steps: ["Planets are bright: a short exposure keeps them as sharp discs instead of a blown-out blob.",
                    "Tap the planet to focus, then lower the exposure until it shows a clear disc."],
            warnings: [])
    }

    static func deepSky(equipment: Equipment, device: DeviceProfile, moonPct: Double) -> CameraPlan {
        var p = starfield(subject: "Deep sky", device: device, maxShutter: 15, iso: 3200, kelvin: 3800, lens: .wide)
        p.frames = 20
        p.steps.append("Take many frames and stack them (free apps do it) — one phone frame will only show the brightest objects.")
        if equipment == .phone { p.steps.append("Faint objects show as small smudges on a phone; binoculars or a telescope reveal much more.") }
        if moonPct > 40 { p.warnings.append("Moonlight hides faint objects; wait for the Moon to set.") }
        return p
    }

    /// Wide-field star shot. The 500 rule: shutter (s) = 500 / equivalent focal length, so stars stay points.
    static func starfield(subject: String, device: DeviceProfile, maxShutter: Double, iso: Double, kelvin: Double, lens: CameraLens) -> CameraPlan {
        let focalEquivalent: Double = lens == .ultraWide ? 13 : lens == .telephoto ? 77 : 24
        let shutter = min(maxShutter, 500 / focalEquivalent)
        return CameraPlan(
            subject: subject, lens: lens, zoom: 1, iso: iso, shutterSeconds: shutter, focus: .infinity,
            whiteBalanceKelvin: kelvin, needsTripod: true, frames: 10,
            steps: ["Put the phone on a tripod or a steady surface and use the 2-second timer so pressing the button doesn't shake it.",
                    "Focus is set to infinity. Turn off flash."],
            warnings: [])
    }
}
