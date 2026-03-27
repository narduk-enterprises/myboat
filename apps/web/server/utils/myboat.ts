import type { H3Event } from 'h3'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { apiKeys, users } from '#layer/server/database/schema'
import {
  mediaItems,
  passages,
  publicProfiles,
  vesselInstallations,
  vesselInstallationApiKeys,
  vesselLiveSnapshots,
  vessels,
  waypoints,
} from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

function normalizeSlugPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

export function slugifyVesselName(value: string) {
  const normalized = normalizeSlugPart(value)
  return normalized || 'vessel'
}

export async function resolveUniqueVesselSlug(
  event: H3Event,
  userId: string,
  vesselName: string,
  existingVesselId?: string,
) {
  const db = useAppDatabase(event)
  const base = slugifyVesselName(vesselName)
  let candidate = base
  let suffix = 2

  while (true) {
    const conflict = await db
      .select({ id: vessels.id })
      .from(vessels)
      .where(and(eq(vessels.ownerUserId, userId), eq(vessels.slug, candidate)))
      .get()

    if (!conflict || conflict.id === existingVesselId) {
      return candidate
    }

    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

export function toCaptainProfileSummary(row: {
  username: string
  headline: string | null
  bio: string | null
  homePort: string | null
  captainName: string | null
}) {
  return {
    username: row.username,
    captainName: row.captainName || row.username,
    headline: row.headline,
    bio: row.bio,
    homePort: row.homePort,
  }
}

export function buildPassageMap<T extends { vesselId: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((accumulator, row) => {
    accumulator[row.vesselId] ||= []
    accumulator[row.vesselId]!.push(row)
    return accumulator
  }, {})
}

export async function getCaptainProfileByUserId(event: H3Event, userId: string) {
  const db = useAppDatabase(event)
  return db
    .select({
      userId: publicProfiles.userId,
      username: publicProfiles.username,
      headline: publicProfiles.headline,
      bio: publicProfiles.bio,
      homePort: publicProfiles.homePort,
      shareProfile: publicProfiles.shareProfile,
      captainName: users.name,
    })
    .from(publicProfiles)
    .innerJoin(users, eq(publicProfiles.userId, users.id))
    .where(eq(publicProfiles.userId, userId))
    .get()
}

export async function getCaptainProfileByUsername(event: H3Event, username: string) {
  const db = useAppDatabase(event)
  return db
    .select({
      userId: publicProfiles.userId,
      username: publicProfiles.username,
      headline: publicProfiles.headline,
      bio: publicProfiles.bio,
      homePort: publicProfiles.homePort,
      shareProfile: publicProfiles.shareProfile,
      captainName: users.name,
    })
    .from(publicProfiles)
    .innerJoin(users, eq(publicProfiles.userId, users.id))
    .where(eq(publicProfiles.username, username))
    .get()
}

export async function getUserVessels(event: H3Event, userId: string) {
  const db = useAppDatabase(event)
  return db
    .select()
    .from(vessels)
    .where(eq(vessels.ownerUserId, userId))
    .orderBy(desc(vessels.isPrimary), desc(vessels.createdAt))
    .all()
}

export async function getPublicVessels(event: H3Event, userId: string) {
  const db = useAppDatabase(event)
  return db
    .select()
    .from(vessels)
    .where(and(eq(vessels.ownerUserId, userId), eq(vessels.sharePublic, true)))
    .orderBy(desc(vessels.isPrimary), desc(vessels.createdAt))
    .all()
}

export async function getVesselBySlug(event: H3Event, userId: string, vesselSlug: string) {
  const db = useAppDatabase(event)
  return db
    .select()
    .from(vessels)
    .where(and(eq(vessels.ownerUserId, userId), eq(vessels.slug, vesselSlug)))
    .get()
}

export async function getSnapshotsForVesselIds(event: H3Event, vesselIds: string[]) {
  if (!vesselIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  return db
    .select()
    .from(vesselLiveSnapshots)
    .where(inArray(vesselLiveSnapshots.vesselId, vesselIds))
    .all()
}

export async function getPassagesForVesselIds(event: H3Event, vesselIds: string[]) {
  if (!vesselIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  return db
    .select({
      id: passages.id,
      vesselId: passages.vesselId,
      title: passages.title,
      summary: passages.summary,
      departureName: passages.departureName,
      arrivalName: passages.arrivalName,
      startedAt: passages.startedAt,
      endedAt: passages.endedAt,
      distanceNm: passages.distanceNm,
      maxWindKn: passages.maxWindKn,
      trackGeojson: passages.trackGeojson,
    })
    .from(passages)
    .where(inArray(passages.vesselId, vesselIds))
    .orderBy(desc(passages.startedAt))
    .all()
}

export async function getMediaForVesselIds(event: H3Event, vesselIds: string[]) {
  if (!vesselIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  return db
    .select({
      id: mediaItems.id,
      vesselId: mediaItems.vesselId,
      title: mediaItems.title,
      caption: mediaItems.caption,
      imageUrl: mediaItems.imageUrl,
      lat: mediaItems.lat,
      lng: mediaItems.lng,
      capturedAt: mediaItems.capturedAt,
      createdAt: mediaItems.createdAt,
    })
    .from(mediaItems)
    .where(inArray(mediaItems.vesselId, vesselIds))
    .orderBy(desc(mediaItems.capturedAt), desc(mediaItems.createdAt))
    .all()
}

export async function getWaypointsForVesselIds(event: H3Event, vesselIds: string[]) {
  if (!vesselIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  return db
    .select({
      id: waypoints.id,
      vesselId: waypoints.vesselId,
      title: waypoints.title,
      note: waypoints.note,
      kind: waypoints.kind,
      lat: waypoints.lat,
      lng: waypoints.lng,
      visitedAt: waypoints.visitedAt,
    })
    .from(waypoints)
    .where(inArray(waypoints.vesselId, vesselIds))
    .orderBy(desc(waypoints.visitedAt), desc(waypoints.createdAt))
    .all()
}

export async function getInstallationsForUser(event: H3Event, userId: string) {
  const db = useAppDatabase(event)
  return db
    .select({
      id: vesselInstallations.id,
      vesselId: vesselInstallations.vesselId,
      vesselSlug: vessels.slug,
      vesselName: vessels.name,
      label: vesselInstallations.label,
      edgeHostname: vesselInstallations.edgeHostname,
      signalKUrl: vesselInstallations.signalKUrl,
      connectionState: vesselInstallations.connectionState,
      lastSeenAt: vesselInstallations.lastSeenAt,
      eventCount: vesselInstallations.eventCount,
    })
    .from(vesselInstallations)
    .innerJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
    .where(eq(vessels.ownerUserId, userId))
    .orderBy(desc(vesselInstallations.updatedAt))
    .all()
}

export async function getInstallationDetail(
  event: H3Event,
  userId: string,
  installationId: string,
) {
  const db = useAppDatabase(event)

  const installation = await db
    .select({
      id: vesselInstallations.id,
      vesselId: vesselInstallations.vesselId,
      vesselSlug: vessels.slug,
      vesselName: vessels.name,
      label: vesselInstallations.label,
      edgeHostname: vesselInstallations.edgeHostname,
      signalKUrl: vesselInstallations.signalKUrl,
      connectionState: vesselInstallations.connectionState,
      lastSeenAt: vesselInstallations.lastSeenAt,
      eventCount: vesselInstallations.eventCount,
    })
    .from(vesselInstallations)
    .innerJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
    .where(and(eq(vesselInstallations.id, installationId), eq(vessels.ownerUserId, userId)))
    .get()

  if (!installation) {
    return null
  }

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(vesselInstallationApiKeys)
    .innerJoin(apiKeys, eq(vesselInstallationApiKeys.apiKeyId, apiKeys.id))
    .where(eq(vesselInstallationApiKeys.installationId, installationId))
    .orderBy(desc(apiKeys.createdAt))
    .all()

  return {
    installation,
    keys,
  }
}

export function serializeVesselCards(
  vesselRows: Awaited<ReturnType<typeof getUserVessels>>,
  snapshotRows: Awaited<ReturnType<typeof getSnapshotsForVesselIds>>,
  passageRows: Awaited<ReturnType<typeof getPassagesForVesselIds>>,
  mediaRows: Awaited<ReturnType<typeof getMediaForVesselIds>>,
  waypointRows: Awaited<ReturnType<typeof getWaypointsForVesselIds>>,
) {
  const snapshotMap = new Map(snapshotRows.map((row) => [row.vesselId, row]))
  const latestPassageByVessel = new Map<string, (typeof passageRows)[number]>()
  for (const row of passageRows) {
    if (!latestPassageByVessel.has(row.vesselId)) {
      latestPassageByVessel.set(row.vesselId, row)
    }
  }

  const mediaCountByVessel = mediaRows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.vesselId] = (accumulator[row.vesselId] || 0) + 1
    return accumulator
  }, {})

  const waypointCountByVessel = waypointRows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.vesselId] = (accumulator[row.vesselId] || 0) + 1
    return accumulator
  }, {})

  return vesselRows.map((vessel) => ({
    id: vessel.id,
    slug: vessel.slug,
    name: vessel.name,
    vesselType: vessel.vesselType,
    homePort: vessel.homePort,
    summary: vessel.summary,
    isPrimary: vessel.isPrimary,
    sharePublic: vessel.sharePublic,
    latestPassage: latestPassageByVessel.get(vessel.id) || null,
    liveSnapshot: snapshotMap.get(vessel.id) || null,
    mediaCount: mediaCountByVessel[vessel.id] || 0,
    waypointCount: waypointCountByVessel[vessel.id] || 0,
  }))
}
