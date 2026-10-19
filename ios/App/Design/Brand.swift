import SwiftUI
import UIKit

/// Atlas's visual identity, ported from the web app's design system (src/styles/atlas.css): warm
/// paper in light, near-black violet in dark, a violet accent, serif editorial headlines, mono
/// kickers and Oxanium for the wordmark. Keep the two in step.
enum Brand {
    private static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }

    static let bg = dynamic(0xF6F4EF, 0x0A0A11)
    static let surface = dynamic(0xFFFEFB, 0x14141E)
    static let surface2 = dynamic(0xF1EEE7, 0x1C1C28)
    static let ink = dynamic(0x16151C, 0xF1EFE9)
    static let muted = dynamic(0x6B6875, 0x9B98A8)
    static let line = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: 0xF1EFE9, alpha: 0.13) : UIColor(hex: 0x16151C, alpha: 0.10) })
    static let line2 = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: 0xF1EFE9, alpha: 0.26) : UIColor(hex: 0x16151C, alpha: 0.22) })
    static let chip = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: 0xF1EFE9, alpha: 0.07) : UIColor(hex: 0x16151C, alpha: 0.05) })

    static let violet = dynamic(0x6F63B8, 0xB3A9FF)
    static let violetWash = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: 0xB3A9FF, alpha: 0.14) : UIColor(hex: 0x8378CF, alpha: 0.12) })
    static let teal = dynamic(0x009CA5, 0x4FD0D8)
    static let amber = dynamic(0xA16100, 0xE0A84C)
    static let green = dynamic(0x4E9A52, 0x7FD083)
    static let flagship = dynamic(0xC8626D, 0xEE8E98)

    /// The Moon is the same warm cream in both modes.
    static let moonlight = Color(red: 0.96, green: 0.94, blue: 0.86)
    /// The all-sky chart is always a night window, even on cream paper.
    static let night = Color(red: 0.04, green: 0.04, blue: 0.07)
    static let nightMid = Color(red: 0.08, green: 0.08, blue: 0.16)
}

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
    }
}

// MARK: Type

extension Font {
    /// Wordmark and big numerals.
    static func display(_ size: CGFloat) -> Font { .custom("Oxanium", size: size, relativeTo: .title).weight(.bold) }
    /// Editorial headlines ("Tonight's sky, reported.").
    static func serif(_ size: CGFloat, bold: Bool = true) -> Font {
        .custom(bold ? "IowanOldStyle-Bold" : "IowanOldStyle-Roman", size: size, relativeTo: .title2)
    }
    /// Kickers, times and counts.
    static func mono(_ size: CGFloat, medium: Bool = true) -> Font {
        .custom(medium ? "IBMPlexMono-Medium" : "IBMPlexMono", size: size, relativeTo: .caption)
    }
}

/// `SKY DISPATCH`: small uppercase mono label.
struct Kicker: View {
    let text: String
    var color: Color = Brand.muted
    var body: some View {
        Text(text.uppercased()).font(.mono(12)).tracking(1.4).foregroundStyle(color)
    }
}

// MARK: Surfaces

extension View {
    /// The Atlas card: surface fill, hairline border, optionally an accent border (the dispatch card).
    func brandCard(accent: Color? = nil, radius: CGFloat = 14) -> some View {
        background(Brand.surface, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(accent ?? Brand.line, lineWidth: accent == nil ? 1 : 1.5))
    }

    @ViewBuilder func emailEntry() -> some View {
        self.keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().textContentType(.username)
    }
}

/// The 32pt rounded icon tile used at the leading edge of rows.
struct IconTile: View {
    let symbol: String
    var size: CGFloat = 34
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.46, weight: .medium))
            .foregroundStyle(Brand.violet)
            .frame(width: size, height: size)
            .background(Brand.chip, in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
    }
}

/// Filter-style pill: ink-filled when active, bordered otherwise (`.az-chip`).
struct BrandChip: View {
    let label: String
    var count: Int?
    var symbol: String?
    var active = false
    var body: some View {
        HStack(spacing: 6) {
            if let symbol { Image(systemName: symbol).font(.system(size: 12, weight: .medium)) }
            Text(label).font(.system(size: 13, weight: .medium))
            if let count { Text("\(count)").font(.mono(11)).opacity(0.5) }
        }
        .padding(.horizontal, 13).frame(minHeight: 36)
        .foregroundStyle(active ? Brand.bg : Brand.ink)
        .background(active ? Brand.ink : Brand.surface, in: Capsule())
        .overlay(Capsule().strokeBorder(active ? .clear : Brand.line))
    }
}

/// A small non-interactive tag ("Easy", "Phone-friendly").
struct Badge: View {
    let text: String
    var symbol: String?
    var tint: Color = Brand.muted
    var body: some View {
        HStack(spacing: 4) {
            if let symbol { Image(systemName: symbol).font(.system(size: 10, weight: .medium)) }
            Text(text).font(.mono(10))
        }
        .textCase(.uppercase)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .foregroundStyle(tint)
        .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(tint.opacity(0.5)))
    }
}

/// Section head: kicker on the left, optional trailing text (a count) on the right.
struct SectionHead: View {
    let kicker: String
    var trailing: String?
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Kicker(text: kicker)
            Spacer()
            if let trailing { Text(trailing).font(.mono(13)).foregroundStyle(Brand.muted) }
        }
        .padding(.top, 26).padding(.bottom, 10)
        .accessibilityAddTraits(.isHeader)
    }
}

struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.65), value: configuration.isPressed)
    }
}

@MainActor enum Haptics {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func failure() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
}

// MARK: Logo

/// The hedgehog on the crescent moon, in the white disc the web app uses.
struct AtlasMark: View {
    var size: CGFloat = 36
    var body: some View {
        Image("AtlasMark")
            .resizable().scaledToFit()
            .padding(size * 0.1)
            .frame(width: size, height: size)
            .background(Color.white, in: Circle())
            .shadow(color: .black.opacity(0.12), radius: size * 0.16, y: size * 0.06)
            .accessibilityHidden(true)
    }
}
