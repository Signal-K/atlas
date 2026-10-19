import Foundation

public struct NightAdvisory: Equatable, Sendable {
    public let date: String // YYYY-MM-DD, the evening the night starts on
    public let cloudCoverPct: Double
    public let lowCloudCoverPct: Double?
    public let highCloudCoverPct: Double?
    public let precipitationChancePct: Double

    public init(date: String, cloudCoverPct: Double, lowCloudCoverPct: Double? = nil, highCloudCoverPct: Double? = nil, precipitationChancePct: Double) {
        self.date = date; self.cloudCoverPct = cloudCoverPct; self.lowCloudCoverPct = lowCloudCoverPct
        self.highCloudCoverPct = highCloudCoverPct; self.precipitationChancePct = precipitationChancePct
    }
}

/// One forecast hour, used to find the clearest stretch of a night.
public struct HourAdvisory: Equatable, Sendable {
    public let start: Date
    public let cloudCoverPct: Double
    public let precipitationChancePct: Double

    public init(start: Date, cloudCoverPct: Double, precipitationChancePct: Double) {
        self.start = start; self.cloudCoverPct = cloudCoverPct; self.precipitationChancePct = precipitationChancePct
    }
}

public struct ViewingForecast: Equatable, Sendable {
    public let nights: [NightAdvisory]
    public let timeZone: String?
    public let hours: [HourAdvisory]

    public init(nights: [NightAdvisory], timeZone: String?, hours: [HourAdvisory] = []) {
        self.nights = nights; self.timeZone = timeZone; self.hours = hours
    }

    /// The advisory for the evening of `date` in the forecast's own time zone.
    public func night(startingOn date: Date) -> NightAdvisory? {
        guard let tz = timeZone.flatMap(TimeZone.init(identifier:)) else { return nights.first }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        let c = cal.dateComponents([.year, .month, .day], from: date)
        let key = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
        return nights.first { $0.date == key } ?? nights.first
    }
}

/// Open-Meteo, as src/lib/weather.ts: free, no key. Cloud and rain are averaged over the night
/// (18:00 to 06:00 next morning) rather than the whole day, which daylight weather would dominate.
public enum ViewingForecastService {
    public static func parse(_ data: Data, days: Int = 7) throws -> ViewingForecast {
        struct Payload: Decodable {
            struct Daily: Decodable {
                let time: [String]
                let cloud_cover_mean: [Double?]?
                let precipitation_probability_mean: [Double?]?
            }
            struct Hourly: Decodable {
                let time: [String]
                let cloud_cover: [Double?]?
                let cloud_cover_low: [Double?]?
                let cloud_cover_high: [Double?]?
                let precipitation_probability: [Double?]?
            }
            let timezone: String?
            let utc_offset_seconds: Int?
            let daily: Daily?
            let hourly: Hourly?
        }
        let p = try JSONDecoder().decode(Payload.self, from: data)
        let hourlyTimes = p.hourly?.time ?? []

        func nextKey(_ date: String) -> String {
            var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
            let f = DateFormatter(); f.calendar = cal; f.timeZone = cal.timeZone; f.dateFormat = "yyyy-MM-dd"
            guard let d = f.date(from: date), let n = cal.date(byAdding: .day, value: 1, to: d) else { return date }
            return f.string(from: n)
        }
        func nightly(_ values: [Double?]?, _ date: String) -> Double? {
            guard let values else { return nil }
            let next = nextKey(date)
            let matching: [Double] = values.enumerated().compactMap { i, v in
                guard let v, i < hourlyTimes.count else { return nil }
                let ts = hourlyTimes[i]
                let day = String(ts.prefix(10))
                guard ts.count >= 13, let hour = Int(ts.dropFirst(11).prefix(2)) else { return nil }
                return (day == date && hour >= 18) || (day == next && hour < 6) ? v : nil
            }
            return matching.isEmpty ? nil : matching.reduce(0, +) / Double(matching.count)
        }

        let dates = p.daily?.time ?? []
        let nights = dates.prefix(days).enumerated().map { i, date in
            NightAdvisory(
                date: date,
                cloudCoverPct: nightly(p.hourly?.cloud_cover, date) ?? (p.daily?.cloud_cover_mean?[safe: i]).flatMap { $0 } ?? 100,
                lowCloudCoverPct: nightly(p.hourly?.cloud_cover_low, date),
                highCloudCoverPct: nightly(p.hourly?.cloud_cover_high, date),
                precipitationChancePct: nightly(p.hourly?.precipitation_probability, date) ?? (p.daily?.precipitation_probability_mean?[safe: i]).flatMap { $0 } ?? 0)
        }

        // Open-Meteo's hourly times are wall-clock in the place's zone ("2026-10-04T21:00"); convert with its UTC offset.
        let offset = TimeInterval(p.utc_offset_seconds ?? 0)
        var utc = Calendar(identifier: .gregorian); utc.timeZone = TimeZone(identifier: "UTC")!
        let hourFormat = DateFormatter(); hourFormat.calendar = utc; hourFormat.timeZone = utc.timeZone
        hourFormat.locale = Locale(identifier: "en_US_POSIX"); hourFormat.dateFormat = "yyyy-MM-dd'T'HH:mm"
        let hours: [HourAdvisory] = hourlyTimes.enumerated().compactMap { i, ts in
            guard let cloud = p.hourly?.cloud_cover?[safe: i].flatMap({ $0 }), let wall = hourFormat.date(from: ts) else { return nil }
            let rain = p.hourly?.precipitation_probability?[safe: i].flatMap { $0 } ?? 0
            return HourAdvisory(start: wall.addingTimeInterval(-offset), cloudCoverPct: cloud, precipitationChancePct: rain)
        }
        return ViewingForecast(nights: Array(nights), timeZone: p.timezone, hours: hours)
    }

    public static func fetch(latitude: Double, longitude: Double, days: Int = 7, session: URLSession = .shared) async throws -> ViewingForecast {
        var c = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        c.queryItems = [
            .init(name: "latitude", value: String(latitude)), .init(name: "longitude", value: String(longitude)),
            .init(name: "daily", value: "cloud_cover_mean,precipitation_probability_mean"),
            .init(name: "hourly", value: "cloud_cover,cloud_cover_low,cloud_cover_high,precipitation_probability"),
            .init(name: "forecast_days", value: String(min(days + 1, 16))),
            .init(name: "timezone", value: "auto"),
        ]
        var req = URLRequest(url: c.url!)
        req.timeoutInterval = 8
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) { throw PocketBaseError.http(status: http.statusCode) }
        return try parse(data, days: days)
    }
}

private extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
