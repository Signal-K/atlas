import SwiftUI

/// Atlas's paper with its scatter of violet, crimson and navy stars. `drift` moves the dots at
/// different rates as the feed scrolls; `warp` stretches them radially for the sign-in jump.
struct PaperBackdrop: View, Animatable {
    var drift: Double = 0
    var warp: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    nonisolated var animatableData: AnimatablePair<Double, Double> {
        get { .init(drift, warp) }
        set { drift = newValue.first; warp = newValue.second }
    }

    private struct Dot { let x, y, size, depth, phase, speed: Double; let tint: Int }

    private static let dots: [Dot] = {
        var rng = SeededGenerator(seed: 0xA71A5)
        return (0..<150).map { _ in
            Dot(x: .random(in: 0...1, using: &rng), y: .random(in: 0...1, using: &rng), size: .random(in: 1...3.2, using: &rng),
                depth: .random(in: 0.2...1, using: &rng), phase: .random(in: 0...(2 * .pi), using: &rng),
                speed: .random(in: 0.3...1.6, using: &rng), tint: Int.random(in: 0..<5, using: &rng))
        }
    }()

    private static let tints: [Color] = [
        Color(red: 0.55, green: 0.40, blue: 0.95), Color(red: 0.78, green: 0.25, blue: 0.40), Color(red: 0.16, green: 0.20, blue: 0.55),
        Color(red: 0.70, green: 0.62, blue: 1.0), Color(red: 0.35, green: 0.30, blue: 0.60),
    ]

    var body: some View {
        ZStack {
            Brand.bg
            TimelineView(.animation(minimumInterval: 1 / 24, paused: reduceMotion && warp == 0)) { timeline in
                Canvas { ctx, size in
                    draw(&ctx, size: size, time: reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate)
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    private func draw(_ ctx: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        for dot in Self.dots {
            var p = CGPoint(x: dot.x * size.width, y: dot.y * size.height - drift * dot.depth * 0.35 + time * dot.depth * 1.2)
            p.y = p.y.truncatingRemainder(dividingBy: size.height); if p.y < 0 { p.y += size.height }
            let twinkle = 0.55 + 0.45 * sin(time * dot.speed + dot.phase)
            let color = Self.tints[dot.tint].opacity((0.25 + 0.55 * dot.depth) * twinkle)
            if warp > 0.02 {
                let dx = p.x - center.x, dy = p.y - center.y, tail = warp * 0.55 * dot.depth
                var line = Path(); line.move(to: p); line.addLine(to: CGPoint(x: p.x + dx * tail, y: p.y + dy * tail))
                ctx.stroke(line, with: .color(color), style: StrokeStyle(lineWidth: dot.size * (0.5 + warp), lineCap: .round))
            } else {
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - dot.size / 2, y: p.y - dot.size / 2, width: dot.size, height: dot.size)), with: .color(color))
            }
        }
    }
}

/// Deterministic so the scatter is the same every launch.
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
