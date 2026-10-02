import AtlasCore
import SwiftUI

/// The Moon drawn at a real phase. `elongation` is animatable, so on appear the terminator can
/// sweep from new to the current phase.
struct MoonDisc: View, Animatable {
    /// Degrees, 0 new -> 180 full -> 360 new (see `MoonPhase.elongation`).
    var elongation: Double

    nonisolated var animatableData: Double {
        get { elongation }
        set { elongation = newValue }
    }

    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2 - 2
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let disc = CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)

            // earthshine: the unlit side is never fully black
            ctx.fill(Path(ellipseIn: disc), with: .color(Color(red: 0.12, green: 0.14, blue: 0.24)))

            let lit = litPath(center: c, radius: r)
            ctx.drawLayer { layer in
                layer.clip(to: lit)
                layer.fill(Path(ellipseIn: disc), with: .radialGradient(
                    Gradient(colors: [Sky.moonlight, Color(red: 0.78, green: 0.78, blue: 0.74)]),
                    center: CGPoint(x: c.x - r * 0.2, y: c.y - r * 0.25), startRadius: 0, endRadius: r * 1.2))
                // a few maria so it reads as the Moon, not a white blob
                for m in Self.maria {
                    let rect = CGRect(x: c.x + m.0 * r - m.2 * r, y: c.y + m.1 * r - m.2 * r, width: m.2 * r * 2, height: m.2 * r * 2)
                    layer.fill(Path(ellipseIn: rect), with: .color(Color(red: 0.45, green: 0.46, blue: 0.5).opacity(0.28)))
                }
            }
        }
        .shadow(color: Sky.moonlight.opacity(0.35), radius: 28)
        .aspectRatio(1, contentMode: .fit)
    }

    private static let maria: [(Double, Double, Double)] = [
        (-0.30, -0.25, 0.26), (0.18, -0.38, 0.17), (0.28, 0.05, 0.22), (-0.12, 0.28, 0.20), (-0.42, 0.10, 0.12), (0.05, 0.55, 0.10),
    ]

    /// Lit region = the limb on the lit side plus the terminator ellipse closing it.
    private func litPath(center c: CGPoint, radius r: Double) -> Path {
        let waxing = elongation < 180
        let k = cos(elongation * .pi / 180) // +1 new, 0 quarter, -1 full
        let sign: Double = waxing ? 1 : -1
        var p = Path()
        let steps = 48
        for i in 0...steps {
            let a = -Double.pi / 2 + Double.pi * Double(i) / Double(steps)
            let pt = CGPoint(x: c.x + sign * r * cos(a), y: c.y + r * sin(a))
            i == 0 ? p.move(to: pt) : p.addLine(to: pt)
        }
        for i in 0...steps {
            let a = Double.pi / 2 - Double.pi * Double(i) / Double(steps)
            p.addLine(to: CGPoint(x: c.x + sign * r * cos(a) * k, y: c.y + r * sin(a)))
        }
        p.closeSubpath()
        return p
    }
}
