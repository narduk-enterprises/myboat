import { z } from 'zod'
import { getVesselHistory, resolveHistoryAccessTier } from '#server/utils/history'
import { getPublicVesselByUsernameAndSlug } from '#server/utils/myboat'

const querySchema = z
  .object({
    end: z.string().datetime(),
    resolution: z.enum(['auto', 'raw', '1m', '5m', '15m', '1h']).optional().default('auto'),
    series: z.preprocess(
      (value) => {
        if (Array.isArray(value)) {
          return value.flatMap((item) =>
            typeof item === 'string'
              ? item
                  .split(',')
                  .map((part) => part.trim())
                  .filter(Boolean)
              : [],
          )
        }

        if (typeof value === 'string') {
          return value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        }

        return []
      },
      z.array(z.string().min(1)).min(1).max(6),
    ),
    start: z.string().datetime(),
  })
  .refine((value) => Date.parse(value.start) < Date.parse(value.end), {
    message: 'Start must be before end.',
    path: ['start'],
  })

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')
  const vesselSlug = getRouterParam(event, 'vesselSlug')

  if (!username || !vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing public vessel route params.' })
  }

  const vessel = await getPublicVesselByUsernameAndSlug(event, username, vesselSlug)
  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Public vessel not found.' })
  }

  const query = await getValidatedQuery(event, querySchema.parse)
  const config = useRuntimeConfig(event)

  return await getVesselHistory({
    accessTier: resolveHistoryAccessTier(event, vessel.ownerUserId),
    end: query.end,
    event,
    maxDays: config.historyPublicMaxDays,
    mode: 'public',
    requestedResolution: query.resolution,
    seriesIds: query.series,
    start: query.start,
    vesselId: vessel.id,
  })
})
