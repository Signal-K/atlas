import Foundation

public struct SkyPhotoIDInput: Sendable {
    public let date: Date
    public let latitude: Double
    public let longitude: Double
    public let headingDeg: Double?

    public init(date: Date, latitude: Double, longitude: Double, headingDeg: Double? = nil) {
        self.date = date
        self.latitude = latitude
        self.longitude = longitude
        self.headingDeg = headingDeg
    }
}

public struct IdentifiedSkyObject: Equatable, Sendable {
    public let name: String
    public let target: String
    public let altitudeDeg: Double
    public let azimuthDeg: Double
    public let compassLabel: String
}

public struct SkyConjunctionPair: Equatable, Sendable {
    public let a: String
    public let b: String
    public let separationDeg: Double
}

public struct SkyPhotoIDResult: Equatable, Sendable {
    public let objects: [IdentifiedSkyObject]
    public let aboveHorizon: [IdentifiedSkyObject]
    public let closestPair: SkyConjunctionPair?
    public let summary: String
}

public enum SkyPhotoIdentifier {
    private static let minAltitudeDeg = -2.0
    private static let fovHalfDeg = 40.0
    private static let notablePairDeg = 5.0

    public static func identify(_ input: SkyPhotoIDInput) -> SkyPhotoIDResult {
        var visible: [IdentifiedSkyObject] = []

        for body in [PlanetaryBody.sun, .moon, .mercury, .venus, .mars, .jupiter, .saturn] {
            let position = horizontal(for: body, at: input.date, latitude: input.latitude, longitude: input.longitude)
            guard position.altitudeDeg >= minAltitudeDeg else { continue }
            visible.append(IdentifiedSkyObject(
                name: body.displayName,
                target: body.rawValue,
                altitudeDeg: position.altitudeDeg,
                azimuthDeg: position.azimuthDeg,
                compassLabel: Astro.compassLabel(position.azimuthDeg)
            ))
        }

        let ranked: [IdentifiedSkyObject]
        if let heading = input.headingDeg, heading.isFinite {
            ranked = visible
                .filter { azimuthDiffDeg($0.azimuthDeg, heading) <= fovHalfDeg }
                .sorted { azimuthDiffDeg($0.azimuthDeg, heading) < azimuthDiffDeg($1.azimuthDeg, heading) }
        } else {
            ranked = visible.sorted { $0.altitudeDeg > $1.altitudeDeg }
        }

        var pair: SkyConjunctionPair?
        for i in 0..<visible.count {
            for j in (i + 1)..<visible.count {
                let separation = angularSeparationDeg(visible[i], visible[j])
                guard separation <= notablePairDeg else { continue }
                if pair == nil || separation < pair!.separationDeg {
                    pair = SkyConjunctionPair(a: visible[i].name, b: visible[j].name, separationDeg: separation)
                }
            }
        }

        return SkyPhotoIDResult(
            objects: ranked,
            aboveHorizon: visible,
            closestPair: pair,
            summary: buildSummary(objects: ranked, pair: pair)
        )
    }

    private static func buildSummary(objects: [IdentifiedSkyObject], pair: SkyConjunctionPair?) -> String {
        guard !objects.isEmpty else {
            return "No bright named object was above the horizon in that direction at that time."
        }
        if let pair {
            return "\(pair.a) and \(pair.b) were about \(String(format: "%.1f", pair.separationDeg))° apart and likely form the close pairing in your photo."
        }
        guard let first = objects.first else { return "" }
        return "\(first.name) was the brightest naked-eye object in that direction, around \(Int(first.altitudeDeg.rounded()))° above the horizon in the \(first.compassLabel)."
    }

    private static func horizontal(for body: PlanetaryBody, at date: Date, latitude: Double, longitude: Double) -> HorizontalPosition {
        switch body {
        case .sun:
            let equatorial = Astro.sunEquatorial(at: date)
            return Astro.horizontal(raHours: equatorial.raHours, decDeg: equatorial.decDeg, at: date, latitude: latitude, longitude: longitude)
        case .moon:
            return Astro.moonPosition(at: date, latitude: latitude, longitude: longitude)
        case .mercury, .venus, .mars, .jupiter, .saturn:
            let (raHours, decDeg) = lowPrecisionPlanetEquatorial(body: body, date: date)
            return Astro.horizontal(raHours: raHours, decDeg: decDeg, at: date, latitude: latitude, longitude: longitude)
        }
    }

    private static func azimuthDiffDeg(_ a: Double, _ b: Double) -> Double {
        let diff = abs(a - b).truncatingRemainder(dividingBy: 360)
        return diff > 180 ? 360 - diff : diff
    }

