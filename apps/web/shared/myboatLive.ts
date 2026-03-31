import type { AisContactSummary, VesselSnapshotSummary } from '../app/types/myboat'

export type SelfSubscriptionLevel = 'none' | 'summary' | 'detail'
export type VesselLiveConnectionState = 'idle' | 'live' | 'offline'

export interface LiveDemand {
  selfLevel: SelfSubscriptionLevel
  ais: boolean
}

export interface VesselLiveSyncMessage {
  type: 'sync'
  snapshot: VesselSnapshotSummary | null
  aisContacts: AisContactSummary[]
  connectionState: VesselLiveConnectionState
  lastObservedAt: string | null
}

export interface VesselLiveSnapshotMessage {
  type: 'snapshot'
  snapshot: VesselSnapshotSummary
}

export interface VesselLiveAisUpsertMessage {
  type: 'ais_upsert'
  contact: AisContactSummary
}

export interface VesselLiveAisRemoveMessage {
  type: 'ais_remove'
  contactId: string
}

export interface VesselLiveStatusMessage {
  type: 'status'
  connectionState: VesselLiveConnectionState
  lastObservedAt: string | null
}

export interface VesselLiveDemandMessage {
  type: 'set_demand'
  demand?: Partial<LiveDemand>
  selfLevel?: SelfSubscriptionLevel
  ais?: boolean
}

export interface VesselLivePublishMessage {
  type: 'telemetry'
  snapshot?: VesselSnapshotSummary | null
  aisContacts?: AisContactSummary[]
  connectionState?: VesselLiveConnectionState
  lastObservedAt?: string | null
}

export type VesselLiveClientMessage = VesselLiveDemandMessage
export type VesselLiveServerMessage =
  | VesselLiveSyncMessage
  | VesselLiveSnapshotMessage
  | VesselLiveAisUpsertMessage
  | VesselLiveAisRemoveMessage
  | VesselLiveStatusMessage

export const DEFAULT_LIVE_DEMAND: LiveDemand = {
  selfLevel: 'none',
  ais: false,
}

export function normalizeLiveDemand(input: Partial<LiveDemand> | null | undefined): LiveDemand {
  const selfLevel = input?.selfLevel
  return {
    selfLevel:
      selfLevel === 'summary' || selfLevel === 'detail' || selfLevel === 'none'
        ? selfLevel
        : 'none',
    ais: Boolean(input?.ais),
  }
}

export function isLiveDemandEmpty(demand: LiveDemand) {
  return demand.selfLevel === 'none' && !demand.ais
}

function selfLevelWeight(level: SelfSubscriptionLevel) {
  switch (level) {
    case 'detail':
      return 2
    case 'summary':
      return 1
    default:
      return 0
  }
}

export function mergeLiveDemands(demands: LiveDemand[]) {
  return demands.reduce<LiveDemand>((merged, current) => {
    const demand = normalizeLiveDemand(current)
    return {
      selfLevel:
        selfLevelWeight(demand.selfLevel) > selfLevelWeight(merged.selfLevel)
          ? demand.selfLevel
          : merged.selfLevel,
      ais: merged.ais || demand.ais,
    }
  }, DEFAULT_LIVE_DEMAND)
}

function preferDefined<T>(next: T | null | undefined, previous: T | null | undefined) {
  return next ?? previous ?? null
}

/** Drop AIS contacts from live maps after this age (matches broker pruning). */
export const AIS_CONTACT_DISPLAY_STALE_MS = 5 * 60 * 1000

/** Max distance from own-ship position for live AIS contacts (maps, broker, public nearby API). */
export const AIS_NEARBY_RADIUS_NM = 24

export function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMeters = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  return (earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1852
}

export function isAisContactNearSnapshot(
  contact: AisContactSummary,
  snapshot: VesselSnapshotSummary | null | undefined,
  radiusNm: number = AIS_NEARBY_RADIUS_NM,
) {
  if (
    snapshot?.positionLat === null ||
    snapshot?.positionLat === undefined ||
    snapshot.positionLng === null ||
    snapshot.positionLng === undefined
  ) {
    return true
  }

  if (
    contact.lat === null ||
    contact.lat === undefined ||
    contact.lng === null ||
    contact.lng === undefined
  ) {
    return false
  }

  return (
    haversineNm(snapshot.positionLat, snapshot.positionLng, contact.lat, contact.lng) <= radiusNm
  )
}

