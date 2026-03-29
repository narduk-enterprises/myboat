import type { TrafficNearbyResponse } from '~/types/traffic'
import { requireAuth } from '#layer/server/utils/auth'
import { getSnapshotsForVesselIds, getVesselBySlug } from '#server/utils/myboat'
import { listNearbyTrafficContactsForVessel, TRAFFIC_NEARBY_RADIUS_NM } from '#server/utils/traffic'

export default defineEventHandler(async (event): Promise<TrafficNearbyResponse> => {
  const user = await requireAuth(event)
  const vesselSlug = getRouterParam(event, 'vesselSlug')

  if (!vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing vessel slug.' })
  }

  const vessel = await getVesselBySlug(event, user.id, vesselSlug)
  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Vessel not found.' })
  }

  const snapshot = (await getSnapshotsForVesselIds(event, [vessel.id]))[0] || null
  const nearby = await listNearbyTrafficContactsForVessel(event, vessel.id, snapshot)

  return {
    contacts: nearby.contacts,
    radiusNm: TRAFFIC_NEARBY_RADIUS_NM,
    refreshedAt: new Date().toISOString(),
    source: nearby.source,
  }
})
