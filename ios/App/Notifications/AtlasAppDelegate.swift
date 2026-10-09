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

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        notificationManager?.handleForegroundNotification(userInfo: notification.request.content.userInfo) ?? [.banner, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        notificationManager?.handleNotificationTap(userInfo: response.notification.request.content.userInfo)
    }
}
