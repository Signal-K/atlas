import Foundation

public enum TargetDifficulty: String, Sendable { case easy, moderate, hard }

/// Port of KIND_META in src/lib/tonightTargets.ts -- keep the two in step.
public struct KindMeta: Sendable {
    public let priority: Int
    public let difficulty: TargetDifficulty
    public let phoneFriendly: Bool
    public let nakedEye: Bool
    public let reason: String

    public static func of(_ kind: String) -> KindMeta { table[kind] ?? fallback }

    private static let fallback = KindMeta(priority: 9, difficulty: .hard, phoneFriendly: false, nakedEye: false, reason: "A niche target for tonight.")
    private static let table: [String: KindMeta] = [
        "eclipse": .init(priority: 1, difficulty: .moderate, phoneFriendly: true, nakedEye: true, reason: "A dramatic, unmistakable sky event worth planning around."),
        "aurora": .init(priority: 1, difficulty: .moderate, phoneFriendly: true, nakedEye: true, reason: "A phone in night mode on a tripod often picks up aurora colour the naked eye can barely see."),
        "moon_phase": .init(priority: 2, difficulty: .easy, phoneFriendly: true, nakedEye: true, reason: "Bright and easy to frame with any phone camera."),
        "conjunction": .init(priority: 4, difficulty: .moderate, phoneFriendly: true, nakedEye: true, reason: "Two bright objects close together — a great wide-field phone shot."),
        "planet_event": .init(priority: 5, difficulty: .moderate, phoneFriendly: true, nakedEye: true, reason: "A bright point of light — a steady tripod shot will pick it out."),
        "meteor_shower": .init(priority: 6, difficulty: .hard, phoneFriendly: false, nakedEye: true, reason: "Needs a dark sky and patience; a phone can catch bright fireballs at best, but naked-eye it needs no gear at all."),
        "deep_sky": .init(priority: 7, difficulty: .hard, phoneFriendly: false, nakedEye: false, reason: "Faint — a clear, dark, moonless night matters, and binoculars or a scope usually reveal far more than a phone can."),
        "telescope_target": .init(priority: 8, difficulty: .hard, phoneFriendly: false, nakedEye: false, reason: "A telescope target selected for its altitude from your location tonight."),
        "bright_star": .init(priority: 7, difficulty: .easy, phoneFriendly: true, nakedEye: true, reason: "One of the brightest stars well placed from your location tonight."),
        "comet": .init(priority: 8, difficulty: .hard, phoneFriendly: false, nakedEye: false, reason: "Most comets need binoculars or a small scope — only rare, exceptionally bright ones are naked-eye visible."),
        "asteroid_approach": .init(priority: 8, difficulty: .hard, phoneFriendly: false, nakedEye: false, reason: "Too faint for the naked eye or a phone — this one needs a tracked telescope exposure to actually image."),
        "fireball": .init(priority: 9, difficulty: .hard, phoneFriendly: false, nakedEye: false, reason: "Already happened — a record of recent activity, not something to go outside for tonight."),
        "solar_flare": .init(priority: 9, difficulty: .hard, phoneFriendly: false, nakedEye: false, reason: "Not directly observable — worth knowing about because it can trigger aurora a day or two later."),
    ]
}

public struct PhotoTarget: Identifiable, Equatable, Sendable {
    public var id: String { event.id }
    public let event: SkyEvent
    public let bestTime: Date
    public let direction: HorizontalPosition?
    public let meta: KindMeta
    public let viewingNote: String

    public static func == (a: Self, b: Self) -> Bool { a.event == b.event && a.bestTime == b.bestTime }
}

public struct StarPick: Identifiable, Equatable, Sendable {
    public var id: String { star.id }
    public let star: Star
    /// Highest point reached during tonight's viewing window.
    public let bestTime: Date
    public let bestPosition: HorizontalPosition

    /// Hue a photographer will see: B-V colour index in plain words.
    public var colour: String {
        switch star.colorIndex {
        case ..<0: "blue-white"
        case ..<0.4: "white"
        case ..<0.8: "yellow-white"
        case ..<1.2: "orange"
        default: "deep orange-red"
        }
    }
}

