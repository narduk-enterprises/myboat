import { requireAuth } from '#layer/server/utils/auth'
import {
  getCaptainProfileByUserId,
  getFollowedVesselsForUser,
  getInstallationsForUser,
  getMediaForVesselIds,
  getObservedIdentitiesForVesselIds,
  getPassagesForVesselIds,
  getSnapshotsForVesselIds,
  getUserVessels,
  getWaypointsForVesselIds,
  serializeMediaItemSummary,
  serializeFollowedVessels,
  serializeVesselCards,
  toCaptainProfileSummary,
} from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const [profileRow, vesselRows, followedVesselRows, installations] = await Promise.all([
    getCaptainProfileByUserId(event, user.id),
    getUserVessels(event, user.id),
    getFollowedVesselsForUser(event, user.id),
    getInstallationsForUser(event, user.id),
  ])

  const vesselIds = vesselRows.map((vessel) => vessel.id)
  const [snapshotRows, passageRows, mediaRows, waypointRows, observedIdentityRows] =
    await Promise.all([
      getSnapshotsForVesselIds(event, vesselIds),
      getPassagesForVesselIds(event, vesselIds),
      getMediaForVesselIds(event, vesselIds),
      getWaypointsForVesselIds(event, vesselIds),
      getObservedIdentitiesForVesselIds(event, vesselIds),
    ])

  const vesselCards = serializeVesselCards(
    vesselRows,
    snapshotRows,
    passageRows,
    mediaRows,
    waypointRows,
    observedIdentityRows,
  )

  return {
    profile: profileRow ? toCaptainProfileSummary(profileRow) : null,
    vessels: vesselCards,
    followedVessels: serializeFollowedVessels(followedVesselRows),
    installations,
    recentPassages: passageRows.slice(0, 3),
    recentMedia: mediaRows.slice(0, 6).map(serializeMediaItemSummary),
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
