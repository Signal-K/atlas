import AtlasCore
import CoreMotion
import Observation

/// Device attitude from the accelerometer and gyro, fused by CoreMotion against gravity and true
/// north (`xTrueNorthZVertical`, which also needs location; the app already has it). The attitude
/// is exposed as a `SkyCamera` so the chart can project the sky through the screen.
@Observable @MainActor
final class MotionService {
    private let manager = CMMotionManager()
    private(set) var camera: SkyCamera?
    private(set) var isRunning = false

    var isAvailable: Bool { manager.isDeviceMotionAvailable }

    func start() {
        guard isAvailable, !isRunning else { return }
        manager.deviceMotionUpdateInterval = 1.0 / 30
        let frames = CMMotionManager.availableAttitudeReferenceFrames()
        let frame: CMAttitudeReferenceFrame = frames.contains(.xTrueNorthZVertical) ? .xTrueNorthZVertical : .xArbitraryCorrectedZVertical
        manager.startDeviceMotionUpdates(using: frame, to: .main) { [weak self] motion, _ in
            guard let m = motion?.attitude.rotationMatrix else { return }
            let r = [m.m11, m.m12, m.m13, m.m21, m.m22, m.m23, m.m31, m.m32, m.m33]
            MainActor.assumeIsolated { self?.camera = SkyCamera(rotation: r) }
        }
        isRunning = true
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
        isRunning = false
    }
}
