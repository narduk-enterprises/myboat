import { requireAuth } from '#layer/server/utils/auth'
import { applySignalKRelayDefaults, getDefaultSignalKUrlForUser } from '#server/utils/signalkRelay'
import {
  getCaptainProfileByUserId,
  getFollowedVesselsForUser,
  getInstallationsForUser,
  getMediaForVesselIds,
  getPassagesForVesselIds,
  getSnapshotsForVesselIds,
  getUserVessels,
  getWaypointsForVesselIds,
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
  const [resolvedInstallations, defaultSignalKUrl] = await Promise.all([
    applySignalKRelayDefaults(event, user, installations),
    getDefaultSignalKUrlForUser(event, user),
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
    followedVessels: serializeFollowedVessels(followedVesselRows),
    installations: resolvedInstallations,
    defaultSignalKUrl,
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
      installationCount: resolvedInstallations.length,
      passageCount: passageRows.length,
      mediaCount: mediaRows.length,
      liveInstallationCount: resolvedInstallations.filter(
        (installation) => installation.connectionState === 'live',
      ).length,
    },
  }
})
