import SwiftUI

/// One continuous sky. The backdrop lives here, above the screens, so welcome -> tonight is a
/// change of foreground rather than a page swap.
struct RootView: View {
    let session: SessionStore
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
                if let tonight {
                    TonightView(session: session, model: tonight)
                        .transition(.opacity.combined(with: .scale(scale: 0.94)))
                }
            }
        }
        .background(Brand.bg.ignoresSafeArea())
        .task { await session.restore() }
        .onChange(of: session.state) { _, state in
            if state == .guest || state.isSignedIn { tonight = tonight ?? makeTonight() } else { tonight = nil }
        }
    }

    private var isSignedIn: Bool { session.state == .guest || session.state.isSignedIn }
}

private extension SessionStore.State {
    var isSignedIn: Bool { if case .signedIn = self { true } else { false } }
}
