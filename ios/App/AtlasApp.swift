import AtlasCore
import SwiftUI

@main
struct AtlasApp: App {
    private let source: EventSource = FixtureEventSource.fromLaunchArguments()
        ?? LiveEventSource(client: PocketBaseClient(baseURL: Config.pocketBaseURL))

    var body: some Scene {
        WindowGroup { HubView(model: HubViewModel(source: source)) }
    }
}