public struct PhotoWindow: Identifiable, Equatable, Sendable {
    public enum Kind: String, Sendable { case twilight, dark, moonless }
    public var id: String { kind.rawValue }
    public let kind: Kind
    public let start: Date
    public let end: Date
    public let title: String
    public let detail: String
}

public struct TonightPlan: Sendable {
    public let rating: TonightRating
    public let reasons: [String]
    public let weatherAvailable: Bool
    public let cloudCoverPct: Double?
    public let precipitationChancePct: Double?
    public let moonIlluminationPct: Double
    public let moonName: String
    public let darkness: DarknessWindow
    public let windows: [PhotoWindow]
    public let generalAdvice: String
    public let targets: [PhotoTarget]
    public let stars: [StarPick]
    public let nextClearNight: NightAdvisory?
    public let nightStart: Date
    public let nightEnd: Date
    public let latitude: Double
    public let longitude: Double
    /// The place's own time zone: every time shown for tonight is in this, not the device's.
    public let timeZone: TimeZone

    /// Bright stars and the Moon on the dome at `date`, for the live sky chart.
    public func sky(at date: Date) -> (stars: [(star: Star, position: HorizontalPosition)], moon: HorizontalPosition) {
        (Catalog.stars.map { ($0, Astro.horizontal(raHours: $0.raHours, decDeg: $0.decDeg, at: date, latitude: latitude, longitude: longitude)) },
         Astro.moonPosition(at: date, latitude: latitude, longitude: longitude))
    }
}

public enum TonightPlanner {
    private static let maxTargets = 8
    private static let locationRadiusKm = 80.0
    static let optInOrbital: Set<String> = ["iss_pass", "satellite_flare"]
    private static let brightKinds: Set<String> = ["moon_phase", "planet_event", "conjunction", "eclipse"]

    public static func plan(
        events: [SkyEvent], forecast: ViewingForecast?, now: Date, latitude: Double, longitude: Double,
        timeZone: TimeZone
    ) -> TonightPlan {
        let end = nextSixAM(after: now, in: timeZone)
        let darkness = DarknessWindow.tonight(now: now, latitude: latitude, longitude: longitude)
        let viewingStart = max(now, darkness.civilDusk ?? now)
        let viewingEnd = min(end, darkness.darkEnd ?? end)

        let night = forecast?.night(startingOn: darkness.sunset ?? now)
        let moonPct = MoonPhase.illuminationPercent(at: now)
        let tonightEvents = events.filter {
            $0.startsAt < end && $0.endsAt >= now && !optInOrbital.contains($0.kind)
                && isLocal($0, latitude, longitude) && isAuroraRelevant($0, latitude)
        }

        let scored: (rating: TonightRating, reasons: [String])
        if let night {
            scored = TonightScore.score(cloudCoverPct: night.cloudCoverPct, precipitationChancePct: night.precipitationChancePct,
                                        moonIlluminationPct: moonPct, hasBrightTarget: tonightEvents.contains { brightKinds.contains($0.kind) })
        } else {
            scored = (.maybe, ["Weather forecast unavailable — rating is based on tonight's events only. Check the sky yourself."])
        }

        let candidates = tonightEvents + derivedMoon(existing: tonightEvents, now: now, start: viewingStart, end: viewingEnd, lat: latitude, lon: longitude)
        let targets = scored.rating == .skip ? [] : rank(candidates, now: now, start: viewingStart, end: viewingEnd, lat: latitude, lon: longitude, cloud: night?.cloudCoverPct)

        return TonightPlan(
            rating: scored.rating, reasons: scored.reasons, weatherAvailable: night != nil,
            cloudCoverPct: night?.cloudCoverPct, precipitationChancePct: night?.precipitationChancePct,
            moonIlluminationPct: moonPct, moonName: MoonPhase.name(at: now), darkness: darkness,
            windows: windows(darkness, now: now, end: end, lat: latitude, lon: longitude),
            generalAdvice: advice(moonPct: moonPct, cloud: night?.cloudCoverPct),
            targets: targets, stars: stars(start: viewingStart, end: viewingEnd, lat: latitude, lon: longitude),
            nextClearNight: nextClearNight(forecast, tonight: night),
            nightStart: now, nightEnd: end, latitude: latitude, longitude: longitude, timeZone: timeZone)
    }

