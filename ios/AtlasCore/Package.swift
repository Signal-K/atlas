// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AtlasCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "AtlasCore", targets: ["AtlasCore"])],
    targets: [
        .target(name: "AtlasCore"),
        .testTarget(name: "AtlasCoreTests", dependencies: ["AtlasCore"]),
    ]
)
