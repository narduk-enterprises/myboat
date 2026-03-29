CREATE TABLE IF NOT EXISTS `vessel_installation_source_states` (
  `installation_id` text PRIMARY KEY NOT NULL REFERENCES `vessel_installations`(`id`) ON DELETE cascade,
  `vessel_id` text NOT NULL REFERENCES `vessels`(`id`) ON DELETE cascade,
  `publisher_role` text DEFAULT 'primary' NOT NULL,
  `policy_version` text NOT NULL,
  `source_inventory_json` text DEFAULT '[]' NOT NULL,
  `current_winners_json` text DEFAULT '[]' NOT NULL,
  `duplicate_hotspots_json` text DEFAULT '[]' NOT NULL,
  `shadow_publisher_seen` integer DEFAULT 0 NOT NULL,
  `last_inventory_observed_at` text,
  `last_selection_observed_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `vessel_installation_source_states_vessel_idx`
ON `vessel_installation_source_states` (`vessel_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `vessel_installation_source_states_role_idx`
ON `vessel_installation_source_states` (`publisher_role`);
