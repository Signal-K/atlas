import Foundation
import XCTest
@testable import AtlasCore

/// Mirrors test/deep-sky-tonight.test.mjs (ASV-154). The pinned small-scope id lists are the same
/// ones the web model produces, so a drift between the two apps shows up here.
final class DeepSkyTonightTests: XCTestCase {
    private struct Case {
        let name: String, lat: Double, lon: Double, zone: String, now: String, moonPct: Int, small: [String]
    }

    private let cases = [
        Case(name: "London, 9 Nov 2026 (new Moon)", lat: 51.5, lon: -0.12, zone: "Europe/London", now: "2026-11-09T12:00:00Z", moonPct: 0,
             small: ["m39", "m34", "m32", "m1", "m27", "m78"]),
        Case(name: "London, 24 Nov 2026 (full Moon)", lat: 51.5, lon: -0.12, zone: "Europe/London", now: "2026-11-24T12:00:00Z", moonPct: 100,
             small: ["m39", "m34", "m32", "m94", "m27", "m78"]),
        Case(name: "Sydney, 9 Nov 2026 (new Moon)", lat: -33.87, lon: 151.21, zone: "Australia/Sydney", now: "2026-11-09T01:00:00Z", moonPct: 0,
             small: ["m47", "m41", "m78", "m42", "m77", "m1"]),
        Case(name: "Sydney, 24 Nov 2026 (full Moon)", lat: -33.87, lon: 151.21, zone: "Australia/Sydney", now: "2026-11-24T01:00:00Z", moonPct: 100,
             small: ["m47", "m41", "m78", "m77", "m42", "m1"]),
    ]

