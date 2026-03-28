import {
  getCaptainProfileByUsername,
  getFollowedVesselsForUser,
  getMediaForVesselIds,
  getPassagesForVesselIds,
  getPublicFreshnessState,
  getPublicInstallationsForVesselIds,
  getPublicVessels,
  getSnapshotsForVesselIds,
  getWaypointsForVesselIds,
  serializeFollowedVessels,
  serializeVesselCards,
  toCaptainProfileSummary,
} from '#server/utils/myboat'
import { applyPublicSignalKDefaults } from '#server/utils/signalkRelay'

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')

  if (!username) {
    throw createError({ statusCode: 400, message: 'Missing username.' })
  }

  const profileRow = await getCaptainProfileByUsername(event, username)

  if (!profileRow?.shareProfile) {
    throw createError({ statusCode: 404, message: 'Captain profile not found.' })
  }

  const [vesselRows, followedVesselRows] = await Promise.all([
    getPublicVessels(event, profileRow.userId),
    getFollowedVesselsForUser(event, profileRow.userId),
  ])
  const vesselIds = vesselRows.map((vessel) => vessel.id)
  const [snapshotRows, passageRows, mediaRows, waypointRows, installations] = await Promise.all([
    getSnapshotsForVesselIds(event, vesselIds),
    getPassagesForVesselIds(event, vesselIds),
    getMediaForVesselIds(event, vesselIds),
    getWaypointsForVesselIds(event, vesselIds),
    getPublicInstallationsForVesselIds(event, vesselIds),
  ])

  const vesselCards = serializeVesselCards(
    vesselRows,
    snapshotRows,
    passageRows,
    mediaRows,
    waypointRows,
  )
  const resolvedInstallations = applyPublicSignalKDefaults(event, installations)

  return {
    profile: toCaptainProfileSummary(profileRow),
    vessels: vesselCards.map((vessel) => ({
      ...vessel,
      freshnessState: getPublicFreshnessState(vessel.liveSnapshot?.observedAt || null),
    })),
    followedVessels: serializeFollowedVessels(followedVesselRows),
    installations: resolvedInstallations,
  }
})
