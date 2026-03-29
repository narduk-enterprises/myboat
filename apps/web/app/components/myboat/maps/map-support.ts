import type { MapKitMapSurface } from '~/composables/useMarineAisOverlay'
import type {
  AisContactSummary,
  MediaItemSummary,
  PassageSummary,
  VesselCardSummary,
  VesselSnapshotSummary,
  WaypointSummary,
} from '~/types/myboat'
import { buildTrackFeatureCollection } from '~/utils/marine'
import { isTrafficMoving, speedMetersPerSecondToKnots } from '~/utils/traffic'

export interface MyBoatMapHandle {
  setRegion: (center: { lat: number; lng: number }, span?: { lat: number; lng: number }) => void
  zoomToFit: (zoomOutLevels?: number) => void
  getMap: () => MapKitMapSurface | null
}

export interface MyBoatMapInstallation {
  id?: string
  label?: string
  edgeHostname?: string | null
}

export interface MyBoatMapOverlayStyle {
  strokeColor: string
  strokeOpacity?: number
  fillColor: string
  fillOpacity?: number
  lineDash?: number[]
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

export interface MyBoatMediaPin {
  id: string
  lat: number
  lng: number
  pinKind: 'media'
  title: string
  caption: string | null
  imageUrl: string
  capturedAt: string | null
  sharePublic: boolean
  isCover: boolean
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

export type MyBoatSurfacePin = MyBoatVesselPin | MyBoatWaypointPin | MyBoatMediaPin
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

export function buildMediaPins(media: MediaItemSummary[]) {
  return media
    .filter(
      (item) =>
        item.matchStatus === 'attached' &&
        item.lat !== null &&
        item.lat !== undefined &&
        item.lng !== null &&
        item.lng !== undefined,
    )
    .map((item) => ({
      id: item.id,
      lat: item.lat!,
      lng: item.lng!,
      pinKind: 'media' as const,
      title: item.title,
      caption: item.caption,
      imageUrl: item.imageUrl,
      capturedAt: item.capturedAt,
      sharePublic: item.sharePublic,
      isCover: item.isCover,
    }))
}

export function buildNearbyAisPins(options: {
  contacts: AisContactSummary[]
  focusSnapshot: VesselSnapshotSummary | null
  primaryVessel?: Pick<VesselCardSummary, 'name' | 'observedIdentity'> | null
}) {
  const { contacts, focusSnapshot, primaryVessel = null } = options

  if (
    focusSnapshot?.positionLat === null ||
    focusSnapshot?.positionLat === undefined ||
    focusSnapshot.positionLng === null ||
    focusSnapshot.positionLng === undefined
  ) {
    return []
  }

  const focusName = primaryVessel?.name?.trim().toLowerCase() || null
  const focusMmsi = primaryVessel?.observedIdentity?.mmsi?.trim() || null
  const focusCallSign = primaryVessel?.observedIdentity?.callSign?.trim().toLowerCase() || null

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

      const matchesName =
        Boolean(focusName && contact.name && contact.name.trim().toLowerCase() === focusName) &&
        distanceNm <= AIS_DUPLICATE_RADIUS_NM
      const matchesMmsi = Boolean(focusMmsi && contact.mmsi && contact.mmsi.trim() === focusMmsi)
      const matchesCallSign =
        Boolean(
          focusCallSign &&
            contact.callSign &&
            contact.callSign.trim().toLowerCase() === focusCallSign,
        ) && distanceNm <= AIS_DUPLICATE_RADIUS_NM

      return !(matchesName || matchesMmsi || matchesCallSign)
    })
    .sort((left, right) => left.distanceNm - right.distanceNm)
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
    .filter((pin) => isTrafficMoving(pin.sog))
    .map((pin) => {
      const speedOverGround = speedMetersPerSecondToKnots(pin.sog)
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
    const shipType =
      typeof properties.shipType === 'number' && Number.isFinite(properties.shipType)
        ? properties.shipType
        : null
    const category = getAisCategory(shipType, 1)
    const isDangerous = Boolean(properties.danger)

    return {
      strokeColor: isDangerous ? 'rgb(239 68 68)' : category.color,
      strokeOpacity: isDangerous ? 0.92 : 0.76,
      fillColor: 'rgb(15 23 42)',
      fillOpacity: 0,
      lineWidth: isDangerous ? 3 : 2.25,
    }
  }

  if (properties.featureKind === 'measure-line') {
    return {
      strokeColor: 'rgb(236 72 153)',
      strokeOpacity: 0.92,
      fillColor: 'rgb(15 23 42)',
      fillOpacity: 0,
      lineDash: [8, 5],
      lineWidth: 2.35,
    }
  }

  if (properties.featureKind === 'range-ring') {
    return {
      strokeColor: 'rgb(8 145 178)',
      strokeOpacity: 0.42,
      fillColor: 'rgb(15 23 42)',
      fillOpacity: 0,
      lineDash: [4, 6],
      lineWidth: 1.5,
    }
  }

  if (properties.featureKind === 'heading-aid') {
    const isCourseAid = properties.aidKind === 'course'

    return {
      strokeColor: isCourseAid ? 'rgb(239 68 68)' : 'rgb(245 158 11)',
      strokeOpacity: isCourseAid ? 0.62 : 0.74,
      fillColor: 'rgb(15 23 42)',
      fillOpacity: 0,
      lineDash: isCourseAid ? [6, 4] : undefined,
      lineWidth: 2.25,
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

function withAlpha(color: string, alpha: number) {
  return color.replace('rgb(', 'rgb(').replace(')', ` / ${alpha})`)
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
    return {
      label: 'Fishing',
      color: 'rgb(14 165 233)',
      fill: 'rgb(224 242 254)',
      shape: 'trawler' as const,
    }
  if (shipType !== null && shipType >= 31 && shipType <= 33) {
    return {
      label: 'Tow',
      color: 'rgb(245 158 11)',
      fill: 'rgb(254 243 199)',
      shape: 'tow' as const,
    }
  }
  if (shipType === 36)
    return {
      label: 'Sail',
      color: 'rgb(6 182 212)',
      fill: 'rgb(207 250 254)',
      shape: 'sail' as const,
    }
  if (shipType === 37)
    return {
      label: 'Pleasure',
      color: 'rgb(236 72 153)',
      fill: 'rgb(252 231 243)',
      shape: 'yacht' as const,
    }
  if (shipType !== null && shipType >= 60 && shipType <= 69) {
    return {
      label: 'Passenger',
      color: 'rgb(59 130 246)',
      fill: 'rgb(219 234 254)',
      shape: 'ferry' as const,
    }
  }
  if (shipType !== null && shipType >= 70 && shipType <= 79) {
    return {
      label: 'Cargo',
      color: 'rgb(132 204 22)',
      fill: 'rgb(236 252 203)',
      shape: 'cargo' as const,
    }
  }
  if (shipType !== null && shipType >= 80 && shipType <= 89) {
    return {
      label: 'Tanker',
      color: 'rgb(239 68 68)',
      fill: 'rgb(254 226 226)',
      shape: 'tanker' as const,
    }
  }
  if (shipType === 35)
    return {
      label: 'Military',
      color: 'rgb(15 23 42)',
      fill: 'rgb(226 232 240)',
      shape: 'naval' as const,
    }
  if (shipType !== null && shipType >= 40 && shipType <= 55) {
    return {
      label: 'Service',
      color: 'rgb(249 115 22)',
      fill: 'rgb(255 237 213)',
      shape: 'utility' as const,
    }
  }

  return isTrafficMoving(sog)
    ? {
        label: 'Transit',
        color: 'rgb(99 102 241)',
        fill: 'rgb(224 231 255)',
        shape: 'utility' as const,
      }
    : {
        label: 'Holding',
        color: 'rgb(100 116 139)',
        fill: 'rgb(226 232 240)',
        shape: 'generic' as const,
      }
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

interface MediaPinRenderOptions {
  isCompactViewport?: boolean
  showLabel?: boolean
}

export function createMediaPinElement(
  item: MyBoatMediaPin,
  isSelected: boolean,
  options: MediaPinRenderOptions = {},
) {
  const shell = document.createElement('div')
  shell.style.cssText =
    'display:flex;min-width:0;flex-direction:column;align-items:center;gap:6px;pointer-events:none;'

  const marker = document.createElement('div')
  marker.style.cssText = [
    'position:relative',
    'display:flex',
    'height:42px',
    'width:42px',
    'overflow:hidden',
    'align-items:center',
    'justify-content:center',
    'border-radius:16px',
    'border:1px solid rgb(255 255 255 / 0.82)',
    'background:linear-gradient(180deg, rgb(15 23 42 / 0.94), rgb(30 41 59 / 0.9))',
    `box-shadow:${isSelected ? '0 14px 28px rgb(14 116 144 / 0.26)' : '0 10px 24px rgb(15 23 42 / 0.2)'}`,
    `transform:${isSelected ? 'scale(1.08)' : 'scale(1)'}`,
    'transition:transform 180ms ease, box-shadow 180ms ease',
  ].join(';')

  const image = document.createElement('img')
  image.src = item.imageUrl
  image.alt = item.title
  image.loading = 'lazy'
  image.decoding = 'async'
  image.style.cssText = 'height:100%;width:100%;object-fit:cover;'

  const fallback = document.createElement('div')
  fallback.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:16px',
    'font-weight:700',
    'color:rgb(248 250 252)',
    'background:linear-gradient(180deg, rgb(15 23 42 / 0.94), rgb(8 47 73 / 0.92))',
    'opacity:0',
    'transition:opacity 140ms ease',
  ].join(';')
  fallback.textContent = 'P'

  image.onerror = () => {
    fallback.style.opacity = '1'
  }

  marker.appendChild(image)
  marker.appendChild(fallback)

  const badge = document.createElement('div')
  badge.style.cssText = [
    'position:absolute',
    'right:3px',
    'bottom:3px',
    'display:flex',
    'height:16px',
    'min-width:16px',
    'align-items:center',
    'justify-content:center',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.84)',
    'background:rgb(15 23 42 / 0.82)',
    'padding:0 4px',
    'font-size:9px',
    'font-weight:800',
    'color:rgb(248 250 252)',
    'backdrop-filter:blur(8px)',
  ].join(';')
  badge.textContent = item.isCover ? 'C' : 'P'
  marker.appendChild(badge)

  shell.appendChild(marker)

  const shouldShowLabel =
    options.showLabel === false ? false : !options.isCompactViewport || isSelected

  if (shouldShowLabel) {
    const label = document.createElement('div')
    label.style.cssText = [
      'max-width:156px',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap',
      'border-radius:999px',
      'border:1px solid rgb(255 255 255 / 0.74)',
      `background:${isSelected ? 'rgb(8 47 73 / 0.94)' : 'rgb(255 255 255 / 0.92)'}`,
      `color:${isSelected ? 'rgb(240 249 255)' : 'rgb(15 23 42)'}`,
      'padding:4px 10px',
      'font-size:11px',
      'font-weight:700',
      'letter-spacing:0.01em',
      'box-shadow:0 10px 24px rgb(15 23 42 / 0.14)',
      'backdrop-filter:blur(12px)',
    ].join(';')
    label.textContent = item.isCover ? `Cover · ${item.title}` : item.title
    shell.appendChild(label)
  }

  return { element: shell }
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
  const movementHeading = Math.round(item.heading ?? item.cog ?? 0)
  const isMoving = isTrafficMoving(item.sog)
  const freshness = aisFreshnessTone(item.lastUpdateAt)
  const speedKnots = speedMetersPerSecondToKnots(item.sog)
  const ageMinutes = (Date.now() - item.lastUpdateAt) / 60_000
  const markerOpacity = ageMinutes > 10 ? 0.68 : ageMinutes > 4 ? 0.84 : 1

  const element = document.createElement('div')
  element.style.cssText = [
    'position:relative',
    'display:flex',
    'min-width:0',
    'flex-direction:column',
    'align-items:center',
    'gap:4px',
    'pointer-events:none',
  ].join(';')

  const frame = document.createElement('div')
  frame.style.cssText = [
    'position:relative',
    'display:flex',
    'height:34px',
    'width:34px',
    'align-items:center',
    'justify-content:center',
    `opacity:${markerOpacity}`,
    `transform:${isSelected ? 'translateY(-1px) scale(1.08)' : 'translateY(0) scale(1)'}`,
    `filter:drop-shadow(0 10px 18px ${withAlpha(category.color, isSelected ? 0.34 : 0.18)})`,
    'transition:transform 180ms ease, filter 180ms ease, opacity 180ms ease',
  ].join(';')

  if (isSelected) {
    const selectionPlate = document.createElement('div')
    selectionPlate.style.cssText = [
      'position:absolute',
      'inset:2px',
      'border-radius:12px',
      `background:${withAlpha(category.fill, 0.34)}`,
      `border:1px solid ${withAlpha(freshness, 0.74)}`,
      `box-shadow:0 6px 16px ${withAlpha(category.color, 0.18)}`,
      'transform:rotate(8deg)',
    ].join(';')
    frame.appendChild(selectionPlate)
  }

  const ship = document.createElement('div')
  ship.style.cssText = [
    'position:relative',
    'z-index:1',
    `transform:rotate(${movementHeading}deg) scale(${isSelected ? 1.08 : 1})`,
    'transition:transform 180ms ease',
    `filter:drop-shadow(0 2px 6px ${withAlpha(freshness, 0.24)})`,
  ].join(';')
  ship.innerHTML = buildAisShipSvg(category.shape, {
    color: category.color,
    deck: withAlpha('rgb(15 23 42)', isSelected ? 0.94 : 0.82),
    accent: withAlpha('rgb(255 255 255)', isSelected ? 0.98 : 0.88),
    wake: withAlpha(freshness, isSelected ? 0.88 : 0.72),
    water: withAlpha(category.fill, isSelected ? 0.74 : 0.48),
    moving: isMoving,
    selected: isSelected,
  })
  frame.appendChild(ship)

  if (isMoving && speedKnots !== null) {
    const speedFlag = document.createElement('div')
    speedFlag.style.cssText = [
      'position:absolute',
      'right:-1px',
      'top:-1px',
      'border-radius:999px',
      `background:${withAlpha(category.color, 0.96)}`,
      'padding:1px 5px',
      'font-size:8px',
      'font-weight:800',
      'letter-spacing:0.03em',
      'color:rgb(248 250 252)',
      'box-shadow:0 6px 14px rgb(15 23 42 / 0.18)',
    ].join(';')
    speedFlag.textContent = `${speedKnots.toFixed(0)} kt`
    frame.appendChild(speedFlag)
  }

  element.appendChild(frame)

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
      `background:${isSelected ? 'rgb(15 23 42 / 0.94)' : 'rgb(255 255 255 / 0.92)'}`,
      `color:${isSelected ? 'rgb(248 250 252)' : 'rgb(15 23 42)'}`,
      'padding:3px 8px',
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
      : 'ship'

  return [
    item.title,
    category.label,
    category.shape,
    freshness,
    headingBucket,
    labelMode,
    isSelected,
  ].join(':')
}

function buildAisShipSvg(
  shape: ReturnType<typeof getAisCategory>['shape'],
  palette: {
    color: string
    deck: string
    accent: string
    wake: string
    water: string
    moving: boolean
    selected: boolean
  },
) {
  const common = `fill="${palette.color}" stroke="${palette.accent}" stroke-width="${palette.selected ? '1.3' : '1.08'}" stroke-linejoin="round"`
  const wake = palette.moving
    ? `
        <path d="M13 31 Q20 36 27 31" stroke="${palette.wake}" stroke-width="1.6" stroke-linecap="round" fill="none" />
        <path d="M15 28 Q20 31 25 28" stroke="${palette.wake}" stroke-width="1.15" stroke-linecap="round" fill="none" />
      `
    : ''
  const water = `<ellipse cx="20" cy="32.5" rx="${palette.selected ? '11.5' : '10'}" ry="3.4" fill="${palette.water}" />`

  switch (shape) {
    case 'sail':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M20 5 V25" stroke="${palette.accent}" stroke-width="1.35" stroke-linecap="round" />
          <path d="M20 8 L12 24 H20 Z" ${common} />
          <path d="M20 9 L28 22 H20 Z" ${common} />
          <path d="M13 26 H27 Q25 31 20 33 Q15 31 13 26 Z" fill="${palette.deck}" stroke="${palette.accent}" stroke-width="1" />
        </svg>
      `
    case 'cargo':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M12 11 H26 L30 19 V26 Q30 32 20 34 Q10 32 10 24 V15 Z" ${common} />
          <path d="M14 14 H26 V18 H14 Z" fill="${palette.deck}" opacity="0.84" />
          <path d="M15 21 H25" stroke="${palette.accent}" stroke-width="1" stroke-linecap="round" />
        </svg>
      `
    case 'tanker':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M12 10 H28 L30 17 V26 Q30 33 20 34 Q10 33 10 25 V15 Z" ${common} />
          <path d="M15 13 H25 V18 H15 Z" fill="${palette.deck}" opacity="0.82" />
          <path d="M13 24 H27" stroke="${palette.accent}" stroke-width="1.1" stroke-linecap="round" />
        </svg>
      `
    case 'ferry':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M11 12 H29 L30 21 Q30 32 20 34 Q10 32 10 21 Z" ${common} />
          <path d="M14 15 H26 V20 H14 Z" fill="${palette.deck}" opacity="0.82" />
          <path d="M14 24 H26" stroke="${palette.accent}" stroke-width="1" stroke-linecap="round" />
        </svg>
      `
    case 'trawler':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M12 11 H24 L29 19 V27 Q29 33 20 34 Q11 33 11 25 V16 Z" ${common} />
          <path d="M20 7 V18" stroke="${palette.accent}" stroke-width="1.2" stroke-linecap="round" />
          <path d="M15 14 H24" stroke="${palette.accent}" stroke-width="1" stroke-linecap="round" />
        </svg>
      `
    case 'tow':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M12 11 H25 L29 18 V26 Q29 33 20 34 Q11 33 11 24 V16 Z" ${common} />
          <path d="M20 7 V16" stroke="${palette.accent}" stroke-width="1.1" stroke-linecap="round" />
          <path d="M20 7 L26 12" stroke="${palette.accent}" stroke-width="1" stroke-linecap="round" />
        </svg>
      `
    case 'yacht':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M13 14 L25 12 L29 20 Q29 32 20 34 Q11 32 11 22 Z" ${common} />
          <path d="M16 15 H23 V19 H16 Z" fill="${palette.deck}" opacity="0.86" />
        </svg>
      `
    case 'naval':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M20 6 L27 15 L25 27 Q25 33 20 34 Q15 33 15 27 L13 15 Z" ${common} />
          <path d="M17 13 H23 V18 H17 Z" fill="${palette.deck}" opacity="0.82" />
        </svg>
      `
    case 'utility':
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M12 10 H28 L30 18 V26 Q30 33 20 34 Q10 33 10 24 V15 Z" ${common} />
          <path d="M15 14 H25 V19 H15 Z" fill="${palette.deck}" opacity="0.82" />
        </svg>
      `
    default:
      return `
        <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${water}
          ${wake}
          <path d="M20 6 L27 24 Q27 33 20 34 Q13 33 13 24 Z" ${common} />
        </svg>
      `
  }
}
