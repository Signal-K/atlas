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

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Kicker(text: "Live sky", color: dim)
                    Text("Sky at \(shown.clock(in: plan.timeZone))").font(.serif(22)).foregroundStyle(paper)
                }
                Spacer()
                Text("\(plan.stars.count) well placed").font(.mono(11)).foregroundStyle(dim)
            }
            SkyDome(plan: plan, offset: offset, start: start, selected: selected)
                .aspectRatio(1, contentMode: .fit)
            VStack(spacing: 4) {
                Slider(value: $offset, in: 0...span).tint(Brand.violet)
                HStack { Text(start.clock(in: plan.timeZone)); Spacer(); Text(end.clock(in: plan.timeZone)) }
                    .font(.mono(11)).foregroundStyle(dim)
            }
            .accessibilityLabel("Time of night")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) { ForEach(plan.stars) { card($0) } }
            }
            .contentMargins(.horizontal, 16, for: .scrollContent)
            .padding(.horizontal, -16) // run edge to edge inside the card
        }
        .padding(16)
        .background(LinearGradient(colors: [Brand.night, Brand.nightMid], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .environment(\.colorScheme, .dark)
        .task {
            let target = min(max(Date().timeIntervalSince(start), 0), span)
            withAnimation(.easeOut(duration: 1.6).delay(0.2)) { offset = target }
        }
    }

    private func card(_ pick: StarPick) -> some View {
        let on = selected == pick.id
        return Button {
            Haptics.tap()
            withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                selected = on ? nil : pick.id
                offset = max(0, min(span, pick.bestTime.timeIntervalSince(start)))
            }
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                Text(pick.star.name).font(.serif(16)).foregroundStyle(paper)
                Text("\(pick.star.constellation) · mag \(pick.star.magnitude.formatted(.number.precision(.fractionLength(1))))").font(.mono(10)).foregroundStyle(dim)
                Text("\(Int(pick.bestPosition.altitudeDeg.rounded()))° \(pick.bestPosition.compass) · \(pick.bestTime.clock(in: plan.timeZone))").font(.mono(11)).foregroundStyle(paper)
                Text(pick.colour).font(.system(size: 11)).foregroundStyle(Color(red: 0.88, green: 0.66, blue: 0.30))
            }
            .padding(12).frame(width: 176, alignment: .leading)
            .background(on ? Brand.violet.opacity(0.28) : Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(on ? Brand.violet : Color.white.opacity(0.08)))
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("\(pick.star.name), \(pick.star.constellation), \(Int(pick.bestPosition.altitudeDeg.rounded())) degrees \(pick.bestPosition.compass) at \(pick.bestTime.clock(in: plan.timeZone))")
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
