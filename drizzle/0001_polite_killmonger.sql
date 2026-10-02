CREATE TABLE `catalog_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workshops` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`phone_note` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`brands` text NOT NULL,
	`services` text NOT NULL,
	`service_details` text DEFAULT '[]' NOT NULL,
	`languages` text DEFAULT '[]' NOT NULL,
	`specialty` text NOT NULL,
	`description` text NOT NULL,
	`lat` text,
	`lng` text,
	`sources` text NOT NULL,
	`checked_at` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workshops_status_city` ON `workshops` (`status`,`city`);--> statement-breakpoint
ALTER TABLE `visits` ADD `moderated_by` text;--> statement-breakpoint
ALTER TABLE `visits` ADD `revision` integer DEFAULT 0 NOT NULL;