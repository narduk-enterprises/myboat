import type { EffectScope } from 'vue'
import type {
  AisContactSummary,
  DashboardOverview,
  InstallationSummary,
  MediaItemSummary,
  PassageSummary,
  PublicExploreItem,
  PublicExploreResponse,
  PublicFreshnessState,
  PublicInstallationSummary,
  PublicProfileResponse,
  PublicProfileSummary,
  PublicVesselDetailResponse,
  VesselCardSummary,
  VesselDetailResponse,
  VesselSnapshotSummary,
  WaypointSummary,
} from '~/types/myboat'

type SignalKSubscriptionPath = {
  path: string
  policy: 'instant'
}

type SignalKSubscriptionCommand = {
  context: string
  subscribe: SignalKSubscriptionPath[]
}

type SignalKDeltaValue = {
  path?: string
  value?: unknown
}

type SignalKDeltaUpdate = {
  timestamp?: string
  values?: SignalKDeltaValue[]
}

type SignalKDelta = {
  context?: string
  updates?: SignalKDeltaUpdate[]
  self?: string
}

type VesselStoreRouteStatus = 'idle' | 'loading' | 'ready' | 'error'

export type VesselStoreNamespace = 'auth' | 'public'

export interface VesselStoreLiveState {
  activeUrl: string | null
  connectionState: 'idle' | 'connecting' | 'connected' | 'error'
  hasSignalKSource: boolean
  lastDeltaAt: number | null
  lastError: string | null
}

export interface VesselStoreEntry {
  key: string
  namespace: VesselStoreNamespace
  profile: PublicProfileSummary | null
  vessel: VesselCardSummary | null
  storedSnapshot: VesselSnapshotSummary | null
  liveSnapshot: VesselSnapshotSummary | null
  mergedSnapshot: VesselSnapshotSummary | null
  installations: Array<InstallationSummary | PublicInstallationSummary>
  passages: PassageSummary[]
  media: MediaItemSummary[]
  waypoints: WaypointSummary[]
  aisContacts: Record<string, AisContactSummary>
  detailLoaded: boolean
  freshnessState: PublicFreshnessState | null
  lastHydratedAt: string | null
  lastRefreshedAt: string | null
  publicUsername: string | null
  publicVesselSlug: string | null
  live: VesselStoreLiveState
}

export interface VesselStoreNamespaceState {
  activeEntryKey: string | null
  entriesByKey: Record<string, VesselStoreEntry>
  orderedKeys: string[]
  profile: PublicProfileSummary | null
  routeStatus: VesselStoreRouteStatus
  slugIndex: Record<string, string>
}

const SELF_OVERLAY_MAX_DISTANCE_NM = 30
const AIS_STALE_TIMEOUT_MS = 15 * 60 * 1000
const AIS_STALE_SWEEP_MS = 60_000
const RECONNECT_DELAY_MS = 4_000

const SIGNALK_AIS_SUBSCRIPTION_COMMAND: SignalKSubscriptionCommand = {
  context: 'vessels.*',
  subscribe: [
    { path: 'navigation.position', policy: 'instant' },
    { path: 'navigation.courseOverGroundTrue', policy: 'instant' },
    { path: 'navigation.speedOverGround', policy: 'instant' },
    { path: 'navigation.headingTrue', policy: 'instant' },
    { path: 'navigation.headingMagnetic', policy: 'instant' },
    { path: 'name', policy: 'instant' },
    { path: 'design.aisShipType', policy: 'instant' },
    { path: 'navigation.destination.commonName', policy: 'instant' },
    { path: 'communication.callsignVhf', policy: 'instant' },
    { path: 'design.length.overall', policy: 'instant' },
    { path: 'design.beam', policy: 'instant' },
    { path: 'design.draft.current', policy: 'instant' },
    { path: 'navigation.state', policy: 'instant' },
  ],
}

const SIGNALK_SELF_SUBSCRIPTION_PATHS: SignalKSubscriptionPath[] = [
  { path: 'navigation.position', policy: 'instant' },
  { path: 'navigation.position.latitude', policy: 'instant' },
  { path: 'navigation.position.longitude', policy: 'instant' },
  { path: 'navigation.headingMagnetic', policy: 'instant' },
  { path: 'navigation.speedOverGround', policy: 'instant' },
  { path: 'navigation.speedThroughWater', policy: 'instant' },
  { path: 'environment.wind.speedApparent', policy: 'instant' },
  { path: 'environment.wind.angleApparent', policy: 'instant' },
  { path: 'environment.depth.belowTransducer', policy: 'instant' },
  { path: 'environment.water.temperature', policy: 'instant' },
  { path: 'electrical.batteries.*.voltage', policy: 'instant' },
  { path: 'propulsion.*.revolutions', policy: 'instant' },
]

interface LiveController {
  activeEntryKey: string | null
  nextUrlIndex: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  resolvedSelfContext: string | null
  resolvedSelfMmsi: string | null
  scope: EffectScope
  socket: WebSocket | null
  staleSweepTimer: ReturnType<typeof setInterval> | null
  subscribedSelfContext: string | null
}

const liveControllers = new Map<VesselStoreNamespace, LiveController>()

function createEmptyLiveState(): VesselStoreLiveState {
  return {
    activeUrl: null,
    connectionState: 'idle',
    hasSignalKSource: false,
    lastDeltaAt: null,
    lastError: null,
  }
}

function createNamespaceState(): VesselStoreNamespaceState {
  return {
    activeEntryKey: null,
    entriesByKey: {},
    orderedKeys: [],
    profile: null,
    routeStatus: 'idle',
    slugIndex: {},
  }
}

function createEmptyEntry(key: string, namespace: VesselStoreNamespace): VesselStoreEntry {
  return {
    key,
    namespace,
    profile: null,
    vessel: null,
    storedSnapshot: null,
    liveSnapshot: null,
    mergedSnapshot: null,
    installations: [],
    passages: [],
    media: [],
    waypoints: [],
    aisContacts: {},
    detailLoaded: false,
    freshnessState: null,
    lastHydratedAt: null,
    lastRefreshedAt: null,
    publicUsername: null,
    publicVesselSlug: null,
    live: createEmptyLiveState(),
  }
}

