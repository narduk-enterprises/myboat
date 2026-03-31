import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { runCommand } from './command'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const WEB_DIR = path.join(ROOT_DIR, 'apps', 'web')

type LocationFlag = '--local' | '--remote'

interface ExportManifest {
  target: string
  vesselSlug: string
  exportRoot: string
  exportedPhotos: ExportedPhotoRecord[]
}

interface ExportedPhotoRecord {
  passageId: string | null
  passageTitle: string | null
  capturedAt: string
  sourceAssetId: string
  originalFilename: string
  exportedPath: string
  matchStatus: string
  matchReason: string
}

interface ParsedArgs {
  manifestPath: string
  bucketName: string
  databaseName: string
  vesselSlug?: string
  siteUrl: string
  location: LocationFlag
  dryRun: boolean
  limit?: number
}

interface VesselRow {
  id: string
  slug: string
}

interface FileMetadata {
  capturedAt: string | null
  lat: number | null
  lng: number | null
}

interface ImportRecord {
  mediaId: string
  passageId: string | null
  title: string
  imageUrl: string
  sourceAssetId: string
  sourceFingerprint: string
  matchStatus: 'attached' | 'review'
  matchReason: string | null
  capturedAt: string | null
  lat: number | null
  lng: number | null
  filePath: string
  objectKey: string
}

function parseArgs(argv: string[]): ParsedArgs {
  let manifestPath: string | undefined
  let bucketName = 'images-bucket'
  let databaseName = 'myboat-db'
  let vesselSlug: string | undefined
  let siteUrl = process.env.SITE_URL?.trim() || 'https://mybo.at'
  let location: LocationFlag = '--remote'
  let dryRun = false
  let limit: number | undefined

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') {
      continue
    }

    switch (argument) {
      case '--manifest':
        manifestPath = requireValue(argument, argv[++index])
        break
      case '--bucket':
        bucketName = requireValue(argument, argv[++index])
        break
      case '--db':
        databaseName = requireValue(argument, argv[++index])
        break
      case '--vessel':
        vesselSlug = requireValue(argument, argv[++index])
        break
      case '--site-url':
        siteUrl = requireValue(argument, argv[++index])
        break
      case '--limit':
        limit = Number.parseInt(requireValue(argument, argv[++index]), 10)
        if (!Number.isFinite(limit) || limit <= 0) {
          throw new Error('--limit must be a positive integer.')
        }
        break
      case '--local':
        location = '--local'
        break
      case '--remote':
        location = '--remote'
        break
      case '--dry-run':
        dryRun = true
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (!manifestPath) {
    throw new Error('Provide --manifest /absolute/path/to/export-manifest.json')
  }

  return {
    manifestPath: path.resolve(manifestPath),
    bucketName,
    databaseName,
    vesselSlug,
    siteUrl: siteUrl.replace(/\/$/, ''),
    location,
    dryRun,
    limit,
  }
}

function requireValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }

  return value
}

function printUsage() {
  console.log(`Usage:
  pnpm exec tsx tools/import-exported-photos.ts \\
    --manifest ~/Downloads/tideye-passage-photos/export-manifest.json \\
    --remote \\
    --bucket images-bucket \\
    --db myboat-db

Flags:
  --manifest <path>    Export manifest from tools/myboat-photo-seed
  --bucket <name>      R2 bucket name (default: images-bucket)
  --db <name>          D1 database name (default: myboat-db)
  --vessel <slug>      Override vessel slug from manifest
  --site-url <url>     Public app URL (default: SITE_URL or https://mybo.at)
  --remote             Use remote D1/R2
  --local              Use local D1/R2
  --limit <n>          Import only the first n exported photos
  --dry-run            Build and validate the plan without uploading or inserting
`)
}

function executeJson<T = Array<Record<string, unknown>>>(
  databaseName: string,
  location: LocationFlag,
  sql: string,
) {
  const output = runCommand(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', databaseName, location, '--command', sql, '--json'],
    { cwd: WEB_DIR },
  )

  return JSON.parse(output) as Array<{
    results?: T
    success?: boolean
    meta?: Record<string, unknown>
  }>
}

function executeSql(databaseName: string, location: LocationFlag, sql: string) {
  runCommand(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', databaseName, location, '--command', sql],
    {
      cwd: WEB_DIR,
      stdio: 'inherit',
    },
  )
}

