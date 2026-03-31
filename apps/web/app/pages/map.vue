<script setup lang="ts">
import type {
  AisContactSummary,
  MediaItemSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'

/** Public captain handle whose live feed and vessel detail power the lab maps. */
const MAP_LAB_CAPTAIN_USERNAME = 'captain-tideye'

definePageMeta({ layout: 'landing' })

useSeo({
  title: 'Map lab',
  description: 'Developer showcase of MyBoat map surfaces, fed by live public data when available.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Map lab',
  description:
    'Showcase of map components with live @captain-tideye public vessel data and AIS when the API is reachable.',
})

const store = useMyBoatVesselStore()

const {
  data: profileData,
  error: profileError,
  pending: profilePending,
} = await usePublicProfile(MAP_LAB_CAPTAIN_USERNAME)

watch(
  () => profileData.value,
  (nextProfile) => {
    if (!nextProfile) {
      store.setActivePublicVessel(null)
      return
    }

    store.hydratePublicProfile(nextProfile)
    const primary = nextProfile.vessels.find((vessel) => vessel.isPrimary) ?? nextProfile.vessels[0]
    if (primary) {
      store.setActivePublicVessel(`${nextProfile.profile.username}/${primary.slug}`)
    } else {
      store.setActivePublicVessel(null)
    }
  },
  { immediate: true },
)

const captainUsername = computed(() => MAP_LAB_CAPTAIN_USERNAME)

const trafficContextSlug = computed(() => {
  const vessels = profileData.value?.vessels ?? []
  const primary = vessels.find((vessel) => vessel.isPrimary) ?? vessels[0]
  return primary?.slug ?? ''
})

const {
  data: vesselDetailPayload,
  pending: detailPending,
  refresh: refreshVesselDetail,
  error: detailError,
} = await useReactivePublicVesselDetail(MAP_LAB_CAPTAIN_USERNAME, trafficContextSlug)

watch(
  () => vesselDetailPayload.value,
  (nextDetail) => {
    if (!nextDetail) {
      return
    }

    store.hydratePublicVesselDetail(nextDetail)
    store.setActivePublicVessel(`${nextDetail.profile.username}/${nextDetail.vessel.slug}`)
  },
  { immediate: true },
)

onMounted(() => {
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'hidden') {
      return
    }

    if (trafficContextSlug.value) {
      void refreshVesselDetail()
    }
  }, 10_000)

  onBeforeUnmount(() => {
    clearInterval(timer)
  })
})

onBeforeUnmount(() => {
  store.setActivePublicVessel(null)
})

const publicVessels = computed(() => store.getPublicProfileEntries(MAP_LAB_CAPTAIN_USERNAME))

const trafficEntry = computed(() =>
  trafficContextSlug.value
    ? store.getPublicEntry(MAP_LAB_CAPTAIN_USERNAME, trafficContextSlug.value)
    : null,
)

const detail = computed(() =>
  trafficContextSlug.value
    ? store.getPublicDetail(MAP_LAB_CAPTAIN_USERNAME, trafficContextSlug.value)
    : null,
)

const rawAisContacts = computed(() => store.serializeAisContacts(trafficEntry.value))

const { contacts: enrichedAisContacts } = usePublicEnrichedTrafficContacts(
  captainUsername,
  trafficContextSlug,
  rawAisContacts,
)

const trafficMapEnabled = ref(true)

usePublicNearbyTrafficHydrator(
  captainUsername,
  trafficContextSlug,
  computed(() => trafficEntry.value?.key ?? null),
  trafficMapEnabled,
)

useMyBoatLiveDemand({
  namespace: 'public',
  consumerId: 'map-lab-captain-tideye',
  demand: computed(() => ({
    selfLevel: 'detail',
    ais: trafficMapEnabled.value,
  })),
})

const trafficLiveState = computed(() => trafficEntry.value?.live ?? null)

const liveFeedReady = computed(() =>
  Boolean(profileData.value?.vessels?.length && trafficContextSlug.value && detail.value),
)

