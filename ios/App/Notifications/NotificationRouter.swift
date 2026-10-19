import AtlasCore
import Observation

@Observable @MainActor
final class NotificationRouter {
    private(set) var changeToken = 0
    private var pendingRoute: AtlasNotificationRoute?

    func open(_ route: AtlasNotificationRoute) {
        pendingRoute = route
        changeToken &+= 1
    }

    func consumePendingRoute() -> AtlasNotificationRoute? {
        defer { pendingRoute = nil }
        return pendingRoute
    }

    func peekPendingRoute() -> AtlasNotificationRoute? {
        pendingRoute
    }

    func consumePendingTonightRoute() -> AtlasNotificationRoute? {
        guard let route = pendingRoute else { return nil }
        switch route {
        case .tonight, .skyEvent:
            pendingRoute = nil
            return route
        case .challenge:
            return nil
        }
    }

    func consumePendingChallengeRoute() -> AtlasNotificationRoute? {
        guard let route = pendingRoute else { return nil }
        guard case .challenge = route else { return nil }
        pendingRoute = nil
        return route
    }
}