function normalizeSignalKSocketUrl(rawUrl: string | null | undefined) {
  const normalized = rawUrl?.trim()
  if (!normalized) {
    return null
  }

  try {
    const baseOrigin = import.meta.client ? window.location.origin : 'http://localhost:3000'
    const url = new URL(normalized, baseOrigin)

    if (url.protocol === 'http:') {
      url.protocol = 'ws:'
    } else if (url.protocol === 'https:') {
      url.protocol = 'wss:'
    }

    return url.toString()
  } catch {
    return normalized.startsWith('ws://') || normalized.startsWith('wss://') ? normalized : null
  }
}

function buildCollectorOnlyUrls(
  installations: Array<InstallationSummary | PublicInstallationSummary>,
) {
  const urls = new Set<string>()

  for (const installation of installations) {
    const normalized = normalizeSignalKSocketUrl(installation.collectorSignalKUrl)
    if (normalized) {
      urls.add(normalized)
    }
  }

  return Array.from(urls)
}

function buildPublicLiveUrls(
  installations: Array<InstallationSummary | PublicInstallationSummary>,
) {
  const urls = new Set<string>()

  for (const installation of installations) {
    for (const rawUrl of [
      installation.collectorSignalKUrl,
      installation.relaySignalKUrl,
      installation.signalKUrl,
    ]) {
      const normalized = normalizeSignalKSocketUrl(rawUrl)
      if (normalized) {
        urls.add(normalized)
      }
    }
  }

  return Array.from(urls)
}

function buildLiveUrlsForEntry(entry: VesselStoreEntry | null) {
  if (!entry) {
    return []
  }

  return entry.namespace === 'auth'
    ? buildCollectorOnlyUrls(entry.installations)
    : buildPublicLiveUrls(entry.installations)
}

function withMergedSnapshot(
  vessel: VesselCardSummary | null,
  snapshot: VesselSnapshotSummary | null,
): VesselCardSummary | null {
  if (!vessel) {
    return null
  }

  return {
    ...vessel,
    liveSnapshot: snapshot,
  }
}

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

function canMergeLiveSnapshot(
  storedSnapshot: VesselSnapshotSummary | null,
  liveSnapshot: VesselSnapshotSummary | null,
) {
  if (!storedSnapshot || !liveSnapshot) {
    return true
  }

  if (
    storedSnapshot.positionLat === null ||
    storedSnapshot.positionLat === undefined ||
    storedSnapshot.positionLng === null ||
    storedSnapshot.positionLng === undefined ||
    liveSnapshot.positionLat === null ||
    liveSnapshot.positionLat === undefined ||
    liveSnapshot.positionLng === null ||
    liveSnapshot.positionLng === undefined
  ) {
    return true
  }

  return (
    haversineNm(
      storedSnapshot.positionLat,
      storedSnapshot.positionLng,
      liveSnapshot.positionLat,
      liveSnapshot.positionLng,
    ) <= SELF_OVERLAY_MAX_DISTANCE_NM
  )
}

function mergeSnapshots(
  storedSnapshot: VesselSnapshotSummary | null,
  liveSnapshot: VesselSnapshotSummary | null,
) {
  if (!storedSnapshot && !liveSnapshot) {
    return null
  }

  if (!canMergeLiveSnapshot(storedSnapshot, liveSnapshot)) {
    return storedSnapshot
  }

  return {
    vesselId: liveSnapshot?.vesselId || storedSnapshot?.vesselId,
    source: liveSnapshot?.source || storedSnapshot?.source || null,
    observedAt: liveSnapshot?.observedAt || storedSnapshot?.observedAt || null,
    positionLat: liveSnapshot?.positionLat ?? storedSnapshot?.positionLat ?? null,
    positionLng: liveSnapshot?.positionLng ?? storedSnapshot?.positionLng ?? null,
    headingMagnetic: liveSnapshot?.headingMagnetic ?? storedSnapshot?.headingMagnetic ?? null,
    speedOverGround: liveSnapshot?.speedOverGround ?? storedSnapshot?.speedOverGround ?? null,
    speedThroughWater: liveSnapshot?.speedThroughWater ?? storedSnapshot?.speedThroughWater ?? null,
    windSpeedApparent: liveSnapshot?.windSpeedApparent ?? storedSnapshot?.windSpeedApparent ?? null,
    windAngleApparent: liveSnapshot?.windAngleApparent ?? storedSnapshot?.windAngleApparent ?? null,
    depthBelowTransducer:
      liveSnapshot?.depthBelowTransducer ?? storedSnapshot?.depthBelowTransducer ?? null,
    waterTemperatureKelvin:
      liveSnapshot?.waterTemperatureKelvin ?? storedSnapshot?.waterTemperatureKelvin ?? null,
    batteryVoltage: liveSnapshot?.batteryVoltage ?? storedSnapshot?.batteryVoltage ?? null,
    engineRpm: liveSnapshot?.engineRpm ?? storedSnapshot?.engineRpm ?? null,
    statusNote: liveSnapshot?.statusNote || storedSnapshot?.statusNote || null,
    updatedAt: liveSnapshot?.updatedAt || storedSnapshot?.updatedAt || null,
  } satisfies VesselSnapshotSummary
}

function createSelfSubscriptionCommand(context: string): SignalKSubscriptionCommand {
  return {
    context,
    subscribe: SIGNALK_SELF_SUBSCRIPTION_PATHS,
  }
}

function extractMmsi(contextId: string) {
  const match = contextId.match(/mmsi[:-]?(\d{6,})/i)
  return match?.[1] ?? null
}

function normalizeSelfContext(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  return null
}

function asText(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? normalized : null
  }

  return null
}

function asDegrees(value: unknown) {
  const numericValue = asNumber(value)
  if (numericValue === null) {
    return null
  }

  return Math.abs(numericValue) > Math.PI * 2 ? numericValue : (numericValue * 180) / Math.PI
}

function extractNumberField(value: unknown, fields: string[]): number | null {
  if (!value || typeof value !== 'object') {
    return asNumber(value)
  }

  let cursor: unknown = value
  for (const field of fields) {
    if (!cursor || typeof cursor !== 'object' || !(field in cursor)) {
      return null
    }

    cursor = (cursor as Record<string, unknown>)[field]
  }

  return asNumber(cursor)
}

