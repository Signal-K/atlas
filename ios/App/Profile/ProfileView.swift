import PhotosUI
import SwiftUI

struct ProfileView: View {
    let session: SessionStore
    let skyPass: SkyPassStore

    @State private var viewModel: ProfileViewModel
    @State private var showEditProfile = false
    @State private var showSkyPass = false
    @State private var deleteConfirm = false
    @State private var deleting = false
    @State private var deleteError: String?
    @State private var editName = ""
    @State private var editHandle = ""
    @State private var avatarPickerItem: PhotosPickerItem?

    init(session: SessionStore, skyPass: SkyPassStore, service: ProfileService) {
        self.session = session
        self.skyPass = skyPass
        _viewModel = State(initialValue: ProfileViewModel(service: service))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                content
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .background(Brand.bg.ignoresSafeArea())
        .task { await viewModel.activate(session: session) }
        .onChange(of: session.userID) { _, _ in
            Task { await viewModel.activate(session: session) }
        }
        .sheet(isPresented: $showSkyPass) {
            SkyPassView(store: skyPass, signedIn: session.userID != nil) { showSkyPass = false }
                .presentationDetents([.large]).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showEditProfile) {
            editProfileSheet
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog("Delete your Atlas account?", isPresented: $deleteConfirm, titleVisibility: .visible) {
            Button("Delete account permanently", role: .destructive) {
                performDelete()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your account and synced Atlas data across mobile and web. It cannot be undone.")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Kicker(text: "Account")
            Text("Profile")
                .font(.serif(30))
                .foregroundStyle(Brand.ink)
                .accessibilityAddTraits(.isHeader)
            Text("Your account, progress, and Sky Pass status.")
                .font(.system(size: 15))
                .foregroundStyle(Brand.muted)
        }
    }

    @ViewBuilder private var content: some View {
        if session.userID == nil {
            guestPrompt
        } else if viewModel.isLoading, viewModel.snapshot == nil {
            loadingCard
        } else if let snapshot = viewModel.snapshot {
            profileDetails(snapshot)
        } else {
            fallbackCard
        }
    }

    private var guestPrompt: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sign in to manage your profile")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Brand.ink)
            Text("Signing in syncs your journal, progress, and purchases across devices.")
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
        }
        .padding(16)
        .brandCard()
    }

