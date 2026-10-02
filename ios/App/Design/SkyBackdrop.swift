import SwiftUI

/// The persistent star field behind every screen: a slowly rotating sky with twinkling stars,
/// a shooting star every so often, a warm horizon glow and a ridge silhouette.
/// `drift` is parallax from scrolling; `warp` stretches stars radially for the sign-in jump.
struct SkyBackdrop: View, Animatable {
    var drift: Double = 0
    var warp: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    nonisolated var animatableData: AnimatablePair<Double, Double> {
        get { .init(drift, warp) }
        set { drift = newValue.first; warp = newValue.second }
    }

    private struct Star { let x, y, size, depth, phase, speed, hue: Double }

    private static let stars: [Star] = {
        var rng = SeededGenerator(seed: 0xA71A5)
        return (0..<240).map { _ in
            Star(x: .random(in: 0...1, using: &rng), y: .random(in: 0...1, using: &rng),
                 size: .random(in: 0.5...2.1, using: &rng) , depth: .random(in: 0.2...1, using: &rng),
                 phase: .random(in: 0...(2 * .pi), using: &rng), speed: .random(in: 0.4...2.2, using: &rng),
                 hue: .random(in: 0...1, using: &rng))
        }
    }()

    var body: some View {
        ZStack {
            LinearGradient(stops: [
                .init(color: Sky.zenith, location: 0),
                .init(color: Sky.mid, location: 0.55),
                .init(color: Sky.horizon, location: 0.9),
                .init(color: Sky.ember.opacity(0.7), location: 1),
            ], startPoint: .top, endPoint: .bottom)

            TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion && warp == 0)) { timeline in
                Canvas { ctx, size in
                    draw(&ctx, size: size, time: reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate)
                }
            }

            RadialGradient(colors: [Sky.ember.opacity(0.35 * (1 - warp)), .clear],
                           center: .init(x: 0.5, y: 1.02), startRadius: 0, endRadius: 420)
                .blendMode(.screen)
                .allowsHitTesting(false)

            Ridge().fill(LinearGradient(colors: [Color.black.opacity(0.85), Sky.zenith], startPoint: .bottom, endPoint: .top))
                .frame(height: 90).frame(maxHeight: .infinity, alignment: .bottom)
                .offset(y: warp * 120)
                .allowsHitTesting(false)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    private func draw(_ ctx: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        let center = CGPoint(x: size.width * 0.5, y: size.height * 0.72)
        let spin = time * 0.004 // the whole dome turns about the pole, barely perceptibly
        let cs = cos(spin), sn = sin(spin)
        for star in Self.stars {
            var p = CGPoint(x: (star.x - 0.5) * size.width * 1.5, y: (star.y - 0.5) * size.height * 1.5)
            p = CGPoint(x: p.x * cs - p.y * sn, y: p.x * sn + p.y * cs)
            p.x += center.x
            p.y += center.y * 0.7 - drift * star.depth * 0.25
            // keep stars on screen as the dome rotates and drift wraps
            p.y = p.y.truncatingRemainder(dividingBy: size.height); if p.y < 0 { p.y += size.height }

            let twinkle = 0.55 + 0.45 * sin(time * star.speed + star.phase)
            let alpha = (0.35 + 0.65 * star.depth) * twinkle
            // dim into the horizon glow
            let fade = max(0, 1 - max(0, (p.y / size.height - 0.78)) * 4.5)
            let tint = star.hue < 0.12 ? Color(red: 1, green: 0.85, blue: 0.7)
                : star.hue > 0.88 ? Color(red: 0.7, green: 0.85, blue: 1) : Color.white
            let color = tint.opacity(alpha * fade)

            if warp > 0.02 {
                let dx = p.x - center.x, dy = p.y - center.y
                let tail = warp * 0.55 * star.depth
                var line = Path()
                line.move(to: p)
                line.addLine(to: CGPoint(x: p.x + dx * tail, y: p.y + dy * tail))
                ctx.stroke(line, with: .color(color), style: StrokeStyle(lineWidth: star.size * (0.6 + warp), lineCap: .round))
            } else {
                let d = star.size * (0.8 + star.depth * 0.6)
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - d / 2, y: p.y - d / 2, width: d, height: d)), with: .color(color))
            }
        }
        if !reduceMotion, warp < 0.02 { shootingStar(&ctx, size: size, time: time) }
    }

    /// One streak every ~9 seconds, at a position/angle that changes each time.
    private func shootingStar(_ ctx: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        let period = 9.0, life = 0.9
        let n = floor(time / period), t = (time - n * period) / life
        guard t < 1 else { return }
        var rng = SeededGenerator(seed: UInt64(abs(n)) &+ 7)
        let start = CGPoint(x: .random(in: 0.2...0.9, using: &rng) * size.width, y: .random(in: 0.05...0.35, using: &rng) * size.height)
        let travel = CGPoint(x: -140, y: 70)
        let head = CGPoint(x: start.x + travel.x * t, y: start.y + travel.y * t)
        let tail = CGPoint(x: head.x - travel.x * 0.35, y: head.y - travel.y * 0.35)
        var path = Path(); path.move(to: tail); path.addLine(to: head)
        ctx.stroke(path, with: .linearGradient(Gradient(colors: [.clear, .white.opacity(1 - t)]), startPoint: tail, endPoint: head),
                   style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
    }
}

private struct Ridge: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: rect.maxY))
        let steps = 48
        for i in 0...steps {
            let x = rect.width * Double(i) / Double(steps)
            let y = rect.midY + 14 * sin(Double(i) * 0.55) + 10 * sin(Double(i) * 1.3 + 1) - 10 * sin(Double(i) * 0.12)
            p.addLine(to: CGPoint(x: x, y: y))
        }
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

/// Deterministic so the star map is the same every launch.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E3779B97F4A7C15 }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}
