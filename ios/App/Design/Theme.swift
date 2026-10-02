import SwiftUI

/// Atlas's night palette. Everything sits on one deep-sky gradient with a warm horizon, so the
/// screens read as different views of the same sky rather than separate pages.
enum Sky {
    static let zenith = Color(red: 0.02, green: 0.03, blue: 0.10)
    static let mid = Color(red: 0.06, green: 0.07, blue: 0.22)
    static let horizon = Color(red: 0.30, green: 0.16, blue: 0.38)
    static let ember = Color(red: 1.00, green: 0.55, blue: 0.35)
    static let moonlight = Color(red: 0.96, green: 0.94, blue: 0.86)
    static let ink = Color.white
    static let dim = Color.white.opacity(0.62)
}

extension View {
    /// Email entry traits are iOS-only; keeping them here lets the files typecheck on macOS too.
    @ViewBuilder func emailEntry() -> some View {
        #if os(iOS)
        self.keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().textContentType(.username)
        #else
        self
        #endif
    }

    @ViewBuilder func hiddenNavBar() -> some View {
        #if os(iOS)
        self.toolbar(.hidden, for: .navigationBar)
        #else
        self
        #endif
    }
}

@MainActor enum Haptics {
    static func tap() {
        #if os(iOS)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }
    static func success() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }
    static func failure() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        #endif
    }
}
