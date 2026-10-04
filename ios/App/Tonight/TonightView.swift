import AtlasCore
import SwiftUI

/// Tonight as a feed, the way the web Hub reads: a header, jump chips, then cards in a fixed
/// order. The paper stars behind drift at their own pace as you scroll, and each card settles
/// into place as it arrives.
struct TonightView: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    @State var model: TonightModel

    @State private var drift = 0.0
    @State private var detail: DetailItem?
    @State private var showAccount = false
    @State private var showSkyPass = false

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
                    // `-AtlasScrollTo <section>` (testing / screenshots): tonight, photo, stars, coming.
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
        .sheet(item: $detail) { item in
            DetailSheet(item: item, timeZone: model.plan?.timeZone ?? .current)
                .presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showAccount) {
            AccountSheet(session: session, skyPass: skyPass,
                         openSkyPass: { showAccount = false; Task { try? await Task.sleep(for: .milliseconds(350)); showSkyPass = true } },
                         dismiss: { showAccount = false })
                .presentationDetents([.height(440)])
        }
        .sheet(isPresented: $showSkyPass) {
            SkyPassView(store: skyPass, signedIn: session.userID != nil) { showSkyPass = false }
                .presentationDetents([.large]).presentationDragIndicator(.visible)
        }
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
            Button { Haptics.tap(); showAccount = true } label: {
                Text(session.email == nil ? "Guest" : (session.email!.prefix(1).uppercased()))
                    .font(.system(size: 13, weight: .medium)).foregroundStyle(Brand.ink)
                    .padding(.horizontal, 14).frame(minHeight: 34)
                    .background(Brand.surface, in: Capsule()).overlay(Capsule().strokeBorder(Brand.line))
            }
            .accessibilityLabel(session.email == nil ? "Guest — sign in" : "Account")
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .background(.bar.opacity(0.92))
        .overlay(alignment: .bottom) { Rectangle().fill(Brand.line).frame(height: 1) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(model.place.map { "Tonight in \($0.name)" } ?? "Tonight").font(.serif(28)).foregroundStyle(Brand.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(headerSubtitle).font(.mono(11, medium: false)).foregroundStyle(Brand.muted)
        }
        .padding(.top, 18).padding(.bottom, 14)
    }

    private var headerSubtitle: String {
        let zone = model.plan?.timeZone ?? .current
        let day = Date().formatted(Date.FormatStyle(timeZone: zone).weekday(.wide).day().month(.abbreviated))
        return day + (model.place?.isFallback == true ? " · location off, showing a default city" : "")
    }

    // MARK: Feed

    @ViewBuilder private func feed(_ plan: TonightPlan) -> some View {
        dispatchSection(plan)
        photoSection(plan)
        starsSection(plan)
        comingSection(plan)
        Text("Weather by Open-Meteo. Sky positions computed on your device.").font(.mono(10, medium: false)).foregroundStyle(Brand.muted).padding(.top, 28)
    }

    @ViewBuilder private func dispatchSection(_ plan: TonightPlan) -> some View {
        Color.clear.frame(height: 0).id("tonight")
        VStack(spacing: 12) {
            VerdictCard(plan: plan, weatherProblem: model.weatherProblem).feedEntrance()
            NightCard(plan: plan).feedEntrance()
        }
    }

    @ViewBuilder private func photoSection(_ plan: TonightPlan) -> some View {
        SectionHead(kicker: "Photo opportunities", trailing: plan.targets.isEmpty ? nil : "\(plan.targets.count) tonight").id("photo")
        VStack(spacing: 12) {
            if plan.targets.isEmpty {
                quietCard(plan)
            } else {
                ForEach(plan.targets) { t in
                    TargetCard(target: t, timeZone: plan.timeZone) { detail = .target(t) }.feedEntrance()
                }
            }
        }
    }

    private func quietCard(_ plan: TonightPlan) -> AnyView {
        let problem = model.eventsProblem
        let detailText: String = problem ?? (plan.rating == .skip
            ? "Clouds are the story tonight, so there are no targets worth the trip."
            : "No marquee events are visible from here tonight. A wide-angle starfield or the bright stars below make good subjects.")
        if problem == nil {
            return AnyView(MessageCard(symbol: "camera.viewfinder", kicker: "Quiet night", title: "Nothing scheduled — shoot the stars", detail: detailText)
                .feedEntrance())
        }
        return AnyView(MessageCard(symbol: "wifi.exclamationmark", kicker: "Events unavailable", title: "Couldn't load sky events", detail: detailText,
                                   actionTitle: "Try again", action: { Task { await reload() } })
            .feedEntrance())
    }

    @ViewBuilder private func starsSection(_ plan: TonightPlan) -> some View {
        SectionHead(kicker: "Prominent stars").id("stars")
        StarsCard(plan: plan).feedEntrance()
    }

    @ViewBuilder private func comingSection(_ plan: TonightPlan) -> some View {
        SectionHead(kicker: "Coming up", trailing: model.upcoming.isEmpty ? nil : "next \(model.horizonDays) days").id("coming")
        if model.upcoming.isEmpty {
            Text(model.eventsProblem == nil ? "No other events in the next \(model.horizonDays) days." : "Events will appear here once Atlas can reach the calendar.")
                .font(.system(size: 14)).foregroundStyle(Brand.muted)
        } else {
            let groups = DayGroup.make(model.upcoming, zone: plan.timeZone)
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(groups) { group in
                    DayPill(label: group.label)
                    RowGroup(items: group.events) { e in EventRow(event: e, timeZone: plan.timeZone) { detail = .event(e) } }
                        .feedEntrance()
                }
            }
        }
        if !skyPass.isEntitled {
            MessageCard(symbol: "lock.fill", kicker: "Sky Pass",
                        title: "See \(SkyPass.passHorizonDays) days ahead",
                        detail: "Atlas shows the next \(SkyPass.freeHorizonDays) days free. Sky Pass extends the outlook to \(SkyPass.passHorizonDays) days so you can plan trips around eclipses, conjunctions and meteor showers.",
                        actionTitle: "Get Sky Pass", action: { Haptics.tap(); showSkyPass = true })
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

private struct AccountSheet: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    let openSkyPass: () -> Void
    let dismiss: () -> Void
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var deleteError: String?
    @Environment(\.openURL) private var openURL
    var body: some View {
        VStack(spacing: 16) {
            AtlasMark(size: 56)
            Text(session.email ?? "Looking as a guest").font(.serif(20)).foregroundStyle(Brand.ink)
            Text(session.email == nil ? "Sign in to keep your watchlist and journal." : "Signed in to Atlas.")
                .font(.system(size: 14)).foregroundStyle(Brand.muted)
            Button { Haptics.tap(); openSkyPass() } label: {
                Text(skyPass.isEntitled ? "Sky Pass · active" : "Get Sky Pass")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(skyPass.isEntitled ? Brand.green : Brand.violet)
                    .padding(.horizontal, 24).frame(minHeight: 46)
                    .background(Brand.surface, in: Capsule()).overlay(Capsule().strokeBorder(Brand.line2))
            }
            .buttonStyle(PressableStyle())
            Button {
                dismiss(); session.signOut()
            } label: {
                Text(session.email == nil ? "Sign in or create account" : "Sign out")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.bg)
                    .padding(.horizontal, 24).frame(minHeight: 46).background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle())
            if session.email != nil {
                Button { confirmDelete = true } label: {
                    HStack(spacing: 8) {
                        if deleting { ProgressView().controlSize(.small) }
                        Text("Delete account").font(.system(size: 14, weight: .medium))
                    }
                    .foregroundStyle(Brand.flagship).frame(minHeight: 36)
                }
                .disabled(deleting)
                if let deleteError { Text(deleteError).font(.system(size: 12)).foregroundStyle(Brand.flagship) }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity).background(Brand.bg)
        .confirmationDialog("Delete your Atlas account?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete account permanently", role: .destructive) { performDelete() }
            if skyPass.isEntitled {
                Button("Manage subscription first") {
                    if let url = URL(string: "https://apps.apple.com/account/subscriptions") { openURL(url) }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your account, journal, watchlist and check-ins on every Atlas app and the website. It cannot be undone. Deleting your account does not cancel an App Store subscription; cancel it in Settings → Apple ID → Subscriptions.")
        }
    }

    private func performDelete() {
        deleting = true; deleteError = nil
        Task {
            do { try await session.deleteAccount(); dismiss() }
            catch { deleteError = error.localizedDescription }
            deleting = false
        }
    }
}
