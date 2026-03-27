-- App-owned seed data for local development
-- Run: pnpm run db:seed (after db:migrate)

UPDATE users
SET
  name = 'Captain Tide',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '00000000-0000-0000-0000-000000000001';

INSERT INTO public_profiles (
  user_id,
  username,
  headline,
  bio,
  home_port,
  share_profile,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'captain-tide',
  'Live telemetry, passage memory, and a public captain log from the Tideye demo boat.',
  'Demo captain profile wired to a real public Signal K stream so the operator dashboard, public pages, and install surfaces have realistic local data.',
  'St. Petersburg, FL',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-120 days'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(user_id) DO UPDATE SET
  username = excluded.username,
  headline = excluded.headline,
  bio = excluded.bio,
  home_port = excluded.home_port,
  share_profile = excluded.share_profile,
  updated_at = excluded.updated_at;

INSERT INTO vessels (
  id,
  owner_user_id,
  slug,
  name,
  vessel_type,
  home_port,
  summary,
  call_sign,
  is_primary,
  share_public,
  created_at,
  updated_at
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'tideye',
    'Tideye',
    'Leopard 48',
    'St. Petersburg, FL',
    'Bluewater catamaran streaming a live public Signal K feed, voyage history, and place-linked media through MyBoat.',
    'WDM4821',
    1,
    1,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-120 days'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'shoreboat',
    'Shoreboat',
    'Rigid Inflatable Tender',
    'St. Petersburg, FL',
    'A private tender used for shore runs, dinghy dock approaches, and scout hops before bigger passages.',
    'WDM4822',
    0,
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-100 days'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 days')
  )
ON CONFLICT(id) DO UPDATE SET
  owner_user_id = excluded.owner_user_id,
  slug = excluded.slug,
  name = excluded.name,
  vessel_type = excluded.vessel_type,
  home_port = excluded.home_port,
  summary = excluded.summary,
  call_sign = excluded.call_sign,
  is_primary = excluded.is_primary,
  share_public = excluded.share_public,
  updated_at = excluded.updated_at;

INSERT INTO vessel_installations (
  id,
  vessel_id,
  label,
  installation_type,
  edge_hostname,
  signalk_url,
  is_primary,
  connection_state,
  last_seen_at,
  event_count,
  archived_at,
  created_at,
  updated_at
)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Bee public Signal K',
  'direct_signalk',
  NULL,
  'wss://signalk-public.tideye.com/signalk/v1/stream',
  1,
  'live',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 seconds'),
  1842,
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-45 days'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  vessel_id = excluded.vessel_id,
  label = excluded.label,
  installation_type = excluded.installation_type,
  edge_hostname = excluded.edge_hostname,
  signalk_url = excluded.signalk_url,
  is_primary = excluded.is_primary,
  connection_state = excluded.connection_state,
  last_seen_at = excluded.last_seen_at,
  event_count = excluded.event_count,
  archived_at = excluded.archived_at,
  updated_at = excluded.updated_at;

INSERT INTO api_keys (
  id,
  user_id,
  name,
  key_hash,
  key_prefix,
  last_used_at,
  expires_at,
  created_at
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Bee collector key',
  '5b97022f7dcee71f34b10b7eaf0c5b41b32fa4a30d3849d7fd14f7a6f761c842',
  'mb_demo_',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 minutes'),
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-21 days')
)
ON CONFLICT(id) DO UPDATE SET
  user_id = excluded.user_id,
  name = excluded.name,
  key_hash = excluded.key_hash,
  key_prefix = excluded.key_prefix,
  last_used_at = excluded.last_used_at,
  expires_at = excluded.expires_at;

INSERT INTO vessel_installation_api_keys (api_key_id, installation_id, created_at)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-21 days')
)
ON CONFLICT(api_key_id) DO UPDATE SET
  installation_id = excluded.installation_id,
  created_at = excluded.created_at;

