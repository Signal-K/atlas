import Foundation

// "Through your telescope tonight" (ASV-154). Swift mirror of src/lib/deepSkyTonight.ts: same
// gear profiles, classes, thresholds and rating formula, so the two apps rank the same way.
// The only difference is the astronomy underneath. The web uses astronomy-engine; this uses
// the low-precision `Astro` routines (fractions of a degree), so picks near a tie can swap order.
//
// Total magnitude is a poor predictor of whether an extended object is worth the eyepiece time,
// so each object is rated on surface brightness against the gear's limit, how high it gets in
// the dark window, how much Moonlight it competes with, and its margin over the gear's limits.

public enum DeepSkyGear: String, CaseIterable, Identifiable, Sendable {
    case eye, binoculars, small, large

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .eye: "Naked eye"
        case .binoculars: "Binoculars"
        case .small: "Small scope (60–100 mm)"
        case .large: "Large scope (130 mm+)"
        }
    }

    /// Short label for a segmented picker.
    public var shortLabel: String {
        switch self {
        case .eye: "Eye"
        case .binoculars: "Binos"
        case .small: "Small scope"
        case .large: "Large scope"
        }
    }

    public var hint: String {
        switch self {
        case .eye: "Dark-sky smudges only"
        case .binoculars: "7x50 to 10x50"
        case .small: "Refractor or small reflector"
        case .large: "Dobsonian or big reflector"
        }
    }

    /// Faintest total magnitude reachable under a dark, Moonless sky.
    public var limitMag: Double {
        switch self {
        case .eye: 6
        case .binoculars: 9.5
        case .small: 11.5
        case .large: 13.5
        }
    }

    /// Faintest mean surface brightness (mag/arcmin²) reachable the same way.
    public var limitSurfaceBrightness: Double {
        switch self {
        case .eye: 13.2
        case .binoculars: 14
        case .small: 14.8
        case .large: 15.6
        }
    }

    public var isScope: Bool { self == .small || self == .large }

    /// Maps onboarding's equipment choice to the picker's default.
    public static func defaultFor(_ equipment: Equipment?) -> DeepSkyGear {
        switch equipment {
        case .telescope: .small
        case .binoculars: .binoculars
        case .phone, nil: .eye
        }
    }
}

public enum DeepSkyClass: String, CaseIterable, Sendable {
    case nebula, dyingStar = "dying-star", cluster, galaxy

    public var label: String {
        switch self {
        case .nebula: "Glowing clouds"
        case .dyingStar: "Dying stars"
        case .cluster: "Star cities"
        case .galaxy: "Distant galaxies"
        }
    }

    public var plain: String {
        switch self {
        case .nebula: "a cloud of gas lit by newborn stars"
        case .dyingStar: "the glowing remains of a star that has shed its outer layers"
        case .cluster: "a crowd of stars bound together by gravity"
        case .galaxy: "a whole galaxy of stars, millions of light-years away"
        }
    }

    /// Moonlight washes these out by this fraction of the full penalty.
    var moonSensitivity: Double {
        switch self {
        case .nebula, .galaxy: 1
        case .dyingStar: 0.5
        case .cluster: 0.35
        }
    }

    /// Colour doubles are not covered: the Messier set has no showpiece doubles (M40 is a famous
    /// disappointment), so "double star" and the unclassified "deep sky object" map to nil.
    public static func from(type: String) -> DeepSkyClass? {
        let t = type.lowercased()
        if t == "planetary nebula" || t == "supernova remnant" { return .dyingStar }
        if t.contains("nebula") { return .nebula }
        if t.contains("cluster") || t == "star association" { return .cluster }
        if t == "galaxy" { return .galaxy }
        return nil
    }
}

public struct DeepSkyPick: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let deepSkyClass: DeepSkyClass
    public let magnitude: Double
    public let surfaceBrightness: Double
    /// Best moment inside the dark window.
    public let bestAt: Date
    public let altitudeDeg: Int
    public let azimuthDeg: Int
    public let compass: String
    /// "high in the south-east"-style phrase for the best moment.
    public let direction: String
    public let moonSeparationDeg: Int?
    /// Magnitudes of Moonlight washout this object suffers at its best moment.
    public let moonPenalty: Double
    /// 0-100.
    public let rating: Int
    public let howTo: String

    public var classLabel: String { deepSkyClass.label }
}

