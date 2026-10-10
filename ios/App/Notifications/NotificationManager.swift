import AtlasCore
import Foundation
import Observation
import UIKit
import UserNotifications

@MainActor @Observable
final class NotificationManager {
    private static let preferencesDefaultsKey = "atlas.notifications.preferences"
    private static let localRequestPrefix = "atlas-local-"

    private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    private(set) var preferences: NotificationPreferences
    private(set) var lastError: String?
    private(set) var isSyncing = false

    private let client: PocketBaseClient
    private let router: NotificationRouter

    private var currentUserID: String?
    private var currentAuthToken: String?
    private var lastSignedInUserID: String?
    private var lastSignedInAuthToken: String?
    private var apnsTokenHex: String?

    init(client: PocketBaseClient, router: NotificationRouter) {
        self.client = client
        self.router = router
        if let data = UserDefaults.standard.data(forKey: Self.preferencesDefaultsKey),
           let decoded = try? JSONDecoder().decode(NotificationPreferences.self, from: data) {
            self.preferences = decoded
        } else {
            self.preferences = .default
        }
    }

    var permissionPromptAllowed: Bool {
        authorizationStatus == .notDetermined || authorizationStatus == .provisional
    }

    var notificationsAuthorized: Bool {
        authorizationStatus == .authorized || authorizationStatus == .provisional || authorizationStatus == .ephemeral
    }

    func bootstrap(userID: String?, authToken: String?) async {
        await refreshAuthorizationStatus()
        await updateSession(userID: userID, authToken: authToken)
    }

    func updateSession(userID: String?, authToken: String?) async {
        currentUserID = userID
        currentAuthToken = authToken
        if let userID, let authToken {
            lastSignedInUserID = userID
            lastSignedInAuthToken = authToken
            await refreshPreferencesFromServer(userID: userID, authToken: authToken)
            await registerAPNSTokenIfPossible(userID: userID, authToken: authToken)
            return
        }
        await unregisterAPNSTokenForSignedOutUser()
    }

