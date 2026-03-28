<script setup lang="ts">
import type {
  AisContactSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'
import { buildTrackFeatureCollection, formatRelativeTime, formatTimestamp } from '~/utils/marine'

interface MarineMapHandle {
  setRegion: (center: { lat: number; lng: number }, span?: { lat: number; lng: number }) => void
  zoomToFit: (zoomOutLevels?: number) => void
}

interface MarineMapInstallation {
  collectorSignalKUrl?: string | null
  signalKUrl?: string | null
  relaySignalKUrl?: string | null
}

interface MarineMapVesselPin {
  id: string
  lat: number
  lng: number
  pinKind: 'vessel'
  title: string
  vesselId: string
  homePort: string | null
  isPrimary: boolean
  heading: number | null
  speedOverGround: number | null
  observedAt: string | null
}

interface MarineMapWaypointPin {
  id: string
  lat: number
  lng: number
  pinKind: 'waypoint'
  title: string
  kind: string
  visitedAt: string | null
}

interface MarineMapAisPin {
  id: string
  lat: number
  lng: number
  pinKind: 'ais'
  title: string
  contactId: string
  mmsi: string | null
  shipType: number | null
  heading: number | null
  cog: number | null
  sog: number | null
  destination: string | null
  callSign: string | null
  navState: string | null
  length: number | null
  beam: number | null
  draft: number | null
  distanceNm: number
  lastUpdateAt: number
}

type MarineMapPin = MarineMapVesselPin | MarineMapWaypointPin | MarineMapAisPin

const AIS_NEARBY_RADIUS_NM = 24
const AIS_VECTOR_LOOKAHEAD_MINUTES = 12
const AIS_VECTOR_MIN_DISTANCE_NM = 0.12
const AIS_VECTOR_MAX_DISTANCE_NM = 2.2
const AIS_DUPLICATE_RADIUS_NM = 0.06

const props = withDefaults(
  defineProps<{
    vessels?: VesselCardSummary[]
    passages?: PassageSummary[]
    waypoints?: WaypointSummary[]
    installations?: MarineMapInstallation[]
    heightClass?: string
    persistKey?: string | null
    trafficMode?: 'auto' | 'off'
  }>(),
  {
    vessels: () => [],
    passages: () => [],
    waypoints: () => [],
    installations: () => [],
    heightClass: 'h-[24rem]',
    persistKey: null,
    trafficMode: 'auto',
  },
)

const route = useRoute()
const mapRef = useTemplateRef<MarineMapHandle>('mapSurface')
const mapHost = useTemplateRef<HTMLElement>('mapHost')

const selectedId = shallowRef<string | null>(null)
const showVessels = shallowRef(true)
const showRoutes = shallowRef(true)
const showWaypoints = shallowRef(true)
const showTraffic = shallowRef(props.trafficMode === 'auto' && props.vessels.length === 1)
const showTrafficVectors = shallowRef(true)
const showPointsOfInterest = shallowRef(true)
const isFullscreen = shallowRef(false)

const persistKey = computed(() => {
  if (props.persistKey?.trim()) {
    return props.persistKey.trim()
  }

  const vesselSegment =
    props.vessels.length === 1
      ? props.vessels[0]?.slug || props.vessels[0]?.id
      : props.vessels
          .map((vessel) => vessel.slug || vessel.id)
          .sort()
          .join(',')

  return `${route.path}:${vesselSegment || 'surface'}`
})

const { savedRegion, clearSavedRegion, getSavedRegion, onRegionChange } = useMarineMapRegion(
  () => persistKey.value,
)
const defaultSignalKSocketUrl = shallowRef<string | null>(null)

const vesselPins = computed<MarineMapVesselPin[]>(() =>
  props.vessels
    .filter(
      (vessel) =>
        vessel.liveSnapshot?.positionLat !== null &&
        vessel.liveSnapshot?.positionLat !== undefined &&
        vessel.liveSnapshot?.positionLng !== null &&
        vessel.liveSnapshot?.positionLng !== undefined,
    )
    .map((vessel) => ({
      id: vessel.id,
      lat: vessel.liveSnapshot!.positionLat!,
      lng: vessel.liveSnapshot!.positionLng!,
      pinKind: 'vessel',
      title: vessel.name,
      vesselId: vessel.id,
      homePort: vessel.homePort,
      isPrimary: vessel.isPrimary,
      heading: vessel.liveSnapshot?.headingMagnetic ?? null,
      speedOverGround: vessel.liveSnapshot?.speedOverGround ?? null,
      observedAt: vessel.liveSnapshot?.observedAt ?? null,
    })),
)

const waypointPins = computed<MarineMapWaypointPin[]>(() =>
  props.waypoints.map((waypoint) => ({
    id: waypoint.id,
    lat: waypoint.lat,
    lng: waypoint.lng,
    pinKind: 'waypoint',
    title: waypoint.title,
    kind: waypoint.kind,
    visitedAt: waypoint.visitedAt,
  })),
)

const primaryVessel = computed(
  () => props.vessels.find((vessel) => vessel.isPrimary) || props.vessels[0] || null,
)
const isSingleVesselSurface = computed(() => props.vessels.length === 1)
const trafficAllowed = computed(() => props.trafficMode === 'auto' && isSingleVesselSurface.value)
const focusSnapshot = computed(() => primaryVessel.value?.liveSnapshot ?? null)

const signalKUrlCandidates = computed(() => {
  const candidates = new Set<string>()

  for (const installation of props.installations) {
    for (const rawUrl of [
      installation.collectorSignalKUrl,
      installation.relaySignalKUrl,
      installation.signalKUrl,
    ]) {
      const normalized = normalizeSignalKSocketUrl(rawUrl)
      if (normalized) {
        candidates.add(normalized)
      }
    }
  }

  if (isSingleVesselSurface.value) {
    const fallbackRelayUrl = defaultSignalKSocketUrl.value
    if (fallbackRelayUrl) {
      candidates.add(fallbackRelayUrl)
    }
  }

  return Array.from(candidates)
})

const aisFeedEnabled = computed(
  () => import.meta.client && trafficAllowed.value && showTraffic.value,
)

const {
  contacts: aisContacts,
  connectionState: aisConnectionState,
  lastDeltaAt: aisLastDeltaAt,
} = useSignalKAisFeed({
  enabled: aisFeedEnabled,
  urls: signalKUrlCandidates,
})

const trafficReference = computed(() => {
  if (
    focusSnapshot.value?.positionLat !== null &&
    focusSnapshot.value?.positionLat !== undefined &&
    focusSnapshot.value?.positionLng !== null &&
    focusSnapshot.value?.positionLng !== undefined
  ) {
    return {
      lat: focusSnapshot.value.positionLat,
      lng: focusSnapshot.value.positionLng,
    }
  }

  return null
})

const nearbyAisContacts = computed(() => {
  const reference = trafficReference.value
  const focusName = primaryVessel.value?.name.trim().toLowerCase() || null

  if (!showTraffic.value || !reference) {
    return []
  }

  return aisContacts.value
    .filter(
      (contact) =>
        contact.lat !== null &&
        contact.lat !== undefined &&
        contact.lng !== null &&
        contact.lng !== undefined,
    )
    .map((contact) => ({
      contact,
      distanceNm: haversineNm(reference.lat, reference.lng, contact.lat!, contact.lng!),
    }))
    .filter(({ contact, distanceNm }) => {
      if (distanceNm > AIS_NEARBY_RADIUS_NM) {
        return false
      }

      if (!focusName || !contact.name) {
        return true
      }

      return !(
        distanceNm <= AIS_DUPLICATE_RADIUS_NM && contact.name.trim().toLowerCase() === focusName
      )
    })
    .sort((left, right) => left.distanceNm - right.distanceNm)
    .slice(0, 32)
})

const aisPins = computed<MarineMapAisPin[]>(() =>
  nearbyAisContacts.value.map(({ contact, distanceNm }) => ({
    id: `ais:${contact.id}`,
    lat: contact.lat!,
    lng: contact.lng!,
    pinKind: 'ais',
    title: aisDisplayName(contact),
    contactId: contact.id,
    mmsi: contact.mmsi,
    shipType: contact.shipType,
    heading: contact.heading,
    cog: contact.cog,
    sog: contact.sog,
    destination: contact.destination,
    callSign: contact.callSign,
    navState: contact.navState,
    length: contact.length,
    beam: contact.beam,
    draft: contact.draft,
    distanceNm,
    lastUpdateAt: contact.lastUpdateAt,
  })),
)

const items = computed<MarineMapPin[]>(() => [
  ...(showVessels.value ? vesselPins.value : []),
  ...(showWaypoints.value ? waypointPins.value : []),
  ...(showTraffic.value ? aisPins.value : []),
])

const allPins = computed<MarineMapPin[]>(() => [
  ...vesselPins.value,
  ...waypointPins.value,
  ...aisPins.value,
])

const baseGeojson = computed(() => buildTrackFeatureCollection(props.passages))
const trafficVectorGeojson = computed(() => buildAisVectorFeatureCollection(aisPins.value))
const geojson = computed(() => ({
  type: 'FeatureCollection' as const,
  features: [
    ...(showRoutes.value ? baseGeojson.value.features : []),
    ...(showTraffic.value && showTrafficVectors.value ? trafficVectorGeojson.value.features : []),
  ],
}))

const hasMapData = computed(
  () =>
    items.value.length > 0 ||
    baseGeojson.value.features.length > 0 ||
    trafficVectorGeojson.value.features.length > 0,
)
const emptyStateDescription = computed(() =>
  trafficAllowed.value
    ? 'Your map will render the current vessel fix, nearby AIS traffic, passage history, and saved places once telemetry is attached to this vessel.'
    : 'Your map will render the current vessel fix, passage history, and saved places once telemetry is attached to this vessel.',
)

const selectedPin = computed(
  () => allPins.value.find((item) => item.id === selectedId.value) || null,
)
const selectedVessel = computed(() => {
  const selected = selectedPin.value
  if (!selected || selected.pinKind !== 'vessel') return null
  return props.vessels.find((vessel) => vessel.id === selected.vesselId) || null
})
const selectedAisPin = computed(() => {
  const selected = selectedPin.value
  return selected?.pinKind === 'ais' ? selected : null
})
const focusVessel = computed(() => selectedVessel.value || primaryVessel.value)
const showsDenseLabels = computed(() => props.vessels.length <= 3)
const clusteringIdentifier = computed(() =>
  items.value.length >= 8 ? 'marine-track-map' : undefined,
)

const focusedSummary = computed(() => {
  if (selectedPin.value?.pinKind === 'waypoint') {
    return {
      eyebrow: 'Waypoint selected',
      title: selectedPin.value.title,
      description:
        selectedPin.value.kind === 'anchorage'
          ? 'Anchorage marker saved on this vessel route.'
          : `${selectedPin.value.kind.replaceAll('_', ' ')} marker saved on this vessel route.`,
    }
  }

  if (selectedAisPin.value) {
    const shipCategory = getAisCategory(selectedAisPin.value.shipType, selectedAisPin.value.sog)
    const destination = selectedAisPin.value.destination
      ? ` Destination ${selectedAisPin.value.destination}.`
      : ''

    return {
      eyebrow: 'AIS contact',
      title: selectedAisPin.value.title,
      description: `${shipCategory.label} contact ${formatDistanceNm(selectedAisPin.value.distanceNm)} from ${focusVessel.value?.name || 'the focus vessel'}.${destination}`,
    }
  }

  if (focusVessel.value) {
    return {
      eyebrow: isSingleVesselSurface.value ? 'Primary vessel' : 'Fleet focus',
      title: focusVessel.value.name,
      description: focusSnapshot.value?.observedAt
        ? `Last observed ${formatRelativeTime(focusSnapshot.value.observedAt)}${
            focusVessel.value.homePort ? ` near ${focusVessel.value.homePort}` : ''
          }.`
        : focusVessel.value.homePort
          ? `No fresh position fix yet. Home port is ${focusVessel.value.homePort}.`
          : 'No fresh position fix yet. Route memory and saved markers remain available.',
    }
  }

  return {
    eyebrow: 'Map view',
    title: 'Route surface',
    description: trafficAllowed.value
      ? 'Saved passages, waypoints, live vessel fixes, and nearby AIS traffic render here when available.'
      : 'Saved passages, waypoints, and live vessel fixes render here when available.',
  }
})

const trafficStatus = computed(() => {
  if (!trafficAllowed.value) return 'AIS unavailable'
  if (!showTraffic.value) return 'AIS off'

  switch (aisConnectionState.value) {
    case 'connected':
      return aisPins.value.length ? `${aisPins.value.length} nearby` : 'No contacts nearby'
    case 'connecting':
      return 'Connecting'
    case 'error':
      return 'Feed unavailable'
    default:
      return signalKUrlCandidates.value.length ? 'Standby' : 'No feed'
  }
})

const stats = computed(() => {
  if (selectedAisPin.value) {
    return [
      {
        label: 'Observed',
        value: formatRelativeTime(new Date(selectedAisPin.value.lastUpdateAt).toISOString()),
      },
      {
        label: 'Range',
        value: formatDistanceNm(selectedAisPin.value.distanceNm),
      },
      {
        label: 'SOG',
        value:
          selectedAisPin.value.sog === null || selectedAisPin.value.sog === undefined
            ? '--'
            : `${selectedAisPin.value.sog.toFixed(1)} kts`,
      },
      {
        label: 'Heading',
        value:
          selectedAisPin.value.heading === null || selectedAisPin.value.heading === undefined
            ? '--'
            : `${Math.round(selectedAisPin.value.heading)}°`,
      },
    ]
  }

  if (focusVessel.value && focusSnapshot.value) {
    return [
      {
        label: 'Observed',
        value: formatRelativeTime(focusSnapshot.value.observedAt),
      },
      {
        label: 'SOG',
        value:
          focusSnapshot.value.speedOverGround === null ||
          focusSnapshot.value.speedOverGround === undefined
            ? '--'
            : `${focusSnapshot.value.speedOverGround.toFixed(1)} kts`,
      },
      {
        label: 'Heading',
        value:
          focusSnapshot.value.headingMagnetic === null ||
          focusSnapshot.value.headingMagnetic === undefined
            ? '--'
            : `${Math.round(focusSnapshot.value.headingMagnetic)}°`,
      },
      {
        label: trafficAllowed.value ? 'Traffic' : 'Depth',
        value: trafficAllowed.value
          ? trafficStatus.value
          : focusSnapshot.value.depthBelowTransducer === null ||
              focusSnapshot.value.depthBelowTransducer === undefined
            ? '--'
            : `${focusSnapshot.value.depthBelowTransducer.toFixed(1)} m`,
      },
    ]
  }

  return [
    { label: 'Vessels', value: String(vesselPins.value.length) },
    { label: 'Routes', value: String(baseGeojson.value.features.length) },
    { label: 'Waypoints', value: String(waypointPins.value.length) },
    {
      label: trafficAllowed.value ? 'Traffic' : 'Scope',
      value: trafficAllowed.value
        ? trafficStatus.value
        : isSingleVesselSurface.value
          ? 'Single vessel'
          : 'Fleet',
    },
  ]
})

const fallbackCenter = computed(() => {
  const focusLat = focusSnapshot.value?.positionLat
  const focusLng = focusSnapshot.value?.positionLng

  if (focusLat !== null && focusLat !== undefined && focusLng !== null && focusLng !== undefined) {
    return { lat: focusLat, lng: focusLng }
  }

  const firstWaypoint = props.waypoints[0]
  if (firstWaypoint) {
    return { lat: firstWaypoint.lat, lng: firstWaypoint.lng }
  }

  return { lat: 29.3043, lng: -94.7977 }
})

const annotationSize = computed(() =>
  items.value.length > 10
    ? { width: 92, height: 72 }
    : showsDenseLabels.value
      ? { width: 116, height: 78 }
      : { width: 84, height: 68 },
)

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

function buildDefaultSignalKSocketUrl() {
  if (!import.meta.client) {
    return null
  }

  return normalizeSignalKSocketUrl('/api/signalk/relay')
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

function projectPoint(lat: number, lng: number, bearingDeg: number, distanceNm: number) {
  const earthRadiusNm = 3440.065
  const angularDistance = distanceNm / earthRadiusNm
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  )

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    )

  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI] as const
}

