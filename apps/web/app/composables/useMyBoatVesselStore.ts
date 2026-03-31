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
import type {
  LiveDemand,
  VesselLiveConnectionState,
  VesselLiveServerMessage,
} from '../../shared/myboatLive'
import {
  AIS_CONTACT_DISPLAY_STALE_MS,
  createMyBoatLiveWebSocketUrl,
  filterAisContactsNearSnapshot,
  haversineNm,
  isLiveDemandEmpty,
  isAisContactNearSnapshot,
  mergeAisContactsIntoRecord,
  mergeLiveDemands,
  normalizeLiveDemand,
  pruneStaleAisContactRecord,
} from '../../shared/myboatLive'

type VesselStoreRouteStatus = 'idle' | 'loading' | 'ready' | 'error'

export type VesselStoreNamespace = 'auth' | 'public'

export interface VesselStoreLiveState {
  activeUrl: string | null
  connectionState: 'idle' | 'connecting' | 'connected' | 'error'
  hasSignalKSource: boolean
  sourceState: VesselLiveConnectionState
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
  liveDemandByConsumer: Record<string, LiveDemand>
  orderedKeys: string[]
  profile: PublicProfileSummary | null
  routeStatus: VesselStoreRouteStatus
  slugIndex: Record<string, string>
}

const SELF_OVERLAY_MAX_DISTANCE_NM = 30
const AIS_STALE_SWEEP_MS = 60_000
const RECONNECT_DELAY_MS = 4_000

interface LiveController {
  activeEntryKey: string | null
  activeUrl: string | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  scope: EffectScope
  socket: WebSocket | null
  staleSweepTimer: ReturnType<typeof setInterval> | null
}

const liveControllers = new Map<VesselStoreNamespace, LiveController>()

function createEmptyLiveState(): VesselStoreLiveState {
  return {
    activeUrl: null,
    connectionState: 'idle',
    hasSignalKSource: false,
    sourceState: 'idle',
    lastDeltaAt: null,
    lastError: null,
  }
}

