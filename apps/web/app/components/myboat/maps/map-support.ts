import type { MapKitMapSurface } from '~/composables/useMarineAisOverlay'
import type {
  AisContactSummary,
  PassageSummary,
  VesselCardSummary,
  VesselSnapshotSummary,
  WaypointSummary,
} from '~/types/myboat'
import { buildTrackFeatureCollection } from '~/utils/marine'

export interface MyBoatMapHandle {
  setRegion: (center: { lat: number; lng: number }, span?: { lat: number; lng: number }) => void
  zoomToFit: (zoomOutLevels?: number) => void
  getMap: () => MapKitMapSurface | null
}

export interface MyBoatMapInstallation {
  collectorSignalKUrl?: string | null
  signalKUrl?: string | null
  relaySignalKUrl?: string | null
}

export interface MyBoatMapOverlayStyle {
  strokeColor: string
  strokeOpacity?: number
  fillColor: string
  fillOpacity?: number
  lineWidth: number
}

export interface MyBoatMapGeoJsonFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: unknown
  }
  properties: Record<string, unknown>
}

export interface MyBoatMapGeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: MyBoatMapGeoJsonFeature[]
}

export interface MyBoatVesselPin {
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

export interface MyBoatWaypointPin {
  id: string
  lat: number
  lng: number
  pinKind: 'waypoint'
  title: string
  kind: string
  visitedAt: string | null
}

export interface MyBoatAisPin {
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

export type MyBoatSurfacePin = MyBoatVesselPin | MyBoatWaypointPin
export type MyBoatPin = MyBoatSurfacePin | MyBoatAisPin

export const AIS_NEARBY_RADIUS_NM = 24
export const AIS_VECTOR_LOOKAHEAD_MINUTES = 12
export const AIS_VECTOR_MIN_DISTANCE_NM = 0.12
export const AIS_VECTOR_MAX_DISTANCE_NM = 2.2
export const AIS_DUPLICATE_RADIUS_NM = 0.06

export function buildVesselPins(vessels: VesselCardSummary[]) {
  return vessels
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
      pinKind: 'vessel' as const,
      title: vessel.name,
      vesselId: vessel.id,
      homePort: vessel.homePort,
      isPrimary: vessel.isPrimary,
      heading: vessel.liveSnapshot?.headingMagnetic ?? null,
      speedOverGround: vessel.liveSnapshot?.speedOverGround ?? null,
      observedAt: vessel.liveSnapshot?.observedAt ?? null,
    }))
}

export function buildWaypointPins(waypoints: WaypointSummary[]) {
  return waypoints.map((waypoint) => ({
    id: waypoint.id,
    lat: waypoint.lat,
    lng: waypoint.lng,
    pinKind: 'waypoint' as const,
    title: waypoint.title,
    kind: waypoint.kind,
    visitedAt: waypoint.visitedAt,
  }))
}

export function buildNearbyAisPins(options: {
  contacts: AisContactSummary[]
  focusSnapshot: VesselSnapshotSummary | null
  primaryVesselName?: string | null
}) {
  const { contacts, focusSnapshot, primaryVesselName = null } = options

  if (
    focusSnapshot?.positionLat === null ||
    focusSnapshot?.positionLat === undefined ||
    focusSnapshot.positionLng === null ||
    focusSnapshot.positionLng === undefined
  ) {
    return []
  }

  const focusName = primaryVesselName?.trim().toLowerCase() || null

  return contacts
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
    .map(({ contact, distanceNm }) => ({
      id: `ais:${contact.id}`,
      lat: contact.lat!,
      lng: contact.lng!,
      pinKind: 'ais' as const,
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
    }))
}

export function buildPassageFeatureCollection(passages: PassageSummary[]) {
  return buildTrackFeatureCollection(passages) as MyBoatMapGeoJsonFeatureCollection
}

export function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

export function buildAisVectorFeatureCollection(pins: MyBoatAisPin[]) {
  const features = pins
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
        Math.max(AIS_VECTOR_MIN_DISTANCE_NM, speedOverGround * (AIS_VECTOR_LOOKAHEAD_MINUTES / 60)),
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
    .filter(
      (
        feature,
      ): feature is {
        type: 'Feature'
        properties: {
          featureKind: string
          danger: boolean
          shipType: number | null
        }
        geometry: {
          type: 'LineString'
          coordinates: Array<number[] | readonly [number, number]>
        }
      } => feature !== null,
    )

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}

