import type { H3Event } from 'h3'
import { useLogger } from '#layer/server/utils/logger'

type InfluxWriteConfig = {
  writeUrl: string
  org: string
  bucket: string
  token: string
}

function escapeInfluxKey(value: string) {
  return value.replaceAll(/([, =])/g, '\\$1')
}

function escapeInfluxString(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function getInfluxConfig(event: H3Event): InfluxWriteConfig | null {
  const config = useRuntimeConfig(event)
  const writeUrl = config.influxWriteUrl?.trim() || ''
  const org = config.influxOrg?.trim() || ''
  const bucket = config.influxBucket?.trim() || ''
  const token = config.influxToken?.trim() || ''

  if (!writeUrl || !org || !bucket || !token) {
    return null
  }

  return {
    writeUrl,
    org,
    bucket,
    token,
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

export async function writeTelemetryToInflux(
  event: H3Event,
  lines: string[],
  options?: { signal?: AbortSignal },
) {
  if (!lines.length) {
    return
  }

  const logger = useLogger(event).child('Influx')
  const config = getInfluxConfig(event)

  if (!config) {
    logger.debug('Skipping write because Influx is not configured.')
    return
  }

  const url = new URL(config.writeUrl)
  url.searchParams.set('org', config.org)
  url.searchParams.set('bucket', config.bucket)
  url.searchParams.set('precision', 'ms')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.token}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: lines.join('\n'),
    signal: options?.signal,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Influx write failed (${response.status}): ${body || 'empty response'}`)
  }
}
