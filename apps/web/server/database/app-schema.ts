import { apiKeys, users } from '#layer/server/database/schema'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const isoTimestamp = () => new Date().toISOString()

export const publicProfiles = sqliteTable(
  'public_profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    username: text('username').notNull(),
    headline: text('headline'),
    bio: text('bio'),
    homePort: text('home_port'),
    shareProfile: integer('share_profile', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
    updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
  },
  (table) => ({
    usernameIdx: uniqueIndex('public_profiles_username_idx').on(table.username),
  }),
)

export const vessels = sqliteTable(
  'vessels',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    vesselType: text('vessel_type'),
    homePort: text('home_port'),
    summary: text('summary'),
    callSign: text('call_sign'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    sharePublic: integer('share_public', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
    updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
  },
  (table) => ({
    ownerSlugIdx: uniqueIndex('vessels_owner_slug_idx').on(table.ownerUserId, table.slug),
  }),
)

export const vesselInstallations = sqliteTable('vessel_installations', {
  id: text('id').primaryKey(),
  vesselId: text('vessel_id')
    .notNull()
    .references(() => vessels.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  installationType: text('installation_type').notNull().default('edge_agent'),
  edgeHostname: text('edge_hostname'),
  signalKUrl: text('signalk_url'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  connectionState: text('connection_state').notNull().default('pending'),
  lastSeenAt: text('last_seen_at'),
  eventCount: integer('event_count').notNull().default(0),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
  updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
})

export const vesselInstallationApiKeys = sqliteTable('vessel_installation_api_keys', {
  apiKeyId: text('api_key_id')
    .primaryKey()
    .references(() => apiKeys.id, { onDelete: 'cascade' }),
  installationId: text('installation_id')
    .notNull()
    .references(() => vesselInstallations.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
})

export const vesselInstallationObservedIdentities = sqliteTable(
  'vessel_installation_observed_identities',
  {
    installationId: text('installation_id')
      .primaryKey()
      .references(() => vesselInstallations.id, { onDelete: 'cascade' }),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('signalk_delta'),
    selfContext: text('self_context'),
    mmsi: text('mmsi'),
    observedName: text('observed_name'),
    callSign: text('call_sign'),
    shipType: text('ship_type'),
    shipTypeCode: integer('ship_type_code'),
    lengthOverall: real('length_overall'),
    beam: real('beam'),
    draft: real('draft'),
    registrationNumber: text('registration_number'),
    imo: text('imo'),
    observedAt: text('observed_at'),
    createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
    updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
  },
  (table) => ({
    vesselIdx: index('vessel_installation_observed_identities_vessel_idx').on(table.vesselId),
    mmsiIdx: index('vessel_installation_observed_identities_mmsi_idx').on(table.mmsi),
  }),
)

export const vesselObservedIdentities = sqliteTable(
  'vessel_observed_identities',
  {
    vesselId: text('vessel_id')
      .primaryKey()
      .references(() => vessels.id, { onDelete: 'cascade' }),
    sourceInstallationId: text('source_installation_id').references(() => vesselInstallations.id, {
      onDelete: 'set null',
    }),
    source: text('source').notNull().default('signalk_delta'),
    selfContext: text('self_context'),
    mmsi: text('mmsi'),
    observedName: text('observed_name'),
    callSign: text('call_sign'),
    shipType: text('ship_type'),
    shipTypeCode: integer('ship_type_code'),
    lengthOverall: real('length_overall'),
    beam: real('beam'),
    draft: real('draft'),
    registrationNumber: text('registration_number'),
    imo: text('imo'),
    observedAt: text('observed_at'),
    createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
    updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
  },
  (table) => ({
    sourceInstallationIdx: index('vessel_observed_identities_installation_idx').on(
      table.sourceInstallationId,
    ),
    mmsiIdx: index('vessel_observed_identities_mmsi_idx').on(table.mmsi),
  }),
)

export const vesselLiveSnapshots = sqliteTable('vessel_live_snapshots', {
  vesselId: text('vessel_id')
    .primaryKey()
    .references(() => vessels.id, { onDelete: 'cascade' }),
  source: text('source').notNull().default('install'),
  observedAt: text('observed_at'),
  positionLat: real('position_lat'),
  positionLng: real('position_lng'),
  headingMagnetic: real('heading_magnetic'),
  speedOverGround: real('speed_over_ground'),
  speedThroughWater: real('speed_through_water'),
  windSpeedApparent: real('wind_speed_apparent'),
  windAngleApparent: real('wind_angle_apparent'),
  depthBelowTransducer: real('depth_below_transducer'),
  waterTemperatureKelvin: real('water_temperature_kelvin'),
  batteryVoltage: real('battery_voltage'),
  engineRpm: real('engine_rpm'),
  statusNote: text('status_note'),
  updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
})

export const passages = sqliteTable('passages', {
  id: text('id').primaryKey(),
  vesselId: text('vessel_id')
    .notNull()
    .references(() => vessels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary'),
  departureName: text('departure_name'),
  arrivalName: text('arrival_name'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  distanceNm: real('distance_nm'),
  maxWindKn: real('max_wind_kn'),
  trackGeojson: text('track_geojson'),
  createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
})

export const waypoints = sqliteTable('waypoints', {
  id: text('id').primaryKey(),
  vesselId: text('vessel_id')
    .notNull()
    .references(() => vessels.id, { onDelete: 'cascade' }),
  passageId: text('passage_id').references(() => passages.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  note: text('note'),
  kind: text('kind').notNull().default('anchorage'),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  visitedAt: text('visited_at'),
  createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
})

export const mediaItems = sqliteTable('media_items', {
  id: text('id').primaryKey(),
  vesselId: text('vessel_id')
    .notNull()
    .references(() => vessels.id, { onDelete: 'cascade' }),
  passageId: text('passage_id').references(() => passages.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  caption: text('caption'),
  imageUrl: text('image_url').notNull(),
  lat: real('lat'),
  lng: real('lng'),
  capturedAt: text('captured_at'),
  createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
})

export const followedVessels = sqliteTable(
  'followed_vessels',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('aishub'),
    matchMode: text('match_mode').notNull().default('mmsi'),
    mmsi: text('mmsi').notNull(),
    imo: text('imo'),
    name: text('name').notNull(),
    callSign: text('call_sign'),
    destination: text('destination'),
    lastReportAt: text('last_report_at'),
    positionLat: real('position_lat'),
    positionLng: real('position_lng'),
    shipType: integer('ship_type'),
    sourceStationsJson: text('source_stations_json').notNull().default('[]'),
    createdAt: text('created_at').notNull().$defaultFn(isoTimestamp),
    updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
  },
  (table) => ({
    ownerMmsiIdx: uniqueIndex('followed_vessels_owner_mmsi_idx').on(table.ownerUserId, table.mmsi),
  }),
)

export const aishubSearchCache = sqliteTable('aishub_search_cache', {
  queryKey: text('query_key').primaryKey(),
  matchMode: text('match_mode').notNull(),
  responseJson: text('response_json').notNull(),
  cachedAt: text('cached_at').notNull().$defaultFn(isoTimestamp),
  expiresAt: text('expires_at').notNull(),
})

export const aishubVessels = sqliteTable('aishub_vessels', {
  mmsi: text('mmsi').primaryKey(),
  imo: text('imo'),
  name: text('name').notNull(),
  callSign: text('call_sign'),
  destination: text('destination'),
  lastReportAt: text('last_report_at'),
  positionLat: real('position_lat'),
  positionLng: real('position_lng'),
  shipType: integer('ship_type'),
  courseOverGround: real('course_over_ground'),
  speedOverGround: real('speed_over_ground'),
  heading: real('heading'),
  rateOfTurn: real('rate_of_turn'),
  navStatus: integer('nav_status'),
  dimensionBow: integer('dimension_bow'),
  dimensionStern: integer('dimension_stern'),
  dimensionPort: integer('dimension_port'),
  dimensionStarboard: integer('dimension_starboard'),
  draughtMeters: real('draught_meters'),
  etaRaw: text('eta_raw'),
  sourceStationsJson: text('source_stations_json').notNull().default('[]'),
  searchDocument: text('search_document').notNull(),
  firstSeenAt: text('first_seen_at').notNull().$defaultFn(isoTimestamp),
  lastFetchedAt: text('last_fetched_at').notNull().$defaultFn(isoTimestamp),
  updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
})

export const aishubRequestState = sqliteTable('aishub_request_state', {
  id: text('id').primaryKey(),
  lastRequestAt: text('last_request_at').notNull(),
  updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
})

export const aishubSyncState = sqliteTable('aishub_sync_state', {
  id: text('id').primaryKey(),
  lastStartedAt: text('last_started_at'),
  lastCompletedAt: text('last_completed_at'),
  lastSuccessAt: text('last_success_at'),
  lastStatus: text('last_status').notNull().default('idle'),
  lastMode: text('last_mode'),
  lastLookbackMinutes: integer('last_lookback_minutes'),
  lastRecordCount: integer('last_record_count'),
  lastBatchCount: integer('last_batch_count'),
  lastError: text('last_error'),
  updatedAt: text('updated_at').notNull().$defaultFn(isoTimestamp),
})

export type PublicProfile = typeof publicProfiles.$inferSelect
export type Vessel = typeof vessels.$inferSelect
export type VesselInstallation = typeof vesselInstallations.$inferSelect
export type VesselInstallationObservedIdentity =
  typeof vesselInstallationObservedIdentities.$inferSelect
export type VesselLiveSnapshot = typeof vesselLiveSnapshots.$inferSelect
export type VesselObservedIdentity = typeof vesselObservedIdentities.$inferSelect
export type Passage = typeof passages.$inferSelect
export type Waypoint = typeof waypoints.$inferSelect
export type MediaItem = typeof mediaItems.$inferSelect
export type FollowedVessel = typeof followedVessels.$inferSelect
export type AisHubVessel = typeof aishubVessels.$inferSelect
export type AisHubSyncState = typeof aishubSyncState.$inferSelect
