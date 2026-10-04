import AtlasCore
import SwiftUI

/// Tonight, kept short: the verdict, one way into the sky, the best shot, and what's coming. Everything
/// else (the night timeline, extra targets, later events) is one tap away rather than on the first screen.
/// The paper stars behind drift at their own pace as you scroll, and each card settles into place.
struct TonightView: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    let settings: AppSettings
    let checkIns: CheckInStore
    @State var model: TonightModel

    @State private var drift = 0.0
    @State private var detail: DetailItem?
    @State private var showSettings = false
    @State private var showSkyPass = false
    @State private var showSky = false
    @State private var camera: CameraRequest?
    @State private var checkInEvent: SkyEvent?
    @State private var showAllTargets = false
    @State private var showAllUpcoming = false
    @State private var showTimeline = false

    var body: some View {
        ZStack {
            PaperBackdrop(drift: drift, warp: session.warp)
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        offsetReader
                        header
                        if let plan = model.plan, model.phase == .ready { feed(plan) } else { Skeleton() }
                    }
                    .padding(.horizontal, 16).padding(.bottom, 40)
                    .frame(maxWidth: 640).frame(maxWidth: .infinity)
                }
                .coordinateSpace(name: "feed")
                .onPreferenceChange(OffsetKey.self) { drift = -$0 }
                .refreshable { await reload() }
                .onChange(of: model.phase) { _, phase in
                    // `-AtlasScrollTo <section>` (testing / screenshots): tonight, photo, coming.
                    let args = ProcessInfo.processInfo.arguments
                    guard phase == .ready, let i = args.firstIndex(of: "-AtlasScrollTo"), i + 1 < args.count else { return }
                    Task { try? await Task.sleep(for: .milliseconds(600)); proxy.scrollTo(args[i + 1], anchor: .top) }
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) { topBar }
        .task(id: skyPass.isEntitled) { await reload() }
        // `-AtlasOpenSkyPass` (testing / screenshots): present the Sky Pass sheet on arrival.
        .task { if ProcessInfo.processInfo.arguments.contains("-AtlasOpenSkyPass") { try? await Task.sleep(for: .seconds(1)); showSkyPass = true } }
        // `-AtlasOpenSky` / `-AtlasOpenSettings` / `-AtlasOpenCheckIn` (testing / screenshots): open those screens once the plan is ready.
        .onChange(of: model.phase) { _, phase in
            let args = ProcessInfo.processInfo.arguments
            guard phase == .ready else { return }
            Task {
                try? await Task.sleep(for: .milliseconds(800))
                if args.contains("-AtlasOpenSky") { showSky = true }
                if args.contains("-AtlasOpenSettings") { showSettings = true }
                if args.contains("-AtlasOpenCheckIn"), let plan = model.plan {
                    checkInEvent = TonightPlanner.activeNow(model.allEvents, now: Date(), latitude: plan.latitude, longitude: plan.longitude).first
                }
            }
        }
        .sheet(item: $detail) { item in
            DetailSheet(item: item, timeZone: model.plan?.timeZone ?? .current, device: settings.device,
                        camera: cameraPlan(for: item)) { plan in
                detail = nil
                Task { try? await Task.sleep(for: .milliseconds(400)); camera = CameraRequest(plan: plan) }
            }
            .presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showSettings) {
            SettingsSheet(settings: settings, session: session, skyPass: skyPass,
                          alertsChanged: { Task { await rescheduleAlerts() } },
                          openSkyPass: { showSettings = false; Task { try? await Task.sleep(for: .milliseconds(350)); showSkyPass = true } },
                          dismiss: { showSettings = false })
                .presentationDetents([.large]).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showSkyPass) {
            SkyPassView(store: skyPass, signedIn: session.userID != nil) { showSkyPass = false }
                .presentationDetents([.large]).presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showSky) {
            if let plan = model.plan { SkyView(plan: plan, settings: settings) { showSky = false } }
        }
        .fullScreenCover(item: $camera) { request in CameraView(plan: request.plan) { camera = nil } }
        .sheet(item: $checkInEvent) { event in
            if let userID = session.userID, let plan = model.plan {
                CheckInSheet(event: event, equipment: settings.equipment ?? .phone, placeName: model.place?.name,
                             conditions: plan.cloudCoverPct.map { "\(Int($0.rounded()))% cloud, \(plan.moonName)" },
                             userID: userID, store: checkIns) { checkInEvent = nil }
                    .presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
            }
        }
        .onChange(of: model.phase) { _, phase in if phase == .ready { Task { await rescheduleAlerts() } } }
    }

    private func cameraPlan(for item: DetailItem) -> CameraPlan {
        let event: SkyEvent = { switch item { case .target(let t): t.event; case .event(let e): e } }()
        return CameraAdvisor.plan(kind: event.kind, title: event.title, equipment: settings.equipment ?? .phone, device: settings.device,
                                  moonIlluminationPct: MoonPhase.illuminationPercent(at: event.startsAt))
    }

    /// Replaces pending alerts with ones planned from what's on screen. Never asks for permission here:
    /// that happens when the person turns alerts on.
    private func rescheduleAlerts() async {
        guard settings.anyAlertsOn else { await AlertScheduler.removeAll(); return }
        await AlertScheduler.schedule(model.plannedAlerts(preferences: settings.alertPreferences))
        AlertRefresh.schedule()
    }

    private func reload() async {
        await model.load(horizonDays: SkyPass.horizonDays(entitled: skyPass.isEntitled))
    }

    // MARK: Chrome

    private var topBar: some View {
        HStack(spacing: 10) {
            AtlasMark(size: 34)
            Text("Atlas").font(.display(21)).foregroundStyle(Brand.ink)
            Spacer()
            Button { Haptics.tap(); showSettings = true } label: {
                Image(systemName: "gearshape").font(.system(size: 18, weight: .medium)).foregroundStyle(Brand.ink)
                    .frame(width: 44, height: 44).background(Brand.surface, in: Circle()).overlay(Circle().strokeBorder(Brand.line))
            }
            .accessibilityLabel("Settings")
        }
        .padding(.horizontal, 16).padding(.vertical, 6)
        .background(.bar.opacity(0.92))
        .overlay(alignment: .bottom) { Rectangle().fill(Brand.line).frame(height: 1) }
    }

    /// Just the place. The date is on the phone's status bar and in every event row, so it isn't repeated here.
    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(model.place.map { "Tonight in \($0.name)" } ?? "Tonight").font(.serif(30)).foregroundStyle(Brand.ink)
                .fixedSize(horizontal: false, vertical: true)
            if model.place?.isFallback == true {
                Label("Location is off, so this is a default city", systemImage: "location.slash").font(.system(size: 15)).foregroundStyle(Brand.muted)
            }
        }
        .padding(.top, 16).padding(.bottom, 12)
    }

    // MARK: Feed

    @ViewBuilder private func feed(_ plan: TonightPlan) -> some View {
        Color.clear.frame(height: 0).id("tonight")
        checkInSection(plan)
        VStack(spacing: 12) {
            VerdictCard(plan: plan, weatherProblem: model.weatherProblem).feedEntrance()
            SkyEntryCard(equipment: settings.equipment ?? .phone, count: visibleCount(plan)) { Haptics.tap(); showSky = true }.feedEntrance()
        }
        bestShotSection(plan)
        comingSection(plan)
        Text("Weather by Open-Meteo. Sky positions computed on your device.").font(.system(size: 12)).foregroundStyle(Brand.muted).padding(.top, 28)
    }

    /// Re-evaluated every minute so the card appears when an event starts and goes when it ends.
    @ViewBuilder private func checkInSection(_ plan: TonightPlan) -> some View {
        TimelineView(.everyMinute) { context in
            let active = TonightPlanner.activeNow(model.allEvents, now: context.date, latitude: plan.latitude, longitude: plan.longitude)
            if !active.isEmpty {
                VStack(spacing: 12) {
                    ForEach(active.prefix(2)) { event in
                        CheckInCard(event: event, timeZone: plan.timeZone, checkedInAt: checkIns.checkedInAt(event.id), signedIn: session.userID != nil) {
                            if session.userID == nil { session.signOut() } else { checkInEvent = event }
                        }
                        .feedEntrance()
                    }
                }
                .padding(.bottom, 12)
            }
        }
    }

    private func visibleCount(_ plan: TonightPlan) -> Int {
        SkyVisibility.visible(with: settings.equipment ?? .phone, at: max(Date(), plan.darkness.civilDusk ?? Date()),
                              latitude: plan.latitude, longitude: plan.longitude, moonIlluminationPct: plan.moonIlluminationPct).count
    }

    @ViewBuilder private func bestShotSection(_ plan: TonightPlan) -> some View {
        SectionHead(kicker: plan.targets.count > 1 ? "Best shot tonight" : "Shot tonight").id("photo")
        VStack(spacing: 12) {
            if let first = plan.targets.first {
                TargetCard(target: first, timeZone: plan.timeZone) { detail = .target(first) }.feedEntrance()
                if plan.targets.count > 1 {
                    if showAllTargets {
                        ForEach(plan.targets.dropFirst()) { t in TargetCard(target: t, timeZone: plan.timeZone) { detail = .target(t) } }
                    }
                    ExpandButton(title: showAllTargets ? "Show fewer" : "\(plan.targets.count - 1) more tonight", expanded: showAllTargets) {
                        withAnimation(.smooth(duration: 0.35)) { showAllTargets.toggle() }
                    }
                }
            } else {
                quietCard(plan)
            }
            ExpandButton(title: showTimeline ? "Hide night timeline" : "When to shoot tonight", expanded: showTimeline, symbol: "clock") {
                withAnimation(.smooth(duration: 0.35)) { showTimeline.toggle() }
            }
            if showTimeline { NightCard(plan: plan).transition(.opacity.combined(with: .move(edge: .top))) }
        }
    }

    private func quietCard(_ plan: TonightPlan) -> AnyView {
        let problem = model.eventsProblem
        let detailText: String = problem ?? (plan.rating == .skip
            ? "Clouds are the story tonight, so there are no targets worth the trip."
            : "No marquee events are visible from here tonight. Explore your sky above for what you can see.")
        if problem == nil {
            return AnyView(MessageCard(symbol: "camera.viewfinder", kicker: "Quiet night", title: "Nothing scheduled", detail: detailText).feedEntrance())
        }
        return AnyView(MessageCard(symbol: "wifi.exclamationmark", kicker: "Events unavailable", title: "Couldn't load sky events", detail: detailText,
                                   actionTitle: "Try again", action: { Task { await reload() } })
            .feedEntrance())
    }

    @ViewBuilder private func comingSection(_ plan: TonightPlan) -> some View {
        SectionHead(kicker: "Coming up", trailing: model.upcoming.isEmpty ? nil : "next \(model.horizonDays) days").id("coming")
        if model.upcoming.isEmpty {
            Text(model.eventsProblem == nil ? "No other events in the next \(model.horizonDays) days." : "Events will appear here once Atlas can reach the calendar.")
                .font(.system(size: 16)).foregroundStyle(Brand.muted)
        } else {
            let shown = showAllUpcoming ? model.upcoming : Array(model.upcoming.prefix(4))
            let groups = DayGroup.make(shown, zone: plan.timeZone)
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(groups) { group in
                    DayPill(label: group.label)
                    RowGroup(items: group.events) { e in EventRow(event: e, timeZone: plan.timeZone) { detail = .event(e) } }
                        .feedEntrance()
                }
            }
            if model.upcoming.count > 4 {
                ExpandButton(title: showAllUpcoming ? "Show fewer" : "Show all \(model.upcoming.count)", expanded: showAllUpcoming) {
                    withAnimation(.smooth(duration: 0.35)) { showAllUpcoming.toggle() }
                }
                .padding(.top, 10)
            }
        }
        if !skyPass.isEntitled {
            MessageCard(symbol: "lock.fill", kicker: "Sky Pass",
                        title: "See \(SkyPass.passHorizonDays) days ahead",
                        detail: "Atlas shows the next \(SkyPass.freeHorizonDays) days free. Sky Pass extends the outlook to \(SkyPass.passHorizonDays) days so you can plan trips around eclipses, conjunctions and meteor showers.",
                        actionTitle: "Get Sky Pass", action: { Haptics.tap(); Analytics.capture(.skyPassOpened); showSkyPass = true })
                .padding(.top, 12)
        }
    }

    // MARK: Scroll offset

    private var offsetReader: some View {
        GeometryReader { geo in Color.clear.preference(key: OffsetKey.self, value: geo.frame(in: .named("feed")).minY) }.frame(height: 0)
    }
}