    // MARK: Windows

    static func windows(_ d: DarknessWindow, now: Date, end: Date, lat: Double, lon: Double) -> [PhotoWindow] {
        var out: [PhotoWindow] = []
        if let sunset = d.sunset, let dusk = d.civilDusk, dusk > now {
            out.append(.init(kind: .twilight, start: max(sunset, now), end: dusk, title: "Twilight glow",
                             detail: "Colour in the sky and the first planets. Good for silhouettes and landscapes with a lit horizon."))
        }
        guard let darkStart = d.darkStart, let darkEnd = d.darkEnd, darkEnd > now else { return out }
        out.append(.init(kind: .dark, start: max(darkStart, now), end: darkEnd, title: "Dark sky",
                         detail: "The sun is far enough below the horizon for faint stars and the Milky Way."))
        if let m = moonless(from: max(darkStart, now), to: darkEnd, lat: lat, lon: lon), m.end.timeIntervalSince(m.start) >= 30 * 60 {
            let full = m.start <= max(darkStart, now).addingTimeInterval(60) && m.end >= darkEnd.addingTimeInterval(-60)
            out.append(.init(kind: .moonless, start: m.start, end: m.end, title: full ? "Moon-free all night" : "Moon-free dark",
                             detail: "The Moon is below the horizon: the best window for faint stars, the Milky Way and deep-sky targets."))
        }
        return out
    }

    /// Longest stretch where the Moon is below the horizon within [from, to].
    static func moonless(from: Date, to: Date, lat: Double, lon: Double) -> (start: Date, end: Date)? {
        var best: (Date, Date)?, runStart: Date?
        for t in samples(from: from, to: to, step: 300) {
            let down = Astro.moonPosition(at: t, latitude: lat, longitude: lon).altitudeDeg < -0.5
            if down { runStart = runStart ?? t }
            else if let s = runStart { if best == nil || t.timeIntervalSince(s) > best!.1.timeIntervalSince(best!.0) { best = (s, t) }; runStart = nil }
        }
        if let s = runStart, best == nil || to.timeIntervalSince(s) > best!.1.timeIntervalSince(best!.0) { best = (s, to) }
        return best.map { ($0.0, $0.1) }
    }

    static func advice(moonPct: Double, cloud: Double?) -> String {
        let moon = moonPct < 25
            ? "The Moon is faint or below the horizon — the darkest window tonight, great for a wide starfield or Milky Way shot."
            : moonPct > 75
                ? "The Moon is bright tonight — better for a moonlit-landscape shot than faint stars, but still worth being out."
                : "Moderate moonlight tonight — some fainter stars will wash out, but bright targets and the Moon itself will frame well."
        guard let cloud else { return moon + " Cloud cover forecast unavailable — check the sky yourself." }
        return moon + (cloud < 30 ? " Low cloud cover forecast — good conditions."
            : cloud < 70 ? " Partly cloudy forecast — worth a look, but have a backup night in mind."
            : " High cloud cover forecast — may not be worth it tonight.")
    }

    // MARK: Targets

    /// Events after tonight's window that are relevant to this place (the feed's "coming up").
    public static func upcoming(_ events: [SkyEvent], after end: Date, latitude: Double, longitude: Double) -> [SkyEvent] {
        events.filter { $0.startsAt >= end && !optInOrbital.contains($0.kind) && isLocal($0, latitude, longitude) && isAuroraRelevant($0, latitude) }
            .sorted { $0.startsAt < $1.startsAt }
    }

