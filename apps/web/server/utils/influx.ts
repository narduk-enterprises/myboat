import type { H3Event } from 'h3'
import { useLogger } from '#layer/server/utils/logger'

type InfluxConfig = {
  bucketCoreFree: string
  bucketCorePaid: string
  bucketCoreRollup1h: string
  bucketDebug: string
  bucketDetailFree: string
  bucketDetailPaid: string
  bucketDetailRollup1h: string
  legacyBucket: string
  org: string
  queryToken: string
  queryUrl: string
  writeToken: string
  writeUrl: string
}

export type InfluxHistoryAccessTier = 'free' | 'paid'
export type InfluxHistoryBucketKind = 'core' | 'debug' | 'detail'
export type InfluxHistoryStorageMode = 'raw' | 'rollup'

function escapeInfluxKey(value: string) {
  return value.replaceAll(/([, =])/g, '\\$1')
}

function escapeInfluxString(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function parseInfluxCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      const next = line[index + 1]
      if (quoted && next === '"') {
        current += '"'
        index += 1
        continue
      }

      quoted = !quoted
      continue
    }

    if (char === ',' && !quoted) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function buildInfluxApiUrl(input: {
  baseUrl: string
  pathname: '/api/v2/query' | '/api/v2/write'
}) {
  const url = new URL(input.baseUrl)

  if (!url.pathname || url.pathname === '/') {
    url.pathname = input.pathname
    return url
  }

  if (url.pathname.endsWith('/api/v2/query') || url.pathname.endsWith('/api/v2/write')) {
    url.pathname = input.pathname
    return url
  }

  if (!url.pathname.endsWith(input.pathname)) {
    url.pathname = input.pathname
  }

  return url
}

export function getInfluxConfig(event: H3Event): InfluxConfig | null {
  const config = useRuntimeConfig(event)
  const writeUrl = config.influxWriteUrl?.trim() || ''
  const queryUrl = config.influxQueryUrl?.trim() || writeUrl
  const org = config.influxOrg?.trim() || ''
  const legacyBucket = config.influxBucket?.trim() || ''
  const writeToken = config.influxToken?.trim() || ''
  const queryToken = config.influxQueryToken?.trim() || writeToken

  if (!writeUrl || !queryUrl || !org || !writeToken || !queryToken) {
    return null
  }

  return {
    bucketCoreFree: config.influxBucketCoreFree?.trim() || legacyBucket,
    bucketCorePaid:
      config.influxBucketCorePaid?.trim() || config.influxBucketCoreFree?.trim() || legacyBucket,
    bucketCoreRollup1h: config.influxBucketCoreRollup1h?.trim() || '',
    bucketDebug: config.influxBucketDebug?.trim() || legacyBucket,
    bucketDetailFree: config.influxBucketDetailFree?.trim() || '',
    bucketDetailPaid:
      config.influxBucketDetailPaid?.trim() || config.influxBucketDetailFree?.trim() || '',
    bucketDetailRollup1h: config.influxBucketDetailRollup1h?.trim() || '',
    legacyBucket,
    writeUrl,
    queryUrl,
    org,
    queryToken,
    writeToken,
  }
}

export function encodeInfluxLine(input: {
  measurement: string
  tags?: Record<string, string | null | undefined>
  fields: Record<string, boolean | number | string>
  timestampMs: number
}) {
  const tags = Object.entries(input.tags || {})
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([key, value]) => `,${escapeInfluxKey(key)}=${escapeInfluxKey(value!)}`)
    .join('')

  const fields = Object.entries(input.fields)
    .map(([key, value]) => {
      if (typeof value === 'number') {
        return `${escapeInfluxKey(key)}=${Number.isFinite(value) ? value : 0}`
      }

      if (typeof value === 'boolean') {
        return `${escapeInfluxKey(key)}=${value ? 'true' : 'false'}`
      }

      return `${escapeInfluxKey(key)}="${escapeInfluxString(value)}"`
    })
    .join(',')

  return `${escapeInfluxKey(input.measurement)}${tags} ${fields} ${input.timestampMs}`
}

function resolveRawHistoryBucket(
  config: InfluxConfig,
  kind: InfluxHistoryBucketKind,
  accessTier: InfluxHistoryAccessTier,
) {
  if (kind === 'debug') {
    return config.bucketDebug || config.legacyBucket
  }

  if (kind === 'core') {
    if (accessTier === 'paid') {
      return config.bucketCorePaid || config.bucketCoreFree || config.legacyBucket
    }

    return config.bucketCoreFree || config.bucketCorePaid || config.legacyBucket
  }

  if (accessTier === 'paid') {
    return (
      config.bucketDetailPaid ||
      config.bucketDetailFree ||
      config.bucketCorePaid ||
      config.bucketCoreFree ||
      config.legacyBucket
    )
  }

  return (
    config.bucketDetailFree ||
    config.bucketDetailPaid ||
    config.bucketCoreFree ||
    config.bucketCorePaid ||
    config.legacyBucket
  )
}

