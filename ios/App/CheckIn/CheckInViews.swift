import AtlasCore
import SwiftUI

/// The big "this is happening now, check in" area at the top of Tonight. It exists only while an
/// event is actually on, and becomes a confirmation once you've checked in.
struct CheckInCard: View {
    let event: SkyEvent
    let timeZone: TimeZone
    let checkedInAt: Date?
    let signedIn: Bool
    let action: () -> Void

    @State private var pulse = false
    private var category: EventCategory? { EventCategory.forKind(event.kind) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Circle().fill(Brand.green).frame(width: 10, height: 10).scaleEffect(pulse ? 1.35 : 1).opacity(pulse ? 0.55 : 1)
                    .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: pulse)
                Kicker(text: checkedInAt == nil ? "Happening now" : "Checked in", color: Brand.green)
            }
            HStack(alignment: .top, spacing: 12) {
                IconTile(symbol: category?.symbol ?? "sparkles", size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.title).font(.serif(26)).foregroundStyle(Brand.ink).fixedSize(horizontal: false, vertical: true)
                    Text(checkedInAt.map { "You checked in at \($0.clock(in: timeZone))." } ?? "On until \(event.endsAt.clock(in: timeZone)).")
                        .font(.system(size: 16)).foregroundStyle(Brand.muted)
                }
            }
            if checkedInAt == nil {
                Button { Haptics.tap(); action() } label: {
                    Label(signedIn ? "Check in" : "Sign in to check in", systemImage: signedIn ? "checkmark.circle.fill" : "person.crop.circle.badge.plus")
                        .font(.system(size: 20, weight: .semibold)).foregroundStyle(Brand.bg)
                        .frame(maxWidth: .infinity, minHeight: 68).background(Brand.green, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(PressableStyle())
                .accessibilityHint(signedIn ? "Logs that you watched this" : "Opens sign in")
            } else {
                Label("Saved to your journal", systemImage: "checkmark.circle.fill").font(.system(size: 17, weight: .medium)).foregroundStyle(Brand.green)
            }
        }
        .padding(18).brandCard(accent: Brand.green.opacity(0.75))
        .onAppear { pulse = true }
    }
}

/// The check-in form: how it went and an optional note. One tap to save; nothing is required.
struct CheckInSheet: View {
    let event: SkyEvent
    let equipment: Equipment
    let placeName: String?
    let conditions: String?
    let userID: String
    let store: CheckInStore
    let dismiss: () -> Void

    @State private var rating: CheckInRating?
    @State private var note = ""
    @State private var saving = false
    @State private var failed = false
    @FocusState private var noteFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Kicker(text: "Check in", color: Brand.green)
                    Text(event.title).font(.serif(28)).foregroundStyle(Brand.ink).fixedSize(horizontal: false, vertical: true)
                }
                VStack(alignment: .leading, spacing: 10) {
                    Text("How did it go?").font(.system(size: 17, weight: .medium)).foregroundStyle(Brand.ink)
                    HStack(spacing: 8) {
                        ForEach(CheckInRating.allCases) { r in
                            Button { Haptics.tap(); rating = rating == r ? nil : r } label: {
                                Text(r.label).font(.system(size: 16, weight: .medium))
                                    .foregroundStyle(rating == r ? Brand.bg : Brand.ink)
                                    .frame(maxWidth: .infinity, minHeight: 52)
                                    .background(rating == r ? Brand.violet : Brand.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(rating == r ? .clear : Brand.line))
                            }
                            .buttonStyle(PressableStyle())
                            .accessibilityAddTraits(rating == r ? .isSelected : [])
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 10) {
                    Text("A note (optional)").font(.system(size: 17, weight: .medium)).foregroundStyle(Brand.ink)
                    TextField("What did you see?", text: $note, axis: .vertical)
                        .lineLimit(3...6).focused($noteFocused).font(.system(size: 17)).padding(14)
                        .background(Brand.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Brand.line))
                }
                if failed {
                    Label("Couldn't save. Check your connection and try again.", systemImage: "wifi.exclamationmark")
                        .font(.system(size: 16)).foregroundStyle(Brand.flagship)
                }
                Button { Task { await save() } } label: {
                    HStack(spacing: 10) {
                        if saving { ProgressView().tint(Brand.bg) }
                        Text(saving ? "Saving…" : "Save check-in").font(.system(size: 19, weight: .semibold))
                    }
                    .foregroundStyle(Brand.bg).frame(maxWidth: .infinity, minHeight: 60).background(Brand.green, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(PressableStyle()).disabled(saving)
            }
            .padding(24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Brand.bg)
        .task { Analytics.capture(.checkInOpened, ["kind": event.kind]) }
    }

    private func save() async {
        noteFocused = false; saving = true; failed = false
        let draft = CheckInDraft(event: event, rating: rating, note: note, deviceUsed: equipment.label, locationLabel: placeName, conditionSummary: conditions)
        do {
            try await store.submit(draft, userID: userID)
            Haptics.success()
            Analytics.capture(.checkInCompleted, ["kind": event.kind, "rating": rating?.rawValue ?? "none", "has_note": !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "equipment": equipment.rawValue])
            dismiss()
        } catch {
            failed = true; Haptics.failure()
            Analytics.capture(.checkInFailed, ["kind": event.kind])
        }
        saving = false
    }
}
