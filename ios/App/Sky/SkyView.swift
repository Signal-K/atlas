import AtlasCore
import SwiftUI

/// The Sky page: what you can actually see tonight with your equipment, on a chart that follows the
/// phone, plus how to find each object. Full screen, not a card on the home feed.
struct SkyView: View {
    let plan: TonightPlan
    let settings: AppSettings
    let dismiss: () -> Void

    @State private var motion = MotionService()
    @State private var selectedID: String?
    @State private var mode: Mode = .live
    @State private var fov = 70.0
    /// Manual pan (degrees) used when motion is off or unavailable.
    @State private var panAz = 0.0
    @State private var panAlt = 35.0
    @State private var dragStart: (az: Double, alt: Double)?
    @State private var now = Date()
    @State private var camera: CameraRequest?

    enum Mode: String, CaseIterable { case live = "Point", map = "Map" }

    private var equipment: Equipment { settings.equipment ?? .phone }
    private var objects: [VisibleObject] {
        SkyVisibility.visible(with: equipment, at: now, latitude: plan.latitude, longitude: plan.longitude, moonIlluminationPct: plan.moonIlluminationPct)
    }
    private var selected: VisibleObject? { objects.first { $0.id == selectedID } }

    var body: some View {
        VStack(spacing: 0) {
            header
            chart.frame(maxWidth: .infinity).frame(height: 360)
            list
        }
        .background(Brand.bg.ignoresSafeArea())
        .task {
            Analytics.capture(.skyOpened, ["equipment": equipment.rawValue])
            Analytics.screen("Sky")
            while !Task.isCancelled { try? await Task.sleep(for: .seconds(30)); now = Date() }
        }
        .onChange(of: mode) { _, m in
            if m == .live { motion.start(); Analytics.capture(.skyMotionEnabled, ["available": motion.isAvailable]) } else { motion.stop() }
        }
        .onAppear { if mode == .live { motion.start() } }
        .onDisappear { motion.stop() }
        .fullScreenCover(item: $camera) { request in CameraView(plan: request.plan) { camera = nil } }
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: 10) {
            HStack {
                Button { Haptics.tap(); dismiss() } label: {
                    Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.ink)
                        .frame(width: 44, height: 44).background(Brand.surface, in: Circle()).overlay(Circle().strokeBorder(Brand.line))
                }
                .accessibilityLabel("Close sky")
                Spacer()
                Picker("View", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented).frame(width: 160)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Your sky tonight").font(.serif(28)).foregroundStyle(Brand.ink)
                Text("\(objects.count) things visible with \(equipment == .phone ? "your phone" : equipment.label.lowercased())")
                    .font(.system(size: 16)).foregroundStyle(Brand.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 10)
    }

    // MARK: Chart