export function resolveInfluxHistoryBucket(
  config: InfluxConfig,
  input: {
    accessTier: InfluxHistoryAccessTier
    kind: InfluxHistoryBucketKind
    storageMode: InfluxHistoryStorageMode
  },
) {
  if (input.storageMode === 'raw') {
    return resolveRawHistoryBucket(config, input.kind, input.accessTier)
  }

  if (input.kind === 'detail') {
    return (
      config.bucketDetailRollup1h || resolveRawHistoryBucket(config, input.kind, input.accessTier)
    )
  }

  if (input.kind === 'core') {
    return (
      config.bucketCoreRollup1h || resolveRawHistoryBucket(config, input.kind, input.accessTier)
    )
  }

  return resolveRawHistoryBucket(config, input.kind, input.accessTier)
}

async function postInfluxLines(
  config: InfluxConfig,
  input: {
    bucket: string
    lines: string[]
    signal?: AbortSignal
  },
) {
  const url = buildInfluxApiUrl({
    baseUrl: config.writeUrl,
    pathname: '/api/v2/write',
  })
  url.searchParams.set('org', config.org)
  url.searchParams.set('bucket', input.bucket)
  url.searchParams.set('precision', 'ms')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.writeToken}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: input.lines.join('\n'),
    signal: input.signal,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Influx write failed (${response.status}): ${body || 'empty response'}`)
  }
}

export async function writeInfluxTargets(
  event: H3Event,
  targets: Array<{ bucket: string; lines: string[] }>,
  options?: { signal?: AbortSignal },
) {
  const activeTargets = targets.filter(
    (target) => target.bucket.trim().length > 0 && target.lines.length > 0,
  )

  if (!activeTargets.length) {
    return
  }

  const logger = useLogger(event).child('Influx')
  const config = getInfluxConfig(event)

  if (!config) {
    const runtimeConfig = useRuntimeConfig(event)
    logger.warn('Skipping write because Influx configuration is incomplete.', {
      hasOrg: Boolean(runtimeConfig.influxOrg?.trim()),
      hasQueryToken: Boolean(runtimeConfig.influxQueryToken?.trim()),
      hasQueryUrl: Boolean(runtimeConfig.influxQueryUrl?.trim()),
      hasWriteToken: Boolean(runtimeConfig.influxToken?.trim()),
      hasWriteUrl: Boolean(runtimeConfig.influxWriteUrl?.trim()),
    })
    return
  }

  const results = await Promise.allSettled(
    activeTargets.map((target) =>
      postInfluxLines(config, {
        bucket: target.bucket,
        lines: target.lines,
        signal: options?.signal,
      }),
    ),
  )

  const failedIndex = results.findIndex((result) => result.status === 'rejected')
  if (failedIndex < 0) {
    return
  }

  const failedResult = results[failedIndex]
  if (failedResult?.status !== 'rejected') {
    return
  }

  const failedTarget = activeTargets[failedIndex]
  logger.warn('Influx write target failed.', {
    bucket: failedTarget?.bucket,
    error:
      failedResult.reason instanceof Error
        ? failedResult.reason.message
        : String(failedResult.reason),
    lineCount: failedTarget?.lines.length || 0,
  })

  throw failedResult.reason
}

export async function runInfluxCsvQuery<TRecord extends Record<string, string>>(
  event: H3Event,
  fluxQuery: string,
) {
  const logger = useLogger(event).child('Influx')
  const config = getInfluxConfig(event)

  if (!config) {
    logger.debug('Skipping query because Influx is not configured.')
    return [] as TRecord[]
  }

  const url = buildInfluxApiUrl({
    baseUrl: config.queryUrl,
    pathname: '/api/v2/query',
  })
  url.searchParams.set('org', config.org)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/csv',
      Authorization: `Token ${config.queryToken}`,
      'Content-Type': 'application/vnd.flux',
    },
    body: fluxQuery,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Influx query failed (${response.status}): ${body || 'empty response'}`)
  }

  const csv = await response.text()
  const lines = csv.split(/\r?\n/).filter(Boolean)
  const headerLine = lines.find((line) => !line.startsWith('#'))
  if (!headerLine) {
    return [] as TRecord[]
  }

  const header = parseInfluxCsvLine(headerLine)
  const headerIndex = lines.indexOf(headerLine)
  const records: TRecord[] = []

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line || line.startsWith('#')) {
      continue
    }

    const values = parseInfluxCsvLine(line)
    const record = Object.fromEntries(
      header.map((column, index) => [column, values[index] || '']),
    ) as TRecord
    records.push(record)
  }

  return records
}
