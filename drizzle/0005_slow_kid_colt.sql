CREATE TABLE `workshop_google_ratings` (
	`workshop_id` text PRIMARY KEY NOT NULL,
	`rating` real,
	`review_count` integer,
	`maps_url` text NOT NULL,
	`source_url` text,
	`source_label` text,
	`checked_at` text NOT NULL,
	`source_updated_at` text
);
