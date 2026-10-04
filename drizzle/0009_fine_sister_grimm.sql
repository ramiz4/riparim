CREATE TABLE `auth_account_deletions` (
	`account_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`started` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_account_deletions_token_hash_unique` ON `auth_account_deletions` (`token_hash`);