function buildAisVectorFeatureCollection(pins: MarineMapAisPin[]) {
  return {
    type: 'FeatureCollection' as const,
    features: pins
      .filter((pin) => pin.sog !== null && pin.sog !== undefined && pin.sog > 0.4)
      .map((pin) => {
        const speedOverGround = pin.sog
        const course = pin.cog ?? pin.heading
        if (
          course === null ||
          course === undefined ||
          speedOverGround === null ||
          speedOverGround === undefined
        ) {
          return null
        }

        const projectedDistanceNm = Math.min(
          AIS_VECTOR_MAX_DISTANCE_NM,
          Math.max(
            AIS_VECTOR_MIN_DISTANCE_NM,
            speedOverGround * (AIS_VECTOR_LOOKAHEAD_MINUTES / 60),
          ),
        )
        const projectedPoint = projectPoint(pin.lat, pin.lng, course, projectedDistanceNm)

        return {
          type: 'Feature' as const,
          properties: {
            featureKind: 'ais-vector',
            danger: pin.distanceNm <= 1.5,
            shipType: pin.shipType,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: [[pin.lng, pin.lat], projectedPoint],
          },
        }
      })
      .filter((feature): feature is NonNullable<typeof feature> => feature !== null),
  }
}

function routeOverlayStyle(properties: Record<string, unknown>) {
  if (properties.featureKind === 'ais-vector') {
    const isDangerous = Boolean(properties.danger)

    return {
      strokeColor: isDangerous ? 'rgb(239 68 68)' : 'rgb(249 115 22)',
      strokeOpacity: isDangerous ? 0.88 : 0.68,
      fillColor: 'rgb(15 23 42)',
      fillOpacity: 0,
      lineWidth: isDangerous ? 2.8 : 2,
    }
  }

  const rank = typeof properties.rank === 'number' ? properties.rank : Number(properties.rank ?? 9)
  const isLatest = rank === 0
  const opacity = isLatest ? 0.96 : Math.max(0.24, 0.62 - rank * 0.08)

  return {
    strokeColor: isLatest ? 'rgb(14 116 144)' : 'rgb(59 130 246)',
    strokeOpacity: opacity,
    fillColor: 'rgb(15 23 42)',
    fillOpacity: 0,
    lineWidth: isLatest ? 4 : 2.35,
  }
}

