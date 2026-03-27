import { getRequestURL, type H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { generateApiKey } from '#layer/server/utils/auth'
import { apiKeys, users } from '#layer/server/database/schema'
import type { AppSessionUser } from '#server/utils/app-auth'
import {
  mediaItems,
  passages,
  publicProfiles,
  vesselInstallationApiKeys,
  vesselInstallations,
  vesselLiveSnapshots,
  vessels,
  waypoints,
} from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

const UI_AUDIT_USER_ID = 'ui-audit-user'
const UI_AUDIT_USER_EMAIL = 'ui-audit-captain@example.com'
const UI_AUDIT_USERNAME = 'captainrowan'
const UI_AUDIT_VESSEL_ID = 'ui-audit-vessel'
const UI_AUDIT_VESSEL_SLUG = 'north-star'
const UI_AUDIT_INSTALLATION_ID = 'ui-audit-installation'
const UI_AUDIT_API_KEY_ID = 'ui-audit-installation-key'
const UI_AUDIT_PASSAGE_ACTIVE_ID = 'ui-audit-passage-active'
const UI_AUDIT_PASSAGE_ARCHIVE_ID = 'ui-audit-passage-archive'
const UI_AUDIT_WAYPOINT_HARBOR_ID = 'ui-audit-waypoint-harbor'
const UI_AUDIT_WAYPOINT_ANCHORAGE_ID = 'ui-audit-waypoint-anchorage'
const UI_AUDIT_WAYPOINT_CHANNEL_ID = 'ui-audit-waypoint-channel'
const UI_AUDIT_MEDIA_DAWN_ID = 'ui-audit-media-dawn'
const UI_AUDIT_MEDIA_SQUALL_ID = 'ui-audit-media-squall'
const UI_AUDIT_MEDIA_HARBOR_ID = 'ui-audit-media-harbor'

const ISO_NOW = '2026-03-27T05:20:00.000Z'
const MEDIA_IMAGE_URL = '/images/hero-bg.webp'

export type UiAuditSeedResult = {
  username: string
  vesselSlug: string
  installationId: string
  routes: {
    dashboard: string
    onboarding: string
    vessel: string
    installation: string
    publicProfile: string
  }
}

export function isUiTestingEnabled(event: H3Event) {
  if (import.meta.dev) {
    return true
  }

  const requestUrl = getRequestURL(event)
  return requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1'
}

export function assertUiTestingEnabled(event: H3Event) {
  if (!isUiTestingEnabled(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found.' })
  }
}

export async function ensureUiTestingSessionUser(event: H3Event): Promise<AppSessionUser> {
  assertUiTestingEnabled(event)

  const db = useAppDatabase(event)
  const now = new Date().toISOString()
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, UI_AUDIT_USER_EMAIL))
    .get()
  const userId = existingUser?.id || UI_AUDIT_USER_ID

  if (existingUser) {
    await db
      .update(users)
      .set({
        name: 'Captain Rowan Hart',
        isAdmin: false,
        updatedAt: now,
      })
      .where(eq(users.id, existingUser.id))
  } else {
    await db.insert(users).values({
      id: userId,
      email: UI_AUDIT_USER_EMAIL,
      name: 'Captain Rowan Hart',
      isAdmin: false,
      passwordHash: null,
      appleId: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  return {
    id: userId,
    email: UI_AUDIT_USER_EMAIL,
    name: 'Captain Rowan Hart',
    isAdmin: false,
    authBackend: 'local',
    authProvider: 'email',
    authProviders: ['email'],
    emailConfirmedAt: now,
    needsPasswordSetup: false,
  }
}

export async function seedUiAuditWorkspace(
  event: H3Event,
  sessionUser: Pick<AppSessionUser, 'id'>,
): Promise<UiAuditSeedResult> {
  assertUiTestingEnabled(event)

  const db = useAppDatabase(event)
  const now = new Date().toISOString()

  const profileRow = await db
    .select({ userId: publicProfiles.userId })
    .from(publicProfiles)
    .where(eq(publicProfiles.userId, sessionUser.id))
    .get()

  if (profileRow) {
    await db
      .update(publicProfiles)
      .set({
        username: UI_AUDIT_USERNAME,
        headline: 'Bluewater passages, live telemetry, and a clean public ship log.',
        bio: 'Captain Rowan runs North Star across the Gulf and Caribbean, keeping live position, harbor memory, and install health in one disciplined surface.',
        homePort: 'Galveston, Texas',
        shareProfile: true,
        updatedAt: now,
      })
      .where(eq(publicProfiles.userId, sessionUser.id))
  } else {
    await db.insert(publicProfiles).values({
      userId: sessionUser.id,
      username: UI_AUDIT_USERNAME,
      headline: 'Bluewater passages, live telemetry, and a clean public ship log.',
      bio: 'Captain Rowan runs North Star across the Gulf and Caribbean, keeping live position, harbor memory, and install health in one disciplined surface.',
      homePort: 'Galveston, Texas',
      shareProfile: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  const vesselRow = await db.select().from(vessels).where(eq(vessels.id, UI_AUDIT_VESSEL_ID)).get()

  if (vesselRow) {
    await db
      .update(vessels)
      .set({
        ownerUserId: sessionUser.id,
        slug: UI_AUDIT_VESSEL_SLUG,
        name: 'North Star',
        vesselType: 'Bluewater cutter',
        homePort: 'Galveston, Texas',
        summary:
          'A long-range cutter tuned for Gulf crossings, disciplined live telemetry, and public-facing passage storytelling.',
        callSign: 'WDC8821',
        isPrimary: true,
        sharePublic: true,
        updatedAt: now,
      })
      .where(eq(vessels.id, UI_AUDIT_VESSEL_ID))
  } else {
    await db.insert(vessels).values({
      id: UI_AUDIT_VESSEL_ID,
      ownerUserId: sessionUser.id,
      slug: UI_AUDIT_VESSEL_SLUG,
      name: 'North Star',
      vesselType: 'Bluewater cutter',
      homePort: 'Galveston, Texas',
      summary:
        'A long-range cutter tuned for Gulf crossings, disciplined live telemetry, and public-facing passage storytelling.',
      callSign: 'WDC8821',
      isPrimary: true,
      sharePublic: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  const installationRow = await db
    .select()
    .from(vesselInstallations)
    .where(eq(vesselInstallations.id, UI_AUDIT_INSTALLATION_ID))
    .get()

  if (installationRow) {
    await db
      .update(vesselInstallations)
      .set({
        vesselId: UI_AUDIT_VESSEL_ID,
        label: 'Aft nav station collector',
        edgeHostname: 'north-star-aft-nav.local',
        signalKUrl: 'ws://north-star.local:3000/signalk/v1/stream',
        connectionState: 'live',
        lastSeenAt: ISO_NOW,
        eventCount: 8241,
        updatedAt: now,
      })
      .where(eq(vesselInstallations.id, UI_AUDIT_INSTALLATION_ID))
  } else {
    await db.insert(vesselInstallations).values({
      id: UI_AUDIT_INSTALLATION_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      label: 'Aft nav station collector',
      edgeHostname: 'north-star-aft-nav.local',
      signalKUrl: 'ws://north-star.local:3000/signalk/v1/stream',
      connectionState: 'live',
      lastSeenAt: ISO_NOW,
      eventCount: 8241,
      createdAt: now,
      updatedAt: now,
    })
  }

  await db.delete(vesselLiveSnapshots).where(eq(vesselLiveSnapshots.vesselId, UI_AUDIT_VESSEL_ID))
  await db.insert(vesselLiveSnapshots).values({
    vesselId: UI_AUDIT_VESSEL_ID,
    source: 'install',
    observedAt: ISO_NOW,
    positionLat: 29.2815,
    positionLng: -94.7973,
    headingMagnetic: 142,
    speedOverGround: 6.8,
    speedThroughWater: 6.4,
    windSpeedApparent: 17.2,
    windAngleApparent: 37,
    depthBelowTransducer: 12.4,
    waterTemperatureKelvin: 298.15,
    batteryVoltage: 13.1,
    engineRpm: 1820,
    statusNote: 'Steady offshore watch with clean wind and nav data.',
    updatedAt: now,
  })

  await db.delete(passages).where(eq(passages.vesselId, UI_AUDIT_VESSEL_ID))
  await db.insert(passages).values([
    {
      id: UI_AUDIT_PASSAGE_ACTIVE_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      title: 'Galveston to Freeport sea trial',
      summary:
        'A live coastal leg used to validate telemetry integrity, route history, and public-facing passage cards.',
      departureName: 'Galveston',
      arrivalName: 'Freeport',
      startedAt: '2026-03-26T13:05:00.000Z',
      endedAt: null,
      distanceNm: 42.3,
      maxWindKn: 22,
      trackGeojson: JSON.stringify({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-94.807, 29.301],
            [-94.785, 29.287],
            [-94.744, 29.241],
            [-94.612, 28.999],
          ],
        },
        properties: { name: 'Galveston to Freeport sea trial' },
      }),
      createdAt: now,
    },
    {
      id: UI_AUDIT_PASSAGE_ARCHIVE_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      title: 'Port Aransas return leg',
      summary:
        'An archived offshore return with enough structure to keep the timeline and public profile visually rich.',
      departureName: 'Port Aransas',
      arrivalName: 'Galveston',
      startedAt: '2026-03-18T11:40:00.000Z',
      endedAt: '2026-03-19T03:10:00.000Z',
      distanceNm: 186.7,
      maxWindKn: 31,
      trackGeojson: JSON.stringify({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-97.037, 27.834],
            [-96.741, 28.219],
            [-95.805, 28.782],
            [-94.794, 29.301],
          ],
        },
        properties: { name: 'Port Aransas return leg' },
      }),
      createdAt: now,
    },
  ])

  await db.delete(waypoints).where(eq(waypoints.vesselId, UI_AUDIT_VESSEL_ID))
  await db.insert(waypoints).values([
    {
      id: UI_AUDIT_WAYPOINT_HARBOR_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      passageId: UI_AUDIT_PASSAGE_ACTIVE_ID,
      title: 'Galveston Ship Channel',
      note: 'Exit line with stable AIS and depth feeds.',
      kind: 'channel',
      lat: 29.312,
      lng: -94.768,
      visitedAt: '2026-03-26T13:18:00.000Z',
      createdAt: now,
    },
    {
      id: UI_AUDIT_WAYPOINT_ANCHORAGE_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      passageId: UI_AUDIT_PASSAGE_ARCHIVE_ID,
      title: 'Matagorda Anchorage',
      note: 'Quiet anchorage with a clean dawn departure window.',
      kind: 'anchorage',
      lat: 28.615,
      lng: -95.969,
      visitedAt: '2026-03-19T00:40:00.000Z',
      createdAt: now,
    },
    {
      id: UI_AUDIT_WAYPOINT_CHANNEL_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      passageId: null,
      title: 'Freeport approach',
      note: 'Pilotage notes for the final approach and harbor entry.',
      kind: 'harbor',
      lat: 28.959,
      lng: -95.311,
      visitedAt: '2026-03-26T19:05:00.000Z',
      createdAt: now,
    },
  ])

  await db.delete(mediaItems).where(eq(mediaItems.vesselId, UI_AUDIT_VESSEL_ID))
  await db.insert(mediaItems).values([
    {
      id: UI_AUDIT_MEDIA_DAWN_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      passageId: UI_AUDIT_PASSAGE_ACTIVE_ID,
      title: 'Dawn watch change',
      caption: 'First light on a clean sea state with the nav stack settled and reporting.',
      imageUrl: MEDIA_IMAGE_URL,
      lat: 29.137,
      lng: -94.682,
      capturedAt: '2026-03-26T11:30:00.000Z',
      createdAt: now,
    },
    {
      id: UI_AUDIT_MEDIA_SQUALL_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      passageId: UI_AUDIT_PASSAGE_ARCHIVE_ID,
      title: 'Squall line off the beam',
      caption: 'A dense weather wall that pushed wind and sea state before the evening turn north.',
      imageUrl: MEDIA_IMAGE_URL,
      lat: 28.944,
      lng: -95.902,
      capturedAt: '2026-03-18T22:20:00.000Z',
      createdAt: now,
    },
    {
      id: UI_AUDIT_MEDIA_HARBOR_ID,
      vesselId: UI_AUDIT_VESSEL_ID,
      passageId: null,
      title: 'Harbor entry notes',
      caption: 'A visual checkpoint for approach lighting, dock posture, and final line handling.',
      imageUrl: MEDIA_IMAGE_URL,
      lat: 28.958,
      lng: -95.309,
      capturedAt: '2026-03-26T20:10:00.000Z',
      createdAt: now,
    },
  ])

  const installationKeyRow = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.id, UI_AUDIT_API_KEY_ID))
    .get()

  if (!installationKeyRow) {
    const { keyHash, keyPrefix } = await generateApiKey()
    await db.insert(apiKeys).values({
      id: UI_AUDIT_API_KEY_ID,
      userId: sessionUser.id,
      name: 'Aft nav station collector ingest key',
      keyHash,
      keyPrefix,
      createdAt: now,
      lastUsedAt: '2026-03-26T21:45:00.000Z',
    })
  }

  const installationKeyLink = await db
    .select({ apiKeyId: vesselInstallationApiKeys.apiKeyId })
    .from(vesselInstallationApiKeys)
    .where(eq(vesselInstallationApiKeys.apiKeyId, UI_AUDIT_API_KEY_ID))
    .get()

  if (!installationKeyLink) {
    await db.insert(vesselInstallationApiKeys).values({
      apiKeyId: UI_AUDIT_API_KEY_ID,
      installationId: UI_AUDIT_INSTALLATION_ID,
      createdAt: now,
    })
  }

  return {
    username: UI_AUDIT_USERNAME,
    vesselSlug: UI_AUDIT_VESSEL_SLUG,
    installationId: UI_AUDIT_INSTALLATION_ID,
    routes: {
      dashboard: '/dashboard',
      onboarding: '/dashboard/onboarding',
      vessel: `/dashboard/vessels/${UI_AUDIT_VESSEL_SLUG}`,
      installation: `/dashboard/installations/${UI_AUDIT_INSTALLATION_ID}`,
      publicProfile: `/${UI_AUDIT_USERNAME}`,
    },
  }
}
