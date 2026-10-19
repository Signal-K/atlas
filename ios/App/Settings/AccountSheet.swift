import AtlasCore
import SwiftUI

struct AccountSheet: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    let openSkyPass: () -> Void
    let dismiss: () -> Void
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var deleteError: String?
    @Environment(\.openURL) private var openURL
    var body: some View {
        VStack(spacing: 16) {
            AtlasMark(size: 56)
            Text(session.email ?? "Looking as a guest").font(.serif(20)).foregroundStyle(Brand.ink)
            Text(session.email == nil ? "Sign in to keep your watchlist and journal." : "Signed in to Atlas.")
                .font(.system(size: 14)).foregroundStyle(Brand.muted)
            Button { Haptics.tap(); openSkyPass() } label: {
                Text(skyPass.isEntitled ? "Sky Pass · active" : "Get Sky Pass")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(skyPass.isEntitled ? Brand.green : Brand.violet)
                    .padding(.horizontal, 24).frame(minHeight: 46)
                    .background(Brand.surface, in: Capsule()).overlay(Capsule().strokeBorder(Brand.line2))
            }
            .buttonStyle(PressableStyle())
            Button {
                dismiss(); session.signOut()
            } label: {
                Text(session.email == nil ? "Sign in or create account" : "Sign out")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.bg)
                    .padding(.horizontal, 24).frame(minHeight: 46).background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle())
            if session.email != nil {
                Button { confirmDelete = true } label: {
                    HStack(spacing: 8) {
                        if deleting { ProgressView().controlSize(.small) }
                        Text("Delete account").font(.system(size: 14, weight: .medium))
                    }
                    .foregroundStyle(Brand.flagship).frame(minHeight: 36)
                }
                .disabled(deleting)
                if let deleteError { Text(deleteError).font(.system(size: 12)).foregroundStyle(Brand.flagship) }
            }
        }
        .padding(20).frame(maxWidth: .infinity, maxHeight: .infinity).background(Brand.bg)
        .confirmationDialog("Delete your Atlas account?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete account permanently", role: .destructive) { performDelete() }
            if skyPass.isEntitled {
                Button("Manage subscription first") {
                    if let url = URL(string: "https://apps.apple.com/account/subscriptions") { openURL(url) }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your account, journal, watchlist and check-ins on every Atlas app and the website. It cannot be undone. Deleting your account does not cancel an App Store subscription; cancel it in Settings → Apple ID → Subscriptions.")
        }
    }

    private func performDelete() {
        deleting = true; deleteError = nil
        Task {
            do { try await session.deleteAccount(); dismiss() }
            catch { deleteError = error.localizedDescription }
            deleting = false
        }
    }
}
