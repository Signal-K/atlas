import AtlasCore
import PhotosUI
import SwiftUI
import UIKit

struct ChallengesView: View {
    @StateObject private var model: ChallengesViewModel
    let router: NotificationRouter
    @State private var pickerItem: PhotosPickerItem?

    init(session: SessionStore, router: NotificationRouter) {
        self.router = router
        _model = StateObject(wrappedValue: ChallengesViewModel(session: session))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SectionHead(kicker: "Challenges")
                    Text("World Space Week and meteor-watch challenges. Gold badge in-window, silver badge after.")
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.muted)

                    worldSpaceWeekDrop

                    if model.isLoading {
                        ProgressView("Loading challenges…")
                            .font(.system(size: 14))
                            .frame(maxWidth: .infinity, minHeight: 60)
                    } else if model.challenges.isEmpty {
                        emptyState
                    } else {
                        challengePicker
                        selectedChallengeCard
                    }

                    if let error = model.errorMessage {
                        Text(error)
                            .font(.system(size: 14))
                            .foregroundStyle(Brand.flagship)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 30)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Challenges")
            .onChange(of: pickerItem) { _, newItem in
                guard let newItem else { return }
                Task {
                    guard let data = try? await newItem.loadTransferable(type: Data.self),
                          let image = UIImage(data: data)
                    else { return }
                    await MainActor.run {
                        model.setSelectedImage(image, originalData: data)
                    }
                }
            }
            .task {
                model.onAppear()
                applyPendingRoute()
            }
            .onChange(of: router.changeToken) { _, _ in
                applyPendingRoute()
            }
            .onChange(of: model.challenges) { _, _ in
                applyPendingRoute()
            }
        }
    }

    private var worldSpaceWeekDrop: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Continue World Space Week")
                .font(.system(size: 15, weight: .semibold))
            Text("Take the live player drop into Landnám or Garden, then return here to log your Atlas challenge.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)
            ForEach(WorldSpaceWeekCampaign.destinations) { destination in
                Link(destination.label, destination: destination.url)
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .buttonStyle(.bordered)
                    .accessibilityHint("Opens \(destination.label) in Safari")
            }
        }
        .padding(14)
        .brandCard(accent: Brand.flagship.opacity(0.45))
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("No active challenge mapped to current events.")
                .font(.system(size: 14, weight: .medium))
            Text("When a matching Moon, meteor, or planet event is active, challenge cards appear here.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)
            Button("Refresh") {
                Task { await model.refresh() }
            }
            .buttonStyle(.bordered)
            .frame(minHeight: 44)
        }
        .padding(14)
        .brandCard()
    }

    private var challengePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(model.challenges) { challenge in
                    Button {
                        model.selectedChallengeID = challenge.id
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(challenge.definition.name)
                                .font(.system(size: 14, weight: .semibold))
                                .lineLimit(1)
                            Text(challenge.event.title)
                                .font(.system(size: 14))
                                .foregroundStyle(Brand.muted)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(minWidth: 220, alignment: .leading)
                        .background(model.selectedChallengeID == challenge.id ? Brand.violetWash : Brand.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(model.selectedChallengeID == challenge.id ? Brand.violet : Brand.line))
                    }
                    .frame(minHeight: 44)
                    .accessibilityLabel("Select challenge \(challenge.definition.name)")
                }
            }
            .padding(.vertical, 2)
        }
    }

    @ViewBuilder
    private var selectedChallengeCard: some View {
        if let challenge = model.selectedChallenge {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(challenge.definition.name)
                            .font(.system(size: 17, weight: .semibold))
                        Text(challenge.definition.prompt)
                            .font(.system(size: 14))
                            .foregroundStyle(Brand.muted)
                    }
                    Spacer()
                    if let tier = challenge.badgeTier {
                        badge(tier: tier)
                    }
                }

                Text("Event window: \(challenge.definition.window.start.formatted(date: .abbreviated, time: .omitted)) – \(challenge.definition.window.end.formatted(date: .abbreviated, time: .omitted))")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.muted)
                Text("Tip: \(challenge.definition.tip)")
                    .font(.system(size: 14))

                VStack(alignment: .leading, spacing: 8) {
                    Text("Rules")
                        .font(.system(size: 14, weight: .semibold))
                    ForEach(challenge.definition.rules) { rule in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("• \(rule.title)").font(.system(size: 14, weight: .medium))
                            Text(rule.detail).font(.system(size: 14)).foregroundStyle(Brand.muted)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Multiplayer progress")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Collective submissions: \(challenge.collectiveTotal)")
                        .font(.system(size: 14))
                    Text("Your contribution: \(challenge.myContribution)")
                        .font(.system(size: 14))

                    if !challenge.leaderboard.isEmpty {
                        let myUserID = challenge.submissions.first(where: { $0.isMine })?.userID
                        ForEach(Array(challenge.leaderboard.prefix(3).enumerated()), id: \.offset) { index, row in
                            HStack {
                                Text("#\(index + 1)")
                                    .font(.system(size: 14, weight: .semibold))
                                    .frame(width: 28, alignment: .leading)
                                Text(row.userID == myUserID ? "You" : anonymized(userID: row.userID))
                                    .font(.system(size: 14))
                                Spacer()
                                Text("\(row.submissions)")
                                    .font(.system(size: 14, weight: .medium))
                            }
                        }
                    }
                }

                Divider()

                Text("Submit a frame")
                    .font(.system(size: 15, weight: .semibold))
                PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                    Label(model.selectedImage == nil ? "Choose challenge photo" : "Replace challenge photo", systemImage: "photo")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Choose challenge photo")

                if let selectedImage = model.selectedImage {
                    Image(uiImage: selectedImage)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 180)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.line))
                    Button("Remove challenge photo") {
                        model.clearSelectedImage()
                    }
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.flagship)
                    .frame(minHeight: 44)
                }

                TextField("Caption (optional)", text: $model.caption, axis: .vertical)
                    .lineLimit(2...4)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 14))
                    .accessibilityLabel("Challenge caption")

                Button {
                    Task { await model.submitSelectedChallenge() }
                } label: {
                    if model.isSubmitting {
                        ProgressView().frame(maxWidth: .infinity, minHeight: 46)
                    } else {
                        Text("Submit challenge entry")
                            .font(.system(size: 14, weight: .semibold))
                            .frame(maxWidth: .infinity, minHeight: 46)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Brand.flagship)
                .disabled(model.isSubmitting || model.selectedImage == nil)
                .accessibilityLabel("Submit challenge entry")
            }
            .padding(14)
            .brandCard(accent: Brand.flagship.opacity(0.45))
        }
    }

    private func badge(tier: ChallengeBadgeTier) -> some View {
        Text(tier == .gold ? "GOLD" : "SILVER")
            .font(.system(size: 14, weight: .semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .foregroundStyle(tier == .gold ? Color.yellow : Brand.muted)
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder((tier == .gold ? Color.yellow : Brand.muted).opacity(0.8))
            )
            .accessibilityLabel("\(tier.rawValue.capitalized) badge tier")
    }

    private func anonymized(userID: String) -> String {
        let suffix = userID.suffix(4)
        return "Observer \(suffix)"
    }

    private func applyPendingRoute() {
        guard !model.challenges.isEmpty else { return }
        guard let route = router.consumePendingChallengeRoute() else { return }
        guard case .challenge(let challengeID) = route, let challengeID else { return }
        model.selectChallenge(matching: challengeID)
    }
}
