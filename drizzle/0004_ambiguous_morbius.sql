ALTER TABLE `auth_links` ADD `password_access` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `provider` text DEFAULT 'password' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `google_subject` text;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `moderator` integer DEFAULT 0 NOT NULL;