import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { mediaItems, passages } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import { getVesselBySlug, serializeMediaItemSummary } from '#server/utils/myboat'

const bodySchema = z
  .object({
    passageId: z.string().uuid().nullable().optional(),
    sharePublic: z.boolean().optional(),
    isCover: z.boolean().optional(),
    matchStatus: z.enum(['attached', 'review']).optional(),
  })
  .superRefine((value, context) => {
    if (!Object.values(value).some((entry) => entry !== undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one media update field.',
      })
    }
  })

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authProfile,
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const vesselSlug = getRouterParam(event, 'vesselSlug')
    const mediaId = getRouterParam(event, 'mediaId')

    if (!vesselSlug || !mediaId) {
      throw createError({ statusCode: 400, message: 'Missing vessel media route params.' })
    }

    const vessel = await getVesselBySlug(event, user.id, vesselSlug)
    if (!vessel) {
      throw createError({ statusCode: 404, message: 'Vessel not found.' })
    }

    const db = useAppDatabase(event)
    const media = await db
      .select({
        id: mediaItems.id,
        vesselId: mediaItems.vesselId,
        passageId: mediaItems.passageId,
        title: mediaItems.title,
        caption: mediaItems.caption,
        imageUrl: mediaItems.imageUrl,
        sharePublic: mediaItems.sharePublic,
        sourceKind: mediaItems.sourceKind,
        sourceAssetId: mediaItems.sourceAssetId,
        sourceFingerprint: mediaItems.sourceFingerprint,
        matchStatus: mediaItems.matchStatus,
        matchScore: mediaItems.matchScore,
        matchReason: mediaItems.matchReason,
        isCover: mediaItems.isCover,
        lat: mediaItems.lat,
        lng: mediaItems.lng,
        capturedAt: mediaItems.capturedAt,
        createdAt: mediaItems.createdAt,
      })
      .from(mediaItems)
      .where(and(eq(mediaItems.id, mediaId), eq(mediaItems.vesselId, vessel.id)))
      .get()

    if (!media) {
      throw createError({ statusCode: 404, message: 'Media item not found.' })
    }

    const nextPassageId = body.passageId === undefined ? media.passageId : body.passageId
    if (nextPassageId) {
      const matchingPassage = await db
        .select({ id: passages.id })
        .from(passages)
        .where(and(eq(passages.id, nextPassageId), eq(passages.vesselId, vessel.id)))
        .get()

      if (!matchingPassage) {
        throw createError({
          statusCode: 400,
          message: 'Media update referenced a passage outside this vessel.',
        })
      }
    }

    const requestedMatchStatus = body.matchStatus ?? media.matchStatus
    const nextMatchStatus = requestedMatchStatus === 'review' ? 'review' : 'attached'
    const requestedCover = body.isCover ?? media.isCover
    const nextIsCover = Boolean(nextPassageId && requestedCover && nextMatchStatus === 'attached')
    const nextSharePublic =
      nextMatchStatus === 'review' ? false : (body.sharePublic ?? media.sharePublic)

    if (body.isCover === true && !nextPassageId) {
      throw createError({
        statusCode: 400,
        message: 'A cover image must remain attached to a passage.',
      })
    }

    if (nextIsCover && nextPassageId) {
      await db
        .update(mediaItems)
        .set({ isCover: false })
        .where(
          and(
            eq(mediaItems.vesselId, vessel.id),
            eq(mediaItems.passageId, nextPassageId),
            ne(mediaItems.id, media.id),
          ),
        )
    }

    await db
      .update(mediaItems)
      .set({
        passageId: nextPassageId ?? null,
        sharePublic: nextSharePublic,
        matchStatus: nextMatchStatus,
        isCover: nextIsCover,
      })
      .where(eq(mediaItems.id, media.id))

    return {
      ok: true,
      media: serializeMediaItemSummary({
        ...media,
        passageId: nextPassageId ?? null,
        sharePublic: nextSharePublic,
        matchStatus: nextMatchStatus,
        isCover: nextIsCover,
      }),
    }
  },
)
