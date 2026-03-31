import type { H3Event } from 'h3'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { AisContactSummary, VesselSnapshotSummary } from '../../app/types/myboat'
import type { TrafficContactDetailSummary } from '../../app/types/traffic'
import { useRuntimeConfig } from '#imports'
import { getStoredAisHubResultsByMmsis } from '#server/utils/aishub'
import { vesselInstallations } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import {
  AIS_CONTACT_DISPLAY_STALE_MS,
  AIS_NEARBY_RADIUS_NM,
  haversineNm,
  mergeAisContactSummary,
} from '../../shared/myboatLive'
import { fetchVesselLiveState } from '#server/utils/liveBroker'
import { extractObservedIdentityPatchFromSignalKModel } from '#server/utils/vesselIdentity'

const SIGNALK_TRAFFIC_TIMEOUT_MS = 8_000
export const TRAFFIC_NEARBY_RADIUS_NM = AIS_NEARBY_RADIUS_NM

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

function parseTimestampMs(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function unwrapSignalKNodeValue(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'value' in value &&
    (value as { value?: unknown }).value &&
    typeof (value as { value?: unknown }).value === 'object' &&
    !Array.isArray((value as { value?: unknown }).value)
  ) {
    return (value as { value?: unknown }).value as Record<string, unknown>
  }

  return null
}

function readSignalKPathNode(model: unknown, path: string) {
  const segments = path.split('.')
  let current = model

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null
    }

    const record = current as Record<string, unknown>
    if (segment in record) {
      current = record[segment]
      continue
    }

    const unwrapped = unwrapSignalKNodeValue(record)
    if (unwrapped && segment in unwrapped) {
      current = unwrapped[segment]
      continue
    }

    return null
  }

  return current
}

function readSignalKPath(model: unknown, path: string) {
  return unwrapSignalKValue(readSignalKPathNode(model, path))
}

function readSignalKPathTimestamp(model: unknown, path: string) {
  const node = readSignalKPathNode(model, path)
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return null
  }

  return parseTimestampMs((node as { timestamp?: unknown }).timestamp)
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeAngleDegrees(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.abs(value) > Math.PI * 2 ? value : (value * 180) / Math.PI
}

function extractSignalKPosition(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { lat: null, lng: null }
  }

  const position = value as { latitude?: unknown; longitude?: unknown }
  return {
    lat: asNumber(position.latitude),
    lng: asNumber(position.longitude),
  }
}

function resolveSignalKContactObservedAtMs(model: unknown) {
  const candidates = [
    readSignalKPathTimestamp(model, 'navigation.position'),
    readSignalKPathTimestamp(model, 'navigation.courseOverGroundTrue'),
    readSignalKPathTimestamp(model, 'navigation.speedOverGround'),
    readSignalKPathTimestamp(model, 'navigation.headingTrue'),
    readSignalKPathTimestamp(model, 'navigation.headingMagnetic'),
    readSignalKPathTimestamp(model, 'navigation.state'),
  ].filter((value): value is number => value !== null)

  return candidates.length ? Math.max(...candidates) : null
}

function filterFreshTrafficContacts(
  contacts: AisContactSummary[],
  nowMs: number,
  staleMs: number = AIS_CONTACT_DISPLAY_STALE_MS,
) {
  return contacts.filter((contact) => nowMs - contact.lastUpdateAt <= staleMs)
}

function trafficContactKeys(contact: Pick<AisContactSummary, 'id' | 'mmsi'>) {
  return [
    normalizeContactId(contact.id),
    contact.mmsi ? `mmsi:${contact.mmsi.trim()}` : null,
  ].filter((value): value is string => Boolean(value))
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
  return normalizeSignalKBaseUrl(
    typeof runtimeConfig.signalKHttpUrl === 'string' ? runtimeConfig.signalKHttpUrl : null,
  )
}

