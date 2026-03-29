import { and, eq } from 'drizzle-orm'
import { requireAuth } from '#layer/server/utils/auth'
import { passages, vessels } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import { getPassagePlaybackBundleForVessel } from '#server/utils/passagePlayback'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const passageId = getRouterParam(event, 'passageId')

  if (!passageId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing passage id.' })
  }

  const db = useAppDatabase(event)
  const scope = await db
    .select({
      vesselId: passages.vesselId,
    })
    .from(passages)
    .innerJoin(vessels, eq(passages.vesselId, vessels.id))
    .where(and(eq(passages.id, passageId), eq(vessels.ownerUserId, user.id)))
    .get()

  if (!scope) {
    throw createError({ statusCode: 404, statusMessage: 'Passage not found.' })
  }

  const bundle = await getPassagePlaybackBundleForVessel(event, scope.vesselId, passageId)
  if (!bundle) {
    throw createError({ statusCode: 404, statusMessage: 'Playback bundle unavailable.' })
  }

  return bundle
})
