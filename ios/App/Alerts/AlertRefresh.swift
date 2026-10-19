import AtlasCore
import BackgroundTasks
import Foundation

/// Keeps alerts honest when the app isn't opened: iOS wakes us now and then, we refetch the forecast
/// and calendar for the last known place and reschedule. Best-effort: iOS decides when (and whether)
/// to run it, so alerts are also rescheduled every time the app opens.
enum AlertRefresh {
    static let identifier = "cc.youratlas.alerts.refresh"

    static func register(client: PocketBaseClient) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            let box = TaskBox(task)
            let work = Task { @MainActor in
                let ok = await run(client: client)
                schedule()
                box.task.setTaskCompleted(success: ok)
            }
            box.task.expirationHandler = { work.cancel() }
        }
    }

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 6 * 3600)
        try? BGTaskScheduler.shared.submit(request)
    }

    @MainActor
    private static func run(client: PocketBaseClient) async -> Bool {
        let settings = AppSettings()
        guard settings.anyAlertsOn, let place = PlaceCache.load(), await AlertScheduler.permission() == .allowed else { return false }
        let now = Date()
        async let forecast = try? await LiveForecastSource().forecast(latitude: place.latitude, longitude: place.longitude)
        async let events = try? await LiveEventSource(client: client).events(from: now, to: now.addingTimeInterval(14 * 86400))
        guard let forecast = await forecast else { return false }
        let alerts = AlertPlanner.plan(forecast: forecast, events: await events ?? [], now: now, latitude: place.latitude, longitude: place.longitude,
                                       timeZone: place.timeZone, preferences: settings.alertPreferences)
        await AlertScheduler.schedule(alerts)
        return true
    }
}

/// BGTask isn't Sendable, but iOS only touches it from the handler and the completion call.
private final class TaskBox: @unchecked Sendable {
    let task: BGTask
    init(_ task: BGTask) { self.task = task }
}