function observationTone(observedAt: string | null) {
  if (!observedAt) return 'rgb(148 163 184)'

  const ageMinutes = (Date.now() - new Date(observedAt).getTime()) / 60_000

  if (ageMinutes <= 20) return 'rgb(16 185 129)'
  if (ageMinutes <= 120) return 'rgb(245 158 11)'
  return 'rgb(148 163 184)'
}

function aisFreshnessTone(lastUpdateAt: number) {
  const ageMinutes = (Date.now() - lastUpdateAt) / 60_000

  if (ageMinutes <= 3) return 'rgb(16 185 129)'
  if (ageMinutes <= 10) return 'rgb(245 158 11)'
  return 'rgb(148 163 184)'
}

function waypointGlyph(kind: string) {
  if (kind === 'anchorage') return '⚓'
  if (kind === 'hazard') return '!'
  if (kind === 'arrival') return 'A'
  if (kind === 'departure') return 'D'
  return '•'
}

function aisDisplayName(contact: AisContactSummary) {
  if (contact.name) {
    return contact.name
  }

  if (contact.mmsi) {
    return `MMSI ${contact.mmsi}`
  }

  return contact.id.slice(0, 18)
}

function getAisCategory(shipType: number | null, sog: number | null) {
  if (shipType === 30)
    return { label: 'Fishing', color: 'rgb(14 165 233)', fill: 'rgb(224 242 254)' }
  if (shipType !== null && shipType >= 31 && shipType <= 33) {
    return { label: 'Tow', color: 'rgb(245 158 11)', fill: 'rgb(254 243 199)' }
  }
  if (shipType === 36) return { label: 'Sail', color: 'rgb(6 182 212)', fill: 'rgb(207 250 254)' }
  if (shipType === 37)
    return { label: 'Pleasure', color: 'rgb(168 85 247)', fill: 'rgb(243 232 255)' }
  if (shipType !== null && shipType >= 60 && shipType <= 69) {
    return { label: 'Passenger', color: 'rgb(59 130 246)', fill: 'rgb(219 234 254)' }
  }
  if (shipType !== null && shipType >= 70 && shipType <= 79) {
    return { label: 'Cargo', color: 'rgb(132 204 22)', fill: 'rgb(236 252 203)' }
  }
  if (shipType !== null && shipType >= 80 && shipType <= 89) {
    return { label: 'Tanker', color: 'rgb(239 68 68)', fill: 'rgb(254 226 226)' }
  }
  if (shipType === 35)
    return { label: 'Military', color: 'rgb(15 23 42)', fill: 'rgb(226 232 240)' }
  if (shipType !== null && shipType >= 40 && shipType <= 55) {
    return { label: 'Service', color: 'rgb(249 115 22)', fill: 'rgb(255 237 213)' }
  }

  return (sog ?? 0) > 0.5
    ? { label: 'Traffic', color: 'rgb(249 115 22)', fill: 'rgb(255 237 213)' }
    : { label: 'At rest', color: 'rgb(148 163 184)', fill: 'rgb(241 245 249)' }
}