async function loadManifest(manifestPath: string) {
  const content = await fs.readFile(manifestPath, 'utf8')
  return JSON.parse(content) as ExportManifest
}

function fetchVessel(databaseName: string, location: LocationFlag, vesselSlug: string) {
  const escapedSlug = escapeSql(vesselSlug)
  const rows = executeJson<Array<VesselRow>>(
    databaseName,
    location,
    `SELECT id, slug FROM vessels WHERE slug = '${escapedSlug}' LIMIT 1;`,
  )

  const vessel = rows[0]?.results?.[0]
  if (!vessel) {
    throw new Error(`Vessel ${vesselSlug} was not found in ${databaseName} (${location}).`)
  }

  return vessel
}

function fetchPassageIds(databaseName: string, location: LocationFlag, vesselId: string) {
  const escapedVesselId = escapeSql(vesselId)
  const rows = executeJson<Array<{ id: string }>>(
    databaseName,
    location,
    `SELECT id FROM passages WHERE vessel_id = '${escapedVesselId}';`,
  )

  return new Set((rows[0]?.results || []).map((row) => row.id))
}

async function readFileMetadata(
  filePath: string,
  fallbackCapturedAt: string,
): Promise<FileMetadata> {
  try {
    const raw = runCommand(
      '/usr/bin/mdls',
      [
        '-raw',
        '-name',
        'kMDItemContentCreationDate',
        '-name',
        'kMDItemLatitude',
        '-name',
        'kMDItemLongitude',
        filePath,
      ],
      { encoding: 'utf-8' },
    )

    const values = raw
      .split('\0')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    const capturedAt = normalizeCapturedAt(values[0] || fallbackCapturedAt)
    const lat = normalizeCoordinate(values[1])
    const lng = normalizeCoordinate(values[2])
    return { capturedAt, lat, lng }
  } catch {
    return {
      capturedAt: normalizeCapturedAt(fallbackCapturedAt),
      lat: null,
      lng: null,
    }
  }
}

