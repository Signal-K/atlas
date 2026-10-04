import AtlasCore
import SwiftUI

/// One continuous sky. The backdrop lives here, above the screens, so welcome -> tonight is a
/// change of foreground rather than a page swap.
struct RootView: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    let settings: AppSettings
    let checkIns: CheckInStore
    let makeTonight: () -> TonightModel

    @State private var tonight: TonightModel?

    var body: some View {
        ZStack {
            // Tonight draws its own backdrop (it needs scroll drift); both share the same warp.
            if !isSignedIn { PaperBackdrop(warp: session.warp) }
            switch session.state {
            case .launching:
                Color.clear
            case .signedOut:
                WelcomeView(session: session).transition(.opacity.combined(with: .scale(scale: 1.08)))
            case .guest, .signedIn:
                if settings.needsOnboarding {
                    EquipmentOnboardingView(settings: settings).transition(.opacity.combined(with: .scale(scale: 1.04)))
                } else if let tonight {
                    TonightView(session: session, skyPass: skyPass, settings: settings, checkIns: checkIns, model: tonight)
                        .transition(.opacity.combined(with: .scale(scale: 0.94)))
                }
            }
        }
        .background(Brand.bg.ignoresSafeArea())
        .task { await session.restore() }
        // Claims purchases this account already owns and redeems renewals / Ask to Buy approvals
        // for as long as someone is signed in; restarts (and cancels) when the account changes.
        .task(id: session.userID) {
            Analytics.identify(userID: session.userID, entitled: session.userID == nil ? nil : skyPass.isEntitled)
            if session.userID != nil { await skyPass.run() }
        }
        .animation(.smooth(duration: 0.45), value: settings.needsOnboarding)
        .onChange(of: session.state) { _, state in
            if state == .guest || state.isSignedIn { tonight = tonight ?? makeTonight() } else { tonight = nil }
        }
    }

    private var isSignedIn: Bool { session.state == .guest || session.state.isSignedIn }
}

private extension SessionStore.State {
    var isSignedIn: Bool { if case .signedIn = self { true } else { false } }
}