function formatDistanceNm(distanceNm: number | null) {
  if (distanceNm === null || distanceNm === undefined) {
    return '--'
  }

  return distanceNm >= 10 ? `${distanceNm.toFixed(0)} nm` : `${distanceNm.toFixed(1)} nm`
}

function createVesselPinElement(item: MarineMapVesselPin, isSelected: boolean) {
  const shell = document.createElement('div')
  shell.style.cssText =
    'display:flex;min-width:0;flex-direction:column;align-items:center;gap:6px;pointer-events:none;'

  const marker = document.createElement('div')
  marker.style.cssText = [
    'position:relative',
    'display:flex',
    'height:48px',
    'width:48px',
    'align-items:center',
    'justify-content:center',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.82)',
    `background:${item.isPrimary ? 'rgb(8 47 73 / 0.96)' : 'rgb(15 23 42 / 0.9)'}`,
    `box-shadow:${isSelected ? '0 14px 28px rgb(14 116 144 / 0.28)' : '0 10px 24px rgb(15 23 42 / 0.22)'}`,
    `transform:${isSelected ? 'scale(1.06)' : 'scale(1)'}`,
    'transition:transform 180ms ease, box-shadow 180ms ease',
  ].join(';')

  if (item.isPrimary) {
    const halo = document.createElement('div')
    halo.style.cssText =
      'position:absolute;inset:-8px;border-radius:999px;border:1px solid rgb(56 189 248 / 0.34);background:rgb(56 189 248 / 0.08);'
    marker.appendChild(halo)
  }

  const ship = document.createElement('div')
  ship.style.cssText = [
    'position:relative',
    'z-index:1',
    `transform:rotate(${Math.round(item.heading ?? 0)}deg)`,
    'transition:transform 180ms ease',
    'filter:drop-shadow(0 2px 5px rgb(15 23 42 / 0.28))',
  ].join(';')
  ship.innerHTML = `
    <svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M16 2 L23 24 Q23 29 16 29 Q9 29 9 24 Z"
        fill="${item.isPrimary ? 'rgb(125 211 252)' : 'rgb(226 232 240)'}"
        stroke="rgb(255 255 255 / 0.9)"
        stroke-width="1.35"
        stroke-linejoin="round"
      />
      <circle cx="16" cy="17" r="2" fill="${item.isPrimary ? 'rgb(8 47 73)' : 'rgb(15 23 42)'}" opacity="0.82" />
    </svg>
  `
  marker.appendChild(ship)

  const tone = document.createElement('div')
  tone.style.cssText = [
    'position:absolute',
    'right:3px',
    'top:3px',
    'height:9px',
    'width:9px',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.84)',
    `background:${observationTone(item.observedAt)}`,
  ].join(';')
  marker.appendChild(tone)

  shell.appendChild(marker)

  if (showsDenseLabels.value || isSelected || item.isPrimary) {
    const label = document.createElement('div')
    label.style.cssText = [
      'max-width:140px',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap',
      'border-radius:999px',
      'border:1px solid rgb(255 255 255 / 0.7)',
      `background:${isSelected ? 'rgb(8 47 73 / 0.94)' : 'rgb(255 255 255 / 0.92)'}`,
      `color:${isSelected ? 'rgb(240 249 255)' : 'rgb(15 23 42)'}`,
      'padding:4px 10px',
      'font-size:11px',
      'font-weight:700',
      'letter-spacing:0.01em',
      'box-shadow:0 10px 24px rgb(15 23 42 / 0.14)',
      'backdrop-filter:blur(12px)',
    ].join(';')
    label.textContent = item.title
    shell.appendChild(label)
  }

  return { element: shell }
}

