import { requireAdmin } from '#layer/server/utils/auth'
import { getAisHubSyncStatus } from '#server/utils/aishub-sync'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const d1 = (event.context.cloudflare?.env as { DB?: D1Database })?.DB
  if (!d1) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 database binding not available.',
    })
  }

  return await getAisHubSyncStatus(d1)
})
