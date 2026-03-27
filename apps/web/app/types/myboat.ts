export interface PublicProfileSummary {
  username: string
  captainName: string
  headline: string | null
  bio: string | null
  homePort: string | null
}

export interface VesselSnapshotSummary {
  observedAt: string | null
  positionLat: number | null
  positionLng: number | null
  headingMagnetic: number | null
  speedOverGround: number | null
  speedThroughWater: number | null
  windSpeedApparent: number | null
  windAngleApparent: number | null
  depthBelowTransducer: number | null
  waterTemperatureKelvin: number | null
  batteryVoltage: number | null
  engineRpm: number | null
  statusNote: string | null
}

export interface PassageSummary {
  id: string
  title: string
  summary: string | null
  departureName: string | null
  arrivalName: string | null
  startedAt: string
  endedAt: string | null
  distanceNm: number | null
  maxWindKn: number | null
  trackGeojson: string | null
}

export interface WaypointSummary {
  id: string
  title: string
  note: string | null
  kind: string
  lat: number
  lng: number
  visitedAt: string | null
}

export interface MediaItemSummary {
  id: string
  title: string
  caption: string | null
  imageUrl: string
  lat: number | null
  lng: number | null
  capturedAt: string | null
}

export interface VesselCardSummary {
  id: string
  slug: string
  name: string
  vesselType: string | null
  homePort: string | null
  summary: string | null
  isPrimary: boolean
  sharePublic: boolean
  latestPassage: PassageSummary | null
  liveSnapshot: VesselSnapshotSummary | null
  mediaCount: number
  waypointCount: number
}

export interface InstallationSummary {
  id: string
  vesselId: string
  vesselSlug: string
  vesselName: string
  label: string
  edgeHostname: string | null
  signalKUrl: string | null
  connectionState: string
  lastSeenAt: string | null
  eventCount: number
}

export interface InstallationKeySummary {
  id: string
  name: string
  keyPrefix: string
  rawKey?: string
  createdAt: string
  lastUsedAt: string | null
}

export interface DashboardOverview {
  profile: PublicProfileSummary | null
  vessels: VesselCardSummary[]
  installations: InstallationSummary[]
  recentPassages: PassageSummary[]
  recentMedia: MediaItemSummary[]
  stats: {
    vesselCount: number
    installationCount: number
    passageCount: number
    mediaCount: number
    liveInstallationCount: number
  }
}

export interface OnboardingPayload {
  captainName: string
  username: string
  headline?: string
  bio?: string
  vesselName: string
  vesselType?: string
  homePort?: string
  summary?: string
  installationLabel: string
  edgeHostname?: string
  signalKUrl?: string
}

export interface VesselDetailResponse {
  profile: PublicProfileSummary
  vessel: VesselCardSummary
  installations: InstallationSummary[]
  passages: PassageSummary[]
  media: MediaItemSummary[]
  waypoints: WaypointSummary[]
}

export interface PublicProfileResponse {
  profile: PublicProfileSummary
  vessels: VesselCardSummary[]
  installations: InstallationSummary[]
}

export interface ExploreVesselEntry extends VesselCardSummary {
  captainUsername: string
  captainName: string
}

export interface PublicExploreResponse {
  vessels: ExploreVesselEntry[]
}

export interface PublicVesselDetailResponse {
  profile: PublicProfileSummary
  vessel: VesselCardSummary
  passages: PassageSummary[]
  media: MediaItemSummary[]
  waypoints: WaypointSummary[]
}
