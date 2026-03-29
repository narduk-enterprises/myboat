ALTER TABLE `media_items` ADD COLUMN `share_public` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `media_items` ADD COLUMN `source_kind` text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE `media_items` ADD COLUMN `source_asset_id` text;
--> statement-breakpoint
ALTER TABLE `media_items` ADD COLUMN `source_fingerprint` text;
--> statement-breakpoint
ALTER TABLE `media_items` ADD COLUMN `match_status` text DEFAULT 'attached' NOT NULL;
--> statement-breakpoint
ALTER TABLE `media_items` ADD COLUMN `match_score` real;
--> statement-breakpoint
ALTER TABLE `media_items` ADD COLUMN `match_reason` text;
--> statement-breakpoint
ALTER TABLE `media_items` ADD COLUMN `is_cover` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `media_items`
SET `share_public` = 1
WHERE `share_public` = 0;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `media_items_vessel_fingerprint_idx`
ON `media_items` (`vessel_id`, `source_fingerprint`);
