ALTER TABLE `vessel_installations`
ADD COLUMN `installation_type` text DEFAULT 'edge_agent' NOT NULL;
--> statement-breakpoint
ALTER TABLE `vessel_installations`
ADD COLUMN `is_primary` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `vessel_installations`
ADD COLUMN `archived_at` text;
