import AtlasCore
import SwiftUI

struct NotificationSettingsView: View {
    let session: SessionStore
    let manager: NotificationManager
    let dismiss: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    statusCard
                    categoryRows
                    if let message = manager.lastError {
                        Text(message)
                            .font(.system(size: 14))
                            .foregroundStyle(Brand.flagship)
                            .accessibilityLabel("Notification sync status: \(message)")
                    }
                }
                .padding(16)
            }
            .background(Brand.bg)
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 16, weight: .semibold))
                }
            }
        }
        .task {
            await manager.updateSession(userID: session.userID, authToken: session.bearerToken)
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Remote push")
                .font(.serif(20))
                .foregroundStyle(Brand.ink)
            Text(permissionCopy)
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)
            if manager.permissionPromptAllowed {
                Button {
                    Task { _ = await manager.requestAuthorizationInContext() }
                } label: {
                    Text("Enable notifications")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.bg)
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(Brand.violet, in: Capsule())
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Enable notifications")
            }
        }
        .padding(14)
        .brandCard()
    }

    private var categoryRows: some View {
        VStack(spacing: 0) {
            categoryRow(.clearSky, isOn: manager.preferences.clearSky)
            Divider().background(Brand.line)
            categoryRow(.skyEvents, isOn: manager.preferences.skyEvents)
            Divider().background(Brand.line)
            categoryRow(.challenges, isOn: manager.preferences.challenges)
        }
        .brandCard()
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func categoryRow(_ category: AtlasNotificationCategory, isOn: Bool) -> some View {
        Toggle(isOn: Binding(
            get: { isOn },
            set: { newValue in Task { await manager.setCategory(category, enabled: newValue) } }
        )) {
            VStack(alignment: .leading, spacing: 4) {
                Text(category.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Text(category.description)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.muted)
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 56)
        .toggleStyle(SwitchToggleStyle(tint: Brand.violet))
        .disabled(session.userID == nil)
        .accessibilityLabel(category.title)
        .accessibilityHint(session.userID == nil ? "Sign in to sync notification preferences." : category.description)
    }

    private var permissionCopy: String {
        switch manager.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            "Enabled. Atlas can deliver remote and local sky alerts."
        case .denied:
            "Disabled in iOS Settings. Turn notifications on for Atlas to receive alerts."
        case .notDetermined:
            "Ask when you're ready. Atlas only prompts from this screen."
        @unknown default:
            "Notification permission status is unavailable."
        }
    }
}
