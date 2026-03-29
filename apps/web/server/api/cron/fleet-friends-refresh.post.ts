import { defineCronMutation } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { refreshAisHubResultsByMmsis } from '#server/utils/aishub'
import { getTrackedFollowedVesselMmsis } from '#server/utils/myboat'

export default defineCronMutation(
  { rateLimit: RATE_LIMIT_POLICIES.authProfile },
  async ({ event }) => {
    const mmsis = await getTrackedFollowedVesselMmsis(event)
    const refresh = await refreshAisHubResultsByMmsis(event, mmsis, { bestEffort: true })

    return {
      ok: true,
      source: refresh.source,
      cachedAt: refresh.cachedAt,
      retryAfterMs: refresh.retryAfterMs,
      requestedCount: mmsis.length,
      resolvedCount: refresh.results.length,
      missingCount: refresh.missingMmsis.length,
    }
  },
)
