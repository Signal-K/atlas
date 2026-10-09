import Foundation

public struct AtlasLocalNotificationDraft: Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let body: String
    public let fireDate: Date
    public let category: AtlasNotificationCategory
    public let route: AtlasNotificationRoute

    public init(
        id: String,
        title: String,
        body: String,
        fireDate: Date,
        category: AtlasNotificationCategory,
        route: AtlasNotificationRoute
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.fireDate = fireDate
        self.category = category
        self.route = route
    }
}

public enum AtlasLocalNotificationPlanner {
    private static let fallbackKeywords = ["world space week", "orionids"]

    public static func drafts(
        from plan: TonightPlan,
        upcoming: [SkyEvent],
        now: Date,
        preferences: NotificationPreferences = .default
    ) -> [AtlasLocalNotificationDraft] {
        var out: [AtlasLocalNotificationDraft] = []

        if preferences.clearSky, let clear = clearSkyDraft(plan: plan, now: now) {
            out.append(clear)
        }
        if preferences.skyEvents {
            out.append(contentsOf: eventDrafts(plan: plan, upcoming: upcoming, now: now))
        }
        return out.sorted { $0.fireDate < $1.fireDate }
    }

    private static func clearSkyDraft(plan: TonightPlan, now: Date) -> AtlasLocalNotificationDraft? {
        guard plan.weatherAvailable, plan.rating >= .good else { return nil }
        let darkWindow = plan.windows.first(where: { $0.kind == .dark }) ?? plan.windows.first
        guard let darkWindow else { return nil }

        let fire = max(now.addingTimeInterval(120), darkWindow.start.addingTimeInterval(-30 * 60))
        guard fire < now.addingTimeInterval(18 * 60 * 60) else { return nil }

        let cloud = plan.cloudCoverPct.map { "\(Int($0.rounded()))% cloud" } ?? "clear conditions"
        let rain = plan.precipitationChancePct.map { "\(Int($0.rounded()))% rain risk" } ?? "rain risk unknown"
        let body = "Conditions look favorable tonight: \(cloud), \(rain). Best window starts around \(formatClock(darkWindow.start, timeZone: plan.timeZone))."
        let dayKey = DateFormatter.localDayKey.string(from: darkWindow.start)
        return AtlasLocalNotificationDraft(
            id: "atlas-local-clear-\(dayKey)",
            title: "Atlas: a good night to go outside",
            body: body,
            fireDate: fire,
            category: .clearSky,
            route: .tonight(section: .tonight))
    }

    private static func eventDrafts(plan: TonightPlan, upcoming: [SkyEvent], now: Date) -> [AtlasLocalNotificationDraft] {
        let horizon = now.addingTimeInterval(8 * 24 * 60 * 60)
        let candidates = upcoming
            .filter { $0.startsAt > now.addingTimeInterval(30 * 60) && $0.startsAt <= horizon }
            .sorted { lhs, rhs in
                let lp = eventPriority(lhs)
                let rp = eventPriority(rhs)
                if lp == rp { return lhs.startsAt < rhs.startsAt }
                return lp < rp
            }
            .prefix(3)

        return candidates.compactMap { event in
            let fire = max(now.addingTimeInterval(300), event.startsAt.addingTimeInterval(-6 * 60 * 60))
            guard fire < event.startsAt else { return nil }
            let when = event.startsAt.formatted(Date.FormatStyle(timeZone: plan.timeZone).weekday(.abbreviated).hour().minute())
            let detail = event.description.isEmpty ? "Open Tonight to plan your setup." : event.description
            return AtlasLocalNotificationDraft(
                id: "atlas-local-event-\(event.id)",
                title: event.title,
                body: "\(when): \(detail)",
                fireDate: fire,
                category: .skyEvents,
                route: .skyEvent(eventID: event.id))
        }
    }

    private static func eventPriority(_ event: SkyEvent) -> Int {
        let title = event.title.lowercased()
        if fallbackKeywords.contains(where: { title.contains($0) }) { return 0 }
        if event.kind == "meteor_shower" { return 1 }
        if event.kind == "eclipse" || event.kind == "conjunction" { return 2 }
        return 3
    }

    private static func formatClock(_ date: Date, timeZone: TimeZone) -> String {
        date.formatted(Date.FormatStyle(date: .omitted, time: .shortened, timeZone: timeZone))
    }
}

private extension DateFormatter {
    static let localDayKey: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
