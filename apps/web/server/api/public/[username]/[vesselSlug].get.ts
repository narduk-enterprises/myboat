import {
  getCaptainProfileByUsername,
  getPublicFreshnessState,
  getPublicInstallationsForVesselIds,
  getMediaForVesselIds,
  getPassagesForVesselIds,
  getPublicVesselByUsernameAndSlug,
  getSnapshotsForVesselIds,
  getWaypointsForVesselIds,
  serializeVesselCards,
  toCaptainProfileSummary,
} from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')
  const vesselSlug = getRouterParam(event, 'vesselSlug')

  if (!username || !vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing public vessel route params.' })
  }

  const [profileRow, vesselRow] = await Promise.all([
    getCaptainProfileByUsername(event, username),
    getPublicVesselByUsernameAndSlug(event, username, vesselSlug),
  ])

  if (!profileRow?.shareProfile || !vesselRow) {
    throw createError({ statusCode: 404, message: 'Public vessel not found.' })
  }

  const vesselIds = [vesselRow.id]
  const [snapshotRows, passageRows, mediaRows, waypointRows, installations] = await Promise.all([
    getSnapshotsForVesselIds(event, vesselIds),
    getPassagesForVesselIds(event, vesselIds),
    getMediaForVesselIds(event, vesselIds),
    getWaypointsForVesselIds(event, vesselIds),
    getPublicInstallationsForVesselIds(event, vesselIds),
  ])

  const vessel = serializeVesselCards(
    [vesselRow],
    snapshotRows,
    passageRows,
    mediaRows,
    waypointRows,
  )[0]

  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Public vessel not found.' })
  }

  return {
    profile: toCaptainProfileSummary(profileRow),
    vessel,
    installations,
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
    freshnessState: getPublicFreshnessState(vessel.liveSnapshot?.observedAt || null),
  }
})
