import AtlasCore
import SwiftUI

/// Tonight is a vertical journey through the sky, one thing per screen: first the Moon, then each
/// event in time order. Pages blur, shrink and tilt away as you scroll, and the star field behind
/// them drifts at its own speed for depth.
struct TonightView: View {
    let session: SessionStore
    @State var model: HubViewModel

    @State private var page: Int? = 0
    @State private var scrollY = 0.0
    @State private var selected: SkyEvent?
    @State private var showUpcoming = false
    @State private var showAccount = false

    var body: some View {
        ZStack {
            SkyBackdrop(drift: scrollY, warp: session.warp)
            switch model.phase {
            case .loading: Reading()
            case .failed(let text): Status(symbol: "wifi.exclamationmark", title: "The sky is out of reach", detail: text, action: ("Try again", reload))
            case .loaded: journey
            }
        }
        .overlay(alignment: .top) { topBar }
        .task { await model.load() }
        .sheet(item: $selected) { event in
            EventSheet(event: event).presentationDetents([.medium, .large]).presentationBackground(.ultraThinMaterial)
        }
        .sheet(isPresented: $showUpcoming) { HubView(model: model) }
        .sheet(isPresented: $showAccount) {
            AccountSheet(session: session) { showAccount = false }
                .presentationDetents([.height(280)]).presentationBackground(.ultraThinMaterial)
        }
    }

    private func reload() { Task { await model.load() } }

    // MARK: Journey

    private var journey: some View {
        let pages = model.tonight
        return GeometryReader { geo in
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 0) {
                    MoonPage(count: pages.events.count, isTonight: pages.isTonight)
                        .id(0)
                        .frame(height: geo.size.height)
                        .modifier(PageFlight())
                    ForEach(Array(pages.events.enumerated()), id: \.element.id) { i, event in
                        EventPage(event: event, index: i + 1, total: pages.events.count, isTonight: pages.isTonight) { selected = event }
                            .id(i + 1)
                            .frame(height: geo.size.height)
                            .modifier(PageFlight())
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $page)
            .onChange(of: page) { _, new in withAnimation(.smooth(duration: 1.0)) { scrollY = Double(new ?? 0) * 260 } }
            .refreshable { await model.load() }
            .overlay(alignment: .trailing) { rail(count: pages.events.count + 1) }
            .overlay(alignment: .bottom) { upcomingButton }
        }
        .ignoresSafeArea(edges: .bottom)
    }

    private func rail(count: Int) -> some View {
        VStack(spacing: 10) {
            ForEach(0..<count, id: \.self) { i in
                Capsule()
                    .fill(Sky.moonlight.opacity(i == (page ?? 0) ? 1 : 0.28))
                    .frame(width: 4, height: i == (page ?? 0) ? 26 : 6)
                    .animation(.spring(response: 0.4, dampingFraction: 0.7), value: page)
            }
        }
        .padding(.trailing, 10)
        .accessibilityHidden(true)
    }

    private var upcomingButton: some View {
        Button { Haptics.tap(); showUpcoming = true } label: {
            Label("Next 14 days", systemImage: "calendar")
                .font(.footnote.weight(.semibold))
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(.white.opacity(0.15)))
        }
        .buttonStyle(PressableStyle())
        .foregroundStyle(Sky.ink)
        .padding(.bottom, 34)
        .environment(\.colorScheme, .dark)
    }

    private var topBar: some View {
        HStack {
            Text("ATLAS").font(.footnote.weight(.semibold)).tracking(5).foregroundStyle(Sky.dim)
            Spacer()
            Button { Haptics.tap(); showAccount = true } label: {
                Image(systemName: session.email == nil ? "person.crop.circle.badge.plus" : "person.crop.circle")
                    .font(.title2).foregroundStyle(Sky.ink)
                    .padding(8).background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel(session.email == nil ? "Create account" : "Account")
            .environment(\.colorScheme, .dark)
        }
        .padding(.horizontal, 20).padding(.top, 6)
    }
}

