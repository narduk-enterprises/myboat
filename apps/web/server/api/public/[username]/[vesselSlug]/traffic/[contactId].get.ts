import type { PublicTrafficContactDetailResponse } from '~/types/traffic'
import {
  getCaptainProfileByUsername,
  getPublicVesselByUsernameAndSlug,
  getSnapshotsForVesselIds,
  serializeVesselCards,
  toCaptainProfileSummary,
} from '#server/utils/myboat'
import { fetchVesselLiveContact } from '#server/utils/liveBroker'
import {
  enrichTrafficContactsForVessel,
  resolveCachedTrafficContactDetail,
  toTrafficContactDetailSummary,
} from '#server/utils/traffic'

export default defineEventHandler(async (event): Promise<PublicTrafficContactDetailResponse> => {
  const username = getRouterParam(event, 'username')
  const vesselSlug = getRouterParam(event, 'vesselSlug')
  const contactId = getRouterParam(event, 'contactId')

  if (!username || !vesselSlug || !contactId) {
    throw createError({ statusCode: 400, message: 'Missing public traffic route params.' })
  }

  const [profileRow, vessel] = await Promise.all([
    getCaptainProfileByUsername(event, username),
    getPublicVesselByUsernameAndSlug(event, username, vesselSlug),
  ])

  if (!profileRow?.shareProfile || !vessel) {
    throw createError({ statusCode: 404, message: 'Public vessel not found.' })
  }

  const vesselIds = [vessel.id]
  const [snapshotRows, liveContact] = await Promise.all([
    getSnapshotsForVesselIds(event, vesselIds),
    fetchVesselLiveContact(event, vessel.id, contactId),
  ])

  const vesselCard = serializeVesselCards([vessel], snapshotRows, [], [], [])[0]
  if (!vesselCard) {
    throw createError({ statusCode: 404, message: 'Public vessel not found.' })
  }

  if (liveContact) {
    const [enrichedContact] = await enrichTrafficContactsForVessel(event, vessel.id, [liveContact])
    return {
      profile: toCaptainProfileSummary(profileRow),
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
    profile: toCaptainProfileSummary(profileRow),
    vessel: vesselCard,
    contact: cachedContact,
  }
})
