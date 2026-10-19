@preconcurrency import AVFoundation
import AtlasCore
import SwiftUI

struct CameraRequest: Identifiable {
    let id = UUID()
    let plan: CameraPlan
}

/// Full-screen camera with the plan's settings already applied. The plan summary stays at the top;
/// the shutter button saves to Photos.
struct CameraView: View {
    let plan: CameraPlan
    let dismiss: () -> Void

    @State private var controller = CameraController()
    @State private var timer = true
    @State private var showSteps = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            switch controller.state {
            case .running: Preview(session: controller.session).ignoresSafeArea()
            case .idle: ProgressView().tint(.white)
            case .denied: message("Camera access is off", "Allow camera access in Settings so Atlas can apply these settings.", action: ("Open Settings", openSettings))
            case .unavailable: message("No camera here", "This device has no camera (the Simulator, for one). The recommended settings are still shown above for your phone.", action: nil)
            }
            VStack(spacing: 0) {
                top
                Spacer()
                bottom
            }
        }
        .environment(\.colorScheme, .dark)
        .statusBarHidden()
        .task {
            Analytics.capture(.cameraOpened, ["subject": plan.subject, "lens": plan.lens.rawValue])
            await controller.start(plan: plan)
        }
        .onDisappear { controller.stop() }
        .sheet(isPresented: $showSteps) { StepsSheet(plan: plan).presentationDetents([.medium, .large]) }
    }

    // MARK: Chrome

    private var top: some View {
        VStack(spacing: 10) {
            HStack {
                Button { Haptics.tap(); dismiss() } label: { circle("xmark") }.accessibilityLabel("Close camera")
                Spacer()
                Text(plan.subject).font(.serif(20)).foregroundStyle(.white)
                Spacer()
                Button { Haptics.tap(); showSteps = true } label: { circle("list.bullet") }.accessibilityLabel("Setup steps")
            }
            if let a = controller.applied { appliedStrip(a) }
            if let warning = plan.warnings.first {
                Label(warning, systemImage: "exclamationmark.triangle.fill").font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Brand.flagship.opacity(0.85), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(.horizontal, 16).padding(.top, 8)
    }

    private func appliedStrip(_ a: AppliedSettings) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                chip("ISO", "\(Int(a.iso.rounded()))")
                chip("Shutter", CameraPlan.shutterLabel(a.shutterSeconds))
                chip("Lens", a.lens == .ultraWide ? "0.5x" : a.zoom > 1.05 ? String(format: "%.0fx", a.zoom) : "1x")
                chip("Focus", a.focusLocked ? "∞" : "Auto")
            }
            if a.shutterLimited {
                Text("Ideal is \(plan.shutterLabel); this camera's manual limit is \(CameraPlan.shutterLabel(a.shutterSeconds)). Take several frames and stack them, or use Night mode in the Camera app for the longer exposure.")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(10).background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var bottom: some View {
        VStack(spacing: 14) {
            if plan.needsTripod { Label("Rest the phone on a tripod or steady surface", systemImage: "camera.metering.center.weighted").font(.system(size: 14)).foregroundStyle(.white.opacity(0.9)) }
            if let error = controller.saveError { Text(error).font(.system(size: 14)).foregroundStyle(Brand.flagship) }
            if controller.lastSaved { Label("Saved to Photos", systemImage: "checkmark.circle.fill").font(.system(size: 15, weight: .medium)).foregroundStyle(Brand.green) }
            HStack {
                Button { Haptics.tap(); timer.toggle() } label: {
                    VStack(spacing: 4) { Image(systemName: timer ? "timer" : "timer.slash").font(.system(size: 22)); Text(timer ? "2s" : "Off").font(.mono(13)) }
                        .foregroundStyle(.white).frame(width: 64)
                }
                .accessibilityLabel(timer ? "Timer two seconds" : "Timer off")
                Spacer()
                Button {
                    Task { await controller.capture(delay: timer ? .seconds(2) : .zero); Analytics.capture(.photoCaptured, ["subject": plan.subject, "saved": controller.lastSaved]) }
                } label: {
                    ZStack {
                        Circle().strokeBorder(.white, lineWidth: 4).frame(width: 78, height: 78)
                        Circle().fill(.white).frame(width: 62, height: 62).opacity(controller.capturing ? 0.4 : 1)
                    }
                }
                .disabled(controller.state != .running || controller.capturing)
                .accessibilityLabel("Take photo")
                Spacer()
                Color.clear.frame(width: 64, height: 1)
            }
        }
        .padding(.horizontal, 20).padding(.bottom, 24).padding(.top, 12)
        .background(LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .top, endPoint: .bottom))
    }

    private func chip(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(label.uppercased()).font(.mono(11)).foregroundStyle(.white.opacity(0.65))
            Text(value).font(.mono(17)).foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity)
    }

    private func circle(_ symbol: String) -> some View {
        Image(systemName: symbol).font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
            .frame(width: 44, height: 44).background(.black.opacity(0.55), in: Circle())
    }

    private func message(_ title: String, _ detail: String, action: (String, () -> Void)?) -> some View {
        VStack(spacing: 12) {
            Text(title).font(.serif(24)).foregroundStyle(.white)
            Text(detail).font(.system(size: 16)).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.center)
            if let action {
                Button(action: action.1) {
                    Text(action.0).font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.bg).padding(.horizontal, 22).frame(minHeight: 46).background(Brand.violet, in: Capsule())
                }
            }
        }
        .padding(32)
    }

    private func openSettings() { if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) } }
}