/// Each page recedes as it leaves: shrinks, blurs and tilts about its horizontal axis.
private struct PageFlight: ViewModifier {
    func body(content: Content) -> some View {
        content.scrollTransition(axis: .vertical) { view, phase in
            view
                .opacity(1 - abs(phase.value) * 0.9)
                .scaleEffect(1 - abs(phase.value) * 0.18)
                .blur(radius: abs(phase.value) * 10)
                .rotation3DEffect(.degrees(phase.value * -28), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
                .offset(y: phase.value * 40)
        }
    }
}

// MARK: Pages

private struct MoonPage: View {
    let count: Int
    let isTonight: Bool
    @State private var shown = 0.0
    @State private var bob = false

    var body: some View {
        let now = Date()
        let elongation = MoonPhase.elongation(at: now)
        VStack(spacing: 20) {
            Spacer()
            Text(now.formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased())
                .font(.footnote.weight(.semibold)).tracking(2.4).foregroundStyle(Sky.dim)
            MoonDisc(elongation: shown)
                .frame(width: 230, height: 230)
                .offset(y: bob ? -8 : 8)
            VStack(spacing: 6) {
                Text(MoonPhase.name(at: now))
                    .font(.system(.largeTitle, design: .rounded, weight: .light))
                Text("\(Int(MoonPhase.illuminationPercent(at: now).rounded()))% lit")
                    .font(.callout).foregroundStyle(Sky.dim).monospacedDigit()
            }
            .foregroundStyle(Sky.ink)
            Spacer()
            VStack(spacing: 8) {
                Text(summary).font(.subheadline).foregroundStyle(Sky.dim).multilineTextAlignment(.center)
                Image(systemName: "chevron.compact.up").font(.title).foregroundStyle(Sky.dim)
                    .symbolEffect(.pulse, options: .repeating.speed(0.5))
            }
            .padding(.bottom, 96)
        }
        .padding(.horizontal, 28)
        .task {
            withAnimation(.easeOut(duration: 2.0)) { shown = elongation }
            withAnimation(.easeInOut(duration: 5).repeatForever(autoreverses: true)) { bob = true }
        }
    }

    private var summary: String {
        if count == 0 { return "A quiet sky." }
        let noun = count == 1 ? "event" : "events"
        return isTonight ? "\(count) \(noun) tonight. Swipe up." : "Quiet tonight. \(count) coming up. Swipe up."
    }
}

private struct EventPage: View {
    let event: SkyEvent
    let index: Int
    let total: Int
    let isTonight: Bool
    let onTap: () -> Void
    @State private var glow = false

    private var category: EventCategory? { EventCategory.forKind(event.kind) }

    var body: some View {
        Button(action: { Haptics.tap(); onTap() }) {
            VStack(spacing: 18) {
                Spacer()
                ZStack {
                    Circle().fill(RadialGradient(colors: [Sky.ember.opacity(0.35), .clear], center: .center, startRadius: 4, endRadius: 110))
                        .frame(width: 220, height: 220).scaleEffect(glow ? 1.15 : 0.9)
                    Image(systemName: category?.symbol ?? "sparkles")
                        .font(.system(size: 76, weight: .ultraLight))
                        .symbolRenderingMode(.hierarchical)
                        .symbolEffect(.pulse, options: .repeating.speed(0.5))
                }
                .foregroundStyle(Sky.moonlight)
                Text(category?.label.uppercased() ?? "SKY EVENT")
                    .font(.footnote.weight(.semibold)).tracking(2.2).foregroundStyle(Sky.ember)
                Text(event.title)
                    .font(.system(.largeTitle, design: .rounded, weight: .semibold))
                    .multilineTextAlignment(.center).foregroundStyle(Sky.ink)
                if !event.description.isEmpty {
                    Text(event.description).font(.body).foregroundStyle(Sky.dim)
                        .multilineTextAlignment(.center).lineLimit(3)
                }
                VStack(spacing: 2) {
                    Text(timeLine).font(.title2.monospacedDigit().weight(.medium))
                    Text(event.startsAt, style: .relative).font(.footnote).foregroundStyle(Sky.dim)
                        + Text(event.startsAt > .now ? " from now" : " ago").font(.footnote).foregroundStyle(Sky.dim)
                }
                .foregroundStyle(Sky.ink).padding(.top, 6)
                Spacer()
                Text("\(index) of \(total)").font(.caption).foregroundStyle(Sky.dim).padding(.bottom, 96)
            }
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .task { withAnimation(.easeInOut(duration: 3.5).repeatForever(autoreverses: true)) { glow = true } }
        .accessibilityHint("Opens details")
    }

    private var timeLine: String {
        isTonight ? event.startsAt.formatted(date: .omitted, time: .shortened)
            : event.startsAt.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).hour().minute())
    }
}

