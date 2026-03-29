import type { H3Event } from 'h3'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { AisContactSummary, VesselSnapshotSummary } from '../../app/types/myboat'
import type { TrafficContactDetailSummary } from '../../app/types/traffic'
import { useRuntimeConfig } from '#imports'
import { getStoredAisHubResultsByMmsis } from '#server/utils/aishub'
import { vesselInstallations } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

const SIGNALK_TRAFFIC_TIMEOUT_MS = 8_000

type TrafficMetadata = Pick<
  AisContactSummary,
  | 'name'
  | 'mmsi'
  | 'shipType'
  | 'destination'
  | 'callSign'
  | 'length'
  | 'beam'
  | 'draft'
  | 'navState'
>

function normalizeContactId(value: string | null | undefined) {
  return value?.trim() || null
}

function extractMmsiFromContactId(contactId: string | null | undefined) {
  const normalized = normalizeContactId(contactId)
  if (!normalized) {
    return null
  }

  const match = normalized.match(/mmsi:(\d{6,})/i)
  return match?.[1] || null
}

function unwrapSignalKValue(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'value' in value &&
    Object.keys(value).length <= 8
  ) {
    return unwrapSignalKValue((value as { value?: unknown }).value)
  }

  return value
}

function readSignalKPath(model: unknown, path: string) {
  const segments = path.split('.')
  let current = model

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return unwrapSignalKValue(current)
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeSignalKBaseUrl(rawValue: string | null | undefined) {
  const raw = rawValue?.trim()
  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw)
    if (url.protocol === 'ws:') {
      url.protocol = 'http:'
    } else if (url.protocol === 'wss:') {
      url.protocol = 'https:'
    }

    const pathname = url.pathname.replaceAll(/\/+$/g, '')
    if (pathname.endsWith('/signalk/v1/stream')) {
      url.pathname = pathname.slice(0, -'/signalk/v1/stream'.length) || '/'
    } else if (pathname.endsWith('/signalk/v1/api/vessels')) {
      url.pathname = pathname.slice(0, -'/signalk/v1/api/vessels'.length) || '/'
    } else if (pathname.endsWith('/signalk/v1/api')) {
      url.pathname = pathname.slice(0, -'/signalk/v1/api'.length) || '/'
    } else if (pathname.endsWith('/signalk/v1')) {
      url.pathname = pathname.slice(0, -'/signalk/v1'.length) || '/'
    }

    url.search = ''
    url.hash = ''

    return url.toString().replaceAll(/\/+$/g, '')
  } catch {
    return null
  }
}

function buildSignalKVesselsUrl(baseUrl: string) {
  return new URL(`${baseUrl.replaceAll(/\/+$/g, '')}/signalk/v1/api/vessels`)
}

function getSignalKContextIdentity(context: string) {
  const normalized = context.trim()
  if (!normalized || normalized === 'self') {
    return null
  }

  const mmsiMatch = normalized.match(/mmsi:(\d{6,})/i)
  if (mmsiMatch) {
    return {
      id: `mmsi:${mmsiMatch[1]}`,
      mmsi: mmsiMatch[1],
    }
  }

  return {
    id: normalized,
    mmsi: null,
  }
}

function trafficDisplayName(contact: Pick<AisContactSummary, 'id' | 'mmsi' | 'name'>) {
  if (contact.name) {
    return contact.name
  }

  if (contact.mmsi) {
    return `MMSI ${contact.mmsi}`
  }

  return contact.id.slice(0, 18)
}

function preferDefined<T>(next: T | null | undefined, previous: T | null | undefined) {
  return next ?? previous ?? null
}

