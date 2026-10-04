# Atlas iOS

Native SwiftUI app (iOS 17+). `AtlasCore/` is a SwiftPM package (PocketBase client, models, moon phase) shared by the app.

- Needs full Xcode: `xcodegen generate && open Atlas.xcodeproj`
- Core tests: `cd AtlasCore && swift test` (XCTest, requires Xcode's toolchain)
- PocketBase URL: `ATLAS_PB_URL` build setting (defaults to local `http://127.0.0.1:8094`, what `make pb` starts)

## App structure (ASV-121)

Not a page-per-tab app: `RootView` keeps one star field (`Design/SkyBackdrop`) behind everything and swaps the foreground.

- `Session/` -- `SessionStore` state machine (launching -> welcome -> tonight), Keychain token, `AuthService` (PocketBase password auth; Clerk bridge is a follow-up).
- `Auth/WelcomeView` -- animated welcome + sign in / create account / guest.
- `Tonight/TonightView` -- vertical journey: the Moon, then each event tonight (or the next few on a quiet night).
- Fixtures (no backend): `-AtlasFixtureAuth` (password `wrong` fails sign-in, `<8` chars fails register), `-AtlasFixtures`, `-AtlasFixtureEmpty`, `-AtlasFixtureError`, `-AtlasFixtureSlow`.


## Sky Pass / In-App Purchase (ASV-122)

Sold only through StoreKit 2 (`SkyPass/StoreKitProvider.swift`); no Polar link exists in the app. The testable logic is `AtlasCore/SkyPassStore.swift`: purchase -> `POST {ATLAS_BILLING_URL}/entitlement/apple/verify` -> `users.entitled` flips for that account on every platform. Purchases carry an `appAccountToken` derived from the Atlas user id so a receipt can't be claimed by another account.

- Local StoreKit testing: `Atlas.storekit` is wired into the scheme (Xcode -> Debug -> StoreKit). The server rejects Xcode-signed transactions; use a Sandbox account for end to end.
- Fixtures: `-AtlasFixtureSignedIn`, `-AtlasFixtureStore` (fake offers + purchase), `-AtlasFixtureStoreEmpty`, `-AtlasOpenSkyPass` (open the sheet on arrival).
- Before App Review: products in App Store Connect, a live privacy policy at `AtlasPrivacyURL`, production `ATLAS_BILLING_URL`/`ATLAS_PB_URL`. See `atlas-billing/DEPLOY.md`.


## Equipment, Sky page, alerts, camera, analytics (ASV-124)

- **Equipment** (`Settings/AppSettings`, `Onboarding/`): first run asks phone / binoculars / telescope; Settings changes it. It sets the limiting magnitude (`AtlasCore/Equipment.swift`) that the Sky page and the camera advice use. The phone model is read from `hw.machine` (`DeviceProfile.swift`).
- **Sky page** (`Sky/`): full-screen chart of what is visible for the chosen equipment. "Point" projects the sky through the screen using CoreMotion's `xTrueNorthZVertical` attitude (`AtlasCore/SkyCamera.swift`); with no sensors (Simulator) you drag. "Map" is the all-sky dome.
- **Alerts** (`Alerts/`, `AtlasCore/AlertPlanner.swift`): the clearest dark stretch per night and clear-hour event alerts, from Open-Meteo hourly cloud. Scheduled as local notifications on every load, plus a best-effort `BGAppRefreshTask`. Permission is requested only when an alert toggle is turned on.
- **Camera** (`Camera/`, `AtlasCore/CameraAdvisor.swift`): per-subject ISO / shutter / focus / white balance / lens, applied by an in-app manual camera (iOS cannot launch the system Camera with settings). Manual exposure is clamped to the phone's active format; the UI says when the ideal is longer than that.
- **Analytics** (`Analytics/`): PostHog via the first-party `/uplink` proxy. Set `ATLAS_POSTHOG_KEY` (the web's public `VITE_POSTHOG_KEY`) per build; empty means every call is a no-op.
- Fixtures: `-AtlasEquipment <phone|binoculars|telescope>`, `-AtlasResetOnboarding`, `-AtlasOpenSky`, `-AtlasOpenSettings`.
