import Foundation

enum Config {
    /// PocketBase base URL from Info.plist `AtlasPBURL` (set via ATLAS_PB_URL in project.yml).
    static var pocketBaseURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "AtlasPBURL") as? String
        return URL(string: raw ?? "") ?? URL(string: "http://127.0.0.1:8094")!
    }
}