function createNamespaceState(): VesselStoreNamespaceState {
  return {
    activeEntryKey: null,
    entriesByKey: {},
    liveDemandByConsumer: {},
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

function buildLiveUrlsForEntry(entry: VesselStoreEntry | null) {
  if (!entry || !entry.installations.length) {
    return []
  }

  const runtimeConfig = useRuntimeConfig()
  const localBrokerOrigin =
    typeof runtimeConfig.public.localBrokerOrigin === 'string'
      ? runtimeConfig.public.localBrokerOrigin.trim()
      : ''
  const vesselId =
    entry.installations[0]?.vesselId ||
    entry.vessel?.id ||
    entry.liveSnapshot?.vesselId ||
    entry.storedSnapshot?.vesselId ||
    null

  if (localBrokerOrigin && vesselId) {
    return [createMyBoatLiveWebSocketUrl(`/vessels/${vesselId}/connect`, localBrokerOrigin)]
  }

  if (entry.namespace === 'auth' && entry.vessel?.slug) {
    return [createMyBoatLiveWebSocketUrl(`/api/app/vessels/${entry.vessel.slug}/live`)]
  }

  if (entry.namespace === 'public' && entry.publicUsername && entry.publicVesselSlug) {
    return [
      createMyBoatLiveWebSocketUrl(
        `/api/public/${entry.publicUsername}/${entry.publicVesselSlug}/live`,
      ),
    ]
  }

  return []
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

async function decodeMessageData(data: string | ArrayBuffer | Blob) {
  if (typeof data === 'string') {
    return data
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data)
  }

  return await data.text()
}
function pruneStaleAisContacts(contacts: Record<string, AisContactSummary>) {
  const next = pruneStaleAisContactRecord(contacts, Date.now(), AIS_CONTACT_DISPLAY_STALE_MS)
  return Object.keys(next).length === Object.keys(contacts).length ? contacts : next
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

  function setLiveDemand(
    namespace: VesselStoreNamespace,
    consumerId: string,
    demand: Partial<LiveDemand> | null | undefined,
  ) {
    const normalizedDemand = normalizeLiveDemand(demand)

    updateNamespace(namespace, (currentState) => ({
      ...currentState,
      liveDemandByConsumer: {
        ...currentState.liveDemandByConsumer,
        [consumerId]: normalizedDemand,
      },
    }))
  }

  function clearLiveDemand(namespace: VesselStoreNamespace, consumerId: string) {
    updateNamespace(namespace, (currentState) => {
      const { [consumerId]: _removed, ...nextDemandByConsumer } = currentState.liveDemandByConsumer

      return {
        ...currentState,
        liveDemandByConsumer: nextDemandByConsumer,
      }
    })
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
          hasSignalKSource: installations.length > 0,
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
            hasSignalKSource: detail.installations.length > 0,
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
      const vesselInstallations = installationsByVesselId[vessel.id] || currentEntry.installations

      entriesByKey[key] = {
        ...currentEntry,
        installations: vesselInstallations,
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
        live: {
          ...currentEntry.live,
          hasSignalKSource: vesselInstallations.length > 0,
        },
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
            hasSignalKSource: detail.installations.length > 0,
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

  function replaceAisContacts(
    namespace: VesselStoreNamespace,
    entryKey: string,
    contacts: AisContactSummary[],
  ) {
    updateEntry(namespace, entryKey, (currentEntry) => {
      const nextContacts = pruneStaleAisContactRecord(
        mergeAisContactsIntoRecord({}, contacts),
        Date.now(),
        AIS_CONTACT_DISPLAY_STALE_MS,
      )

      return {
        ...currentEntry,
        aisContacts: nextContacts,
        live: {
          ...currentEntry.live,
          lastDeltaAt: contacts.length ? Date.now() : currentEntry.live.lastDeltaAt,
        },
      }
    })
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

  function getNamespaceEffectiveLiveDemand(namespace: VesselStoreNamespace) {
    return mergeLiveDemands(Object.values(getNamespaceState(namespace).value.liveDemandByConsumer))
  }

  function getFreshnessState(observedAt: string | null | undefined): PublicFreshnessState {
    if (!observedAt) {
      return 'offline'
    }

    const observedMs = new Date(observedAt).getTime()
    if (Number.isNaN(observedMs)) {
      return 'offline'
    }

    const ageMinutes = (Date.now() - observedMs) / 60_000
    if (ageMinutes <= 15) {
      return 'live'
    }
    if (ageMinutes <= 120) {
      return 'recent'
    }
    return 'stale'
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

  function disconnectNamespace(namespace: VesselStoreNamespace, controller: LiveController) {
    clearReconnectTimer(controller)
    clearStaleSweepTimer(controller)

    if (controller.socket) {
      const currentSocket = controller.socket
      controller.socket = null
      currentSocket.close()
    }

    controller.activeUrl = null

    const previousKey = controller.activeEntryKey
    if (previousKey) {
      setEntryLiveState(namespace, previousKey, {
        activeUrl: null,
        connectionState: 'idle',
        sourceState: 'idle',
      })
    }
  }

  function scheduleReconnect(namespace: VesselStoreNamespace, controller: LiveController) {
    clearReconnectTimer(controller)

    if (
      !import.meta.client ||
      !getNamespaceLiveUrls(namespace).length ||
      isLiveDemandEmpty(getNamespaceEffectiveLiveDemand(namespace))
    ) {
      return
    }

    controller.reconnectTimer = setTimeout(() => {
      controller.reconnectTimer = null
      void connectNamespace(namespace, controller)
    }, RECONNECT_DELAY_MS)
  }

  function applyLiveSnapshot(
    namespace: VesselStoreNamespace,
    entryKey: string,
    snapshot: VesselSnapshotSummary | null,
    sourceState?: VesselLiveConnectionState,
  ) {
    updateEntry(namespace, entryKey, (currentEntry) => {
      const nextSnapshot = snapshot
        ? {
            ...snapshot,
            statusNote:
              snapshot.statusNote ||
              (namespace === 'auth'
                ? 'Live MyBoat collector telemetry'
                : 'Live public vessel telemetry'),
            updatedAt: snapshot.updatedAt || new Date().toISOString(),
          }
        : null
      const mergedSnapshot = mergeSnapshots(currentEntry.storedSnapshot, nextSnapshot)

      return {
        ...currentEntry,
        liveSnapshot: nextSnapshot,
        mergedSnapshot,
        vessel: withMergedSnapshot(currentEntry.vessel, mergedSnapshot),
        freshnessState: getFreshnessState(nextSnapshot?.observedAt || mergedSnapshot?.observedAt),
        live: {
          ...currentEntry.live,
          lastDeltaAt: nextSnapshot ? Date.now() : currentEntry.live.lastDeltaAt,
          sourceState: sourceState || currentEntry.live.sourceState,
        },
      }
    })
  }

  function applyAisUpsert(
    namespace: VesselStoreNamespace,
    entryKey: string,
    contact: AisContactSummary,
  ) {
    updateEntry(namespace, entryKey, (currentEntry) => {
      const mergedSelf = mergeSnapshots(currentEntry.storedSnapshot, currentEntry.liveSnapshot)
      if (!isAisContactNearSnapshot(contact, mergedSelf)) {
        return currentEntry
      }

      return {
        ...currentEntry,
        aisContacts: pruneStaleAisContactRecord(
          mergeAisContactsIntoRecord(currentEntry.aisContacts, [contact]),
          Date.now(),
          AIS_CONTACT_DISPLAY_STALE_MS,
        ),
        live: {
          ...currentEntry.live,
          lastDeltaAt: Date.now(),
        },
      }
    })
  }

  function applyAisRemove(namespace: VesselStoreNamespace, entryKey: string, contactId: string) {
    updateEntry(namespace, entryKey, (currentEntry) => {
      if (!(contactId in currentEntry.aisContacts)) {
        return currentEntry
      }

      const { [contactId]: _removed, ...nextContacts } = currentEntry.aisContacts

      return {
        ...currentEntry,
        aisContacts: nextContacts,
      }
    })
  }

  function applyLiveMessage(
    namespace: VesselStoreNamespace,
    entryKey: string,
    message: VesselLiveServerMessage,
  ) {
    switch (message.type) {
      case 'sync':
        applyLiveSnapshot(namespace, entryKey, message.snapshot, message.connectionState)
        updateEntry(namespace, entryKey, (currentEntry) => {
          const filteredSyncAis = filterAisContactsNearSnapshot(
            message.aisContacts,
            message.snapshot,
          )
          const nextContacts = pruneStaleAisContactRecord(
            mergeAisContactsIntoRecord({}, filteredSyncAis),
            Date.now(),
            AIS_CONTACT_DISPLAY_STALE_MS,
          )

          return {
            ...currentEntry,
            aisContacts: nextContacts,
            freshnessState: getFreshnessState(message.lastObservedAt),
            live: {
              ...currentEntry.live,
              lastDeltaAt: Date.now(),
              sourceState: message.connectionState,
            },
          }
        })
        return
      case 'snapshot':
        applyLiveSnapshot(namespace, entryKey, message.snapshot)
        return
      case 'ais_upsert':
        applyAisUpsert(namespace, entryKey, message.contact)
        return
      case 'ais_remove':
        applyAisRemove(namespace, entryKey, message.contactId)
        return
      case 'status':
        updateEntry(namespace, entryKey, (currentEntry) => ({
          ...currentEntry,
          freshnessState: getFreshnessState(message.lastObservedAt),
          live: {
            ...currentEntry.live,
            lastDeltaAt: Date.now(),
            sourceState: message.connectionState,
          },
        }))
        return
    }
  }

  async function handleMessage(
    namespace: VesselStoreNamespace,
    entryKey: string,
    data: string | ArrayBuffer | Blob,
  ) {
    try {
      const raw = await decodeMessageData(data)
      const payload = JSON.parse(raw) as VesselLiveServerMessage
      applyLiveMessage(namespace, entryKey, payload)
    } catch {
      // Ignore malformed live frames.
    }
  }

  function sendLiveDemand(namespace: VesselStoreNamespace, target: WebSocket) {
    if (target.readyState !== WebSocket.OPEN) {
      return
    }

    target.send(
      JSON.stringify({
        type: 'set_demand',
        demand: getNamespaceEffectiveLiveDemand(namespace),
      }),
    )
  }

  async function connectNamespace(namespace: VesselStoreNamespace, controller: LiveController) {
    const urls = getNamespaceLiveUrls(namespace)
    const activeEntry = getActiveEntry(namespace)
    const effectiveDemand = getNamespaceEffectiveLiveDemand(namespace)

    if (!import.meta.client || !activeEntry || !urls.length || isLiveDemandEmpty(effectiveDemand)) {
      disconnectNamespace(namespace, controller)
      return
    }

    const targetUrl = urls[0]!

    if (
      controller.socket &&
      controller.activeEntryKey === activeEntry.key &&
      controller.activeUrl === targetUrl &&
      controller.socket.readyState === WebSocket.OPEN
    ) {
      sendLiveDemand(namespace, controller.socket)
      return
    }

    clearReconnectTimer(controller)
    disconnectNamespace(namespace, controller)
    ensureStaleSweepTimer(namespace, controller)

    controller.activeEntryKey = activeEntry.key
    controller.activeUrl = targetUrl
    setEntryLiveState(namespace, activeEntry.key, {
      activeUrl: targetUrl,
      connectionState: 'connecting',
      hasSignalKSource: true,
      sourceState: activeEntry.live.sourceState,
      lastError: null,
    })

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
        sourceState: activeEntry.live.sourceState,
        lastError: null,
      })
      sendLiveDemand(namespace, nextSocket)
    })

    nextSocket.addEventListener('message', (event) => {
      if (controller.socket !== nextSocket) {
        return
      }

      void handleMessage(namespace, activeEntry.key, event.data)
    })

    nextSocket.addEventListener('error', () => {
      if (controller.socket !== nextSocket) {
        return
      }

      setEntryLiveState(namespace, activeEntry.key, {
        connectionState: 'error',
        lastError: 'MyBoat live feed unavailable',
      })
    })

    nextSocket.addEventListener('close', () => {
      if (controller.socket !== nextSocket) {
        return
      }

      controller.socket = null
      setEntryLiveState(namespace, activeEntry.key, {
        connectionState: 'error',
        lastError: 'MyBoat live feed disconnected',
      })

      scheduleReconnect(namespace, controller)
    })
  }

  function ensureLiveController(namespace: VesselStoreNamespace) {
    if (!import.meta.client || liveControllers.has(namespace)) {
      return
    }

    const controller: LiveController = {
      activeEntryKey: null,
      activeUrl: null,
      reconnectTimer: null,
      scope: effectScope(true),
      socket: null,
      staleSweepTimer: null,
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
              sourceState: 'idle',
            })
          }

          controller.activeEntryKey = nextKey

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

          if (!nextUrls.length) {
            disconnectNamespace(namespace, controller)
            const activeEntry = getActiveEntry(namespace)
            if (activeEntry) {
              setEntryLiveState(namespace, activeEntry.key, {
                activeUrl: null,
                connectionState: 'idle',
                sourceState: 'idle',
                hasSignalKSource: false,
              })
            }
            return
          }

          void connectNamespace(namespace, controller)
        },
        { deep: true },
      )

      watch(
        () => getNamespaceEffectiveLiveDemand(namespace),
        (nextDemand, previousDemand) => {
          if (JSON.stringify(nextDemand) === JSON.stringify(previousDemand)) {
            return
          }

          const activeEntry = getActiveEntry(namespace)
          if (!activeEntry) {
            return
          }

          if (controller.socket?.readyState === WebSocket.OPEN) {
            sendLiveDemand(namespace, controller.socket)
            return
          }

          if (isLiveDemandEmpty(nextDemand)) {
            disconnectNamespace(namespace, controller)
            return
          }

          void connectNamespace(namespace, controller)
        },
        { deep: true, immediate: true },
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
    replaceAisContacts,
    serializeAisContacts,
    setLiveDemand,
    setActiveAuthVessel,
    setActivePublicVessel,
    setRouteStatus,
    clearLiveDemand,
    syncMergedSnapshot,
  }
}
