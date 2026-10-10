import Foundation

enum Config {
    /// PocketBase base URL from Info.plist `AtlasPBURL` (set via ATLAS_PB_URL in project.yml).
    static var pocketBaseURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "AtlasPBURL") as? String
        return URL(string: raw ?? "") ?? URL(string: "http://127.0.0.1:8094")!
    }

    /// atlas-billing base URL from Info.plist `AtlasBillingURL` (ATLAS_BILLING_URL in project.yml).
    /// This is where purchases are verified; it is the same service the web checkout uses.
    static var billingURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "AtlasBillingURL") as? String
        return URL(string: raw ?? "") ?? URL(string: "http://127.0.0.1:8093")!
    }

    /// Atlas media worker URL from Info.plist `AtlasMediaURL` (`ATLAS_MEDIA_URL` in project.yml).
    /// When absent, the app falls back to PocketBase file attachments.
    static var mediaURL: URL? {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "AtlasMediaURL") as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    /// Atlas's own Terms of Use / EULA (web route `/terms`); deploy the web app before App Review.
    static let termsURL = URL(string: "https://youratlas.cc/terms")!

    /// Privacy Policy from Info.plist `AtlasPrivacyURL`; must be a live page before App Review.
    static var privacyURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "AtlasPrivacyURL") as? String
        return URL(string: raw ?? "") ?? URL(string: "https://youratlas.cc/privacy")!
    }

    /// PostHog project key from Info.plist `AtlasPostHogKey` (ATLAS_POSTHOG_KEY in project.yml). Empty
    /// means analytics are off. The key is a public, write-only capture key, like the web app's.
    static var postHogKey: String? {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "AtlasPostHogKey") as? String)?.trimmingCharacters(in: .whitespaces)
        guard let raw, !raw.isEmpty, !raw.hasPrefix("$(") else { return nil }
        return raw
    }

    /// Capture goes through the same first-party proxy as the web app (functions/uplink), so ad
    /// blockers and DNS filters that match PostHog's hostname don't drop events.
    static var postHogHost: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "AtlasPostHogHost") as? String
        if let raw, !raw.isEmpty, !raw.hasPrefix("$("), let url = URL(string: raw) { return url }
        return URL(string: "https://youratlas.cc/uplink")!
    }
}
