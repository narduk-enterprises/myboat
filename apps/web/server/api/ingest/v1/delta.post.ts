import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { apiKeys } from '#layer/server/database/schema'
import { defineWebhookMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import {
  vesselInstallationApiKeys,
  vesselInstallations,
  vesselLiveSnapshots,
} from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

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

type SnapshotDraft = {
  positionLat: number | null
  positionLng: number | null
  headingMagnetic: number | null
  speedOverGround: number | null
  speedThroughWater: number | null
  windSpeedApparent: number | null
  windAngleApparent: number | null
  depthBelowTransducer: number | null
  waterTemperatureKelvin: number | null
  batteryVoltage: number | null
  engineRpm: number | null
}

function baseSnapshot(): SnapshotDraft {
  return {
    positionLat: null,
    positionLng: null,
    headingMagnetic: null,
    speedOverGround: null,
    speedThroughWater: null,
    windSpeedApparent: null,
    windAngleApparent: null,
    depthBelowTransducer: null,
    waterTemperatureKelvin: null,
    batteryVoltage: null,
    engineRpm: null,
  }
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeAngleDegrees(value: unknown) {
  if (typeof value !== 'number') {
    return null
  }

  return Math.abs(value) > Math.PI * 2 ? value : (value * 180) / Math.PI
}

function applyDeltaValues(
  snapshot: SnapshotDraft,
  values: Array<{ path: string; value: unknown }>,
) {
  for (const item of values) {
    const { path, value } = item

    if (path === 'navigation.position' && value && typeof value === 'object') {
      const position = value as { latitude?: unknown; longitude?: unknown }
      snapshot.positionLat = typeof position.latitude === 'number' ? position.latitude : null
      snapshot.positionLng = typeof position.longitude === 'number' ? position.longitude : null
      continue
    }

    if (path === 'navigation.position.latitude') {
      snapshot.positionLat = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'navigation.position.longitude') {
      snapshot.positionLng = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'navigation.headingMagnetic') {
      snapshot.headingMagnetic = normalizeAngleDegrees(value)
      continue
    }

    if (path === 'navigation.speedOverGround') {
      snapshot.speedOverGround = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'navigation.speedThroughWater') {
      snapshot.speedThroughWater = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'environment.wind.speedApparent') {
      snapshot.windSpeedApparent = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'environment.wind.angleApparent') {
      snapshot.windAngleApparent = normalizeAngleDegrees(value)
      continue
    }

    if (path === 'environment.depth.belowTransducer') {
      snapshot.depthBelowTransducer = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'environment.water.temperature') {
      snapshot.waterTemperatureKelvin = typeof value === 'number' ? value : null
      continue
    }

    if (path.startsWith('electrical.batteries.') && path.endsWith('.voltage')) {
      snapshot.batteryVoltage = typeof value === 'number' ? value : null
      continue
    }

    if (path.startsWith('propulsion.') && path.endsWith('.revolutions')) {
      snapshot.engineRpm = typeof value === 'number' ? value * 60 : null
    }
  }
}

export default defineWebhookMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authApiKeys,
    parseBody: withValidatedBody(ingestSchema.parse),
  },
  async ({ event, body }) => {
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

    const snapshot = baseSnapshot()
    for (const update of body.delta.updates) {
      applyDeltaValues(snapshot, update.values)
    }

    const observedAt =
      body.timestamp ||
      body.delta.updates.find((update) => update.timestamp)?.timestamp ||
      new Date().toISOString()
    const now = new Date().toISOString()

    if (installationBinding.isPrimary) {
      await db
        .insert(vesselLiveSnapshots)
        .values({
          vesselId: installationBinding.vesselId,
          source: installationBinding.installationType,
          observedAt,
          positionLat: snapshot.positionLat,
          positionLng: snapshot.positionLng,
          headingMagnetic: snapshot.headingMagnetic,
          speedOverGround: snapshot.speedOverGround,
          speedThroughWater: snapshot.speedThroughWater,
          windSpeedApparent: snapshot.windSpeedApparent,
          windAngleApparent: snapshot.windAngleApparent,
          depthBelowTransducer: snapshot.depthBelowTransducer,
          waterTemperatureKelvin: snapshot.waterTemperatureKelvin,
          batteryVoltage: snapshot.batteryVoltage,
          engineRpm: snapshot.engineRpm,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: vesselLiveSnapshots.vesselId,
          set: {
            source: installationBinding.installationType,
            observedAt,
            positionLat: snapshot.positionLat,
            positionLng: snapshot.positionLng,
            headingMagnetic: snapshot.headingMagnetic,
            speedOverGround: snapshot.speedOverGround,
            speedThroughWater: snapshot.speedThroughWater,
            windSpeedApparent: snapshot.windSpeedApparent,
            windAngleApparent: snapshot.windAngleApparent,
            depthBelowTransducer: snapshot.depthBelowTransducer,
            waterTemperatureKelvin: snapshot.waterTemperatureKelvin,
            batteryVoltage: snapshot.batteryVoltage,
            engineRpm: snapshot.engineRpm,
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

    return {
      ok: true,
      installationId: installationBinding.installationId,
      observedAt,
    }
  },
)
