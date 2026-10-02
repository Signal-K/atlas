import Foundation

/// Low-precision (Meeus, truncated series) moon phase. Accurate to a couple of
/// degrees of elongation, which is plenty for naming a phase. The web app uses
/// astronomy-engine for exact values; swap this out if that precision is needed.
public enum MoonPhase {
    public static let names = [
        "New moon", "Waxing crescent", "First quarter", "Waxing gibbous",
        "Full moon", "Waning gibbous", "Last quarter", "Waning crescent",
    ]

    /// Moon-minus-sun ecliptic longitude in degrees: 0 new, 90 first quarter,
    /// 180 full, 270 last quarter.
    public static func elongation(at date: Date) -> Double {
        let jd = date.timeIntervalSince1970 / 86400 + 2440587.5
        let t = (jd - 2451545.0) / 36525
        let rad = Double.pi / 180
        let d = 297.8501921 + 445267.1114034 * t
        let m = 357.5291092 + 35999.0502909 * t
        let mp = 134.9633964 + 477198.8675055 * t
        let moonCorrection = 6.289 * sin(mp * rad) + 1.274 * sin((2 * d - mp) * rad)
            + 0.658 * sin(2 * d * rad) - 0.186 * sin(m * rad)
        let sunCorrection = 1.915 * sin(m * rad)
        let angle = d + moonCorrection - sunCorrection
        return ((angle.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360)
    }

    public static func name(at date: Date) -> String {
        names[Int((elongation(at: date) / 45).rounded()) % 8]
    }

    public static func isWaxing(at date: Date) -> Bool { elongation(at: date) < 180 }

    public static func illuminationPercent(at date: Date) -> Double {
        (1 - cos(elongation(at: date) * Double.pi / 180)) / 2 * 100
    }
}
