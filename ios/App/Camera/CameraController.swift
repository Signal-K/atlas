@preconcurrency import AVFoundation
import AtlasCore
import Observation
import Photos
import UIKit

/// What the camera really applied, after clamping the plan to this phone's capture format.
struct AppliedSettings: Equatable {
    var iso: Double
    var shutterSeconds: Double
    var lens: CameraLens
    var zoom: Double
    var focusLocked: Bool
    var kelvin: Double
    /// True when the ideal exposure was longer than this camera allows manually.
    var shutterLimited: Bool
    var isoLimited: Bool
}

/// A manual-exposure camera: applies a `CameraPlan` (ISO, shutter, focus, white balance, lens, zoom)
/// to the capture device and saves photos to the library. The system Camera app can't be launched
/// with settings, so Atlas hosts its own.
@Observable @MainActor
final class CameraController: NSObject {
    enum State: Equatable { case idle, running, denied, unavailable }

    private(set) var state: State = .idle
    private(set) var applied: AppliedSettings?
    private(set) var lastSaved = false
    private(set) var capturing = false
    private(set) var saveError: String?

    let session = AVCaptureSession()
    private let output = AVCapturePhotoOutput()
    private nonisolated let queue = DispatchQueue(label: "atlas.camera")
    private var device: AVCaptureDevice?
    private var configured = false

    func start(plan: CameraPlan) async {
        guard AVCaptureDevice.default(for: .video) != nil else { state = .unavailable; return }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: break
        case .notDetermined:
            guard await AVCaptureDevice.requestAccess(for: .video) else { state = .denied; Analytics.capture(.cameraDenied); return }
        default: state = .denied; Analytics.capture(.cameraDenied); return
        }
        configure(for: plan)
        let session = self.session
        queue.async { if !session.isRunning { session.startRunning() } }
        state = .running
    }

    func stop() {
        let session = self.session
        queue.async { if session.isRunning { session.stopRunning() } }
    }

    /// Re-applies the plan, e.g. after the person edits a value or switches lens.
    func apply(_ plan: CameraPlan) { configure(for: plan) }

    private func discoveredDevice(for lens: CameraLens) -> (AVCaptureDevice, CameraLens)? {
        let types: [(AVCaptureDevice.DeviceType, CameraLens)] = {
            switch lens {
            case .ultraWide: [(.builtInUltraWideCamera, .ultraWide), (.builtInWideAngleCamera, .wide)]
            case .telephoto: [(.builtInTelephotoCamera, .telephoto), (.builtInWideAngleCamera, .wide)]
            case .wide: [(.builtInWideAngleCamera, .wide)]
            }
        }()
        for (type, actual) in types {
            if let d = AVCaptureDevice.default(type, for: .video, position: .back) { return (d, actual) }
        }
        return nil
    }

    private func configure(for plan: CameraPlan) {
        guard let (camera, lens) = discoveredDevice(for: plan.lens) else { state = .unavailable; return }
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        if device?.uniqueID != camera.uniqueID {
            session.inputs.forEach(session.removeInput)
            guard let input = try? AVCaptureDeviceInput(device: camera), session.canAddInput(input) else { state = .unavailable; return }
            session.addInput(input)
            session.sessionPreset = .photo
            if !configured, session.canAddOutput(output) { session.addOutput(output); configured = true }
            device = camera
        }
        do { try camera.lockForConfiguration() } catch { return }
        defer { camera.unlockForConfiguration() }

        let format = camera.activeFormat
        let minShutter = format.minExposureDuration.seconds, maxShutter = format.maxExposureDuration.seconds
        let shutter = min(max(plan.shutterSeconds, minShutter), maxShutter)
        let iso = min(max(Float(plan.iso), format.minISO), format.maxISO)
        camera.setExposureModeCustom(duration: CMTime(seconds: shutter, preferredTimescale: 1_000_000), iso: iso, completionHandler: nil)

        var focusLocked = false
        switch plan.focus {
        case .infinity where camera.isLockingFocusWithCustomLensPositionSupported:
            camera.setFocusModeLocked(lensPosition: 1.0, completionHandler: nil); focusLocked = true
        default:
            if camera.isFocusModeSupported(.continuousAutoFocus) { camera.focusMode = .continuousAutoFocus }
        }

        var kelvin = plan.whiteBalanceKelvin
        if camera.isLockingWhiteBalanceWithCustomDeviceGainsSupported {
            let temp = AVCaptureDevice.WhiteBalanceTemperatureAndTintValues(temperature: Float(plan.whiteBalanceKelvin), tint: 0)
            var gains = camera.deviceWhiteBalanceGains(for: temp)
            let maxGain = camera.maxWhiteBalanceGain
            gains.redGain = min(max(gains.redGain, 1), maxGain); gains.greenGain = min(max(gains.greenGain, 1), maxGain); gains.blueGain = min(max(gains.blueGain, 1), maxGain)
            camera.setWhiteBalanceModeLocked(with: gains, completionHandler: nil)
        } else { kelvin = 0 }

        let zoom = min(max(plan.zoom, 1), Double(format.videoMaxZoomFactor))
        camera.videoZoomFactor = zoom

        applied = AppliedSettings(
            iso: Double(iso), shutterSeconds: shutter, lens: lens, zoom: zoom, focusLocked: focusLocked, kelvin: kelvin,
            shutterLimited: plan.shutterSeconds > maxShutter * 1.05, isoLimited: plan.iso > Double(format.maxISO) * 1.05)
    }

    // MARK: Capture

    func capture(delay: Duration = .zero) async {
        guard state == .running, !capturing else { return }
        capturing = true; saveError = nil; lastSaved = false
        if delay > .zero { try? await Task.sleep(for: delay) }
        let delegate = PhotoDelegate()
        let data: Data? = await withCheckedContinuation { continuation in
            delegate.continuation = continuation
            objc_setAssociatedObject(output, Unmanaged.passUnretained(delegate).toOpaque(), delegate, .OBJC_ASSOCIATION_RETAIN)
            let settings = AVCapturePhotoSettings()
            output.capturePhoto(with: settings, delegate: delegate)
        }
        objc_setAssociatedObject(output, Unmanaged.passUnretained(delegate).toOpaque(), nil, .OBJC_ASSOCIATION_RETAIN)
        defer { capturing = false }
        guard let data else { saveError = "The photo couldn't be captured."; return }
        do {
            try await Self.save(data)
            lastSaved = true; Haptics.success()
        } catch { saveError = "Couldn't save to Photos. Allow Photos access in Settings."; Haptics.failure() }
    }

    private static func save(_ data: Data) async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { throw CocoaError(.userCancelled) }
        try await PHPhotoLibrary.shared().performChanges {
            PHAssetCreationRequest.forAsset().addResource(with: .photo, data: data, options: nil)
        }
    }
}

private final class PhotoDelegate: NSObject, AVCapturePhotoCaptureDelegate, @unchecked Sendable {
    var continuation: CheckedContinuation<Data?, Never>?
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        continuation?.resume(returning: error == nil ? photo.fileDataRepresentation() : nil)
        continuation = nil
    }
}
