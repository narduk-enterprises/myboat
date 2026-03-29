import AppKit
import CoreLocation
import Foundation
import Photos
import UniformTypeIdentifiers

private let reviewBufferHours = 6.0
private let openPassageFallbackHours = 24.0
private let gpsConflictThresholdNm = 25.0

struct CLIConfig {
  let target: URL
  let vesselSlug: String
  let apiKey: String

  static func parse(arguments: [String]) throws -> CLIConfig {
    var target: String?
    var vesselSlug: String?
    var apiKey: String? = ProcessInfo.processInfo.environment["MYBOAT_API_KEY"]
      ?? ProcessInfo.processInfo.environment["MYBOAT_BEARER_TOKEN"]

    var index = 1
    while index < arguments.count {
      let argument = arguments[index]
      switch argument {
        case "--":
          index += 1
          continue
        case "--target":
          index += 1
          target = try value(for: argument, at: index, in: arguments)
        case "--vessel":
          index += 1
          vesselSlug = try value(for: argument, at: index, in: arguments)
        case "--api-key":
          index += 1
          apiKey = try value(for: argument, at: index, in: arguments)
        case "--help", "-h":
          throw CLIError.usage
        default:
          throw CLIError.invalidArgument("Unknown argument \(argument)")
      }
      index += 1
    }

    guard let target, let targetURL = URL(string: target) else {
      throw CLIError.invalidArgument("Provide --target https://mybo.at")
    }

    guard let vesselSlug, !vesselSlug.isEmpty else {
      throw CLIError.invalidArgument("Provide --vessel <slug>")
    }

    guard let rawApiKey = apiKey?.trimmingCharacters(in: .whitespacesAndNewlines), !rawApiKey.isEmpty
    else {
      throw CLIError.invalidArgument(
        "Provide --api-key nk_... or set MYBOAT_API_KEY in the environment."
      )
    }

    let normalizedApiKey = rawApiKey.hasPrefix("Bearer ") ? String(rawApiKey.dropFirst(7)) : rawApiKey

    return CLIConfig(
      target: targetURL,
      vesselSlug: vesselSlug,
      apiKey: normalizedApiKey
    )
  }

  private static func value(
    for flag: String,
    at index: Int,
    in arguments: [String]
  ) throws -> String {
    guard arguments.indices.contains(index) else {
      throw CLIError.invalidArgument("Missing value for \(flag)")
    }

    return arguments[index]
  }
}

enum CLIError: Error, LocalizedError {
  case invalidArgument(String)
  case permissionDenied
  case unsupportedAsset(String)
  case uploadFailed(String)
  case usage

  var errorDescription: String? {
    switch self {
      case let .invalidArgument(message):
        return message
      case .permissionDenied:
        return "Apple Photos access was denied. Grant Terminal or your shell permission to Photos and rerun."
      case let .unsupportedAsset(message):
        return message
      case let .uploadFailed(message):
        return message
      case .usage:
        return """
        Usage:
          pnpm run photos:seed -- --target https://mybo.at --vessel tideye --api-key nk_...

        Environment fallback:
          MYBOAT_API_KEY=nk_...
        """
    }
  }
}

struct VesselDetailResponse: Decodable {
  let passages: [Passage]
  let waypoints: [Waypoint]
}

struct Passage: Decodable {
  let id: String
  let title: String
  let startedAt: String
  let endedAt: String?
  let trackGeojson: String?
}

struct Waypoint: Decodable {
  let passageId: String?
  let lat: Double
  let lng: Double
}

struct UploadResponse: Decodable {
  let key: String
  let url: String
}

struct MediaImportPayload: Encodable {
  let items: [MediaImportItem]
}

struct MediaImportItem: Encodable {
  let passageId: String?
  let title: String
  let caption: String?
  let imageUrl: String
  let sharePublic: Bool
  let sourceKind: String
  let sourceAssetId: String?
  let sourceFingerprint: String
  let matchStatus: String
  let matchScore: Double?
  let matchReason: String?
  let isCover: Bool
  let lat: Double?
  let lng: Double?
  let capturedAt: String?
}

