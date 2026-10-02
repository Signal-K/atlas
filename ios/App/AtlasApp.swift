import AtlasCore
import SwiftUI

@main
struct AtlasApp: App {
    private static let client = PocketBaseClient(baseURL: Config.pocketBaseURL)
    private static let fixtures = Fixtures.fromLaunchArguments()

    @State private var session = SessionStore(service: FixtureAuthService.fromLaunchArguments() ?? LiveAuthService(client: client))

    var body: some Scene {
        WindowGroup {
            RootView(session: session) {
                TonightModel(
                    events: Self.fixtures ?? LiveEventSource(client: Self.client),
                    forecasts: Self.fixtures ?? LiveForecastSource(),
                    location: Self.fixtures == nil ? CoreLocationSource() : FixtureLocation())
            }
        }
    }
}

/// Fixture runs still need a place; use the listed city in the device's own time zone (not a hard-coded one).
@MainActor private struct FixtureLocation: LocationSource {
    func current() async -> Place {
        let p = Place.fallback()
        return Place(latitude: p.latitude, longitude: p.longitude, name: p.name, timeZone: p.timeZone, isFallback: false)
    }
}
