CREATE TABLE `auth_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_auth_attempts_expiry` ON `auth_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `auth_links` (
	`account_id` text PRIMARY KEY NOT NULL,
	`legacy_owner` text NOT NULL,
	`owner_admin` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_links_legacy_owner_unique` ON `auth_links` (`legacy_owner`);--> statement-breakpoint
CREATE TABLE `auth_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_url` text NOT NULL,
	`public_key` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`email_delivery_confirmed` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
