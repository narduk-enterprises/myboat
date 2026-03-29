import { defineAdminMutation } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { getAisHubSyncStatus, runAisHubRollingSync } from '#server/utils/aishub-sync'

export default defineAdminMutation(
  { rateLimit: RATE_LIMIT_POLICIES.authProfile },
  async ({ event }) => {
    const d1 = (event.context.cloudflare?.env as { DB?: D1Database })?.DB
    if (!d1) {
      throw createError({
        statusCode: 500,
        statusMessage: 'D1 database binding not available.',
      })
    }

    const runtimeConfig = useRuntimeConfig(event)
    await runAisHubRollingSync(d1, runtimeConfig.aisHubKey)
    return await getAisHubSyncStatus(d1)
  },
)
