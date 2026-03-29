// swift-tools-version: 5.9

import PackageDescription

let package = Package(
  name: "myboat-photo-seed",
  platforms: [
    .macOS(.v13),
  ],
  products: [
    .executable(
      name: "myboat-photo-seed",
      targets: ["myboat-photo-seed"]
    ),
  ],
  targets: [
    .executableTarget(
      name: "myboat-photo-seed",
      path: "Sources"
    ),
  ]
)