    private static func angularSeparationDeg(_ a: IdentifiedSkyObject, _ b: IdentifiedSkyObject) -> Double {
        let rad = Double.pi / 180
        let altA = a.altitudeDeg * rad
        let altB = b.altitudeDeg * rad
        let deltaAz = (a.azimuthDeg - b.azimuthDeg) * rad
        let cosine = sin(altA) * sin(altB) + cos(altA) * cos(altB) * cos(deltaAz)
        return acos(max(-1, min(1, cosine))) / rad
    }
}

private enum PlanetaryBody: String {
    case sun, moon, mercury, venus, mars, jupiter, saturn

    var displayName: String {
        switch self {
        case .sun: return "Sun"
        case .moon: return "Moon"
        case .mercury: return "Mercury"
        case .venus: return "Venus"
        case .mars: return "Mars"
        case .jupiter: return "Jupiter"
        case .saturn: return "Saturn"
        }
    }
}

private struct OrbitalElements {
    let N: Double
    let i: Double
    let w: Double
    let a: Double
    let e: Double
    let M: Double
}

private func lowPrecisionPlanetEquatorial(body: PlanetaryBody, date: Date) -> (raHours: Double, decDeg: Double) {
    let d = date.timeIntervalSince1970 / 86400 + 10957.5
    let rad = Double.pi / 180
    let eps = (23.4393 - 3.563E-7 * d) * rad

    func elements(_ body: PlanetaryBody) -> OrbitalElements {
        switch body {
        case .mercury:
            return OrbitalElements(N: 48.3313 + 3.24587E-5 * d, i: 7.0047 + 5.00E-8 * d, w: 29.1241 + 1.01444E-5 * d, a: 0.387098, e: 0.205635 + 5.59E-10 * d, M: 168.6562 + 4.0923344368 * d)
        case .venus:
            return OrbitalElements(N: 76.6799 + 2.46590E-5 * d, i: 3.3946 + 2.75E-8 * d, w: 54.8910 + 1.38374E-5 * d, a: 0.723330, e: 0.006773 - 1.302E-9 * d, M: 48.0052 + 1.6021302244 * d)
        case .mars:
            return OrbitalElements(N: 49.5574 + 2.11081E-5 * d, i: 1.8497 - 1.78E-8 * d, w: 286.5016 + 2.92961E-5 * d, a: 1.523688, e: 0.093405 + 2.516E-9 * d, M: 18.6021 + 0.5240207766 * d)
        case .jupiter:
            return OrbitalElements(N: 100.4542 + 2.76854E-5 * d, i: 1.3030 - 1.557E-7 * d, w: 273.8777 + 1.64505E-5 * d, a: 5.20256, e: 0.048498 + 4.469E-9 * d, M: 19.8950 + 0.0830853001 * d)
        case .saturn:
            return OrbitalElements(N: 113.6634 + 2.38980E-5 * d, i: 2.4886 - 1.081E-7 * d, w: 339.3939 + 2.97661E-5 * d, a: 9.55475, e: 0.055546 - 9.499E-9 * d, M: 316.9670 + 0.0334442282 * d)
        case .sun, .moon:
            return OrbitalElements(N: 0, i: 0, w: 0, a: 0, e: 0, M: 0)
        }
    }

    func solve(_ el: OrbitalElements) -> (x: Double, y: Double, z: Double) {
        let M = wrap360(el.M) * rad
        let E = M + el.e * sin(M) * (1 + el.e * cos(M))
        let xv = el.a * (cos(E) - el.e)
        let yv = el.a * (sqrt(1 - el.e * el.e) * sin(E))
        let v = atan2(yv, xv)
        let r = sqrt(xv * xv + yv * yv)

        let N = el.N * rad
        let i = el.i * rad
        let w = el.w * rad
        let lon = v + w

        let xh = r * (cos(N) * cos(lon) - sin(N) * sin(lon) * cos(i))
        let yh = r * (sin(N) * cos(lon) + cos(N) * sin(lon) * cos(i))
        let zh = r * sin(lon) * sin(i)
        return (xh, yh, zh)
    }

    let earth = OrbitalElements(
        N: 0,
        i: 0,
        w: 282.9404 + 4.70935E-5 * d,
        a: 1.0,
        e: 0.016709 - 1.151E-9 * d,
        M: 356.0470 + 0.9856002585 * d
    )
    let earthHelio = solve(earth)
    let planetHelio = solve(elements(body))

    let xg = planetHelio.x - earthHelio.x
    let yg = planetHelio.y - earthHelio.y
    let zg = planetHelio.z - earthHelio.z

    let xe = xg
    let ye = yg * cos(eps) - zg * sin(eps)
    let ze = yg * sin(eps) + zg * cos(eps)

    let ra = atan2(ye, xe)
    let dec = atan2(ze, sqrt(xe * xe + ye * ye))
    return (raHours: wrap360(ra / rad) / 15.0, decDeg: dec / rad)
}

private func wrap360(_ value: Double) -> Double {
    ((value.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360)
}
