import AtlasCore
import Foundation
import Observation

@Observable @MainActor
final class HubViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    private(set) var phase: Phase = .loading
    private(set) var events: [SkyEvent] = []
    var filter: HubFilter = .all
    private(set) var feed = HubFeed()

    private let source: EventSource
    /// Same 14-day lookahead as the web Hub.
    private let windowDays = 14

    init(source: EventSource) { self.source = source }

    var groups: [HubDayGroup] { feed.groups(events, filter: filter) }

    func count(_ f: HubFilter) -> Int { feed.count(events, filter: f) }

    func load() async {
        if events.isEmpty { phase = .loading }
        let now = Date()
        do {
            let fetched = try await source.events(from: now, to: now.addingTimeInterval(Double(windowDays) * 86400))
            feed = HubFeed(now: now)
            events = fetched
            phase = .loaded
        } catch is CancellationError {
            return
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}
