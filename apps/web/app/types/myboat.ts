export interface PublicProfileSummary {
  username: string
  captainName: string
  headline: string | null
  bio: string | null
  homePort: string | null
}

export interface VesselSnapshotSummary {
  vesselId?: string
  source?: string | null
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
  updatedAt?: string | null
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
  installationType: string
  edgeHostname: string | null
  isPrimary: boolean
  connectionState: string
  lastSeenAt: string | null
  eventCount: number
}

export interface AisContactSummary {
  id: string
  name: string | null
  mmsi: string | null
  shipType: number | null
  lat: number | null
  lng: number | null
  cog: number | null
  sog: number | null
  heading: number | null
  destination: string | null
  callSign: string | null
  length: number | null
  beam: number | null
  draft: number | null
  navState: string | null
  lastUpdateAt: number
}

export interface FollowedVesselSummary {
  id: string
  source: 'aishub'
  matchMode: 'mmsi' | 'name'
  mmsi: string
  imo: string | null
  name: string
  callSign: string | null
  destination: string | null
  lastReportAt: string | null
  positionLat: number | null
  positionLng: number | null
  shipType: number | null
  sourceStations: string[]
  createdAt: string
  updatedAt: string
}

export interface AisHubSearchResult {
  source: 'aishub'
  matchMode: 'mmsi' | 'name'
  mmsi: string
  imo: string | null
  name: string
  callSign: string | null
  destination: string | null
  lastReportAt: string | null
  positionLat: number | null
  positionLng: number | null
  shipType: number | null
  sourceStations: string[]
}

export interface AisHubSearchResponse {
  query: string
  matchMode: 'mmsi' | 'name'
  source: 'local' | 'cache' | 'upstream'
  cachedAt: string | null
  results: AisHubSearchResult[]
}

export interface PublicInstallationSummary {
  id: string
  vesselId: string
  vesselSlug: string
  vesselName: string
  label: string
  isPrimary: boolean
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
  followedVessels: FollowedVesselSummary[]
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
}

export interface VesselDetailResponse {
  profile: PublicProfileSummary
  vessel: VesselCardSummary
  installations: InstallationSummary[]
  passages: PassageSummary[]
  media: MediaItemSummary[]
  waypoints: WaypointSummary[]
}

export type PublicFreshnessState = 'live' | 'recent' | 'stale' | 'offline'

export interface PublicVesselDetailResponse {
  profile: PublicProfileSummary
  vessel: VesselCardSummary
  installations: PublicInstallationSummary[]
  passages: PassageSummary[]
  media: MediaItemSummary[]
  waypoints: WaypointSummary[]
  freshnessState: PublicFreshnessState
}

export interface PublicProfileResponse {
  profile: PublicProfileSummary
  vessels: VesselCardSummary[]
  followedVessels: FollowedVesselSummary[]
  installations: PublicInstallationSummary[]
}

export interface PublicExploreItem {
  profile: PublicProfileSummary
  vessel: VesselCardSummary
  freshnessState: PublicFreshnessState
  lastObservedAt: string | null
}

export interface PublicExploreResponse {
  items: PublicExploreItem[]
  featuredItems: PublicExploreItem[]
  stats: {
    publicCaptainCount: number
    publicVesselCount: number
    liveVesselCount: number
    recentVesselCount: number
  }
}
