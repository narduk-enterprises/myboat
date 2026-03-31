import AppKit
import CoreLocation
import Foundation
import Photos
import UniformTypeIdentifiers

private let reviewBufferHours = 6.0
private let openPassageFallbackHours = 24.0
private let gpsConflictThresholdNm = 25.0
private let exportProgressLogInterval = 25

enum RunLogger {
  static func info(_ message: String) {
    print("[\(logTimestampFormatter.string(from: .now))] \(message)")
  }

  static func warn(_ message: String) {
    print("[\(logTimestampFormatter.string(from: .now))] warning: \(message)")
  }
}

enum OperationMode: String {
  case seed
  case export
}

struct CLIConfig {
  let mode: OperationMode
  let target: URL
  let vesselSlug: String
  let publicUsername: String?
  let apiKey: String?
  let exportDirectory: URL?
  let includeReviewMatches: Bool

  static func parse(arguments: [String]) throws -> CLIConfig {
    var mode: OperationMode = .seed
    var target = "https://mybo.at"
    var vesselSlug: String?
    var publicUsername: String?
    var apiKey: String? = ProcessInfo.processInfo.environment["MYBOAT_API_KEY"]
      ?? ProcessInfo.processInfo.environment["MYBOAT_BEARER_TOKEN"]
    var exportDirectory: String?
    var includeReviewMatches = false

    var index = 1
    while index < arguments.count {
      let argument = arguments[index]
      switch argument {
        case "--":
          index += 1
          continue
        case "--mode":
          index += 1
          let rawMode = try value(for: argument, at: index, in: arguments).lowercased()
          guard let parsedMode = OperationMode(rawValue: rawMode) else {
            throw CLIError.invalidArgument("Unsupported --mode value \(rawMode). Use seed or export.")
          }
          mode = parsedMode
        case "--target":
          index += 1
          target = try value(for: argument, at: index, in: arguments)
        case "--vessel":
          index += 1
          vesselSlug = try value(for: argument, at: index, in: arguments)
        case "--api-key":
          index += 1
          apiKey = try value(for: argument, at: index, in: arguments)
        case "--public-username", "--username":
          index += 1
          publicUsername = try value(for: argument, at: index, in: arguments)
        case "--export-dir":
          index += 1
          exportDirectory = try value(for: argument, at: index, in: arguments)
        case "--include-review":
          includeReviewMatches = true
        case "--help", "-h":
          throw CLIError.usage
        default:
          throw CLIError.invalidArgument("Unknown argument \(argument)")
      }
      index += 1
    }

    guard let targetURL = URL(string: target) else {
      throw CLIError.invalidArgument("Provide --target https://mybo.at")
    }

    guard let rawVesselSlug = vesselSlug?.trimmingCharacters(in: .whitespacesAndNewlines), !rawVesselSlug.isEmpty
    else {
      throw CLIError.invalidArgument("Provide --vessel <slug>")
    }

    let normalizedApiKey = normalizedApiKey(from: apiKey)
    let normalizedPublicUsername = normalizedPublicUsername(from: publicUsername)

    switch mode {
      case .seed:
        guard normalizedApiKey != nil else {
          throw CLIError.invalidArgument(
            "Provide --api-key nk_... or set MYBOAT_API_KEY in the environment."
          )
        }
      case .export:
        guard normalizedApiKey != nil || normalizedPublicUsername != nil else {
          throw CLIError.invalidArgument(
            "Provide --public-username <username> or --api-key nk_... for export mode."
          )
        }
    }

    let resolvedExportDirectory: URL? = if mode == .export {
      expandedFileURL(
        from: exportDirectory ?? defaultExportDirectoryPath(for: rawVesselSlug)
      )
    } else {
      nil
    }

    return CLIConfig(
      mode: mode,
      target: targetURL,
      vesselSlug: rawVesselSlug,
      publicUsername: normalizedPublicUsername,
      apiKey: normalizedApiKey,
      exportDirectory: resolvedExportDirectory,
      includeReviewMatches: includeReviewMatches
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

  private static func normalizedApiKey(from value: String?) -> String? {
    guard let rawValue = value?.trimmingCharacters(in: .whitespacesAndNewlines), !rawValue.isEmpty else {
      return nil
    }

    if rawValue.hasPrefix("Bearer ") {
      return String(rawValue.dropFirst(7))
    }

    return rawValue
  }

  private static func normalizedPublicUsername(from value: String?) -> String? {
    guard let rawValue = value?.trimmingCharacters(in: .whitespacesAndNewlines), !rawValue.isEmpty else {
      return nil
    }

    return rawValue
  }

  private static func defaultExportDirectoryPath(for vesselSlug: String) -> String {
    if let downloadsDirectory = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first {
      return downloadsDirectory
        .appendingPathComponent("\(vesselSlug)-passage-photos", isDirectory: true)
        .path
    }

    return NSString(string: "~/Downloads/\(vesselSlug)-passage-photos").expandingTildeInPath
  }

  private static func expandedFileURL(from path: String) -> URL {
    URL(
      fileURLWithPath: NSString(string: path).expandingTildeInPath,
      isDirectory: true
    )
  }
}

enum CLIError: Error, LocalizedError {
  case invalidArgument(String)
  case permissionDenied
  case unsupportedAsset(String)
  case uploadFailed(String)
  case noPassageWindows
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
      case .noPassageWindows:
        return "No passage windows were available from the selected vessel detail feed."
      case .usage:
        return """
        Usage:
          pnpm run photos:seed -- --target https://mybo.at --vessel tideye --api-key nk_...
          pnpm run photos:extract -- --target https://mybo.at --public-username narduk --vessel tideye --export-dir ~/Downloads/tideye-passage-photos

        Flags:
          --mode <seed|export>
          --target <url>              Defaults to https://mybo.at
          --vessel <slug>
          --api-key <token>           Required for seed mode
          --public-username <name>    Public profile owner for export mode
          --export-dir <path>         Defaults to ~/Downloads/<vessel>-passage-photos in export mode
          --include-review            Also export time-adjacent or ambiguous review matches

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
  let asset: PHAsset?
  let creationDate: Date
  let sourceAssetId: String
  let sourceFingerprint: String
  let title: String
  let originalFilename: String?
  let originalFileURL: URL?
  let location: CLLocation?
}

struct ExportedAsset {
  let fileURL: URL
  let filename: String
  let mimeType: String
}

struct MatchDecision {
  enum Kind: Equatable {
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

struct ExportReport {
  struct SkippedItem: Encodable {
    let title: String
    let reason: String
  }

  let exportRoot: URL
  let passageWindowsFile: URL
  let manifestFile: URL
  let reviewCandidatesFile: URL?
  var scannedAssets = 0
  var exportedAssets = 0
  var reviewMatches = 0
  var skippedAssets = 0
  var skipped: [SkippedItem] = []

  mutating func appendSkip(title: String, reason: String) {
    skipped.append(SkippedItem(title: title, reason: reason))
  }

  func printSummary() {
    print("")
    print("Export complete")
    print("---------------")
    print("Scanned assets: \(scannedAssets)")
    print("Exported assets: \(exportedAssets)")
    print("Review matches: \(reviewMatches)")
    print("Skipped assets: \(skippedAssets)")
    print("Export root: \(exportRoot.path)")
    print("Passage windows: \(passageWindowsFile.path)")
    print("Manifest: \(manifestFile.path)")
    if let reviewCandidatesFile {
      print("Review candidates: \(reviewCandidatesFile.path)")
    }

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

struct PassageManifestEntry: Encodable {
  let id: String
  let title: String
  let startedAt: String
  let endedAt: String?
  let exportDirectory: String
  let exportedCount: Int
}

struct ExportedPhotoRecord: Encodable {
  let passageId: String?
  let passageTitle: String?
  let capturedAt: String
  let sourceAssetId: String
  let originalFilename: String
  let exportedPath: String
  let matchStatus: String
  let matchReason: String
}

struct ReviewCandidateRecord: Encodable {
  let passageId: String?
  let passageTitle: String?
  let capturedAt: String
  let sourceAssetId: String
  let originalFilename: String
  let reason: String
}

struct ExportManifest: Encodable {
  let generatedAt: String
  let target: String
  let publicUsername: String?
  let vesselSlug: String
  let exportRoot: String
  let includeReviewMatches: Bool
  let passageCount: Int
  let scannedAssets: Int
  let exportedAssets: Int
  let reviewMatches: Int
  let skippedAssets: Int
  let passageWindowsFile: String
  let reviewCandidatesFile: String?
  let passages: [PassageManifestEntry]
  let exportedPhotos: [ExportedPhotoRecord]
  let skipped: [ExportReport.SkippedItem]
}

struct MyBoatAPI {
  let target: URL
  let apiKey: String?

  func fetchVesselDetail(
    vesselSlug: String,
    publicUsername: String?
  ) async throws -> VesselDetailResponse {
    let request = if let publicUsername {
      URLRequest(url: target.appending(path: "/api/public/\(publicUsername)/\(vesselSlug)"))
    } else {
      try authorizedRequest(path: "/api/app/vessels/\(vesselSlug)")
    }

    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data, context: "fetch vessel detail")
    return try JSONDecoder().decode(VesselDetailResponse.self, from: data)
  }

  func upload(file: ExportedAsset) async throws -> URL {
    let boundary = "Boundary-\(UUID().uuidString)"
    var request = try authorizedRequest(path: "/api/upload")
    request.httpMethod = "POST"
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
    var request = try authorizedRequest(path: "/api/app/vessels/\(vesselSlug)/media/import")
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    request.httpBody = try encoder.encode(MediaImportPayload(items: items))

    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data, context: "import media")
    return try JSONDecoder().decode(MediaImportResponse.self, from: data)
  }

  private func authorizedRequest(path: String) throws -> URLRequest {
    guard let apiKey else {
      throw CLIError.invalidArgument(
        "This operation requires --api-key nk_... or MYBOAT_API_KEY."
      )
    }

    var request = URLRequest(url: target.appending(path: path))
    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    return request
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
    let currentStatus = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    RunLogger.info("Photos authorization before request: \(describe(status: currentStatus))")
    let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
    RunLogger.info("Photos authorization after request: \(describe(status: status))")
    guard status == .authorized || status == .limited else {
      throw CLIError.permissionDenied
    }
  }

  private static func describe(status: PHAuthorizationStatus) -> String {
    switch status {
      case .notDetermined:
        return "notDetermined"
      case .restricted:
        return "restricted"
      case .denied:
        return "denied"
      case .authorized:
        return "authorized"
      case .limited:
        return "limited"
      @unknown default:
        return "unknown"
    }
  }
}

enum PhotoAssetFetcher {
  static func fetchAssets(windows: [PassageWindow]) -> [PhotoAssetCandidate] {
    guard !windows.isEmpty else {
      return []
    }

    let sortedWindows = windows.sorted(by: { $0.bufferStart < $1.bufferStart })
    RunLogger.info(
      "Scanning Photos framework across \(sortedWindows.count) passage windows from \(isoOutputFormatter.string(from: sortedWindows.first!.bufferStart)) to \(isoOutputFormatter.string(from: sortedWindows.last!.bufferEnd))."
    )

    var uniqueAssets: [String: PhotoAssetCandidate] = [:]

    for (index, window) in sortedWindows.enumerated() {
      let options = PHFetchOptions()
      options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
      options.predicate = NSPredicate(
        format: "mediaType == %d AND creationDate >= %@ AND creationDate <= %@",
        PHAssetMediaType.image.rawValue,
        window.bufferStart as NSDate,
        window.bufferEnd as NSDate
      )

      let fetchResult = PHAsset.fetchAssets(with: options)
      var rawMatches = 0
      var uniqueMatches = 0
      fetchResult.enumerateObjects { asset, _, _ in
        rawMatches += 1
        guard let creationDate = asset.creationDate else {
          return
        }

        let originalFilename = PHAssetResource.assetResources(for: asset).first?.originalFilename
        let title = assetTitle(for: asset, originalFilename: originalFilename)
        if uniqueAssets[asset.localIdentifier] == nil {
          uniqueMatches += 1
        }
        uniqueAssets[asset.localIdentifier] = PhotoAssetCandidate(
          asset: asset,
          creationDate: creationDate,
          sourceAssetId: asset.localIdentifier,
          sourceFingerprint: "apple-photos:\(asset.localIdentifier)",
          title: title,
          originalFilename: originalFilename,
          originalFileURL: nil,
          location: asset.location
        )
      }

      RunLogger.info(
        "Photos window [\(index + 1)/\(sortedWindows.count)] \(compactTitle(window.passage.title)) | exact \(isoOutputFormatter.string(from: window.start)) -> \(isoOutputFormatter.string(from: window.end)) | raw \(rawMatches) | unique +\(uniqueMatches)"
      )
    }

    RunLogger.info("Photos framework scan complete: \(uniqueAssets.count) unique assets.")
    return uniqueAssets.values.sorted(by: { $0.creationDate < $1.creationDate })
  }

  private static func assetTitle(
    for asset: PHAsset,
    originalFilename: String?
  ) -> String {
    if let originalFilename {
      let stripped = URL(fileURLWithPath: originalFilename)
        .deletingPathExtension()
        .lastPathComponent
      if !stripped.isEmpty {
        return stripped
      }
    }

    return "Photo \(displayDateFormatter.string(from: asset.creationDate ?? .now))"
  }

  private static let displayDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    return formatter
  }()
}

enum DirectLibraryPhotoAssetFetcher {
  static func fetchAssets(windows: [PassageWindow]) throws -> [PhotoAssetCandidate] {
    let libraryURL = defaultLibraryURL
    let databaseURL = libraryURL
      .appendingPathComponent("database", isDirectory: true)
      .appendingPathComponent("Photos.sqlite")

    guard FileManager.default.fileExists(atPath: databaseURL.path) else {
      throw CLIError.invalidArgument("Photos library database not found at \(databaseURL.path).")
    }

    if let rangeStart = windows.map(\.bufferStart).min(), let rangeEnd = windows.map(\.bufferEnd).max() {
      RunLogger.info(
        "Scanning Photos.sqlite fallback at \(databaseURL.path) from \(isoOutputFormatter.string(from: rangeStart)) to \(isoOutputFormatter.string(from: rangeEnd))."
      )
    } else {
      RunLogger.info("Scanning Photos.sqlite fallback at \(databaseURL.path).")
    }

    let rows = try fetchRows(from: databaseURL, sql: makeSQL(for: windows))
    RunLogger.info("Photos.sqlite returned \(rows.count) candidate rows.")

    var missingOriginals = 0
    var missingOriginalSamples: [String] = []
    let candidates: [PhotoAssetCandidate] = rows.compactMap { (row: String) -> PhotoAssetCandidate? in
      let columns = row.components(separatedBy: "\t")
      guard columns.count >= 7 else {
        return nil
      }

      let sourceAssetId = columns[0]
      let directory = columns[1]
      let filename = columns[2]
      let originalFilename = columns[3].isEmpty ? filename : columns[3]
      guard let rawCreated = Double(columns[4]) else {
        return nil
      }

      let originalFileURL = resolveOriginalFileURL(
        libraryURL: libraryURL,
        directory: directory,
        filename: filename
      )
      guard FileManager.default.fileExists(atPath: originalFileURL.path) else {
        missingOriginals += 1
        if missingOriginalSamples.count < 5 {
          missingOriginalSamples.append(originalFileURL.path)
        }
        return nil
      }

      let location = makeLocation(latitude: columns[5], longitude: columns[6])
      let title = URL(fileURLWithPath: originalFilename)
        .deletingPathExtension()
        .lastPathComponent

      return PhotoAssetCandidate(
        asset: nil,
        creationDate: Date(timeIntervalSinceReferenceDate: rawCreated),
        sourceAssetId: sourceAssetId,
        sourceFingerprint: "apple-photos-db:\(sourceAssetId)",
        title: title.isEmpty ? sourceAssetId : title,
        originalFilename: originalFilename,
        originalFileURL: originalFileURL,
        location: location
      )
    }

    if missingOriginals > 0 {
      RunLogger.warn(
        "Skipped \(missingOriginals) Photos.sqlite rows because the original file was not locally available in the library bundle."
      )
      for sample in missingOriginalSamples {
        RunLogger.warn("Missing original sample: \(sample)")
      }
    }

    RunLogger.info("Direct library scan complete: \(candidates.count) resolvable assets.")
    return candidates
  }

  private static let defaultLibraryURL = URL(
    fileURLWithPath: NSString(string: "~/Pictures/Photos Library.photoslibrary").expandingTildeInPath,
    isDirectory: true
  )

  private static func makeSQL(for windows: [PassageWindow]) -> String {
    let clauses = windows.map { window in
      let start = String(format: "%.6f", window.bufferStart.timeIntervalSinceReferenceDate)
      let end = String(format: "%.6f", window.bufferEnd.timeIntervalSinceReferenceDate)
      return "(a.ZDATECREATED BETWEEN \(start) AND \(end))"
    }

    return """
      SELECT
        a.ZUUID,
        a.ZDIRECTORY,
        a.ZFILENAME,
        COALESCE(NULLIF(aa.ZORIGINALFILENAME, ''), a.ZFILENAME),
        printf('%.6f', a.ZDATECREATED),
        COALESCE(CAST(a.ZLATITUDE AS TEXT), ''),
        COALESCE(CAST(a.ZLONGITUDE AS TEXT), '')
      FROM ZASSET a
      LEFT JOIN ZADDITIONALASSETATTRIBUTES aa ON aa.Z_PK = a.ZADDITIONALATTRIBUTES
      WHERE a.ZTRASHEDSTATE = 0
        AND a.ZKIND = 0
        AND (\(clauses.joined(separator: " OR ")))
      ORDER BY a.ZDATECREATED ASC;
      """
  }

  private static func fetchRows(from databaseURL: URL, sql: String) throws -> [String] {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/sqlite3")
    process.arguments = ["-tabs", databaseURL.path, sql]

    let tempDirectory = FileManager.default.temporaryDirectory
      .appendingPathComponent("myboat-photo-seed", isDirectory: true)
    try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)

    let stdoutURL = tempDirectory.appendingPathComponent(UUID().uuidString + "-sqlite-out.txt")
    let stderrURL = tempDirectory.appendingPathComponent(UUID().uuidString + "-sqlite-err.txt")
    FileManager.default.createFile(atPath: stdoutURL.path, contents: nil)
    FileManager.default.createFile(atPath: stderrURL.path, contents: nil)

    let stdoutHandle = try FileHandle(forWritingTo: stdoutURL)
    let stderrHandle = try FileHandle(forWritingTo: stderrURL)
    defer {
      try? stdoutHandle.close()
      try? stderrHandle.close()
      try? FileManager.default.removeItem(at: stdoutURL)
      try? FileManager.default.removeItem(at: stderrURL)
    }

    process.standardOutput = stdoutHandle
    process.standardError = stderrHandle

    try process.run()
    process.waitUntilExit()

    let output = (try? String(contentsOf: stdoutURL, encoding: .utf8)) ?? ""
    let errorOutput = (try? String(contentsOf: stderrURL, encoding: .utf8)) ?? ""

    guard process.terminationStatus == 0 else {
      let message = errorOutput.trimmingCharacters(in: .whitespacesAndNewlines)
      throw CLIError.uploadFailed(
        message.isEmpty
          ? "Failed to query Photos.sqlite for direct export."
          : "Failed to query Photos.sqlite for direct export: \(message)"
      )
    }

    return output
      .split(whereSeparator: \.isNewline)
      .map(String.init)
      .filter { !$0.isEmpty }
  }

  private static func makeLocation(latitude: String, longitude: String) -> CLLocation? {
    guard
      let lat = Double(latitude),
      let lng = Double(longitude),
      lat > -180,
      lng > -180
    else {
      return nil
    }

    return CLLocation(latitude: lat, longitude: lng)
  }

  private static func resolveOriginalFileURL(
    libraryURL: URL,
    directory: String,
    filename: String
  ) -> URL {
    let originalsRoot = libraryURL.appendingPathComponent("originals", isDirectory: true)
    let resolvedDirectory = directory
      .split(separator: "/")
      .reduce(originalsRoot) { partialURL, component in
        partialURL.appendingPathComponent(String(component), isDirectory: true)
      }

    return resolvedDirectory.appendingPathComponent(filename)
  }
}

enum AssetExporter {
  static func export(_ candidate: PhotoAssetCandidate) async throws -> ExportedAsset {
    guard let asset = candidate.asset else {
      throw CLIError.unsupportedAsset("The requested asset is not available through the Photos framework.")
    }

    let imageData = try await requestImageData(for: asset)
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

  static func exportOriginal(
    _ candidate: PhotoAssetCandidate,
    to directory: URL
  ) async throws -> URL {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

    if let originalFileURL = candidate.originalFileURL {
      let preferredFilename = buildExportFilename(
        originalFilename: candidate.originalFilename ?? originalFileURL.lastPathComponent,
        creationDate: candidate.creationDate
      )
      let destinationURL = uniqueDestinationURL(in: directory, preferredFilename: preferredFilename)
      try FileManager.default.copyItem(at: originalFileURL, to: destinationURL)
      return destinationURL
    }

    guard let asset = candidate.asset else {
      throw CLIError.unsupportedAsset("The original photo file could not be resolved for export.")
    }

    if let resource = preferredPhotoResource(for: asset) {
      let preferredFilename = buildExportFilename(
        originalFilename: resource.originalFilename,
        creationDate: candidate.creationDate
      )
      let destinationURL = uniqueDestinationURL(in: directory, preferredFilename: preferredFilename)
      try await writeOriginal(resource: resource, to: destinationURL)
      return destinationURL
    }

    let transcodedAsset = try await export(candidate)
    let preferredFilename = buildExportFilename(
      originalFilename: transcodedAsset.filename,
      creationDate: candidate.creationDate
    )
    let destinationURL = uniqueDestinationURL(in: directory, preferredFilename: preferredFilename)
    try FileManager.default.copyItem(at: transcodedAsset.fileURL, to: destinationURL)
    try? FileManager.default.removeItem(at: transcodedAsset.fileURL)
    return destinationURL
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

  private static func preferredPhotoResource(for asset: PHAsset) -> PHAssetResource? {
    let resources = PHAssetResource.assetResources(for: asset)
    let preferredTypes: [PHAssetResourceType] = [.fullSizePhoto, .photo, .alternatePhoto]

    for type in preferredTypes {
      if let resource = resources.first(where: { $0.type == type }) {
        return resource
      }
    }

    return resources.first
  }

  private static func writeOriginal(
    resource: PHAssetResource,
    to destinationURL: URL
  ) async throws {
    let options = PHAssetResourceRequestOptions()
    options.isNetworkAccessAllowed = true

    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      PHAssetResourceManager.default().writeData(
        for: resource,
        toFile: destinationURL,
        options: options
      ) { error in
        if let error {
          continuation.resume(throwing: error)
          return
        }

        continuation.resume()
      }
    }
  }

  private static func buildExportFilename(
    originalFilename: String,
    creationDate: Date
  ) -> String {
    let timestamp = exportFilenameFormatter.string(from: creationDate)
    let originalURL = URL(fileURLWithPath: originalFilename)
    let extensionComponent = originalURL.pathExtension
    let basename = sanitizeExportComponent(
      originalURL.deletingPathExtension().lastPathComponent.isEmpty
        ? "photo"
        : originalURL.deletingPathExtension().lastPathComponent
    )

    let exportBase = "\(timestamp)-\(basename)"
    if extensionComponent.isEmpty {
      return exportBase
    }

    return "\(exportBase).\(sanitizeExportComponent(extensionComponent))"
  }

  private static func uniqueDestinationURL(
    in directory: URL,
    preferredFilename: String
  ) -> URL {
    let preferredURL = URL(fileURLWithPath: preferredFilename)
    let ext = preferredURL.pathExtension
    let basename = preferredURL.deletingPathExtension().lastPathComponent

    var candidate = directory.appendingPathComponent(preferredFilename)
    var suffix = 2
    while FileManager.default.fileExists(atPath: candidate.path) {
      let nextBasename = "\(basename)-\(suffix)"
      candidate = directory.appendingPathComponent(nextBasename)
      if !ext.isEmpty {
        candidate.appendPathExtension(ext)
      }
      suffix += 1
    }

    return candidate
  }

  private static func sanitizeExportComponent(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return "photo"
    }

    return trimmed
      .replacingOccurrences(of: "/", with: "-")
      .replacingOccurrences(of: ":", with: "-")
      .replacingOccurrences(of: "\n", with: " ")
      .replacingOccurrences(of: "\r", with: " ")
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
      logConfig(config)

      let api = MyBoatAPI(target: config.target, apiKey: config.apiKey)
      let detail = try await api.fetchVesselDetail(
        vesselSlug: config.vesselSlug,
        publicUsername: config.publicUsername
      )
      RunLogger.info(
        "Fetched vessel detail: \(detail.passages.count) passages, \(detail.waypoints.count) waypoints."
      )
      let windows = buildPassageWindows(from: detail.passages)
      guard !windows.isEmpty else {
        throw CLIError.noPassageWindows
      }
      logPassageWindows(windows)

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

      let assets: [PhotoAssetCandidate]
      let assetSourceLabel: String
      switch config.mode {
        case .seed:
          try await PhotoLibraryAuthorizer.requestAccess()
          assets = PhotoAssetFetcher.fetchAssets(windows: windows)
          assetSourceLabel = "Photos framework"
        case .export:
          do {
            try await PhotoLibraryAuthorizer.requestAccess()
            assets = PhotoAssetFetcher.fetchAssets(windows: windows)
            assetSourceLabel = "Photos framework"
          } catch CLIError.permissionDenied {
            print("Photos framework access denied. Falling back to direct Photos library export.")
            assets = try DirectLibraryPhotoAssetFetcher.fetchAssets(windows: windows)
            assetSourceLabel = "Photos.sqlite fallback"
          }
      }
      logAssetSummary(assets, sourceLabel: assetSourceLabel)

      switch config.mode {
        case .seed:
          try await runSeed(
            api: api,
            vesselSlug: config.vesselSlug,
            assets: assets,
            matcher: matcher
          )
        case .export:
          try await runExport(
            config: config,
            windows: windows,
            assets: assets,
            matcher: matcher
          )
      }
    } catch CLIError.usage {
      fputs("\(CLIError.usage.localizedDescription)\n", stderr)
      exit(0)
    } catch {
      fputs("myboat-photo-seed: \(error.localizedDescription)\n", stderr)
      exit(1)
    }
  }

  private static func logConfig(_ config: CLIConfig) {
    RunLogger.info(
      "Starting \(config.mode.rawValue) mode for vessel \(config.vesselSlug) against \(config.target.absoluteString)."
    )

    if let publicUsername = config.publicUsername {
      RunLogger.info("Public username: \(publicUsername)")
    }

    if let exportDirectory = config.exportDirectory {
      RunLogger.info("Export directory: \(exportDirectory.path)")
    }

    if config.includeReviewMatches {
      RunLogger.info("Review matches will also be exported.")
    }
  }

  private static func runSeed(
    api: MyBoatAPI,
    vesselSlug: String,
    assets: [PhotoAssetCandidate],
    matcher: PassageMatcher
  ) async throws {
    var report = SeedReport(scannedAssets: assets.count)
    var importItems: [MediaImportItem] = []
    let decisions = assets.map { asset in (asset, matcher.match(asset: asset)) }
    logDecisionSummary(decisions.map(\.1))

    for (index, pair) in decisions.enumerated() {
      let asset = pair.0
      let decision = pair.1
      if decision.kind == .skip {
        report.appendSkip(title: asset.title, reason: decision.matchReason)
      } else {
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
              capturedAt: isoOutputFormatter.string(from: asset.creationDate)
            )
          )
          if decision.matchStatus == "review" {
            report.reviewQueueCount += 1
          }
        } catch {
          report.appendSkip(title: asset.title, reason: error.localizedDescription)
        }
      }

      if (index + 1).isMultiple(of: exportProgressLogInterval) {
        RunLogger.info(
          "Seed progress: processed \(index + 1)/\(decisions.count) assets, prepared \(importItems.count) matches."
        )
      }
    }

    report.matchedPayloads = importItems.count

    if importItems.isEmpty {
      report.printSummary()
      return
    }

    let importResponse = try await api.importMedia(vesselSlug: vesselSlug, items: importItems)
    report.importedAssets = importResponse.counts.imported
    report.duplicateImports = importResponse.counts.duplicates
    report.printSummary()
  }

  private static func runExport(
    config: CLIConfig,
    windows: [PassageWindow],
    assets: [PhotoAssetCandidate],
    matcher: PassageMatcher
  ) async throws {
    guard let exportRoot = config.exportDirectory else {
      throw CLIError.invalidArgument("Export mode requires an export directory.")
    }

    try FileManager.default.createDirectory(at: exportRoot, withIntermediateDirectories: true)
    let passageLookup = Dictionary(uniqueKeysWithValues: windows.map { ($0.passage.id, $0) })

    var report = ExportReport(
      exportRoot: exportRoot,
      passageWindowsFile: exportRoot.appendingPathComponent("passage-windows.tsv"),
      manifestFile: exportRoot.appendingPathComponent("export-manifest.json"),
      reviewCandidatesFile: nil,
      scannedAssets: assets.count,
      exportedAssets: 0,
      reviewMatches: 0,
      skippedAssets: 0,
      skipped: []
    )

    let passageWindowsFile = try writePassageWindows(windows: windows, to: exportRoot)
    RunLogger.info("Wrote passage windows to \(passageWindowsFile.path)")
    var exportedPhotos: [ExportedPhotoRecord] = []
    var reviewCandidates: [ReviewCandidateRecord] = []
    let decisions = assets.map { asset in (asset, matcher.match(asset: asset)) }
    logDecisionSummary(decisions.map(\.1))

    for (index, pair) in decisions.enumerated() {
      let asset = pair.0
      let decision = pair.1

      switch decision.kind {
        case .skip:
          report.skippedAssets += 1

          if report.skippedAssets <= 3 {
            RunLogger.warn(
              "Skipping \(asset.originalFilename ?? asset.title) at \(isoOutputFormatter.string(from: asset.creationDate)): \(decision.matchReason)"
            )
          }

        case .review:
          report.reviewMatches += 1
          let matchedPassage = decision.passageId.flatMap { passageLookup[$0] }
          reviewCandidates.append(
            ReviewCandidateRecord(
              passageId: matchedPassage?.passage.id,
              passageTitle: matchedPassage?.passage.title,
              capturedAt: isoOutputFormatter.string(from: asset.creationDate),
              sourceAssetId: asset.sourceAssetId,
              originalFilename: asset.originalFilename ?? asset.title,
              reason: decision.matchReason
            )
          )

          if config.includeReviewMatches, let matchedPassage {
            do {
              let destinationDirectory = exportDirectory(
                for: matchedPassage,
                exportRoot: exportRoot,
                review: true
              )
              let exportedURL = try await AssetExporter.exportOriginal(asset, to: destinationDirectory)
              exportedPhotos.append(
                ExportedPhotoRecord(
                  passageId: matchedPassage.passage.id,
                  passageTitle: matchedPassage.passage.title,
                  capturedAt: isoOutputFormatter.string(from: asset.creationDate),
                  sourceAssetId: asset.sourceAssetId,
                  originalFilename: asset.originalFilename ?? asset.title,
                  exportedPath: exportedURL.path,
                  matchStatus: decision.matchStatus,
                  matchReason: decision.matchReason
                )
              )
              report.exportedAssets += 1
            } catch {
              report.skippedAssets += 1
              report.appendSkip(title: asset.title, reason: error.localizedDescription)
            }
          }

        case .attach:
          if
            let passageId = decision.passageId,
            let matchedPassage = passageLookup[passageId]
          {
            do {
              let destinationDirectory = exportDirectory(
                for: matchedPassage,
                exportRoot: exportRoot,
                review: false
              )
              let exportedURL = try await AssetExporter.exportOriginal(asset, to: destinationDirectory)
              exportedPhotos.append(
                ExportedPhotoRecord(
                  passageId: matchedPassage.passage.id,
                  passageTitle: matchedPassage.passage.title,
                  capturedAt: isoOutputFormatter.string(from: asset.creationDate),
                  sourceAssetId: asset.sourceAssetId,
                  originalFilename: asset.originalFilename ?? asset.title,
                  exportedPath: exportedURL.path,
                  matchStatus: decision.matchStatus,
                  matchReason: decision.matchReason
                )
              )
              report.exportedAssets += 1
            } catch {
              report.skippedAssets += 1
              report.appendSkip(title: asset.title, reason: error.localizedDescription)
            }
          } else {
            report.skippedAssets += 1
            report.appendSkip(title: asset.title, reason: "The matched passage could not be resolved.")
          }
      }

      if (index + 1).isMultiple(of: exportProgressLogInterval) || index == decisions.count - 1 {
        RunLogger.info(
          "Export progress: processed \(index + 1)/\(decisions.count) assets, exported \(report.exportedAssets), review matches \(report.reviewMatches), skipped \(report.skippedAssets)."
        )
      }
    }

    let reviewCandidatesFile = try writeReviewCandidates(
      reviewCandidates: reviewCandidates,
      to: exportRoot
    )
    if let reviewCandidatesFile {
      RunLogger.info("Wrote review candidates to \(reviewCandidatesFile.path)")
    }
    let manifestFile = try writeManifest(
      config: config,
      windows: windows,
      exportRoot: exportRoot,
      report: report,
      exportedPhotos: exportedPhotos,
      passageWindowsFile: passageWindowsFile,
      reviewCandidatesFile: reviewCandidatesFile
    )

    report = ExportReport(
      exportRoot: exportRoot,
      passageWindowsFile: passageWindowsFile,
      manifestFile: manifestFile,
      reviewCandidatesFile: reviewCandidatesFile,
      scannedAssets: report.scannedAssets,
      exportedAssets: report.exportedAssets,
      reviewMatches: report.reviewMatches,
      skippedAssets: report.skippedAssets,
      skipped: report.skipped
    )
    RunLogger.info("Wrote export manifest to \(manifestFile.path)")
    report.printSummary()
  }

  private static func writePassageWindows(
    windows: [PassageWindow],
    to exportRoot: URL
  ) throws -> URL {
    let lines = windows
      .sorted(by: { $0.start < $1.start })
      .map { window in
        [
          window.passage.id,
          escapedTSVField(window.passage.title),
          isoOutputFormatter.string(from: window.start),
          isoOutputFormatter.string(from: window.end),
          localTimestampFormatter.string(from: window.start),
          localTimestampFormatter.string(from: window.end),
        ].joined(separator: "\t")
      }

    let fileURL = exportRoot.appendingPathComponent("passage-windows.tsv")
    let content = ([
      "passageId\ttitle\tstartedAtUtc\tendedAtUtc\tstartedAtLocal\tendedAtLocal",
    ] + lines).joined(separator: "\n") + "\n"
    try content.write(to: fileURL, atomically: true, encoding: .utf8)
    return fileURL
  }

  private static func writeReviewCandidates(
    reviewCandidates: [ReviewCandidateRecord],
    to exportRoot: URL
  ) throws -> URL? {
    guard !reviewCandidates.isEmpty else {
      return nil
    }

    let fileURL = exportRoot.appendingPathComponent("review-candidates.tsv")
    let lines = reviewCandidates.map { candidate in
      [
        escapedTSVField(candidate.passageId ?? ""),
        escapedTSVField(candidate.passageTitle ?? ""),
        escapedTSVField(candidate.capturedAt),
        escapedTSVField(candidate.sourceAssetId),
        escapedTSVField(candidate.originalFilename),
        escapedTSVField(candidate.reason),
      ].joined(separator: "\t")
    }
    let content = ([
      "passageId\tpassageTitle\tcapturedAt\tsourceAssetId\toriginalFilename\treason",
    ] + lines).joined(separator: "\n") + "\n"
    try content.write(to: fileURL, atomically: true, encoding: .utf8)
    return fileURL
  }

  private static func writeManifest(
    config: CLIConfig,
    windows: [PassageWindow],
    exportRoot: URL,
    report: ExportReport,
    exportedPhotos: [ExportedPhotoRecord],
    passageWindowsFile: URL,
    reviewCandidatesFile: URL?
  ) throws -> URL {
    let exportedCountsByPassageId = Dictionary(
      grouping: exportedPhotos.compactMap { photo in
        photo.passageId.map { ($0, photo) }
      },
      by: { pair in pair.0 }
    ).mapValues(\.count)

    let passages = windows
      .sorted(by: { $0.start < $1.start })
      .map { window in
        PassageManifestEntry(
          id: window.passage.id,
          title: window.passage.title,
          startedAt: isoOutputFormatter.string(from: window.start),
          endedAt: isoOutputFormatter.string(from: window.end),
          exportDirectory: exportDirectory(
            for: window,
            exportRoot: exportRoot,
            review: false
          ).path,
          exportedCount: exportedCountsByPassageId[window.passage.id] ?? 0
        )
      }

    let manifest = ExportManifest(
      generatedAt: isoOutputFormatter.string(from: .now),
      target: config.target.absoluteString,
      publicUsername: config.publicUsername,
      vesselSlug: config.vesselSlug,
      exportRoot: exportRoot.path,
      includeReviewMatches: config.includeReviewMatches,
      passageCount: windows.count,
      scannedAssets: report.scannedAssets,
      exportedAssets: report.exportedAssets,
      reviewMatches: report.reviewMatches,
      skippedAssets: report.skippedAssets,
      passageWindowsFile: passageWindowsFile.path,
      reviewCandidatesFile: reviewCandidatesFile?.path,
      passages: passages,
      exportedPhotos: exportedPhotos,
      skipped: report.skipped
    )

    let fileURL = exportRoot.appendingPathComponent("export-manifest.json")
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(manifest)
    try data.write(to: fileURL)
    return fileURL
  }

  private static func exportDirectory(
    for passage: PassageWindow,
    exportRoot: URL,
    review: Bool
  ) -> URL {
    let rootDirectory = if review {
      exportRoot.appendingPathComponent("_review", isDirectory: true)
    } else {
      exportRoot
    }

    return rootDirectory.appendingPathComponent(directoryName(for: passage), isDirectory: true)
  }

  private static func directoryName(for passage: PassageWindow) -> String {
    let datePrefix = passageDirectoryFormatter.string(from: passage.start)
    let titleSlug = String(slugify(passage.passage.title).prefix(80))
    let passageSuffix = String(passage.passage.id.suffix(6))
    return "\(datePrefix)-\(titleSlug)-\(passageSuffix)"
  }

  private static func escapedTSVField(_ value: String) -> String {
    value.replacingOccurrences(of: "\t", with: " ")
  }

  private static func slugify(_ value: String) -> String {
    let lowered = value
      .lowercased()
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }
      .joined(separator: "-")

    return lowered.isEmpty ? "passage" : lowered
  }

  private static func buildPassageWindows(from passages: [Passage]) -> [PassageWindow] {
    passages.compactMap { passage in
      guard let start = parseISODate(passage.startedAt) else {
        RunLogger.warn(
          "Skipping passage \(passage.id) because startedAt could not be parsed: \(passage.startedAt)"
        )
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
    if let endedAt = passage.endedAt {
      if let end = parseISODate(endedAt) {
        return end
      }

      RunLogger.warn(
        "Passage \(passage.id) has an invalid endedAt value (\(endedAt)); using a \(Int(openPassageFallbackHours)) hour fallback."
      )
    }

    return start.addingTimeInterval(openPassageFallbackHours * 3600)
  }
}

private let isoInputFormatters: [ISO8601DateFormatter] = {
  let plainFormatter = ISO8601DateFormatter()
  plainFormatter.formatOptions = [.withInternetDateTime]

  let fractionalFormatter = ISO8601DateFormatter()
  fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

  return [fractionalFormatter, plainFormatter]
}()

private let isoOutputFormatter: ISO8601DateFormatter = {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime]
  return formatter
}()

private let localTimestampFormatter: DateFormatter = {
  let formatter = DateFormatter()
  formatter.locale = Locale.current
  formatter.dateFormat = "yyyy-MM-dd HH:mm:ss zzz"
  return formatter
}()

private let passageDirectoryFormatter: DateFormatter = {
  let formatter = DateFormatter()
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  formatter.dateFormat = "yyyyMMdd"
  return formatter
}()

private let exportFilenameFormatter: DateFormatter = {
  let formatter = DateFormatter()
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  formatter.dateFormat = "yyyyMMdd-HHmmss"
  return formatter
}()

private let logTimestampFormatter: DateFormatter = {
  let formatter = DateFormatter()
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.dateFormat = "HH:mm:ss"
  return formatter
}()

private func parseISODate(_ value: String) -> Date? {
  for formatter in isoInputFormatters {
    if let date = formatter.date(from: value) {
      return date
    }
  }

  return nil
}

private func logPassageWindows(_ windows: [PassageWindow]) {
  let sortedWindows = windows.sorted(by: { $0.start < $1.start })
  guard let firstWindow = sortedWindows.first, let lastWindow = sortedWindows.last else {
    return
  }

  RunLogger.info(
    "Passage windows: \(sortedWindows.count) entries from \(isoOutputFormatter.string(from: firstWindow.start)) to \(isoOutputFormatter.string(from: lastWindow.end))."
  )

  for (index, window) in sortedWindows.enumerated() {
    RunLogger.info(
      "Passage [\(index + 1)/\(sortedWindows.count)] \(window.passage.id) | \(compactTitle(window.passage.title)) | exact \(isoOutputFormatter.string(from: window.start)) -> \(isoOutputFormatter.string(from: window.end)) | local \(localTimestampFormatter.string(from: window.start)) -> \(localTimestampFormatter.string(from: window.end))"
    )
  }
}

private func logAssetSummary(_ assets: [PhotoAssetCandidate], sourceLabel: String) {
  guard let firstAsset = assets.first, let lastAsset = assets.last else {
    RunLogger.info("No candidate assets were found from \(sourceLabel).")
    return
  }

  RunLogger.info(
    "Candidate assets from \(sourceLabel): \(assets.count) entries from \(isoOutputFormatter.string(from: firstAsset.creationDate)) to \(isoOutputFormatter.string(from: lastAsset.creationDate))."
  )
}

private func logDecisionSummary(_ decisions: [MatchDecision]) {
  var attachCount = 0
  var reviewCount = 0
  var skipCount = 0

  for decision in decisions {
    switch decision.kind {
      case .attach:
        attachCount += 1
      case .review:
        reviewCount += 1
      case .skip:
        skipCount += 1
    }
  }

  RunLogger.info(
    "Match decisions: attach \(attachCount), review \(reviewCount), skip \(skipCount)."
  )
}

private func compactTitle(_ value: String, maxLength: Int = 96) -> String {
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  guard trimmed.count > maxLength else {
    return trimmed
  }

  return String(trimmed.prefix(maxLength - 3)) + "..."
}

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
