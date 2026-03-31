import type { H3Event } from 'h3'
import type { AisHubSearchResult } from '~/types/myboat'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { apiKeys, users } from '#layer/server/database/schema'
import {
  aishubVessels,
  type AisHubVessel,
  type FollowedVessel,
  followedVessels,
  mediaItems,
  passages,
  publicProfiles,
  vesselInstallationObservedIdentities,
  vesselInstallations,
  vesselInstallationApiKeys,
  vesselLiveSnapshots,
  vesselObservedIdentities,
  vessels,
  waypoints,
} from '#server/database/app-schema'
import { D1_MAX_BOUND_PARAMETERS_PER_QUERY, useAppDatabase } from '#server/utils/database'
import { serializeObservedIdentitySummary } from '#server/utils/vesselIdentity'

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

export function getPublicFreshnessState(observedAt: string | null) {
  if (!observedAt) {
    return 'offline' as const
  }

  const observedMs = new Date(observedAt).getTime()

  if (Number.isNaN(observedMs)) {
    return 'stale' as const
  }

  const ageMinutes = (Date.now() - observedMs) / 60_000

  if (ageMinutes <= 15) {
    return 'live' as const
  }

  if (ageMinutes <= 120) {
    return 'recent' as const
  }

  return 'stale' as const
}

export function buildPassageMap<T extends { vesselId: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((accumulator, row) => {
    accumulator[row.vesselId] ||= []
    accumulator[row.vesselId]!.push(row)
    return accumulator
  }, {})
}

