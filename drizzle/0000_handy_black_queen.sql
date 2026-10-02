CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`workshop` text NOT NULL,
	`date` text NOT NULL,
	`vehicle` text NOT NULL,
	`service` text NOT NULL,
	`evidence_type` text NOT NULL,
	`evidence_note` text DEFAULT '' NOT NULL,
	`file_key` text,
	`file_name` text,
	`file_type` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderator_note` text DEFAULT '' NOT NULL,
	`moderated_at` text,
	`display_name` text,
	`rating` integer,
	`review` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visits_owner` ON `visits` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_visits_workshop_status` ON `visits` (`workshop`,`status`);