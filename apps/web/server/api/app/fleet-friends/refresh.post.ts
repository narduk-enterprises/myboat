import { defineUserMutation } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { refreshAisHubResultsByMmsis } from '#server/utils/aishub'
import {
  getFollowedVesselMmsisForUser,
  getFollowedVesselsForUser,
  serializeFollowedVessels,
} from '#server/utils/myboat'

export default defineUserMutation(
  { rateLimit: RATE_LIMIT_POLICIES.authProfile },
  async ({ event, user }) => {
    const mmsis = await getFollowedVesselMmsisForUser(event, user.id)

    if (!mmsis.length) {
      return {
        ok: true,
        source: 'local' as const,
        cachedAt: null,
        retryAfterMs: null,
        requestedCount: 0,
        resolvedCount: 0,
        missingCount: 0,
        followedVessels: [],
      }
    }

    const refresh = await refreshAisHubResultsByMmsis(event, mmsis, { bestEffort: true })
    const followedVessels = serializeFollowedVessels(
      await getFollowedVesselsForUser(event, user.id),
    )

    return {
      ok: true,
      source: refresh.source,
      cachedAt: refresh.cachedAt,
      retryAfterMs: refresh.retryAfterMs,
      requestedCount: mmsis.length,
      resolvedCount: refresh.results.length,
      missingCount: refresh.missingMmsis.length,
      followedVessels,
    }
  },
)
