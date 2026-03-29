import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { apiKeys } from '#layer/server/database/schema'
import { useLogger } from '#layer/server/utils/logger'
import { defineWebhookMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import {
  vesselInstallationApiKeys,
  vesselInstallations,
  vesselLiveSnapshots,
} from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import { writeTelemetryToInflux } from '#server/utils/influx'
import { publishVesselLiveMessage } from '#server/utils/liveBroker'
import {
  type IngestDelta,
  buildInfluxLines,
  buildLivePublishMessage,
  resolveObservedAt,
} from '#server/utils/telemetry'
import type { VesselLivePublishMessage } from '../../../../shared/myboatLive'

const deltaSchema = z.object({
  context: z.string().optional(),
  self: z.string().optional(),
  updates: z.array(
    z.object({
      timestamp: z.string().optional(),
      values: z.array(
        z.object({
          path: z.string(),
          value: z.unknown(),
        }),
      ),
    }),
  ),
})

const ingestItemSchema = z.object({
  timestamp: z.string().datetime().optional(),
  delta: deltaSchema,
})

const ingestSchema = z.union([
  ingestItemSchema,
  z.object({
    timestamp: z.string().datetime().optional(),
    deltas: z.array(ingestItemSchema).min(1),
  }),
])

type IngestRequestBody = z.infer<typeof ingestSchema>
type NormalizedIngestItem = {
  timestamp?: string
  delta: IngestDelta
}

function normalizeIngestItems(body: IngestRequestBody): NormalizedIngestItem[] {
  if ('deltas' in body) {
    return body.deltas.map((item) => ({
      timestamp: item.timestamp || body.timestamp,
      delta: item.delta,
    }))
  }

  return [
    {
      timestamp: body.timestamp,
      delta: body.delta,
    },
  ]
}

function getObservedAtMs(observedAt: string) {
  const observedAtMs = Date.parse(observedAt)
  return Number.isFinite(observedAtMs) ? observedAtMs : Number.NEGATIVE_INFINITY
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export default defineWebhookMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authApiKeys,
    parseBody: withValidatedBody(ingestSchema.parse),
  },
  async ({ event, body }) => {
    const logger = useLogger(event).child('TelemetryIngest')
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw createError({ statusCode: 401, message: 'Missing ingest bearer token.' })
    }

    const rawKey = authHeader.slice(7).trim()
    const db = useAppDatabase(event)
    const keyHash = await sha256(rawKey)

    const installationBinding = await db
      .select({
        apiKeyId: apiKeys.id,
        installationId: vesselInstallationApiKeys.installationId,
        vesselId: vesselInstallations.vesselId,
        installationType: vesselInstallations.installationType,
        isPrimary: vesselInstallations.isPrimary,
      })
      .from(apiKeys)
      .innerJoin(vesselInstallationApiKeys, eq(apiKeys.id, vesselInstallationApiKeys.apiKeyId))
      .innerJoin(
        vesselInstallations,
        eq(vesselInstallationApiKeys.installationId, vesselInstallations.id),
      )
      .where(eq(apiKeys.keyHash, keyHash))
      .get()

    if (!installationBinding) {
      throw createError({ statusCode: 401, message: 'Invalid ingest key.' })
    }

    const ingestItems = normalizeIngestItems(body)
    const now = new Date().toISOString()
    const aggregatedAisContacts = new Map<string, NonNullable<VesselLivePublishMessage['aisContacts']>[number]>()
    const influxLines: string[] = []
    let latestObservedAt: string | null = null
    let latestObservedAtMs = Number.NEGATIVE_INFINITY
    let latestSnapshot: VesselLivePublishMessage['snapshot']
    let latestSnapshotObservedAt: string | null = null
    let latestSnapshotObservedAtMs = Number.NEGATIVE_INFINITY

    for (const item of ingestItems) {
      const observedAt = resolveObservedAt(item.timestamp, item.delta)
      const observedAtMs = getObservedAtMs(observedAt)

      if (observedAtMs >= latestObservedAtMs) {
        latestObservedAtMs = observedAtMs
        latestObservedAt = observedAt
      }

      const livePayload = buildLivePublishMessage({
        delta: item.delta,
        observedAt,
        vesselId: installationBinding.vesselId,
        source: installationBinding.installationType,
        connectionState: 'live',
      })

      if (livePayload.snapshot && observedAtMs >= latestSnapshotObservedAtMs) {
        latestSnapshotObservedAtMs = observedAtMs
        latestSnapshotObservedAt = observedAt
        latestSnapshot = livePayload.snapshot
      }

      for (const contact of livePayload.aisContacts || []) {
        aggregatedAisContacts.set(contact.id, contact)
      }

      influxLines.push(
        ...buildInfluxLines({
          delta: item.delta,
          observedAt,
          installationId: installationBinding.installationId,
          vesselId: installationBinding.vesselId,
        }),
      )
    }

    const livePayload: VesselLivePublishMessage = {
      type: 'telemetry',
      connectionState: 'live',
      lastObservedAt: latestObservedAt,
    }

    if (latestSnapshot !== undefined) {
      livePayload.snapshot = latestSnapshot
    }

    if (aggregatedAisContacts.size) {
      livePayload.aisContacts = Array.from(aggregatedAisContacts.values())
    }

    if (installationBinding.isPrimary && latestSnapshot && latestSnapshotObservedAt) {
      await db
        .insert(vesselLiveSnapshots)
        .values({
          vesselId: installationBinding.vesselId,
          source: installationBinding.installationType,
          observedAt: latestSnapshotObservedAt,
          positionLat: latestSnapshot.positionLat,
          positionLng: latestSnapshot.positionLng,
          headingMagnetic: latestSnapshot.headingMagnetic,
          speedOverGround: latestSnapshot.speedOverGround,
          speedThroughWater: latestSnapshot.speedThroughWater,
          windSpeedApparent: latestSnapshot.windSpeedApparent,
          windAngleApparent: latestSnapshot.windAngleApparent,
          depthBelowTransducer: latestSnapshot.depthBelowTransducer,
          waterTemperatureKelvin: latestSnapshot.waterTemperatureKelvin,
          batteryVoltage: latestSnapshot.batteryVoltage,
          engineRpm: latestSnapshot.engineRpm,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: vesselLiveSnapshots.vesselId,
          set: {
            source: installationBinding.installationType,
            observedAt: latestSnapshotObservedAt,
            positionLat: latestSnapshot.positionLat,
            positionLng: latestSnapshot.positionLng,
            headingMagnetic: latestSnapshot.headingMagnetic,
            speedOverGround: latestSnapshot.speedOverGround,
            speedThroughWater: latestSnapshot.speedThroughWater,
            windSpeedApparent: latestSnapshot.windSpeedApparent,
            windAngleApparent: latestSnapshot.windAngleApparent,
            depthBelowTransducer: latestSnapshot.depthBelowTransducer,
            waterTemperatureKelvin: latestSnapshot.waterTemperatureKelvin,
            batteryVoltage: latestSnapshot.batteryVoltage,
            engineRpm: latestSnapshot.engineRpm,
            updatedAt: now,
          },
        })
    }

    await db
      .update(vesselInstallations)
      .set({
        connectionState: 'live',
        lastSeenAt: latestObservedAt || now,
        updatedAt: now,
        eventCount: sql`${vesselInstallations.eventCount} + ${ingestItems.length}`,
      })
      .where(eq(vesselInstallations.id, installationBinding.installationId))

    await db
      .update(apiKeys)
      .set({
        lastUsedAt: latestObservedAt || now,
      })
      .where(eq(apiKeys.id, installationBinding.apiKeyId))

    const backgroundTasks: Promise<unknown>[] = [writeTelemetryToInflux(event, influxLines)]

    if (installationBinding.isPrimary) {
      backgroundTasks.push(
        publishVesselLiveMessage(event, installationBinding.vesselId, livePayload),
      )
    }

    const backgroundResults = await Promise.allSettled(backgroundTasks)
    for (const result of backgroundResults) {
      if (result.status === 'rejected') {
        logger.warn('Background telemetry side-effect failed.', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          installationId: installationBinding.installationId,
          vesselId: installationBinding.vesselId,
        })
      }
    }

    return {
      ok: true,
      installationId: installationBinding.installationId,
      observedAt: latestObservedAt || now,
      processedDeltas: ingestItems.length,
    }
  },
)
