import AtlasCore
import SwiftUI

struct AskAtlasView: View {
    let session: SessionStore
    let skyPass: SkyPassStore
    let tonight: TonightModel

    @State private var viewModel: AskAtlasViewModel
    @State private var showSkyPass = false
    @State private var hasConsented = false
    @State private var reporting: AskAtlasMessage?
    @FocusState private var composerFocused: Bool

    init(session: SessionStore, skyPass: SkyPassStore, tonight: TonightModel, service: AskAtlasService) {
        self.session = session
        self.skyPass = skyPass
        self.tonight = tonight
        _viewModel = State(initialValue: AskAtlasViewModel(
            service: service,
            tokenProvider: { session.bearerToken }))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                hero
                content
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .background(Brand.bg.ignoresSafeArea())
        .task {
            viewModel.activate(for: session.userID)
            hasConsented = AskAtlasConsent.isGiven(userID: session.userID)
        }
        .onChange(of: session.userID) { _, id in
            viewModel.activate(for: id)
            hasConsented = AskAtlasConsent.isGiven(userID: id)
        }
        .sheet(item: $reporting) { message in
            ReportSheet(session: session, kind: .askAnswer, target: "ask_atlas", excerpt: message.text) { reporting = nil }
                .presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showSkyPass) {
            SkyPassView(store: skyPass, signedIn: session.userID != nil) { showSkyPass = false }
                .presentationDetents([.large]).presentationDragIndicator(.visible)
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 6) {
            Kicker(text: "Sky Pass guide")
            Text("Ask Atlas")
                .font(.serif(30))
                .foregroundStyle(Brand.ink)
                .accessibilityAddTraits(.isHeader)
            Text("One clear answer for tonight, an event, or the gear you have.")
                .font(.system(size: 15))
                .foregroundStyle(Brand.muted)
        }
    }

    @ViewBuilder private var content: some View {
        if session.userID == nil {
            guestCard
        } else if !session.isEntitled {
            paywallCard
        } else if !hasConsented {
            consentCard
        } else {
            chatCard
        }
    }

