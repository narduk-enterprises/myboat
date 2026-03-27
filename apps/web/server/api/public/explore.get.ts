import {
  getMediaForVesselIds,
  getPassagesForVesselIds,
  getPublicVesselsForExplore,
  getSnapshotsForVesselIds,
  getWaypointsForVesselIds,
} from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const vesselRows = await getPublicVesselsForExplore(event)
  const vesselIds = vesselRows.map((v) => v.id)

  const [snapshotRows, passageRows, mediaRows, waypointRows] = await Promise.all([
    getSnapshotsForVesselIds(event, vesselIds),
    getPassagesForVesselIds(event, vesselIds),
    getMediaForVesselIds(event, vesselIds),
    getWaypointsForVesselIds(event, vesselIds),
  ])

  const snapshotMap = new Map(snapshotRows.map((row) => [row.vesselId, row]))

  const latestPassageByVessel = new Map<string, (typeof passageRows)[number]>()
  for (const row of passageRows) {
    if (!latestPassageByVessel.has(row.vesselId)) {
      latestPassageByVessel.set(row.vesselId, row)
    }
  }

  const mediaCountByVessel = mediaRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.vesselId] = (acc[row.vesselId] ?? 0) + 1
    return acc
  }, {})

  const waypointCountByVessel = waypointRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.vesselId] = (acc[row.vesselId] ?? 0) + 1
    return acc
  }, {})

  return {
    vessels: vesselRows.map((vessel) => ({
      id: vessel.id,
      slug: vessel.slug,
      name: vessel.name,
      vesselType: vessel.vesselType,
      homePort: vessel.homePort,
      summary: vessel.summary,
      isPrimary: vessel.isPrimary,
      sharePublic: vessel.sharePublic,
      captainUsername: vessel.captainUsername,
      captainName: vessel.captainName,
      liveSnapshot: snapshotMap.get(vessel.id) ?? null,
      latestPassage: latestPassageByVessel.get(vessel.id) ?? null,
      mediaCount: mediaCountByVessel[vessel.id] ?? 0,
      waypointCount: waypointCountByVessel[vessel.id] ?? 0,
    })),
  }
})
