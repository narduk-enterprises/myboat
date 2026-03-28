CREATE TABLE IF NOT EXISTS `aishub_vessels` (
  `mmsi` text PRIMARY KEY NOT NULL,
  `imo` text,
  `name` text NOT NULL,
  `call_sign` text,
  `destination` text,
  `last_report_at` text,
  `position_lat` real,
  `position_lng` real,
  `ship_type` integer,
  `source_stations_json` text DEFAULT '[]' NOT NULL,
  `search_document` text NOT NULL,
  `first_seen_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `last_fetched_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
