import type { VesselTrafficContactDetailResponse } from '~/types/traffic'
import { requireAuth } from '#layer/server/utils/auth'
import { fetchVesselLiveContact } from '#server/utils/liveBroker'
import {
  getObservedIdentitiesForVesselIds,
  getSnapshotsForVesselIds,
  getVesselBySlug,
  serializeVesselCards,
} from '#server/utils/myboat'
import {
  enrichTrafficContactsForVessel,
  resolveCachedTrafficContactDetail,
  toTrafficContactDetailSummary,
} from '#server/utils/traffic'

export default defineEventHandler(async (event): Promise<VesselTrafficContactDetailResponse> => {
  const user = await requireAuth(event)
  const vesselSlug = getRouterParam(event, 'vesselSlug')
  const contactId = getRouterParam(event, 'contactId')

  if (!vesselSlug || !contactId) {
    throw createError({ statusCode: 400, message: 'Missing traffic route params.' })
  }

  const vessel = await getVesselBySlug(event, user.id, vesselSlug)
  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Vessel not found.' })
  }

  const vesselIds = [vessel.id]
  const [snapshotRows, observedIdentityRows, liveContact] = await Promise.all([
    getSnapshotsForVesselIds(event, vesselIds),
    getObservedIdentitiesForVesselIds(event, vesselIds),
    fetchVesselLiveContact(event, vessel.id, contactId),
  ])

  const vesselCard = serializeVesselCards([vessel], snapshotRows, [], [], [], observedIdentityRows)[0]
  if (!vesselCard) {
    throw createError({ statusCode: 404, message: 'Vessel not found.' })
  }

  if (liveContact) {
    const [enrichedContact] = await enrichTrafficContactsForVessel(event, vessel.id, [liveContact])
    return {
      vessel: vesselCard,
      contact: toTrafficContactDetailSummary(
        enrichedContact || liveContact,
        vesselCard.liveSnapshot,
        'live',
      ),
    }
  }

  const cachedContact = await resolveCachedTrafficContactDetail(event, contactId, vesselCard.liveSnapshot)
  if (!cachedContact) {
    throw createError({ statusCode: 404, message: 'Traffic contact not found.' })
  }

  return {
    vessel: vesselCard,
    contact: cachedContact,
  }
})
