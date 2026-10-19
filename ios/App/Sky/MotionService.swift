import AtlasCore
import CoreMotion
import Observation

/// Device attitude from the accelerometer and gyro, fused by CoreMotion against gravity and true
/// north (`xTrueNorthZVertical`, which also needs location; the app already has it). The attitude
/// is exposed as a `SkyCamera` so the chart can project the sky through the screen.
///
/// The raw attitude is not drawn directly: the magnetometer keeps nudging it, so a phone held still
/// would make the sky swim. `SkyStabilizer` uses the gyro rate to tell real movement from those
/// corrections and only publishes a new camera when the stabilised attitude actually changes.
@Observable @MainActor
final class MotionService {
    private let manager = CMMotionManager()
    private var stabilizer = SkyStabilizer()
    private(set) var camera: SkyCamera?
    private(set) var isRunning = false
    /// True while the compass is not trustworthy, so the sky may be rotated about the vertical.
    private(set) var needsCompassCalibration = false

    var isAvailable: Bool { manager.isDeviceMotionAvailable }

    func start() {
        guard isAvailable, !isRunning else { return }
        stabilizer.reset()
        manager.deviceMotionUpdateInterval = 1.0 / 60
        manager.showsDeviceMovementDisplay = true
        let frames = CMMotionManager.availableAttitudeReferenceFrames()
        let frame: CMAttitudeReferenceFrame = frames.contains(.xTrueNorthZVertical) ? .xTrueNorthZVertical : .xArbitraryCorrectedZVertical
        manager.startDeviceMotionUpdates(using: frame, to: .main) { [weak self] motion, _ in
            guard let motion else { return }
            let m = motion.attitude.rotationMatrix
            let r = [m.m11, m.m12, m.m13, m.m21, m.m22, m.m23, m.m31, m.m32, m.m33]
            let g = motion.rotationRate
            let rate = (g.x * g.x + g.y * g.y + g.z * g.z).squareRoot()
            let accuracy = motion.magneticField.accuracy
            MainActor.assumeIsolated { self?.ingest(r, rate: rate, at: motion.timestamp, accuracy: accuracy) }
        }
        isRunning = true
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
        isRunning = false
        camera = nil
    }

    private func ingest(_ rotation: [Double], rate: Double, at time: TimeInterval, accuracy: CMMagneticFieldCalibrationAccuracy) {
        let next = SkyCamera(rotation: stabilizer.filter(rotation, rotationRate: rate, at: time))
        if next != camera { camera = next }
        let uncertain = accuracy == .uncalibrated || accuracy == .low
        if uncertain != needsCompassCalibration { needsCompassCalibration = uncertain }
    }
}
