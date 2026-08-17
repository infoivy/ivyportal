// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "IvyPortalCore",
    platforms: [.iOS(.v18), .macOS(.v14)],
    products: [.library(name: "IvyPortalCore", targets: ["IvyPortalCore"])],
    targets: [
        .target(name: "IvyPortalCore", path: "IvyPortalCore"),
        // BunOrgProbeTests does `@testable import IvyPortal` (the app module),
        // which only exists in the app-hosted Xcode test target — leaving it in
        // here breaks `swift test` for the whole package.
        .testTarget(name: "IvyPortalCoreTests", dependencies: ["IvyPortalCore"],
                    path: "IvyPortalTests", exclude: ["BunOrgProbeTests.swift"])
    ]
)
