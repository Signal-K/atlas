import AtlasCore
import StoreKit
import SwiftUI

/// Sky Pass, sold through Apple In-App Purchase. Apple's rules for a subscription screen are all
/// here on purpose: the price and billing period beside each option, Restore Purchases, the
/// auto-renewal terms, and working Terms of Use / Privacy Policy links. No other payment route
/// is offered or linked from this app.
struct SkyPassView: View {
    let store: SkyPassStore
    let signedIn: Bool
    let dismiss: () -> Void

    @State private var showManage = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                if store.isEntitled { activeCard } else if signedIn { offerList } else { signInNote }
                if let notice = store.notice { noticeBanner(notice) }
                if signedIn { restoreButton }
                includes
                legal
            }
            .padding(.horizontal, 20).padding(.vertical, 24)
            .frame(maxWidth: 560).frame(maxWidth: .infinity)
        }
        .background(Brand.bg.ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(Brand.muted)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Close")
        }
        .task { if store.phase != .ready { await store.loadOffers() } }
        .manageSubscriptionsSheet(isPresented: $showManage)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            AtlasMark(size: 44)
            Text("Sky Pass").font(.serif(30)).foregroundStyle(Brand.ink)
            Text("One pass for Atlas on iPhone and on the web.").font(.system(size: 15)).foregroundStyle(Brand.muted)
        }
    }

    private var signInNote: some View {
        card {
            Text("Sign in to get Sky Pass").font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.ink)
            Text("Sky Pass belongs to your Atlas account, so it follows you across devices.")
                .font(.system(size: 14)).foregroundStyle(Brand.muted)
        }
    }

    private var activeCard: some View {
        card {
            Label("Sky Pass is active", systemImage: "checkmark.seal.fill")
                .font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.green)
            Text("Thank you. It's unlocked on every device you sign in to, whether you bought it here or on the web.")
                .font(.system(size: 14)).foregroundStyle(Brand.muted)
            Button("Manage subscription") { showManage = true }
                .font(.system(size: 14, weight: .medium)).foregroundStyle(Brand.violet).padding(.top, 2)
        }
    }

    @ViewBuilder private var offerList: some View {
        switch store.phase {
        case .loading:
            HStack(spacing: 10) { ProgressView(); Text("Loading prices…").font(.system(size: 14)).foregroundStyle(Brand.muted) }
                .frame(maxWidth: .infinity, minHeight: 120)
        case .unavailable:
            card {
                Text("Sky Pass isn't available right now").font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.ink)
                Text("We couldn't load prices from the App Store. Check your connection and try again.")
                    .font(.system(size: 14)).foregroundStyle(Brand.muted)
                Button("Try again") { Task { await store.loadOffers() } }
                    .font(.system(size: 14, weight: .medium)).foregroundStyle(Brand.violet)
            }
        case .ready:
            VStack(spacing: 10) { ForEach(store.offers) { offerRow($0) } }
        }
    }

    private func offerRow(_ offer: SkyPassOffer) -> some View {
        Button {
            Haptics.tap()
            Task { await store.buy(offer.tier) }
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(offer.tier.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.ink)
                    Text(offer.tier.cadence).font(.mono(11, medium: false)).foregroundStyle(Brand.muted)
                }
                Spacer(minLength: 8)
                if store.purchasing == offer.tier {
                    ProgressView()
                } else {
                    Text(offer.displayPrice).font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.violet)
                }
            }
            .padding(16).frame(minHeight: 64)
            .background(Brand.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Brand.line2))
        }
        .buttonStyle(PressableStyle())
        .disabled(store.isBusy)
        .accessibilityLabel("\(offer.tier.title), \(offer.displayPrice), \(offer.tier.cadence)")
    }

    private func noticeBanner(_ notice: SkyPassStore.Notice) -> some View {
        Text(notice.text).font(.system(size: 14)).foregroundStyle(notice.isError ? Brand.flagship : Brand.green)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14).background((notice.isError ? Brand.flagship : Brand.green).opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .accessibilityAddTraits(.updatesFrequently)
    }

    private var restoreButton: some View {
        Button {
            Task { await store.restore() }
        } label: {
            HStack(spacing: 8) {
                if store.isRestoring { ProgressView().controlSize(.small) }
                Text("Restore Purchases").font(.system(size: 15, weight: .medium))
            }
            .foregroundStyle(Brand.violet).frame(maxWidth: .infinity, minHeight: 44)
        }
        .disabled(store.isBusy)
    }

    private var includes: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("INCLUDED").font(.mono(10)).foregroundStyle(Brand.muted).tracking(1)
            Text("Backdated check-ins, 90-day plans, saved targets, reminders, dark sites, gear fit, community and the archive. Some of these arrive in the iPhone app over time; all of them are unlocked on the web today.")
                .font(.system(size: 14)).foregroundStyle(Brand.ink)
        }
    }

    private var legal: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Payment is charged to your Apple ID at confirmation of purchase. Monthly and yearly Sky Pass renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in Settings → Apple ID → Subscriptions. Lifetime is a one-time purchase.")
                .font(.mono(10, medium: false)).foregroundStyle(Brand.muted)
            HStack(spacing: 16) {
                Link("Terms of Use", destination: Config.termsURL)
                Link("Privacy Policy", destination: Config.privacyURL)
            }
            .font(.system(size: 13, weight: .medium)).foregroundStyle(Brand.violet)
        }
        .padding(.top, 4)
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8, content: content)
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Brand.line))
    }
}
