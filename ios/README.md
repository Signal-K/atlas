# Atlas iOS

Native SwiftUI app (iOS 17+). `AtlasCore/` is a SwiftPM package (PocketBase client, models, moon phase) shared by the app.

- Needs full Xcode: `xcodegen generate && open Atlas.xcodeproj`
- Core tests: `cd AtlasCore && swift test` (XCTest, requires Xcode's toolchain)
- PocketBase URL: `ATLAS_PB_URL` build setting (defaults to local `http://127.0.0.1:8090`)
