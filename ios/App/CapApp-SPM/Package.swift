// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.2"),
        .package(name: "CapacitorApp", path: "../../../node_modules/.pnpm/@capacitor+app@8.1.2_@capacitor+core@8.6.2/node_modules/@capacitor/app"),
        .package(name: "CapacitorClipboard", path: "../../../node_modules/.pnpm/@capacitor+clipboard@8.0.1_@capacitor+core@8.6.2/node_modules/@capacitor/clipboard"),
        .package(name: "CapacitorFileTransfer", path: "../../../node_modules/.pnpm/@capacitor+file-transfer@2.0.6_@capacitor+core@8.6.2/node_modules/@capacitor/file-transfer"),
        .package(name: "CapacitorFilesystem", path: "../../../node_modules/.pnpm/@capacitor+filesystem@8.1.5_@capacitor+core@8.6.2/node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorNetwork", path: "../../../node_modules/.pnpm/@capacitor+network@8.0.1_@capacitor+core@8.6.2/node_modules/@capacitor/network"),
        .package(name: "CapacitorPreferences", path: "../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.6.2/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorSplashScreen", path: "../../../node_modules/.pnpm/@capacitor+splash-screen@8.0.2_@capacitor+core@8.6.2/node_modules/@capacitor/splash-screen"),
        .package(name: "CapacitorStatusBar", path: "../../../node_modules/.pnpm/@capacitor+status-bar@8.0.4_@capacitor+core@8.6.2/node_modules/@capacitor/status-bar")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorClipboard", package: "CapacitorClipboard"),
                .product(name: "CapacitorFileTransfer", package: "CapacitorFileTransfer"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorNetwork", package: "CapacitorNetwork"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar")
            ]
        )
    ]
)
