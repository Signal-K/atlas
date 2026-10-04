import AtlasCore
import Foundation
import Observation

/// Builds tonight's photography plan from the three things it needs: where you are, the sky-event
/// calendar (PocketBase) and the cloud forecast (Open-Meteo). Stars, darkness and the Moon are
/// computed on the device, so a failure of either network source degrades the plan rather than
/// blanking it.
@Observable @MainActor
final class TonightModel {
    enum Phase: Equatable { case loading, ready }

    private(set) var phase: Phase = .loading
    private(set) var plan: TonightPlan?
    private(set) var place: Place?
    /// Later relevant events (after tonight), for the feed's "Coming up".
    private(set) var upcoming: [SkyEvent] = []
    /// Days the last load looked ahead (14 free, 90 with Sky Pass).
    private(set) var horizonDays = SkyPass.freeHorizonDays
    /// Human-readable notes about sources that failed, shown where their data would have been.
    private(set) var eventsProblem: String?
    private(set) var weatherProblem: String?

    private let events: EventSource
    private let forecasts: ForecastSource
    private let location: LocationSource

    init(events: EventSource, forecasts: ForecastSource, location: LocationSource) {
        self.events = events; self.forecasts = forecasts; self.location = location
    }

    func load(horizonDays: Int = SkyPass.freeHorizonDays) async {
        self.horizonDays = horizonDays
        if plan == nil { phase = .loading }
        let place = await location.current()
        self.place = place
        let now = Date()
        let end = now.addingTimeInterval(Double(horizonDays) * 86400)

        async let eventResult = Result { try await events.events(from: now, to: end) }
        async let forecastResult = Result { try await forecasts.forecast(latitude: place.latitude, longitude: place.longitude) }
        let (fetchedEvents, fetchedForecast) = await (eventResult, forecastResult)
        if Task.isCancelled { return }

        eventsProblem = { if case .failure(let e) = fetchedEvents { return e.localizedDescription } else { return nil } }()
        weatherProblem = { if case .failure = fetchedForecast { return "Cloud forecast unavailable." } else { return nil } }()

        let allEvents = (try? fetchedEvents.get()) ?? []
        let built = TonightPlanner.plan(
            events: allEvents, forecast: try? fetchedForecast.get(),
            now: now, latitude: place.latitude, longitude: place.longitude, timeZone: place.timeZone)
        plan = built
        upcoming = TonightPlanner.upcoming(allEvents, after: built.nightEnd, latitude: place.latitude, longitude: place.longitude)
        phase = .ready
    }
}

private extension Result where Failure == Error {
    init(_ body: () async throws -> Success) async {
        do { self = .success(try await body()) } catch { self = .failure(error) }
    }
}
