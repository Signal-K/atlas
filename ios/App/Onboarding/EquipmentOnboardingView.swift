import AtlasCore
import SwiftUI

/// First-run question: what do you look at the sky with? One tap, changeable later in Settings.
struct EquipmentOnboardingView: View {
    let settings: AppSettings
    @State private var choice: Equipment = .phone

    var body: some View {
        ZStack {
            Brand.bg.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 24)
                Text("What will you look with?").font(.serif(32)).foregroundStyle(Brand.ink).fixedSize(horizontal: false, vertical: true)
                Text("Atlas shows what you can actually see with it. You can change this any time in Settings.")
                    .font(.system(size: 17)).foregroundStyle(Brand.muted).padding(.top, 10).fixedSize(horizontal: false, vertical: true)
                EquipmentPicker(selection: $choice).padding(.top, 24)
                if settings.device.name != "Your device" {
                    Label("Detected \(settings.device.summary).", systemImage: "iphone")
                        .font(.system(size: 15)).foregroundStyle(Brand.muted).padding(.top, 16)
                }
                Spacer()
                Button {
                    Haptics.success()
                    settings.equipment = choice
                    Analytics.capture(.onboardingCompleted, ["equipment": choice.rawValue, "device": settings.device.identifier])
                } label: {
                    Text("Continue").font(.system(size: 17, weight: .semibold)).foregroundStyle(Brand.bg)
                        .frame(maxWidth: .infinity, minHeight: 54).background(Brand.violet, in: Capsule())
                }
                .buttonStyle(PressableStyle())
                .padding(.bottom, 16)
            }
            .padding(.horizontal, 20).frame(maxWidth: 560)
        }
        .task { Analytics.screen("Onboarding equipment") }
    }
}

/// Three big choices, used in onboarding and Settings so they can't drift apart.
struct EquipmentPicker: View {
    @Binding var selection: Equipment

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Equipment.allCases) { e in
                let on = selection == e
                Button { Haptics.tap(); withAnimation(.smooth(duration: 0.25)) { selection = e } } label: {
                    HStack(spacing: 14) {
                        Image(systemName: e.symbol).font(.system(size: 22, weight: .medium))
                            .foregroundStyle(on ? Brand.bg : Brand.violet)
                            .frame(width: 48, height: 48).background(on ? Brand.violet : Brand.violetWash, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(e.label).font(.serif(21)).foregroundStyle(Brand.ink)
                            Text(e.blurb).font(.system(size: 15)).foregroundStyle(Brand.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: on ? "checkmark.circle.fill" : "circle").font(.system(size: 22)).foregroundStyle(on ? Brand.violet : Brand.line2)
                    }
                    .padding(14).contentShape(Rectangle())
                    .brandCard(accent: on ? Brand.violet : nil)
                }
                .buttonStyle(PressableStyle())
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
            }
        }
    }
}
