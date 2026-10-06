import XCTest
@testable import AtlasCore

/// Golden vectors for the sky engine, shared with the Android port (`android/sky`). Both platforms must
/// reproduce `sky-engine/golden.json`. Regenerate it, only when the algorithm deliberately changes, with
/// `GENERATE_GOLDEN=1 swift test --filter SkyGoldenTests`, then update the Kotlin side to match.
final class SkyGoldenTests: XCTestCase {
    private var goldenURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("sky-engine/golden.json")
    }

    private func round(_ v: Double) -> Double { (v * 1e6).rounded() / 1e6 }

    private func build() -> [String: Any] {
        // Projection: three cameras, a grid of sky positions.
        let cameras: [(String, [Double])] = [
            ("facingNorth", [0, -1, 0, 0, 0, 1, -1, 0, 0]),
            ("east20", SkyCamera.looking(azimuth: 90, altitude: 20).rotation),
            ("southwest60", SkyCamera.looking(azimuth: 225, altitude: 60).rotation),
        ]
        var projections: [[String: Any]] = []
        for (name, rot) in cameras {
            let cam = SkyCamera(rotation: rot)
            var points: [[String: Any]] = []
            for alt in stride(from: -10.0, through: 80, by: 30) {
                for az in stride(from: 0.0, through: 330, by: 45) {
                    var p: [String: Any] = ["alt": alt, "az": az]
                    if let s = cam.project(HorizontalPosition(altitudeDeg: alt, azimuthDeg: az), fovDeg: 70, width: 400, height: 800) {
                        p["x"] = round(s.x); p["y"] = round(s.y)
                    }
                    points.append(p)
                }
            }
            let look = cam.lookDirection
            projections.append(["name": name, "rotation": rot, "lookAlt": round(look.altitudeDeg), "lookAz": round(look.azimuthDeg),
                                "fov": 70.0, "width": 400.0, "height": 800.0, "points": points])
        }

        // Stabiliser: still with wobble, a deliberate pan, then still again with a heading correction.
        var stabilizer = SkyStabilizer()
        var frames: [[String: Any]] = []
        var az = 100.0
        for i in 0..<180 {
            let t = Double(i) / 30
            var rate = 0.003
            if i >= 60 && i < 100 { az += 1.5; rate = 0.8 }
            let wobble = sin(Double(i) * 12.9898) * 0.5
            let correction = i >= 140 ? 2.5 : 0
            let raw = SkyCamera.looking(azimuth: az + wobble + correction, altitude: 32 + cos(Double(i) * 7.233) * 0.3).rotation
            let out = stabilizer.filter(raw, rotationRate: rate, at: t)
            frames.append(["t": round(t), "rate": rate, "in": raw.map(round), "out": out.map(round)])
        }
        return ["projections": projections, "stabilizer": frames]
    }

    func testMatchesGoldenVectors() throws {
        let fresh = build()
        if ProcessInfo.processInfo.environment["GENERATE_GOLDEN"] == "1" {
            let data = try JSONSerialization.data(withJSONObject: fresh, options: [.prettyPrinted, .sortedKeys])
            try FileManager.default.createDirectory(at: goldenURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: goldenURL)
            return
        }
        let stored = try JSONSerialization.jsonObject(with: Data(contentsOf: goldenURL)) as! [String: Any]
        // Replay the stored inputs (rounded as the file holds them) so the check is independent of rounding in `build`.
        let frames = stored["stabilizer"] as! [[String: Any]]
        var stabilizer = SkyStabilizer()
        for f in frames {
            let input = (f["in"] as! [NSNumber]).map(\.doubleValue)
            let expected = (f["out"] as! [NSNumber]).map(\.doubleValue)
            let out = stabilizer.filter(input, rotationRate: (f["rate"] as! NSNumber).doubleValue, at: (f["t"] as! NSNumber).doubleValue)
            for i in 0..<9 { XCTAssertEqual(out[i], expected[i], accuracy: 1e-3) }
        }
        for p in stored["projections"] as! [[String: Any]] {
            let cam = SkyCamera(rotation: (p["rotation"] as! [NSNumber]).map(\.doubleValue))
            for pt in p["points"] as! [[String: Any]] {
                let s = cam.project(HorizontalPosition(altitudeDeg: (pt["alt"] as! NSNumber).doubleValue, azimuthDeg: (pt["az"] as! NSNumber).doubleValue),
                                    fovDeg: 70, width: 400, height: 800)
                if let x = pt["x"] as? NSNumber, let y = pt["y"] as? NSNumber {
                    XCTAssertEqual(s?.x ?? .nan, x.doubleValue, accuracy: 1e-3); XCTAssertEqual(s?.y ?? .nan, y.doubleValue, accuracy: 1e-3)
                } else { XCTAssertNil(s) }
            }
        }
    }
}
