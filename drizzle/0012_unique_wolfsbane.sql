CREATE TABLE `review_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`owner` text NOT NULL,
	`revision` integer NOT NULL,
	`decision` text NOT NULL,
	`operation_token` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`created_at` text NOT NULL,
	`lease_until` integer,
	`lease_token` text,
	`first_attempt_at` integer,
	`payload` text,
	`provider_key_hash` text,
	`provider_id` text,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `idx_review_notifications_due` ON `review_notifications` (`state`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `idx_review_notifications_owner` ON `review_notifications` (`owner`);