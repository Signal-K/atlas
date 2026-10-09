import AtlasCore
import SwiftUI

@main
struct AtlasApp: App {
    private static let client = PocketBaseClient(baseURL: Config.pocketBaseURL)
    private static let fixtures = Fixtures.fromLaunchArguments()
    @UIApplicationDelegateAdaptor(AtlasAppDelegate.self) private var appDelegate

    @State private var session: SessionStore
    @State private var skyPass: SkyPassStore
    @State private var settings = AppSettings()
    @State private var checkIns = CheckInStore(service: CheckInStore.service(client: AtlasApp.client))
    @State private var notificationRouter: NotificationRouter
    @State private var notifications: NotificationManager

    init() {
        Analytics.start()
        AlertRefresh.register(client: Self.client)
        let session = SessionStore(service: FixtureAuthService.fromLaunchArguments() ?? LiveAuthService(client: Self.client))
        _session = State(initialValue: session)
        let fixture = FixtureSkyPass.fromLaunchArguments()
        let provider: SkyPassProvider = fixture ?? StoreKitProvider()
        let backend: SkyPassBackend = fixture ?? LiveSkyPassBackend(baseURL: Config.billingURL)
        _skyPass = State(initialValue: SkyPassStore(provider: provider, backend: backend, account: session))
        let router = NotificationRouter()
        _notificationRouter = State(initialValue: router)
        _notifications = State(initialValue: NotificationManager(client: Self.client, router: router))
    }

    var body: some Scene {
        WindowGroup {
            RootView(
                session: session, skyPass: skyPass, settings: settings, checkIns: checkIns,
                makeTonight: {
                    TonightModel(
                        events: Self.fixtures ?? LiveEventSource(client: Self.client),
                        forecasts: Self.fixtures ?? LiveForecastSource(),
                        location: Self.fixtures == nil ? CoreLocationSource() : FixtureLocation())
                },
                client: Self.client,
                notifications: notifications,
                router: notificationRouter)
            .task {
                await MainActor.run {
                    appDelegate.notificationManager = notifications
                }
                await notifications.bootstrap(userID: session.userID, authToken: session.bearerToken)
            }
            .onChange(of: session.userID) { _, _ in
                Task { await notifications.updateSession(userID: session.userID, authToken: session.bearerToken) }
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