const mapPassages = computed<PassageSummary[]>(() => {
  if (liveFeedReady.value && detail.value?.passages?.length) {
    return detail.value.passages.slice(0, 8)
  }

  return fixturePassages
})

const recentPassageIds = computed(() => new Set(mapPassages.value.map((p) => p.id)))

const mapMedia = computed<MediaItemSummary[]>(() => {
  if (liveFeedReady.value && detail.value?.media?.length) {
    return detail.value.media.filter(
      (item) =>
        item.matchStatus === 'attached' &&
        Boolean(item.passageId) &&
        recentPassageIds.value.has(item.passageId!) &&
        item.lat !== null &&
        item.lng !== null,
    )
  }

  return fixtureMedia
})

const mapWaypoints = computed<WaypointSummary[]>(() => {
  if (liveFeedReady.value && detail.value?.waypoints?.length) {
    return detail.value.waypoints
  }

  return fixtureWaypoints
})

const primaryMapVessel = computed<VesselCardSummary | null>(() => {
  if (liveFeedReady.value && detail.value?.vessel) {
    return detail.value.vessel
  }

  return null
})

const surfaceVessels = computed<VesselCardSummary[]>(() => {
  if (publicVessels.value.length > 0) {
    return publicVessels.value
  }

  return [fixturePrimaryVessel, fixtureFleetVessel]
})

const aisForMaps = computed<AisContactSummary[]>(() => {
  if (liveFeedReady.value) {
    return enrichedAisContacts.value
  }

  return fixtureAisContacts
})

const hasLiveSignalSource = computed(() =>
  liveFeedReady.value ? Boolean(trafficLiveState.value?.hasSignalKSource) : true,
)

const liveConnectionState = computed(() =>
  liveFeedReady.value ? (trafficLiveState.value?.connectionState ?? 'idle') : 'connected',
)

const liveLastDeltaAt = computed(() =>
  liveFeedReady.value ? (trafficLiveState.value?.lastDeltaAt ?? null) : null,
)

const trafficDetailBasePath = computed(() =>
  liveFeedReady.value && detail.value
    ? `/${detail.value.profile.username}/${detail.value.vessel.slug}/traffic`
    : null,
)

const pending = computed(
  () =>
    profilePending.value ||
    (Boolean(trafficContextSlug.value) && detailPending.value && !vesselDetailPayload.value),
)

const mapViewerFullscreenOpen = shallowRef(false)
const prototypeSelectedPassageId = shallowRef<string | null>(null)
const prototypeSelectionBootstrapped = shallowRef(false)

// --- Offline fixtures (Galveston demo) when @captain-tideye is unavailable ---

const FIXTURE_ISO = '2025-06-01T12:00:00.000Z'
const FIXTURE_MS = new Date(FIXTURE_ISO).getTime()

const fixtureTrackGeojson = JSON.stringify({
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-94.825, 29.302],
      [-94.808, 29.308],
      [-94.792, 29.314],
    ],
  },
  properties: {},
})

const fixtureTrackGeojsonHarbor = JSON.stringify({
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-94.813, 29.294],
      [-94.806, 29.299],
      [-94.799, 29.304],
      [-94.792, 29.309],
    ],
  },
  properties: {},
})

const fixtureTrackGeojsonCauseway = JSON.stringify({
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-94.79, 29.313],
      [-94.781, 29.318],
      [-94.772, 29.321],
    ],
  },
  properties: {},
})

const fixturePrimaryVessel: VesselCardSummary = {
  id: 'map-lab-primary',
  slug: 'map-lab-primary',
  name: 'Map Lab Sloop',
  vesselType: 'Cruiser',
  homePort: 'Galveston, TX',
  summary: null,
  isPrimary: true,
  sharePublic: true,
  latestPassage: null,
  liveSnapshot: {
    observedAt: FIXTURE_ISO,
    positionLat: 29.308,
    positionLng: -94.798,
    headingMagnetic: 52,
    speedOverGround: 2.2,
    speedThroughWater: null,
    windSpeedApparent: null,
    windAngleApparent: null,
    depthBelowTransducer: 12.4,
    waterTemperatureKelvin: null,
    batteryVoltage: null,
    engineRpm: null,
    statusNote: null,
  },
  mediaCount: 4,
  waypointCount: 4,
}

