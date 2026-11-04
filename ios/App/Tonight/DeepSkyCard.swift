import AtlasCore
import SwiftUI

/// "Through your telescope tonight" (ASV-154): up to six rewarding deep-sky targets for the chosen
/// gear, each with a best time, a direction and a short how-to. The gear defaults from onboarding's
/// equipment and the pick is remembered. Mirrors the web card on the Events page.
struct DeepSkyCard: View {
    let plan: TonightPlan
    let equipment: Equipment?

    @AppStorage("atlas.deepSkyGear") private var storedGear = ""

    private var gear: DeepSkyGear { DeepSkyGear(rawValue: storedGear) ?? .defaultFor(equipment) }

    private var tonight: DeepSkyTonight {
        DeepSkyPlanner.tonight(now: Date(), latitude: plan.latitude, longitude: plan.longitude, timeZone: plan.timeZone, gear: gear)
    }

    private var title: String {
        switch gear {
        case .small, .large: "Through your telescope tonight"
        case .binoculars: "Through your binoculars tonight"
        case .eye: "Deep sky by eye tonight"
        }
    }

    var body: some View {
        let result = tonight
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.serif(22)).foregroundStyle(Brand.ink).accessibilityAddTraits(.isHeader)
                Text(result.summary).font(.system(size: 15)).foregroundStyle(Brand.muted).fixedSize(horizontal: false, vertical: true)
            }
            gearPicker
            VStack(spacing: 10) {
                ForEach(result.picks) { pick in
                    DeepSkyPickRow(pick: pick, timeZone: plan.timeZone)
                }
            }
            Text("Dark from \(Self.time(result.windowStart, plan.timeZone)) to \(Self.time(result.windowEnd, plan.timeZone)) · Moon \(result.moonIlluminationPct)% lit")
                .font(.mono(12)).foregroundStyle(Brand.muted)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).brandCard()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("deep-sky-card")
    }

    private var gearPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(DeepSkyGear.allCases) { option in
                    let selected = option == gear
                    Button {
                        guard !selected else { return }
                        Haptics.tap()
                        storedGear = option.rawValue
                        Analytics.capture(.deepSkyGearChanged, ["gear": option.rawValue])
                    } label: {
                        Text(option.shortLabel).font(.system(size: 15, weight: .medium))
                            .foregroundStyle(selected ? Brand.violet : Brand.muted)
                            .padding(.horizontal, 14).frame(minHeight: 44)
                            .background(selected ? Brand.violetWash : Brand.chip, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(option.label)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .accessibilityIdentifier("deep-sky-gear-\(option.rawValue)")
                }
            }
        }
    }

    static func time(_ date: Date, _ zone: TimeZone) -> String {
        let f = DateFormatter()
        f.timeZone = zone
        f.dateFormat = "h:mm a"
        return f.string(from: date)
    }
}

private struct DeepSkyPickRow: View {
    let pick: DeepSkyPick
    let timeZone: TimeZone

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(pick.name).font(.system(size: 17, weight: .semibold)).foregroundStyle(Brand.ink)
                Spacer(minLength: 8)
                Kicker(text: pick.classLabel, color: Brand.violet)
            }
            Text("Best around \(DeepSkyCard.time(pick.bestAt, timeZone)) · \(pick.altitudeDeg)° up, \(pick.direction)")
                .font(.system(size: 15)).foregroundStyle(Brand.ink.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            Text(pick.howTo).font(.system(size: 14)).foregroundStyle(Brand.muted).fixedSize(horizontal: false, vertical: true)
            if pick.moonPenalty >= 0.3, let sep = pick.moonSeparationDeg {
                Text("Moonlight will wash it out a little (\(sep)° from the Moon).").font(.system(size: 13)).foregroundStyle(Brand.amber)
            }
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.surface2.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("deep-sky-pick-\(pick.id)")
    }
}
