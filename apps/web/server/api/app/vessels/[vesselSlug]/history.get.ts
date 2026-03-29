import { z } from 'zod'
import { requireAuth } from '#layer/server/utils/auth'
import { getVesselHistory, resolveHistoryAccessTier } from '#server/utils/history'
import { getVesselBySlug } from '#server/utils/myboat'

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
  const user = await requireAuth(event)
  const vesselSlug = getRouterParam(event, 'vesselSlug')
  if (!vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing vessel slug.' })
  }

  const vessel = await getVesselBySlug(event, user.id, vesselSlug)
  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Vessel not found.' })
  }

  const query = await getValidatedQuery(event, querySchema.parse)
  const accessTier = resolveHistoryAccessTier(event, user.id)
  const config = useRuntimeConfig(event)
  const maxDays =
    accessTier === 'paid' ? config.historyOwnerPaidMaxDays : config.historyOwnerFreeMaxDays

  return await getVesselHistory({
    accessTier,
    end: query.end,
    event,
    maxDays,
    mode: 'owner',
    requestedResolution: query.resolution,
    seriesIds: query.series,
    start: query.start,
    vesselId: vessel.id,
  })
})
