import type { SourceInventorySnapshot } from '@myboat/telemetry-source-policy'
import { z } from 'zod'
import { defineWebhookMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { requireIngestInstallationBinding } from '#server/utils/ingest'
import {
  normalizeSourceInventoryIngress,
  upsertTelemetrySourceInventory,
} from '#server/utils/telemetrySources'

const metadataValueSchema = z.union([z.boolean(), z.number(), z.string(), z.null()])

const sourceInventoryEntrySchema = z
  .object({
    family: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    metadata: z.record(z.string(), metadataValueSchema).default({}),
    sourceId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.sourceId || value.id), {
    message: 'Each source inventory entry must include a source id.',
  })

const sourceInventorySchema = z.object({
  observedAt: z.string().datetime(),
  policyVersion: z.string().min(1),
  publisherRole: z.enum(['primary', 'shadow']).optional().default('primary'),
  selfContext: z.string().min(1).nullable().optional(),
  sourceCount: z.number().int().nonnegative().optional(),
  sources: z.array(sourceInventoryEntrySchema),
})

export default defineWebhookMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authApiKeys,
    parseBody: withValidatedBody(sourceInventorySchema.parse),
  },
  async ({ event, body }) => {
    const installationBinding = await requireIngestInstallationBinding(event)
    const snapshot: SourceInventorySnapshot = normalizeSourceInventoryIngress({
      observedAt: body.observedAt,
      publisherRole: body.publisherRole,
      selfContext: body.selfContext || null,
      sources: body.sources,
    })

    await upsertTelemetrySourceInventory({
      event,
      installationId: installationBinding.installationId,
      publisherRole: snapshot.publisherRole,
      snapshot,
      vesselId: installationBinding.vesselId,
    })

    return {
      installationId: installationBinding.installationId,
      observedAt: body.observedAt,
      ok: true,
      sourceCount: snapshot.sourceCount,
    }
  },
)
