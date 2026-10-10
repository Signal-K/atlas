import AtlasCore
import Foundation
import UserNotifications

/// Hands `AlertPlanner`'s output to the system. Every alert id starts with `atlas.alert.`, so a
/// reschedule removes exactly our own pending requests and nothing else.
@MainActor
enum AlertScheduler {
    private static let prefix = "atlas.alert."
    /// iOS keeps at most 64 pending local notifications; stay well under it.
    private static let limit = 40

    enum Permission { case notDetermined, allowed, denied }

    static func permission() async -> Permission {
        switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
        case .notDetermined: .notDetermined
        case .denied: .denied
        default: .allowed
        }
    }

    /// Asks only when the person turns alerts on, never at launch.
    @discardableResult
    static func requestPermission() async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
        Analytics.capture(.alertsPermission, ["granted": granted])
        return granted
    }

    /// Replaces our pending alerts with `alerts`. Returns how many were scheduled.
    @discardableResult
    static func schedule(_ alerts: [PlannedAlert]) async -> Int {
        let center = UNUserNotificationCenter.current()
        await removeAll()
        guard await permission() == .allowed else { return 0 }
        var count = 0
        for alert in alerts.prefix(limit) {
            let content = UNMutableNotificationContent()
            content.title = alert.title
            content.body = alert.body
            content.sound = .default
            content.threadIdentifier = alert.kind.rawValue
            content.interruptionLevel = .timeSensitive
            // An absolute interval, so the alert fires at the right instant whatever zone the phone is in.
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, alert.fireDate.timeIntervalSinceNow), repeats: false)
            do { try await center.add(UNNotificationRequest(identifier: alert.id, content: content, trigger: trigger)); count += 1 } catch {}
        }
        Analytics.capture(.alertsScheduled, ["count": count])
        return count
    }

    static func removeAll() async {
        let center = UNUserNotificationCenter.current()
        let ids = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }
}