    /// The Moon is a photo subject every night it is up, scheduled event or not, so a quiet calendar
    /// never leaves the target list empty. Skipped when the calendar already has a moon event.
    private static func derivedMoon(existing: [SkyEvent], now: Date, start: Date, end: Date, lat: Double, lon: Double) -> [SkyEvent] {
        guard !existing.contains(where: { $0.kind == "moon_phase" }), end > start, MoonPhase.illuminationPercent(at: now) >= 3,
              let peak = samples(from: start, to: end, step: 600).map({ ($0, Astro.moonPosition(at: $0, latitude: lat, longitude: lon).altitudeDeg) }).max(by: { $0.1 < $1.1 }),
              peak.1 >= 8 else { return [] }
        let pct = Int(MoonPhase.illuminationPercent(at: peak.0).rounded())
        return [SkyEvent(id: "derived-moon", kind: "moon_phase", target: "moon", title: "\(MoonPhase.name(at: peak.0)) Moon",
                         description: "\(pct)% lit. Frame it with a foreground, or a long lens for the craters.",
                         startsAt: peak.0, endsAt: peak.0.addingTimeInterval(3600))]
    }


    private static func rank(_ events: [SkyEvent], now: Date, start: Date, end: Date, lat: Double, lon: Double, cloud: Double?) -> [PhotoTarget] {
        let note: String = {
            guard let cloud else { return "Cloud cover forecast unavailable — check the sky yourself." }
            return cloud < 30 ? "Low cloud cover tonight — good chance of spotting this."
                : cloud < 70 ? "Partly cloudy tonight — worth a look between clouds."
                : "High cloud cover tonight — likely obscured, but worth checking for gaps."
        }()
        return events.compactMap { event -> PhotoTarget? in
            let (best, dir) = bestView(event, now: now, start: start, end: end, lat: lat, lon: lon)
            // Faint catalogue objects that never clear the horizon tonight are not opportunities.
            if event.kind == "deep_sky", let d = dir, d.altitudeDeg < 10 { return nil }
            return PhotoTarget(event: event, bestTime: best, direction: dir, meta: .of(event.kind), viewingNote: note)
        }
        .sorted {
            if $0.meta.priority != $1.meta.priority { return $0.meta.priority < $1.meta.priority }
            let lowA = ($0.direction?.altitudeDeg ?? 90) < 20, lowB = ($1.direction?.altitudeDeg ?? 90) < 20
            if lowA != lowB { return !lowA }
            return $0.event.startsAt < $1.event.startsAt
        }
        .prefix(maxTargets).map { $0 }
    }

    /// When and where to look. Catalogue objects and the Moon get their highest point in the viewing
    /// window; other events use their own time, pulled into the night if they began earlier.
    private static func bestView(_ e: SkyEvent, now: Date, start: Date, end: Date, lat: Double, lon: Double) -> (Date, HorizontalPosition?) {
        func peak(_ position: (Date) -> HorizontalPosition) -> (Date, HorizontalPosition)? {
            guard end > start else { return nil }
            return samples(from: start, to: end, step: 600).map { ($0, position($0)) }.max { $0.1.altitudeDeg < $1.1.altitudeDeg }
        }
        switch e.kind {
        case "moon_phase":
            if let p = peak({ Astro.moonPosition(at: $0, latitude: lat, longitude: lon) }) { return p }
        case "deep_sky", "telescope_target":
            if let o = Catalog.deepSky(id: e.target),
               let p = peak({ Astro.horizontal(raHours: o.raHours, decDeg: o.decDeg, at: $0, latitude: lat, longitude: lon) }) { return p }
        case "bright_star":
            if let s = Catalog.stars.first(where: { $0.id == e.target }),
               let p = peak({ Astro.horizontal(raHours: s.raHours, decDeg: s.decDeg, at: $0, latitude: lat, longitude: lon) }) { return p }
        default: break
        }
        return (min(max(e.startsAt, start), max(start, end)), nil)
    }

    // MARK: Stars

