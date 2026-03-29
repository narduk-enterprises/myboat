import { selectTelemetryCandidates } from '@myboat/telemetry-source-policy'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { apiKeys } from '#layer/server/database/schema'
import type { VesselHistoryAccessTier } from '~/types/myboat'
import { useLogger } from '#layer/server/utils/logger'
import { defineWebhookMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { vesselInstallations, vesselLiveSnapshots } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import {
  buildHistoryInfluxTargets,
  buildHistoryLines,
  resolveHistoryAccessTier,
} from '#server/utils/history'
import { requireIngestInstallationBinding } from '#server/utils/ingest'
import { getInfluxConfig, writeInfluxTargets } from '#server/utils/influx'
import { publishVesselLiveMessage } from '#server/utils/liveBroker'
import {
  type IngestDelta,
  buildInfluxLines,
  buildLivePublishMessage,
  createTelemetryCandidatesFromDelta,
  materializeTelemetrySelections,
  resolveObservedAt,
} from '#server/utils/telemetry'
import { recordTelemetrySelectionState } from '#server/utils/telemetrySources'
import {
  extractObservedSelfIdentityPatchFromDelta,
  mergeObservedIdentityPatches,
  syncVesselObservedIdentityFromPrimaryInstallation,
  upsertInstallationObservedIdentity,
} from '#server/utils/vesselIdentity'
import type { VesselLivePublishMessage } from '../../../../shared/myboatLive'

const deltaSchema = z.object({
  context: z.string().optional(),
  publisherRole: z.enum(['primary', 'shadow']).optional(),
  self: z.string().optional(),
  updates: z.array(
    z.object({
      $source: z.string().optional(),
      receivedAt: z.string().datetime().optional(),
      dropReason: z
        .enum([
          'debug_only_path',
          'lower_priority_source',
          'shadow_source_suppressed',
          'sticky_winner_fresh',
        ])
        .optional(),
      source: z.record(z.string(), z.unknown()).nullable().optional(),
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
  debugOnly: z.boolean().optional().default(false),
  receivedAt: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional(),
  delta: deltaSchema,
})

const ingestSchema = z.union([
  ingestItemSchema,
  z.object({
    receivedAt: z.string().datetime().optional(),
    timestamp: z.string().datetime().optional(),
    deltas: z.array(ingestItemSchema).min(1),
  }),
])

type IngestRequestBody = z.infer<typeof ingestSchema>
type NormalizedIngestItem = {
  debugOnly: boolean
  receivedAt?: string
  delta: IngestDelta
}

function normalizeIngestItems(body: IngestRequestBody): NormalizedIngestItem[] {
  if ('deltas' in body) {
    return body.deltas.map((item) => ({
      debugOnly: item.debugOnly ?? false,
      receivedAt: item.receivedAt || item.timestamp || body.receivedAt || body.timestamp,
      delta: item.delta as IngestDelta,
    }))
  }

  return [
    {
      debugOnly: body.debugOnly ?? false,
      receivedAt: body.receivedAt || body.timestamp,
      delta: body.delta as IngestDelta,
    },
  ]
}

function normalizePublisherRole(value: IngestDelta['publisherRole']) {
  return value === 'shadow' ? 'shadow' : 'primary'
}

function getObservedAtMs(observedAt: string) {
  const observedAtMs = Date.parse(observedAt)
  return Number.isFinite(observedAtMs) ? observedAtMs : Number.NEGATIVE_INFINITY
}

export default defineWebhookMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authApiKeys,
    parseBody: withValidatedBody(ingestSchema.parse),
  },
  async ({ event, body }) => {
    const logger = useLogger(event).child('TelemetryIngest')
    const db = useAppDatabase(event)
    const installationBinding = await requireIngestInstallationBinding(event)

    const ingestItems = normalizeIngestItems(body)
    const now = new Date().toISOString()
    const selfByContext = new Map<string, string>()
    for (const item of ingestItems) {
      const normalizedContext = item.delta.context?.trim() || 'vessels.self'
      const normalizedSelf = item.delta.self?.trim() || ''
      if (normalizedSelf) {
        selfByContext.set(normalizedContext, normalizedSelf)
      }
    }

    const candidateItems = ingestItems.filter((item) => !item.debugOnly)
    const incomingDebugItems = ingestItems.filter((item) => item.debugOnly)
    const requestCandidates = candidateItems.flatMap((item) =>
      createTelemetryCandidatesFromDelta({
        delta: {
          context: item.delta.context || 'vessels.self',
          publisherRole: normalizePublisherRole(item.delta.publisherRole),
          ...(item.delta.self ? { self: item.delta.self } : {}),
          updates: item.delta.updates,
        },
        receivedAt: item.receivedAt || now,
      }),
    )
    const latestRequestObservedAt =
      candidateItems.at(-1)?.receivedAt || incomingDebugItems.at(-1)?.receivedAt || now
    const safetyResults = selectTelemetryCandidates({
      candidates: requestCandidates,
      now: latestRequestObservedAt,
    })
    const safetyMaterialization = materializeTelemetrySelections({
      publisherRole: normalizePublisherRole(candidateItems[0]?.delta.publisherRole),
      results: safetyResults,
      selfByContext,
    })
    const curatedItems = safetyMaterialization.selectedDeltas
    const debugItems = [
      ...incomingDebugItems.map((item) => ({
        delta: item.delta,
        receivedAt: item.receivedAt || resolveObservedAt(undefined, item.delta),
      })),
      ...safetyMaterialization.debugDeltas,
    ]
    const processedItems = [
      ...curatedItems.map((item) => ({ kind: 'curated' as const, item })),
      ...debugItems.map((item) => ({ kind: 'debug' as const, item })),
    ]
    const aggregatedAisContacts = new Map<
      string,
      NonNullable<VesselLivePublishMessage['aisContacts']>[number]
    >()
    const rawInfluxLines: string[] = []
    const coreInfluxLines: string[] = []
    const detailInfluxLines: string[] = []
    let aggregatedObservedIdentityPatch: ReturnType<
      typeof extractObservedSelfIdentityPatchFromDelta
    > = null
    let latestIdentityObservedAt: string | null = null
    let latestIdentityObservedAtMs = Number.NEGATIVE_INFINITY
    let latestObservedAt: string | null = null
    let latestObservedAtMs = Number.NEGATIVE_INFINITY
    let latestSnapshot: VesselLivePublishMessage['snapshot']
    let latestSnapshotObservedAt: string | null = null
    let latestSnapshotObservedAtMs = Number.NEGATIVE_INFINITY

    for (const entry of processedItems) {
      const item = entry.item
      const observedAt = resolveObservedAt(item.receivedAt, item.delta)
      const observedAtMs = getObservedAtMs(observedAt)

      if (observedAtMs >= latestObservedAtMs) {
        latestObservedAtMs = observedAtMs
        latestObservedAt = observedAt
      }

      if (entry.kind === 'debug') {
        rawInfluxLines.push(
          ...buildInfluxLines({
            delta: item.delta,
            observedAt,
            installationId: installationBinding.installationId,
            vesselId: installationBinding.vesselId,
          }),
        )
        continue
      }

      const observedIdentityPatch = extractObservedSelfIdentityPatchFromDelta(item.delta)

      if (observedIdentityPatch) {
        aggregatedObservedIdentityPatch = mergeObservedIdentityPatches(
          aggregatedObservedIdentityPatch,
          observedIdentityPatch,
        )

        if (observedAtMs >= latestIdentityObservedAtMs) {
          latestIdentityObservedAtMs = observedAtMs
          latestIdentityObservedAt = observedAt
        }
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

      const historyLines = buildHistoryLines({
        delta: item.delta,
        observedAt,
        installationId: installationBinding.installationId,
        vesselId: installationBinding.vesselId,
      })

      coreInfluxLines.push(...historyLines.coreLines)
      detailInfluxLines.push(...historyLines.detailLines)
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

    await recordTelemetrySelectionState({
      event,
      installationId: installationBinding.installationId,
      observedAt: latestObservedAt || now,
      publisherRole: normalizePublisherRole(
        candidateItems[0]?.delta.publisherRole || incomingDebugItems[0]?.delta.publisherRole,
      ),
      results: safetyResults,
      vesselId: installationBinding.vesselId,
    })

    if (aggregatedObservedIdentityPatch && latestIdentityObservedAt) {
      await upsertInstallationObservedIdentity({
        event,
        installationId: installationBinding.installationId,
        vesselId: installationBinding.vesselId,
        patch: aggregatedObservedIdentityPatch,
        observedAt: latestIdentityObservedAt,
        source: 'signalk_delta',
      })

      if (installationBinding.isPrimary) {
        await syncVesselObservedIdentityFromPrimaryInstallation(event, installationBinding.vesselId)
      }
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

    const historyAccessTier: VesselHistoryAccessTier = resolveHistoryAccessTier(
      event,
      installationBinding.ownerUserId,
    )
    const historyInfluxTargets = buildHistoryInfluxTargets(event, {
      accessTier: historyAccessTier,
      coreLines: coreInfluxLines,
      detailLines: detailInfluxLines,
      rawLines: rawInfluxLines,
    })

    if (
      historyInfluxTargets.length === 0 &&
      (rawInfluxLines.length > 0 || coreInfluxLines.length > 0 || detailInfluxLines.length > 0)
    ) {
      logger.warn('History telemetry produced lines but no Influx targets were resolved.', {
        accessTier: historyAccessTier,
        coreLineCount: coreInfluxLines.length,
        detailLineCount: detailInfluxLines.length,
        hasInfluxConfig: Boolean(getInfluxConfig(event)),
        installationId: installationBinding.installationId,
        rawLineCount: rawInfluxLines.length,
        vesselId: installationBinding.vesselId,
      })
    }

    const backgroundTasks: Promise<unknown>[] = [writeInfluxTargets(event, historyInfluxTargets)]

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
      processedDeltas: curatedItems.length,
      rejectedDebugDeltas: debugItems.length,
    }
  },
)