private struct OffsetKey: PreferenceKey {
    static let defaultValue: Double = 0
    static func reduce(value: inout Double, nextValue: () -> Double) { value = nextValue() }
}

/// Placeholder cards while the plan is computed.
private struct Skeleton: View {
    @State private var on = false
    var body: some View {
        VStack(spacing: 12) {
            SectionHead(kicker: "Reading the sky…")
            ForEach(0..<3, id: \.self) { i in
                RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Brand.surface).frame(height: i == 0 ? 190 : 120)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Brand.line))
                    .opacity(on ? 1 : 0.5)
                    .animation(.easeInOut(duration: 0.9).repeatForever().delay(Double(i) * 0.15), value: on)
            }
        }
        .onAppear { on = true }
        .accessibilityElement(children: .ignore).accessibilityLabel("Reading the sky")
    }
}

/// The way into the Sky page, worded for what you look with.
private struct SkyEntryCard: View {
    let equipment: Equipment
    let count: Int
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 14) {
                Image(systemName: equipment.symbol).font(.system(size: 24, weight: .medium)).foregroundStyle(Brand.violet)
                    .frame(width: 52, height: 52).background(Brand.violetWash, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text("Explore your sky").font(.serif(22)).foregroundStyle(Brand.ink)
                    Text("\(count) things to see with \(equipment == .phone ? "your phone" : equipment.label.lowercased())")
                        .font(.system(size: 16)).foregroundStyle(Brand.muted).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Brand.muted.opacity(0.6))
            }
            .padding(16).contentShape(Rectangle()).brandCard()
        }
        .buttonStyle(PressableStyle())
        .accessibilityHint("Opens a live sky chart")
    }
}

/// Quiet full-width row that reveals more, so the first screen stays short.
struct ExpandButton: View {
    let title: String
    let expanded: Bool
    var symbol: String?
    let action: () -> Void

    var body: some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 8) {
                if let symbol { Image(systemName: symbol) }
                Text(title).font(.system(size: 16, weight: .medium))
                Spacer()
                Image(systemName: expanded ? "chevron.up" : "chevron.down").font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(Brand.violet).padding(.horizontal, 16).frame(minHeight: 50).contentShape(Rectangle())
            .background(Brand.surface2.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityValue(expanded ? "Expanded" : "Collapsed")
    }
}
