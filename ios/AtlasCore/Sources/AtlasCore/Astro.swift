import Foundation

public struct HorizontalPosition: Equatable, Sendable {
    public let altitudeDeg: Double
    public let azimuthDeg: Double

    public init(altitudeDeg: Double, azimuthDeg: Double) { self.altitudeDeg = altitudeDeg; self.azimuthDeg = azimuthDeg }

    public var compass: String { Astro.compassLabel(azimuthDeg) }
}

/// Low-precision positions for the sun, moon and fixed objects. Accurate to a fraction of a degree
/// (sun ~0.01 deg, moon ~0.3 deg), which is plenty for "where do I point the camera" and for
/// darkness windows. The web app uses astronomy-engine for exact values.
public enum Astro {
    private static let rad = Double.pi / 180

    static func julianDay(_ date: Date) -> Double { date.timeIntervalSince1970 / 86400 + 2440587.5 }
    private static func wrap360(_ d: Double) -> Double { ((d.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360) }

    public static func compassLabel(_ azimuth: Double) -> String {
        let points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        return points[Int((wrap360(azimuth) / 45).rounded()) % 8]
    }

    /// Greenwich mean sidereal time in degrees.
    static func gmst(_ date: Date) -> Double {
        let d = julianDay(date) - 2451545.0
        return wrap360(280.46061837 + 360.98564736629 * d)
    }

    /// Altitude/azimuth (azimuth from north, clockwise) for an equatorial position.
    public static func horizontal(raHours: Double, decDeg: Double, at date: Date, latitude: Double, longitude: Double) -> HorizontalPosition {
        let hourAngle = wrap360(gmst(date) + longitude - raHours * 15) * rad
        let dec = decDeg * rad, lat = latitude * rad
        let sinAlt = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(hourAngle)
        let alt = asin(max(-1, min(1, sinAlt)))
        let azFromSouth = atan2(sin(hourAngle), cos(hourAngle) * sin(lat) - tan(dec) * cos(lat))
        return HorizontalPosition(altitudeDeg: alt / rad, azimuthDeg: wrap360(azFromSouth / rad + 180))
    }

    private static func equatorial(eclipticLon: Double, eclipticLat: Double, t: Double) -> (raHours: Double, decDeg: Double) {
        let eps = (23.4392911 - 0.0130042 * t) * rad
        let l = eclipticLon * rad, b = eclipticLat * rad
        let ra = atan2(sin(l) * cos(eps) - tan(b) * sin(eps), cos(l))
        let dec = asin(sin(b) * cos(eps) + cos(b) * sin(eps) * sin(l))
        return (wrap360(ra / rad) / 15, dec / rad)
    }

    public static func sunEquatorial(at date: Date) -> (raHours: Double, decDeg: Double) {
        let t = (julianDay(date) - 2451545.0) / 36525
        let l0 = 280.46646 + 36000.76983 * t
        let m = (357.52911 + 35999.05029 * t) * rad
        let c = (1.914602 - 0.004817 * t) * sin(m) + 0.019993 * sin(2 * m) + 0.000289 * sin(3 * m)
        return equatorial(eclipticLon: wrap360(l0 + c - 0.00569), eclipticLat: 0, t: t)
    }

    public static func sunAltitude(at date: Date, latitude: Double, longitude: Double) -> Double {
        let s = sunEquatorial(at: date)
        return horizontal(raHours: s.raHours, decDeg: s.decDeg, at: date, latitude: latitude, longitude: longitude).altitudeDeg
    }

    public static func moonEquatorial(at date: Date) -> (raHours: Double, decDeg: Double) {
        let t = (julianDay(date) - 2451545.0) / 36525
        let lp = 218.3164477 + 481267.88123421 * t
        let d = (297.8501921 + 445267.1114034 * t) * rad
        let m = (357.5291092 + 35999.0502909 * t) * rad
        let mp = (134.9633964 + 477198.8675055 * t) * rad
        let f = (93.2720950 + 483202.0175233 * t) * rad
        let lon = lp + (6.288774 * sin(mp) + 1.274027 * sin(2 * d - mp) + 0.658314 * sin(2 * d)
            + 0.213618 * sin(2 * mp) - 0.185116 * sin(m) - 0.114332 * sin(2 * f)
            + 0.058793 * sin(2 * d - 2 * mp) + 0.057066 * sin(2 * d - m - mp)
            + 0.053322 * sin(2 * d + mp) + 0.045758 * sin(2 * d - m))
        let lat = 5.128122 * sin(f) + 0.280602 * sin(mp + f) + 0.277693 * sin(mp - f)
            + 0.173237 * sin(2 * d - f) + 0.055413 * sin(2 * d - mp + f) + 0.046271 * sin(2 * d - mp - f)
            + 0.032573 * sin(2 * d + f)
        return equatorial(eclipticLon: wrap360(lon), eclipticLat: lat, t: t)
    }

    /// Topocentric: subtracts the moon's ~0.95 deg horizontal parallax, which matters for rise/set.
    public static func moonPosition(at date: Date, latitude: Double, longitude: Double) -> HorizontalPosition {
        let m = moonEquatorial(at: date)
        let p = horizontal(raHours: m.raHours, decDeg: m.decDeg, at: date, latitude: latitude, longitude: longitude)
        return HorizontalPosition(altitudeDeg: p.altitudeDeg - 0.95 * cos(p.altitudeDeg * rad), azimuthDeg: p.azimuthDeg)
    }
}

/// Sunset and twilight crossings for one night. Nil where the sun never reaches that depth
/// (high latitudes in summer), as on the web.
public struct DarknessWindow: Equatable, Sendable {
    public var sunset: Date?
    public var civilDusk: Date?
    public var astronomicalDusk: Date?
    public var astronomicalDawn: Date?
    public var civilDawn: Date?

