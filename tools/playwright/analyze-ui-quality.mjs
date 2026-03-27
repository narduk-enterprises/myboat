import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(process.argv[2] || 'output/playwright/ui-quality')
const summaryPath = path.join(rootDir, 'summary.json')
const markdownPath = path.join(rootDir, 'summary.md')
const manifestPath = path.join(rootDir, 'manifest.json')

if (!existsSync(rootDir)) {
  console.error(`UI quality root does not exist: ${rootDir}`)
  process.exit(1)
}

let sharpModule
try {
  sharpModule = await import('sharp')
} catch (error) {
  console.error('Failed to load sharp for UI quality analysis.')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const sharp = sharpModule.default

function walkPngs(directory) {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkPngs(absolutePath))
      continue
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      files.push(absolutePath)
    }
  }

  return files.sort()
}

function average(values) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toRelative(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, '/')
}

const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
const screenshots = walkPngs(rootDir)
const screenshotStats = new Map()
const failures = []
const warnings = []
const screenshotSummaries = []
let fullPageCount = 0

for (const file of screenshots) {
  const relativePath = toRelative(file)
  const image = sharp(file)
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()])
  const width = metadata.width || 0
  const height = metadata.height || 0
  const fileSizeBytes = statSync(file).size
  const mean = average(stats.channels.map((channel) => channel.mean))
  const stdev = average(stats.channels.map((channel) => channel.stdev))
  const isFullPage =
    relativePath.includes('page-full') ||
    relativePath.includes('full-page') ||
    relativePath.includes('full.png')

  if (isFullPage) {
    fullPageCount += 1
  }

  if (width < 160 || height < 100) {
    failures.push(`${relativePath} is unexpectedly small (${width}x${height})`)
  }

  if (isFullPage && stdev < 6) {
    failures.push(`${relativePath} looks visually flat (avg channel stdev ${stdev.toFixed(2)})`)
  } else if (!isFullPage && stdev < 3) {
    warnings.push(`${relativePath} has low visual variance (avg channel stdev ${stdev.toFixed(2)})`)
  }

  if (isFullPage && fileSizeBytes < 40_000) {
    failures.push(`${relativePath} is unusually small on disk (${fileSizeBytes} bytes)`)
  }

  const summary = {
    path: relativePath,
    width,
    height,
    fileSizeBytes,
    mean: Number(mean.toFixed(2)),
    avgChannelStdev: Number(stdev.toFixed(2)),
    isFullPage,
  }

  screenshotStats.set(relativePath, summary)
  screenshotSummaries.push(summary)
}

if (manifest?.minimumScreenshotCount && screenshots.length < manifest.minimumScreenshotCount) {
  failures.push(
    `Expected at least ${manifest.minimumScreenshotCount} screenshots but found ${screenshots.length}`,
  )
}

if (manifest?.minimumFullPageCount && fullPageCount < manifest.minimumFullPageCount) {
  failures.push(
    `Expected at least ${manifest.minimumFullPageCount} full-page screenshots but found ${fullPageCount}`,
  )
}

for (const critical of manifest?.criticalScreenshots || []) {
  const screenshot = screenshotStats.get(critical.path)

  if (!screenshot) {
    failures.push(`Missing critical screenshot ${critical.path}`)
    continue
  }

  if (
    typeof critical.minAvgChannelStdev === 'number' &&
    screenshot.avgChannelStdev < critical.minAvgChannelStdev
  ) {
    failures.push(
      `${critical.path} fell below the critical variance floor (${screenshot.avgChannelStdev.toFixed(2)} < ${critical.minAvgChannelStdev.toFixed(2)})`,
    )
  }

  if (typeof critical.minBytes === 'number' && screenshot.fileSizeBytes < critical.minBytes) {
    failures.push(
      `${critical.path} fell below the critical byte floor (${screenshot.fileSizeBytes} < ${critical.minBytes})`,
    )
  }
}

const score = Math.max(0, 100 - failures.length * 20 - warnings.length * 5)

const summary = {
  generatedAt: new Date().toISOString(),
  rootDir,
  app: manifest?.app || 'unknown',
  score,
  screenshotCount: screenshots.length,
  fullPageCount,
  failures,
  warnings,
  screenshots: screenshotSummaries,
}

writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

const markdownLines = [
  '# UI Quality Summary',
  '',
  `- App: ${summary.app}`,
  `- Score: ${summary.score}`,
  `- Screenshots: ${summary.screenshotCount}`,
  `- Full-page screenshots: ${summary.fullPageCount}`,
  `- Failures: ${summary.failures.length}`,
  `- Warnings: ${summary.warnings.length}`,
  '',
]

if (summary.failures.length > 0) {
  markdownLines.push('## Failures', '')
  for (const failure of summary.failures) {
    markdownLines.push(`- ${failure}`)
  }
  markdownLines.push('')
}

if (summary.warnings.length > 0) {
  markdownLines.push('## Warnings', '')
  for (const warning of summary.warnings) {
    markdownLines.push(`- ${warning}`)
  }
  markdownLines.push('')
}

writeFileSync(markdownPath, `${markdownLines.join('\n')}\n`, 'utf8')

console.log(JSON.stringify(summary, null, 2))

if (summary.failures.length > 0) {
  process.exit(1)
}