async function fetchSignalKTrafficCatalog(event: H3Event, vesselId: string) {
  const baseUrl = await resolveSignalKBaseUrlForVessel(event, vesselId)
  if (!baseUrl) {
    return null
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
      return null
    }

    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function buildTrafficContactFromSignalKVessel(
  contextKey: string,
  rawValue: unknown,
  fallbackObservedAtMs: number,
) {
  const identity = getSignalKContextIdentity(contextKey)
  if (!identity) {
    return null
  }

  const extractedIdentity = extractObservedIdentityPatchFromSignalKModel(rawValue, contextKey)
  const positionValue = readSignalKPath(rawValue, 'navigation.position')
  const position = extractSignalKPosition(positionValue)
  const lat = position.lat ?? asNumber(readSignalKPath(rawValue, 'navigation.position.latitude'))
  const lng = position.lng ?? asNumber(readSignalKPath(rawValue, 'navigation.position.longitude'))
  const observedAtMs = resolveSignalKContactObservedAtMs(rawValue) ?? fallbackObservedAtMs

  return {
    id: identity.id,
    name:
      extractedIdentity?.observedName ||
      asString(readSignalKPath(rawValue, 'name')) ||
      asString(readSignalKPath(rawValue, 'design.name')),
    mmsi: extractedIdentity?.mmsi || identity.mmsi || null,
    shipType:
      extractedIdentity?.shipTypeCode ??
      asNumber(readSignalKPath(rawValue, 'design.aisShipType.id')) ??
      asNumber(readSignalKPath(rawValue, 'design.aisShipType')),
    lat,
    lng,
    cog: normalizeAngleDegrees(readSignalKPath(rawValue, 'navigation.courseOverGroundTrue')),
    sog: asNumber(readSignalKPath(rawValue, 'navigation.speedOverGround')),
    heading:
      normalizeAngleDegrees(readSignalKPath(rawValue, 'navigation.headingTrue')) ??
      normalizeAngleDegrees(readSignalKPath(rawValue, 'navigation.headingMagnetic')),
    destination:
      asString(readSignalKPath(rawValue, 'navigation.destination.commonName')) ||
      asString(readSignalKPath(rawValue, 'navigation.destination.name')) ||
      asString(readSignalKPath(rawValue, 'navigation.destination')),
    callSign:
      extractedIdentity?.callSign ||
      asString(readSignalKPath(rawValue, 'communication.callsignVhf')) ||
      asString(readSignalKPath(rawValue, 'communication.callsign')),
    length:
      extractedIdentity?.lengthOverall ??
      asNumber(readSignalKPath(rawValue, 'design.length.overall')),
    beam: extractedIdentity?.beam ?? asNumber(readSignalKPath(rawValue, 'design.beam')),
    draft:
      extractedIdentity?.draft ??
      asNumber(readSignalKPath(rawValue, 'design.draft.current')) ??
      asNumber(readSignalKPath(rawValue, 'design.draft.maximum')),
    navState: asString(readSignalKPath(rawValue, 'navigation.state')),
    lastUpdateAt: observedAtMs,
  } satisfies AisContactSummary
}

async function fetchSignalKTrafficMetadata(event: H3Event, vesselId: string) {
  const catalog = await fetchSignalKTrafficCatalog(event, vesselId)
  if (!catalog) {
    return new Map<string, TrafficMetadata>()
  }

  const metadataMap = new Map<string, TrafficMetadata>()

  for (const [contextKey, rawValue] of Object.entries(catalog)) {
    if (contextKey === 'self') {
      continue
    }

    const contact = buildTrafficContactFromSignalKVessel(contextKey, rawValue, Date.now())
    if (!contact) {
      continue
    }

    const metadata: TrafficMetadata = {
      name: contact.name,
      mmsi: contact.mmsi,
      shipType: contact.shipType,
      destination: contact.destination,
      callSign: contact.callSign,
      length: contact.length,
      beam: contact.beam,
      draft: contact.draft,
      navState: contact.navState,
    }

    metadataMap.set(contact.id, metadata)

    if (contact.mmsi) {
      metadataMap.set(`mmsi:${contact.mmsi}`, metadata)
    }
  }

  return metadataMap
}

async function fetchSignalKTrafficContacts(event: H3Event, vesselId: string) {
  const catalog = await fetchSignalKTrafficCatalog(event, vesselId)
  if (!catalog) {
    return []
  }

  const nowMs = Date.now()

  return filterFreshTrafficContacts(
    Object.entries(catalog)
      .filter(([contextKey]) => contextKey !== 'self')
      .map(([contextKey, rawValue]) =>
        buildTrafficContactFromSignalKVessel(contextKey, rawValue, nowMs),
      )
      .filter((contact): contact is AisContactSummary => Boolean(contact)),
    nowMs,
  )
}

function mergeTrafficContactCollections(
  primaryContacts: AisContactSummary[],
  secondaryContacts: AisContactSummary[],
) {
  const mergedByKey = new Map<string, AisContactSummary>()
  const ordered: AisContactSummary[] = []

  for (const contact of primaryContacts) {
    ordered.push(contact)
    for (const key of trafficContactKeys(contact)) {
      mergedByKey.set(key, contact)
    }
  }

  for (const contact of secondaryContacts) {
    const match = trafficContactKeys(contact)
      .map((key) => mergedByKey.get(key) || null)
      .find((value): value is AisContactSummary => Boolean(value))

    if (!match) {
      ordered.push(contact)
      for (const key of trafficContactKeys(contact)) {
        mergedByKey.set(key, contact)
      }
      continue
    }

    const nextContact = mergeAisContactSummary(contact, match)
    for (const key of trafficContactKeys(nextContact)) {
      mergedByKey.set(key, nextContact)
    }

    const orderedIndex = ordered.findIndex((candidate) => candidate.id === match.id)
    if (orderedIndex >= 0) {
      ordered[orderedIndex] = nextContact
    }
  }

  return ordered
}

async function fetchAisHubTrafficMetadata(event: H3Event, contacts: AisContactSummary[]) {
  const mmsis = contacts
    .map((contact) => contact.mmsi)
    .filter((mmsi): mmsi is string => Boolean(mmsi))
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

export async function listNearbyTrafficContactsForVessel(
  event: H3Event,
  vesselId: string,
  vesselSnapshot: VesselSnapshotSummary | null | undefined,
) {
  const brokerState = await fetchVesselLiveState(event, vesselId)
  const focusSnapshot = brokerState?.snapshot || vesselSnapshot || null

  if (
    focusSnapshot?.positionLat === null ||
    focusSnapshot?.positionLat === undefined ||
    focusSnapshot.positionLng === null ||
    focusSnapshot.positionLng === undefined
  ) {
    return {
      contacts: [] as AisContactSummary[],
      source: 'broker' as const,
    }
  }

  const signalKContacts = await fetchSignalKTrafficContacts(event, vesselId)
  const combinedContacts = mergeTrafficContactCollections(
    brokerState?.contacts || [],
    signalKContacts,
  )
  const nowMs = Date.now()
  const freshContacts = filterFreshTrafficContacts(combinedContacts, nowMs)
  const aisHubMetadata = await fetchAisHubTrafficMetadata(event, freshContacts)

  const mergedContacts = freshContacts
    .map((contact) =>
      mergeTrafficMetadata(
        contact,
        null,
        contact.mmsi ? aisHubMetadata.get(`mmsi:${contact.mmsi}`) : null,
      ),
    )
    .filter(
      (contact) =>
        contact.lat !== null &&
        contact.lat !== undefined &&
        contact.lng !== null &&
        contact.lng !== undefined,
    )
    .map((contact) => ({
      contact,
      distanceNm: haversineNm(
        focusSnapshot.positionLat!,
        focusSnapshot.positionLng!,
        contact.lat!,
        contact.lng!,
      ),
    }))
    .filter(({ distanceNm }) => distanceNm <= TRAFFIC_NEARBY_RADIUS_NM)
    .sort((left, right) => left.distanceNm - right.distanceNm)
    .map(({ contact }) => contact)

  return {
    contacts: mergedContacts,
    source:
      brokerState?.contacts?.length && signalKContacts.length
        ? ('merged' as const)
        : signalKContacts.length
          ? ('signalk' as const)
          : ('broker' as const),
  }
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