    @ViewBuilder private var chart: some View {
        ZStack {
            if mode == .live {
                LiveSky(plan: plan, objects: objects, camera: liveCamera, fov: fov, selectedID: selectedID, showMoon: true, now: now)
                    .gesture(DragGesture(minimumDistance: 4)
                        .onChanged { g in
                            guard !motion.isRunning || motion.camera == nil else { return }
                            let s = dragStart ?? (panAz, panAlt); dragStart = s
                            panAz = (s.az - g.translation.width / 360 * fov + 360).truncatingRemainder(dividingBy: 360)
                            panAlt = min(90, max(-10, s.alt + g.translation.height / 360 * fov))
                        }
                        .onEnded { _ in dragStart = nil })
                    .gesture(MagnifyGesture().onChanged { fov = min(110, max(25, fov / $0.magnification)) })
                if motion.isRunning && motion.camera == nil || !motion.isAvailable {
                    caption(motion.isAvailable ? "Waiting for the motion sensors…" : "No motion sensors here, so drag to look around.")
                } else {
                    caption("Hold your phone up to the sky. Pinch to zoom.")
                }
            } else {
                SkyMap(plan: plan, objects: objects, selectedID: selectedID, now: now)
            }
        }
        .background(LinearGradient(colors: [Brand.night, Brand.nightMid], startPoint: .top, endPoint: .bottom))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.horizontal, 16)
        .environment(\.colorScheme, .dark)
        .accessibilityLabel(mode == .live ? "Live sky chart that follows your phone" : "All-sky map")
    }

    private var liveCamera: SkyCamera {
        if motion.isRunning, let c = motion.camera { return c }
        return SkyCamera.looking(azimuth: panAz, altitude: panAlt)
    }

    private func caption(_ text: String) -> some View {
        VStack {
            Spacer()
            Text(text).font(.system(size: 14)).foregroundStyle(.white.opacity(0.9)).multilineTextAlignment(.center)
                .padding(.horizontal, 12).padding(.vertical, 6).background(.black.opacity(0.55), in: Capsule()).padding(.bottom, 10)
        }
            .allowsHitTesting(false)
    }

    // MARK: List

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if let s = selected { detail(s).padding(.bottom, 12) }
                ForEach(objects) { o in
                    Button { Haptics.tap(); withAnimation(.smooth(duration: 0.3)) { selectedID = selectedID == o.id ? nil : o.id }
                        if selectedID == o.id { Analytics.capture(.skyObjectSelected, ["kind": o.object.kind == .star ? "star" : "deep_sky", "equipment": equipment.rawValue]) }
                    } label: { row(o) }
                    .buttonStyle(.plain)
                    Rectangle().fill(Brand.line).frame(height: 1)
                }
                if objects.isEmpty {
                    Text("Nothing is above the horizon for \(equipment.label.lowercased()) right now. Check back after dark.")
                        .font(.system(size: 16)).foregroundStyle(Brand.muted).padding(24)
                }
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 40)
        }
    }

    private func row(_ o: VisibleObject) -> some View {
        HStack(spacing: 12) {
            Image(systemName: o.object.kind == .star ? "star.fill" : "circle.hexagongrid.fill")
                .font(.system(size: 15)).foregroundStyle(selectedID == o.id ? Brand.bg : Brand.violet)
                .frame(width: 36, height: 36)
                .background(selectedID == o.id ? Brand.violet : Brand.violetWash, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(o.object.name).font(.serif(18)).foregroundStyle(Brand.ink)
                Text(o.object.detail.capitalized).font(.system(size: 14)).foregroundStyle(Brand.muted)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(o.position.compass) \(Int(o.position.altitudeDeg.rounded()))°").font(.mono(14)).foregroundStyle(Brand.ink)
                Text("mag \(o.object.magnitude, specifier: "%.1f")").font(.mono(12, medium: false)).foregroundStyle(Brand.muted)
            }
        }
        .frame(minHeight: 56).contentShape(Rectangle())
    }

    private func detail(_ o: VisibleObject) -> some View {
        let shot = CameraAdvisor.plan(kind: o.object.kind == .star ? "bright_star" : "deep_sky", title: o.object.name, equipment: equipment, device: settings.device, moonIlluminationPct: plan.moonIlluminationPct)
        return VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                Kicker(text: "How to see it", color: Brand.violet)
                Text(o.howToSee).font(.system(size: 16)).foregroundStyle(Brand.ink).fixedSize(horizontal: false, vertical: true)
                CompassDial(position: o.position)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(16).brandCard()
            CameraPlanCard(plan: shot, device: settings.device) { camera = CameraRequest(plan: shot) }
        }
    }
}

// MARK: Live (through the phone)

private struct LiveSky: View {
    let plan: TonightPlan
    let objects: [VisibleObject]
    let camera: SkyCamera
    let fov: Double
    let selectedID: String?
    let showMoon: Bool
    let now: Date

    var body: some View {
        Canvas { ctx, size in
            let paper = Color(red: 0.95, green: 0.94, blue: 0.91)
            func project(_ p: HorizontalPosition) -> CGPoint? {
                camera.project(p, fovDeg: fov, width: size.width, height: size.height).map { CGPoint(x: $0.x, y: $0.y) }
            }
            // Horizon ring and cardinal marks, so there is always something to orient by.
            var ring = Path(); var started = false
            for az in stride(from: 0.0, through: 360, by: 4) {
                if let p = project(HorizontalPosition(altitudeDeg: 0, azimuthDeg: az)) { if started { ring.addLine(to: p) } else { ring.move(to: p); started = true } } else { started = false }
            }
            ctx.stroke(ring, with: .color(paper.opacity(0.35)), lineWidth: 1.5)
            for (label, az) in [("N", 0.0), ("NE", 45), ("E", 90), ("SE", 135), ("S", 180), ("SW", 225), ("W", 270), ("NW", 315)] {
                if let p = project(HorizontalPosition(altitudeDeg: 2, azimuthDeg: az)) {
                    ctx.draw(Text(label).font(.mono(14)).foregroundStyle(label == "N" ? Color(red: 0.93, green: 0.56, blue: 0.60) : paper.opacity(0.8)), at: CGPoint(x: p.x, y: p.y - 12))
                }
            }
            for o in objects {
                guard let p = project(o.position) else { continue }
                let selected = o.id == selectedID
                let d = o.object.kind == .star ? max(3, 9 - 1.7 * min(max(o.object.magnitude, -1.5), 4)) : 8
                let tint: Color = o.object.colorIndex < 0.2 ? Color(red: 0.8, green: 0.88, blue: 1) : o.object.colorIndex < 0.8 ? .white : Color(red: 1, green: 0.78, blue: 0.55)
                if selected { ctx.stroke(Path(ellipseIn: CGRect(x: p.x - 16, y: p.y - 16, width: 32, height: 32)), with: .color(Color(red: 0.70, green: 0.66, blue: 1)), lineWidth: 2.5) }
                if o.object.kind == .star {
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - d / 2, y: p.y - d / 2, width: d, height: d)), with: .color(tint))
                } else {
                    ctx.stroke(Path(ellipseIn: CGRect(x: p.x - d, y: p.y - d / 1.6, width: d * 2, height: d * 1.25)), with: .color(Color(red: 0.55, green: 0.85, blue: 0.9)), lineWidth: 1.8)
                }
                if o.object.magnitude < 2 || selected || (o.object.kind == .deepSky && fov < 55) {
                    ctx.draw(Text(o.object.name).font(.mono(13)).foregroundStyle(paper.opacity(0.95)), at: CGPoint(x: p.x, y: p.y + d / 2 + 9), anchor: .top)
                }
            }
            if showMoon {
                let m = Astro.moonPosition(at: now, latitude: plan.latitude, longitude: plan.longitude)
                if m.altitudeDeg > -2, let p = project(m) {
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - 11, y: p.y - 11, width: 22, height: 22)), with: .color(Brand.moonlight))
                    ctx.draw(Text("Moon").font(.mono(13)).foregroundStyle(Brand.moonlight), at: CGPoint(x: p.x, y: p.y + 24), anchor: .top)
                }
            }
            // Crosshair: what the camera is aimed at.
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            var cross = Path()
            cross.move(to: CGPoint(x: c.x - 14, y: c.y)); cross.addLine(to: CGPoint(x: c.x - 5, y: c.y))
            cross.move(to: CGPoint(x: c.x + 5, y: c.y)); cross.addLine(to: CGPoint(x: c.x + 14, y: c.y))
            cross.move(to: CGPoint(x: c.x, y: c.y - 14)); cross.addLine(to: CGPoint(x: c.x, y: c.y - 5))
            cross.move(to: CGPoint(x: c.x, y: c.y + 5)); cross.addLine(to: CGPoint(x: c.x, y: c.y + 14))
            ctx.stroke(cross, with: .color(paper.opacity(0.55)), lineWidth: 1)
            let look = camera.lookDirection
            ctx.draw(Text("\(look.compass) \(Int(look.altitudeDeg.rounded()))°").font(.mono(14)).foregroundStyle(paper.opacity(0.9)), at: CGPoint(x: size.width / 2, y: 18))
        }
    }
}

