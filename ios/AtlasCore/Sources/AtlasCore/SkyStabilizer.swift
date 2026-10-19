import Foundation

/// Keeps the sky chart still when the phone is still.
///
/// CoreMotion's `xTrueNorthZVertical` attitude folds the magnetometer in continuously, so the heading
/// wanders by a degree or two (and occasionally jumps) even on a phone resting on a table. Drawn
/// straight, the whole sky swims. The gyro knows better: if it reports no rotation, any change in the
/// fused attitude is a sensor correction, not the person moving.
///
/// So the filter is gated by angular rate. At rest it follows the raw attitude very slowly (seconds),
/// which absorbs noise and still lets real heading corrections land unseen. Once the phone is actually
/// turning it follows quickly, with just enough smoothing to hide per-frame jitter.
///
/// Pure arithmetic on a row-major 3x3 rotation matrix, so it builds unchanged for iOS and the Swift Android SDK.
public struct SkyStabilizer: Sendable {
    public struct Tuning: Sendable, Equatable {
        /// Time constant (s) while the phone is still. Longer is steadier but corrects heading slower.
        public var restTimeConstant = 2.5
        /// Time constant (s) while the phone is turning.
        public var moveTimeConstant = 0.03
        /// Angular rate (rad/s) below which the phone counts as still, and above which it counts as moving.
        /// Handheld tremor sits under ~0.05 rad/s; deliberately panning to a star is well above 0.2.
        public var stillRate = 0.05
        public var movingRate = 0.2
        /// How long (s) the "moving" verdict decays after the gyro goes quiet, so a stop does not snap.
        public var rateDecay = 0.25
        /// While still, the time constant shrinks as the error grows: tau = rest / (1 + (error / catchUpDegrees)^2).
        /// Small errors are noise and are ignored; a large one means the filter is simply wrong (e.g. after
        /// an interruption) and should catch up in a second or so.
        public var catchUpDegrees = 8.0

        public init() {}
    }

    public var tuning: Tuning
    private var smoothed: Quat?
    private var rate = 0.0
    private var lastTime: Double?

    public init(tuning: Tuning = Tuning()) { self.tuning = tuning }

    public mutating func reset() { smoothed = nil; rate = 0; lastTime = nil }

    /// `rotation` is a row-major rotation matrix, `rotationRate` the gyro magnitude in rad/s, `time` a
    /// monotonic timestamp in seconds. Returns the stabilised rotation matrix.
    public mutating func filter(_ rotation: [Double], rotationRate: Double, at time: Double) -> [Double] {
        let raw = Quat(matrix: rotation)
        guard let current = smoothed, let last = lastTime else {
            smoothed = raw; lastTime = time; rate = rotationRate
            return rotation
        }
        let dt = min(0.25, max(1e-3, time - last))
        lastTime = time

        // Fast attack, slow release.
        rate = max(rotationRate, rate * exp(-dt / tuning.rateDecay))
        let moving = Self.smoothstep(rate, tuning.stillRate, tuning.movingRate)

        let target = current.dot(raw) < 0 ? raw.negated : raw
        let errorRatio = current.angle(to: target) * 180 / .pi / tuning.catchUpDegrees
        let restTau = tuning.restTimeConstant / (1 + errorRatio * errorRatio)
        let tau = restTau + (tuning.moveTimeConstant - restTau) * moving

        let alpha = 1 - exp(-dt / tau)
        let next = current.slerp(to: target, alpha)
        smoothed = next
        return next.matrix
    }

    private static func smoothstep(_ x: Double, _ lo: Double, _ hi: Double) -> Double {
        let t = min(1, max(0, (x - lo) / (hi - lo)))
        return t * t * (3 - 2 * t)
    }
}

/// Unit quaternion, w + xi + yj + zk. Internal: callers deal in rotation matrices.
struct Quat: Equatable, Sendable {
    var w, x, y, z: Double

    var negated: Quat { Quat(w: -w, x: -x, y: -y, z: -z) }

    func dot(_ o: Quat) -> Double { w * o.w + x * o.x + y * o.y + z * o.z }

    /// Rotation angle between two orientations (radians), taking the short way round.
    func angle(to o: Quat) -> Double { 2 * acos(min(1, abs(dot(o)))) }

    func normalized() -> Quat {
        let n = (w * w + x * x + y * y + z * z).squareRoot()
        return n > 0 ? Quat(w: w / n, x: x / n, y: y / n, z: z / n) : Quat(w: 1, x: 0, y: 0, z: 0)
    }

    /// Spherical interpolation; falls back to a normalised lerp when the two are nearly equal.
    func slerp(to o: Quat, _ t: Double) -> Quat {
        let d = dot(o)
        if d > 0.9995 {
            return Quat(w: w + (o.w - w) * t, x: x + (o.x - x) * t, y: y + (o.y - y) * t, z: z + (o.z - z) * t).normalized()
        }
        let theta = acos(min(1, d)), sinTheta = sin(theta)
        let a = sin((1 - t) * theta) / sinTheta, b = sin(t * theta) / sinTheta
        return Quat(w: w * a + o.w * b, x: x * a + o.x * b, y: y * a + o.y * b, z: z * a + o.z * b).normalized()
    }

    init(w: Double, x: Double, y: Double, z: Double) { self.w = w; self.x = x; self.y = y; self.z = z }

    /// From a row-major 3x3 rotation matrix.
    init(matrix m: [Double]) {
        precondition(m.count == 9, "a rotation matrix has nine elements")
        let trace = m[0] + m[4] + m[8]
        if trace > 0 {
            let s = (trace + 1).squareRoot() * 2
            self.init(w: 0.25 * s, x: (m[7] - m[5]) / s, y: (m[2] - m[6]) / s, z: (m[3] - m[1]) / s)
        } else if m[0] > m[4], m[0] > m[8] {
            let s = (1 + m[0] - m[4] - m[8]).squareRoot() * 2
            self.init(w: (m[7] - m[5]) / s, x: 0.25 * s, y: (m[1] + m[3]) / s, z: (m[2] + m[6]) / s)
        } else if m[4] > m[8] {
            let s = (1 + m[4] - m[0] - m[8]).squareRoot() * 2
            self.init(w: (m[2] - m[6]) / s, x: (m[1] + m[3]) / s, y: 0.25 * s, z: (m[5] + m[7]) / s)
        } else {
            let s = (1 + m[8] - m[0] - m[4]).squareRoot() * 2
            self.init(w: (m[3] - m[1]) / s, x: (m[2] + m[6]) / s, y: (m[5] + m[7]) / s, z: 0.25 * s)
        }
        self = normalized()
    }

    /// Row-major 3x3 rotation matrix.
    var matrix: [Double] {
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
         2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
         2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]
    }
}