function createWaypointPinElement(item: MarineMapWaypointPin, isSelected: boolean) {
  const element = document.createElement('div')
  element.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:6px',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.72)',
    `background:${isSelected ? 'rgb(14 116 144 / 0.94)' : 'rgb(15 23 42 / 0.88)'}`,
    'padding:6px 10px',
    'font-size:11px',
    'font-weight:700',
    'letter-spacing:0.03em',
    'color:rgb(248 250 252)',
    'box-shadow:0 10px 24px rgb(15 23 42 / 0.18)',
    'backdrop-filter:blur(10px)',
  ].join(';')

  const glyph = document.createElement('span')
  glyph.textContent = waypointGlyph(item.kind)
  glyph.style.cssText = 'display:inline-flex;width:14px;justify-content:center;font-size:12px;'
  element.appendChild(glyph)

  const label = document.createElement('span')
  label.textContent = item.title
  label.style.cssText = 'max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
  element.appendChild(label)

  return { element }
}

function createAisPinElement(item: MarineMapAisPin, isSelected: boolean) {
  const category = getAisCategory(item.shipType, item.sog)

  const shell = document.createElement('div')
  shell.style.cssText =
    'display:flex;min-width:0;flex-direction:column;align-items:center;gap:6px;pointer-events:none;'

  const marker = document.createElement('div')
  marker.style.cssText = [
    'position:relative',
    'display:flex',
    'height:38px',
    'width:38px',
    'align-items:center',
    'justify-content:center',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.82)',
    `background:${isSelected ? `${category.color.replace('rgb(', 'rgb(').replace(')', ' / 0.95)')}` : 'rgb(15 23 42 / 0.86)'}`,
    `box-shadow:${isSelected ? `0 14px 28px ${category.color.replace('rgb(', 'rgb(').replace(')', ' / 0.25)')}` : '0 10px 24px rgb(15 23 42 / 0.22)'}`,
    `transform:${isSelected ? 'scale(1.06)' : 'scale(1)'}`,
    'transition:transform 180ms ease, box-shadow 180ms ease',
  ].join(';')

  const ship = document.createElement('div')
  ship.style.cssText = [
    'position:relative',
    'z-index:1',
    `transform:rotate(${Math.round(item.heading ?? item.cog ?? 0)}deg)`,
    'transition:transform 180ms ease',
    'filter:drop-shadow(0 2px 4px rgb(15 23 42 / 0.3))',
  ].join(';')
  ship.innerHTML = `
    <svg viewBox="0 0 32 32" width="24" height="24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M16 3 L22 23 Q22 28 16 28 Q10 28 10 23 Z"
        fill="${category.fill}"
        stroke="white"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <circle cx="16" cy="17" r="2" fill="${category.color}" opacity="0.8" />
    </svg>
  `
  marker.appendChild(ship)

  const tone = document.createElement('div')
  tone.style.cssText = [
    'position:absolute',
    'right:2px',
    'top:2px',
    'height:8px',
    'width:8px',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.82)',
    `background:${aisFreshnessTone(item.lastUpdateAt)}`,
  ].join(';')
  marker.appendChild(tone)

  shell.appendChild(marker)

  if (isSelected || (aisPins.value.length <= 5 && item.distanceNm <= 4)) {
    const label = document.createElement('div')
    label.style.cssText = [
      'max-width:156px',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap',
      'border-radius:999px',
      'border:1px solid rgb(255 255 255 / 0.7)',
      `background:${isSelected ? 'rgb(15 23 42 / 0.94)' : 'rgb(255 255 255 / 0.92)'}`,
      `color:${isSelected ? 'rgb(248 250 252)' : 'rgb(15 23 42)'}`,
      'padding:4px 10px',
      'font-size:11px',
      'font-weight:700',
      'letter-spacing:0.01em',
      'box-shadow:0 10px 24px rgb(15 23 42 / 0.14)',
      'backdrop-filter:blur(12px)',
    ].join(';')
    label.textContent = item.title
    shell.appendChild(label)
  }

  return { element: shell }
}