function extractTextField(value: unknown, fields: string[]): string | null {
  if (!value || typeof value !== 'object') {
    return asText(value)
  }

  let cursor: unknown = value
  for (const field of fields) {
    if (!cursor || typeof cursor !== 'object' || !(field in cursor)) {
      return null
    }

    cursor = (cursor as Record<string, unknown>)[field]
  }

  return asText(cursor)
}

function asIsoTimestamp(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function createEmptySelfSnapshot(vesselId: string | null | undefined): VesselSnapshotSummary {
  return {
    vesselId: vesselId || undefined,
    observedAt: null,
    positionLat: null,
    positionLng: null,
    headingMagnetic: null,
    speedOverGround: null,
    speedThroughWater: null,
    windSpeedApparent: null,
    windAngleApparent: null,
    depthBelowTransducer: null,
    waterTemperatureKelvin: null,
    batteryVoltage: null,
    engineRpm: null,
    statusNote: null,
    source: null,
    updatedAt: null,
  }
}

async function decodeMessageData(data: string | ArrayBuffer | Blob) {
  if (typeof data === 'string') {
    return data
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data)
  }

  return await data.text()
}

function resolveSelfContextFromMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  return normalizeSelfContext((payload as { self?: unknown }).self)
}

function pruneStaleAisContacts(contacts: Record<string, AisContactSummary>) {
  const now = Date.now()
  let removedAny = false
  const next: Record<string, AisContactSummary> = {}

  for (const [key, contact] of Object.entries(contacts)) {
    if (now - contact.lastUpdateAt > AIS_STALE_TIMEOUT_MS) {
      removedAny = true
      continue
    }

    next[key] = contact
  }

  return removedAny ? next : contacts
}

function buildPublicEntryKey(username: string, vesselSlug: string) {
  return `${username}/${vesselSlug}`
}

