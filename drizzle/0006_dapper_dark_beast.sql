CREATE TABLE `workshop_google_places` (
	`workshop_id` text PRIMARY KEY NOT NULL,
	`place_id` text,
	`profile_hash` text NOT NULL,
	`checked_at` integer NOT NULL,
	`retry_after` integer NOT NULL
);