const fixtureFleetVessel: VesselCardSummary = {
  id: 'map-lab-fleet',
  slug: 'map-lab-fleet',
  name: 'Fleet wing',
  vesselType: 'Daysailer',
  homePort: 'Kemah, TX',
  summary: null,
  isPrimary: false,
  sharePublic: true,
  latestPassage: null,
  liveSnapshot: {
    observedAt: FIXTURE_ISO,
    positionLat: 29.318,
    positionLng: -94.788,
    headingMagnetic: 200,
    speedOverGround: 1.8,
    speedThroughWater: null,
    windSpeedApparent: null,
    windAngleApparent: null,
    depthBelowTransducer: 8.1,
    waterTemperatureKelvin: null,
    batteryVoltage: null,
    engineRpm: null,
    statusNote: null,
  },
  mediaCount: 0,
  waypointCount: 0,
}

const fixturePassages: PassageSummary[] = [
  {
    id: 'map-lab-passage-bluewater',
    title: 'Bluewater shakedown',
    summary: 'Sample offshore leg for the operational playback stage.',
    departureName: 'Galveston Bay',
    arrivalName: 'Offshore leg',
    startedAt: FIXTURE_ISO,
    endedAt: FIXTURE_ISO,
    distanceNm: 12,
    maxWindKn: 18,
    trackGeojson: fixtureTrackGeojson,
    playbackAvailable: false,
  },
  {
    id: 'map-lab-passage-harbor',
    title: 'Harbor photo run',
    summary: 'Tighter route with more photo coverage around the jetties.',
    departureName: 'East Beach',
    arrivalName: 'Harbor mouth',
    startedAt: '2025-05-28T09:30:00.000Z',
    endedAt: '2025-05-28T12:10:00.000Z',
    distanceNm: 6.4,
    maxWindKn: 15,
    trackGeojson: fixtureTrackGeojsonHarbor,
    playbackAvailable: false,
  },
  {
    id: 'map-lab-passage-causeway',
    title: 'Causeway sunset return',
    summary: 'Protected-water return leg used to show route switching in the rail.',
    departureName: 'Bolivar Roads',
    arrivalName: 'Pelican Island',
    startedAt: '2025-05-24T18:05:00.000Z',
    endedAt: '2025-05-24T19:55:00.000Z',
    distanceNm: 4.8,
    maxWindKn: 12,
    trackGeojson: fixtureTrackGeojsonCauseway,
    playbackAvailable: false,
  },
]

const fixtureWaypoints: WaypointSummary[] = [
  {
    id: 'map-lab-wp-1',
    passageId: 'map-lab-passage-bluewater',
    title: 'Anchorage practice',
    note: null,
    kind: 'anchorage',
    lat: 29.312,
    lng: -94.805,
    visitedAt: FIXTURE_ISO,
  },
  {
    id: 'map-lab-wp-2',
    passageId: 'map-lab-passage-bluewater',
    title: 'Channel mark',
    note: null,
    kind: 'hazard',
    lat: 29.304,
    lng: -94.812,
    visitedAt: null,
  },
  {
    id: 'map-lab-wp-3',
    passageId: 'map-lab-passage-harbor',
    title: 'Jetty turn',
    note: 'Good camera angle on the inbound run.',
    kind: 'waypoint',
    lat: 29.301,
    lng: -94.801,
    visitedAt: '2025-05-28T10:32:00.000Z',
  },
  {
    id: 'map-lab-wp-4',
    passageId: 'map-lab-passage-causeway',
    title: 'Sunset drift',
    note: null,
    kind: 'anchorage',
    lat: 29.319,
    lng: -94.778,
    visitedAt: '2025-05-24T19:12:00.000Z',
  },
]

