import AtlasCore
import SwiftUI

struct AtlasTabShell: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    let tonight: TonightModel
    let client: PocketBaseClient

    var body: some View {
        TabView {
            TonightView(session: session, skyPass: skyPass, model: tonight)
                .tabItem {
                    Label("Tonight", systemImage: "moon.stars")
                }

            AskAtlasView(
                session: session,
                skyPass: skyPass,
                tonight: tonight,
                service: LiveAskAtlasService(client: client, tokenProvider: { Keychain.read("pb.token") }))
                .tabItem {
                    Label("Ask", systemImage: "sparkles")
                }

            ProfileView(
                session: session,
                skyPass: skyPass,
                service: LiveProfileService(client: client))
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle")
                }
        }
        .tint(Brand.violet)
    }
}
