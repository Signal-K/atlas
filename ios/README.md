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