    /// Genuinely dark span, falling back to civil twilight when astronomical darkness never comes.
    public var darkStart: Date? { astronomicalDusk ?? civilDusk }
    public var darkEnd: Date? { astronomicalDawn ?? civilDawn }

    /// The night that contains `now`, or the coming one if the sun is still up.
    public static func tonight(now: Date, latitude: Double, longitude: Double) -> DarknessWindow {
        let step: TimeInterval = 120
        let from = now.addingTimeInterval(-14 * 3600), to = now.addingTimeInterval(36 * 3600)
        func alt(_ d: Date) -> Double { Astro.sunAltitude(at: d, latitude: latitude, longitude: longitude) }

        // Crossings of each depth, going down (dusk) or up (dawn), found by linear interpolation.
        func crossings(_ depth: Double, down: Bool) -> [Date] {
            var out: [Date] = []
            var t = from, prev = alt(t)
            while t < to {
                let next = t.addingTimeInterval(step), a = alt(next)
                if down ? (prev > depth && a <= depth) : (prev < depth && a >= depth) {
                    out.append(t.addingTimeInterval(step * (prev - depth) / (prev - a)))
                }
                t = next; prev = a
            }
            return out
        }

        let dawn18 = crossings(-18, down: false), dawn6 = crossings(-6, down: false)
        let dusk18 = crossings(-18, down: true), dusk6 = crossings(-6, down: true), set0 = crossings(-0.833, down: true)

        // Anchor on the first dawn (civil if astronomical never happens) that has not happened yet.
        let anchor = dawn18.first { $0 > now } ?? dawn6.first { $0 > now }
        guard let anchor else {
            return DarknessWindow(sunset: set0.first, civilDusk: dusk6.first, astronomicalDusk: dusk18.first, astronomicalDawn: dawn18.first, civilDawn: dawn6.first)
        }
        func lastBefore(_ xs: [Date]) -> Date? { xs.last { $0 < anchor } }
        return DarknessWindow(
            sunset: lastBefore(set0), civilDusk: lastBefore(dusk6), astronomicalDusk: lastBefore(dusk18),
            astronomicalDawn: dawn18.first { $0 > now && abs($0.timeIntervalSince(anchor)) < 6 * 3600 },
            civilDawn: dawn6.first { $0 >= anchor.addingTimeInterval(-3 * 3600) && $0 > now })
    }
}
