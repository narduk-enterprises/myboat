import { requireAuth } from '#layer/server/utils/auth'
import {
  getCaptainProfileByUserId,
  getInstallationsForUser,
  getMediaForVesselIds,
  getObservedIdentitiesForVesselIds,
  getPassagesForVesselIds,
  getSnapshotsForVesselIds,
  getVesselBySlug,
  getWaypointsForVesselIds,
  serializeVesselCards,
  toCaptainProfileSummary,
} from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const vesselSlug = getRouterParam(event, 'vesselSlug')

  if (!vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing vessel slug.' })
  }

  const [profileRow, vessel] = await Promise.all([
    getCaptainProfileByUserId(event, user.id),
    getVesselBySlug(event, user.id, vesselSlug),
  ])

  if (!profileRow) {
    throw createError({ statusCode: 404, message: 'Captain profile not found.' })
  }

  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Vessel not found.' })
  }

  const vesselIds = [vessel.id]
  const [snapshotRows, passageRows, mediaRows, waypointRows, installations, observedIdentityRows] =
    await Promise.all([
      getSnapshotsForVesselIds(event, vesselIds),
      getPassagesForVesselIds(event, vesselIds),
      getMediaForVesselIds(event, vesselIds),
      getWaypointsForVesselIds(event, vesselIds),
      getInstallationsForUser(event, user.id),
      getObservedIdentitiesForVesselIds(event, vesselIds),
    ])

  const vesselCards = serializeVesselCards(
    [vessel],
    snapshotRows,
    passageRows,
    mediaRows,
    waypointRows,
    observedIdentityRows,
  )

  return {
    profile: toCaptainProfileSummary(profileRow),
    vessel: vesselCards[0]!,
    installations: installations.filter((installation) => installation.vesselId === vessel.id),
    passages: passageRows,
    media: mediaRows.map((item) => ({
      id: item.id,
      passageId: item.passageId,
      title: item.title,
      caption: item.caption,
      imageUrl: item.imageUrl,
      lat: item.lat,
      lng: item.lng,
      capturedAt: item.capturedAt,
    })),
    waypoints: waypointRows,
  }
})