    func requestAuthorizationInContext() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            await refreshAuthorizationStatus()
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
                if let userID = currentUserID, let authToken = currentAuthToken {
                    await registerAPNSTokenIfPossible(userID: userID, authToken: authToken)
                }
            }
            return granted
        } catch {
            lastError = "Notification permission request failed."
            return false
        }
    }

    func setCategory(_ category: AtlasNotificationCategory, enabled: Bool) async {
        preferences.set(category, enabled: enabled)
        persistPreferences()
        if let userID = currentUserID, let authToken = currentAuthToken {
            await syncPreferencesToServer(userID: userID, authToken: authToken)
            await registerAPNSTokenIfPossible(userID: userID, authToken: authToken)
        }
    }

    func didRegisterAPNSToken(_ token: Data) async {
        apnsTokenHex = token.map { String(format: "%02x", $0) }.joined()
        if let userID = currentUserID, let authToken = currentAuthToken {
            await registerAPNSTokenIfPossible(userID: userID, authToken: authToken)
        }
    }

    func didFailAPNSRegistration(_ error: Error) {
        lastError = "Remote notifications unavailable right now."
        NSLog("APNs registration failed: %@", String(describing: error))
    }

    func handleForegroundNotification(userInfo: [AnyHashable: Any]) -> UNNotificationPresentationOptions {
        guard let parsed = AtlasNotificationPayloadParser.parse(userInfo: userInfo),
              preferences.allows(parsed.category) else { return [] }
        return [.banner, .sound]
    }

    func handleNotificationTap(userInfo: [AnyHashable: Any]) {
        guard let parsed = AtlasNotificationPayloadParser.parse(userInfo: userInfo) else { return }
        router.open(parsed.route)
    }

    func scheduleLocalFallback(plan: TonightPlan?, upcoming: [SkyEvent]) async {
        guard notificationsAuthorized, let plan else { return }
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
            .filter { $0.identifier.hasPrefix(Self.localRequestPrefix) }
            .map(\.identifier)
        if !pending.isEmpty { center.removePendingNotificationRequests(withIdentifiers: pending) }

        let drafts = AtlasLocalNotificationPlanner.drafts(from: plan, upcoming: upcoming, now: Date(), preferences: preferences)
        for draft in drafts where draft.fireDate > Date().addingTimeInterval(5) {
            let content = UNMutableNotificationContent()
            content.title = draft.title
            content.body = draft.body
            content.sound = .default
            content.userInfo = userInfo(for: draft)

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: draft.fireDate.timeIntervalSinceNow, repeats: false)
            let request = UNNotificationRequest(identifier: draft.id, content: content, trigger: trigger)
            do {
                try await center.add(request)
            } catch {
                NSLog("Failed to schedule local notification %@: %@", draft.id, String(describing: error))
            }
        }
    }

    private func refreshAuthorizationStatus() async {
        authorizationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        if notificationsAuthorized { UIApplication.shared.registerForRemoteNotifications() }
    }

    private func refreshPreferencesFromServer(userID: String, authToken: String) async {
        let previousToken = client.token
        client.token = authToken
        defer { client.token = previousToken }
        do {
            let filter = "user = \"\(escapePB(userID))\""
            let list = try await client.list(collection: "atlas_notification_preferences", page: 1, perPage: 1, filter: filter)
            if let record = list.items.first {
                preferences = NotificationPreferences(
                    clearSky: record.fields["clear_sky"]?.boolValue ?? true,
                    skyEvents: record.fields["sky_events"]?.boolValue ?? true,
                    challenges: record.fields["challenges"]?.boolValue ?? true)
            } else {
                preferences = .default
            }
            persistPreferences()
            lastError = nil
        } catch {
            lastError = "Using device notification settings until sync is available."
        }
    }

    private func syncPreferencesToServer(userID: String, authToken: String) async {
        isSyncing = true
        defer { isSyncing = false }
        let payload = NotificationPreferencePayload(
            user: userID,
            clear_sky: preferences.clearSky,
            sky_events: preferences.skyEvents,
            challenges: preferences.challenges)
        let previousToken = client.token
        client.token = authToken
        defer { client.token = previousToken }
        do {
            let filter = "user = \"\(escapePB(userID))\""
            let list = try await client.list(collection: "atlas_notification_preferences", page: 1, perPage: 1, filter: filter)
            if let record = list.items.first {
                _ = try await client.update(collection: "atlas_notification_preferences", id: record.id, body: payload)
            } else {
                _ = try await client.create(collection: "atlas_notification_preferences", body: payload)
            }
            lastError = nil
        } catch {
            lastError = "Could not sync notification preferences."
        }
    }

    private func registerAPNSTokenIfPossible(userID: String, authToken: String) async {
        guard notificationsAuthorized, let token = apnsTokenHex, !token.isEmpty else { return }
        isSyncing = true
        defer { isSyncing = false }
        let previousToken = client.token
        client.token = authToken
        defer { client.token = previousToken }

        let payload = PushDevicePayload(
            user: userID,
            platform: "ios",
            token: token,
            push_enabled: true,
            clear_sky_enabled: preferences.clearSky,
            sky_events_enabled: preferences.skyEvents,
            challenges_enabled: preferences.challenges,
            device_name: UIDevice.current.name,
            locale: Locale.current.identifier,
            time_zone: TimeZone.current.identifier,
            last_seen_at: ISO8601DateFormatter().string(from: Date()))
        do {
            let filter = "user = \"\(escapePB(userID))\" && token = \"\(escapePB(token))\""
            let existing = try await client.list(collection: "atlas_push_devices", page: 1, perPage: 1, filter: filter)
            if let record = existing.items.first {
                _ = try await client.update(collection: "atlas_push_devices", id: record.id, body: payload)
            } else {
                _ = try await client.create(collection: "atlas_push_devices", body: payload)
            }
            lastError = nil
        } catch {
            lastError = "Could not register this iPhone for push."
        }
    }

    private func unregisterAPNSTokenForSignedOutUser() async {
        guard let userID = lastSignedInUserID, let authToken = lastSignedInAuthToken, let token = apnsTokenHex else { return }
        let previousToken = client.token
        client.token = authToken
        defer { client.token = previousToken }
        do {
            let filter = "user = \"\(escapePB(userID))\" && token = \"\(escapePB(token))\""
            let records = try await client.list(collection: "atlas_push_devices", page: 1, perPage: 30, filter: filter)
            for record in records.items {
                try await client.delete(collection: "atlas_push_devices", id: record.id)
            }
            lastSignedInUserID = nil
            lastSignedInAuthToken = nil
            lastError = nil
        } catch {
            lastError = "Signed out, but this device token could not be removed yet."
        }
    }

    private func userInfo(for draft: AtlasLocalNotificationDraft) -> [AnyHashable: Any] {
        var userInfo: [AnyHashable: Any] = [
            "title": draft.title,
            "body": draft.body,
            "category": draft.category.rawValue,
        ]
        switch draft.route {
        case .tonight(let section):
            userInfo["atlas_route"] = "tonight_\(section.rawValue)"
            userInfo["url"] = "/tonight?section=\(section.rawValue)"
        case .skyEvent(let id):
            userInfo["atlas_route"] = "sky_event"
            userInfo["event_id"] = id
            userInfo["url"] = "/tonight?section=coming&eventId=\(id)"
        case .challenge(let id):
            userInfo["atlas_route"] = "challenge"
            if let id { userInfo["challenge_id"] = id }
            userInfo["url"] = "/tonight?section=photo"
        }
        return userInfo
    }

    private func persistPreferences() {
        if let data = try? JSONEncoder().encode(preferences) {
            UserDefaults.standard.set(data, forKey: Self.preferencesDefaultsKey)
        }
    }

    private func escapePB(_ value: String) -> String {
        value.replacingOccurrences(of: "\"", with: "\\\"")
    }
}

private struct PushDevicePayload: Encodable {
    let user: String
    let platform: String
    let token: String
    let push_enabled: Bool
    let clear_sky_enabled: Bool
    let sky_events_enabled: Bool
    let challenges_enabled: Bool
    let device_name: String
    let locale: String
    let time_zone: String
    let last_seen_at: String
}

private struct NotificationPreferencePayload: Encodable {
    let user: String
    let clear_sky: Bool
    let sky_events: Bool
    let challenges: Bool
}
