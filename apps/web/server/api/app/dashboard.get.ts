import { requireAuth } from '#layer/server/utils/auth'
import {
  getCaptainProfileByUserId,
  getInstallationsForUser,
  getMediaForVesselIds,
  getPassagesForVesselIds,
  getSnapshotsForVesselIds,
  getUserVessels,
  getWaypointsForVesselIds,
  serializeVesselCards,
  toCaptainProfileSummary,
} from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const [profileRow, vesselRows, installations] = await Promise.all([
    getCaptainProfileByUserId(event, user.id),
    getUserVessels(event, user.id),
    getInstallationsForUser(event, user.id),
  ])

  const vesselIds = vesselRows.map((vessel) => vessel.id)
  const [snapshotRows, passageRows, mediaRows, waypointRows] = await Promise.all([
    getSnapshotsForVesselIds(event, vesselIds),
    getPassagesForVesselIds(event, vesselIds),
    getMediaForVesselIds(event, vesselIds),
    getWaypointsForVesselIds(event, vesselIds),
  ])

  const vesselCards = serializeVesselCards(
    vesselRows,
    snapshotRows,
    passageRows,
    mediaRows,
    waypointRows,
  )

  return {
    profile: profileRow ? toCaptainProfileSummary(profileRow) : null,
    vessels: vesselCards,
    installations,
    recentPassages: passageRows.slice(0, 3),
    recentMedia: mediaRows.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      caption: item.caption,
      imageUrl: item.imageUrl,
      lat: item.lat,
      lng: item.lng,
      capturedAt: item.capturedAt,
    })),
    stats: {
      vesselCount: vesselRows.length,
      installationCount: installations.length,
      passageCount: passageRows.length,
      mediaCount: mediaRows.length,
      liveInstallationCount: installations.filter(
        (installation) => installation.connectionState === 'live',
      ).length,
    },
  }
})