function createPinElement(item: MarineMapPin, isSelected: boolean) {
  if (item.pinKind === 'vessel') {
    return createVesselPinElement(item, isSelected)
  }

  if (item.pinKind === 'ais') {
    return createAisPinElement(item, isSelected)
  }

  return createWaypointPinElement(item, isSelected)
}

function centerOnFocusVessel() {
  const snapshot = focusSnapshot.value

  if (
    !snapshot ||
    snapshot.positionLat === null ||
    snapshot.positionLat === undefined ||
    snapshot.positionLng === null ||
    snapshot.positionLng === undefined
  ) {
    mapRef.value?.zoomToFit(0)
    return
  }

  mapRef.value?.setRegion(
    { lat: snapshot.positionLat, lng: snapshot.positionLng },
    { lat: 0.018, lng: 0.022 },
  )
}

function fitToContent(zoomOutLevels = 0) {
  mapRef.value?.zoomToFit(zoomOutLevels)
}

function resetRememberedView() {
  clearSavedRegion()
  fitToContent(0)
}

function toggleFullscreen() {
  if (!import.meta.client || !mapHost.value) return

  const ownerDocument = mapHost.value.ownerDocument

  if (ownerDocument.fullscreenElement === mapHost.value) {
    void ownerDocument.exitFullscreen?.()
    return
  }

  void mapHost.value.requestFullscreen?.()
}