struct MediaImportResponse: Decodable {
  struct Duplicate: Decodable {
    let mediaId: String
    let sourceFingerprint: String
  }

  struct Counts: Decodable {
    let imported: Int
    let duplicates: Int
  }

  let duplicates: [Duplicate]
  let counts: Counts
}

struct PassageWindow {
  let passage: Passage
  let start: Date
  let end: Date
  let bufferStart: Date
  let bufferEnd: Date
  let midpoint: Date
}

struct Coordinate {
  let lat: Double
  let lng: Double
}

struct PhotoAssetCandidate {
  let asset: PHAsset
  let creationDate: Date
  let sourceAssetId: String
  let sourceFingerprint: String
  let title: String
  let location: CLLocation?
}

struct ExportedAsset {
  let fileURL: URL
  let filename: String
  let mimeType: String
}

struct MatchDecision {
  enum Kind {
    case attach
    case review
    case skip
  }

  let kind: Kind
  let passageId: String?
  let sharePublic: Bool
  let matchStatus: String
  let matchScore: Double?
  let matchReason: String
}

struct SeedReport {
  struct SkippedItem {
    let title: String
    let reason: String
  }

  var scannedAssets = 0
  var matchedPayloads = 0
  var uploadedAssets = 0
  var importedAssets = 0
  var duplicateImports = 0
  var reviewQueueCount = 0
  var skipped: [SkippedItem] = []

  mutating func appendSkip(title: String, reason: String) {
    skipped.append(SkippedItem(title: title, reason: reason))
  }

  func printSummary() {
    print("")
    print("Seed complete")
    print("------------")
    print("Scanned assets: \(scannedAssets)")
    print("Prepared matches: \(matchedPayloads)")
    print("Uploaded assets: \(uploadedAssets)")
    print("Imported media: \(importedAssets)")
    print("Review queue: \(reviewQueueCount)")
    print("Duplicates skipped: \(duplicateImports)")
    print("Skipped assets: \(skipped.count)")

    if !skipped.isEmpty {
      print("")
      print("Skipped details")
      print("---------------")
      for item in skipped {
        print("- \(item.title): \(item.reason)")
      }
    }
  }
}

struct MyBoatAPI {
  let target: URL
  let apiKey: String

  func fetchVesselDetail(vesselSlug: String) async throws -> VesselDetailResponse {
    var request = URLRequest(url: target.appending(path: "/api/app/vessels/\(vesselSlug)"))
    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data, context: "fetch vessel detail")
    return try JSONDecoder().decode(VesselDetailResponse.self, from: data)
  }

  func upload(file: ExportedAsset) async throws -> URL {
    let boundary = "Boundary-\(UUID().uuidString)"
    var request = URLRequest(url: target.appending(path: "/api/upload"))
    request.httpMethod = "POST"
    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

    let fileData = try Data(contentsOf: file.fileURL)
    let body = makeMultipartBody(
      boundary: boundary,
      filename: file.filename,
      mimeType: file.mimeType,
      fileData: fileData
    )

    let (data, response) = try await URLSession.shared.upload(for: request, from: body)
    try validate(response: response, data: data, context: "upload asset")
    let decoded = try JSONDecoder().decode(UploadResponse.self, from: data)
    guard let resolvedURL = URL(string: decoded.url, relativeTo: target)?.absoluteURL else {
      throw CLIError.uploadFailed("Upload response returned an invalid image URL.")
    }
    return resolvedURL
  }

  func importMedia(vesselSlug: String, items: [MediaImportItem]) async throws -> MediaImportResponse {
    var request = URLRequest(url: target.appending(path: "/api/app/vessels/\(vesselSlug)/media/import"))
    request.httpMethod = "POST"
    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    request.httpBody = try encoder.encode(MediaImportPayload(items: items))

    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data, context: "import media")
    return try JSONDecoder().decode(MediaImportResponse.self, from: data)
  }

  private func validate(response: URLResponse, data: Data, context: String) throws {
    guard let http = response as? HTTPURLResponse else {
      throw CLIError.uploadFailed("Unexpected response while attempting to \(context).")
    }

    guard (200..<300).contains(http.statusCode) else {
      let body = String(data: data, encoding: .utf8) ?? "<non-utf8 body>"
      throw CLIError.uploadFailed("Failed to \(context): HTTP \(http.statusCode) \(body)")
    }
  }

  private func makeMultipartBody(
    boundary: String,
    filename: String,
    mimeType: String,
    fileData: Data
  ) -> Data {
    var body = Data()
    body.append("--\(boundary)\r\n".data(using: .utf8)!)
    body.append(
      "Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n"
        .data(using: .utf8)!
    )
    body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
    body.append(fileData)
    body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
    return body
  }
}

