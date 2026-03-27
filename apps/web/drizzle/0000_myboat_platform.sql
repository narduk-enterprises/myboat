CREATE TABLE `public_profiles` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `username` text NOT NULL,
  `headline` text,
  `bio` text,
  `home_port` text,
  `share_profile` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `public_profiles_username_idx` ON `public_profiles` (`username`);
--> statement-breakpoint
CREATE TABLE `vessels` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `vessel_type` text,
  `home_port` text,
  `summary` text,
  `call_sign` text,
  `is_primary` integer DEFAULT 0 NOT NULL,
  `share_public` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vessels_owner_slug_idx` ON `vessels` (`owner_user_id`, `slug`);
--> statement-breakpoint
CREATE TABLE `vessel_installations` (
  `id` text PRIMARY KEY NOT NULL,
  `vessel_id` text NOT NULL REFERENCES `vessels`(`id`) ON DELETE cascade,
  `label` text NOT NULL,
  `edge_hostname` text,
  `signalk_url` text,
  `connection_state` text DEFAULT 'pending' NOT NULL,
  `last_seen_at` text,
  `event_count` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vessel_installation_api_keys` (
  `api_key_id` text PRIMARY KEY NOT NULL REFERENCES `api_keys`(`id`) ON DELETE cascade,
  `installation_id` text NOT NULL REFERENCES `vessel_installations`(`id`) ON DELETE cascade,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vessel_live_snapshots` (
  `vessel_id` text PRIMARY KEY NOT NULL REFERENCES `vessels`(`id`) ON DELETE cascade,
  `source` text DEFAULT 'install' NOT NULL,
  `observed_at` text,
  `position_lat` real,
  `position_lng` real,
  `heading_magnetic` real,
  `speed_over_ground` real,
  `speed_through_water` real,
  `wind_speed_apparent` real,
  `wind_angle_apparent` real,
  `depth_below_transducer` real,
  `water_temperature_kelvin` real,
  `battery_voltage` real,
  `engine_rpm` real,
  `status_note` text,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passages` (
  `id` text PRIMARY KEY NOT NULL,
  `vessel_id` text NOT NULL REFERENCES `vessels`(`id`) ON DELETE cascade,
  `title` text NOT NULL,
  `summary` text,
  `departure_name` text,
  `arrival_name` text,
  `started_at` text NOT NULL,
  `ended_at` text,
  `distance_nm` real,
  `max_wind_kn` real,
  `track_geojson` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `waypoints` (
  `id` text PRIMARY KEY NOT NULL,
  `vessel_id` text NOT NULL REFERENCES `vessels`(`id`) ON DELETE cascade,
  `passage_id` text REFERENCES `passages`(`id`) ON DELETE set null,
  `title` text NOT NULL,
  `note` text,
  `kind` text DEFAULT 'anchorage' NOT NULL,
  `lat` real NOT NULL,
  `lng` real NOT NULL,
  `visited_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_items` (
  `id` text PRIMARY KEY NOT NULL,
  `vessel_id` text NOT NULL REFERENCES `vessels`(`id`) ON DELETE cascade,
  `passage_id` text REFERENCES `passages`(`id`) ON DELETE set null,
  `title` text NOT NULL,
  `caption` text,
  `image_url` text NOT NULL,
  `lat` real,
  `lng` real,
  `captured_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
