import Foundation
import UIKit
import UserNotifications

@MainActor
final class AtlasAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    weak var notificationManager: NotificationManager?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            await notificationManager?.didRegisterAPNSToken(deviceToken)
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        notificationManager?.didFailAPNSRegistration(error)
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        nonisolated(unsafe) let info = notification.request.content.userInfo
        return await MainActor.run {
            notificationManager?.handleForegroundNotification(userInfo: info) ?? [.banner, .sound]
        }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        nonisolated(unsafe) let info = response.notification.request.content.userInfo
        await MainActor.run {
            notificationManager?.handleNotificationTap(userInfo: info)
        }
    }
}
