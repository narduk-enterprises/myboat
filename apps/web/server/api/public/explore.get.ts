import {
  getDiscoverableCaptainProfiles,
  getPublicExploreRows,
  getPublicFreshnessState,
  getPassagesForVesselIds,
  getPublicMediaForVesselIds,
  getSnapshotsForVesselIds,
  getWaypointsForVesselIds,
  serializeVesselCards,
  toCaptainProfileSummary,
} from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const profileRows = await getDiscoverableCaptainProfiles(event)
  const exploreRows = await getPublicExploreRows(event)
  const vesselRows = exploreRows.map((row) => ({
    id: row.vesselId,
    ownerUserId: row.userId,
    slug: row.vesselSlug,
    name: row.vesselName,
    vesselType: row.vesselType,
    homePort: row.vesselHomePort,
    summary: row.vesselSummary,
    callSign: row.callSign,
    isPrimary: row.isPrimary,
    sharePublic: row.sharePublic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
  const vesselIds = vesselRows.map((vessel) => vessel.id)

  const [snapshotRows, passageRows, mediaRows, waypointRows] = await Promise.all([
    getSnapshotsForVesselIds(event, vesselIds),
    getPassagesForVesselIds(event, vesselIds),
    getPublicMediaForVesselIds(event, vesselIds),
    getWaypointsForVesselIds(event, vesselIds),
  ])

  const vesselCards = serializeVesselCards(
    vesselRows,
    snapshotRows,
    passageRows,
    mediaRows,
    waypointRows,
  )
  const profileMap = new Map(profileRows.map((profile) => [profile.userId, profile]))

  const items = vesselCards
    .map((vessel) => {
      const profile = profileMap.get(
        vesselRows.find((row) => row.id === vessel.id)?.ownerUserId || '',
      )
      if (!profile) {
        return null
      }

      return {
        profile: toCaptainProfileSummary(profile),
        vessel,
        freshnessState: getPublicFreshnessState(vessel.liveSnapshot?.observedAt || null),
        lastObservedAt: vessel.liveSnapshot?.observedAt || null,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const featuredItems = [...items]
    .sort((a, b) => {
      const aLive = a.freshnessState === 'live' ? 1 : 0
      const bLive = b.freshnessState === 'live' ? 1 : 0
      if (aLive !== bLive) {
        return bLive - aLive
      }

      const aPrimary = a.vessel.isPrimary ? 1 : 0
      const bPrimary = b.vessel.isPrimary ? 1 : 0
      if (aPrimary !== bPrimary) {
        return bPrimary - aPrimary
      }

      const aPassage = a.vessel.latestPassage?.startedAt || ''
      const bPassage = b.vessel.latestPassage?.startedAt || ''
      return bPassage.localeCompare(aPassage)
    })
    .slice(0, 6)

  return {
    items,
    featuredItems,
    stats: {
      publicCaptainCount: profileRows.length,
      publicVesselCount: items.length,
      liveVesselCount: items.filter((item) => item.freshnessState === 'live').length,
      recentVesselCount: items.filter((item) => item.freshnessState === 'recent').length,
    },
  }
})
