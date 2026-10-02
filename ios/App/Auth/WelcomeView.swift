import AtlasCore
import SwiftUI

/// Sign in as Atlas's own front door: the hedgehog mark, a serif question, a calm form on paper.
/// Signing in flings the paper stars into hyperspace (see `SessionStore.warp`).
struct WelcomeView: View {
    let session: SessionStore

    @State private var arrived = false
    @State private var mode: SessionStore.Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var errorText: String?
    @State private var shake = 0
    @State private var rock = false
    @FocusState private var focus: Field?
    @Namespace private var modeNS

    private enum Field { case email, password }
    private let headline = "What can I see in the sky tonight?".split(separator: " ").map(String.init)
    private var compact: Bool { focus != nil }

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                hero.frame(maxHeight: .infinity)
                panel
                    .keyframeAnimator(initialValue: 0.0, trigger: shake) { view, x in view.offset(x: x) } keyframes: { _ in
                        KeyframeTrack {
                            CubicKeyframe(-12, duration: 0.06); CubicKeyframe(10, duration: 0.08)
                            CubicKeyframe(-7, duration: 0.08); CubicKeyframe(4, duration: 0.08); CubicKeyframe(0, duration: 0.08)
                        }
                    }
                    .offset(y: arrived ? 0 : geo.size.height * 0.4)
                    .opacity(arrived ? 1 : 0)
            }
            .padding(.horizontal, 20)
        }
        .animation(.smooth(duration: 0.4), value: compact)
        .task {
            withAnimation(.spring(response: 1.0, dampingFraction: 0.82).delay(0.5)) { arrived = true }
            withAnimation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true)) { rock = true }
        }
    }

    // MARK: Hero

    private var hero: some View {
        VStack(spacing: compact ? 12 : 22) {
            Spacer(minLength: 16)
            AtlasMark(size: compact ? 64 : 112)
                .rotationEffect(.degrees(rock ? 3 : -3))
                .offset(y: rock ? -4 : 4)
                .scaleEffect(arrived ? 1 : 0.6).opacity(arrived ? 1 : 0)
                .animation(.spring(response: 0.9, dampingFraction: 0.6), value: arrived)
            Text("Atlas").font(.display(compact ? 26 : 34)).foregroundStyle(Brand.ink)
                .accessibilityAddTraits(.isHeader)
            // Word-by-word reveal; wraps naturally.
            WrappingWords(words: headline, arrived: arrived, size: compact ? 24 : 32)
            if !compact {
                Text("Atlas shows what's visible, when to go outside and what to point your phone at.")
                    .font(.system(size: 15)).foregroundStyle(Brand.muted).multilineTextAlignment(.center)
                    .opacity(arrived ? 1 : 0).animation(.easeOut(duration: 0.8).delay(1.1), value: arrived)
                    .transition(.opacity)
            }
            Spacer(minLength: 8)
        }
    }

    // MARK: Panel

    private var panel: some View {
        VStack(spacing: 14) {
            modePicker
            VStack(spacing: 10) {
                field("Email", text: $email, secure: false)
                    .focused($focus, equals: .email).submitLabel(.next).onSubmit { focus = .password }
                field("Password", text: $password, secure: true)
                    .focused($focus, equals: .password).submitLabel(.go).onSubmit(submit)
            }
            if let errorText {
                Label(errorText, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote).foregroundStyle(Brand.flagship)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            primaryButton
            Button { Task { await session.continueAsGuest() } } label: {
                Text("Just look at the sky").font(.system(size: 14, weight: .medium))
                    .padding(.horizontal, 18).frame(minHeight: 40)
                    .foregroundStyle(Brand.ink).background(Brand.surface2, in: Capsule())
                    .overlay(Capsule().strokeBorder(Brand.line))
            }
            .buttonStyle(PressableStyle()).disabled(busy)
        }
        .padding(16)
        .brandCard(radius: 22)
        .shadow(color: .black.opacity(0.06), radius: 18, y: 8)
        .padding(.bottom, 12)
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
                    Text(m.rawValue).font(.system(size: 13, weight: .medium))
                        .foregroundStyle(mode == m ? Brand.bg : Brand.ink)
                        .frame(maxWidth: .infinity).frame(minHeight: 36)
                        .background { if mode == m { Capsule().fill(Brand.ink).matchedGeometryEffect(id: "pill", in: modeNS) } }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3).background(Capsule().fill(Brand.chip))
    }

    @ViewBuilder private func field(_ title: String, text: Binding<String>, secure: Bool) -> some View {
        Group {
            if secure { SecureField(title, text: text).textContentType(mode == .register ? .newPassword : .password) }
            else { TextField(title, text: text).emailEntry() }
        }
        .font(.system(size: 16))
        .padding(.horizontal, 14).frame(minHeight: 48)
        .background(Brand.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.line))
        .foregroundStyle(Brand.ink)
    }

    private var primaryButton: some View {
        Button(action: submit) {
            ZStack {
                Text(mode == .signIn ? "Sign in" : "Create account").opacity(busy ? 0 : 1)
                if busy { ProgressView().tint(Brand.bg) }
            }
            .font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.bg)
            .frame(maxWidth: busy ? 56 : .infinity).frame(height: 50)
            .background(Capsule().fill(Brand.violet))
        }
        .buttonStyle(PressableStyle())
        .disabled(!canSubmit || busy)
        .opacity(canSubmit || busy ? 1 : 0.45)
        .animation(.spring(response: 0.4, dampingFraction: 0.75), value: busy)
    }

    private var canSubmit: Bool { email.contains("@") && !password.isEmpty }

    private func submit() {
        guard canSubmit, !busy else { return }
        focus = nil; errorText = nil; busy = true
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

/// Serif headline whose words rise into place one after another.
private struct WrappingWords: View {
    let words: [String]
    let arrived: Bool
    let size: CGFloat

    var body: some View {
        // Text concatenation can't animate per word, so lay words out as a flexible flow.
        FlowLayout(spacing: 7) {
            ForEach(Array(words.enumerated()), id: \.offset) { i, word in
                Text(word).font(.serif(size)).foregroundStyle(Brand.ink)
                    .opacity(arrived ? 1 : 0).blur(radius: arrived ? 0 : 8).offset(y: arrived ? 0 : 14)
                    .animation(.spring(response: 0.8, dampingFraction: 0.8).delay(0.35 + Double(i) * 0.07), value: arrived)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(words.joined(separator: " "))
        .accessibilityAddTraits(.isHeader)
    }
}

/// Centered wrapping layout.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6
    var alignment: HorizontalAlignment = .center

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = layoutRows(width: proposal.width ?? .infinity, subviews: subviews)
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1)))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in layoutRows(width: bounds.width, subviews: subviews) {
            var x = bounds.minX + (alignment == .center ? (bounds.width - row.width) / 2 : 0)
            for item in row.items {
                subviews[item.index].place(at: CGPoint(x: x, y: y), proposal: .unspecified)
                x += item.size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var items: [(index: Int, size: CGSize)] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func layoutRows(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows = [Row()]
        for (i, sub) in subviews.enumerated() {
            let size = sub.sizeThatFits(.unspecified)
            let needed = rows[rows.count - 1].items.isEmpty ? size.width : rows[rows.count - 1].width + spacing + size.width
            if needed > width, !rows[rows.count - 1].items.isEmpty { rows.append(Row()) }
            var row = rows.removeLast()
            row.width = row.items.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.items.append((i, size))
            rows.append(row)
        }
        return rows
    }
}