const fixtureMedia: MediaItemSummary[] = [
  {
    id: 'map-lab-media-bluewater',
    passageId: 'map-lab-passage-bluewater',
    title: 'Deck snapshot',
    caption: 'Geo-tagged media pin on the chart.',
    imageUrl: 'https://picsum.photos/seed/myboatmaplab/640/400',
    sharePublic: true,
    matchStatus: 'attached',
    matchScore: null,
    matchReason: null,
    isCover: false,
    lat: 29.31,
    lng: -94.8,
    capturedAt: FIXTURE_ISO,
  },
  {
    id: 'map-lab-media-harbor-1',
    passageId: 'map-lab-passage-harbor',
    title: 'Jetty sweep',
    caption: 'Photos now stay inside the active passage context instead of dropping below the map.',
    imageUrl: 'https://picsum.photos/seed/myboatharbor/640/400',
    sharePublic: true,
    matchStatus: 'attached',
    matchScore: null,
    matchReason: null,
    isCover: true,
    lat: 29.302,
    lng: -94.803,
    capturedAt: '2025-05-28T10:28:00.000Z',
  },
  {
    id: 'map-lab-media-harbor-2',
    passageId: 'map-lab-passage-harbor',
    title: 'Helm detail',
    caption: 'Alternate frame for the filmstrip concept.',
    imageUrl: 'https://picsum.photos/seed/myboathelm/640/400',
    sharePublic: true,
    matchStatus: 'attached',
    matchScore: null,
    matchReason: null,
    isCover: false,
    lat: 29.305,
    lng: -94.797,
    capturedAt: '2025-05-28T11:04:00.000Z',
  },
  {
    id: 'map-lab-media-causeway',
    passageId: 'map-lab-passage-causeway',
    title: 'Causeway glow',
    caption: 'Different passage, same viewer shell, to show route switching.',
    imageUrl: 'https://picsum.photos/seed/myboatsunset/640/400',
    sharePublic: true,
    matchStatus: 'attached',
    matchScore: null,
    matchReason: null,
    isCover: true,
    lat: 29.319,
    lng: -94.779,
    capturedAt: '2025-05-24T19:18:00.000Z',
  },
]

function fixtureAis(
  id: string,
  name: string,
  shipType: number | null,
  lat: number,
  lng: number,
  sog: number | null,
  cog: number,
): AisContactSummary {
  return {
    id,
    name,
    mmsi: `366${id.slice(-6).padStart(6, '0')}`,
    shipType,
    lat,
    lng,
    cog,
    sog,
    heading: cog,
    destination: 'DEMO',
    callSign: null,
    length: null,
    beam: null,
    draft: null,
    navState: null,
    lastUpdateAt: FIXTURE_MS,
  }
}

const fixtureAisContacts: AisContactSummary[] = [
  fixtureAis('lab-a37', 'Pleasure demo', 37, 29.318, -94.792, 2.1, 85),
  fixtureAis('lab-a36', 'Sail demo', 36, 29.302, -94.79, 1.5, 310),
  fixtureAis('lab-a30', 'Fishing demo', 30, 29.314, -94.81, 0.2, 0),
  fixtureAis('lab-a70', 'Cargo demo', 71, 29.3, -94.785, 3.5, 120),
  fixtureAis('lab-a80', 'Tanker demo', 82, 29.322, -94.815, 2.8, 260),
  fixtureAis('lab-a60', 'Ferry demo', 64, 29.296, -94.802, 4.0, 45),
  fixtureAis('lab-a31', 'Tow demo', 32, 29.325, -94.798, 1.2, 180),
  fixtureAis('lab-a45', 'Service demo', 45, 29.29, -94.808, 0.5, 270),
  fixtureAis('lab-a35', 'Military demo', 35, 29.328, -94.782, 4.5, 15),
  fixtureAis('lab-move', 'Unknown moving', null, 29.306, -94.818, 2.0, 200),
  fixtureAis('lab-idle', 'Unknown idle', null, 29.311, -94.784, 0, 0),
]

