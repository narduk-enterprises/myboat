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
  buildInfluxLines,
  buildLivePublishMessage,
  resolveObservedAt,
} from '#server/utils/telemetry'

const ingestSchema = z.object({
  timestamp: z.string().datetime().optional(),
  delta: z.object({
    context: z.string().optional(),
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
  }),
})

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

    const observedAt = resolveObservedAt(body.timestamp, body.delta)
    const now = new Date().toISOString()
    const livePayload = buildLivePublishMessage({
      delta: body.delta,
      observedAt,
      vesselId: installationBinding.vesselId,
      source: installationBinding.installationType,
      connectionState: 'live',
    })
    const influxLines = buildInfluxLines({
      delta: body.delta,
      observedAt,
      installationId: installationBinding.installationId,
      vesselId: installationBinding.vesselId,
    })

    if (installationBinding.isPrimary && livePayload.snapshot) {
      await db
        .insert(vesselLiveSnapshots)
        .values({
          vesselId: installationBinding.vesselId,
          source: installationBinding.installationType,
          observedAt,
          positionLat: livePayload.snapshot.positionLat,
          positionLng: livePayload.snapshot.positionLng,
          headingMagnetic: livePayload.snapshot.headingMagnetic,
          speedOverGround: livePayload.snapshot.speedOverGround,
          speedThroughWater: livePayload.snapshot.speedThroughWater,
          windSpeedApparent: livePayload.snapshot.windSpeedApparent,
          windAngleApparent: livePayload.snapshot.windAngleApparent,
          depthBelowTransducer: livePayload.snapshot.depthBelowTransducer,
          waterTemperatureKelvin: livePayload.snapshot.waterTemperatureKelvin,
          batteryVoltage: livePayload.snapshot.batteryVoltage,
          engineRpm: livePayload.snapshot.engineRpm,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: vesselLiveSnapshots.vesselId,
          set: {
            source: installationBinding.installationType,
            observedAt,
            positionLat: livePayload.snapshot.positionLat,
            positionLng: livePayload.snapshot.positionLng,
            headingMagnetic: livePayload.snapshot.headingMagnetic,
            speedOverGround: livePayload.snapshot.speedOverGround,
            speedThroughWater: livePayload.snapshot.speedThroughWater,
            windSpeedApparent: livePayload.snapshot.windSpeedApparent,
            windAngleApparent: livePayload.snapshot.windAngleApparent,
            depthBelowTransducer: livePayload.snapshot.depthBelowTransducer,
            waterTemperatureKelvin: livePayload.snapshot.waterTemperatureKelvin,
            batteryVoltage: livePayload.snapshot.batteryVoltage,
            engineRpm: livePayload.snapshot.engineRpm,
            updatedAt: now,
          },
        })
    }

    await db
      .update(vesselInstallations)
      .set({
        connectionState: 'live',
        lastSeenAt: observedAt,
        updatedAt: now,
        eventCount: sql`${vesselInstallations.eventCount} + 1`,
      })
      .where(eq(vesselInstallations.id, installationBinding.installationId))

    await db
      .update(apiKeys)
      .set({
        lastUsedAt: observedAt,
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
      observedAt,
    }
  },
)