function syncFullscreenState() {
  if (!import.meta.client) return
  isFullscreen.value = document.fullscreenElement === mapHost.value
}

function handleRegionChange(region: {
  latDelta: number
  lngDelta: number
  centerLat: number
  centerLng: number
}) {
  onRegionChange(region)
}

function handleMapReady() {
  const region = savedRegion.value || getSavedRegion()
  if (!region) return

  mapRef.value?.setRegion(
    { lat: region.centerLat, lng: region.centerLng },
    { lat: region.latDelta, lng: region.lngDelta },
  )
}

watch([showVessels, showWaypoints, showTraffic], () => {
  if (!selectedId.value) return
  if (items.value.some((item) => item.id === selectedId.value)) return
  selectedId.value = null
})

watch(showTraffic, (enabled) => {
  if (!enabled) {
    showTrafficVectors.value = false
  }
})

watch(
  trafficAllowed,
  (enabled) => {
    if (!enabled) {
      showTraffic.value = false
      showTrafficVectors.value = false
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (!import.meta.client) return
  defaultSignalKSocketUrl.value = buildDefaultSignalKSocketUrl()
  document.addEventListener('fullscreenchange', syncFullscreenState)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<template>
  <div class="card-base overflow-hidden">
    <div
      class="flex flex-col gap-4 border-b border-default px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <p class="text-sm font-medium text-default">{{ focusedSummary.eyebrow }}</p>
        <p class="mt-1 font-display text-xl text-default">{{ focusedSummary.title }}</p>
        <p class="mt-2 max-w-2xl text-sm text-muted">
          {{ focusedSummary.description }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UBadge color="primary" variant="soft">{{ vesselPins.length }} vessels</UBadge>
        <UBadge color="neutral" variant="soft">{{ baseGeojson.features.length }} routes</UBadge>
        <UBadge color="neutral" variant="soft">{{ waypointPins.length }} waypoints</UBadge>
        <UBadge
          v-if="trafficAllowed"
          :color="showTraffic && aisConnectionState === 'connected' ? 'primary' : 'neutral'"
          variant="soft"
        >
          AIS {{ aisPins.length }}
        </UBadge>
      </div>
    </div>

    <div v-if="hasMapData" ref="mapHost" class="relative">
      <div
        class="absolute left-4 top-4 z-10 max-w-[18rem] rounded-[1.5rem] border border-default/70 bg-default/88 p-4 shadow-card backdrop-blur-xl"
      >
        <p class="text-[11px] uppercase tracking-[0.22em] text-muted">
          {{
            selectedPin?.pinKind === 'waypoint'
              ? 'Waypoint focus'
              : selectedPin?.pinKind === 'ais'
                ? 'AIS contact'
                : 'Map focus'
          }}
        </p>
        <p class="mt-2 font-display text-lg text-default">{{ focusedSummary.title }}</p>
        <p class="mt-2 text-sm text-muted">
          {{ focusedSummary.description }}
        </p>
        <p
          v-if="selectedPin?.pinKind === 'waypoint' && selectedPin.visitedAt"
          class="mt-3 text-xs text-muted"
        >
          Logged {{ formatTimestamp(selectedPin.visitedAt) }}
        </p>
        <p v-else-if="selectedPin?.pinKind === 'ais'" class="mt-3 text-xs text-muted">
          Updated {{ formatRelativeTime(new Date(selectedPin.lastUpdateAt).toISOString()) }}
          <span v-if="selectedPin.callSign"> · {{ selectedPin.callSign }}</span>
        </p>
        <p v-else-if="trafficAllowed" class="mt-3 text-xs text-muted">
          {{ trafficStatus }}
          <span v-if="aisLastDeltaAt">
            · Feed {{ formatRelativeTime(new Date(aisLastDeltaAt).toISOString()) }}
          </span>
        </p>
        <p v-else-if="isSingleVesselSurface" class="mt-3 text-xs text-muted">
          Route focus follows the current vessel fix and remembered camera position.
        </p>
      </div>

      <div class="absolute right-4 top-4 z-10 flex flex-wrap justify-end gap-2">
        <UButton
          icon="i-lucide-scan-search"
          color="neutral"
          variant="soft"
          size="sm"
          title="Fit map to all visible content"
          aria-label="Fit map to all visible content"
          @click="fitToContent(0)"
        />
        <UButton
          icon="i-lucide-crosshair"
          color="neutral"
          variant="soft"
          size="sm"
          title="Center on the focused vessel"
          aria-label="Center on the focused vessel"
          @click="centerOnFocusVessel"
        />
        <UButton
          :icon="showPointsOfInterest ? 'i-lucide-map' : 'i-lucide-map-off'"
          :color="showPointsOfInterest ? 'primary' : 'neutral'"
          :variant="showPointsOfInterest ? 'soft' : 'outline'"
          size="sm"
          title="Toggle map context labels"
          aria-label="Toggle map context labels"
          @click="showPointsOfInterest = !showPointsOfInterest"
        />
        <UButton
          v-if="savedRegion"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="soft"
          size="sm"
          title="Clear remembered camera position"
          aria-label="Clear remembered camera position"
          @click="resetRememberedView"
        />
        <UButton
          :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
          color="neutral"
          variant="soft"
          size="sm"
          title="Toggle fullscreen map"
          aria-label="Toggle fullscreen map"
          @click="toggleFullscreen"
        />
      </div>

      <div
        class="absolute inset-x-4 bottom-4 z-10 flex flex-wrap items-center justify-between gap-3"
      >
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-ship"
            :color="showVessels ? 'primary' : 'neutral'"
            :variant="showVessels ? 'soft' : 'outline'"
            size="xs"
            @click="showVessels = !showVessels"
          >
            Vessels {{ vesselPins.length ? `(${vesselPins.length})` : '' }}
          </UButton>
          <UButton
            icon="i-lucide-route"
            :color="showRoutes ? 'primary' : 'neutral'"
            :variant="showRoutes ? 'soft' : 'outline'"
            size="xs"
            @click="showRoutes = !showRoutes"
          >
            Routes {{ baseGeojson.features.length ? `(${baseGeojson.features.length})` : '' }}
          </UButton>
          <UButton
            icon="i-lucide-map-pinned"
            :color="showWaypoints ? 'primary' : 'neutral'"
            :variant="showWaypoints ? 'soft' : 'outline'"
            size="xs"
            @click="showWaypoints = !showWaypoints"
          >
            Waypoints {{ waypointPins.length ? `(${waypointPins.length})` : '' }}
          </UButton>
          <UButton
            v-if="trafficAllowed"
            icon="i-lucide-radar"
            :color="showTraffic ? 'primary' : 'neutral'"
            :variant="showTraffic ? 'soft' : 'outline'"
            size="xs"
            @click="showTraffic = !showTraffic"
          >
            Traffic {{ aisPins.length ? `(${aisPins.length})` : '' }}
          </UButton>
          <UButton
            v-if="trafficAllowed && showTraffic"
            icon="i-lucide-navigation-2"
            :color="showTrafficVectors ? 'primary' : 'neutral'"
            :variant="showTrafficVectors ? 'soft' : 'outline'"
            size="xs"
            @click="showTrafficVectors = !showTrafficVectors"
          >
            Vectors
          </UButton>
        </div>

        <div class="grid flex-1 gap-2 sm:grid-cols-4 xl:max-w-3xl">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="rounded-[1.15rem] border border-default/70 bg-default/84 px-3 py-2 shadow-card backdrop-blur-xl"
          >
            <p class="text-[10px] uppercase tracking-[0.2em] text-muted">{{ stat.label }}</p>
            <p class="mt-1 text-sm font-semibold text-default">{{ stat.value }}</p>
          </div>
        </div>
      </div>

      <div :class="heightClass">
        <ClientOnly>
          <AppMapKit
            ref="mapSurface"
            v-model:selected-id="selectedId"
            class="h-full"
            :items="items"
            :geojson="geojson"
            :create-pin-element="createPinElement"
            :overlay-style-fn="routeOverlayStyle"
            :fallback-center="fallbackCenter"
            :annotation-size="annotationSize"
            :zoom-span="{ lat: 0.018, lng: 0.022 }"
            :bounding-padding="0.22"
            :preserve-region="true"
            :shows-points-of-interest="showPointsOfInterest"
            :clustering-identifier="clusteringIdentifier"
            @map-ready="handleMapReady"
            @region-change="handleRegionChange"
          />
        </ClientOnly>
      </div>
    </div>

    <AppEmptyState
      v-else
      icon="i-lucide-map"
      title="Map surfaces are ready"
      :description="emptyStateDescription"
      compact
    />
  </div>
</template>