    private var loadingCard: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text("Loading profile…")
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 120, alignment: .leading)
        .padding(16)
        .brandCard()
    }

    private var fallbackCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(viewModel.errorText ?? "Could not load your profile.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.flagship)
            Button {
                Task { await viewModel.reload(session: session) }
            } label: {
                Text("Try again")
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

    private func profileDetails(_ snapshot: ProfileSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            profileHeaderCard(snapshot)
            progressCard(snapshot)
            statsCard(snapshot)
            accountActionsCard(snapshot)
            if let success = viewModel.successText {
                Text(success)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.green)
            }
            if let error = viewModel.errorText {
                Text(error)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.flagship)
            }
            if let deleteError {
                Text(deleteError)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.flagship)
            }
        }
    }

    private func profileHeaderCard(_ snapshot: ProfileSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                avatarView(snapshot)
                VStack(alignment: .leading, spacing: 4) {
                    Text(snapshot.name)
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                    Text("@\(snapshot.handle)")
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.muted)
                    Text(snapshot.email)
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.muted)
                }
                Spacer()
            }
            Text(snapshot.entitled ? "Sky Pass active" : "Free account")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(snapshot.entitled ? Brand.green : Brand.violet)
                .padding(.horizontal, 10)
                .frame(minHeight: 30)
                .overlay(Capsule().strokeBorder((snapshot.entitled ? Brand.green : Brand.violet).opacity(0.55)))
        }
        .padding(16)
        .brandCard()
    }

    private func avatarView(_ snapshot: ProfileSnapshot) -> some View {
        Group {
            if let avatarURL = snapshot.avatarURL {
                AsyncImage(url: avatarURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsAvatar(snapshot.name)
                    }
                }
            } else {
                initialsAvatar(snapshot.name)
            }
        }
        .frame(width: 66, height: 66)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Brand.line2))
        .accessibilityLabel("Profile avatar")
    }

    private func initialsAvatar(_ name: String) -> some View {
        let initials = name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
        return ZStack {
            Circle().fill(Brand.violetWash)
            Text(initials.isEmpty ? "A" : initials)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Brand.violet)
        }
    }

    private func progressCard(_ snapshot: ProfileSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Kicker(text: "Level")
            HStack(alignment: .firstTextBaseline) {
                Text("Level \(snapshot.level)")
                    .font(.system(size: 21, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Spacer()
                Text("\(snapshot.totalXP) XP")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.muted)
            }
            Text(snapshot.pointsToNextLevel > 0 ? "\(snapshot.pointsToNextLevel) XP to next level" : "Top level reached")
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)

            if snapshot.badges.isEmpty {
                Text("No badges yet — keep logging the sky to unlock them.")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.muted)
            } else {
                badgeRows(snapshot.badges)
            }
        }
        .padding(16)
        .brandCard()
    }

    private func badgeRows(_ badges: [AtlasBadge]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(badges) { badge in
                HStack(spacing: 8) {
                    Image(systemName: badge.tier == .gold ? "star.circle.fill" : "seal.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(badge.tier == .gold ? Brand.amber : Brand.muted)
                    Text(badge.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Brand.ink)
                    Spacer()
                    Text(badge.tier == .gold ? "Gold" : "Silver")
                        .font(.mono(11))
                        .foregroundStyle(badge.tier == .gold ? Brand.amber : Brand.muted)
                }
                .frame(minHeight: 30)
                .accessibilityLabel("\(badge.title), \(badge.tier == .gold ? "gold" : "silver") badge")
            }
        }
    }

    private func statsCard(_ snapshot: ProfileSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Kicker(text: "Activity")
            statRow(title: "Journal entries", value: "\(snapshot.journalCount)")
            statRow(title: "Photos", value: "\(snapshot.photoCount)")
            statRow(title: "Equipment", value: snapshot.equipmentItems.isEmpty ? "Not set" : snapshot.equipmentItems.joined(separator: ", "))
        }
        .padding(16)
        .brandCard()
    }

    private func statRow(title: String, value: String) -> some View {
        HStack(spacing: 10) {
            Text(title)
                .font(.system(size: 14))
                .foregroundStyle(Brand.ink)
            Spacer()
            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Brand.muted)
                .multilineTextAlignment(.trailing)
        }
        .frame(minHeight: 28)
    }

    private func accountActionsCard(_ snapshot: ProfileSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker(text: "Manage")
            actionButton("Edit profile", systemImage: "pencil") {
                editName = snapshot.name
                editHandle = snapshot.handle
                showEditProfile = true
            }
            actionButton(snapshot.entitled ? "Sky Pass · active" : "Get Sky Pass", systemImage: "sparkles") {
                showSkyPass = true
            }
            actionButton("Sign out", systemImage: "rectangle.portrait.and.arrow.right") {
                session.signOut()
            }
            actionButton("Delete account", systemImage: "trash", tint: Brand.flagship) {
                deleteConfirm = true
            }
            .disabled(deleting)
        }
        .padding(16)
        .brandCard()
    }

    private func actionButton(_ title: String, systemImage: String, tint: Color = Brand.ink, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .medium))
                Text(title)
                    .font(.system(size: 15, weight: .medium))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Brand.muted)
            }
            .foregroundStyle(tint)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Brand.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.line))
        }
        .buttonStyle(.plain)
    }

    private var editProfileSheet: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Edit profile")
                .font(.serif(24))
                .foregroundStyle(Brand.ink)
            Text("Update your name, handle, and avatar.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.muted)

            TextField("Name", text: $editName)
                .font(.system(size: 16))
                .padding(.horizontal, 12)
                .frame(minHeight: 46)
                .background(Brand.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Brand.line))
                .accessibilityLabel("Display name")

            TextField("Handle", text: $editHandle)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.system(size: 16))
                .padding(.horizontal, 12)
                .frame(minHeight: 46)
                .background(Brand.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Brand.line))
                .accessibilityLabel("Handle")

            PhotosPicker(selection: $avatarPickerItem, matching: .images) {
                HStack {
                    Image(systemName: "photo")
                    Text(viewModel.isUploadingAvatar ? "Uploading avatar…" : "Choose avatar photo")
                }
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Brand.ink)
                .frame(maxWidth: .infinity, minHeight: 46)
                .background(Brand.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Brand.line))
            }
            .disabled(viewModel.isUploadingAvatar)
            .onChange(of: avatarPickerItem) { _, item in
                guard let item else { return }
                Task {
                    await viewModel.uploadAvatar(item, session: session)
                    avatarPickerItem = nil
                }
            }

            HStack(spacing: 10) {
                Button("Cancel") { showEditProfile = false }
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Brand.ink)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(Brand.surface2, in: Capsule())
                    .overlay(Capsule().strokeBorder(Brand.line))
                Button {
                    Task { await viewModel.saveProfile(session: session, name: editName, handle: editHandle) }
                } label: {
                    if viewModel.isSaving {
                        ProgressView().tint(Brand.bg)
                    } else {
                        Text("Save changes")
                    }
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.bg)
                .frame(maxWidth: .infinity, minHeight: 46)
                .background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle())
            .disabled(viewModel.isSaving || viewModel.isUploadingAvatar)

            if let error = viewModel.errorText {
                Text(error)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.flagship)
            }
        }
        .padding(20)
        .background(Brand.bg)
    }

    private func performDelete() {
        deleting = true
        deleteError = nil
        Task {
            do {
                try await session.deleteAccount()
            } catch {
                deleteError = error.localizedDescription
            }
            deleting = false
        }
    }
}