function normalizeCapturedAt(value: string | undefined) {
  if (!value || value === '(null)' || value === 'null') {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function normalizeCoordinate(value: string | undefined) {
  if (!value || value === '(null)' || value === 'null') {
    return null
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sanitizeObjectComponent(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || randomUUID()
}

function stripExtension(filename: string) {
  const parsed = path.parse(filename)
  return parsed.name || filename
}

function detectContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.avif':
      return 'image/avif'
    case '.heic':
      return 'image/heic'
    case '.heif':
      return 'image/heif'
    default:
      return 'application/octet-stream'
  }
}

function buildObjectKey(vesselSlug: string, sourceAssetId: string, originalFilename: string) {
  const extension =
    path.extname(originalFilename).toLowerCase() || path.extname(sourceAssetId).toLowerCase()
  const assetComponent = sanitizeObjectComponent(sourceAssetId)
  const filenameComponent = sanitizeObjectComponent(stripExtension(originalFilename))
  return `uploads/${sanitizeObjectComponent(vesselSlug)}/${assetComponent}-${filenameComponent}${extension}`
}

function buildSourceFingerprint(sourceAssetId: string) {
  return `apple-photos-export:${sourceAssetId}`
}

function escapeSql(value: string) {
  return value.replaceAll("'", "''")
}

function sqlString(value: string | null) {
  if (value === null) {
    return 'NULL'
  }

  return `'${escapeSql(value)}'`
}

function sqlNumber(value: number | null) {
  return value === null ? 'NULL' : String(value)
}

function sqlBoolean(value: boolean) {
  return value ? '1' : '0'
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function uploadToR2(
  bucketName: string,
  location: LocationFlag,
  objectKey: string,
  filePath: string,
) {
  const contentType = detectContentType(filePath)
  runCommand(
    'pnpm',
    [
      'exec',
      'wrangler',
      'r2',
      'object',
      'put',
      `${bucketName}/${objectKey}`,
      location,
      '--file',
      filePath,
      '--content-type',
      contentType,
    ],
    {
      cwd: WEB_DIR,
      stdio: 'pipe',
    },
  )
}

async function buildImportRecords(manifest: ExportManifest, vesselSlug: string, limit?: number) {
  const records = limit ? manifest.exportedPhotos.slice(0, limit) : manifest.exportedPhotos
  const importRecords: ImportRecord[] = []

  for (const [index, photo] of records.entries()) {
    const metadata = await readFileMetadata(photo.exportedPath, photo.capturedAt)
    const objectKey = buildObjectKey(vesselSlug, photo.sourceAssetId, photo.originalFilename)
    importRecords.push({
      mediaId: randomUUID(),
      passageId: photo.passageId,
      title: stripExtension(photo.originalFilename),
      imageUrl: `/images/${objectKey}`,
      sourceAssetId: photo.sourceAssetId,
      sourceFingerprint: buildSourceFingerprint(photo.sourceAssetId),
      matchStatus: photo.matchStatus === 'review' ? 'review' : 'attached',
      matchReason: photo.matchReason || null,
      capturedAt: metadata.capturedAt,
      lat: metadata.lat,
      lng: metadata.lng,
      filePath: photo.exportedPath,
      objectKey,
    })

    if ((index + 1) % 50 === 0 || index === records.length - 1) {
      console.log(`Prepared metadata ${index + 1}/${records.length}`)
    }
  }

  return importRecords
}

function buildInsertStatements(vesselId: string, records: ImportRecord[]) {
  return chunk(records, 100).map((batch) => {
    const values = batch
      .map(
        (record) =>
          `(${[
            sqlString(record.mediaId),
            sqlString(vesselId),
            sqlString(record.passageId),
            sqlString(record.title),
            'NULL',
            sqlString(record.imageUrl),
            sqlBoolean(record.matchStatus === 'attached'),
            sqlString('apple_photos_seed'),
            sqlString(record.sourceAssetId),
            sqlString(record.sourceFingerprint),
            sqlString(record.matchStatus),
            'NULL',
            sqlString(record.matchReason),
            '0',
            sqlNumber(record.lat),
            sqlNumber(record.lng),
            sqlString(record.capturedAt),
            sqlString(new Date().toISOString()),
          ].join(', ')})`,
      )
      .join(',\n')

    return `INSERT OR IGNORE INTO media_items (
  id,
  vessel_id,
  passage_id,
  title,
  caption,
  image_url,
  share_public,
  source_kind,
  source_asset_id,
  source_fingerprint,
  match_status,
  match_score,
  match_reason,
  is_cover,
  lat,
  lng,
  captured_at,
  created_at
) VALUES
${values};`
  })
}

async function main() {
  const args = parseArgs(process.argv)
  const manifest = await loadManifest(args.manifestPath)
  const vesselSlug = args.vesselSlug || manifest.vesselSlug
  const vessel = fetchVessel(args.databaseName, args.location, vesselSlug)
  const validPassageIds = fetchPassageIds(args.databaseName, args.location, vessel.id)
  const records = await buildImportRecords(manifest, vesselSlug, args.limit)

  const missingPassageIds = records.reduce<string[]>((accumulator, record) => {
    if (record.passageId && !validPassageIds.has(record.passageId)) {
      accumulator.push(record.passageId)
    }
    return accumulator
  }, [])

  if (missingPassageIds.length) {
    throw new Error(
      `Manifest references passage ids that are not present on vessel ${vesselSlug}: ${Array.from(
        new Set(missingPassageIds),
      ).join(', ')}`,
    )
  }

  console.log(
    `Import plan ready: ${records.length} photo(s) for vessel ${vessel.slug} (${vessel.id}) into ${args.databaseName} ${args.location}.`,
  )

  if (args.dryRun) {
    console.log('Dry run enabled. Skipping R2 upload and D1 insert.')
    return
  }

  for (const [index, record] of records.entries()) {
    uploadToR2(args.bucketName, args.location, record.objectKey, record.filePath)
    if ((index + 1) % 25 === 0 || index === records.length - 1) {
      console.log(`Uploaded ${index + 1}/${records.length} object(s) to R2`)
    }
  }

  const statements = buildInsertStatements(vessel.id, records)
  for (const [index, statement] of statements.entries()) {
    // Cloudflare's remote D1 endpoint rejects explicit BEGIN/COMMIT wrappers.
    // Each INSERT OR IGNORE batch is already a single statement.
    executeSql(args.databaseName, args.location, statement)
    console.log(`Inserted batch ${index + 1}/${statements.length}`)
  }

  console.log(`Inserted media rows for ${records.length} photo(s).`)
  console.log(`Site URL: ${args.siteUrl}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`import-exported-photos: ${message}`)
  process.exit(1)
})
