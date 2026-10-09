import AtlasCore
import SwiftUI

/// Prominent stars on a live all-sky chart: a night window set into the cream page. Drag the
/// slider to turn the sky through the night; tap a star to ring it on the chart.
struct StarsCard: View {
    let plan: TonightPlan
    @State private var offset = 0.0 // seconds after `start`
    @State private var selected: String?

    private var start: Date { max(plan.nightStart, plan.darkness.civilDusk ?? plan.nightStart) }
    private var end: Date {
        let e = min(plan.nightEnd, plan.darkness.darkEnd ?? plan.nightEnd)
        return e > start ? e : start.addingTimeInterval(6 * 3600)
    }
    private var span: Double { end.timeIntervalSince(start) }
    private var shown: Date { start.addingTimeInterval(offset) }

    private let paper = Color(red: 0.95, green: 0.94, blue: 0.91)
    private let dim = Color(red: 0.95, green: 0.94, blue: 0.91).opacity(0.6)

    @State private var showChart = false
    @State private var showAll = false
    private var visible: [StarPick] { showAll ? plan.stars : Array(plan.stars.prefix(5)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(visible.enumerated()), id: \.element.id) { i, pick in
                if i > 0 { Rectangle().fill(Brand.line).frame(height: 1) }
                row(pick)
            }
            if plan.stars.count > 5 {
                Rectangle().fill(Brand.line).frame(height: 1)
                Button {
                    Haptics.tap()
                    withAnimation(.smooth(duration: 0.4)) { showAll.toggle() }
                } label: {
                    Text(showAll ? "Show fewer" : "Show all \(plan.stars.count) stars").font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Brand.violet).frame(maxWidth: .infinity).padding(12).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            Rectangle().fill(Brand.line).frame(height: 1)
            Button {
                Haptics.tap()
                withAnimation(.smooth(duration: 0.5)) { showChart.toggle() }
            } label: {
                HStack {
                    Image(systemName: showChart ? "chevron.up" : "scope")
                    Text(showChart ? "Hide sky chart" : "Show on sky chart").font(.system(size: 14, weight: .medium))
                    Spacer()
                }
                .foregroundStyle(Brand.violet).padding(14).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if showChart { chart.transition(.opacity.combined(with: .move(edge: .top))) }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .brandCard()
        .task {
            let target = min(max(Date().timeIntervalSince(start), 0), span)
            offset = target
        }
    }

    private var chart: some View {
        VStack(spacing: 8) {
            Text("Sky at \(shown.clock(in: plan.timeZone))").font(.serif(18)).foregroundStyle(paper)
            SkyDome(plan: plan, offset: offset, start: start, selected: selected).aspectRatio(1, contentMode: .fit).frame(maxWidth: 360)
            Slider(value: $offset, in: 0...span).tint(Brand.violet)
            HStack { Text(start.clock(in: plan.timeZone)); Spacer(); Text(end.clock(in: plan.timeZone)) }.font(.mono(11)).foregroundStyle(dim)
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(LinearGradient(colors: [Brand.night, Brand.nightMid], startPoint: .top, endPoint: .bottom))
        .environment(\.colorScheme, .dark)
    }

    private func row(_ pick: StarPick) -> some View {
        let on = selected == pick.id
        let alt = Int(pick.bestPosition.altitudeDeg.rounded())
        return Button {
            Haptics.tap()
            withAnimation(.smooth(duration: 0.4)) {
                selected = on ? nil : pick.id; showChart = true
                offset = max(0, min(span, pick.bestTime.timeIntervalSince(start)))
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "location.north.fill").rotationEffect(.degrees(pick.bestPosition.azimuthDeg))
                    .foregroundStyle(Brand.violet).frame(width: 34, height: 34)
                    .background(Brand.violet.opacity(0.1), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(pick.star.name).font(.serif(17)).foregroundStyle(Brand.ink)
                    Text("\(pick.star.constellation) · \(pick.colour)").font(.system(size: 13)).foregroundStyle(Brand.muted)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(pick.bestTime.clock(in: plan.timeZone)).font(.mono(13)).foregroundStyle(Brand.ink)
                    Text("\(alt)° \(pick.bestPosition.compass)").font(.mono(11, medium: false)).foregroundStyle(Brand.muted)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(pick.star.name), \(pick.star.constellation), \(alt) degrees \(pick.bestPosition.compass) at \(pick.bestTime.clock(in: plan.timeZone))")
    }
}

/// Zenith at the centre, horizon at the rim, north up with east on the left (as you see it lying
/// back and looking up). `offset` is animatable so scrubbing and the intro sweep are smooth.
struct SkyDome: View, Animatable {
    let plan: TonightPlan
    var offset: Double
    let start: Date
    let selected: String?

    nonisolated var animatableData: Double {
        get { offset }
        set { offset = newValue }
    }

    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2 - 16
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let date = start.addingTimeInterval(offset)
            let paper = Color(red: 0.95, green: 0.94, blue: 0.91)

            func point(_ p: HorizontalPosition) -> CGPoint {
                let radius = (90 - p.altitudeDeg) / 90 * r, a = p.azimuthDeg * .pi / 180
                return CGPoint(x: c.x - sin(a) * radius, y: c.y - cos(a) * radius)
            }
            let disc = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
            ctx.fill(disc, with: .radialGradient(Gradient(colors: [Color(red: 0.03, green: 0.03, blue: 0.08), Color(red: 0.10, green: 0.09, blue: 0.22)]), center: c, startRadius: 0, endRadius: r))
            ctx.stroke(disc, with: .color(paper.opacity(0.28)), lineWidth: 1.5)
            for alt in [30.0, 60.0] {
                let rr = (90 - alt) / 90 * r
                ctx.stroke(Path(ellipseIn: CGRect(x: c.x - rr, y: c.y - rr, width: rr * 2, height: rr * 2)), with: .color(paper.opacity(0.08)), lineWidth: 1)
            }
            for (label, az) in [("N", 0.0), ("E", 90.0), ("S", 180.0), ("W", 270.0)] {
                let a = az * .pi / 180
                ctx.draw(Text(label).font(.mono(11)).foregroundStyle(label == "N" ? Color(red: 0.93, green: 0.56, blue: 0.60) : paper.opacity(0.6)),
                         at: CGPoint(x: c.x - sin(a) * (r + 9), y: c.y - cos(a) * (r + 9)))
            }
            let sky = plan.sky(at: date)
            for (star, pos) in sky.stars where pos.altitudeDeg > 0 {
                let p = point(pos)
                let d = max(2, 7.5 - 1.5 * min(max(star.magnitude, -1.5), 3))
                let tint: Color = star.colorIndex < 0.2 ? Color(red: 0.8, green: 0.88, blue: 1) : star.colorIndex < 0.8 ? .white : Color(red: 1, green: 0.78, blue: 0.55)
                if star.id == selected { ctx.stroke(Path(ellipseIn: CGRect(x: p.x - 12, y: p.y - 12, width: 24, height: 24)), with: .color(Color(red: 0.70, green: 0.66, blue: 1)), lineWidth: 2) }
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - d / 2, y: p.y - d / 2, width: d, height: d)), with: .color(tint))
                if star.magnitude < 1.4 || star.id == selected {
                    ctx.draw(Text(star.name).font(.mono(10)).foregroundStyle(paper.opacity(0.85)), at: CGPoint(x: p.x, y: p.y + d / 2 + 7), anchor: .top)
                }
            }
            if sky.moon.altitudeDeg > 0 {
                let p = point(sky.moon)
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 9, y: p.y - 9, width: 18, height: 18)), with: .color(Brand.moonlight))
                ctx.draw(Text("Moon").font(.mono(10)).foregroundStyle(Brand.moonlight), at: CGPoint(x: p.x, y: p.y + 19), anchor: .top)
            }
        }
        .accessibilityLabel("All-sky chart of the brightest stars")
    }
}