enum PhotoLibraryAuthorizer {
  static func requestAccess() async throws {
    let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
    guard status == .authorized || status == .limited else {
      throw CLIError.permissionDenied
    }
  }
}

enum PhotoAssetFetcher {
  static func fetchAssets(windows: [PassageWindow]) -> [PhotoAssetCandidate] {
    guard !windows.isEmpty else {
      return []
    }

    var uniqueAssets: [String: PhotoAssetCandidate] = [:]

    for window in windows {
      let options = PHFetchOptions()
      options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
      options.predicate = NSPredicate(
        format: "mediaType == %d AND creationDate >= %@ AND creationDate <= %@",
        PHAssetMediaType.image.rawValue,
        window.bufferStart as NSDate,
        window.bufferEnd as NSDate
      )

      let fetchResult = PHAsset.fetchAssets(with: options)
      fetchResult.enumerateObjects { asset, _, _ in
        guard let creationDate = asset.creationDate else {
          return
        }

        let title = assetTitle(for: asset)
        uniqueAssets[asset.localIdentifier] = PhotoAssetCandidate(
          asset: asset,
          creationDate: creationDate,
          sourceAssetId: asset.localIdentifier,
          sourceFingerprint: "apple-photos:\(asset.localIdentifier)",
          title: title,
          location: asset.location
        )
      }
    }

    return uniqueAssets.values.sorted(by: { $0.creationDate < $1.creationDate })
  }

  private static func assetTitle(for asset: PHAsset) -> String {
    if let filename = PHAssetResource.assetResources(for: asset).first?.originalFilename {
      let stripped = URL(fileURLWithPath: filename).deletingPathExtension().lastPathComponent
      if !stripped.isEmpty {
        return stripped
      }
    }

    return "Photo \(Self.displayDateFormatter.string(from: asset.creationDate ?? .now))"
  }

  private static let displayDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    return formatter
  }()
}

enum AssetExporter {
  static func export(_ candidate: PhotoAssetCandidate) async throws -> ExportedAsset {
    let imageData = try await requestImageData(for: candidate.asset)
    let suggestedFilename = sanitizeFilename(candidate.title)

    switch imageData {
      case let .passthrough(data, fileExtension, mimeType):
        let fileURL = makeTemporaryURL(filename: suggestedFilename, extension: fileExtension)
        try data.write(to: fileURL)
        return ExportedAsset(fileURL: fileURL, filename: fileURL.lastPathComponent, mimeType: mimeType)

      case .transcodeToJPEG(let data):
        let fileURL = makeTemporaryURL(filename: suggestedFilename, extension: "jpg")
        try data.write(to: fileURL)
        return ExportedAsset(fileURL: fileURL, filename: fileURL.lastPathComponent, mimeType: "image/jpeg")
    }
  }

  private enum RequestedImageKind {
    case passthrough(Data, fileExtension: String, mimeType: String)
    case transcodeToJPEG(Data)
  }

