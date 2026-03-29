import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { WebSocketServer } from 'ws'

type ReceivedRequest = {
  body: string
  headers: IncomingMessage['headers']
  method: string
  path: string
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  label: string,
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return
    }

    await delay(100)
  }

  throw new Error(`Timed out waiting for ${label}`)
}

describe('edge collector runtime', () => {
  let collectorProcess: ChildProcessWithoutNullStreams | null = null
  let signalKServer: ReturnType<typeof createServer> | null = null
  let ingestServer: ReturnType<typeof createServer> | null = null
  let signalKWsServer: WebSocketServer | null = null
  let collectorLogs = ''
  let signalKBaseUrl = ''
  let signalKWsUrl = ''
  let ingestBaseUrl = ''
  let collectorHealthUrl = ''
  const deltaRequests: ReceivedRequest[] = []
  const identityRequests: ReceivedRequest[] = []
  const sourceRequests: ReceivedRequest[] = []
  let deltaPostCount = 0

  before(async () => {
    signalKServer = createServer((request: IncomingMessage, response: ServerResponse) => {
      if (request.url === '/signalk/v1/api/sources') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(
          JSON.stringify({
            'ydg-nmea-0183.YD': { label: '0183 YD' },
            'ydg-nmea-2000.74': { label: 'N2K GPS' },
          }),
        )
        return
      }

      if (request.url === '/signalk/v1/api/vessels/self') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(
          JSON.stringify({
            name: { value: 'North Star' },
            communication: { callsignVhf: { value: 'WDC8821' } },
            design: {
              type: { value: 'Bluewater cutter' },
              length: { overall: { value: 12.3 } },
              beam: { value: 4.1 },
            },
            registrations: {
              mmsi: { value: '123456789' },
            },
          }),
        )
        return
      }

      response.writeHead(404)
      response.end('not found')
    })

    signalKWsServer = new WebSocketServer({ server: signalKServer, path: '/signalk/v1/stream' })
    signalKWsServer.on('connection', (client) => {
      client.send(
        JSON.stringify({
          name: 'Mock SignalK',
          self: 'vessels.self',
          version: '1.0.0-test',
        }),
      )

      setTimeout(() => {
        client.send(
          JSON.stringify({
            context: 'vessels.self',
            updates: [
              {
                $source: 'ydg-nmea-0183.YD',
                timestamp: new Date().toISOString(),
                values: [
                  {
                    path: 'navigation.speedOverGround',
                    value: 6.0,
                  },
                ],
              },
              {
                $source: 'ydg-nmea-2000.74',
                source: { label: 'N2K GPS' },
                timestamp: new Date().toISOString(),
                values: [
                  {
                    path: 'navigation.position',
                    value: { latitude: 29.5, longitude: -95.1 },
                  },
                  {
                    path: 'navigation.speedOverGround',
                    value: 6.2,
                  },
                ],
              },
            ],
          }),
        )
      }, 100)
    })

    signalKServer.listen(0, '127.0.0.1')
    await once(signalKServer, 'listening')
    const signalKAddress = signalKServer.address()
    assert(signalKAddress && typeof signalKAddress === 'object')
    signalKBaseUrl = `http://127.0.0.1:${signalKAddress.port}/signalk/v1/api`
    signalKWsUrl = `ws://127.0.0.1:${signalKAddress.port}/signalk/v1/stream`

    ingestServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }

      const body = Buffer.concat(chunks).toString('utf8')
      const record: ReceivedRequest = {
        body,
        headers: request.headers,
        method: request.method || 'GET',
        path: request.url || '/',
      }

      if (request.url === '/api/ingest/v1/identity') {
        identityRequests.push(record)
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: true }))
        return
      }

      if (request.url === '/api/ingest/v1/sources') {
        sourceRequests.push(record)
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: true }))
        return
      }

      if (request.url === '/api/ingest/v1/delta') {
        deltaRequests.push(record)
        deltaPostCount += 1
        if (deltaPostCount === 1) {
          response.writeHead(429, { 'retry-after': '0' })
          response.end('slow down')
          return
        }

        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: true }))
        return
      }

      response.writeHead(404)
      response.end('not found')
    })

    ingestServer.listen(0, '127.0.0.1')
    await once(ingestServer, 'listening')
    const ingestAddress = ingestServer.address()
    assert(ingestAddress && typeof ingestAddress === 'object')
    ingestBaseUrl = `http://127.0.0.1:${ingestAddress.port}`

    const streamPort = 4019
    collectorHealthUrl = `http://127.0.0.1:${streamPort}/healthz`
    collectorProcess = spawn('node', ['--import', 'tsx', 'src/index.ts'], {
      cwd: '/Users/narduk/new-code/template-apps/myboat/apps/edge-collector',
      env: {
        ...process.env,
        COLLECTOR_429_BACKOFF_MS: '200',
        COLLECTOR_BATCH_SIZE: '10',
        COLLECTOR_FLUSH_INTERVAL_MS: '100',
        COLLECTOR_IDENTITY_REFRESH_INTERVAL_MS: '10000',
        COLLECTOR_MAX_BUFFER_ITEMS: '10',
        COLLECTOR_MAX_POST_ITEMS: '10',
        COLLECTOR_MIN_POST_INTERVAL_MS: '50',
        COLLECTOR_RECONNECT_DELAY_MS: '200',
        COLLECTOR_REQUEST_TIMEOUT_MS: '2000',
        MYBOAT_IDENTITY_INGEST_URL: `${ingestBaseUrl}/api/ingest/v1/identity`,
        MYBOAT_INGEST_KEY: 'nk_test_edge_collector',
        MYBOAT_INGEST_URL: `${ingestBaseUrl}/api/ingest/v1/delta`,
        MYBOAT_STREAM_PATH: '/myboat/v1/stream',
        MYBOAT_STREAM_PORT: String(streamPort),
        SIGNALK_HTTP_URL: signalKBaseUrl,
        SIGNALK_WS_URL: signalKWsUrl,
      },
      stdio: 'pipe',
    })

    collectorProcess.stdout.on('data', (chunk) => {
      collectorLogs += chunk.toString('utf8')
    })
    collectorProcess.stderr.on('data', (chunk) => {
      collectorLogs += chunk.toString('utf8')
    })

    await waitFor(
      async () => {
        try {
          const response = await fetch(collectorHealthUrl)
          return response.ok
        } catch {
          return false
        }
      },
      10_000,
      'collector health endpoint',
    )
  })

  after(async () => {
    if (collectorProcess && !collectorProcess.killed) {
      collectorProcess.kill('SIGTERM')
      await once(collectorProcess, 'exit')
    }

    await Promise.all([
      new Promise<void>((resolve) => signalKWsServer?.close(() => resolve())),
      new Promise<void>((resolve) => signalKServer?.close(() => resolve())),
      new Promise<void>((resolve) => ingestServer?.close(() => resolve())),
    ])
  })

  it('deduplicates upstream telemetry, posts source inventory, and exposes useful health stats', async () => {
    await waitFor(() => identityRequests.length >= 1, 10_000, 'identity POST')
    await waitFor(() => sourceRequests.length >= 1, 10_000, 'sources POST')
    await waitFor(() => deltaRequests.length >= 2, 10_000, 'delta POST retry')
    await waitFor(
      async () => {
        try {
          const healthResponse = await fetch(collectorHealthUrl)
          if (!healthResponse.ok) {
            return false
          }

          const health = (await healthResponse.json()) as Record<string, unknown>
          return Number(health.postedItems || 0) >= 2
        } catch {
          return false
        }
      },
      10_000,
      'collector debug telemetry flush',
    )

    const response = await fetch(collectorHealthUrl)
    assert.equal(response.ok, true, collectorLogs)
    const health = (await response.json()) as Record<string, unknown>
    const postedDeltaItems = deltaRequests.flatMap((request) => {
      const payload = JSON.parse(request.body || '{}') as {
        deltas?: Array<{
          debugOnly?: boolean
          delta: {
            updates: Array<{
              $source?: string
              dropReason?: string
              values: Array<{ path: string; value: unknown }>
            }>
          }
        }>
      }

      return payload.deltas || []
    })
    const selectedPayload = postedDeltaItems.find((item) => item.debugOnly !== true)
    const debugPayload = postedDeltaItems.find((item) => item.debugOnly === true)
    const sourcePayload = JSON.parse(sourceRequests[0]?.body || '{}') as {
      publisherRole?: string
      selfContext?: string
      sourceCount?: number
      sources?: Array<{ sourceId: string }>
    }

    const selectedUpdate = selectedPayload?.delta.updates.find((update) => update.$source)

    assert.equal(deltaRequests.length >= 2, true, collectorLogs)
    assert.equal(identityRequests.length >= 1, true, collectorLogs)
    assert.equal(sourceRequests.length >= 1, true, collectorLogs)
    assert.equal(sourcePayload.publisherRole, 'primary')
    assert.equal(sourcePayload.selfContext, 'vessels.self')
    assert.equal(Number(sourcePayload.sourceCount || 0) >= 2, true)
    assert.equal(Number(sourcePayload.sources?.length || 0) >= 2, true)
    assert.equal(selectedUpdate?.$source, 'ydg-nmea-2000.74')
    assert.equal(
      selectedUpdate?.values.some((value) => value.path === 'navigation.speedOverGround'),
      true,
    )
    assert.equal(Boolean(debugPayload), true)
    assert.equal(
      debugPayload?.delta.updates.some((update) => update.$source === 'ydg-nmea-0183.YD'),
      true,
    )
    assert.equal(health.ok, true)
    assert.equal(health.connectedToSignalK, true)
    assert.equal(health.rateLimitCount, 1)
    assert.equal(health.postedBatches, 1)
    assert.equal(health.postedItems, 2)
    assert.equal(health.identityRefreshSuccesses, 1)
    assert.equal(health.sourceInventoryRefreshSuccesses, 1)
    assert.equal(health.sourceCandidatesSeen, 4)
    assert.equal(health.sourceWinnersKept, 3)
    assert.equal(health.sourceLosersDropped, 1)
    assert.equal(health.ingestFailures, 1)
    assert.equal(health.pendingBatchItems, 0)
    assert.equal(health.signalkSelfContext, 'vessels.self')
  })
})
