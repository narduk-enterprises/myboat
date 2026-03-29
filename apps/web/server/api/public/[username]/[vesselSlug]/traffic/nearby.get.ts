import type { TrafficNearbyResponse } from '~/types/traffic'
import { getPublicVesselByUsernameAndSlug, getSnapshotsForVesselIds } from '#server/utils/myboat'
import { listNearbyTrafficContactsForVessel, TRAFFIC_NEARBY_RADIUS_NM } from '#server/utils/traffic'

export default defineEventHandler(async (event): Promise<TrafficNearbyResponse> => {
  const username = getRouterParam(event, 'username')
  const vesselSlug = getRouterParam(event, 'vesselSlug')

  if (!username || !vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing public vessel route params.' })
  }

  const vessel = await getPublicVesselByUsernameAndSlug(event, username, vesselSlug)
  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Public vessel not found.' })
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