function mergeTrafficMetadata(
  current: AisContactSummary,
  signalKMetadata: TrafficMetadata | null | undefined,
  aisHubMetadata: TrafficMetadata | null | undefined,
): AisContactSummary {
  const metadata = signalKMetadata || aisHubMetadata
  if (!metadata && !aisHubMetadata) {
    return current
  }

  return {
    id: current.id,
    name: preferDefined(current.name, preferDefined(signalKMetadata?.name, aisHubMetadata?.name)),
    mmsi: preferDefined(current.mmsi, preferDefined(signalKMetadata?.mmsi, aisHubMetadata?.mmsi)),
    shipType: preferDefined(
      current.shipType,
      preferDefined(signalKMetadata?.shipType, aisHubMetadata?.shipType),
    ),
    lat: current.lat,
    lng: current.lng,
    cog: current.cog,
    sog: current.sog,
    heading: current.heading,
    destination: preferDefined(
      current.destination,
      preferDefined(signalKMetadata?.destination, aisHubMetadata?.destination),
    ),
    callSign: preferDefined(
      current.callSign,
      preferDefined(signalKMetadata?.callSign, aisHubMetadata?.callSign),
    ),
    length: preferDefined(
      current.length,
      preferDefined(signalKMetadata?.length, aisHubMetadata?.length),
    ),
    beam: preferDefined(current.beam, preferDefined(signalKMetadata?.beam, aisHubMetadata?.beam)),
    draft: preferDefined(
      current.draft,
      preferDefined(signalKMetadata?.draft, aisHubMetadata?.draft),
    ),
    navState: preferDefined(
      current.navState,
      preferDefined(signalKMetadata?.navState, aisHubMetadata?.navState),
    ),
    lastUpdateAt: current.lastUpdateAt,
  }
}

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMeters = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2

  return (earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1852
}

async function resolveSignalKBaseUrlForVessel(event: H3Event, vesselId: string) {
  const db = useAppDatabase(event)
  const installation = await db
    .select({
      signalKUrl: vesselInstallations.signalKUrl,
    })
    .from(vesselInstallations)
    .where(and(eq(vesselInstallations.vesselId, vesselId), isNull(vesselInstallations.archivedAt)))
    .orderBy(desc(vesselInstallations.isPrimary), desc(vesselInstallations.updatedAt))
    .get()

  const installationUrl = normalizeSignalKBaseUrl(installation?.signalKUrl)
  if (installationUrl) {
    return installationUrl
  }

  const runtimeConfig = useRuntimeConfig(event)
  return normalizeSignalKBaseUrl(runtimeConfig.signalKHttpUrl)
}