public struct DeepSkyTonight: Equatable, Sendable {
    public let gear: DeepSkyGear
    public let windowStart: Date
    public let windowEnd: Date
    public let moonIlluminationPct: Int
    public let moonPhaseName: String
    public let picks: [DeepSkyPick]
    public let summary: String
}

public enum DeepSkyPlanner {
    static let sampleMinutes = 20.0
    static let minAltitudeDeg = 25.0
    public static let defaultPicks = 6
    static let maxPerClass = 2
    static let maxMoonPenaltyMag = 1.4

    private static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double { min(hi, max(lo, v)) }

    /// Mean magnitude per square arcminute, from total magnitude and apparent size.
    public static func surfaceBrightness(magnitude: Double, sizeDeg: Double) -> Double {
        let arcmin = max(sizeDeg * 60, 0.5)
        return magnitude + 2.5 * log10(Double.pi / 4 * arcmin * arcmin)
    }

    private static func calendar(_ zone: TimeZone) -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        return cal
    }

    /// Local noon of the calendar day the current "observing night" starts on. Before 6am local we
    /// are still in the previous evening's night.
    static func nightAnchor(now: Date, zone: TimeZone) -> Date {
        let cal = calendar(zone)
        let hour = cal.component(.hour, from: now)
        let day = cal.date(byAdding: .day, value: hour < 6 ? -1 : 0, to: now) ?? now
        return cal.date(bySettingHour: 12, minute: 0, second: 0, of: day) ?? day
    }

    static func darkWindow(now: Date, latitude: Double, longitude: Double, zone: TimeZone) -> (start: Date, end: Date) {
        let anchor = nightAnchor(now: now, zone: zone)
        let w = DarknessWindow.tonight(now: anchor, latitude: latitude, longitude: longitude)
        if let start = w.astronomicalDusk ?? w.civilDusk ?? w.sunset, let end = w.astronomicalDawn ?? w.civilDawn, end > start {
            return (start, end)
        }
        // No usable twilight (high latitude near the solstice): use 8pm-4am local.
        let cal = calendar(zone)
        let start = cal.date(bySettingHour: 20, minute: 0, second: 0, of: anchor) ?? anchor
        let nextDay = cal.date(byAdding: .day, value: 1, to: anchor) ?? anchor
        let end = cal.date(bySettingHour: 4, minute: 0, second: 0, of: nextDay) ?? nextDay
        return (start, end)
    }

    private struct MoonSample {
        let altitudeDeg: Double
        let raHours: Double
        let decDeg: Double
        let illumination: Double
    }

    private static func moonSample(at date: Date, latitude: Double, longitude: Double) -> MoonSample {
        let eq = Astro.moonEquatorial(at: date)
        let pos = Astro.moonPosition(at: date, latitude: latitude, longitude: longitude)
        return MoonSample(altitudeDeg: pos.altitudeDeg, raHours: eq.raHours, decDeg: eq.decDeg,
                          illumination: MoonPhase.illuminationPercent(at: date) / 100)
    }

    static func angularSeparationDeg(ra1: Double, dec1: Double, ra2: Double, dec2: Double) -> Double {
        let rad = Double.pi / 180
        let c = sin(dec1 * rad) * sin(dec2 * rad) + cos(dec1 * rad) * cos(dec2 * rad) * cos((ra1 - ra2) * 15 * rad)
        return acos(clamp(c, -1, 1)) / rad
    }

    private static func moonPenalty(_ moon: MoonSample, separationDeg: Double) -> Double {
        guard moon.altitudeDeg > 0 else { return 0 }
        let proximity = max(0.15, 1 - separationDeg / 110)
        let height = min(1, 0.4 + moon.altitudeDeg / 30)
        return maxMoonPenaltyMag * moon.illumination * proximity * height
    }

    private static func directionPhrase(altitudeDeg: Double, compass: String) -> String {
        let words = ["N": "north", "NE": "north-east", "E": "east", "SE": "south-east", "S": "south", "SW": "south-west", "W": "west", "NW": "north-west"]
        let dir = words[compass] ?? compass
        if altitudeDeg >= 60 { return "almost overhead, towards the \(dir)" }
        return "\(altitudeDeg >= 40 ? "high" : "fairly low") in the \(dir)"
    }

    static func howTo(_ cls: DeepSkyClass, gear: DeepSkyGear, name: String) -> String {
        let scope = gear.isScope
        switch cls {
        case .nebula:
            return scope
                ? "Start at low power with the widest eyepiece. A nebula (UHC or OIII) filter makes \(name) stand out; let your eyes adapt for 15 minutes first."
                : "Look for a faint, soft glow rather than a point. Keep the binoculars braced and wait for your eyes to adapt."
        case .dyingStar:
            return scope
                ? "Find the spot at low power, then raise the magnification: the shell is small and takes it well. An OIII filter helps if you have one."
                : "It looks like a slightly fuzzy star in binoculars; compare it with its neighbours to spot it."
        case .cluster:
            return scope
                ? "Use medium power. Globulars start to break into individual stars at 100x or more; open clusters look best at low power."
                : "Binoculars show it as a sprinkle of stars or a hazy ball. Brace them and look slightly to one side."
        case .galaxy:
            return scope
                ? "Look from the darkest spot you have and use averted vision (look slightly to the side). Expect a pale oval glow, not a photo."
                : "A faint, elongated smudge. Averted vision (looking slightly to the side) makes it stronger."
        }
    }

    static func rating(altitudeDeg: Double, magnitude: Double, surface: Double, sizeDeg: Double, gear: DeepSkyGear, penalty: Double) -> (rating: Int, reachable: Bool) {
        let effMag = gear.limitMag - 0.5 * penalty
        let effSurface = gear.limitSurfaceBrightness - penalty
        let reachable = magnitude <= effMag && surface <= effSurface
        let altScore = clamp((altitudeDeg - 15) / 50, 0, 1)
        let margin = min(effMag - magnitude, (effSurface - surface) * 1.5)
        let marginScore = clamp(margin / 3, 0, 1)
        let sizeScore = clamp(sizeDeg * 60 / 4, 0.25, 1)
        let value = 100 * (0.45 * altScore + 0.4 * marginScore + 0.15 * sizeScore)
        return (Int(value.rounded()), reachable)
    }

    /// Messier objects only, matching the web model. The catalogue's three extra showpieces
    /// (Carina, North America, Omega Centauri) wait for the NGC/IC list so both apps change together.
    static let messierObjects: [DeepSkyObject] = Catalog.deepSky.filter { $0.id.range(of: #"^m\d+$"#, options: .regularExpression) != nil }

    static func displayName(_ o: DeepSkyObject) -> String {
        let messier = o.id.uppercased()
        return o.name == messier || o.name.lowercased() == o.id ? messier : "\(o.name) (\(messier))"
    }

    public static func tonight(
        now: Date, latitude: Double, longitude: Double, timeZone: TimeZone = .current,
        gear: DeepSkyGear, limit: Int = defaultPicks
    ) -> DeepSkyTonight {
        let dark = darkWindow(now: now, latitude: latitude, longitude: longitude, zone: timeZone)
        let from = max(dark.start, now)
        let start = from < dark.end ? from : dark.start
        var times: [Date] = []
        var t = start
        while t <= dark.end { times.append(t); t = t.addingTimeInterval(sampleMinutes * 60) }
        if times.isEmpty { times.append(start) }
        let moons = times.map { moonSample(at: $0, latitude: latitude, longitude: longitude) }

        let mid = times.count / 2
        let moonPct = Int((moons[mid].illumination * 100).rounded())
        let phaseName = MoonPhase.name(at: times[mid])

        var scored: [DeepSkyPick] = []
        for obj in messierObjects {
            guard let cls = DeepSkyClass.from(type: obj.type) else { continue }
            let surface = surfaceBrightness(magnitude: obj.magnitude, sizeDeg: obj.sizeDeg)
            var best: (rating: Int, i: Int, pos: HorizontalPosition, penalty: Double, sep: Double)?
            for i in times.indices {
                let pos = Astro.horizontal(raHours: obj.raHours, decDeg: obj.decDeg, at: times[i], latitude: latitude, longitude: longitude)
                if pos.altitudeDeg < minAltitudeDeg { continue }
                let sep = angularSeparationDeg(ra1: obj.raHours, dec1: obj.decDeg, ra2: moons[i].raHours, dec2: moons[i].decDeg)
                let penalty = moonPenalty(moons[i], separationDeg: sep) * cls.moonSensitivity
                let r = rating(altitudeDeg: pos.altitudeDeg, magnitude: obj.magnitude, surface: surface, sizeDeg: obj.sizeDeg, gear: gear, penalty: penalty)
                guard r.reachable else { continue }
                if best == nil || r.rating > best!.rating { best = (r.rating, i, pos, penalty, sep) }
            }
            guard let best else { continue }
            let name = displayName(obj)
            scored.append(DeepSkyPick(
                id: obj.id, name: name, type: obj.type, deepSkyClass: cls, magnitude: obj.magnitude,
                surfaceBrightness: (surface * 10).rounded() / 10,
                bestAt: times[best.i],
                altitudeDeg: Int(best.pos.altitudeDeg.rounded()), azimuthDeg: Int(best.pos.azimuthDeg.rounded()),
                compass: best.pos.compass,
                direction: directionPhrase(altitudeDeg: best.pos.altitudeDeg, compass: best.pos.compass),
                moonSeparationDeg: moons[best.i].altitudeDeg > 0 ? Int(best.sep.rounded()) : nil,
                moonPenalty: (best.penalty * 100).rounded() / 100,
                rating: best.rating, howTo: howTo(cls, gear: gear, name: name)))
        }
        scored.sort { $0.rating != $1.rating ? $0.rating > $1.rating : $0.magnitude < $1.magnitude }
        let picks = diversify(scored, limit: limit)
        return DeepSkyTonight(
            gear: gear, windowStart: start, windowEnd: dark.end, moonIlluminationPct: moonPct, moonPhaseName: phaseName,
            picks: picks, summary: summary(count: picks.count, gear: gear, moonPct: moonPct, phase: phaseName))
    }

    /// Best of each class first, so a night of open clusters doesn't hide the nebula or galaxy; then
    /// fill by rating with at most `maxPerClass` of one class; anything left comes from the rest.
    static func diversify(_ sorted: [DeepSkyPick], limit: Int) -> [DeepSkyPick] {
        var chosen: [DeepSkyPick] = []
        var counts: [DeepSkyClass: Int] = [:]
        for p in sorted where chosen.count < limit && counts[p.deepSkyClass] == nil {
            counts[p.deepSkyClass] = 1; chosen.append(p)
        }
        for p in sorted where chosen.count < limit && !chosen.contains(p) {
            let n = counts[p.deepSkyClass] ?? 0
            if n >= maxPerClass { continue }
            counts[p.deepSkyClass] = n + 1; chosen.append(p)
        }
        for p in sorted where chosen.count < limit && !chosen.contains(p) { chosen.append(p) }
        return chosen.sorted { $0.rating != $1.rating ? $0.rating > $1.rating : $0.magnitude < $1.magnitude }
    }

    static func summary(count: Int, gear: DeepSkyGear, moonPct: Int, phase: String) -> String {
        if count == 0 {
            return "Nothing rewarding for \(gear.label.lowercased()) tonight (\(phase.lowercased()), \(moonPct)% lit). Try a bigger instrument or a darker night."
        }
        let note = moonPct >= 60 ? " The Moon is \(moonPct)% lit, so picks favour objects that cope with moonlight."
            : moonPct <= 15 ? " Dark Moon: a good night for faint objects." : ""
        return "\(count) rewarding target\(count == 1 ? "" : "s") for \(gear.label.lowercased()) tonight.\(note)"
    }
}