// MARK: Map (all-sky dome)

private struct SkyMap: View {
    let plan: TonightPlan
    let objects: [VisibleObject]
    let selectedID: String?
    let now: Date

    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2 - 22
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let paper = Color(red: 0.95, green: 0.94, blue: 0.91)
            func point(_ p: HorizontalPosition) -> CGPoint {
                let radius = (90 - p.altitudeDeg) / 90 * r, a = p.azimuthDeg * .pi / 180
                return CGPoint(x: c.x - sin(a) * radius, y: c.y - cos(a) * radius)
            }
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(paper.opacity(0.3)), lineWidth: 1.5)
            for alt in [30.0, 60.0] {
                let rr = (90 - alt) / 90 * r
                ctx.stroke(Path(ellipseIn: CGRect(x: c.x - rr, y: c.y - rr, width: rr * 2, height: rr * 2)), with: .color(paper.opacity(0.1)), lineWidth: 1)
            }
            for (label, az) in [("N", 0.0), ("E", 90.0), ("S", 180.0), ("W", 270.0)] {
                let a = az * .pi / 180
                ctx.draw(Text(label).font(.mono(14)).foregroundStyle(label == "N" ? Color(red: 0.93, green: 0.56, blue: 0.60) : paper.opacity(0.7)), at: CGPoint(x: c.x - sin(a) * (r + 11), y: c.y - cos(a) * (r + 11)))
            }
            for o in objects {
                let p = point(o.position)
                let d = o.object.kind == .star ? max(3, 8 - 1.5 * min(max(o.object.magnitude, -1.5), 4)) : 7
                if o.id == selectedID { ctx.stroke(Path(ellipseIn: CGRect(x: p.x - 13, y: p.y - 13, width: 26, height: 26)), with: .color(Color(red: 0.70, green: 0.66, blue: 1)), lineWidth: 2.5) }
                if o.object.kind == .star {
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - d / 2, y: p.y - d / 2, width: d, height: d)), with: .color(.white))
                } else {
                    ctx.stroke(Path(ellipseIn: CGRect(x: p.x - d, y: p.y - d / 1.6, width: d * 2, height: d * 1.25)), with: .color(Color(red: 0.55, green: 0.85, blue: 0.9)), lineWidth: 1.6)
                }
                if o.object.magnitude < 1.2 || o.id == selectedID {
                    ctx.draw(Text(o.object.name).font(.mono(12)).foregroundStyle(paper.opacity(0.9)), at: CGPoint(x: p.x, y: p.y + d / 2 + 8), anchor: .top)
                }
            }
            let m = Astro.moonPosition(at: now, latitude: plan.latitude, longitude: plan.longitude)
            if m.altitudeDeg > 0 {
                let p = point(m)
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 10, y: p.y - 10, width: 20, height: 20)), with: .color(Brand.moonlight))
            }
        }
    }
}