    private func date(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    private func run(_ c: Case, gear: DeepSkyGear, limit: Int = DeepSkyPlanner.defaultPicks) -> DeepSkyTonight {
        DeepSkyPlanner.tonight(now: date(c.now), latitude: c.lat, longitude: c.lon, timeZone: TimeZone(identifier: c.zone)!, gear: gear, limit: limit)
    }

    func testTelescopeUserGetsFiveRewardingTargetsOnEveryGoldenNight() {
        for c in cases {
            for gear in [DeepSkyGear.small, .large] {
                let r = run(c, gear: gear)
                XCTAssertGreaterThanOrEqual(r.picks.count, 5, "\(c.name) \(gear)")
                XCTAssertGreaterThanOrEqual(Set(r.picks.map(\.deepSkyClass)).count, 3, "\(c.name) \(gear) should span classes")
                XCTAssertEqual(r.picks.map(\.rating), r.picks.map(\.rating).sorted(by: >), "\(c.name) \(gear) sorted by rating")
                for p in r.picks {
                    XCTAssertGreaterThanOrEqual(Double(p.altitudeDeg), DeepSkyPlanner.minAltitudeDeg - 0.5, "\(c.name) \(p.id)")
                    XCTAssertGreaterThanOrEqual(p.bestAt, r.windowStart)
                    XCTAssertLessThanOrEqual(p.bestAt, r.windowEnd)
                    XCTAssertFalse(p.direction.isEmpty)
                    XCTAssertFalse(p.howTo.isEmpty)
                    XCTAssertFalse(p.compass.isEmpty)
                }
            }
        }
    }

    func testSmallScopePicksMatchTheWebModel() {
        for c in cases {
            XCTAssertEqual(run(c, gear: .small).picks.map(\.id), c.small, c.name)
        }
    }

    func testMoonPhaseIsReportedAndFullMoonCostsMagnitudes() {
        for c in cases {
            let r = run(c, gear: .small)
            XCTAssertEqual(Double(r.moonIlluminationPct), Double(c.moonPct), accuracy: 6, c.name)
        }
        let full = run(cases[1], gear: .small), new = run(cases[0], gear: .small)
        XCTAssertGreaterThan(full.picks.map(\.moonPenalty).max() ?? 0, new.picks.map(\.moonPenalty).max() ?? 0)
        XCTAssertTrue(new.summary.contains("Dark Moon"))
        XCTAssertTrue(full.summary.contains("100% lit") || full.summary.contains("% lit"))
    }

    func testBiggerGearNeverFindsFewerTargets() {
        let c = cases[0]
        func count(_ g: DeepSkyGear) -> Int { run(c, gear: g, limit: 200).picks.count }
        XCTAssertLessThanOrEqual(count(.eye), count(.binoculars))
        XCTAssertLessThanOrEqual(count(.binoculars), count(.small))
        XCTAssertLessThanOrEqual(count(.small), count(.large))
        XCTAssertGreaterThan(count(.large), count(.eye))
    }

    func testBeforeSixAmWeAreStillInLastEveningsNight() {
        let zone = TimeZone(identifier: "Europe/London")!
        let evening = DeepSkyPlanner.darkWindow(now: date("2026-11-09T20:00:00Z"), latitude: 51.5, longitude: -0.12, zone: zone)
        let smallHours = DeepSkyPlanner.darkWindow(now: date("2026-11-10T02:00:00Z"), latitude: 51.5, longitude: -0.12, zone: zone)
        XCTAssertEqual(evening.start, smallHours.start)
        XCTAssertEqual(evening.end, smallHours.end)
        let morning = DeepSkyPlanner.darkWindow(now: date("2026-11-10T08:00:00Z"), latitude: 51.5, longitude: -0.12, zone: zone)
        XCTAssertGreaterThan(morning.start, evening.end, "after 6am the next night is the one that matters")
    }

    func testLateNightStartsTheListFromNow() {
        let c = cases[0]
        let r = DeepSkyPlanner.tonight(now: date("2026-11-10T02:00:00Z"), latitude: c.lat, longitude: c.lon,
                                       timeZone: TimeZone(identifier: c.zone)!, gear: .small)
        XCTAssertGreaterThanOrEqual(r.windowStart, date("2026-11-10T02:00:00Z"))
        XCTAssertTrue(r.picks.allSatisfy { $0.bestAt >= r.windowStart })
    }

    func testSurfaceBrightnessFollowsMagnitudeAndSize() {
        // 10 arcmin object: area = pi/4 * 100, so SB = m + 2.5 log10(78.54)
        XCTAssertEqual(DeepSkyPlanner.surfaceBrightness(magnitude: 8, sizeDeg: 10.0 / 60), 8 + 2.5 * log10(Double.pi / 4 * 100), accuracy: 1e-9)
        // Same magnitude spread over a bigger area is fainter per square arcminute.
        XCTAssertGreaterThan(DeepSkyPlanner.surfaceBrightness(magnitude: 8, sizeDeg: 0.5), DeepSkyPlanner.surfaceBrightness(magnitude: 8, sizeDeg: 0.05))
        // Tiny sizes are floored at half an arcminute rather than going to -infinity.
        XCTAssertTrue(DeepSkyPlanner.surfaceBrightness(magnitude: 9, sizeDeg: 0).isFinite)
    }

    func testClassMappingCoversTheCatalogueAndDropsDoubles() {
        XCTAssertEqual(DeepSkyClass.from(type: "planetary nebula"), .dyingStar)
        XCTAssertEqual(DeepSkyClass.from(type: "supernova remnant"), .dyingStar)
        XCTAssertEqual(DeepSkyClass.from(type: "nebula"), .nebula)
        XCTAssertEqual(DeepSkyClass.from(type: "reflection nebula"), .nebula)
        XCTAssertEqual(DeepSkyClass.from(type: "cluster + nebula"), .nebula)
        XCTAssertEqual(DeepSkyClass.from(type: "globular cluster"), .cluster)
        XCTAssertEqual(DeepSkyClass.from(type: "open cluster"), .cluster)
        XCTAssertEqual(DeepSkyClass.from(type: "star association"), .cluster)
        XCTAssertEqual(DeepSkyClass.from(type: "galaxy"), .galaxy)
        XCTAssertNil(DeepSkyClass.from(type: "double star"))
        XCTAssertNil(DeepSkyClass.from(type: "deep sky object"))
    }

    func testOnlyMessierObjectsAreRanked() {
        XCTAssertEqual(DeepSkyPlanner.messierObjects.count, 109)
        XCTAssertTrue(DeepSkyPlanner.messierObjects.allSatisfy { $0.id.hasPrefix("m") })
        XCTAssertEqual(DeepSkyPlanner.displayName(DeepSkyPlanner.messierObjects.first { $0.id == "m2" }!), "M2")
        XCTAssertEqual(DeepSkyPlanner.displayName(DeepSkyPlanner.messierObjects.first { $0.id == "m13" }!), "Hercules Globular Cluster (M13)")
    }

    func testGearDefaultComesFromOnboardingEquipment() {
        XCTAssertEqual(DeepSkyGear.defaultFor(.telescope), .small)
        XCTAssertEqual(DeepSkyGear.defaultFor(.binoculars), .binoculars)
        XCTAssertEqual(DeepSkyGear.defaultFor(.phone), .eye)
        XCTAssertEqual(DeepSkyGear.defaultFor(nil), .eye)
        XCTAssertEqual(DeepSkyGear(rawValue: "large"), .large)
        XCTAssertNil(DeepSkyGear(rawValue: "bogus"))
    }

    func testPicksUseDifferentHowToForScopesAndBinoculars() {
        let nebula = DeepSkyPlanner.howTo(.nebula, gear: .small, name: "M42")
        XCTAssertTrue(nebula.contains("M42"))
        XCTAssertNotEqual(nebula, DeepSkyPlanner.howTo(.nebula, gear: .binoculars, name: "M42"))
        XCTAssertEqual(DeepSkyPlanner.howTo(.galaxy, gear: .small, name: "x"), DeepSkyPlanner.howTo(.galaxy, gear: .large, name: "x"))
    }
}
