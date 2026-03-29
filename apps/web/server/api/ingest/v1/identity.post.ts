import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { apiKeys } from '#layer/server/database/schema'
import { defineWebhookMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { vesselInstallations } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import { requireIngestInstallationBinding } from '#server/utils/ingest'
import {
  syncVesselObservedIdentityFromPrimaryInstallation,
  upsertInstallationObservedIdentity,
} from '#server/utils/vesselIdentity'

const identitySchema = z.object({
  timestamp: z.string().datetime().optional(),
  source: z.enum(['signalk_delta', 'signalk_rest']).default('signalk_rest'),
  selfContext: z.string().trim().max(255).optional().or(z.literal('')),
  mmsi: z
    .string()
    .trim()
    .regex(/^\d{9}$/)
    .optional()
    .or(z.literal('')),
  observedName: z.string().trim().max(120).optional().or(z.literal('')),
  callSign: z.string().trim().max(40).optional().or(z.literal('')),
  shipType: z.string().trim().max(120).optional().or(z.literal('')),
  shipTypeCode: z.number().int().optional(),
  lengthOverall: z.number().finite().optional(),
  beam: z.number().finite().optional(),
  draft: z.number().finite().optional(),
  registrationNumber: z.string().trim().max(80).optional().or(z.literal('')),
  imo: z.string().trim().max(32).optional().or(z.literal('')),
})

function toOptionalString(value: string | undefined) {
  return value ? value : undefined
}

export default defineWebhookMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authApiKeys,
    parseBody: withValidatedBody(identitySchema.parse),
  },
  async ({ event, body }) => {
    const db = useAppDatabase(event)
    const installationBinding = await requireIngestInstallationBinding(event)
    const observedAt = body.timestamp || new Date().toISOString()

    const observedIdentity = await upsertInstallationObservedIdentity({
      event,
      installationId: installationBinding.installationId,
      vesselId: installationBinding.vesselId,
      observedAt,
      source: body.source,
      patch: {
        selfContext: toOptionalString(body.selfContext),
        mmsi: toOptionalString(body.mmsi),
        observedName: toOptionalString(body.observedName),
        callSign: toOptionalString(body.callSign),
        shipType: toOptionalString(body.shipType),
        shipTypeCode: body.shipTypeCode,
        lengthOverall: body.lengthOverall,
        beam: body.beam,
        draft: body.draft,
        registrationNumber: toOptionalString(body.registrationNumber),
        imo: toOptionalString(body.imo),
      },
    })

    if (installationBinding.isPrimary) {
      await syncVesselObservedIdentityFromPrimaryInstallation(event, installationBinding.vesselId)
    }

    await db
      .update(vesselInstallations)
      .set({
        connectionState: 'live',
        lastSeenAt: observedAt,
        updatedAt: new Date().toISOString(),
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
      observedIdentity,
    }
  },
)
