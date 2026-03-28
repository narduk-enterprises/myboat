CREATE TABLE IF NOT EXISTS `followed_vessels` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `source` text DEFAULT 'aishub' NOT NULL,
  `match_mode` text DEFAULT 'mmsi' NOT NULL,
  `mmsi` text NOT NULL,
  `imo` text,
  `name` text NOT NULL,
  `call_sign` text,
  `destination` text,
  `last_report_at` text,
  `position_lat` real,
  `position_lng` real,
  `ship_type` integer,
  `source_stations_json` text DEFAULT '[]' NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `followed_vessels_owner_mmsi_idx`
ON `followed_vessels` (`owner_user_id`, `mmsi`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `aishub_search_cache` (
  `query_key` text PRIMARY KEY NOT NULL,
  `match_mode` text NOT NULL,
  `response_json` text NOT NULL,
  `cached_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `aishub_request_state` (
  `id` text PRIMARY KEY NOT NULL,
  `last_request_at` text NOT NULL,
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
