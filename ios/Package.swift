// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "IvyPortalCore",
    platforms: [.iOS(.v18), .macOS(.v14)],
    products: [.library(name: "IvyPortalCore", targets: ["IvyPortalCore"])],
    targets: [
        .target(name: "IvyPortalCore", path: "IvyPortalCore"),
        .testTarget(name: "IvyPortalCoreTests", dependencies: ["IvyPortalCore"], path: "IvyPortalTests")
    ]
)