export function routeOverlayStyle(properties: Record<string, unknown>): MyBoatMapOverlayStyle {
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

export function observationTone(observedAt: string | null) {
  if (!observedAt) return 'rgb(148 163 184)'

  const ageMinutes = (Date.now() - new Date(observedAt).getTime()) / 60_000

  if (ageMinutes <= 20) return 'rgb(16 185 129)'
  if (ageMinutes <= 120) return 'rgb(245 158 11)'
  return 'rgb(148 163 184)'
}

export function aisFreshnessTone(lastUpdateAt: number) {
  const ageMinutes = (Date.now() - lastUpdateAt) / 60_000

  if (ageMinutes <= 3) return 'rgb(16 185 129)'
  if (ageMinutes <= 10) return 'rgb(245 158 11)'
  return 'rgb(148 163 184)'
}

export function waypointGlyph(kind: string) {
  if (kind === 'anchorage') return '⚓'
  if (kind === 'hazard') return '!'
  if (kind === 'arrival') return 'A'
  if (kind === 'departure') return 'D'
  return '•'
}

export function aisDisplayName(contact: AisContactSummary) {
  if (contact.name) {
    return contact.name
  }

  if (contact.mmsi) {
    return `MMSI ${contact.mmsi}`
  }

  return contact.id.slice(0, 18)
}

export function getAisCategory(shipType: number | null, sog: number | null) {
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

export function formatDistanceNm(distanceNm: number | null) {
  if (distanceNm === null || distanceNm === undefined) {
    return '--'
  }

  return distanceNm >= 10 ? `${distanceNm.toFixed(0)} nm` : `${distanceNm.toFixed(1)} nm`
}

interface VesselPinRenderOptions {
  alwaysShowLabel?: boolean
  isCompactViewport?: boolean
  showLabel?: boolean
  showPrimaryLabel?: boolean
  showsDenseLabels?: boolean
}

export function createVesselPinElement(
  item: MyBoatVesselPin,
  isSelected: boolean,
  options: VesselPinRenderOptions = {},
) {
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

  const shouldShowLabel =
    options.showLabel === false
      ? false
      : options.alwaysShowLabel
        ? true
        : options.isCompactViewport
          ? isSelected
          : Boolean(options.showsDenseLabels) ||
            isSelected ||
            (options.showPrimaryLabel !== false && item.isPrimary)

  if (shouldShowLabel) {
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

interface WaypointPinRenderOptions {
  isCompactViewport?: boolean
  showLabel?: boolean
}

export function createWaypointPinElement(
  item: MyBoatWaypointPin,
  isSelected: boolean,
  options: WaypointPinRenderOptions = {},
) {
  if (options.showLabel === false) {
    const compactElement = document.createElement('div')
    compactElement.style.cssText = [
      'display:flex',
      'height:30px',
      'width:30px',
      'align-items:center',
      'justify-content:center',
      'border-radius:999px',
      'border:1px solid rgb(255 255 255 / 0.78)',
      `background:${isSelected ? 'rgb(14 116 144 / 0.94)' : 'rgb(15 23 42 / 0.88)'}`,
      'color:rgb(248 250 252)',
      'font-size:12px',
      'font-weight:700',
      'box-shadow:0 10px 24px rgb(15 23 42 / 0.18)',
      'backdrop-filter:blur(10px)',
    ].join(';')
    compactElement.textContent = waypointGlyph(item.kind)
    return { element: compactElement }
  }

  if (options.isCompactViewport && !isSelected) {
    const compactElement = document.createElement('div')
    compactElement.style.cssText = [
      'display:flex',
      'height:30px',
      'width:30px',
      'align-items:center',
      'justify-content:center',
      'border-radius:999px',
      'border:1px solid rgb(255 255 255 / 0.78)',
      'background:rgb(15 23 42 / 0.88)',
      'color:rgb(248 250 252)',
      'font-size:12px',
      'font-weight:700',
      'box-shadow:0 10px 24px rgb(15 23 42 / 0.18)',
      'backdrop-filter:blur(10px)',
    ].join(';')
    compactElement.textContent = waypointGlyph(item.kind)
    return { element: compactElement }
  }

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

interface AisPinRenderOptions {
  isCompactViewport?: boolean
  pinCount?: number
  showLabel?: boolean
}

export function createAisPinElement(
  item: MyBoatAisPin,
  isSelected: boolean,
  options: AisPinRenderOptions = {},
) {
  const category = getAisCategory(item.shipType, item.sog)

  const element = document.createElement('div')
  element.style.cssText = [
    'position:relative',
    'display:flex',
    'height:24px',
    'width:24px',
    'align-items:center',
    'justify-content:center',
    'pointer-events:none',
  ].join(';')

  if (isSelected) {
    const halo = document.createElement('div')
    halo.style.cssText = [
      'position:absolute',
      'inset:-5px',
      'border-radius:999px',
      `background:${category.color.replace('rgb(', 'rgb(').replace(')', ' / 0.16)')}`,
      `box-shadow:0 8px 18px ${category.color.replace('rgb(', 'rgb(').replace(')', ' / 0.24)')}`,
    ].join(';')
    element.appendChild(halo)
  }

  const ship = document.createElement('div')
  ship.style.cssText = [
    'position:relative',
    'z-index:1',
    `transform:rotate(${Math.round(item.heading ?? item.cog ?? 0)}deg) scale(${isSelected ? 1.05 : 1})`,
    'transition:transform 180ms ease',
    'filter:drop-shadow(0 1px 3px rgb(15 23 42 / 0.24))',
  ].join(';')
  ship.innerHTML = `
    <svg viewBox="0 0 32 32" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M16 4 L22 24 Q22 28 16 28 Q10 28 10 24 Z"
        fill="${category.color}"
        stroke="white"
        stroke-width="1.15"
        stroke-linejoin="round"
      />
      <circle cx="16" cy="17" r="2" fill="${category.fill}" opacity="0.85" />
    </svg>
  `
  element.appendChild(ship)

  const tone = document.createElement('div')
  tone.style.cssText = [
    'position:absolute',
    'right:1px',
    'top:1px',
    'z-index:2',
    'height:7px',
    'width:7px',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.85)',
    `background:${aisFreshnessTone(item.lastUpdateAt)}`,
  ].join(';')
  element.appendChild(tone)

  const shouldShowLabel =
    (options.showLabel !== false && isSelected) ||
    (options.showLabel !== false &&
      !options.isCompactViewport &&
      (options.pinCount ?? 0) <= 5 &&
      item.distanceNm <= 4)

  if (shouldShowLabel) {
    const label = document.createElement('div')
    label.style.cssText = [
      'position:absolute',
      'top:100%',
      'left:50%',
      'margin-top:3px',
      'max-width:144px',
      'transform:translateX(-50%)',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap',
      'border-radius:999px',
      'border:1px solid rgb(255 255 255 / 0.72)',
      `background:${isSelected ? 'rgb(15 23 42 / 0.94)' : 'rgb(255 255 255 / 0.9)'}`,
      `color:${isSelected ? 'rgb(248 250 252)' : 'rgb(15 23 42)'}`,
      'padding:2px 7px',
      'font-size:9px',
      'font-weight:700',
      'letter-spacing:0.01em',
      'box-shadow:0 8px 20px rgb(15 23 42 / 0.14)',
      'backdrop-filter:blur(10px)',
    ].join(';')
    label.textContent = item.title
    element.appendChild(label)
  }

  return { element }
}

export function createAisPinFingerprint(
  item: MyBoatAisPin,
  isSelected: boolean,
  options: AisPinRenderOptions = {},
) {
  const category = getAisCategory(item.shipType, item.sog)
  const freshness = aisFreshnessTone(item.lastUpdateAt)
  const headingBucket = Math.round((item.heading ?? item.cog ?? 0) / 10)
  const labelMode =
    options.showLabel !== false &&
    (isSelected ||
      (!options.isCompactViewport && (options.pinCount ?? 0) <= 5 && item.distanceNm <= 4))
      ? 'label'
      : 'dot'

  return [item.title, category.label, freshness, headingBucket, labelMode, isSelected].join(':')
}
