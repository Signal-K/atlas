import XCTest
@testable import AtlasCore

final class SkyStabilizerTests: XCTestCase {
    /// Deterministic noise in [-1, 1].
    private struct Noise {
        var s: UInt64 = 0x9E3779B97F4A7C15
        mutating func next() -> Double {
            s ^= s << 13; s ^= s >> 7; s ^= s << 17
            return Double(s % 20001) / 10000 - 1
        }
    }

    private func angleDeg(_ a: [Double], _ b: [Double]) -> Double {
        Quat(matrix: a).angle(to: Quat(matrix: b)) * 180 / .pi
    }

    func testQuaternionRoundTripsRotationMatrices() {
        for (az, alt) in [(0.0, 0.0), (90, 30), (225, 60), (310, -5), (180, 89)] {
            let m = SkyCamera.looking(azimuth: az, altitude: alt).rotation
            let back = Quat(matrix: m).matrix
            for i in 0..<9 { XCTAssertEqual(m[i], back[i], accuracy: 1e-9) }
        }
    }

    func testStillPhoneStaysStillDespiteSensorNoiseAndHeadingJumps() {
        var stabilizer = SkyStabilizer()
        var noise = Noise()
        let truth = SkyCamera.looking(azimuth: 120, altitude: 35).rotation
        var out = truth
        var previous = truth
        var worstStep = 0.0, worstWobble = 0.0
        var settled = truth
        for frame in 0..<(30 * 20) {
            let t = Double(frame) / 30
            // +-0.6 degrees of heading noise, plus a 3 degree magnetometer correction at 8 seconds.
            let az = 120 + noise.next() * 0.6 + (t > 8 ? 3 : 0)
            let raw = SkyCamera.looking(azimuth: az, altitude: 35 + noise.next() * 0.3).rotation
            out = stabilizer.filter(raw, rotationRate: 0.003, at: t)
            if frame > 0 { worstStep = max(worstStep, angleDeg(out, previous)) }
            if frame == 90 { settled = out }
            if frame > 90 && t < 8 { worstWobble = max(worstWobble, angleDeg(out, settled)) }
            previous = out
        }
        XCTAssertLessThan(worstStep, 0.08, "no visible frame-to-frame movement while the gyro says still")
        XCTAssertLessThan(worstWobble, 0.15, "noise is absorbed, not followed")
        // The correction is still honoured, just slowly.
        let corrected = SkyCamera.looking(azimuth: 123, altitude: 35).rotation
        XCTAssertLessThan(angleDeg(out, corrected), 2.5)
    }

    func testFollowsADeliberatePanWithoutLagging() {
        var stabilizer = SkyStabilizer()
        _ = stabilizer.filter(SkyCamera.looking(azimuth: 0, altitude: 30).rotation, rotationRate: 0, at: 0)
        // Hold still for a while, then pan at 40 deg/s (0.7 rad/s).
        var t = 0.0
        for _ in 0..<90 { t += 1.0 / 30; _ = stabilizer.filter(SkyCamera.looking(azimuth: 0, altitude: 30).rotation, rotationRate: 0.003, at: t) }
        var az = 0.0
        var lag = 0.0
        for _ in 0..<30 {
            t += 1.0 / 30; az += 40.0 / 30
            let raw = SkyCamera.looking(azimuth: az, altitude: 30).rotation
            let out = stabilizer.filter(raw, rotationRate: 0.7, at: t)
            lag = angleDeg(out, raw)
        }
        XCTAssertLessThan(lag, 3.0, "a panning phone is tracked closely")
    }

    func testSettlesAfterTheMovementStops() {
        var stabilizer = SkyStabilizer()
        var t = 0.0
        _ = stabilizer.filter(SkyCamera.looking(azimuth: 0, altitude: 30).rotation, rotationRate: 0, at: t)
        let target = SkyCamera.looking(azimuth: 60, altitude: 30).rotation
        var out = target
        for _ in 0..<60 {
            t += 1.0 / 30
            out = stabilizer.filter(target, rotationRate: 0.003, at: t)
        }
        // A 60 degree disagreement with no gyro motion means the filter is wrong, so it catches up fast.
        XCTAssertLessThan(angleDeg(out, target), 5)
    }

    func testFirstSampleIsPassedThrough() {
        var stabilizer = SkyStabilizer()
        let m = SkyCamera.looking(azimuth: 200, altitude: 10).rotation
        XCTAssertEqual(stabilizer.filter(m, rotationRate: 0, at: 5), m)
    }
}
