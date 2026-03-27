-- Initial schema: users, sessions, and todos tables
-- Generated from server/database/schema.ts

CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text,
  `name` text,
  `apple_id` text,
  `is_admin` integer DEFAULT false,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `name` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `apple_id` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `is_admin` integer DEFAULT false;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `updated_at` text DEFAULT (datetime('now'));
--> statement-breakpoint
UPDATE `users`
SET `updated_at` = COALESCE(`updated_at`, `created_at`, datetime('now'));
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_apple_id_unique` ON `users` (`apple_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `expires_at` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `todos` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `completed` integer DEFAULT false,
  `created_at` text NOT NULL
);