const currentLocationVessel = computed(() => primaryMapVessel.value ?? fixturePrimaryVessel)

const detailedMapVessel = computed(() => primaryMapVessel.value ?? fixturePrimaryVessel)
const prototypeViewerVesselSlug = computed(
  () => (detail.value?.vessel.slug ?? trafficContextSlug.value) || null,
)

watch(
  mapPassages,
  (passages) => {
    if (!passages.length) {
      prototypeSelectedPassageId.value = null
      return
    }

    if (!prototypeSelectionBootstrapped.value) {
      prototypeSelectedPassageId.value =
        passages.find((passage) => passage.playbackAvailable)?.id ??
        passages.find((passage) => Boolean(passage.trackGeojson))?.id ??
        passages[0]?.id ??
        null
      prototypeSelectionBootstrapped.value = true
      return
    }

    if (
      prototypeSelectedPassageId.value &&
      !passages.some((passage) => passage.id === prototypeSelectedPassageId.value)
    ) {
      prototypeSelectedPassageId.value = passages[0]?.id ?? null
    }
  },
  { immediate: true },
)

watch(mapViewerFullscreenOpen, (open) => {
  if (!import.meta.client) {
    return
  }

  document.body.style.overflow = open ? 'hidden' : ''
})

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }

  document.body.style.overflow = ''
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
    <div class="space-y-2">
      <div class="marine-kicker w-fit">Developer</div>
      <h1 class="font-display text-3xl text-default">Map lab</h1>
      <p class="max-w-2xl text-sm text-muted">
        Map components below use live public data for
        <span class="font-medium text-default">@{{ MAP_LAB_CAPTAIN_USERNAME }}</span>
        when the profile and vessel API respond: WebSocket feed, AIS enrichment, and nearby traffic
        hydration match the public captain page. If that account is unavailable, Galveston fixtures
        load instead.
      </p>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <UBadge v-if="liveFeedReady" color="primary" variant="subtle">
          Live · @{{ MAP_LAB_CAPTAIN_USERNAME }}
        </UBadge>
        <UBadge v-else-if="!pending && !profileError" color="warning" variant="subtle">
          Demo fixtures
        </UBadge>
        <UBadge
          v-if="liveFeedReady && trafficLiveState?.connectionState === 'connected'"
          color="success"
          variant="subtle"
        >
          Feed connected
        </UBadge>
      </div>
    </div>

    <UAlert
      v-if="profileError || detailError"
      color="warning"
      variant="soft"
      :title="profileError ? 'Public profile unavailable' : 'Vessel detail unavailable'"
      :description="
        profileError
          ? `Showing offline map fixtures. Confirm @${MAP_LAB_CAPTAIN_USERNAME} exists and is shared publicly.`
          : 'Live map layers may be incomplete until detail loads. Fixtures still apply where data is missing.'
      "
    />

    <template v-if="pending">
      <USkeleton class="h-48 rounded-[1.5rem]" />
      <USkeleton class="h-[22rem] rounded-[1.5rem]" />
      <USkeleton class="h-[28rem] rounded-[1.5rem]" />
    </template>

    <template v-else>
      <section class="space-y-3">
        <h2 class="font-display text-xl text-default">MyBoatCurrentLocationMap</h2>
        <p class="text-sm text-muted">
          Compact chart with vessel pin, optional traffic vectors, and advanced tools.
        </p>
        <MyBoatCurrentLocationMap
          :vessel="currentLocationVessel"
          :ais-contacts="aisForMaps"
          :has-signal-k-source="hasLiveSignalSource"
          :traffic-detail-base-path="trafficDetailBasePath"
          v-model:traffic-enabled="trafficMapEnabled"
          height-class="h-[20rem] sm:h-[26rem]"
        />
      </section>

      <section class="space-y-3">
        <h2 class="font-display text-xl text-default">MyBoatSurfaceMap</h2>
        <p class="text-sm text-muted">
          Fleet-style surface with layer toggles, AIS, clustering at scale, and photo pins.
        </p>
        <MyBoatSurfaceMap
          :vessels="surfaceVessels"
          :passages="mapPassages"
          :waypoints="mapWaypoints"
          :media="mapMedia"
          :allow-traffic="liveFeedReady ? Boolean(trafficContextSlug) : true"
          :has-signal-k-source="hasLiveSignalSource"
          :show-ais-toggle="liveFeedReady ? Boolean(trafficContextSlug) : true"
          :live-connection-state="liveConnectionState"
          :live-last-delta-at="liveLastDeltaAt"
          v-model:traffic-enabled="trafficMapEnabled"
          :ais-contacts="aisForMaps"
          tools-profile="navigation"
          height-class="h-[22rem] sm:h-[28rem] lg:h-[32rem]"
        />
      </section>

      <section class="space-y-3">
        <h2 class="font-display text-xl text-default">MyBoatDetailedMap</h2>
        <p class="text-sm text-muted">
          Operational chart with routes, waypoints, photos, AIS vectors, and focus rail.
        </p>
        <MyBoatDetailedMap
          :vessel="detailedMapVessel"
          :passages="mapPassages"
          :waypoints="mapWaypoints"
          :media="mapMedia"
          :ais-contacts="aisForMaps"
          :has-signal-k-source="hasLiveSignalSource"
          :live-connection-state="liveConnectionState"
          :live-last-delta-at="liveLastDeltaAt"
          :traffic-detail-base-path="trafficDetailBasePath"
          tools-profile="navigation"
          height-class="h-[24rem] sm:h-[30rem] lg:h-[38rem]"
          :persist-key="`map-lab-detailed-${MAP_LAB_CAPTAIN_USERNAME}`"
        />
      </section>

      <section class="space-y-3">
        <h2 class="font-display text-xl text-default">Passage viewer prototype</h2>
        <p class="max-w-3xl text-sm text-muted">
          Prototype bottom viewer that blends Tideye’s docked playback feel with MyBoat’s route,
          waypoint, AIS, and media-aware chart surfaces. The same focused photos stay on the map and
          in the viewer shell, and a clear fullscreen control opens the concept edge to edge.
        </p>
        <MapLabPassageViewerPrototype
          v-model:selected-passage-id="prototypeSelectedPassageId"
          :vessel="detailedMapVessel"
          :passages="mapPassages"
          :waypoints="mapWaypoints"
          :media="mapMedia"
          access-scope="public"
          :public-username="MAP_LAB_CAPTAIN_USERNAME"
          :public-vessel-slug="prototypeViewerVesselSlug"
          :map-persist-key="`map-lab-prototype-${MAP_LAB_CAPTAIN_USERNAME}`"
          @open-fullscreen="mapViewerFullscreenOpen = true"
        />
      </section>

      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="mapViewerFullscreenOpen"
            class="fixed inset-0 z-[250] bg-[rgb(2_6_23_/_0.78)] p-3 backdrop-blur-sm sm:p-4"
          >
            <div
              class="mx-auto h-full max-w-[1600px] overflow-auto rounded-[2rem] sm:rounded-[2.25rem]"
            >
              <MapLabPassageViewerPrototype
                v-model:selected-passage-id="prototypeSelectedPassageId"
                fullscreen
                :vessel="detailedMapVessel"
                :passages="mapPassages"
                :waypoints="mapWaypoints"
                :media="mapMedia"
                access-scope="public"
                :public-username="MAP_LAB_CAPTAIN_USERNAME"
                :public-vessel-slug="prototypeViewerVesselSlug"
                :map-persist-key="`map-lab-prototype-${MAP_LAB_CAPTAIN_USERNAME}:fullscreen`"
                @close-fullscreen="mapViewerFullscreenOpen = false"
              />
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>
  </div>
</template>
