import AtlasCore
import SwiftUI

@main
struct AtlasApp: App {
    private static let client = PocketBaseClient(baseURL: Config.pocketBaseURL)
    private static let source: EventSource = FixtureEventSource.fromLaunchArguments() ?? LiveEventSource(client: client)

    @State private var session = SessionStore(service: FixtureAuthService.fromLaunchArguments() ?? LiveAuthService(client: client))

    var body: some Scene {
        WindowGroup {
            RootView(session: session) { HubViewModel(source: Self.source) }
        }
    }
}
