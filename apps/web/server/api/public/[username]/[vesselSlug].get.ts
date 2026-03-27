import {
  getMediaForVesselIds,
  getPassagesForVesselIds,
  getPublicVesselBySlug,
  getSnapshotsForVesselIds,
  getWaypointsForVesselIds,
} from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')
  const vesselSlug = getRouterParam(event, 'vesselSlug')

  if (!username || !vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing route parameters.' })
  }

  const vessel = await getPublicVesselBySlug(event, username, vesselSlug)

  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Vessel not found or not public.' })
  }

  const vesselIds = [vessel.id]
  const [snapshotRows, passageRows, mediaRows, waypointRows] = await Promise.all([
    getSnapshotsForVesselIds(event, vesselIds),
    getPassagesForVesselIds(event, vesselIds),
    getMediaForVesselIds(event, vesselIds),
    getWaypointsForVesselIds(event, vesselIds),
  ])

  const liveSnapshot = snapshotRows[0] ?? null
  const latestPassage = passageRows[0] ?? null

  return {
    profile: {
      username: vessel.captainUsername,
      captainName: vessel.captainName,
      headline: vessel.captainHeadline,
      bio: vessel.captainBio,
      homePort: vessel.captainHomePort,
    },
    vessel: {
      id: vessel.id,
      slug: vessel.slug,
      name: vessel.name,
      vesselType: vessel.vesselType,
      homePort: vessel.homePort,
      summary: vessel.summary,
      isPrimary: vessel.isPrimary,
      sharePublic: vessel.sharePublic,
      latestPassage: latestPassage
        ? {
            id: latestPassage.id,
            title: latestPassage.title,
            summary: latestPassage.summary,
            departureName: latestPassage.departureName,
            arrivalName: latestPassage.arrivalName,
            startedAt: latestPassage.startedAt,
            endedAt: latestPassage.endedAt,
            distanceNm: latestPassage.distanceNm,
            maxWindKn: latestPassage.maxWindKn,
            trackGeojson: latestPassage.trackGeojson,
          }
        : null,
      liveSnapshot,
      mediaCount: mediaRows.length,
      waypointCount: waypointRows.length,
    },
    passages: passageRows.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      departureName: p.departureName,
      arrivalName: p.arrivalName,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
      distanceNm: p.distanceNm,
      maxWindKn: p.maxWindKn,
      trackGeojson: p.trackGeojson,
    })),
    media: mediaRows.map((item) => ({
      id: item.id,
      title: item.title,
      caption: item.caption,
      imageUrl: item.imageUrl,
      lat: item.lat,
      lng: item.lng,
      capturedAt: item.capturedAt,
    })),
    waypoints: waypointRows.map((w) => ({
      id: w.id,
      title: w.title,
      note: w.note,
      kind: w.kind,
      lat: w.lat,
      lng: w.lng,
      visitedAt: w.visitedAt,
    })),
  }
})
