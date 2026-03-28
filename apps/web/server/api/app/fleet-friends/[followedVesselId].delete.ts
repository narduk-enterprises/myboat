import { and, eq } from 'drizzle-orm'
import { defineUserMutation } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { followedVessels } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authProfile,
  },
  async ({ event, user }) => {
    const followedVesselId = getRouterParam(event, 'followedVesselId')
    if (!followedVesselId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing followed vessel identifier.',
      })
    }

    const db = useAppDatabase(event)
    const existing = await db
      .select({ id: followedVessels.id })
      .from(followedVessels)
      .where(
        and(eq(followedVessels.id, followedVesselId), eq(followedVessels.ownerUserId, user.id)),
      )
      .get()

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Followed vessel not found.',
      })
    }

    await db.delete(followedVessels).where(eq(followedVessels.id, followedVesselId))

    return { ok: true }
  },
)
