import SwiftUI

struct AtlasHomeView: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    @State var tonightModel: TonightModel

    var body: some View {
        TabView {
            TonightView(session: session, skyPass: skyPass, model: tonightModel)
                .tabItem {
                    Label("Tonight", systemImage: "moon.stars")
                }

            CaptureView(session: session)
                .tabItem {
                    Label("Capture", systemImage: "camera.viewfinder")
                }

            ChallengesView(session: session)
                .tabItem {
                    Label("Challenges", systemImage: "flag.checkered")
                }
        }
        .tint(Brand.flagship)
    }
}
