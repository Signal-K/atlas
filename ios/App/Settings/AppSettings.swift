import AtlasCore
import Foundation
import Observation

/// Per-device preferences: what you observe with, which alerts you want, and the phone you hold.
/// Equipment is nil until onboarding has run, which is how first launch is detected.
@Observable @MainActor
final class AppSettings {
    private enum Key {
        static let equipment = "atlas.equipment"
        static let clearNights = "atlas.alerts.clearNights"
        static let events = "atlas.alerts.events"
    }

    private let defaults: UserDefaults
    let device: DeviceProfile

    var equipment: Equipment? {
        didSet { defaults.set(equipment?.rawValue, forKey: Key.equipment) }
    }
    var clearNightAlerts: Bool {
        didSet { defaults.set(clearNightAlerts, forKey: Key.clearNights) }
    }
    var eventAlerts: Bool {
        didSet { defaults.set(eventAlerts, forKey: Key.events) }
    }

    var needsOnboarding: Bool { equipment == nil }
    var alertPreferences: AlertPreferences { AlertPreferences(clearNights: clearNightAlerts, events: eventAlerts) }
    var anyAlertsOn: Bool { clearNightAlerts || eventAlerts }

    init(defaults: UserDefaults = .standard, device: DeviceProfile = DeviceCatalog.current(), arguments: [String] = ProcessInfo.processInfo.arguments) {
        self.defaults = defaults
        self.device = device
        // `-AtlasEquipment phone|binoculars|telescope` and `-AtlasResetOnboarding` are for screenshots and UI tests.
        if arguments.contains("-AtlasResetOnboarding") { defaults.removeObject(forKey: Key.equipment) }
        if let i = arguments.firstIndex(of: "-AtlasEquipment"), i + 1 < arguments.count, let forced = Equipment(rawValue: arguments[i + 1]) {
            defaults.set(forced.rawValue, forKey: Key.equipment)
        }
        equipment = Equipment.stored(defaults.string(forKey: Key.equipment))
        clearNightAlerts = defaults.object(forKey: Key.clearNights) as? Bool ?? true
        eventAlerts = defaults.object(forKey: Key.events) as? Bool ?? true
    }
}
