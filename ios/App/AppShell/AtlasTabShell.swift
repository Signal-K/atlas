import AtlasCore
import SwiftUI

struct AtlasTabShell: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    let settings: AppSettings
    let checkIns: CheckInStore
    let tonight: TonightModel
    let client: PocketBaseClient
    let notifications: NotificationManager
    let router: NotificationRouter

    @State private var selection: AtlasTab = .tonight

    var body: some View {
        TabView(selection: $selection) {
            TonightView(
                session: session,
                skyPass: skyPass,
                settings: settings,
                checkIns: checkIns,
                model: tonight,
                notifications: notifications,
                router: router)
                .tag(AtlasTab.tonight)
                .tabItem {
                    Label("Tonight", systemImage: "moon.stars")
                }

            CaptureView(session: session)
                .tag(AtlasTab.capture)
                .tabItem {
                    Label("Capture", systemImage: "camera")
                }

            ChallengesView(session: session, router: router)
                .tag(AtlasTab.challenges)
                .tabItem {
                    Label("Challenges", systemImage: "trophy")
                }

            AskAtlasView(
                session: session,
                skyPass: skyPass,
                tonight: tonight,
                service: LiveAskAtlasService(client: client, tokenProvider: { session.bearerToken }))
                .tag(AtlasTab.ask)
                .tabItem {
                    Label("Ask", systemImage: "sparkles")
                }

            ProfileView(
                session: session,
                skyPass: skyPass,
                service: LiveProfileService(client: client),
                notifications: notifications)
                .tag(AtlasTab.profile)
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle")
                }
        }
        .tint(Brand.violet)
        .onAppear {
            routeToPendingNotification()
        }
        .onChange(of: router.changeToken) { _, _ in
            routeToPendingNotification()
        }
    }

    private func routeToPendingNotification() {
        guard let route = router.peekPendingRoute() else { return }
        switch route {
        case .challenge:
            selection = .challenges
        case .tonight, .skyEvent:
            selection = .tonight
        }
    }
}

private enum AtlasTab: Hashable {
    case tonight
    case capture
    case challenges
    case ask
    case profile
}
