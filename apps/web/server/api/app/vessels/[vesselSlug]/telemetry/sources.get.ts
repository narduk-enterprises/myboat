import type { VesselTelemetrySourcesResponse } from '~/types/myboat'
import { requireAuth } from '#layer/server/utils/auth'
import { getVesselBySlug } from '#server/utils/myboat'
import { getVesselTelemetrySources } from '#server/utils/telemetrySources'

export default defineEventHandler(async (event): Promise<VesselTelemetrySourcesResponse> => {
  const user = await requireAuth(event)
  const vesselSlug = getRouterParam(event, 'vesselSlug')

  if (!vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing vessel slug.' })
  }

  const vessel = await getVesselBySlug(event, user.id, vesselSlug)
  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Vessel not found.' })
  }

  return await getVesselTelemetrySources(event, vessel.id)
})
