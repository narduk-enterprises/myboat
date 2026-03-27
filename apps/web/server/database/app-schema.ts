import { apiKeys, users } from '#layer/server/database/schema'
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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

export type PublicProfile = typeof publicProfiles.$inferSelect
export type Vessel = typeof vessels.$inferSelect
export type VesselInstallation = typeof vesselInstallations.$inferSelect
export type VesselLiveSnapshot = typeof vesselLiveSnapshots.$inferSelect
export type Passage = typeof passages.$inferSelect
export type Waypoint = typeof waypoints.$inferSelect
export type MediaItem = typeof mediaItems.$inferSelect