  private static func requestImageData(for asset: PHAsset) async throws -> RequestedImageKind {
    let payload: (Data, String?) = try await withCheckedThrowingContinuation { (
      continuation: CheckedContinuation<(Data, String?), Error>
    ) in
      let options = PHImageRequestOptions()
      options.deliveryMode = .highQualityFormat
      options.isNetworkAccessAllowed = true
      options.version = .current

      PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) {
        data,
        dataUTI,
        _,
        info in
        if let error = info?[PHImageErrorKey] as? Error {
          continuation.resume(throwing: error)
          return
        }

        guard let data else {
          continuation.resume(
            throwing: CLIError.unsupportedAsset("The Photos asset did not return image data.")
          )
          return
        }

        continuation.resume(returning: (data, dataUTI))
      }
    }

    let uti = payload.1.flatMap(UTType.init)
    let filename = PHAssetResource.assetResources(for: asset).first?.originalFilename.lowercased() ?? ""
    let fileExtension = URL(fileURLWithPath: filename).pathExtension.lowercased()

    if let allowed = allowedMimeType(for: uti, fileExtension: fileExtension) {
      return .passthrough(payload.0, fileExtension: allowed.fileExtension, mimeType: allowed.mimeType)
    }

    guard let transcoded = transcodeToJPEG(payload.0) else {
      throw CLIError.unsupportedAsset(
        "Unsupported image type for \(filename.isEmpty ? asset.localIdentifier : filename)."
      )
    }

    return .transcodeToJPEG(transcoded)
  }

  private static func allowedMimeType(
    for uti: UTType?,
    fileExtension: String
  ) -> (fileExtension: String, mimeType: String)? {
    if uti?.conforms(to: .jpeg) == true || ["jpg", "jpeg"].contains(fileExtension) {
      return ("jpg", "image/jpeg")
    }

    if uti?.conforms(to: .png) == true || fileExtension == "png" {
      return ("png", "image/png")
    }

    if uti?.conforms(to: .gif) == true || fileExtension == "gif" {
      return ("gif", "image/gif")
    }

    if fileExtension == "webp" {
      return ("webp", "image/webp")
    }

    if fileExtension == "avif" {
      return ("avif", "image/avif")
    }

    return nil
  }

  private static func transcodeToJPEG(_ data: Data) -> Data? {
    guard
      let image = NSImage(data: data),
      let tiffData = image.tiffRepresentation,
      let representation = NSBitmapImageRep(data: tiffData)
    else {
      return nil
    }

    return representation.representation(
      using: .jpeg,
      properties: [.compressionFactor: 0.92]
    )
  }

  private static func sanitizeFilename(_ value: String) -> String {
    let lowered = value
      .lowercased()
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }
      .joined(separator: "-")

    return lowered.isEmpty ? "myboat-photo" : lowered
  }

  private static func makeTemporaryURL(filename: String, extension fileExtension: String) -> URL {
    let tempDir = FileManager.default.temporaryDirectory
      .appendingPathComponent("myboat-photo-seed", isDirectory: true)
    try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    return tempDir
      .appendingPathComponent(UUID().uuidString + "-" + filename)
      .appendingPathExtension(fileExtension)
  }
}

struct PassageMatcher {
  let passages: [PassageWindow]
  let waypointsByPassageId: [String: [Coordinate]]