    private static func stars(start: Date, end: Date, lat: Double, lon: Double) -> [StarPick] {
        guard end > start else { return [] }
        let times = samples(from: start, to: end, step: 600)
        return Catalog.stars.compactMap { star -> StarPick? in
            guard let best = times.map({ ($0, Astro.horizontal(raHours: star.raHours, decDeg: star.decDeg, at: $0, latitude: lat, longitude: lon)) })
                .max(by: { $0.1.altitudeDeg < $1.1.altitudeDeg }), best.1.altitudeDeg >= 25 else { return nil }
            return StarPick(star: star, bestTime: best.0, bestPosition: best.1)
        }
        .sorted { $0.star.magnitude < $1.star.magnitude }
        .prefix(12).map { $0 }
    }

    // MARK: Helpers

    static func samples(from: Date, to: Date, step: TimeInterval) -> [Date] {
        guard to >= from else { return [] }
        return Array(stride(from: from.timeIntervalSince1970, through: to.timeIntervalSince1970, by: step).map(Date.init(timeIntervalSince1970:)))
    }

    static func nextSixAM(after now: Date, in tz: TimeZone) -> Date {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return cal.nextDate(after: now, matching: DateComponents(hour: 6, minute: 0, second: 0), matchingPolicy: .nextTime) ?? now.addingTimeInterval(12 * 3600)
    }

    /// Events with real coordinates (ISS passes, local fallbacks) only count near the viewer.
    /// (0, 0) is PocketBase's "unset" for a number field, so it means "visible anywhere".
    static func isLocal(_ e: SkyEvent, _ lat: Double, _ lon: Double) -> Bool {
        guard let elat = e.latitude, let elon = e.longitude, !(elat == 0 && elon == 0) else { return true }
        return haversineKm(lat, lon, elat, elon) <= locationRadiusKm
    }

    /// The minimum latitude for visibility is encoded in the target, e.g. "aurora_lat55".
    static func isAuroraRelevant(_ e: SkyEvent, _ lat: Double) -> Bool {
        guard e.kind == "aurora" else { return true }
        guard e.target.hasPrefix("aurora_lat"), let min = Double(e.target.dropFirst("aurora_lat".count).prefix { $0.isNumber }) else { return true }
        return abs(lat) >= min
    }

    static func haversineKm(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
        let r = 6371.0, p = Double.pi / 180
        let a = sin((lat2 - lat1) * p / 2) * sin((lat2 - lat1) * p / 2) + cos(lat1 * p) * cos(lat2 * p) * sin((lon2 - lon1) * p / 2) * sin((lon2 - lon1) * p / 2)
        return 2 * r * asin(min(1, sqrt(a)))
    }

    /// When tonight is cloudy, the best of the coming nights instead (port of findNextClearWindow).
    private static func nextClearNight(_ forecast: ViewingForecast?, tonight: NightAdvisory?) -> NightAdvisory? {
        guard let forecast, let tonight, tonight.cloudCoverPct >= 70, let i = forecast.nights.firstIndex(of: tonight) else { return nil }
        let upcoming = forecast.nights.dropFirst(i + 1)
        func moon(_ n: NightAdvisory) -> Double {
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd'T'HH:mm"; f.timeZone = forecast.timeZone.flatMap(TimeZone.init(identifier:)) ?? .current
            return MoonPhase.illuminationPercent(at: f.date(from: n.date + "T23:00") ?? Date())
        }
        return upcoming.enumerated().max { a, b in
            let sa = TonightScore.score(cloudCoverPct: a.element.cloudCoverPct, precipitationChancePct: a.element.precipitationChancePct, moonIlluminationPct: moon(a.element), hasBrightTarget: false).rating
            let sb = TonightScore.score(cloudCoverPct: b.element.cloudCoverPct, precipitationChancePct: b.element.precipitationChancePct, moonIlluminationPct: moon(b.element), hasBrightTarget: false).rating
            if sa != sb { return sa < sb }
            if a.element.precipitationChancePct != b.element.precipitationChancePct { return a.element.precipitationChancePct > b.element.precipitationChancePct }
            if a.element.cloudCoverPct != b.element.cloudCoverPct { return a.element.cloudCoverPct > b.element.cloudCoverPct }
            return a.offset > b.offset
        }?.element
    }
}