function parseSourceStations(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

type FollowedVesselAuthoritySnapshot = Pick<
  AisHubVessel,
  | 'mmsi'
  | 'imo'
  | 'name'
  | 'callSign'
  | 'destination'
  | 'lastReportAt'
  | 'positionLat'
  | 'positionLng'
  | 'shipType'
  | 'sourceStationsJson'
> & {
  updatedAt: string | null
}

export function mergeFollowedVesselAuthority(
  row: FollowedVessel,
  authority: FollowedVesselAuthoritySnapshot | null,
): FollowedVessel {
  if (!authority) {
    return row
  }

  return {
    ...row,
    source: 'aishub',
    imo: authority.imo,
    name: authority.name,
    callSign: authority.callSign,
    destination: authority.destination,
    lastReportAt: authority.lastReportAt,
    positionLat: authority.positionLat,
    positionLng: authority.positionLng,
    shipType: authority.shipType,
    sourceStationsJson: authority.sourceStationsJson,
    updatedAt: authority.updatedAt || row.updatedAt,
  }
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

export async function getDiscoverableCaptainProfiles(event: H3Event) {
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
    .where(eq(publicProfiles.shareProfile, true))
    .all()
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

export async function getAllPublicVessels(event: H3Event) {
  const db = useAppDatabase(event)
  return db
    .select()
    .from(vessels)
    .innerJoin(publicProfiles, eq(vessels.ownerUserId, publicProfiles.userId))
    .where(and(eq(vessels.sharePublic, true), eq(publicProfiles.shareProfile, true)))
    .orderBy(desc(vessels.isPrimary), desc(vessels.createdAt))
    .all()
}

export async function getFollowedVesselsForUser(event: H3Event, userId: string) {
  const db = useAppDatabase(event)
  const rows = await db
    .select({
      id: followedVessels.id,
      ownerUserId: followedVessels.ownerUserId,
      source: followedVessels.source,
      matchMode: followedVessels.matchMode,
      mmsi: followedVessels.mmsi,
      imo: followedVessels.imo,
      name: followedVessels.name,
      callSign: followedVessels.callSign,
      destination: followedVessels.destination,
      lastReportAt: followedVessels.lastReportAt,
      positionLat: followedVessels.positionLat,
      positionLng: followedVessels.positionLng,
      shipType: followedVessels.shipType,
      sourceStationsJson: followedVessels.sourceStationsJson,
      createdAt: followedVessels.createdAt,
      updatedAt: followedVessels.updatedAt,
      authoritativeMmsi: aishubVessels.mmsi,
      authoritativeImo: aishubVessels.imo,
      authoritativeName: aishubVessels.name,
      authoritativeCallSign: aishubVessels.callSign,
      authoritativeDestination: aishubVessels.destination,
      authoritativeLastReportAt: aishubVessels.lastReportAt,
      authoritativePositionLat: aishubVessels.positionLat,
      authoritativePositionLng: aishubVessels.positionLng,
      authoritativeShipType: aishubVessels.shipType,
      authoritativeSourceStationsJson: aishubVessels.sourceStationsJson,
      authoritativeUpdatedAt: aishubVessels.updatedAt,
    })
    .from(followedVessels)
    .leftJoin(aishubVessels, eq(followedVessels.mmsi, aishubVessels.mmsi))
    .where(eq(followedVessels.ownerUserId, userId))
    .orderBy(desc(followedVessels.updatedAt), desc(followedVessels.createdAt))
    .all()

  return rows.map((row) =>
    mergeFollowedVesselAuthority(
      row,
      row.authoritativeMmsi
        ? {
            mmsi: row.authoritativeMmsi,
            imo: row.authoritativeImo,
            name: row.authoritativeName || row.name,
            callSign: row.authoritativeCallSign,
            destination: row.authoritativeDestination,
            lastReportAt: row.authoritativeLastReportAt,
            positionLat: row.authoritativePositionLat,
            positionLng: row.authoritativePositionLng,
            shipType: row.authoritativeShipType,
            sourceStationsJson: row.authoritativeSourceStationsJson || '[]',
            updatedAt: row.authoritativeUpdatedAt,
          }
        : null,
    ),
  )
}

export async function getFollowedVesselMmsisForUser(event: H3Event, userId: string) {
  const db = useAppDatabase(event)
  const rows = await db
    .select({ mmsi: followedVessels.mmsi })
    .from(followedVessels)
    .where(eq(followedVessels.ownerUserId, userId))
    .all()

  return [...new Set(rows.map((row) => row.mmsi.trim()).filter(Boolean))]
}

export async function getTrackedFollowedVesselMmsis(event: H3Event) {
  const db = useAppDatabase(event)
  const rows = await db.select({ mmsi: followedVessels.mmsi }).from(followedVessels).all()

  return [...new Set(rows.map((row) => row.mmsi.trim()).filter(Boolean))]
}

export function serializeFollowedVessel(row: FollowedVessel) {
  return {
    id: row.id,
    source: 'aishub' as const,
    matchMode: row.matchMode === 'name' ? 'name' : 'mmsi',
    mmsi: row.mmsi,
    imo: row.imo,
    name: row.name,
    callSign: row.callSign,
    destination: row.destination,
    lastReportAt: row.lastReportAt,
    positionLat: row.positionLat,
    positionLng: row.positionLng,
    shipType: row.shipType,
    sourceStations: parseSourceStations(row.sourceStationsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function serializeFollowedVessels(
  rows: Awaited<ReturnType<typeof getFollowedVesselsForUser>>,
) {
  return rows.map(serializeFollowedVessel)
}

export async function upsertFollowedVesselsForUser(
  event: H3Event,
  userId: string,
  results: AisHubSearchResult[],
  now = new Date().toISOString(),
) {
  const uniqueResults = results.filter(
    (result, index, collection) =>
      collection.findIndex((candidate) => candidate.mmsi === result.mmsi) === index,
  )

  if (!uniqueResults.length) {
    return []
  }

  const db = useAppDatabase(event)

  for (const result of uniqueResults) {
    await db
      .insert(followedVessels)
      .values({
        id: crypto.randomUUID(),
        ownerUserId: userId,
        source: result.source,
        matchMode: result.matchMode,
        mmsi: result.mmsi,
        imo: result.imo || null,
        name: result.name,
        callSign: result.callSign || null,
        destination: result.destination || null,
        lastReportAt: result.lastReportAt || null,
        positionLat: result.positionLat ?? null,
        positionLng: result.positionLng ?? null,
        shipType: result.shipType ?? null,
        sourceStationsJson: JSON.stringify(result.sourceStations),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [followedVessels.ownerUserId, followedVessels.mmsi],
        set: {
          source: result.source,
          matchMode: result.matchMode,
          imo: result.imo || null,
          name: result.name,
          callSign: result.callSign || null,
          destination: result.destination || null,
          lastReportAt: result.lastReportAt || null,
          positionLat: result.positionLat ?? null,
          positionLng: result.positionLng ?? null,
          shipType: result.shipType ?? null,
          sourceStationsJson: JSON.stringify(result.sourceStations),
          updatedAt: now,
        },
      })
  }

  const savedRows = await db
    .select()
    .from(followedVessels)
    .where(
      and(
        eq(followedVessels.ownerUserId, userId),
        inArray(
          followedVessels.mmsi,
          uniqueResults.map((result) => result.mmsi),
        ),
      ),
    )
    .all()

  const rowsByMmsi = new Map(savedRows.map((row) => [row.mmsi, row]))

  return uniqueResults
    .map((result) => rowsByMmsi.get(result.mmsi))
    .filter((row): row is FollowedVessel => Boolean(row))
    .map(serializeFollowedVessel)
}

export async function upsertFollowedVesselForUser(
  event: H3Event,
  userId: string,
  result: AisHubSearchResult,
  now = new Date().toISOString(),
) {
  const [savedVessel] = await upsertFollowedVesselsForUser(event, userId, [result], now)

  if (!savedVessel) {
    throw new Error('Unable to load saved buddy boat.')
  }

  return savedVessel
}

export async function syncFollowedVesselsFromAisHubForMmsis(
  event: H3Event,
  mmsis: string[],
  now = new Date().toISOString(),
) {
  const uniqueMmsis = [...new Set(mmsis.map((mmsi) => mmsi.trim()).filter(Boolean))]

  if (!uniqueMmsis.length) {
    return 0
  }

  const db = useAppDatabase(event)
  const authoritativeRows = []
  for (let index = 0; index < uniqueMmsis.length; index += D1_MAX_BOUND_PARAMETERS_PER_QUERY) {
    const batch = uniqueMmsis.slice(index, index + D1_MAX_BOUND_PARAMETERS_PER_QUERY)
    const batchRows = await db
      .select({
        mmsi: aishubVessels.mmsi,
        imo: aishubVessels.imo,
        name: aishubVessels.name,
        callSign: aishubVessels.callSign,
        destination: aishubVessels.destination,
        lastReportAt: aishubVessels.lastReportAt,
        positionLat: aishubVessels.positionLat,
        positionLng: aishubVessels.positionLng,
        shipType: aishubVessels.shipType,
        sourceStationsJson: aishubVessels.sourceStationsJson,
      })
      .from(aishubVessels)
      .where(inArray(aishubVessels.mmsi, batch))
      .all()
    authoritativeRows.push(...batchRows)
  }

  for (const row of authoritativeRows) {
    await db
      .update(followedVessels)
      .set({
        source: 'aishub',
        imo: row.imo,
        name: row.name,
        callSign: row.callSign,
        destination: row.destination,
        lastReportAt: row.lastReportAt,
        positionLat: row.positionLat,
        positionLng: row.positionLng,
        shipType: row.shipType,
        sourceStationsJson: row.sourceStationsJson,
        updatedAt: now,
      })
      .where(eq(followedVessels.mmsi, row.mmsi))
  }

  return authoritativeRows.length
}

export async function getPublicVesselByUsernameAndSlug(
  event: H3Event,
  username: string,
  vesselSlug: string,
) {
  const db = useAppDatabase(event)
  return db
    .select({
      id: vessels.id,
      ownerUserId: vessels.ownerUserId,
      slug: vessels.slug,
      name: vessels.name,
      vesselType: vessels.vesselType,
      homePort: vessels.homePort,
      summary: vessels.summary,
      callSign: vessels.callSign,
      isPrimary: vessels.isPrimary,
      sharePublic: vessels.sharePublic,
      createdAt: vessels.createdAt,
      updatedAt: vessels.updatedAt,
    })
    .from(vessels)
    .innerJoin(publicProfiles, eq(vessels.ownerUserId, publicProfiles.userId))
    .where(
      and(
        eq(publicProfiles.username, username),
        eq(publicProfiles.shareProfile, true),
        eq(vessels.slug, vesselSlug),
        eq(vessels.sharePublic, true),
      ),
    )
    .get()
}

export async function getPublicVesselBySlug(event: H3Event, userId: string, vesselSlug: string) {
  const db = useAppDatabase(event)
  return db
    .select()
    .from(vessels)
    .where(
      and(
        eq(vessels.ownerUserId, userId),
        eq(vessels.slug, vesselSlug),
        eq(vessels.sharePublic, true),
      ),
    )
    .get()
}

export async function getVesselBySlug(event: H3Event, userId: string, vesselSlug: string) {
  const db = useAppDatabase(event)
  return db
    .select()
    .from(vessels)
    .where(and(eq(vessels.ownerUserId, userId), eq(vessels.slug, vesselSlug)))
    .get()
}

export async function getPublicExploreRows(event: H3Event) {
  const db = useAppDatabase(event)
  return db
    .select({
      userId: publicProfiles.userId,
      username: publicProfiles.username,
      headline: publicProfiles.headline,
      bio: publicProfiles.bio,
      homePort: publicProfiles.homePort,
      captainName: users.name,
      vesselId: vessels.id,
      vesselSlug: vessels.slug,
      vesselName: vessels.name,
      vesselType: vessels.vesselType,
      vesselHomePort: vessels.homePort,
      vesselSummary: vessels.summary,
      callSign: vessels.callSign,
      isPrimary: vessels.isPrimary,
      sharePublic: vessels.sharePublic,
      createdAt: vessels.createdAt,
      updatedAt: vessels.updatedAt,
    })
    .from(vessels)
    .innerJoin(publicProfiles, eq(vessels.ownerUserId, publicProfiles.userId))
    .innerJoin(users, eq(publicProfiles.userId, users.id))
    .where(and(eq(publicProfiles.shareProfile, true), eq(vessels.sharePublic, true)))
    .orderBy(desc(vessels.isPrimary), desc(vessels.updatedAt))
    .all()
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

export async function getObservedIdentitiesForVesselIds(event: H3Event, vesselIds: string[]) {
  if (!vesselIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  return db
    .select()
    .from(vesselObservedIdentities)
    .where(inArray(vesselObservedIdentities.vesselId, vesselIds))
    .all()
}

export async function getInstallationObservedIdentitiesForInstallationIds(
  event: H3Event,
  installationIds: string[],
) {
  if (!installationIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  return db
    .select()
    .from(vesselInstallationObservedIdentities)
    .where(inArray(vesselInstallationObservedIdentities.installationId, installationIds))
    .all()
}

export async function getPassagesForVesselIds(event: H3Event, vesselIds: string[]) {
  if (!vesselIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  const rows = await db
    .select({
      id: passages.id,
      vesselId: passages.vesselId,
      title: passages.title,
      summary: passages.summary,
      departureName: passages.departureName,
      arrivalName: passages.arrivalName,
      startPlaceLabel: passages.startPlaceLabel,
      endPlaceLabel: passages.endPlaceLabel,
      startedAt: passages.startedAt,
      endedAt: passages.endedAt,
      distanceNm: passages.distanceNm,
      maxWindKn: passages.maxWindKn,
      trackGeojson: passages.trackGeojson,
      playbackJson: passages.playbackJson,
    })
    .from(passages)
    .where(inArray(passages.vesselId, vesselIds))
    .orderBy(desc(passages.startedAt))
    .all()

  return rows.map(({ playbackJson, ...row }) => ({
    ...row,
    playbackAvailable: Boolean(playbackJson || row.trackGeojson),
  }))
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
      passageId: mediaItems.passageId,
      title: mediaItems.title,
      caption: mediaItems.caption,
      imageUrl: mediaItems.imageUrl,
      sharePublic: mediaItems.sharePublic,
      matchStatus: mediaItems.matchStatus,
      matchScore: mediaItems.matchScore,
      matchReason: mediaItems.matchReason,
      isCover: mediaItems.isCover,
      sourceKind: mediaItems.sourceKind,
      sourceAssetId: mediaItems.sourceAssetId,
      sourceFingerprint: mediaItems.sourceFingerprint,
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

export async function getPublicMediaForVesselIds(event: H3Event, vesselIds: string[]) {
  if (!vesselIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  return db
    .select({
      id: mediaItems.id,
      vesselId: mediaItems.vesselId,
      passageId: mediaItems.passageId,
      title: mediaItems.title,
      caption: mediaItems.caption,
      imageUrl: mediaItems.imageUrl,
      sharePublic: mediaItems.sharePublic,
      matchStatus: mediaItems.matchStatus,
      matchScore: mediaItems.matchScore,
      matchReason: mediaItems.matchReason,
      isCover: mediaItems.isCover,
      sourceKind: mediaItems.sourceKind,
      sourceAssetId: mediaItems.sourceAssetId,
      sourceFingerprint: mediaItems.sourceFingerprint,
      lat: mediaItems.lat,
      lng: mediaItems.lng,
      capturedAt: mediaItems.capturedAt,
      createdAt: mediaItems.createdAt,
    })
    .from(mediaItems)
    .where(and(inArray(mediaItems.vesselId, vesselIds), eq(mediaItems.sharePublic, true)))
    .orderBy(desc(mediaItems.capturedAt), desc(mediaItems.createdAt))
    .all()
}

export function serializeMediaItemSummary(
  item: Awaited<ReturnType<typeof getMediaForVesselIds>>[number],
) {
  return {
    id: item.id,
    passageId: item.passageId,
    title: item.title,
    caption: item.caption,
    imageUrl: item.imageUrl,
    sharePublic: item.sharePublic,
    matchStatus: item.matchStatus as 'attached' | 'review',
    matchScore: item.matchScore,
    matchReason: item.matchReason,
    isCover: item.isCover,
    lat: item.lat,
    lng: item.lng,
    capturedAt: item.capturedAt,
  }
}

export async function getPublicInstallationsForVesselIds(event: H3Event, vesselIds: string[]) {
  if (!vesselIds.length) {
    return []
  }

  const db = useAppDatabase(event)
  return db
    .select({
      id: vesselInstallations.id,
      vesselId: vesselInstallations.vesselId,
      vesselSlug: vessels.slug,
      vesselName: vessels.name,
      label: vesselInstallations.label,
      isPrimary: vesselInstallations.isPrimary,
      connectionState: vesselInstallations.connectionState,
      lastSeenAt: vesselInstallations.lastSeenAt,
      eventCount: vesselInstallations.eventCount,
    })
    .from(vesselInstallations)
    .innerJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
    .where(
      and(inArray(vesselInstallations.vesselId, vesselIds), isNull(vesselInstallations.archivedAt)),
    )
    .orderBy(desc(vesselInstallations.updatedAt))
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
      passageId: waypoints.passageId,
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
  const installations = await db
    .select({
      id: vesselInstallations.id,
      vesselId: vesselInstallations.vesselId,
      vesselSlug: vessels.slug,
      vesselName: vessels.name,
      label: vesselInstallations.label,
      installationType: vesselInstallations.installationType,
      edgeHostname: vesselInstallations.edgeHostname,
      isPrimary: vesselInstallations.isPrimary,
      connectionState: vesselInstallations.connectionState,
      lastSeenAt: vesselInstallations.lastSeenAt,
      eventCount: vesselInstallations.eventCount,
    })
    .from(vesselInstallations)
    .innerJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
    .where(and(eq(vessels.ownerUserId, userId), isNull(vesselInstallations.archivedAt)))
    .orderBy(desc(vesselInstallations.isPrimary), desc(vesselInstallations.updatedAt))
    .all()

  const observedIdentityRows = await getInstallationObservedIdentitiesForInstallationIds(
    event,
    installations.map((installation) => installation.id),
  )
  const observedIdentityMap = new Map(
    observedIdentityRows.map((row) => [row.installationId, row] as const),
  )

  return installations.map((installation) => ({
    ...installation,
    observedIdentity: serializeObservedIdentitySummary(observedIdentityMap.get(installation.id)),
  }))
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
      installationType: vesselInstallations.installationType,
      edgeHostname: vesselInstallations.edgeHostname,
      isPrimary: vesselInstallations.isPrimary,
      connectionState: vesselInstallations.connectionState,
      lastSeenAt: vesselInstallations.lastSeenAt,
      eventCount: vesselInstallations.eventCount,
    })
    .from(vesselInstallations)
    .innerJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
    .where(
      and(
        eq(vesselInstallations.id, installationId),
        eq(vessels.ownerUserId, userId),
        isNull(vesselInstallations.archivedAt),
      ),
    )
    .get()

  if (!installation) {
    return null
  }

  const observedIdentity = await db
    .select()
    .from(vesselInstallationObservedIdentities)
    .where(eq(vesselInstallationObservedIdentities.installationId, installationId))
    .get()

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
    installation: {
      ...installation,
      observedIdentity: serializeObservedIdentitySummary(observedIdentity),
    },
    keys,
  }
}

export type FreshnessState = 'live' | 'recent' | 'stale' | 'offline'

export function classifyFreshnessState(observedAt: string | null | undefined): FreshnessState {
  if (!observedAt) {
    return 'offline'
  }

  const observed = new Date(observedAt).getTime()
  if (Number.isNaN(observed)) {
    return 'offline'
  }

  const ageMs = Date.now() - observed
  if (ageMs <= 2 * 60 * 1000) {
    return 'live'
  }
  if (ageMs <= 30 * 60 * 1000) {
    return 'recent'
  }
  return 'stale'
}

export function serializeVesselCards(
  vesselRows: Awaited<ReturnType<typeof getUserVessels>>,
  snapshotRows: Awaited<ReturnType<typeof getSnapshotsForVesselIds>>,
  passageRows: Awaited<ReturnType<typeof getPassagesForVesselIds>>,
  mediaRows: Awaited<ReturnType<typeof getMediaForVesselIds>>,
  waypointRows: Awaited<ReturnType<typeof getWaypointsForVesselIds>>,
  observedIdentityRows: Awaited<ReturnType<typeof getObservedIdentitiesForVesselIds>> = [],
) {
  const snapshotMap = new Map(snapshotRows.map((row) => [row.vesselId, row]))
  const observedIdentityMap = new Map(
    observedIdentityRows.map((row) => [row.vesselId, row] as const),
  )
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
    observedIdentity: serializeObservedIdentitySummary(observedIdentityMap.get(vessel.id)),
    isPrimary: vessel.isPrimary,
    sharePublic: vessel.sharePublic,
    latestPassage: latestPassageByVessel.get(vessel.id) || null,
    liveSnapshot: snapshotMap.get(vessel.id) || null,
    mediaCount: mediaCountByVessel[vessel.id] || 0,
    waypointCount: waypointCountByVessel[vessel.id] || 0,
  }))
}
