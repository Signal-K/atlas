import Foundation
import PostHog

/// Product analytics for the native app, sent through PostHog. With no key configured (local
/// builds, tests) every call is a no-op, matching the web app's `src/lib/analytics.ts`.
///
/// Never put free text, email addresses or coordinates in properties: use enums, counts and
/// coarse values. The signed-in user is identified by their Atlas user id only.
@MainActor
enum Analytics {
    private static var enabled = false

    static func start() {
        guard !enabled, let key = Config.postHogKey else { return }
        let config = PostHogConfig(projectToken: key, host: Config.postHogHost.absoluteString)
        config.captureApplicationLifecycleEvents = true
        config.captureScreenViews = false
        config.sessionReplay = false
        PostHogSDK.shared.setup(config)
        PostHogSDK.shared.register(["platform": "ios_native"])
        enabled = true
    }

    static func identify(userID: String?, entitled: Bool? = nil) {
        guard enabled else { return }
        if let userID {
            var props: [String: Any] = [:]
            if let entitled { props["entitled"] = entitled }
            PostHogSDK.shared.identify(userID, userProperties: props)
        } else {
            PostHogSDK.shared.reset()
        }
    }

    static func capture(_ event: Event, _ properties: [String: Any] = [:]) {
        guard enabled else { return }
        PostHogSDK.shared.capture(event.rawValue, properties: properties)
    }

    static func screen(_ name: String) {
        guard enabled else { return }
        PostHogSDK.shared.screen(name)
    }

    /// Event names are fixed here so dashboards don't fragment on typos.
    enum Event: String {
        case onboardingCompleted = "onboarding_completed"
        case equipmentChanged = "equipment_changed"
        case skyOpened = "sky_opened"
        case skyObjectSelected = "sky_object_selected"
        case skyMotionEnabled = "sky_motion_enabled"
        case alertsPermission = "alerts_permission"
        case alertsScheduled = "alerts_scheduled"
        case alertSettingChanged = "alert_setting_changed"
        case cameraOpened = "camera_opened"
        case photoCaptured = "photo_captured"
        case cameraDenied = "camera_permission_denied"
        case skyPassOpened = "sky_pass_opened"
    }
}
