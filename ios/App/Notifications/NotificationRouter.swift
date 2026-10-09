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
}
