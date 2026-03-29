-- App-owned seed data for local development
-- Run: pnpm run db:seed (after db:migrate)

UPDATE users
SET
  name = 'Admin Captain',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '00000000-0000-0000-0000-000000000002';

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
  '00000000-0000-0000-0000-000000000002',
  'captain-tideye',
  'Admin workspace wired to the live Tideye Gulf Coast feed.',
  'Local admin profile seeded for live Tideye telemetry, AIS traffic, and Gulf Coast passage playback from the same Signal K source the narduk edge canary consumes.',
  'Kemah Boardwalk Marina, TX',
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
    '00000000-0000-0000-0000-000000000002',
    'tideye',
    'Tideye',
    'Leopard 42 (2023)',
    'Kemah Boardwalk Marina, TX',
    '2023 Leopard 42 (Tideye) with Gulf Coast voyage history seeded from tideye.nard.uk passages and a live Signal K source matching the narduk edge canary collector.',
    'WDM4821',
    1,
    1,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-120 days'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
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
  'narduk edge canary · Tideye Signal K',
  'direct_signalk',
  'narduk/myboat-edge-canary',
  'wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all',
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
  '00000000-0000-0000-0000-000000000002',
  'Tideye edge collector key',
  '5b97022f7dcee71f34b10b7eaf0c5b41b32fa4a30d3849d7fd14f7a6f761c842',
  'mb_admin_',
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
  29.545827,
  -95.019811,
  184.2,
  6.4,
  5.9,
  14.6,
  28.4,
  5.8,
  299.6,
  13.2,
  2250,
  'At the Kemah dock with the seeded Tideye position, ready for live self telemetry and nearby AIS from the narduk feed.',
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
    'Galveston Bay → Kemah Boardwalk Marina · 7.5 nm',
    'Tideye track (ydg-nmea-2000.2). Imported from tideye.nard.uk passage passage-20251207T125258-b1ec61c9.',
    'Galveston Bay',
    'Kemah Boardwalk Marina',
    '2025-12-07T12:52:58.000Z',
    '2025-12-07T14:07:44.000Z',
    7.5,
    NULL,
    '{"type":"LineString","coordinates":[[-94.89709,29.51361],[-94.89709,29.51369],[-94.89701,29.51366],[-94.89687,29.51381],[-94.89647,29.51396],[-94.89586,29.51418],[-94.89602,29.51437],[-94.89667,29.51423],[-94.89724,29.51437],[-94.89793,29.51468],[-94.89873,29.5152],[-94.89925,29.51573],[-94.89961,29.51627],[-94.90027,29.51721],[-94.90092,29.51813],[-94.90213,29.51875],[-94.90316,29.51917],[-94.90425,29.51964],[-94.90599,29.52033],[-94.90709,29.5208],[-94.90832,29.52132],[-94.9097,29.52187],[-94.91081,29.52233],[-94.91209,29.52284],[-94.91321,29.5233],[-94.91426,29.52373],[-94.91615,29.52452],[-94.9175,29.52509],[-94.91907,29.52572],[-94.92075,29.52639],[-94.92207,29.52695],[-94.9235,29.52751],[-94.92514,29.5282],[-94.92617,29.52862],[-94.92784,29.52926],[-94.92942,29.52995],[-94.93069,29.53049],[-94.93228,29.53113],[-94.93363,29.53168],[-94.93505,29.53225],[-94.93663,29.53291],[-94.9377,29.53334],[-94.93933,29.53401],[-94.94075,29.53459],[-94.94199,29.53511],[-94.94355,29.53576],[-94.94498,29.53635],[-94.94616,29.53684],[-94.94786,29.53753],[-94.94918,29.53808],[-94.95055,29.53863],[-94.95224,29.53929],[-94.95357,29.53983],[-94.95534,29.54059],[-94.95643,29.54104],[-94.95766,29.54154],[-94.95908,29.5421],[-94.96028,29.54258],[-94.9616,29.54314],[-94.96298,29.54371],[-94.96415,29.54418],[-94.96557,29.54475],[-94.96666,29.54521],[-94.96783,29.54569],[-94.96923,29.54629],[-94.97032,29.54674],[-94.97142,29.54719],[-94.97289,29.5478],[-94.974,29.54823],[-94.97545,29.54882],[-94.97655,29.54927],[-94.97769,29.54972],[-94.97914,29.55033],[-94.98028,29.55081],[-94.98138,29.55127],[-94.98285,29.55187],[-94.98399,29.55234],[-94.98515,29.55281],[-94.98664,29.55325],[-94.98792,29.55317],[-94.98946,29.55296],[-94.99072,29.55277],[-94.99198,29.55255],[-94.99363,29.55228],[-94.99497,29.55206],[-94.99623,29.55186],[-94.99787,29.55158],[-94.99917,29.55138],[-95.00081,29.55111],[-95.00205,29.5509],[-95.00364,29.55065],[-95.00514,29.55043],[-95.00637,29.55023],[-95.00766,29.55003],[-95.00917,29.54979],[-95.01037,29.54959],[-95.01154,29.54942],[-95.01287,29.5492],[-95.01382,29.54907],[-95.01505,29.54887],[-95.01601,29.54873],[-95.0169,29.54858],[-95.01795,29.54853],[-95.0188,29.54854],[-95.01948,29.54857],[-95.02049,29.54875],[-95.02111,29.54879],[-95.02141,29.54855],[-95.02137,29.54827],[-95.02133,29.54807],[-95.02129,29.54785],[-95.02122,29.54751],[-95.02117,29.54713],[-95.02105,29.54641],[-95.02098,29.54603],[-95.02089,29.54576],[-95.02071,29.54569],[-95.02043,29.54572],[-95.02008,29.54578],[-95.01981,29.54583]]}',
    '2026-03-22T10:30:03.064Z'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '30.22°N 93.22°W → Galveston Bay · 126.7 nm',
    'Tideye track (ydg-nmea-2000.2). Imported from tideye.nard.uk passage passage-20251206T151005-ecb75b05.',
    '30.22°N 93.22°W',
    'Galveston Bay',
    '2025-12-06T15:10:05.000Z',
    '2025-12-07T09:01:35.000Z',
    126.7,
    NULL,
    '{"type":"LineString","coordinates":[[-93.22316,30.22461],[-93.23642,30.22284],[-93.25458,30.21933],[-93.26271,30.20851],[-93.28136,30.20107],[-93.30133,30.18807],[-93.31728,30.17698],[-93.32269,30.15913],[-93.3319,30.14533],[-93.33207,30.12673],[-93.33306,30.10916],[-93.3263,30.09179],[-93.32694,30.07276],[-93.32881,30.05447],[-93.33122,30.03252],[-93.3329,30.01499],[-93.33427,29.99749],[-93.33591,29.97919],[-93.33778,29.96108],[-93.33951,29.94402],[-93.34065,29.92752],[-93.34214,29.91065],[-93.34378,29.89349],[-93.34523,29.87367],[-93.34648,29.85579],[-93.34796,29.83897],[-93.34795,29.82018],[-93.34689,29.80175],[-93.34592,29.78308],[-93.34432,29.76591],[-93.34186,29.74897],[-93.33396,29.74134],[-93.33243,29.73862],[-93.35471,29.73718],[-93.37352,29.73155],[-93.38914,29.7269],[-93.40565,29.72197],[-93.42286,29.71682],[-93.44077,29.71147],[-93.4562,29.70687],[-93.46698,29.70368],[-93.47648,29.69857],[-93.48955,29.69409],[-93.50791,29.68947],[-93.52739,29.68423],[-93.54572,29.67874],[-93.56479,29.67305],[-93.58419,29.66725],[-93.61613,29.65767],[-93.63717,29.65235],[-93.65657,29.64557],[-93.68095,29.63827],[-93.70248,29.6318],[-93.72357,29.62548],[-93.74516,29.61955],[-93.76636,29.61622],[-93.7875,29.61125],[-93.807,29.60532],[-93.82223,29.59891],[-93.83788,29.59245],[-93.85635,29.58493],[-93.87131,29.58001],[-93.88705,29.57529],[-93.9044,29.57006],[-93.92096,29.56506],[-93.93771,29.56002],[-93.95397,29.55489],[-93.96773,29.54957],[-93.98605,29.54408],[-94.0104,29.53798],[-94.03159,29.53257],[-94.0523,29.52559],[-94.07331,29.51686],[-94.09479,29.50985],[-94.11627,29.50348],[-94.13719,29.49754],[-94.15868,29.49128],[-94.17935,29.48512],[-94.20435,29.4769],[-94.22532,29.4702],[-94.24642,29.46406],[-94.26663,29.45822],[-94.2867,29.45209],[-94.30694,29.44604],[-94.3271,29.44038],[-94.34739,29.43464],[-94.36609,29.42878],[-94.3891,29.42354],[-94.40803,29.41881],[-94.42673,29.41386],[-94.44562,29.40907],[-94.46459,29.40418],[-94.48371,29.39922],[-94.50282,29.39412],[-94.52148,29.38843],[-94.54034,29.38273],[-94.55911,29.37651],[-94.58107,29.36875],[-94.60064,29.36136],[-94.62185,29.35454],[-94.64301,29.34856],[-94.664,29.34261],[-94.68515,29.34376],[-94.70632,29.34716],[-94.73006,29.34969],[-94.75449,29.35005],[-94.78177,29.35569],[-94.79407,29.37352],[-94.80468,29.39098],[-94.815,29.40808],[-94.82384,29.42558],[-94.83204,29.44331],[-94.84029,29.46111],[-94.8486,29.47883],[-94.85762,29.49295],[-94.8674,29.50346],[-94.87945,29.51265],[-94.89421,29.52042],[-94.89864,29.51407],[-94.89729,29.5138]]}',
    '2026-03-22T10:30:03.064Z'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Kemah Boardwalk Marina → 30.22°N 93.22°W · 168.1 nm',
    'Tideye track (ydg-nmea-2000.2). Imported from tideye.nard.uk passage passage-20250927T142320-10ceae43.',
    'Kemah Boardwalk Marina',
    '30.22°N 93.22°W',
    '2025-09-27T14:23:20.000Z',
    '2025-09-28T19:42:50.000Z',
    168.1,
    NULL,
    '{"type":"LineString","coordinates":[[-95.01994,29.54584],[-95.02649,29.54922],[-95.02645,29.54916],[-95.00713,29.54996],[-94.98623,29.5598],[-94.97071,29.55684],[-94.95356,29.54836],[-94.93463,29.53786],[-94.90899,29.52566],[-94.88565,29.51583],[-94.87033,29.49703],[-94.86039,29.47865],[-94.85172,29.46098],[-94.84545,29.44726],[-94.83781,29.4316],[-94.83033,29.41646],[-94.82021,29.3998],[-94.80695,29.3823],[-94.79329,29.36667],[-94.77859,29.35278],[-94.75061,29.35281],[-94.72924,29.35164],[-94.70041,29.34415],[-94.66528,29.34218],[-94.63587,29.34443],[-94.60547,29.34667],[-94.5763,29.34884],[-94.54724,29.35098],[-94.5195,29.35304],[-94.48944,29.35525],[-94.47515,29.3557],[-94.47475,29.36283],[-94.47423,29.3665],[-94.47649,29.36724],[-94.47878,29.36789],[-94.45818,29.36341],[-94.4302,29.35603],[-94.40252,29.34825],[-94.3798,29.36043],[-94.36346,29.37839],[-94.34267,29.40068],[-94.32142,29.42316],[-94.29988,29.44098],[-94.29475,29.44758],[-94.27515,29.46725],[-94.25454,29.48826],[-94.22743,29.51557],[-94.21088,29.53221],[-94.19047,29.55343],[-94.17025,29.57444],[-94.1505,29.595],[-94.11679,29.5848],[-94.09057,29.57311],[-94.06388,29.56125],[-94.03691,29.54926],[-94.0105,29.53741],[-93.98893,29.52777],[-93.96008,29.51485],[-93.931,29.5012],[-93.91632,29.49633],[-93.90218,29.49367],[-93.87694,29.47552],[-93.85427,29.45757],[-93.83177,29.44071],[-93.81497,29.42956],[-93.79255,29.41477],[-93.77167,29.40013],[-93.74855,29.38446],[-93.74424,29.39832],[-93.74591,29.42284],[-93.74897,29.44735],[-93.75439,29.47134],[-93.75863,29.49817],[-93.76463,29.5188],[-93.76333,29.53774],[-93.73328,29.5316],[-93.70515,29.5238],[-93.68139,29.51963],[-93.65645,29.51472],[-93.62873,29.50315],[-93.60155,29.49132],[-93.58052,29.48121],[-93.55403,29.46714],[-93.52515,29.45511],[-93.49599,29.44596],[-93.46804,29.43364],[-93.45477,29.44863],[-93.44447,29.47289],[-93.43536,29.49794],[-93.4284,29.52385],[-93.42675,29.5455],[-93.41731,29.569],[-93.40694,29.58936],[-93.39753,29.61327],[-93.3872,29.63767],[-93.37579,29.66249],[-93.36411,29.68792],[-93.35228,29.7141],[-93.34087,29.7341],[-93.34309,29.75775],[-93.34613,29.78683],[-93.34759,29.81114],[-93.34818,29.83566],[-93.34578,29.86302],[-93.34302,29.89214],[-93.33953,29.92302],[-93.33744,29.95357],[-93.33532,29.97794],[-93.33198,30.00833],[-93.32922,30.0389],[-93.32667,30.06742],[-93.32458,30.09476],[-93.3326,30.12154],[-93.33207,30.14928],[-93.31834,30.17208],[-93.30161,30.18808],[-93.27472,30.20485],[-93.25248,30.219],[-93.23602,30.22519],[-93.22313,30.22458]]}',
    '2026-03-22T10:30:03.064Z'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'Kemah Boardwalk Marina → Kemah Boardwalk Marina · 10 nm',
    'Tideye track (ydg-nmea-2000.2). Imported from tideye.nard.uk passage passage-20250824T142110-f1009a88.',
    'Kemah Boardwalk Marina',
    'Kemah Boardwalk Marina',
    '2025-08-24T14:21:10.000Z',
    '2025-08-24T16:33:58.000Z',
    10,
    NULL,
    '{"type":"LineString","coordinates":[[-95.0199,29.54586],[-95.02085,29.54578],[-95.02119,29.54769],[-95.02023,29.54862],[-95.01701,29.54849],[-95.0138,29.54872],[-95.00901,29.54963],[-95.00464,29.55034],[-95.00001,29.5515],[-94.99735,29.55497],[-94.99387,29.5604],[-94.98999,29.56444],[-94.98755,29.56687],[-94.98227,29.5723],[-94.97949,29.57471],[-94.97658,29.57676],[-94.97379,29.57863],[-94.96968,29.58136],[-94.96699,29.58316],[-94.96427,29.58496],[-94.9616,29.58674],[-94.96019,29.58707],[-94.96082,29.58643],[-94.96128,29.58592],[-94.96171,29.58549],[-94.9621,29.58503],[-94.96245,29.58468],[-94.96279,29.58427],[-94.96311,29.5839],[-94.96344,29.5835],[-94.96374,29.58313],[-94.96418,29.58262],[-94.96519,29.58146],[-94.96572,29.58028],[-94.96616,29.5789],[-94.96552,29.57784],[-94.96398,29.57684],[-94.96276,29.57616],[-94.9615,29.57471],[-94.96009,29.57349],[-94.95846,29.57219],[-94.95713,29.57129],[-94.95558,29.57015],[-94.95477,29.56876],[-94.95549,29.56777],[-94.95669,29.56709],[-94.95803,29.56642],[-94.95936,29.56583],[-94.96007,29.56505],[-94.96068,29.56431],[-94.96105,29.56384],[-94.9614,29.56341],[-94.96167,29.56306],[-94.96196,29.56267],[-94.96226,29.56225],[-94.96258,29.56177],[-94.9639,29.56125],[-94.96669,29.56024],[-94.9699,29.55908],[-94.97377,29.55768],[-94.9768,29.5566],[-94.97989,29.55548],[-94.98284,29.5544],[-94.98629,29.55359],[-94.98942,29.55299],[-94.99258,29.5525],[-94.99602,29.55191],[-94.99934,29.55138],[-95.00264,29.55084],[-95.00565,29.55033],[-95.00888,29.54991],[-95.01194,29.5494],[-95.01529,29.54883],[-95.01791,29.5485],[-95.0203,29.54878],[-95.02127,29.54901],[-95.02126,29.54753],[-95.02101,29.54616],[-95.02059,29.54572],[-95.01985,29.54585]]}',
    '2026-03-22T10:30:03.064Z'
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
    'Galveston approach',
    'Fairway point from the imported Galveston Bay → Kemah track.',
    'mark',
    29.513613,
    -94.89709,
    '2025-12-07T13:20:00.000Z',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'Kemah Boardwalk Marina',
    'Arrival waypoint at the boardwalk docks from Tideye track data.',
    'dock',
    29.545827,
    -95.019811,
    '2025-12-07T14:00:00.000Z',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    'Offshore → Galveston',
    'Waypoint along the long offshore leg into Galveston Bay (Tideye import).',
    'mark',
    29.95,
    -94.25,
    '2025-12-07T02:00:00.000Z',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-100 days')
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000004',
    'Clear Lake day sail',
    'Local Kemah / Clear Lake loop from the imported day-sail passage.',
    'anchorage',
    29.546,
    -95.02,
    '2025-08-24T15:30:00.000Z',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-200 days')
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
  share_public,
  source_kind,
  source_asset_id,
  source_fingerprint,
  match_status,
  match_score,
  match_reason,
  is_cover,
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
    'Galveston Bay → Kemah',
    'Along the imported Tideye leg into Kemah Boardwalk Marina.',
    '/images/hero-bg.webp',
    1,
    'manual',
    NULL,
    'seed:passage-20251207T125258-b1ec61c9',
    'attached',
    1,
    'Seeded public media item.',
    1,
    29.52,
    -94.95,
    '2025-12-07T13:00:00.000Z',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    'Offshore approach to Galveston',
    'From the long Gulf run in the Tideye seed (30.22°N 93.22°W → Galveston Bay).',
    '/images/empty-harbor.webp',
    1,
    'manual',
    NULL,
    'seed:passage-20251206T151005-ecb75b05',
    'attached',
    1,
    'Seeded public media item.',
    1,
    29.6,
    -94.5,
    '2025-12-07T03:00:00.000Z',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-100 days')
  )
ON CONFLICT(id) DO UPDATE SET
  vessel_id = excluded.vessel_id,
  passage_id = excluded.passage_id,
  title = excluded.title,
  caption = excluded.caption,
  image_url = excluded.image_url,
  share_public = excluded.share_public,
  source_kind = excluded.source_kind,
  source_asset_id = excluded.source_asset_id,
  source_fingerprint = excluded.source_fingerprint,
  match_status = excluded.match_status,
  match_score = excluded.match_score,
  match_reason = excluded.match_reason,
  is_cover = excluded.is_cover,
  lat = excluded.lat,
  lng = excluded.lng,
  captured_at = excluded.captured_at,
  created_at = excluded.created_at;