async function fetchSignalKTrafficMetadata(event: H3Event, vesselId: string) {
  const baseUrl = await resolveSignalKBaseUrlForVessel(event, vesselId)
  if (!baseUrl) {
    return new Map<string, TrafficMetadata>()
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SIGNALK_TRAFFIC_TIMEOUT_MS)

  try {
    const response = await fetch(buildSignalKVesselsUrl(baseUrl), {
      headers: {
        accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      return new Map<string, TrafficMetadata>()
    }

    const catalog = (await response.json()) as Record<string, unknown>
    const metadataMap = new Map<string, TrafficMetadata>()

    for (const [contextKey, rawValue] of Object.entries(catalog)) {
      if (contextKey === 'self') {
        continue
      }

      const identity = getSignalKContextIdentity(contextKey)
      if (!identity) {
        continue
      }

      const metadata: TrafficMetadata = {
        name: asString(readSignalKPath(rawValue, 'name')),
        mmsi: identity.mmsi || null,
        shipType: asNumber(readSignalKPath(rawValue, 'design.aisShipType.id')),
        destination: asString(readSignalKPath(rawValue, 'navigation.destination.commonName')),
        callSign:
          asString(readSignalKPath(rawValue, 'communication.callsignVhf')) ||
          asString(readSignalKPath(rawValue, 'communication.callsign')),
        length: asNumber(readSignalKPath(rawValue, 'design.length.overall')),
        beam: asNumber(readSignalKPath(rawValue, 'design.beam')),
        draft:
          asNumber(readSignalKPath(rawValue, 'design.draft.current')) ||
          asNumber(readSignalKPath(rawValue, 'design.draft.maximum')),
        navState: asString(readSignalKPath(rawValue, 'navigation.state')),
      }

      metadataMap.set(identity.id, metadata)

      if (identity.mmsi) {
        metadataMap.set(`mmsi:${identity.mmsi}`, metadata)
      }
    }

    return metadataMap
  } catch {
    return new Map<string, TrafficMetadata>()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchAisHubTrafficMetadata(event: H3Event, contacts: AisContactSummary[]) {
  const mmsis = contacts.map((contact) => contact.mmsi).filter((mmsi): mmsi is string => Boolean(mmsi))
  const stored = await getStoredAisHubResultsByMmsis(event, mmsis)
  const metadataMap = new Map<string, TrafficMetadata>()

  for (const [mmsi, result] of stored) {
    metadataMap.set(`mmsi:${mmsi}`, {
      name: result.name,
      mmsi,
      shipType: result.shipType,
      destination: result.destination,
      callSign: result.callSign,
      length: null,
      beam: null,
      draft: null,
      navState: null,
    })
  }

  return metadataMap
}

export async function enrichTrafficContactsForVessel(
  event: H3Event,
  vesselId: string,
  contacts: AisContactSummary[],
) {
  if (!contacts.length) {
    return []
  }

  const [signalKMetadata, aisHubMetadata] = await Promise.all([
    fetchSignalKTrafficMetadata(event, vesselId),
    fetchAisHubTrafficMetadata(event, contacts),
  ])

  return contacts.map((contact) => {
    const normalizedId = normalizeContactId(contact.id)
    const signalK = normalizedId ? signalKMetadata.get(normalizedId) || null : null
    const aisHub = contact.mmsi ? aisHubMetadata.get(`mmsi:${contact.mmsi}`) || null : null
    return mergeTrafficMetadata(contact, signalK, aisHub)
  })
}

export function toTrafficContactDetailSummary(
  contact: AisContactSummary,
  vesselSnapshot: VesselSnapshotSummary | null | undefined,
  liveState: TrafficContactDetailSummary['liveState'],
): TrafficContactDetailSummary {
  const distanceNm =
    vesselSnapshot?.positionLat !== null &&
    vesselSnapshot?.positionLat !== undefined &&
    vesselSnapshot.positionLng !== null &&
    vesselSnapshot.positionLng !== undefined &&
    contact.lat !== null &&
    contact.lat !== undefined &&
    contact.lng !== null &&
    contact.lng !== undefined
      ? haversineNm(
          vesselSnapshot.positionLat,
          vesselSnapshot.positionLng,
          contact.lat,
          contact.lng,
        )
      : null

  return {
    ...contact,
    contactId: contact.id,
    title: trafficDisplayName(contact),
    distanceNm,
    liveState,
  }
}

export async function resolveCachedTrafficContactDetail(
  event: H3Event,
  contactId: string,
  vesselSnapshot: VesselSnapshotSummary | null | undefined,
) {
  const mmsi = extractMmsiFromContactId(contactId)
  if (!mmsi) {
    return null
  }

  const stored = await getStoredAisHubResultsByMmsis(event, [mmsi])
  const result = stored.get(mmsi)
  if (!result) {
    return null
  }

  const lastUpdateAt = result.lastReportAt ? new Date(result.lastReportAt).getTime() : Date.now()
  return toTrafficContactDetailSummary(
    {
      id: contactId,
      name: result.name,
      mmsi: result.mmsi,
      shipType: result.shipType,
      lat: result.positionLat,
      lng: result.positionLng,
      cog: null,
      sog: null,
      heading: null,
      destination: result.destination,
      callSign: result.callSign,
      length: null,
      beam: null,
      draft: null,
      navState: null,
      lastUpdateAt,
    },
    vesselSnapshot,
    'cached',
  )
}