export function useMyBoatVesselStore() {
  const authState = useState<VesselStoreNamespaceState>('myboat-vessel-store:auth', () =>
    createNamespaceState(),
  )
  const publicState = useState<VesselStoreNamespaceState>('myboat-vessel-store:public', () =>
    createNamespaceState(),
  )
  const appFetch = useAppFetch()

  function getNamespaceState(namespace: VesselStoreNamespace) {
    return namespace === 'auth' ? authState : publicState
  }

  function updateNamespace(
    namespace: VesselStoreNamespace,
    recipe: (current: VesselStoreNamespaceState) => VesselStoreNamespaceState,
  ) {
    const state = getNamespaceState(namespace)
    state.value = recipe(state.value)
  }

  function updateEntry(
    namespace: VesselStoreNamespace,
    key: string,
    recipe: (current: VesselStoreEntry) => VesselStoreEntry,
  ) {
    updateNamespace(namespace, (currentState) => {
      const currentEntry = currentState.entriesByKey[key] || createEmptyEntry(key, namespace)
      const nextEntry = recipe(currentEntry)

      return {
        ...currentState,
        entriesByKey: {
          ...currentState.entriesByKey,
          [key]: nextEntry,
        },
      }
    })
  }

  function setEntryLiveState(
    namespace: VesselStoreNamespace,
    key: string,
    partial: Partial<VesselStoreLiveState>,
  ) {
    updateEntry(namespace, key, (currentEntry) => ({
      ...currentEntry,
      live: {
        ...currentEntry.live,
        ...partial,
      },
    }))
  }

  function syncMergedSnapshot(namespace: VesselStoreNamespace, key: string) {
    updateEntry(namespace, key, (currentEntry) => {
      const mergedSnapshot = mergeSnapshots(currentEntry.storedSnapshot, currentEntry.liveSnapshot)
      return {
        ...currentEntry,
        mergedSnapshot,
        vessel: withMergedSnapshot(currentEntry.vessel, mergedSnapshot),
      }
    })
  }

  function setRouteStatus(namespace: VesselStoreNamespace, routeStatus: VesselStoreRouteStatus) {
    updateNamespace(namespace, (currentState) => ({
      ...currentState,
      routeStatus,
    }))
  }

  function upsertOrderedKey(orderedKeys: string[], key: string) {
    return orderedKeys.includes(key) ? orderedKeys : [...orderedKeys, key]
  }

  function replaceOrderedKeysPreservingExisting(
    previousKeys: string[],
    nextKeys: string[],
    existingEntries: Record<string, VesselStoreEntry>,
  ) {
    const deduped = Array.from(new Set(nextKeys))
    const preserved = previousKeys.filter((key) => !deduped.includes(key) && existingEntries[key])
    return [...deduped, ...preserved]
  }

  function setActiveEntry(namespace: VesselStoreNamespace, key: string | null) {
    updateNamespace(namespace, (currentState) => ({
      ...currentState,
      activeEntryKey: key,
    }))
  }

  function setActiveAuthVessel(key: string | null) {
    setActiveEntry('auth', key)
  }

  function setActivePublicVessel(key: string | null) {
    setActiveEntry('public', key)
  }

  function hydrateAuthOverview(overview: DashboardOverview) {
    const now = new Date().toISOString()
    const orderedKeys = overview.vessels.map((vessel) => vessel.id)
    const slugIndex = { ...authState.value.slugIndex }
    const entriesByKey = { ...authState.value.entriesByKey }

    for (const vessel of overview.vessels) {
      const key = vessel.id
      const currentEntry = entriesByKey[key] || createEmptyEntry(key, 'auth')
      const installations = overview.installations.filter(
        (installation) => installation.vesselId === vessel.id,
      )
      const storedSnapshot = vessel.liveSnapshot ?? currentEntry.storedSnapshot
      const mergedSnapshot = mergeSnapshots(storedSnapshot, currentEntry.liveSnapshot)

      slugIndex[vessel.slug] = key
      entriesByKey[key] = {
        ...currentEntry,
        detailLoaded: currentEntry.detailLoaded,
        freshnessState: currentEntry.freshnessState,
        installations,
        key,
        lastHydratedAt: now,
        media: currentEntry.media,
        mergedSnapshot,
        namespace: 'auth',
        passages:
          currentEntry.passages.length || !vessel.latestPassage
            ? currentEntry.passages
            : [vessel.latestPassage],
        profile: overview.profile,
        publicUsername: overview.profile?.username || null,
        storedSnapshot,
        vessel: withMergedSnapshot(vessel, mergedSnapshot),
        waypoints: currentEntry.waypoints,
        live: {
          ...currentEntry.live,
          hasSignalKSource: buildCollectorOnlyUrls(installations).length > 0,
        },
      }
    }

    const nextActiveKey =
      (authState.value.activeEntryKey && entriesByKey[authState.value.activeEntryKey]
        ? authState.value.activeEntryKey
        : orderedKeys[0]) || null

    authState.value = {
      ...authState.value,
      activeEntryKey: nextActiveKey,
      entriesByKey,
      orderedKeys: replaceOrderedKeysPreservingExisting(
        authState.value.orderedKeys,
        orderedKeys,
        entriesByKey,
      ),
      profile: overview.profile,
      routeStatus: 'ready',
      slugIndex,
    }
  }

  function hydrateAuthVesselDetail(detail: VesselDetailResponse) {
    const now = new Date().toISOString()
    const key = detail.vessel.id
    const currentEntry = authState.value.entriesByKey[key] || createEmptyEntry(key, 'auth')
    const storedSnapshot = detail.vessel.liveSnapshot ?? currentEntry.storedSnapshot
    const mergedSnapshot = mergeSnapshots(storedSnapshot, currentEntry.liveSnapshot)

    authState.value = {
      ...authState.value,
      activeEntryKey: authState.value.activeEntryKey || key,
      entriesByKey: {
        ...authState.value.entriesByKey,
        [key]: {
          ...currentEntry,
          detailLoaded: true,
          installations: detail.installations,
          key,
          lastHydratedAt: now,
          media: detail.media,
          mergedSnapshot,
          namespace: 'auth',
          passages: detail.passages,
          profile: detail.profile,
          publicUsername: detail.profile.username,
          storedSnapshot,
          vessel: withMergedSnapshot(detail.vessel, mergedSnapshot),
          waypoints: detail.waypoints,
          live: {
            ...currentEntry.live,
            hasSignalKSource: buildCollectorOnlyUrls(detail.installations).length > 0,
          },
        },
      },
      orderedKeys: upsertOrderedKey(authState.value.orderedKeys, key),
      profile: detail.profile,
      routeStatus: 'ready',
      slugIndex: {
        ...authState.value.slugIndex,
        [detail.vessel.slug]: key,
      },
    }
  }

  function hydratePublicExplore(explore: PublicExploreResponse) {
    const now = new Date().toISOString()
    const nextOrderedKeys = explore.items.map((item) =>
      buildPublicEntryKey(item.profile.username, item.vessel.slug),
    )
    const entriesByKey = { ...publicState.value.entriesByKey }

    for (const item of explore.items) {
      const key = buildPublicEntryKey(item.profile.username, item.vessel.slug)
      const currentEntry = entriesByKey[key] || createEmptyEntry(key, 'public')
      const storedSnapshot = item.vessel.liveSnapshot ?? currentEntry.storedSnapshot
      const mergedSnapshot = mergeSnapshots(storedSnapshot, currentEntry.liveSnapshot)

      entriesByKey[key] = {
        ...currentEntry,
        freshnessState: item.freshnessState,
        installations: currentEntry.installations,
        key,
        lastHydratedAt: now,
        lastRefreshedAt: now,
        media: currentEntry.media,
        mergedSnapshot,
        namespace: 'public',
        passages: currentEntry.passages,
        profile: item.profile,
        publicUsername: item.profile.username,
        publicVesselSlug: item.vessel.slug,
        storedSnapshot,
        vessel: withMergedSnapshot(item.vessel, mergedSnapshot),
        waypoints: currentEntry.waypoints,
      }
    }

    publicState.value = {
      ...publicState.value,
      entriesByKey,
      orderedKeys: replaceOrderedKeysPreservingExisting(
        publicState.value.orderedKeys,
        nextOrderedKeys,
        entriesByKey,
      ),
      routeStatus: 'ready',
    }
  }

  function hydratePublicProfile(profileResponse: PublicProfileResponse) {
    const now = new Date().toISOString()
    const nextOrderedKeys = profileResponse.vessels.map((vessel) =>
      buildPublicEntryKey(profileResponse.profile.username, vessel.slug),
    )
    const entriesByKey = { ...publicState.value.entriesByKey }
    const installationsByVesselId = profileResponse.installations.reduce<
      Record<string, PublicInstallationSummary[]>
    >((accumulator, installation) => {
      const currentInstallations = accumulator[installation.vesselId] || []
      accumulator[installation.vesselId] = [...currentInstallations, installation]
      return accumulator
    }, {})

    for (const vessel of profileResponse.vessels) {
      const key = buildPublicEntryKey(profileResponse.profile.username, vessel.slug)
      const currentEntry = entriesByKey[key] || createEmptyEntry(key, 'public')
      const storedSnapshot = vessel.liveSnapshot ?? currentEntry.storedSnapshot
      const mergedSnapshot = mergeSnapshots(storedSnapshot, currentEntry.liveSnapshot)

      entriesByKey[key] = {
        ...currentEntry,
        installations: installationsByVesselId[vessel.id] || currentEntry.installations,
        key,
        lastHydratedAt: now,
        lastRefreshedAt: now,
        mergedSnapshot,
        namespace: 'public',
        profile: profileResponse.profile,
        publicUsername: profileResponse.profile.username,
        publicVesselSlug: vessel.slug,
        storedSnapshot,
        vessel: withMergedSnapshot(vessel, mergedSnapshot),
      }
    }

    publicState.value = {
      ...publicState.value,
      entriesByKey,
      orderedKeys: replaceOrderedKeysPreservingExisting(
        publicState.value.orderedKeys,
        nextOrderedKeys,
        entriesByKey,
      ),
      routeStatus: 'ready',
    }
  }

  function hydratePublicVesselDetail(detail: PublicVesselDetailResponse) {
    const now = new Date().toISOString()
    const key = buildPublicEntryKey(detail.profile.username, detail.vessel.slug)
    const currentEntry = publicState.value.entriesByKey[key] || createEmptyEntry(key, 'public')
    const storedSnapshot = detail.vessel.liveSnapshot ?? currentEntry.storedSnapshot
    const mergedSnapshot = mergeSnapshots(storedSnapshot, currentEntry.liveSnapshot)

    publicState.value = {
      ...publicState.value,
      activeEntryKey: publicState.value.activeEntryKey || key,
      entriesByKey: {
        ...publicState.value.entriesByKey,
        [key]: {
          ...currentEntry,
          detailLoaded: true,
          freshnessState: detail.freshnessState,
          installations: detail.installations,
          key,
          lastHydratedAt: now,
          lastRefreshedAt: now,
          media: detail.media,
          mergedSnapshot,
          namespace: 'public',
          passages: detail.passages,
          profile: detail.profile,
          publicUsername: detail.profile.username,
          publicVesselSlug: detail.vessel.slug,
          storedSnapshot,
          vessel: withMergedSnapshot(detail.vessel, mergedSnapshot),
          waypoints: detail.waypoints,
          live: {
            ...currentEntry.live,
            hasSignalKSource: buildPublicLiveUrls(detail.installations).length > 0,
          },
        },
      },
      orderedKeys: upsertOrderedKey(publicState.value.orderedKeys, key),
      routeStatus: 'ready',
    }
  }

  async function ensureAuthVesselDetail(slug: string) {
    const existingKey = authState.value.slugIndex[slug]
    const existingEntry =
      existingKey && authState.value.entriesByKey[existingKey]
        ? authState.value.entriesByKey[existingKey]
        : null

    if (existingEntry?.detailLoaded) {
      return getAuthDetailBySlug(slug)
    }

    setRouteStatus('auth', 'loading')
    const detail = await appFetch<VesselDetailResponse>(`/api/app/vessels/${slug}`)
    hydrateAuthVesselDetail(detail)
    return getAuthDetailBySlug(slug)
  }

  async function ensurePublicVesselDetail(username: string, vesselSlug: string) {
    const key = buildPublicEntryKey(username, vesselSlug)
    const existingEntry = publicState.value.entriesByKey[key]

    if (existingEntry?.detailLoaded) {
      return getPublicDetail(username, vesselSlug)
    }

    setRouteStatus('public', 'loading')
    const detail = await appFetch<PublicVesselDetailResponse>(
      `/api/public/${username}/${vesselSlug}`,
    )
    hydratePublicVesselDetail(detail)
    return getPublicDetail(username, vesselSlug)
  }

  async function refreshPublicVesselDetail(key: string) {
    const entry = publicState.value.entriesByKey[key]
    if (!entry?.publicUsername || !entry.publicVesselSlug) {
      return null
    }

    setRouteStatus('public', 'loading')
    const detail = await appFetch<PublicVesselDetailResponse>(
      `/api/public/${entry.publicUsername}/${entry.publicVesselSlug}`,
    )
    hydratePublicVesselDetail(detail)
    return getPublicDetail(entry.publicUsername, entry.publicVesselSlug)
  }

  function getActiveEntry(namespace: VesselStoreNamespace) {
    const state = getNamespaceState(namespace).value
    return state.activeEntryKey ? state.entriesByKey[state.activeEntryKey] || null : null
  }

  function getAuthEntryBySlug(slug: string | null | undefined) {
    if (!slug) {
      return null
    }

    const key = authState.value.slugIndex[slug]
    return key ? authState.value.entriesByKey[key] || null : null
  }

  function getPublicEntry(
    username: string | null | undefined,
    vesselSlug: string | null | undefined,
  ) {
    if (!username || !vesselSlug) {
      return null
    }

    return publicState.value.entriesByKey[buildPublicEntryKey(username, vesselSlug)] || null
  }

  function serializeAisContacts(
    entry:
      | {
          readonly aisContacts: Readonly<Record<string, AisContactSummary>>
        }
      | null
      | undefined,
  ) {
    if (!entry) {
      return []
    }

    return Object.values(entry.aisContacts).sort(
      (left, right) => right.lastUpdateAt - left.lastUpdateAt,
    )
  }

  function toAuthDetail(entry: VesselStoreEntry | null): VesselDetailResponse | null {
    if (!entry?.vessel || !entry.profile) {
      return null
    }

    return {
      profile: entry.profile,
      vessel: entry.vessel,
      installations: entry.installations as InstallationSummary[],
      passages: entry.passages,
      media: entry.media,
      waypoints: entry.waypoints,
    }
  }

  function toPublicDetail(entry: VesselStoreEntry | null): PublicVesselDetailResponse | null {
    if (!entry?.vessel || !entry.profile) {
      return null
    }

    return {
      profile: entry.profile,
      vessel: entry.vessel,
      installations: entry.installations as PublicInstallationSummary[],
      passages: entry.passages,
      media: entry.media,
      waypoints: entry.waypoints,
      freshnessState: entry.freshnessState || 'offline',
    }
  }

  function getAuthDetailBySlug(slug: string | null | undefined) {
    return toAuthDetail(getAuthEntryBySlug(slug))
  }

  function getPublicDetail(
    username: string | null | undefined,
    vesselSlug: string | null | undefined,
  ) {
    return toPublicDetail(getPublicEntry(username, vesselSlug))
  }

  function getPublicExploreItems() {
    return publicState.value.orderedKeys
      .map((key) => publicState.value.entriesByKey[key])
      .filter((entry): entry is VesselStoreEntry =>
        Boolean(entry?.vessel && entry.profile && entry.freshnessState),
      )
      .map(
        (entry) =>
          ({
            profile: entry.profile!,
            vessel: entry.vessel!,
            freshnessState: entry.freshnessState!,
            lastObservedAt:
              entry.mergedSnapshot?.observedAt || entry.storedSnapshot?.observedAt || null,
          }) satisfies PublicExploreItem,
      )
  }

  function getPublicProfileEntries(username: string) {
    return publicState.value.orderedKeys
      .map((key) => publicState.value.entriesByKey[key])
      .filter((entry): entry is VesselStoreEntry =>
        Boolean(entry?.profile?.username === username && entry.vessel),
      )
      .map((entry) => entry.vessel!)
  }

  function getNamespaceLiveUrls(namespace: VesselStoreNamespace) {
    return buildLiveUrlsForEntry(getActiveEntry(namespace))
  }

  function isSelfContext(controller: LiveController, context: string | null | undefined) {
    if (!context) {
      return false
    }

    if (context === 'vessels.self') {
      return true
    }

    if (controller.resolvedSelfContext && context === controller.resolvedSelfContext) {
      return true
    }

    return Boolean(controller.resolvedSelfMmsi && context.includes(controller.resolvedSelfMmsi))
  }

  function subscribeToResolvedSelfContext(
    controller: LiveController,
    target: WebSocket,
    context: string,
  ) {
    if (!context || context === 'vessels.self' || controller.subscribedSelfContext === context) {
      return
    }

    target.send(JSON.stringify(createSelfSubscriptionCommand(context)))
    controller.subscribedSelfContext = context
  }

  function updateResolvedSelfContext(
    controller: LiveController,
    target: WebSocket,
    context: string | null,
  ) {
    if (!context) {
      return
    }

    controller.resolvedSelfContext = context
    controller.resolvedSelfMmsi = extractMmsi(context)
    subscribeToResolvedSelfContext(controller, target, context)
  }

  function clearReconnectTimer(controller: LiveController) {
    if (!controller.reconnectTimer) {
      return
    }

    clearTimeout(controller.reconnectTimer)
    controller.reconnectTimer = null
  }

  function clearStaleSweepTimer(controller: LiveController) {
    if (!controller.staleSweepTimer) {
      return
    }

    clearInterval(controller.staleSweepTimer)
    controller.staleSweepTimer = null
  }

  function pruneNamespaceAisContacts(namespace: VesselStoreNamespace) {
    const activeEntry = getActiveEntry(namespace)
    if (!activeEntry) {
      return
    }

    const nextContacts = pruneStaleAisContacts(activeEntry.aisContacts)
    if (nextContacts === activeEntry.aisContacts) {
      return
    }

    updateEntry(namespace, activeEntry.key, (currentEntry) => ({
      ...currentEntry,
      aisContacts: nextContacts,
    }))
  }

  function ensureStaleSweepTimer(namespace: VesselStoreNamespace, controller: LiveController) {
    if (controller.staleSweepTimer || !import.meta.client) {
      return
    }

    controller.staleSweepTimer = setInterval(() => {
      pruneNamespaceAisContacts(namespace)
    }, AIS_STALE_SWEEP_MS)
  }

  function resetControllerContext(controller: LiveController) {
    controller.resolvedSelfContext = null
    controller.resolvedSelfMmsi = null
    controller.subscribedSelfContext = null
  }

  function disconnectNamespace(namespace: VesselStoreNamespace, controller: LiveController) {
    clearReconnectTimer(controller)
    clearStaleSweepTimer(controller)

    if (controller.socket) {
      const currentSocket = controller.socket
      controller.socket = null
      currentSocket.close()
    }

    const previousKey = controller.activeEntryKey
    if (previousKey) {
      setEntryLiveState(namespace, previousKey, {
        activeUrl: null,
        connectionState: 'idle',
      })
    }
  }

  function scheduleReconnect(namespace: VesselStoreNamespace, controller: LiveController) {
    clearReconnectTimer(controller)

    if (!import.meta.client || !getNamespaceLiveUrls(namespace).length) {
      return
    }

    controller.reconnectTimer = setTimeout(() => {
      controller.reconnectTimer = null
      void connectNamespace(namespace, controller)
    }, RECONNECT_DELAY_MS)
  }

  function updateContactFromDelta(
    namespace: VesselStoreNamespace,
    controller: LiveController,
    delta: SignalKDelta,
  ) {
    const context = delta.context?.trim()
    if (!context || !context.startsWith('vessels.') || isSelfContext(controller, context)) {
      return
    }

    const activeEntry = getActiveEntry(namespace)
    if (!activeEntry) {
      return
    }

    const contactId = context.slice('vessels.'.length)
    if (!contactId) {
      return
    }

    const nextContact = {
      ...(activeEntry.aisContacts[contactId] || {
        id: contactId,
        name: null,
        mmsi: extractMmsi(contactId),
        shipType: null,
        lat: null,
        lng: null,
        cog: null,
        sog: null,
        heading: null,
        destination: null,
        callSign: null,
        length: null,
        beam: null,
        draft: null,
        navState: null,
        lastUpdateAt: Date.now(),
      }),
    } satisfies AisContactSummary

    for (const update of delta.updates ?? []) {
      for (const entry of update.values ?? []) {
        const path = entry.path ?? ''

        switch (path) {
          case 'navigation.position': {
            const latitude = extractNumberField(entry.value, ['latitude'])
            const longitude = extractNumberField(entry.value, ['longitude'])

            if (latitude !== null && longitude !== null) {
              nextContact.lat = latitude
              nextContact.lng = longitude
            }
            break
          }
          case 'navigation.courseOverGroundTrue':
            nextContact.cog = asDegrees(entry.value)
            break
          case 'navigation.speedOverGround':
            nextContact.sog = asNumber(entry.value)
            break
          case 'navigation.headingTrue':
          case 'navigation.headingMagnetic':
            nextContact.heading = asDegrees(entry.value)
            break
          case 'name':
            nextContact.name = asText(entry.value)
            break
          case 'design.aisShipType':
            nextContact.shipType = extractNumberField(entry.value, ['id']) ?? asNumber(entry.value)
            break
          case 'navigation.destination.commonName':
            nextContact.destination = asText(entry.value)
            break
          case 'communication.callsignVhf':
            nextContact.callSign = asText(entry.value)
            break
          case 'design.length.overall':
            nextContact.length = asNumber(entry.value)
            break
          case 'design.beam':
            nextContact.beam = asNumber(entry.value)
            break
          case 'design.draft.current':
            nextContact.draft = asNumber(entry.value)
            break
          case 'navigation.state':
            nextContact.navState =
              asText(entry.value) ||
              extractTextField(entry.value, ['value']) ||
              extractTextField(entry.value, ['name']) ||
              extractTextField(entry.value, ['description'])
            break
        }
      }
    }

    nextContact.mmsi = nextContact.mmsi ?? extractMmsi(contactId)
    nextContact.lastUpdateAt = Date.now()

    updateEntry(namespace, activeEntry.key, (currentEntry) => ({
      ...currentEntry,
      aisContacts: {
        ...currentEntry.aisContacts,
        [contactId]: nextContact,
      },
      live: {
        ...currentEntry.live,
        lastDeltaAt: nextContact.lastUpdateAt,
      },
    }))
  }

  function updateSelfSnapshotFromDelta(
    namespace: VesselStoreNamespace,
    controller: LiveController,
    delta: SignalKDelta,
  ) {
    const context = delta.context?.trim()
    if (!isSelfContext(controller, context)) {
      return
    }

    const activeEntry = getActiveEntry(namespace)
    if (!activeEntry) {
      return
    }

    const nextSnapshot = {
      ...(activeEntry.liveSnapshot || createEmptySelfSnapshot(activeEntry.vessel?.id)),
      vesselId: activeEntry.vessel?.id,
    } satisfies VesselSnapshotSummary

    let observedAt = nextSnapshot.observedAt
    let sawValue = false

    for (const update of delta.updates ?? []) {
      observedAt = asIsoTimestamp(update.timestamp) ?? observedAt

      for (const entry of update.values ?? []) {
        sawValue = true

        switch (entry.path ?? '') {
          case 'navigation.position': {
            const latitude = extractNumberField(entry.value, ['latitude'])
            const longitude = extractNumberField(entry.value, ['longitude'])

            if (latitude !== null) {
              nextSnapshot.positionLat = latitude
            }

            if (longitude !== null) {
              nextSnapshot.positionLng = longitude
            }
            break
          }
          case 'navigation.position.latitude': {
            const latitude = asNumber(entry.value)
            if (latitude !== null) {
              nextSnapshot.positionLat = latitude
            }
            break
          }
          case 'navigation.position.longitude': {
            const longitude = asNumber(entry.value)
            if (longitude !== null) {
              nextSnapshot.positionLng = longitude
            }
            break
          }
          case 'navigation.headingMagnetic': {
            const headingMagnetic = asDegrees(entry.value)
            if (headingMagnetic !== null) {
              nextSnapshot.headingMagnetic = headingMagnetic
            }
            break
          }
          case 'navigation.speedOverGround': {
            const speedOverGround = asNumber(entry.value)
            if (speedOverGround !== null) {
              nextSnapshot.speedOverGround = speedOverGround
            }
            break
          }
          case 'navigation.speedThroughWater': {
            const speedThroughWater = asNumber(entry.value)
            if (speedThroughWater !== null) {
              nextSnapshot.speedThroughWater = speedThroughWater
            }
            break
          }
          case 'environment.wind.speedApparent': {
            const windSpeedApparent = asNumber(entry.value)
            if (windSpeedApparent !== null) {
              nextSnapshot.windSpeedApparent = windSpeedApparent
            }
            break
          }
          case 'environment.wind.angleApparent': {
            const windAngleApparent = asDegrees(entry.value)
            if (windAngleApparent !== null) {
              nextSnapshot.windAngleApparent = windAngleApparent
            }
            break
          }
          case 'environment.depth.belowTransducer': {
            const depthBelowTransducer = asNumber(entry.value)
            if (depthBelowTransducer !== null) {
              nextSnapshot.depthBelowTransducer = depthBelowTransducer
            }
            break
          }
          case 'environment.water.temperature': {
            const waterTemperatureKelvin = asNumber(entry.value)
            if (waterTemperatureKelvin !== null) {
              nextSnapshot.waterTemperatureKelvin = waterTemperatureKelvin
            }
            break
          }
          default: {
            const path = entry.path ?? ''
            if (path.startsWith('electrical.batteries.') && path.endsWith('.voltage')) {
              const batteryVoltage = asNumber(entry.value)
              if (batteryVoltage !== null) {
                nextSnapshot.batteryVoltage = batteryVoltage
              }
              break
            }

            if (path.startsWith('propulsion.') && path.endsWith('.revolutions')) {
              const revolutionsPerSecond = asNumber(entry.value)
              if (revolutionsPerSecond !== null) {
                nextSnapshot.engineRpm = revolutionsPerSecond * 60
              }
            }
          }
        }
      }
    }

    if (!sawValue) {
      return
    }

    nextSnapshot.observedAt = observedAt ?? new Date().toISOString()
    nextSnapshot.source =
      activeEntry.storedSnapshot?.source || activeEntry.vessel?.liveSnapshot?.source || 'live_feed'
    nextSnapshot.statusNote =
      namespace === 'auth' ? 'Live MyBoat collector telemetry' : 'Live public vessel telemetry'
    nextSnapshot.updatedAt = new Date().toISOString()

    updateEntry(namespace, activeEntry.key, (currentEntry) => {
      const mergedSnapshot = mergeSnapshots(currentEntry.storedSnapshot, nextSnapshot)

      return {
        ...currentEntry,
        liveSnapshot: nextSnapshot,
        mergedSnapshot,
        vessel: withMergedSnapshot(currentEntry.vessel, mergedSnapshot),
        live: {
          ...currentEntry.live,
          lastDeltaAt: Date.now(),
        },
      }
    })
  }

  function applyPayload(
    namespace: VesselStoreNamespace,
    controller: LiveController,
    payload: unknown,
  ) {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        applyPayload(namespace, controller, item)
      }
      return
    }

    if (!payload || typeof payload !== 'object') {
      return
    }

    const delta = payload as SignalKDelta
    if (!delta.context || !Array.isArray(delta.updates)) {
      return
    }

    updateContactFromDelta(namespace, controller, delta)
    updateSelfSnapshotFromDelta(namespace, controller, delta)
  }

  async function handleMessage(
    namespace: VesselStoreNamespace,
    controller: LiveController,
    data: string | ArrayBuffer | Blob,
    target: WebSocket,
  ) {
    try {
      const raw = await decodeMessageData(data)
      const payload = JSON.parse(raw) as unknown
      updateResolvedSelfContext(controller, target, resolveSelfContextFromMessage(payload))
      applyPayload(namespace, controller, payload)
    } catch {
      // Ignore malformed upstream frames.
    }
  }

  function sendSubscriptions(controller: LiveController, target: WebSocket) {
    for (const command of [
      SIGNALK_AIS_SUBSCRIPTION_COMMAND,
      createSelfSubscriptionCommand('vessels.self'),
    ]) {
      target.send(JSON.stringify(command))
    }

    if (controller.resolvedSelfContext) {
      subscribeToResolvedSelfContext(controller, target, controller.resolvedSelfContext)
    }
  }

  async function connectNamespace(namespace: VesselStoreNamespace, controller: LiveController) {
    const urls = getNamespaceLiveUrls(namespace)
    const activeEntry = getActiveEntry(namespace)

    if (!import.meta.client || !activeEntry || !urls.length) {
      disconnectNamespace(namespace, controller)
      return
    }

    clearReconnectTimer(controller)
    disconnectNamespace(namespace, controller)
    ensureStaleSweepTimer(namespace, controller)
    resetControllerContext(controller)

    controller.activeEntryKey = activeEntry.key
    setEntryLiveState(namespace, activeEntry.key, {
      activeUrl: urls[controller.nextUrlIndex % urls.length] || null,
      connectionState: 'connecting',
      hasSignalKSource: true,
      lastError: null,
    })

    const targetUrl = urls[controller.nextUrlIndex % urls.length]!
    const nextSocket = new WebSocket(targetUrl)
    controller.socket = nextSocket

    nextSocket.addEventListener('open', () => {
      if (controller.socket !== nextSocket) {
        nextSocket.close()
        return
      }

      setEntryLiveState(namespace, activeEntry.key, {
        activeUrl: targetUrl,
        connectionState: 'connected',
        hasSignalKSource: true,
        lastError: null,
      })
      sendSubscriptions(controller, nextSocket)
    })

    nextSocket.addEventListener('message', (event) => {
      if (controller.socket !== nextSocket) {
        return
      }

      void handleMessage(namespace, controller, event.data, nextSocket)
    })

    nextSocket.addEventListener('error', () => {
      if (controller.socket !== nextSocket) {
        return
      }

      setEntryLiveState(namespace, activeEntry.key, {
        connectionState: 'error',
        lastError: 'Signal K feed unavailable',
      })
    })

    nextSocket.addEventListener('close', () => {
      if (controller.socket !== nextSocket) {
        return
      }

      controller.socket = null
      setEntryLiveState(namespace, activeEntry.key, {
        connectionState: 'error',
        lastError: 'Signal K feed disconnected',
      })

      controller.nextUrlIndex = urls.length > 1 ? (controller.nextUrlIndex + 1) % urls.length : 0
      scheduleReconnect(namespace, controller)
    })
  }

  function ensureLiveController(namespace: VesselStoreNamespace) {
    if (!import.meta.client || liveControllers.has(namespace)) {
      return
    }

    const controller: LiveController = {
      activeEntryKey: null,
      nextUrlIndex: 0,
      reconnectTimer: null,
      resolvedSelfContext: null,
      resolvedSelfMmsi: null,
      scope: effectScope(true),
      socket: null,
      staleSweepTimer: null,
      subscribedSelfContext: null,
    }

    controller.scope.run(() => {
      const namespaceState = getNamespaceState(namespace)

      watch(
        () => namespaceState.value.activeEntryKey,
        (nextKey, previousKey) => {
          if (previousKey && previousKey !== nextKey) {
            setEntryLiveState(namespace, previousKey, {
              activeUrl: null,
              connectionState: 'idle',
            })
          }

          controller.activeEntryKey = nextKey
          controller.nextUrlIndex = 0

          const activeEntry = nextKey ? namespaceState.value.entriesByKey[nextKey] || null : null
          if (!activeEntry) {
            disconnectNamespace(namespace, controller)
            return
          }

          const hasSignalKSource = buildLiveUrlsForEntry(activeEntry).length > 0
          setEntryLiveState(namespace, activeEntry.key, {
            hasSignalKSource,
            lastError: hasSignalKSource ? null : activeEntry.live.lastError,
          })

          if (!hasSignalKSource) {
            disconnectNamespace(namespace, controller)
            return
          }

          void connectNamespace(namespace, controller)
        },
        { immediate: true },
      )

      watch(
        () => getNamespaceLiveUrls(namespace),
        (nextUrls, previousUrls) => {
          if (JSON.stringify(nextUrls) === JSON.stringify(previousUrls)) {
            return
          }

          if (!namespaceState.value.activeEntryKey) {
            return
          }

          controller.nextUrlIndex = 0
          if (!nextUrls.length) {
            disconnectNamespace(namespace, controller)
            const activeEntry = getActiveEntry(namespace)
            if (activeEntry) {
              setEntryLiveState(namespace, activeEntry.key, {
                activeUrl: null,
                connectionState: 'idle',
                hasSignalKSource: false,
              })
            }
            return
          }

          void connectNamespace(namespace, controller)
        },
        { deep: true },
      )
    })

    liveControllers.set(namespace, controller)
  }

  ensureLiveController('auth')
  ensureLiveController('public')

  const authActiveEntry = computed(() => getActiveEntry('auth'))
  const publicActiveEntry = computed(() => getActiveEntry('public'))

  return {
    authActiveEntry: readonly(authActiveEntry),
    authState: readonly(authState),
    ensureAuthVesselDetail,
    ensurePublicVesselDetail,
    getActiveEntry,
    getAuthDetailBySlug,
    getAuthEntryBySlug,
    getNamespaceLiveUrls,
    getPublicDetail,
    getPublicEntry,
    getPublicExploreItems,
    getPublicProfileEntries,
    hydrateAuthOverview,
    hydrateAuthVesselDetail,
    hydratePublicExplore,
    hydratePublicProfile,
    hydratePublicVesselDetail,
    publicActiveEntry: readonly(publicActiveEntry),
    publicState: readonly(publicState),
    refreshPublicVesselDetail,
    serializeAisContacts,
    setActiveAuthVessel,
    setActivePublicVessel,
    setRouteStatus,
    syncMergedSnapshot,
  }
}
