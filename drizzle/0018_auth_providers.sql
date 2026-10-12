ALTER TABLE `auth_account_deletions` ADD `identity_provider` text DEFAULT 'supabase' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_settings` ADD `provider` text DEFAULT 'supabase' NOT NULL;