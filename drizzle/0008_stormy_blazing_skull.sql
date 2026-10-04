CREATE TABLE `auth_account_roles` (
	`account_id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`assigned_at` text NOT NULL,
	`assigned_by` text NOT NULL
);
