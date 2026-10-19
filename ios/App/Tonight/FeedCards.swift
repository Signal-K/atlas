import AtlasCore
import SwiftUI

extension Date {
    /// Clock time in the *place's* zone: tonight's times are for where you are, not where the phone is set.
    func clock(in zone: TimeZone) -> String { formatted(Date.FormatStyle(date: .omitted, time: .shortened, timeZone: zone)) }
}

extension View {
    /// Cards rise and settle as they scroll into view.
    func feedEntrance() -> some View {
        scrollTransition(.animated(.spring(duration: 0.5, bounce: 0.15))) { content, phase in
            content.opacity(phase.isIdentity ? 1 : 0).offset(y: phase.isIdentity ? 0 : 30).scaleEffect(phase.isIdentity ? 1 : 0.95)
        }
    }
}

// MARK: Verdict ("sky dispatch")

struct VerdictCard: View {
    let plan: TonightPlan
    let weatherProblem: String?
    @State private var fill = 0.0

    private var tint: Color {
        switch plan.rating {
        case .great, .good: Brand.green
        case .maybe: Brand.amber
        case .poor, .skip: Brand.flagship
        }
    }

    private var headline: String {
        switch plan.rating {
        case .great: "Get outside tonight."
        case .good: "A good night for photos."
        case .maybe: "Worth a look, if the clouds break."
        case .poor: "Not a great night for it."
        case .skip: "Stay in tonight."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Kicker(text: "Tonight's sky", color: Brand.amber)
                    Text(headline).font(.serif(26)).foregroundStyle(Brand.ink).fixedSize(horizontal: false, vertical: true)
                    if let reason = plan.reasons.first { Text(reason).font(.system(size: 16)).foregroundStyle(Brand.muted).fixedSize(horizontal: false, vertical: true) }
                }
                Spacer(minLength: 0)
                ZStack {
                    Circle().stroke(Brand.chip, lineWidth: 6)
                    Circle().trim(from: 0, to: fill).stroke(tint, style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90))
                    Text("\(plan.rating.rawValue)/5").font(.mono(15)).foregroundStyle(Brand.ink)
                }
                .frame(width: 62, height: 62)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Rated \(plan.rating.label), \(plan.rating.rawValue) out of 5")
            }

            HStack(spacing: 16) {
                if let c = plan.cloudCoverPct { stat("cloud.fill", "\(Int(c.rounded()))% cloud") }
                if let r = plan.precipitationChancePct, r >= 10 { stat("drop.fill", "\(Int(r.rounded()))% rain") }
                stat("moon.fill", plan.moonName)
            }
            if let weatherProblem { Label(weatherProblem, systemImage: "wifi.slash").font(.system(size: 14)).foregroundStyle(Brand.muted) }

            if let a = plan.darkness.darkStart, let b = plan.darkness.darkEnd {
                Divider().overlay(Brand.line)
                HStack(alignment: .firstTextBaseline) {
                    Text("Dark sky").font(.system(size: 16)).foregroundStyle(Brand.muted)
                    Spacer()
                    Text("\(a.clock(in: plan.timeZone)) – \(b.clock(in: plan.timeZone))").font(.mono(18)).foregroundStyle(Brand.ink)
                }
            }
            if plan.rating <= .poor, let next = plan.nextClearNight {
                Label("Better: \(Self.dayName(next.date)), \(Int(next.cloudCoverPct.rounded()))% cloud", systemImage: "arrow.forward.circle")
                    .font(.system(size: 15, weight: .medium)).foregroundStyle(Brand.green)
            }
        }
        .padding(16)
        .brandCard(accent: Brand.amber.opacity(0.7))
        .task { withAnimation(.easeOut(duration: 1.3).delay(0.25)) { fill = Double(plan.rating.rawValue) / 5 } }
    }

    private func stat(_ symbol: String, _ text: String) -> some View {
        Label(text, systemImage: symbol).font(.system(size: 15, weight: .medium)).foregroundStyle(Brand.ink.opacity(0.85))
    }

    /// "2026-10-06" -> "Tue 6 Oct" (a calendar date, so no time-zone shifting).
    static func dayName(_ key: String) -> String {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
        let f = DateFormatter(); f.calendar = cal; f.timeZone = cal.timeZone; f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: key) else { return key }
        return d.formatted(Date.FormatStyle(timeZone: cal.timeZone).weekday(.abbreviated).day().month(.abbreviated))
    }
}

