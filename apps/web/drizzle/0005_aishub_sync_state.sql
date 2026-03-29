ALTER TABLE `aishub_vessels` ADD COLUMN `course_over_ground` real;
ALTER TABLE `aishub_vessels` ADD COLUMN `speed_over_ground` real;
ALTER TABLE `aishub_vessels` ADD COLUMN `heading` real;
ALTER TABLE `aishub_vessels` ADD COLUMN `rate_of_turn` real;
ALTER TABLE `aishub_vessels` ADD COLUMN `nav_status` integer;
ALTER TABLE `aishub_vessels` ADD COLUMN `dimension_bow` integer;
ALTER TABLE `aishub_vessels` ADD COLUMN `dimension_stern` integer;
ALTER TABLE `aishub_vessels` ADD COLUMN `dimension_port` integer;
ALTER TABLE `aishub_vessels` ADD COLUMN `dimension_starboard` integer;
ALTER TABLE `aishub_vessels` ADD COLUMN `draught_meters` real;
ALTER TABLE `aishub_vessels` ADD COLUMN `eta_raw` text;

CREATE INDEX IF NOT EXISTS `aishub_vessels_last_fetched_at_idx`
ON `aishub_vessels` (`last_fetched_at`);

CREATE INDEX IF NOT EXISTS `aishub_vessels_last_report_at_idx`
ON `aishub_vessels` (`last_report_at`);

CREATE TABLE IF NOT EXISTS `aishub_sync_state` (
  `id` text PRIMARY KEY NOT NULL,
  `last_started_at` text,
  `last_completed_at` text,
  `last_success_at` text,
  `last_status` text DEFAULT 'idle' NOT NULL,
  `last_mode` text,
  `last_lookback_minutes` integer,
  `last_record_count` integer,
  `last_batch_count` integer,
  `last_error` text,
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
