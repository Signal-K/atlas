import AtlasCore
import SwiftUI

/// Everything you can change: equipment, alerts, and (one tap in) your account. Replaces the old
/// account-only sheet as the single place behind the gear button.
struct SettingsSheet: View {
    let settings: AppSettings
    let session: SessionStore
    let skyPass: SkyPassStore
    /// Called after alert preferences change so the home screen can reschedule.
    let alertsChanged: () -> Void
    let openSkyPass: () -> Void
    let dismiss: () -> Void

    @State private var permission: AlertScheduler.Permission = .notDetermined
    @State private var showAccount = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    equipment
                    alerts
                    phone
                    account
                }
                .padding(20)
            }
            .background(Brand.bg)
            .navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .navigationDestination(isPresented: $showAccount) {
                AccountSheet(session: session, skyPass: skyPass, openSkyPass: openSkyPass, dismiss: dismiss)
            }
        }
        .task { permission = await AlertScheduler.permission(); Analytics.screen("Settings") }
    }

    private var equipmentBinding: Binding<Equipment> {
        Binding(get: { settings.equipment ?? .phone }, set: { new in
            guard new != settings.equipment else { return }
            settings.equipment = new
            Analytics.capture(.equipmentChanged, ["equipment": new.rawValue])
        })
    }

    private var equipment: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker(text: "What you look with")
            EquipmentPicker(selection: equipmentBinding)
        }
    }

    private var alerts: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker(text: "Alerts")
            VStack(spacing: 0) {
                toggleRow("Clear nights", "Tells you when to go outside, based on the cloud forecast.", isOn: Binding(
                    get: { settings.clearNightAlerts }, set: { change(\.clearNightAlerts, $0, name: "clear_nights") }))
                Rectangle().fill(Brand.line).frame(height: 1)
                toggleRow("Sky events", "Eclipses, conjunctions and meteor showers, when the sky should be clear.", isOn: Binding(
                    get: { settings.eventAlerts }, set: { change(\.eventAlerts, $0, name: "events") }))
            }
            .brandCard()
            if permission == .denied && settings.anyAlertsOn {
                Button { if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) } } label: {
                    Label("Notifications are off for Atlas. Turn them on in Settings.", systemImage: "bell.slash")
                        .font(.system(size: 15, weight: .medium)).foregroundStyle(Brand.flagship).multilineTextAlignment(.leading)
                }
            }
        }
    }

    private func toggleRow(_ title: String, _ detail: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 17, weight: .medium)).foregroundStyle(Brand.ink)
                Text(detail).font(.system(size: 14)).foregroundStyle(Brand.muted).fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(Brand.violet).padding(14)
    }

    private func change(_ key: ReferenceWritableKeyPath<AppSettings, Bool>, _ value: Bool, name: String) {
        settings[keyPath: key] = value
        Analytics.capture(.alertSettingChanged, ["setting": name, "on": value])
        Task {
            if value, await AlertScheduler.permission() == .notDetermined { await AlertScheduler.requestPermission() }
            permission = await AlertScheduler.permission()
            alertsChanged()
        }
    }

    private var phone: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker(text: "Your phone")
            HStack(spacing: 12) {
                IconTile(symbol: "iphone", size: 40)
                VStack(alignment: .leading, spacing: 3) {
                    Text(settings.device.name).font(.serif(19)).foregroundStyle(Brand.ink)
                    Text(settings.device.summary == settings.device.name ? "Camera advice uses your phone's real limits." : settings.device.summary.replacingOccurrences(of: "\(settings.device.name): ", with: "").capitalizedFirst)
                        .font(.system(size: 14)).foregroundStyle(Brand.muted)
                }
                Spacer(minLength: 0)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading).brandCard()
        }
    }

    private var account: some View {
        Button { Haptics.tap(); showAccount = true } label: {
            HStack(spacing: 12) {
                IconTile(symbol: "person.crop.circle", size: 40)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Account and Sky Pass").font(.system(size: 17, weight: .medium)).foregroundStyle(Brand.ink)
                    Text(session.email ?? "Looking as a guest").font(.system(size: 14)).foregroundStyle(Brand.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Brand.muted.opacity(0.6))
            }
            .padding(14).contentShape(Rectangle()).brandCard()
        }
        .buttonStyle(PressableStyle())
    }
}

private extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
