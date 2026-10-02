import AtlasCore
import SwiftUI

/// Auth as an arrival, not a form page: the Moon hangs over the horizon, the wordmark resolves
/// letter by letter, and a glass panel rises from the ridge. Signing in flings the stars into
/// hyperspace (see `SessionStore.warp`).
struct WelcomeView: View {
    let session: SessionStore

    @State private var arrived = false
    @State private var mode: SessionStore.Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var errorText: String?
    @State private var shake = 0
    @FocusState private var focus: Field?
    @Namespace private var modeNS

    private enum Field { case email, password }
    private let word = Array("ATLAS")
    private var moonAt: Double { MoonPhase.elongation(at: .now) }

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                hero
                    .frame(maxHeight: .infinity)
                    // the hero yields to the keyboard instead of being pushed off screen
                    .opacity(focus == nil ? 1 : 0.0)
                    .scaleEffect(focus == nil ? 1 : 0.8, anchor: .top)
                panel
                    .keyframeAnimator(initialValue: 0.0, trigger: shake) { view, x in
                        view.offset(x: x)
                    } keyframes: { _ in
                        KeyframeTrack {
                            CubicKeyframe(-12, duration: 0.06)
                            CubicKeyframe(10, duration: 0.08)
                            CubicKeyframe(-7, duration: 0.08)
                            CubicKeyframe(4, duration: 0.08)
                            CubicKeyframe(0, duration: 0.08)
                        }
                    }
                    .offset(y: arrived ? 0 : geo.size.height * 0.5)
                    .opacity(arrived ? 1 : 0)
            }
            .padding(.horizontal, 20)
        }
        .animation(.smooth(duration: 0.4), value: focus)
        .task {
            withAnimation(.spring(response: 1.0, dampingFraction: 0.82).delay(0.55)) { arrived = true }
        }
    }

    // MARK: Hero

    private var hero: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 24)
            MoonHero(elongation: moonAt)
                .frame(width: 148, height: 148)
            HStack(spacing: 6) {
                ForEach(Array(word.enumerated()), id: \.offset) { i, ch in
                    Text(String(ch))
                        .font(.system(size: 46, weight: .thin, design: .rounded))
                        .foregroundStyle(Sky.ink)
                        .opacity(arrived ? 1 : 0)
                        .blur(radius: arrived ? 0 : 14)
                        .offset(y: arrived ? 0 : 18)
                        .animation(.spring(response: 0.9, dampingFraction: 0.8).delay(0.15 + Double(i) * 0.09), value: arrived)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Atlas")
            .accessibilityAddTraits(.isHeader)
            Text("What's above you tonight")
                .font(.callout).tracking(1.4).textCase(.uppercase)
                .foregroundStyle(Sky.dim)
                .opacity(arrived ? 1 : 0)
                .animation(.easeOut(duration: 0.8).delay(0.9), value: arrived)
            Spacer(minLength: 8)
        }
    }

    // MARK: Panel

    private var panel: some View {
        VStack(spacing: 16) {
            modePicker
            VStack(spacing: 10) {
                field("Email", text: $email, secure: false)
                    .focused($focus, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focus = .password }
                field("Password", text: $password, secure: true)
                    .focused($focus, equals: .password)
                    .submitLabel(.go)
                    .onSubmit(submit)
            }
            if let errorText {
                Label(errorText, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote).foregroundStyle(Color(red: 1, green: 0.65, blue: 0.55))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .accessibilityAddTraits(.isStaticText)
            }
            primaryButton
            Button("Just look at the sky") { Task { await session.continueAsGuest() } }
                .font(.subheadline).foregroundStyle(Sky.dim)
                .disabled(busy)
        }
        .padding(18)
        .background(.ultraThinMaterial.opacity(0.9), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(.white.opacity(0.14)))
        .padding(.bottom, 12)
        .environment(\.colorScheme, .dark)
        .animation(.smooth, value: errorText)
    }

    private var modePicker: some View {
        HStack(spacing: 0) {
            ForEach(SessionStore.Mode.allCases, id: \.self) { m in
                Button {
                    guard mode != m else { return }
                    Haptics.tap()
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.78)) { mode = m }
                    errorText = nil
                } label: {
                    Text(m.rawValue)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(mode == m ? Color.black : Sky.dim)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background {
                            if mode == m {
                                Capsule().fill(Sky.moonlight).matchedGeometryEffect(id: "pill", in: modeNS)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Capsule().fill(.white.opacity(0.08)))
    }

    @ViewBuilder private func field(_ title: String, text: Binding<String>, secure: Bool) -> some View {
        Group {
            if secure { SecureField(title, text: text).textContentType(mode == .register ? .newPassword : .password) }
            else { TextField(title, text: text).emailEntry() }
        }
        .font(.body)
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
        .foregroundStyle(Sky.ink)
    }

    private var primaryButton: some View {
        Button(action: submit) {
            ZStack {
                Text(mode == .signIn ? "Sign in" : "Create account")
                    .opacity(busy ? 0 : 1)
                if busy { ProgressView().tint(.black) }
            }
            .font(.headline).foregroundStyle(.black)
            .frame(maxWidth: busy ? 56 : .infinity).frame(height: 54)
            .background(Capsule().fill(Sky.moonlight))
            .shadow(color: Sky.ember.opacity(0.4), radius: busy ? 0 : 16, y: 4)
        }
        .buttonStyle(PressableStyle())
        .disabled(!canSubmit || busy)
        .opacity(canSubmit || busy ? 1 : 0.5)
        .animation(.spring(response: 0.4, dampingFraction: 0.75), value: busy)
    }

    private var canSubmit: Bool { email.contains("@") && !password.isEmpty }

    private func submit() {
        guard canSubmit, !busy else { return }
        focus = nil
        errorText = nil
        busy = true
        Task {
            do {
                try await session.authenticate(mode: mode, email: email, password: password)
                Haptics.success()
            } catch {
                Haptics.failure()
                errorText = (error as? AuthFailure)?.errorDescription ?? error.localizedDescription
                shake += 1
            }
            busy = false
        }
    }
}

/// The Moon sweeping from new to tonight's phase, with a slow breathing halo.
private struct MoonHero: View {
    let elongation: Double
    @State private var shown = 0.0
    @State private var breathe = false

    var body: some View {
        ZStack {
            Circle().fill(Sky.moonlight.opacity(0.10)).scaleEffect(breathe ? 1.55 : 1.25).blur(radius: 18)
            MoonDisc(elongation: shown)
        }
        .task {
            withAnimation(.easeOut(duration: 2.2).delay(0.3)) { shown = elongation }
            withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) { breathe = true }
        }
        .accessibilityLabel("The Moon, \(MoonPhase.name(at: .now))")
    }
}

struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
