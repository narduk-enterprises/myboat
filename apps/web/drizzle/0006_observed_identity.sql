CREATE TABLE IF NOT EXISTS `vessel_installation_observed_identities` (
  `installation_id` text PRIMARY KEY NOT NULL REFERENCES `vessel_installations`(`id`) ON DELETE cascade,
  `vessel_id` text NOT NULL REFERENCES `vessels`(`id`) ON DELETE cascade,
  `source` text DEFAULT 'signalk_delta' NOT NULL,
  `self_context` text,
  `mmsi` text,
  `observed_name` text,
  `call_sign` text,
  `ship_type` text,
  `ship_type_code` integer,
  `length_overall` real,
  `beam` real,
  `draft` real,
  `registration_number` text,
  `imo` text,
  `observed_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `vessel_installation_observed_identities_vessel_idx`
ON `vessel_installation_observed_identities` (`vessel_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `vessel_installation_observed_identities_mmsi_idx`
ON `vessel_installation_observed_identities` (`mmsi`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vessel_observed_identities` (
  `vessel_id` text PRIMARY KEY NOT NULL REFERENCES `vessels`(`id`) ON DELETE cascade,
  `source_installation_id` text REFERENCES `vessel_installations`(`id`) ON DELETE set null,
  `source` text DEFAULT 'signalk_delta' NOT NULL,
  `self_context` text,
  `mmsi` text,
  `observed_name` text,
  `call_sign` text,
  `ship_type` text,
  `ship_type_code` integer,
  `length_overall` real,
  `beam` real,
  `draft` real,
  `registration_number` text,
  `imo` text,
  `observed_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `vessel_observed_identities_installation_idx`
ON `vessel_observed_identities` (`source_installation_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `vessel_observed_identities_mmsi_idx`
ON `vessel_observed_identities` (`mmsi`);
