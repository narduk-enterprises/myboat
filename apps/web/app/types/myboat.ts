export interface PublicProfileSummary {
  username: string
  captainName: string
  headline: string | null
  bio: string | null
  homePort: string | null
}

export interface ObservedVesselIdentitySummary {
  source: string
  observedAt: string | null
  selfContext: string | null
  mmsi: string | null
  observedName: string | null
  callSign: string | null
  shipType: string | null
  shipTypeCode: number | null
  lengthOverall: number | null
  beam: number | null
  draft: number | null
  registrationNumber: string | null
  imo: string | null
  sourceInstallationId?: string | null
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

export type MediaMatchStatus = 'attached' | 'review'

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
  passageId: string | null
  title: string
  caption: string | null
  imageUrl: string
  sharePublic: boolean
  matchStatus: MediaMatchStatus
  matchScore: number | null
  matchReason: string | null
  isCover: boolean
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
  observedIdentity?: ObservedVesselIdentitySummary | null
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
  observedIdentity?: ObservedVesselIdentitySummary | null
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

export interface FollowedVesselImportItem {
  mmsi: string
  name: string
  imo?: string | null
  callSign?: string | null
  destination?: string | null
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

export interface FollowedVesselImportResponse {
  ok: true
  imported: FollowedVesselSummary[]
}

export interface FollowedVesselRefreshResponse {
  ok: true
  source: 'upstream' | 'cooldown' | 'local'
  cachedAt: string | null
  retryAfterMs: number | null
  requestedCount: number
  resolvedCount: number
  missingCount: number
  followedVessels: FollowedVesselSummary[]
}

export interface AisHubSyncStatus {
  catalogSize: number
  lastRequestAt: string | null
  sync: {
    lastStartedAt: string | null
    lastCompletedAt: string | null
    lastSuccessAt: string | null
    lastStatus: string
    lastMode: string | null
    lastLookbackMinutes: number | null
    lastRecordCount: number | null
    lastBatchCount: number | null
    lastError: string | null
    updatedAt: string | null
  }
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

export interface VesselMediaImportResponse {
  imported: MediaItemSummary[]
  duplicates: Array<{
    mediaId: string
    sourceFingerprint: string
  }>
  counts: {
    imported: number
    duplicates: number
  }
}

export interface VesselMediaUpdatePayload {
  passageId?: string | null
  sharePublic?: boolean
  isCover?: boolean
  matchStatus?: MediaMatchStatus
}

export type VesselHistoryAccessTier = 'free' | 'paid'
export type VesselHistoryAggregator = 'last' | 'mean'
export type VesselHistoryStorageMode = 'raw' | 'rollup'
export type VesselHistoryResolution = 'raw' | '1m' | '5m' | '15m' | '1h'
export type VesselHistoryVisibility = 'public' | 'owner'
export type VesselHistorySeriesTier = 'core' | 'detail'
export type TelemetryPublisherRole = 'primary' | 'shadow'

export interface VesselHistoryPoint {
  t: string
  v: number
}

export interface VesselHistoryTrackPoint {
  t: string
  lat: number
  lng: number
}

export interface VesselHistorySeriesDescriptor {
  id: string
  label: string
  unit: string | null
  visibility: VesselHistoryVisibility
  tier: VesselHistorySeriesTier
  aggregator: VesselHistoryAggregator
}

export interface VesselHistorySeries extends VesselHistorySeriesDescriptor {
  points: VesselHistoryPoint[]
}

export interface VesselHistorySeriesFamily {
  id: string
  label: string
  matcher: string
  unit: string | null
  visibility: VesselHistoryVisibility
  tier: VesselHistorySeriesTier
  aggregator: VesselHistoryAggregator
}

export interface VesselHistoryResponse {
  range: {
    start: string
    end: string
  }
  resolution: VesselHistoryResolution
  sourceWindow: {
    accessTier: VesselHistoryAccessTier
    storageMode: VesselHistoryStorageMode
    maxDays: number
  }
  catalogVersion: string
  track: VesselHistoryTrackPoint[]
  series: VesselHistorySeries[]
}

export interface VesselHistoryCatalogResponse {
  catalogVersion: string
  series: VesselHistorySeriesDescriptor[]
  families: VesselHistorySeriesFamily[]
}

export interface TelemetrySourceInventoryEntrySummary {
  sourceId: string
  family: string
  label: string
  metadata: Record<string, unknown>
}

export interface TelemetrySourceInventorySnapshotSummary {
  observedAt: string
  publisherRole: TelemetryPublisherRole
  selfContext: string | null
  sourceCount: number
  sources: TelemetrySourceInventoryEntrySummary[]
}

export interface TelemetryDuplicateHotspotSummary {
  canonicalPath: string
  contenderCount: number
  contenderSourceIds: string[]
  pathFamily: string
  winnerSourceId: string | null
}

export interface TelemetryCurrentWinnerSummary {
  canonicalPath: string
  context: string
  pathFamily: string
  publisherRole: TelemetryPublisherRole
  receivedAt: string
  sourceFamily: string
  sourceId: string
}

export interface VesselTelemetrySourcesResponse {
  duplicateHotspots: TelemetryDuplicateHotspotSummary[]
  currentWinners: TelemetryCurrentWinnerSummary[]
  latestSourceInventory: TelemetrySourceInventorySnapshotSummary | null
  policyVersion: string
  primaryInstallation: {
    id: string
    label: string
    lastInventoryObservedAt: string | null
    lastSelectionObservedAt: string | null
    publisherRole: TelemetryPublisherRole
  } | null
  shadowPublisherSeen: boolean
  vesselId: string
}

export interface InstallationDetailResponse {
  installation: InstallationSummary
  keys: InstallationKeySummary[]
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
