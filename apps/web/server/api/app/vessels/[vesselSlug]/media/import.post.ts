import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { mediaItems, passages } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import { getVesselBySlug, serializeMediaItemSummary } from '#server/utils/myboat'

const mediaMatchStatusSchema = z.enum(['attached', 'review'])

const importItemSchema = z
  .object({
    passageId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(160),
    caption: z.string().trim().max(400).nullable().optional(),
    imageUrl: z.string().trim().min(1).max(2048),
    sharePublic: z.boolean().optional(),
    sourceKind: z.enum(['manual', 'apple_photos_seed']).optional(),
    sourceAssetId: z.string().trim().max(255).nullable().optional(),
    sourceFingerprint: z.string().trim().max(255).nullable().optional(),
    matchStatus: mediaMatchStatusSchema.optional(),
    matchScore: z.number().min(0).max(1).nullable().optional(),
    matchReason: z.string().trim().max(255).nullable().optional(),
    isCover: z.boolean().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    capturedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.isCover && !value.passageId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A cover image must be attached to a passage.',
        path: ['isCover'],
      })
    }
  })

const bodySchema = z.object({
  items: z.array(importItemSchema).min(1).max(250),
})

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.upload,
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const vesselSlug = getRouterParam(event, 'vesselSlug')

    if (!vesselSlug) {
      throw createError({ statusCode: 400, message: 'Missing vessel slug.' })
    }

    const vessel = await getVesselBySlug(event, user.id, vesselSlug)
    if (!vessel) {
      throw createError({ statusCode: 404, message: 'Vessel not found.' })
    }

    const db = useAppDatabase(event)
    const validPassageRows = await db
      .select({ id: passages.id })
      .from(passages)
      .where(eq(passages.vesselId, vessel.id))
      .all()
    const validPassageIds = new Set(validPassageRows.map((row) => row.id))

    const requestedFingerprints = body.items
      .map((item) => item.sourceFingerprint?.trim() || null)
      .filter((item): item is string => Boolean(item))

    const duplicateRows = requestedFingerprints.length
      ? await db
          .select({
            id: mediaItems.id,
            sourceFingerprint: mediaItems.sourceFingerprint,
          })
          .from(mediaItems)
          .where(
            and(
              eq(mediaItems.vesselId, vessel.id),
              inArray(mediaItems.sourceFingerprint, requestedFingerprints),
            ),
          )
          .all()
      : []

    const existingByFingerprint = new Map(
      duplicateRows
        .filter(
          (row): row is typeof row & { sourceFingerprint: string } =>
            typeof row.sourceFingerprint === 'string',
        )
        .map((row) => [row.sourceFingerprint, row.id] as const),
    )

    const now = new Date().toISOString()
    const imported: Array<ReturnType<typeof serializeMediaItemSummary>> = []
    const duplicates: Array<{ mediaId: string; sourceFingerprint: string }> = []

    for (const item of body.items) {
      const normalizedFingerprint = item.sourceFingerprint?.trim() || null

      if (item.passageId && !validPassageIds.has(item.passageId)) {
        throw createError({
          statusCode: 400,
          message: 'Media import referenced a passage outside this vessel.',
        })
      }

      if (normalizedFingerprint && existingByFingerprint.has(normalizedFingerprint)) {
        duplicates.push({
          mediaId: existingByFingerprint.get(normalizedFingerprint)!,
          sourceFingerprint: normalizedFingerprint,
        })
        continue
      }

      const id = crypto.randomUUID()
      const matchStatus = item.matchStatus || 'attached'
      const sharePublic = matchStatus === 'review' ? false : (item.sharePublic ?? false)
      const isCover = Boolean(item.passageId && item.isCover && matchStatus === 'attached')

      if (isCover && item.passageId) {
        await db
          .update(mediaItems)
          .set({ isCover: false })
          .where(and(eq(mediaItems.vesselId, vessel.id), eq(mediaItems.passageId, item.passageId)))
      }

      await db.insert(mediaItems).values({
        id,
        vesselId: vessel.id,
        passageId: item.passageId ?? null,
        title: item.title.trim(),
        caption: item.caption?.trim() || null,
        imageUrl: item.imageUrl.trim(),
        sharePublic,
        sourceKind: item.sourceKind || 'manual',
        sourceAssetId: item.sourceAssetId?.trim() || null,
        sourceFingerprint: normalizedFingerprint,
        matchStatus,
        matchScore: item.matchScore ?? null,
        matchReason: item.matchReason?.trim() || null,
        isCover,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        capturedAt: item.capturedAt ?? null,
        createdAt: now,
      })

      if (normalizedFingerprint) {
        existingByFingerprint.set(normalizedFingerprint, id)
      }

      imported.push(
        serializeMediaItemSummary({
          id,
          vesselId: vessel.id,
          passageId: item.passageId ?? null,
          title: item.title.trim(),
          caption: item.caption?.trim() || null,
          imageUrl: item.imageUrl.trim(),
          sharePublic,
          sourceKind: item.sourceKind || 'manual',
          sourceAssetId: item.sourceAssetId?.trim() || null,
          sourceFingerprint: normalizedFingerprint,
          matchStatus,
          matchScore: item.matchScore ?? null,
          matchReason: item.matchReason?.trim() || null,
          isCover,
          lat: item.lat ?? null,
          lng: item.lng ?? null,
          capturedAt: item.capturedAt ?? null,
          createdAt: now,
        }),
      )
    }

    return {
      imported,
      duplicates,
      counts: {
        imported: imported.length,
        duplicates: duplicates.length,
      },
    }
  },
)
