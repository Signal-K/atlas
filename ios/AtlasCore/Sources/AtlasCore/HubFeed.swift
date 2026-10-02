import Foundation

public enum HubFilter: String, CaseIterable, Sendable {
    case all, tonight, week

    public var label: String {
        switch self {
        case .all: "All"
        case .tonight: "Tonight"
        case .week: "This week"
        }
    }
}

public struct HubDayGroup: Equatable, Sendable {
    public let key: String
    public let label: String
    public let events: [SkyEvent]
}

/// Day-grouped upcoming feed. Port of the filter/grouping in src/pages/HubPage.tsx and
/// `localDateKey` / `dayGroupLabel` in src/lib/weather.ts. Days are the viewer's calendar days
/// in `timeZone` (a UTC date shifts the day by an offset on most evenings).
public struct HubFeed: Sendable {
    public let timeZone: TimeZone
    public let now: Date

    public init(now: Date = Date(), timeZone: TimeZone = .current) {
        self.now = now
        self.timeZone = timeZone
    }

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = timeZone
        return c
    }

    public func dateKey(_ date: Date) -> String {
        let p = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", p.year!, p.month!, p.day!)
    }

    public var todayKey: String { dateKey(now) }
    private var weekEndKey: String { dateKey(now.addingTimeInterval(7 * 86400)) }

    private func noon(of key: String) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }

    public func dayLabel(for key: String) -> String {
        if key == todayKey { return "Today" }
        guard let date = noon(of: key) else { return key }
        if let today = noon(of: todayKey), let tomorrow = calendar.date(byAdding: .day, value: 1, to: today),
           dateKey(tomorrow) == key { return "Tomorrow" }
        let f = DateFormatter()
        f.timeZone = timeZone
        f.setLocalizedDateFormatFromTemplate("EEEMMMd")
        return f.string(from: date)
    }

    public func matches(_ event: SkyEvent, filter: HubFilter) -> Bool {
        switch filter {
        case .all: true
        case .tonight: dateKey(event.startsAt) == todayKey
        case .week: dateKey(event.startsAt) <= weekEndKey
        }
    }

    public func count(_ events: [SkyEvent], filter: HubFilter) -> Int {
        events.filter { matches($0, filter: filter) }.count
    }

    public func groups(_ events: [SkyEvent], filter: HubFilter) -> [HubDayGroup] {
        let byDay = Dictionary(grouping: events.filter { matches($0, filter: filter) }) { dateKey($0.startsAt) }
        return byDay.keys.sorted().map { key in
            HubDayGroup(key: key, label: dayLabel(for: key), events: byDay[key]!.sorted { $0.startsAt < $1.startsAt })
        }
    }
}