  func match(asset: PhotoAssetCandidate) -> MatchDecision {
    let exactMatches = passages.filter { asset.creationDate >= $0.start && asset.creationDate <= $0.end }

    if exactMatches.count == 1, let candidate = exactMatches.first {
      if gpsContradicts(asset: asset, passage: candidate) {
        return MatchDecision(
          kind: .review,
          passageId: candidate.passage.id,
          sharePublic: false,
          matchStatus: "review",
          matchScore: 0.72,
          matchReason: "Capture time matched the passage, but the photo location sat far off the saved route."
        )
      }

      return MatchDecision(
        kind: .attach,
        passageId: candidate.passage.id,
        sharePublic: true,
        matchStatus: "attached",
        matchScore: 0.98,
        matchReason: "Capture time matched the exact passage window."
      )
    }

    if exactMatches.count > 1, let candidate = nearestPassage(to: asset.creationDate, in: exactMatches) {
      return MatchDecision(
        kind: .review,
        passageId: candidate.passage.id,
        sharePublic: false,
        matchStatus: "review",
        matchScore: 0.64,
        matchReason: "Capture time overlaps multiple passage windows."
      )
    }

    let bufferMatches = passages.filter {
      asset.creationDate >= $0.bufferStart && asset.creationDate <= $0.bufferEnd
    }

    if let candidate = nearestPassage(to: asset.creationDate, in: bufferMatches) {
      return MatchDecision(
        kind: .review,
        passageId: candidate.passage.id,
        sharePublic: false,
        matchStatus: "review",
        matchScore: 0.52,
        matchReason: "Capture time landed near a passage window but outside the exact voyage bounds."
      )
    }

    return MatchDecision(
      kind: .skip,
      passageId: nil,
      sharePublic: false,
      matchStatus: "review",
      matchScore: nil,
      matchReason: "Capture time fell outside the seeded passage windows."
    )
  }

  private func nearestPassage(to date: Date, in windows: [PassageWindow]) -> PassageWindow? {
    windows.min(by: { abs($0.midpoint.timeIntervalSince(date)) < abs($1.midpoint.timeIntervalSince(date)) })
  }

  private func gpsContradicts(asset: PhotoAssetCandidate, passage: PassageWindow) -> Bool {
    guard let location = asset.location else {
      return false
    }

    let routeCoordinates = trackCoordinates(for: passage.passage) + (waypointsByPassageId[passage.passage.id] ?? [])
    guard !routeCoordinates.isEmpty else {
      return false
    }

    let nearestDistance = routeCoordinates
      .map { haversineNm(lat1: location.coordinate.latitude, lng1: location.coordinate.longitude, lat2: $0.lat, lng2: $0.lng) }
      .min() ?? .greatestFiniteMagnitude

    return nearestDistance > gpsConflictThresholdNm
  }

  private func trackCoordinates(for passage: Passage) -> [Coordinate] {
    guard
      let trackGeojson = passage.trackGeojson,
      let data = trackGeojson.data(using: .utf8),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return []
    }

    if
      let geometry = json["geometry"] as? [String: Any],
      let geometryCoordinates = geometry["coordinates"] as? [[Double]]
    {
      return geometryCoordinates.compactMap { coordinate in
        guard coordinate.count >= 2 else {
          return nil
        }
        return Coordinate(lat: coordinate[1], lng: coordinate[0])
      }
    }

    if let coordinates = json["coordinates"] as? [[Double]] {
      return coordinates.compactMap { coordinate in
        guard coordinate.count >= 2 else {
          return nil
        }
        return Coordinate(lat: coordinate[1], lng: coordinate[0])
      }
    }

    return []
  }
}