// MARK: Night timeline

/// The night on one strip: twilight colours from the real sun altitude, when the Moon is up, and
/// a marker per target. Draws itself in left to right.
struct NightCard: View {
    let plan: TonightPlan
    @State private var reveal = 0.0

    private var span: (start: Date, end: Date) {
        let start = min((plan.darkness.sunset ?? plan.nightStart).addingTimeInterval(-20 * 60), plan.nightStart)
        let end = (plan.darkness.civilDawn ?? plan.nightEnd).addingTimeInterval(20 * 60)
        return (start, max(end, start.addingTimeInterval(3600)))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker(text: "Your night")
            Text("When to shoot").font(.serif(22)).foregroundStyle(Brand.ink)
            timeline.frame(height: 96)
            HStack(spacing: 14) {
                legend(Brand.moonlight, "Moon up", outlined: true)
                legend(Brand.ink, "Now")
                if !plan.targets.isEmpty { legend(Brand.violet, "Target") }
            }
            .font(.mono(10)).textCase(.uppercase).foregroundStyle(Brand.muted)

            VStack(spacing: 0) {
                ForEach(Array(plan.windows.enumerated()), id: \.element.id) { i, w in
                    if i > 0 { Divider().overlay(Brand.line) }
                    HStack(alignment: .top, spacing: 12) {
                        IconTile(symbol: icon(w.kind), size: 32)
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(w.title).font(.system(size: 15, weight: .medium)).foregroundStyle(Brand.ink)
                                Spacer()
                                Text("\(w.start.clock(in: plan.timeZone)) – \(w.end.clock(in: plan.timeZone))").font(.mono(12)).foregroundStyle(Brand.ink)
                            }
                            Text(w.detail).font(.system(size: 12)).foregroundStyle(Brand.muted).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.vertical, 10)
                }
                if plan.windows.isEmpty {
                    Text("No dark window found for this place tonight.").font(.system(size: 13)).foregroundStyle(Brand.muted).padding(.vertical, 10)
                }
            }
        }
        .padding(16).brandCard()
        .task { withAnimation(.easeInOut(duration: 1.4).delay(0.2)) { reveal = 1 } }
    }

    private func icon(_ kind: PhotoWindow.Kind) -> String {
        switch kind { case .twilight: "sunset"; case .dark: "sparkles"; case .moonless: "moon.zzz" }
    }

    private func legend(_ color: Color, _ text: String, outlined: Bool = false) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8).overlay(Circle().strokeBorder(outlined ? Brand.line2 : .clear))
            Text(text)
        }
    }

    private var timeline: some View {
        GeometryReader { geo in
            let (start, end) = span
            let width = geo.size.width, total = end.timeIntervalSince(start)
            let x: (Date) -> Double = { width * min(1, max(0, $0.timeIntervalSince(start) / total)) }
            ZStack(alignment: .topLeading) {
                Canvas { ctx, size in
                    let bar = CGRect(x: 0, y: 26, width: size.width, height: 38)
                    let columns = Int(size.width / 3)
                    for i in 0..<columns {
                        let t = start.addingTimeInterval(total * (Double(i) + 0.5) / Double(columns))
                        let alt = Astro.sunAltitude(at: t, latitude: plan.latitude, longitude: plan.longitude)
                        let rect = CGRect(x: size.width * Double(i) / Double(columns), y: bar.minY, width: size.width / Double(columns) + 0.5, height: bar.height)
                        ctx.fill(Path(rect), with: .color(Self.skyColour(sunAltitude: alt)))
                        if Astro.moonPosition(at: t, latitude: plan.latitude, longitude: plan.longitude).altitudeDeg > 0 {
                            ctx.fill(Path(CGRect(x: rect.minX, y: bar.maxY - 5, width: rect.width, height: 5)), with: .color(Brand.moonlight))
                        }
                    }
                    var cal = Calendar(identifier: .gregorian); cal.timeZone = plan.timeZone
                    var tick = cal.nextDate(after: start, matching: DateComponents(minute: 0), matchingPolicy: .nextTime) ?? start
                    while tick < end {
                        let tx = size.width * tick.timeIntervalSince(start) / total
                        if cal.component(.hour, from: tick) % 2 == 0 {
                            ctx.draw(Text(tick.formatted(Date.FormatStyle(timeZone: plan.timeZone).hour())).font(.mono(10)).foregroundStyle(Brand.muted), at: CGPoint(x: tx, y: bar.maxY + 12))
                        }
                        tick = tick.addingTimeInterval(3600)
                    }
                }
                .mask(alignment: .leading) { Rectangle().frame(width: width * reveal) }

                ForEach(plan.targets) { t in
                    Circle().fill(Brand.violet).frame(width: 10, height: 10).overlay(Circle().strokeBorder(Brand.surface, lineWidth: 2))
                        .position(x: min(max(x(t.bestTime), 8), width - 8), y: 14)
                        .opacity(reveal > 0.9 ? 1 : 0).animation(.easeIn(duration: 0.4), value: reveal)
                }
                if plan.nightStart >= start && plan.nightStart <= end {
                    Rectangle().fill(Brand.ink).frame(width: 2, height: 46).position(x: x(plan.nightStart), y: 45).opacity(reveal)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Timeline of tonight from sunset to dawn")
    }

    /// Sun altitude -> sky colour: warm at the horizon, violet through twilight, deep navy by -18.
    static func skyColour(sunAltitude a: Double) -> Color {
        let stops: [(Double, (Double, Double, Double))] = [
            (10, (0.97, 0.78, 0.55)), (0, (0.95, 0.58, 0.42)), (-6, (0.55, 0.38, 0.65)), (-12, (0.22, 0.18, 0.45)), (-18, (0.05, 0.05, 0.12)),
        ]
        if a >= stops[0].0 { let c = stops[0].1; return Color(red: c.0, green: c.1, blue: c.2) }
        if a <= stops.last!.0 { let c = stops.last!.1; return Color(red: c.0, green: c.1, blue: c.2) }
        for i in 0..<stops.count - 1 where a <= stops[i].0 && a >= stops[i + 1].0 {
            let t = (stops[i].0 - a) / (stops[i].0 - stops[i + 1].0), c0 = stops[i].1, c1 = stops[i + 1].1
            return Color(red: c0.0 + (c1.0 - c0.0) * t, green: c0.1 + (c1.1 - c0.1) * t, blue: c0.2 + (c1.2 - c0.2) * t)
        }
        return Brand.night
    }
}

// MARK: Rows & cards

struct TargetCard: View {
    let target: PhotoTarget
    let timeZone: TimeZone
    let onTap: () -> Void

    private var category: EventCategory? { EventCategory.forKind(target.event.kind) }

    var body: some View {
        Button(action: { Haptics.tap(); onTap() }) {
            HStack(alignment: .top, spacing: 12) {
                IconTile(symbol: category?.symbol ?? "sparkles", size: 40)
                VStack(alignment: .leading, spacing: 7) {
                    Kicker(text: "\(category?.label ?? "Sky event") · \(target.meta.difficulty.rawValue)")
                    Text(target.event.title).font(.serif(19)).foregroundStyle(Brand.ink).multilineTextAlignment(.leading)
                    if !target.event.description.isEmpty {
                        Text(target.event.description).font(.system(size: 15)).foregroundStyle(Brand.muted).lineLimit(2).multilineTextAlignment(.leading)
                    }
                    FlowLayout(spacing: 6, alignment: .leading) {
                        Badge(text: "Best \(target.bestTime.clock(in: timeZone))", symbol: "clock", tint: Brand.ink)
                        if let d = target.direction { Badge(text: "\(d.compass) \(Int(d.altitudeDeg.rounded()))°", symbol: "location.north.line", tint: Brand.violet) }
                        Badge(text: target.meta.phoneFriendly ? "Phone" : "Camera + tripod", symbol: target.meta.phoneFriendly ? "iphone" : "camera.aperture")
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Brand.muted.opacity(0.6)).padding(.top, 4)
            }
            .padding(14)
            .contentShape(Rectangle())
            .brandCard()
        }
        .buttonStyle(PressableStyle())
        .accessibilityHint("Opens details")
    }
}

struct MessageCard: View {
    let symbol: String
    let kicker: String
    let title: String
    let detail: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            IconTile(symbol: symbol, size: 40)
            Kicker(text: kicker)
            Text(title).font(.serif(20)).foregroundStyle(Brand.ink)
            Text(detail).font(.system(size: 16)).foregroundStyle(Brand.muted).fixedSize(horizontal: false, vertical: true)
            if let action, let actionTitle {
                Button(action: action) {
                    Text(actionTitle).font(.system(size: 14, weight: .semibold)).foregroundStyle(Brand.bg)
                        .padding(.horizontal, 18).frame(minHeight: 40).background(Brand.violet, in: Capsule())
                }.buttonStyle(PressableStyle())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16).brandCard()
    }
}

struct DayGroup: Identifiable {
    let id: String
    let label: String
    let events: [SkyEvent]

    static func make(_ events: [SkyEvent], zone: TimeZone, now: Date = Date()) -> [DayGroup] {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = zone
        func key(_ d: Date) -> String { let c = cal.dateComponents([.year, .month, .day], from: d); return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!) }
        let tomorrow = key(cal.date(byAdding: .day, value: 1, to: now) ?? now)
        let byDay = Dictionary(grouping: events) { key($0.startsAt) }
        return byDay.keys.sorted().map { k in
            let first = byDay[k]![0].startsAt
            let label = k == key(now) ? "Today" : k == tomorrow ? "Tomorrow"
                : first.formatted(Date.FormatStyle(timeZone: zone).weekday(.abbreviated).day().month(.abbreviated))
            return DayGroup(id: k, label: label, events: byDay[k]!.sorted { $0.startsAt < $1.startsAt })
        }
    }
}

struct DayPill: View {
    let label: String
    var body: some View {
        HStack(spacing: 10) {
            Text(label.uppercased()).font(.mono(13)).tracking(1.2).foregroundStyle(Brand.ink)
                .padding(.horizontal, 10).padding(.vertical, 4).background(Brand.surface2, in: Capsule())
            Rectangle().fill(Brand.line).frame(height: 1)
        }
        .padding(.top, 8).padding(.bottom, 8)
    }
}

struct EventRow: View {
    let event: SkyEvent
    let timeZone: TimeZone
    let onTap: () -> Void

    var body: some View {
        let category = EventCategory.forKind(event.kind)
        Button(action: { Haptics.tap(); onTap() }) {
            HStack(spacing: 12) {
                IconTile(symbol: category?.symbol ?? "sparkles", size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text((category?.label ?? "Sky event").uppercased()).font(.mono(12)).tracking(1).foregroundStyle(Brand.muted)
                    Text(event.title).font(.system(size: 16, weight: .medium)).foregroundStyle(Brand.ink).lineLimit(2).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                Text(event.startsAt.clock(in: timeZone)).font(.mono(14)).foregroundStyle(Brand.ink)
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(Brand.muted.opacity(0.5))
            }
            .padding(.horizontal, 14).frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Rows with hairline dividers inside one rounded border (`.az-row-group`).
struct RowGroup<Item: Identifiable, Row: View>: View {
    let items: [Item]
    @ViewBuilder let row: (Item) -> Row

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                if i > 0 { Rectangle().fill(Brand.line).frame(height: 1) }
                row(item)
            }
        }
        .brandCard()
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: Detail

enum DetailItem: Identifiable {
    case target(PhotoTarget)
    case event(SkyEvent)
    var id: String { switch self { case .target(let t): "t-" + t.id; case .event(let e): "e-" + e.id } }
}

struct DetailSheet: View {
    let item: DetailItem
    let timeZone: TimeZone
    let device: DeviceProfile
    /// Settings recommended for this event, and the action that opens the camera with them.
    let camera: CameraPlan
    let openCamera: (CameraPlan) -> Void

    private var event: SkyEvent { switch item { case .target(let t): t.event; case .event(let e): e } }
    private var target: PhotoTarget? { if case .target(let t) = item { t } else { nil } }
    private var category: EventCategory? { EventCategory.forKind(event.kind) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    IconTile(symbol: category?.symbol ?? "sparkles", size: 40)
                    Kicker(text: category?.label ?? "Sky event", color: Brand.violet)
                }
                Text(event.title).font(.serif(28)).foregroundStyle(Brand.ink)
                if !event.description.isEmpty { Text(event.description).font(.system(size: 17)).foregroundStyle(Brand.muted) }

                VStack(alignment: .leading, spacing: 4) {
                    Kicker(text: target == nil ? "When" : "Best at")
                    Text(target.map { $0.bestTime.clock(in: timeZone) } ?? event.startsAt.formatted(Date.FormatStyle(timeZone: timeZone).weekday(.wide).day().month(.abbreviated).hour().minute()))
                        .font(.mono(20)).foregroundStyle(Brand.ink)
                }
                if let direction = target?.direction { CompassDial(position: direction) }
                if let t = target {
                    FlowLayout(spacing: 6, alignment: .leading) {
                        Badge(text: t.meta.difficulty.rawValue, symbol: "gauge.with.dots.needle.33percent", tint: Brand.ink)
                        Badge(text: t.meta.phoneFriendly ? "Phone-friendly" : "Camera + tripod", symbol: t.meta.phoneFriendly ? "iphone" : "camera.aperture")
                        if t.meta.nakedEye { Badge(text: "Naked eye", symbol: "eye") }
                    }
                    Text(t.meta.reason).font(.system(size: 16)).foregroundStyle(Brand.ink)
                    Label(t.viewingNote, systemImage: "cloud.sun").font(.system(size: 15)).foregroundStyle(Brand.muted)
                }
                CameraPlanCard(plan: camera, device: device) { openCamera(camera) }
                if let content = event.content, !content.isEmpty { Text(content).font(.system(size: 16)).foregroundStyle(Brand.muted) }
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(24)
        }
        .background(Brand.bg)
    }
}

/// "Point your camera here": a compass ring whose needle swings to the azimuth, with the altitude as a gauge.
struct CompassDial: View {
    let position: HorizontalPosition
    @State private var azimuth = 0.0
    @State private var altitude = 0.0

    var body: some View {
        HStack(spacing: 22) {
            ZStack {
                Circle().strokeBorder(Brand.line2, lineWidth: 1.5)
                ForEach(0..<4, id: \.self) { i in
                    let a = Double(i) * .pi / 2
                    Text(["N", "E", "S", "W"][i]).font(.mono(12)).foregroundStyle(i == 0 ? Brand.flagship : Brand.muted)
                        .offset(x: sin(a) * 50, y: -cos(a) * 50)
                }
                Needle().fill(Brand.violet).frame(width: 10, height: 70).rotationEffect(.degrees(azimuth))
                Circle().fill(Brand.ink).frame(width: 7, height: 7)
            }
            .frame(width: 128, height: 128)

            VStack(alignment: .leading, spacing: 8) {
                Text("Look \(position.compass)").font(.serif(20)).foregroundStyle(Brand.ink)
                VStack(alignment: .leading, spacing: 4) {
                    Capsule().fill(Brand.chip).frame(width: 120, height: 6)
                        .overlay(alignment: .leading) { Capsule().fill(Brand.violet).frame(width: 120 * min(1, max(0, altitude / 90)), height: 6) }
                    Text("\(Int(position.altitudeDeg.rounded()))° above the horizon").font(.mono(13)).foregroundStyle(Brand.muted)
                }
                Text(note).font(.system(size: 14)).foregroundStyle(Brand.muted)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Look \(position.compass), \(Int(position.altitudeDeg.rounded())) degrees above the horizon")
        .task {
            withAnimation(.spring(response: 1.2, dampingFraction: 0.65).delay(0.2)) { azimuth = position.azimuthDeg }
            withAnimation(.easeOut(duration: 1.2).delay(0.2)) { altitude = position.altitudeDeg }
        }
    }

    private var note: String {
        switch position.altitudeDeg {
        case ..<20: "Low — needs a clear horizon"
        case ..<50: "Comfortable framing height"
        default: "High overhead — tilt the tripod up"
        }
    }
}

private struct Needle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY)); p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.midY + 6)); p.addLine(to: CGPoint(x: rect.minX, y: rect.midY)); p.closeSubpath()
        return p
    }
}
