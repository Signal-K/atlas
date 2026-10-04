import Foundation

public enum TonightRating: Int, Comparable, Sendable {
    case skip = 1, poor, maybe, good, great
    public static func < (a: Self, b: Self) -> Bool { a.rawValue < b.rawValue }

    public var label: String {
        switch self {
        case .skip: "Skip"
        case .poor: "Poor"
        case .maybe: "Maybe"
        case .good: "Good"
        case .great: "Great"
        }
    }
}

/// Port of src/lib/tonightScore.ts -- keep the two in step.
public enum TonightScore {
    public static func score(cloudCoverPct: Double, precipitationChancePct: Double, moonIlluminationPct: Double, hasBrightTarget: Bool)
        -> (rating: TonightRating, reasons: [String])
    {
        if cloudCoverPct >= 85 {
            return (.skip, ["Sky is expected to be almost fully clouded over (\(Int(cloudCoverPct.rounded()))% cover)"])
        }
        var points = 100.0
        var reasons: [String] = []
        if cloudCoverPct >= 60 {
            points -= 40; reasons.append("Mostly cloudy tonight (\(Int(cloudCoverPct.rounded()))% cover)")
        } else if cloudCoverPct >= 30 {
            points -= 15; reasons.append("Some cloud expected (\(Int(cloudCoverPct.rounded()))% cover)")
        } else {
            reasons.append("Clear skies expected (\(Int(cloudCoverPct.rounded()))% cloud cover)")
        }
        if precipitationChancePct >= 50 {
            points -= 30; reasons.append("High chance of rain (\(Int(precipitationChancePct.rounded()))%)")
        } else if precipitationChancePct >= 20 {
            points -= 10; reasons.append("Some chance of rain (\(Int(precipitationChancePct.rounded()))%)")
        }
        if !hasBrightTarget {
            if moonIlluminationPct >= 70 {
                points -= 20; reasons.append("Bright moon will wash out faint targets")
            } else if moonIlluminationPct <= 20 {
                reasons.append("Dark, moonless sky — good for faint targets")
            }
        }
        points = max(0, min(100, points))
        let rating: TonightRating = points >= 85 ? .great : points >= 65 ? .good : points >= 45 ? .maybe : points >= 25 ? .poor : .skip
        return (rating, reasons)
    }
}