@main
struct MyBoatPhotoSeedCLI {
  static func main() async {
    do {
      let config = try CLIConfig.parse(arguments: CommandLine.arguments)
      try await PhotoLibraryAuthorizer.requestAccess()

      let api = MyBoatAPI(target: config.target, apiKey: config.apiKey)
      let detail = try await api.fetchVesselDetail(vesselSlug: config.vesselSlug)
      let windows = buildPassageWindows(from: detail.passages)
      let waypointPairs: [(String, Coordinate)] = detail.waypoints.compactMap { waypoint in
        guard let passageId = waypoint.passageId else {
          return nil
        }

        return (passageId, Coordinate(lat: waypoint.lat, lng: waypoint.lng))
      }
      let matcher = PassageMatcher(
        passages: windows,
        waypointsByPassageId: Dictionary(
          grouping: waypointPairs,
          by: { pair in pair.0 }
        ).mapValues { pairs in pairs.map(\.1) }
      )

      let assets = PhotoAssetFetcher.fetchAssets(windows: windows)
      var report = SeedReport(scannedAssets: assets.count)
      var importItems: [MediaImportItem] = []

      for asset in assets {
        let decision = matcher.match(asset: asset)
        guard decision.kind != MatchDecision.Kind.skip else {
          report.appendSkip(title: asset.title, reason: decision.matchReason)
          continue
        }

        do {
          let exported = try await AssetExporter.export(asset)
          defer { try? FileManager.default.removeItem(at: exported.fileURL) }

          let uploadedURL = try await api.upload(file: exported)
          report.uploadedAssets += 1

          importItems.append(
            MediaImportItem(
              passageId: decision.passageId,
              title: asset.title,
              caption: nil,
              imageUrl: uploadedURL.absoluteString,
              sharePublic: decision.sharePublic,
              sourceKind: "apple_photos_seed",
              sourceAssetId: asset.sourceAssetId,
              sourceFingerprint: asset.sourceFingerprint,
              matchStatus: decision.matchStatus,
              matchScore: decision.matchScore,
              matchReason: decision.matchReason,
              isCover: false,
              lat: asset.location?.coordinate.latitude,
              lng: asset.location?.coordinate.longitude,
              capturedAt: isoFormatter.string(from: asset.creationDate)
            )
          )

          if decision.matchStatus == "review" {
            report.reviewQueueCount += 1
          }
        } catch {
          report.appendSkip(title: asset.title, reason: error.localizedDescription)
        }
      }

      report.matchedPayloads = importItems.count

      if importItems.isEmpty {
        report.printSummary()
        return
      }

      let importResponse = try await api.importMedia(vesselSlug: config.vesselSlug, items: importItems)
      report.importedAssets = importResponse.counts.imported
      report.duplicateImports = importResponse.counts.duplicates
      report.printSummary()
    } catch CLIError.usage {
      fputs("\(CLIError.usage.localizedDescription)\n", stderr)
      exit(0)
    } catch {
      fputs("myboat-photo-seed: \(error.localizedDescription)\n", stderr)
      exit(1)
    }
  }

  private static func buildPassageWindows(from passages: [Passage]) -> [PassageWindow] {
    passages.compactMap { passage in
      guard let start = isoFormatter.date(from: passage.startedAt) else {
        return nil
      }

      let end = resolvedPassageEnd(for: passage, from: start)
      let bufferStart = start.addingTimeInterval(-reviewBufferHours * 3600)
      let bufferEnd = end.addingTimeInterval(reviewBufferHours * 3600)
      let midpoint = start.addingTimeInterval(end.timeIntervalSince(start) / 2)

      return PassageWindow(
        passage: passage,
        start: start,
        end: end,
        bufferStart: bufferStart,
        bufferEnd: bufferEnd,
        midpoint: midpoint
      )
    }
  }

  private static func resolvedPassageEnd(for passage: Passage, from start: Date) -> Date {
    if let endedAt = passage.endedAt, let end = isoFormatter.date(from: endedAt) {
      return end
    }

    return start.addingTimeInterval(openPassageFallbackHours * 3600)
  }
}

private let isoFormatter: ISO8601DateFormatter = {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter
}()

private func haversineNm(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
  let earthRadiusMeters = 6_371_000.0
  let dLat = (lat2 - lat1) * .pi / 180
  let dLng = (lng2 - lng1) * .pi / 180
  let a =
    sin(dLat / 2) * sin(dLat / 2) +
    cos(lat1 * .pi / 180) *
      cos(lat2 * .pi / 180) *
      sin(dLng / 2) *
      sin(dLng / 2)

  return (earthRadiusMeters * 2 * atan2(sqrt(a), sqrt(1 - a))) / 1852
}
