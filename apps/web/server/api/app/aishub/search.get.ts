import { z } from 'zod'
import { requireAuth } from '#layer/server/utils/auth'
import { RATE_LIMIT_POLICIES, enforceRateLimitPolicy } from '#layer/server/utils/rateLimit'
import { searchAisHubVessels } from '#server/utils/aishub'

const querySchema = z.object({
  q: z.string().trim().min(1, 'Type something to search.').max(80),
})

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  await enforceRateLimitPolicy(event, RATE_LIMIT_POLICIES.authProfile)

  const parsedQuery = querySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedQuery.error.issues[0]?.message || 'Invalid AIS Hub search query.',
    })
  }

  return await searchAisHubVessels(event, parsedQuery.data.q)
})
