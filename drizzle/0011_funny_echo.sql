CREATE TABLE `workshop_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`workshop_id` text NOT NULL,
	`owner` text NOT NULL,
	`profile` text NOT NULL,
	`base_updated_at` text NOT NULL,
	`decision_token` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderator_note` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`moderated_at` text,
	`moderated_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_workshop_changes_owner` ON `workshop_changes` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_workshop_changes_status` ON `workshop_changes` (`status`);--> statement-breakpoint
CREATE TABLE `workshop_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`workshop_id` text NOT NULL,
	`owner` text NOT NULL,
	`evidence` text NOT NULL,
	`evidence_links` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderator_note` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`moderated_at` text,
	`moderated_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_workshop_claims_owner` ON `workshop_claims` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_workshop_claims_status` ON `workshop_claims` (`status`);--> statement-breakpoint
CREATE TABLE `workshop_owners` (
	`workshop_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`claim_id` text NOT NULL,
	`confirmed_at` text NOT NULL,
	`confirmed_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workshop_owners_account` ON `workshop_owners` (`account_id`);