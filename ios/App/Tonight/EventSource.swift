import AtlasCore
import CoreLocation
import Foundation

// MARK: Events

protocol EventSource: Sendable {
    func events(from: Date, to: Date) async throws -> [SkyEvent]
}

struct LiveEventSource: EventSource {
    let client: PocketBaseClient
    func events(from: Date, to: Date) async throws -> [SkyEvent] {
        try await client.skyEvents(from: from, to: to)
    }
}

// MARK: Forecast

protocol ForecastSource: Sendable {
    func forecast(latitude: Double, longitude: Double) async throws -> ViewingForecast
}

struct LiveForecastSource: ForecastSource {
    func forecast(latitude: Double, longitude: Double) async throws -> ViewingForecast {
        try await ViewingForecastService.fetch(latitude: latitude, longitude: longitude)
    }
}

// MARK: Location

struct Place: Equatable, Sendable {
    let latitude: Double
    let longitude: Double
    let name: String
    let timeZone: TimeZone
    /// True when we couldn't get the device location and are showing a default instead.
    let isFallback: Bool

    /// The listed city in the device's own time zone, so a denied permission still gives a sensible night.
    static func fallback() -> Place {
        let city = Cities.fallback(for: .current)
        return Place(latitude: city.latitude, longitude: city.longitude, name: city.name, timeZone: TimeZone(identifier: city.timeZone) ?? .current, isFallback: true)
    }
}

@MainActor protocol LocationSource {
    func current() async -> Place
}

/// When-in-use location with a reverse-geocoded name. Falls back to Perth (flagged) when
/// permission is denied or no fix arrives, so Tonight is never blank.
@MainActor final class CoreLocationSource: NSObject, LocationSource, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?

    func current() async -> Place {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
        let location: CLLocation? = await withCheckedContinuation { c in
            continuation = c
            switch manager.authorizationStatus {
            case .notDetermined: manager.requestWhenInUseAuthorization()
            case .denied, .restricted: finish(nil)
            default: manager.requestLocation()
            }
            Task { try? await Task.sleep(for: .seconds(8)); finish(nil) }
        }
        guard let location else { return .fallback() }
        let mark = (try? await CLGeocoder().reverseGeocodeLocation(location))?.first
        return Place(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude,
                     name: mark.flatMap { $0.locality ?? $0.administrativeArea } ?? "Your location",
                     timeZone: mark?.timeZone ?? .current, isFallback: false)
    }

    private func finish(_ location: CLLocation?) {
        continuation?.resume(returning: location)
        continuation = nil
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            switch status {
            case .authorizedWhenInUse, .authorizedAlways: self.manager.requestLocation()
            case .denied, .restricted: finish(nil)
            default: break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let first = locations.first
        Task { @MainActor in finish(first) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in finish(nil) }
    }
}

// MARK: Fixtures

/// Launch-argument fixtures so every state can be exercised without a backend or network:
/// `-AtlasFixtures`, `-AtlasFixtureEmpty` (no events), `-AtlasFixtureError` (events + weather
/// unreachable), `-AtlasFixtureCloudy`, `-AtlasFixtureSlow`.
struct Fixtures: EventSource, ForecastSource, Sendable {
    enum Mode { case loaded, empty, error, cloudy, slow }
    let mode: Mode

    struct FixtureError: LocalizedError {
        var errorDescription: String? { "Couldn't reach the sky events service." }
    }

    static func fromLaunchArguments(_ args: [String] = ProcessInfo.processInfo.arguments) -> Fixtures? {
        if args.contains("-AtlasFixtureError") { return .init(mode: .error) }
        if args.contains("-AtlasFixtureEmpty") { return .init(mode: .empty) }
        if args.contains("-AtlasFixtureCloudy") { return .init(mode: .cloudy) }
        if args.contains("-AtlasFixtureSlow") { return .init(mode: .slow) }
        if args.contains("-AtlasFixtures") { return .init(mode: .loaded) }
        return nil
    }

    func events(from: Date, to: Date) async throws -> [SkyEvent] {
        switch mode {
        case .error: throw FixtureError()
        case .empty: return []
        case .slow: try await Task.sleep(for: .seconds(3600)); return []
        case .loaded, .cloudy: return Self.sample(now: from).filter { $0.startsAt <= to }
        }
    }

    func forecast(latitude: Double, longitude: Double) async throws -> ViewingForecast {
        if mode == .error { throw FixtureError() }
        let cal = Calendar.current
        func key(_ offset: Int) -> String {
            let d = cal.date(byAdding: .day, value: offset, to: Date())!
            let c = cal.dateComponents([.year, .month, .day], from: d)
            return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
        }
        let tonightCloud: Double = mode == .cloudy ? 92 : 12
        return ViewingForecast(nights: [
            NightAdvisory(date: key(0), cloudCoverPct: tonightCloud, lowCloudCoverPct: tonightCloud * 0.6, highCloudCoverPct: tonightCloud * 0.4, precipitationChancePct: mode == .cloudy ? 60 : 3),
            NightAdvisory(date: key(1), cloudCoverPct: 20, lowCloudCoverPct: 10, highCloudCoverPct: 10, precipitationChancePct: 5),
            NightAdvisory(date: key(2), cloudCoverPct: 75, lowCloudCoverPct: 50, highCloudCoverPct: 30, precipitationChancePct: 30),
        ], timeZone: nil)
    }

    static func sample(now: Date) -> [SkyEvent] {
        func ev(_ id: String, _ kind: String, _ target: String, _ title: String, _ desc: String, hours: Double, dur: Double = 3) -> SkyEvent {
            let s = now.addingTimeInterval(hours * 3600)
            return SkyEvent(id: id, kind: kind, target: target, title: title, description: desc, startsAt: s, endsAt: s.addingTimeInterval(dur * 3600))
        }
        return [
            ev("f1", "moon_phase", "moon", "Waning Moon", "Rises after midnight with a bright gibbous face.", hours: 3),
            ev("f2", "conjunction", "moon_mars", "Moon–Mars Conjunction", "The Moon passes just below Mars before dawn.", hours: 7),
            ev("f3", "deep_sky", "m42", "Orion Nebula (M42) well placed for viewing", "Rises late evening; best in the pre-dawn sky.", hours: 1, dur: 8),
            ev("f4", "meteor_shower", "orionids", "Orionids peak", "Up to 20 meteors per hour from a dark site.", hours: 2, dur: 8),
            ev("f5", "planet_event", "saturn", "Saturn at Opposition", "Saturn is up all night and at its brightest.", hours: 0.5, dur: 9),
            // Beyond the free 14-day window: only Sky Pass loads these.
            ev("f6", "meteor_shower", "geminids", "Geminids peak", "One of the strongest showers of the year.", hours: 24 * 40, dur: 8),
        ]
    }
}