export function filterAisContactsNearSnapshot(
  contacts: AisContactSummary[],
  snapshot: VesselSnapshotSummary | null | undefined,
  radiusNm: number = AIS_NEARBY_RADIUS_NM,
) {
  if (
    snapshot?.positionLat === null ||
    snapshot?.positionLat === undefined ||
    snapshot.positionLng === null ||
    snapshot.positionLng === undefined
  ) {
    return contacts
  }

  return contacts.filter((contact) => isAisContactNearSnapshot(contact, snapshot, radiusNm))
}

export function pruneAisContactRecordBySnapshot(
  contacts: Record<string, AisContactSummary>,
  snapshot: VesselSnapshotSummary | null | undefined,
  radiusNm: number = AIS_NEARBY_RADIUS_NM,
): Record<string, AisContactSummary> {
  if (
    snapshot?.positionLat === null ||
    snapshot?.positionLat === undefined ||
    snapshot.positionLng === null ||
    snapshot.positionLng === undefined
  ) {
    return contacts
  }

  const next: Record<string, AisContactSummary> = {}

  for (const [key, contact] of Object.entries(contacts)) {
    if (isAisContactNearSnapshot(contact, snapshot, radiusNm)) {
      next[key] = contact
    }
  }

  return next
}

/**
 * Stable map/broker key: one entry per MMSI when known, otherwise SignalK context id.
 * Prevents duplicate pins when the same vessel appears as both `mmsi:…` and a URN path.
 */
export function canonicalAisStorageKey(contact: Pick<AisContactSummary, 'id' | 'mmsi'>): string {
  const mmsi = contact.mmsi?.trim()
  if (mmsi && /^\d{6,}$/.test(mmsi)) {
    return `mmsi:${mmsi}`
  }

  return contact.id.trim() || contact.id
}

export function mergeAisContactsIntoRecord(
  existing: Record<string, AisContactSummary>,
  incoming: AisContactSummary[],
): Record<string, AisContactSummary> {
  const merged: Record<string, AisContactSummary> = {}

  for (const contact of [...Object.values(existing), ...incoming]) {
    const key = canonicalAisStorageKey(contact)
    const normalized = { ...contact, id: key }
    merged[key] = mergeAisContactSummary(merged[key], normalized)
  }

  return merged
}

export function pruneStaleAisContactRecord(
  contacts: Record<string, AisContactSummary>,
  nowMs: number = Date.now(),
  staleMs: number = AIS_CONTACT_DISPLAY_STALE_MS,
): Record<string, AisContactSummary> {
  const next: Record<string, AisContactSummary> = {}

  for (const [key, contact] of Object.entries(contacts)) {
    if (nowMs - contact.lastUpdateAt <= staleMs) {
      next[key] = contact
    }
  }

  return next
}

export function diffRemovedAisContactKeys(
  previous: Record<string, AisContactSummary>,
  next: Record<string, AisContactSummary>,
) {
  return Object.keys(previous).filter((key) => !(key in next))
}

export function mergeAisContactSummary(
  previous: AisContactSummary | null | undefined,
  next: AisContactSummary,
): AisContactSummary {
  if (!previous) {
    return next
  }

  return {
    id: next.id,
    name: preferDefined(next.name, previous.name),
    mmsi: preferDefined(next.mmsi, previous.mmsi),
    shipType: preferDefined(next.shipType, previous.shipType),
    lat: preferDefined(next.lat, previous.lat),
    lng: preferDefined(next.lng, previous.lng),
    cog: preferDefined(next.cog, previous.cog),
    sog: preferDefined(next.sog, previous.sog),
    heading: preferDefined(next.heading, previous.heading),
    destination: preferDefined(next.destination, previous.destination),
    callSign: preferDefined(next.callSign, previous.callSign),
    length: preferDefined(next.length, previous.length),
    beam: preferDefined(next.beam, previous.beam),
    draft: preferDefined(next.draft, previous.draft),
    navState: preferDefined(next.navState, previous.navState),
    lastUpdateAt: Math.max(previous.lastUpdateAt, next.lastUpdateAt),
  }
}

export function createMyBoatLiveWebSocketUrl(path: string, baseOrigin?: string) {
  const origin =
    baseOrigin ||
    (import.meta.client ? globalThis.location?.origin : null) ||
    'http://localhost:3000'
  const url = new URL(path, origin)
  if (url.protocol === 'http:') {
    url.protocol = 'ws:'
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:'
  }
  return url.toString()
}
