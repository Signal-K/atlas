import AtlasCore
import SwiftUI

struct HubView: View {
    @State var model: HubViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    stats
                    chips
                    content
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await model.load() }
            .background(Color(.systemGroupedBackground))
            .navigationBarHidden(true)
        }
        .task { await model.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased())
                .font(.caption.weight(.semibold)).tracking(1.2).foregroundStyle(.secondary)
            Text("Flagship events, worldwide").font(.largeTitle.bold())
        }
        .padding(.top, 16)
    }

    private var stats: some View {
        let now = Date()
        return HStack(spacing: 12) {
            stat("MOON", MoonPhase.name(at: now), "\(Int(MoonPhase.illuminationPercent(at: now).rounded()))% lit")
            stat("UPCOMING", "\(model.events.count)", "next 14 days")
        }
    }

    private func stat(_ label: String, _ value: String, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2.weight(.semibold)).tracking(1).foregroundStyle(.secondary)
            Text(value).font(.title3.bold()).lineLimit(1).minimumScaleFactor(0.7)
            Text(sub).font(.footnote).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HubFilter.allCases, id: \.self) { f in
                    Button { model.filter = f } label: {
                        Text("\(f.label) \(model.count(f))")
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(model.filter == f ? Color.accentColor : Color(.secondarySystemGroupedBackground), in: Capsule())
                            .foregroundStyle(model.filter == f ? Color.white : Color.primary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView("Loading events…").frame(maxWidth: .infinity).padding(.top, 40)
        case .failed(let text):
            failure(text)
        case .loaded:
            if model.groups.isEmpty {
                placeholder("Nothing on the sky calendar", "No events match this filter in the next 14 days.", retry: false)
            } else {
                ForEach(model.groups, id: \.key) { group in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(group.label).font(.headline)
                        VStack(spacing: 0) {
                            ForEach(group.events) { EventRow(event: $0) }
                        }
                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
                    }
                }
            }
        }
    }

    private func failure(_ text: String) -> some View {
        placeholder("Couldn't load events", text, retry: true)
    }

    private func placeholder(_ title: String, _ detail: String, retry: Bool) -> some View {
        VStack(spacing: 8) {
            Text(title).font(.headline)
            Text(detail).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            if retry {
                Button("Retry") { Task { await model.load() } }.buttonStyle(.borderedProminent).padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity).padding(.top, 40)
    }
}

private struct EventRow: View {
    let event: SkyEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: EventCategory.forKind(event.kind)?.symbol ?? "sparkles")
                .font(.title3).frame(width: 28).foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.title).font(.body.weight(.semibold))
                if !event.description.isEmpty {
                    Text(event.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            Text(event.startsAt.formatted(date: .omitted, time: .shortened))
                .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
        }
        .padding(12)
        .accessibilityElement(children: .combine)
    }
}