private struct Preview: UIViewRepresentable {
    let session: AVCaptureSession
    func makeUIView(context: Context) -> PreviewUIView {
        let v = PreviewUIView(); v.previewLayer.session = session; v.previewLayer.videoGravity = .resizeAspectFill; return v
    }
    func updateUIView(_ uiView: PreviewUIView, context: Context) {}
}

private final class PreviewUIView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

private struct StepsSheet: View {
    let plan: CameraPlan
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Setting up \(plan.subject)").font(.serif(24)).foregroundStyle(Brand.ink)
                ForEach(Array(plan.steps.enumerated()), id: \.offset) { i, step in
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(i + 1)").font(.mono(15)).foregroundStyle(Brand.violet).frame(width: 28, height: 28).background(Brand.violetWash, in: Circle())
                        Text(step).font(.system(size: 16)).foregroundStyle(Brand.ink).fixedSize(horizontal: false, vertical: true)
                    }
                }
                if plan.frames > 1 { Text("Take about \(plan.frames) frames.").font(.system(size: 16)).foregroundStyle(Brand.muted) }
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(24)
        }
        .background(Brand.bg)
    }
}

/// The recommended settings as a card, shown in event details before the camera opens.
struct CameraPlanCard: View {
    let plan: CameraPlan
    let device: DeviceProfile
    let open: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Kicker(text: "Camera settings · \(device.name)", color: Brand.violet)
            HStack(spacing: 0) {
                stat("ISO", "\(Int(plan.iso))")
                stat("Shutter", plan.shutterLabel)
                stat("Lens", plan.lens == .ultraWide ? "0.5x" : plan.zoom > 1.05 ? String(format: "%.0fx", plan.zoom) : "1x")
                stat("Focus", plan.focus == .infinity ? "∞" : "Lock")
            }
            if let warning = plan.warnings.first {
                Label(warning, systemImage: "exclamationmark.triangle.fill").font(.system(size: 15)).foregroundStyle(Brand.flagship).fixedSize(horizontal: false, vertical: true)
            }
            Button { Haptics.tap(); open() } label: {
                Label("Open camera with these settings", systemImage: "camera.aperture")
                    .font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.bg)
                    .frame(maxWidth: .infinity, minHeight: 50).background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle())
        }
        .padding(16).brandCard(accent: Brand.violet.opacity(0.6))
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(label.uppercased()).font(.mono(12)).foregroundStyle(Brand.muted)
            Text(value).font(.mono(20)).foregroundStyle(Brand.ink)
        }
        .frame(maxWidth: .infinity)
    }
}
