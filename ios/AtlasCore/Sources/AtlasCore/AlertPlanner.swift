import Foundation

/// A notification the app should schedule. `id` is stable per night/event so rescheduling replaces
/// rather than duplicates.
public struct PlannedAlert: Equatable, Identifiable, Sendable {
    public enum Kind: String, Sendable { case clearNight, event }

    public let id: String
    public let kind: Kind
    public let fireDate: Date
    public let title: String
    public let body: String
}

public struct AlertPreferences: Equatable, Sendable {
    public var clearNights: Bool
    public var events: Bool
    public init(clearNights: Bool = true, events: Bool = true) { self.clearNights = clearNights; self.events = events }
}

/// Works out when to ping: the clearest dark stretch of each coming night, and the viewing time of
/// each marquee event whose hour is forecast to be clear. Pure so it can be tested; the app layer
/// only hands the result to UNUserNotificationCenter.
public enum AlertPlanner {
    /// Cloud cover at or below this counts as worth going out for.
    public static let clearCloudPct = 40.0
    /// Shortest clear run worth a notification.
    static let minimumWindow: TimeInterval = 90 * 60
    /// Event kinds loud enough to alert for (KindMeta priority).
    static let eventPriorityCutoff = 6
    public static let maxNights = 7
    public static let leadTime: TimeInterval = 30 * 60

    public static func plan(
        forecast: ViewingForecast, events: [SkyEvent], now: Date, latitude: Double, longitude: Double,
        timeZone: TimeZone, preferences: AlertPreferences = .init()
    ) -> [PlannedAlert] {
        var out: [PlannedAlert] = []
        if preferences.clearNights { out += clearNightAlerts(forecast, now: now, lat: latitude, lon: longitude, zone: timeZone) }
        if preferences.events { out += eventAlerts(events, forecast: forecast, now: now, lat: latitude, lon: longitude, zone: timeZone) }
        return out.filter { $0.fireDate > now }.sorted { $0.fireDate < $1.fireDate }
    }

    // MARK: Clear nights

    static func clearNightAlerts(_ forecast: ViewingForecast, now: Date, lat: Double, lon: Double, zone: TimeZone) -> [PlannedAlert] {
        var alerts: [PlannedAlert] = []
        var seen = Set<TimeInterval>()
        for day in 0..<maxNights {
            let anchor = day == 0 ? now : now.addingTimeInterval(Double(day) * 86400)
            let dark = DarknessWindow.tonight(now: anchor, latitude: lat, longitude: lon)
            guard let from = dark.civilDusk, let to = dark.civilDawn, to > from, seen.insert(from.timeIntervalSince1970.rounded()).inserted else { continue }
            let start = max(from, now)
            guard let window = clearestWindow(forecast.hours, from: start, to: to) else { continue }
            let moon = MoonPhase.illuminationPercent(at: window.start)
            let clock = { (d: Date) in d.formatted(Date.FormatStyle(date: .omitted, time: .shortened, timeZone: zone)) }
            let dayLabel = day == 0 ? "tonight" : Self.dayName(window.start, zone: zone)
            let cloud = Int(window.meanCloud.rounded())
            alerts.append(PlannedAlert(
                id: "atlas.alert.night.\(Int(from.timeIntervalSince1970))", kind: .clearNight,
                fireDate: max(window.start.addingTimeInterval(-leadTime), now.addingTimeInterval(60)),
                title: day == 0 ? "Clear sky tonight" : "Clear sky \(dayLabel)",
                body: "Go outside between \(clock(window.start)) and \(clock(window.end)): about \(cloud)% cloud. The Moon is \(Int(moon.rounded()))% lit."))
        }
        return alerts
    }

    /// The longest run of hours at or under `clearCloudPct`, tie-broken by lower mean cloud. A run
    /// is clipped to [from, to].
    static func clearestWindow(_ hours: [HourAdvisory], from: Date, to: Date) -> (start: Date, end: Date, meanCloud: Double)? {
        let inNight: [HourAdvisory] = hours
            .filter { (h: HourAdvisory) -> Bool in h.start.addingTimeInterval(3600) > from && h.start < to }
            .sorted { (a: HourAdvisory, b: HourAdvisory) -> Bool in a.start < b.start }
        var best: (start: Date, end: Date, mean: Double)?
        var run: [HourAdvisory] = []

        func close() {
            guard let first = run.first, let last = run.last else { return }
            let s = max(first.start, from), e = min(last.start.addingTimeInterval(3600), to)
            let mean = run.reduce(0) { $0 + $1.cloudCoverPct } / Double(run.count)
            guard e.timeIntervalSince(s) >= minimumWindow else { run = []; return }
            let length = e.timeIntervalSince(s)
            if let b = best {
                let bestLength = b.end.timeIntervalSince(b.start)
                if length > bestLength + 1 || (abs(length - bestLength) <= 1 && mean < b.mean) { best = (s, e, mean) }
            } else {
                best = (s, e, mean)
            }
            run = []
        }
        for h in inNight {
            let clear = h.cloudCoverPct <= clearCloudPct && h.precipitationChancePct < 50
            let contiguous: Bool = run.last.map { h.start.timeIntervalSince($0.start) <= 3601 } ?? true
            if clear && contiguous {
                run.append(h)
            } else {
                close()
                if clear { run = [h] }
            }
        }
        close()
        return best.map { ($0.start, $0.end, $0.mean) }
    }

    // MARK: Events

    static func eventAlerts(_ events: [SkyEvent], forecast: ViewingForecast, now: Date, lat: Double, lon: Double, zone: TimeZone) -> [PlannedAlert] {
        let horizon = now.addingTimeInterval(Double(14) * 86400)
        return events.compactMap { e -> PlannedAlert? in
            let meta = KindMeta.of(e.kind)
            guard meta.priority <= eventPriorityCutoff, e.endsAt > now, e.startsAt < horizon else { return nil }
            if let elat = e.latitude, let elon = e.longitude, abs(elat - lat) > 5 || abs(elon - lon) > 8 { return nil }
            let at = max(e.startsAt, now)
            // Skip alerts when the hour is forecast to be cloudy; that is a reason to stay in, not to ping.
            let hour = forecast.hours.first { $0.start <= at && at < $0.start.addingTimeInterval(3600) }
            if let hour, hour.cloudCoverPct > 70 { return nil }
            let clock = at.formatted(Date.FormatStyle(date: .abbreviated, time: .shortened, timeZone: zone))
            let sky = hour.map { "\(Int($0.cloudCoverPct.rounded()))% cloud forecast" } ?? "check the sky before you go"
            return PlannedAlert(
                id: "atlas.alert.event.\(e.id)", kind: .event, fireDate: max(at.addingTimeInterval(-45 * 60), now.addingTimeInterval(60)),
                title: e.title, body: "Starts \(clock), \(sky). Open Atlas for camera settings.")
        }
    }

    static func dayName(_ date: Date, zone: TimeZone) -> String {
        date.formatted(Date.FormatStyle(timeZone: zone).weekday(.wide))
    }
}