INSERT INTO vessel_live_snapshots (
  vessel_id,
  source,
  observed_at,
  position_lat,
  position_lng,
  heading_magnetic,
  speed_over_ground,
  speed_through_water,
  wind_speed_apparent,
  wind_angle_apparent,
  depth_below_transducer,
  water_temperature_kelvin,
  battery_voltage,
  engine_rpm,
  status_note,
  updated_at
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'direct_signalk',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 seconds'),
  27.7719,
  -82.6534,
  184.2,
  6.4,
  5.9,
  14.6,
  28.4,
  5.8,
  299.6,
  13.2,
  2250,
  'Public Tideye feed reporting cleanly through the direct Signal K stream.',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(vessel_id) DO UPDATE SET
  source = excluded.source,
  observed_at = excluded.observed_at,
  position_lat = excluded.position_lat,
  position_lng = excluded.position_lng,
  heading_magnetic = excluded.heading_magnetic,
  speed_over_ground = excluded.speed_over_ground,
  speed_through_water = excluded.speed_through_water,
  wind_speed_apparent = excluded.wind_speed_apparent,
  wind_angle_apparent = excluded.wind_angle_apparent,
  depth_below_transducer = excluded.depth_below_transducer,
  water_temperature_kelvin = excluded.water_temperature_kelvin,
  battery_voltage = excluded.battery_voltage,
  engine_rpm = excluded.engine_rpm,
  status_note = excluded.status_note,
  updated_at = excluded.updated_at;

INSERT INTO passages (
  id,
  vessel_id,
  title,
  summary,
  departure_name,
  arrival_name,
  started_at,
  ended_at,
  distance_nm,
  max_wind_kn,
  track_geojson,
  created_at
)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Egmont Key shakedown',
    'Short systems check outside Tampa Bay with the live stream left public for demo followers.',
    'St. Petersburg Municipal Marina',
    'Egmont Key Anchorage',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days', '-5 hours'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days', '-1 hours'),
    18.4,
    19.2,
    '{"type":"LineString","coordinates":[[-82.6401,27.7689],[-82.6625,27.7418],[-82.7628,27.5914]]}',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days')
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Sunrise harbor loop',
    'Predawn harbor departure, bridge opening, and return leg used to verify instrumentation before a longer coastal run.',
    'St. Petersburg Municipal Marina',
    'Vinoy Basin',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days', '-3 hours'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days', '-30 minutes'),
    9.6,
    16.8,
    '{"type":"LineString","coordinates":[[-82.6401,27.7689],[-82.6287,27.7732],[-82.6144,27.7805],[-82.6238,27.7907]]}',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days')
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'Dinghy dock run',
    'Private tender hop for provisions and a quick systems check around the marina basin.',
    'Tideye stern davits',
    'Downtown dock',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days', '-2 hours'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days', '-1 hours', '-15 minutes'),
    2.2,
    11.5,
    '{"type":"LineString","coordinates":[[-82.6401,27.7689],[-82.6364,27.7724],[-82.6327,27.7768]]}',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days')
  )
ON CONFLICT(id) DO UPDATE SET
  vessel_id = excluded.vessel_id,
  title = excluded.title,
  summary = excluded.summary,
  departure_name = excluded.departure_name,
  arrival_name = excluded.arrival_name,
  started_at = excluded.started_at,
  ended_at = excluded.ended_at,
  distance_nm = excluded.distance_nm,
  max_wind_kn = excluded.max_wind_kn,
  track_geojson = excluded.track_geojson,
  created_at = excluded.created_at;

INSERT INTO waypoints (
  id,
  vessel_id,
  passage_id,
  title,
  note,
  kind,
  lat,
  lng,
  visited_at,
  created_at
)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'Egmont outer marker',
    'Good visual checkpoint before laying over toward the anchorage.',
    'mark',
    27.6192,
    -82.7611,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days', '-2 hours'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days')
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'Egmont anchorage',
    'Sheltered lunch stop with enough room to swing on the hook.',
    'anchorage',
    27.5919,
    -82.7617,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days', '-90 minutes'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days')
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    'Vinoy turn basin',
    'Tight turning room used to validate chart alignment against the live feed.',
    'arrival',
    27.7718,
    -82.6288,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days', '-50 minutes'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days')
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000003',
    'Provisioning dock',
    'Quick tie-up for groceries and ice before heading back to the mothership.',
    'dock',
    27.7768,
    -82.6327,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days', '-75 minutes'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days')
  )
ON CONFLICT(id) DO UPDATE SET
  vessel_id = excluded.vessel_id,
  passage_id = excluded.passage_id,
  title = excluded.title,
  note = excluded.note,
  kind = excluded.kind,
  lat = excluded.lat,
  lng = excluded.lng,
  visited_at = excluded.visited_at,
  created_at = excluded.created_at;

INSERT INTO media_items (
  id,
  vessel_id,
  passage_id,
  title,
  caption,
  image_url,
  lat,
  lng,
  captured_at,
  created_at
)
VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'Anchorage light check',
    'Sun dropping over Egmont after the direct Signal K bridge stayed stable through the afternoon.',
    '/images/hero-bg.webp',
    27.5919,
    -82.7617,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days', '-80 minutes'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days')
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    'Harbor sunrise watch',
    'Pre-coffee bridge opening and quiet water before the city fully wakes up.',
    '/images/empty-harbor.webp',
    27.7732,
    -82.6287,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days', '-2 hours'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days')
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000003',
    'Tender dock run',
    'Provision run wrapped before the afternoon squall line built over the bay.',
    '/images/hero-bg.webp',
    27.7768,
    -82.6327,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days', '-90 minutes'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days')
  )
ON CONFLICT(id) DO UPDATE SET
  vessel_id = excluded.vessel_id,
  passage_id = excluded.passage_id,
  title = excluded.title,
  caption = excluded.caption,
  image_url = excluded.image_url,
  lat = excluded.lat,
  lng = excluded.lng,
  captured_at = excluded.captured_at,
  created_at = excluded.created_at;