    /// Ask Atlas sends text to a third-party AI provider, so say so and ask first.
    private var consentCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker(text: "Before you ask")
            Text("Ask Atlas uses an AI service")
                .font(.system(size: 20, weight: .semibold)).foregroundStyle(Brand.ink)
            Text("When you ask a question, Atlas sends it to Anthropic, an AI provider, to write the answer. It also sends your last few messages and a short summary of tonight: your place name, cloud cover, moon phase and top target. Your email and exact coordinates are not sent. AI answers can be wrong, so double-check anything important.")
                .font(.system(size: 14)).foregroundStyle(Brand.muted).fixedSize(horizontal: false, vertical: true)
            Link("Read the Privacy Policy", destination: Config.privacyURL)
                .font(.system(size: 14, weight: .medium)).foregroundStyle(Brand.violet)
            Button {
                Haptics.tap()
                AskAtlasConsent.give(userID: session.userID)
                hasConsented = true
            } label: {
                Text("Agree and continue")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.bg)
                    .frame(maxWidth: .infinity, minHeight: 46).background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle())
        }
        .padding(16)
        .brandCard()
    }

    private var guestCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sign in to ask Atlas")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Brand.ink)
            Text("Your Ask Atlas history stays with your account.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)
            Button {
                Haptics.tap()
                session.signOut()
            } label: {
                Text("Sign in or create account")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.bg)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Sign in or create account")
        }
        .padding(16)
        .brandCard()
    }

    private var paywallCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker(text: "Sky Pass")
            Text("Questions are ready when you are.")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Brand.ink)
            Text("Sky Pass unlocks concise advice for tonight's sky, a specific event, or your camera setup.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)
            Button {
                Haptics.tap()
                showSkyPass = true
            } label: {
                Text("Get Sky Pass")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.bg)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle())
        }
        .padding(16)
        .brandCard()
    }

    private var chatCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("What do you want to know?")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Brand.ink)
            Text("Ask one practical question. Atlas keeps the answer focused.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)

            if viewModel.messages.isEmpty {
                Text("Start with a quick prompt:")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Brand.ink)
            }

            promptChips
            transcript
            composer

            if let error = viewModel.errorText {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.flagship)
                    .accessibilityLabel("Error: \(error)")
            }
        }
        .padding(16)
        .brandCard()
    }

    private var promptChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(viewModel.quickPrompts, id: \.self) { prompt in
                    Button {
                        Haptics.tap()
                        viewModel.draft = prompt
                        composerFocused = true
                    } label: {
                        Text(prompt)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Brand.ink)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 36)
                            .background(Brand.chip, in: Capsule())
                            .overlay(Capsule().strokeBorder(Brand.line))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Use prompt: \(prompt)")
                }
            }
            .padding(.vertical, 2)
        }
    }

    private var transcript: some View {
        VStack(alignment: .leading, spacing: 8) {
            if viewModel.messages.isEmpty {
                Text("No messages yet.")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            } else {
                ForEach(viewModel.messages) { message in
                    messageBubble(message)
                }
                Button {
                    Haptics.tap()
                    viewModel.clearHistory()
                } label: {
                    Text("Clear conversation")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Brand.flagship)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear conversation history")
            }

            if viewModel.isSending {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Atlas is thinking…")
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.muted)
                }
                .frame(minHeight: 44, alignment: .leading)
            }
        }
    }

    private func messageBubble(_ message: AskAtlasMessage) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack(alignment: .leading, spacing: 4) {
                Text(message.role == .user ? "YOU" : "ATLAS")
                    .font(.mono(10))
                    .foregroundStyle(message.role == .user ? Brand.violet : Brand.teal)
                Text(message.text)
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(message.role == .user ? "You" : "Atlas"): \(message.text)")
            if message.role == .assistant {
                Button {
                    Haptics.tap()
                    reporting = message
                } label: {
                    Label("Report this answer", systemImage: "flag")
                        .font(.system(size: 13, weight: .medium)).foregroundStyle(Brand.muted)
                        .frame(minHeight: 44, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(message.role == .user ? Brand.violetWash : Brand.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.line))
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your question")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Brand.ink)
            TextEditor(text: $viewModel.draft)
                .font(.system(size: 15))
                .scrollContentBackground(.hidden)
                .padding(10)
                .frame(minHeight: 96)
                .background(Brand.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.line))
                .focused($composerFocused)
                .accessibilityLabel("Ask Atlas question")
            Button {
                Task { await viewModel.send(context: tonightContext) }
            } label: {
                HStack(spacing: 8) {
                    if viewModel.isSending { ProgressView().controlSize(.small).tint(Brand.bg) }
                    Text(viewModel.isSending ? "Asking Atlas…" : "Ask Atlas")
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.bg)
                .frame(maxWidth: .infinity, minHeight: 46)
                .background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle())
            .disabled(viewModel.isSending || viewModel.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(viewModel.isSending || viewModel.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.55 : 1)
            .accessibilityLabel("Send question to Atlas")
        }
    }

    private var tonightContext: String? {
        guard let plan = tonight.plan else { return nil }
        var parts: [String] = []
        if let place = tonight.place?.name { parts.append("Location: \(place)") }
        parts.append("Tonight rating: \(plan.rating.label)")
        if let cloud = plan.cloudCoverPct {
            parts.append("Cloud cover: \(Int(cloud.rounded()))%")
        }
        parts.append("Moon: \(Int(plan.moonIlluminationPct.rounded()))% (\(plan.moonName))")
        if let target = plan.targets.first {
            parts.append("Top target: \(target.event.title) (\(target.event.kind))")
        }
        return parts.joined(separator: " · ")
    }
}

/// Remembers, per account, that the person agreed to Ask Atlas sending text to an AI provider.
enum AskAtlasConsent {
    private static func key(_ userID: String?) -> String { "atlas.ask.aiConsent.\(userID ?? "guest")" }
    static func isGiven(userID: String?, defaults: UserDefaults = .standard) -> Bool { defaults.bool(forKey: key(userID)) }
    static func give(userID: String?, defaults: UserDefaults = .standard) { defaults.set(true, forKey: key(userID)) }
}