// MARK: States

private struct Reading: View {
    @State private var on = false
    var body: some View {
        VStack(spacing: 22) {
            ZStack {
                ForEach(0..<7, id: \.self) { i in
                    Circle().fill(Sky.moonlight).frame(width: 7, height: 7)
                        .offset(x: cos(Double(i) / 7 * 2 * .pi) * 44, y: sin(Double(i) / 7 * 2 * .pi) * 44)
                        .scaleEffect(on ? 1 : 0.3).opacity(on ? 1 : 0.25)
                        .animation(.easeInOut(duration: 0.9).repeatForever().delay(Double(i) * 0.12), value: on)
                }
            }
            .frame(width: 100, height: 100)
            Text("Reading the sky…").font(.callout).foregroundStyle(Sky.dim)
        }
        .onAppear { on = true }
        .accessibilityElement(children: .combine)
    }
}

private struct Status: View {
    let symbol: String, title: String, detail: String
    let action: (String, () -> Void)?
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: symbol).font(.system(size: 54, weight: .ultraLight)).foregroundStyle(Sky.moonlight)
            Text(title).font(.title2.weight(.semibold)).foregroundStyle(Sky.ink)
            Text(detail).font(.callout).foregroundStyle(Sky.dim).multilineTextAlignment(.center)
            if let action {
                Button(action.0, action: action.1).buttonStyle(PressableStyle())
                    .font(.headline).foregroundStyle(.black)
                    .padding(.horizontal, 28).padding(.vertical, 12)
                    .background(Capsule().fill(Sky.moonlight))
            }
        }
        .padding(32)
    }
}

// MARK: Sheets

private struct EventSheet: View {
    let event: SkyEvent
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Label(EventCategory.forKind(event.kind)?.label ?? "Sky event", systemImage: EventCategory.forKind(event.kind)?.symbol ?? "sparkles")
                    .font(.footnote.weight(.semibold)).foregroundStyle(Sky.ember)
                Text(event.title).font(.system(.title, design: .rounded, weight: .semibold))
                Text("\(event.startsAt.formatted(date: .abbreviated, time: .shortened)) – \(event.endsAt.formatted(date: .omitted, time: .shortened))")
                    .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                if !event.description.isEmpty { Text(event.description).font(.body) }
                if let content = event.content, !content.isEmpty { Text(content).font(.body).foregroundStyle(.secondary) }
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(24)
        }
        .environment(\.colorScheme, .dark)
    }
}

private struct AccountSheet: View {
    let session: SessionStore
    let dismiss: () -> Void
    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "person.crop.circle").font(.system(size: 44, weight: .light))
            Text(session.email ?? "Looking as a guest").font(.headline)
            Button(session.email == nil ? "Sign in or create account" : "Sign out") {
                dismiss()
                session.signOut()
            }
            .buttonStyle(PressableStyle())
            .font(.headline).foregroundStyle(.black)
            .padding(.horizontal, 28).padding(.vertical, 12)
            .background(Capsule().fill(Sky.moonlight))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .environment(\.colorScheme, .dark)
    }
}
